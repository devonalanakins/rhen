import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {parseTypedPreview, evaluateTypedPreview, compileTypedPreview} from '../src/typed-preview.mjs';

const run=(command,args,stdin)=>spawnSync(command,args,{input:stdin,encoding:'utf8',timeout:3000,maxBuffer:128*1024});
const hasPython=run('python3',['--version'],'').status===0;
const number=(n)=>String(n);
const examples=[
  ['print 0',['0']],
  ['let n = 2\nprint n',['2']],
  ['fn x() -> SafeInt { 3 }\nprint x()',['3']],
  ['fn add(a: SafeInt,b: SafeInt) -> SafeInt { a + b }\nprint add(10, 20)',['30']],
  ['fn mul(a: SafeInt,b: SafeInt) -> SafeInt { a * b }\nlet result=mul(7,6)\nprint result',['42']],
  ['fn neg(a: SafeInt) -> SafeInt { -a }\nprint neg(10)',['-10']],
  ['fn a(n: SafeInt) -> SafeInt { n + 1 }\nfn b(m: SafeInt) -> SafeInt { a(m) * 2 }\nprint b(6)',['14']],
  ['fn identity(__proto__: SafeInt) -> SafeInt { __proto__ }\nprint identity(1)',['1']],
  ['fn class(a: SafeInt) -> SafeInt { a }\nprint class(5)',['5']],
  ['fn f(a: SafeInt,b: SafeInt,c: SafeInt) -> SafeInt { (a+b)*c }\nprint f(2,3,4)',['20']],
  ['fn f() -> SafeInt { -0 }\nprint f()',['0']],
  ['fn f(a: SafeInt) -> SafeInt { a }\nprint f(9007199254740991)',['9007199254740991']],
  ['fn f() -> SafeInt { 1 }\nprint f()\nprint f()',['1','1']],
  ['fn f(a: SafeInt) -> SafeInt { 7 }\nprint f(0)',['7']],
  ['fn f(a: SafeInt,b: SafeInt) -> SafeInt { a-b }\nprint f(1,2)',['-1']],
  ['fn f(a: SafeInt) -> SafeInt { a*2 }\nlet x=f(3)\nprint f(x)',['12']],
  ['# comment\nfn f(a: SafeInt) -> SafeInt {\n # comment\n a+1\n}\nprint f(2)',['3']],
  ['fn f(a: SafeInt) -> SafeInt { a }\nprint 2 + f(3) * 4',['14']],
  ['print 1\nlet fnx = 2\nprint fnx',['1','2']],
  ['fn a() -> SafeInt { 2 }\nfn b() -> SafeInt { a()+1 }\nprint b()+b()',['6']],
];

test('typed preview source-to-evaluation-to-JS/Python differential examples',()=>{
  for(const [source,expected] of examples){
    const parsed=parseTypedPreview(source);
    assert.equal(parsed.version,'rhen.typed.preview.v0');
    assert.deepEqual(evaluateTypedPreview(source).stdout,expected,source);
    const js=run(process.execPath,['--input-type=commonjs'],compileTypedPreview(source,'js'));
    assert.equal(js.status,0,js.stderr+source);
    assert.deepEqual(js.stdout.trim().split('\n'),expected,source);
    if(hasPython){
      const py=run('python3',['-'],compileTypedPreview(source,'python'));
      assert.equal(py.status,0,py.stderr+source);
      assert.deepEqual(py.stdout.trim().split('\n'),expected,source);
    }
  }
});

const invalid=[
 'fn f(a: Int) -> SafeInt { a }\nprint f(1)',
 'fn f(a: SafeInt) -> Int { a }\nprint f(1)',
 'fn f(a: SafeInt,a: SafeInt) -> SafeInt { a }\nprint f(1,2)',
 'fn f(a: SafeInt) -> SafeInt { a }\nfn f(b: SafeInt) -> SafeInt { b }',
 'fn f(a: SafeInt) -> SafeInt { a }\nprint f()',
 'fn f(a: SafeInt) -> SafeInt { a }\nprint f(1,2)',
 'fn f(a: SafeInt) -> SafeInt { a }\nprint f(1.2)',
 'fn f(a: SafeInt) -> SafeInt { unknown }\nprint f(2)',
 'fn f(a: SafeInt) -> SafeInt { global }\nlet global=5\nprint f(0)',
 'fn f(a: SafeInt) -> SafeInt { f(a) }\nprint f(0)',
 'fn a() -> SafeInt { b() }\nfn b() -> SafeInt { 1 }',
 'fn a() -> SafeInt { 1 }\nprint a()\nfn b() -> SafeInt { 2 }',
 'fn a() -> SafeInt { 1; process.exit() }\nprint a()',
 'fn a() -> SafeInt { 1 / 2 }\nprint a()',
 'fn a() -> SafeInt { 1 }\nlet a=0',
 'fn a() -> SafeInt { 1 }\nprint a',
 'fn a(a: SafeInt) -> SafeInt { a }\nprint a(10) + x',
 'fn a() -> SafeInt { 9007199254740992 }\nprint a()',
 'let a=1\nprint a()','print b(1)',
 'print -','let x=x','let a=1\nlet a=2',
 'fn a() -> SafeInt { }',
 'fn a() -> SafeInt { 1 } fn b() -> SafeInt { 2 }',
 'fn a() -> SafeInt { 2 }\nprint a().__proto__',
];
test('unsupported and untyped programs fail closed at parse',()=>{
 for(const source of invalid){
  assert.throws(()=>parseTypedPreview(source),undefined,source);
 }
});

test('runtime overflow matches exact reference evaluator and two targets',()=>{
 const cases=[
  'fn plus(a: SafeInt) -> SafeInt { a+1 }\nprint plus(9007199254740991)',
  'fn times(a: SafeInt) -> SafeInt { a*10 }\nprint times(9007199254740991)',
  'fn zero(a: SafeInt) -> SafeInt { a*0 }\nprint zero(9007199254740991+1)',
 ];
 for(const source of cases){
   assert.throws(()=>evaluateTypedPreview(source),/overflow/,source);
   const js=run(process.execPath,['--input-type=commonjs'],compileTypedPreview(source,'js'));
   assert.notEqual(js.status,0,source);assert.match(js.stderr,/overflow/);
   if(hasPython){
    const py=run('python3',['-'],compileTypedPreview(source,'python'));
    assert.notEqual(py.status,0,source);assert.match(py.stderr,/overflow/);
   }
 }
});

test('observed prior output survives a later function trap',()=>{
 const source='fn f(a: SafeInt) -> SafeInt { a+1 }\nprint 7\nprint f(9007199254740991)';
 let err;try{evaluateTypedPreview(source);}catch(e){err=e;}
 assert.equal(err?.message,'Rhen SafeInt overflow');assert.deepEqual(err.stdout,['7']);
 const js=run(process.execPath,['--input-type=commonjs'],compileTypedPreview(source,'js'));
 assert.equal(js.stdout,'7\n');assert.notEqual(js.status,0);
 if(hasPython){const py=run('python3',['-'],compileTypedPreview(source,'python'));assert.equal(py.stdout,'7\n');assert.notEqual(py.status,0);}
});

test('function call chains are statically bounded',()=>{
 const chunks=['fn f0() -> SafeInt { 1 }'];
 for(let i=1;i<19;i++)chunks.push(`fn f${i}() -> SafeInt { f${i-1}() }`);
 assert.throws(()=>parseTypedPreview(chunks.join('\n')),/maximum function call depth/);
});

test('source and parameter limits are enforced',()=>{
 assert.throws(()=>parseTypedPreview(' '.repeat(65537)),/source size limit/);
 const args=Array.from({length:17},(_,i)=>`x${i}: SafeInt`).join(',');
 assert.throws(()=>parseTypedPreview(`fn f(${args}) -> SafeInt { 1 }`),/parameter limit/);
});

test('no arbitrary external code executes during compilation',()=>{
 const source='fn f() -> SafeInt { 1 }\nprint f()';
 const result=compileTypedPreview(source,'js');
 assert.ok(!result.includes('eval('));
 assert.ok(!result.includes('require('));
 assert.throws(()=>compileTypedPreview(source,'bash'),/unsupported preview target/);
});

test('deep left-associative operations are rejected at preview compile stage',()=>{
 const source='print '+Array.from({length:70},()=> '1').join('+');
 assert.throws(()=>parseTypedPreview(source),/expression depth/);
 assert.throws(()=>compileTypedPreview(source,'js'),/expression depth/);
});
