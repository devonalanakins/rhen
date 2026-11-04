import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {parse, compile} from '../src/compiler.mjs';
import {validateIR, parseIRJSON, IR_VERSION} from '../src/ir.mjs';
import {evaluateIR} from '../src/evaluator.mjs';

const run = (command, args, input) =>
  spawnSync(command, args, {input, encoding:'utf8', timeout: 3000, maxBuffer: 128 * 1024});
const pythonAvailable = !run('python3', ['--version'], '').error;
function outputLines(result) {
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout ? result.stdout.trimEnd().split('\n') : [];
}

// Independent expected values, not computed through the Rhen evaluator.
const valid = [
  ['',[]],['# comment only',[]],['print 0',['0']],
  ['print 1',['1']],['print 99',['99']],
  ['print 9007199254740991',['9007199254740991']],
  ['print -9007199254740991',['-9007199254740991']],
  ['print 1+2*3',['7']],['print (1+2)*3',['9']],
  ['print 8-3-2',['3']],['print 8-(3-2)',['7']],
  ['print -2*4',['-8']],['print --2',['2']],
  ['print -(2+3)',['-5']],['print 0-5',['-5']],
  ['let x=2\nprint x',['2']],
  ['let x=2\nlet y=x+3\nprint y',['5']],
  ['let __proto__=5\nprint __proto__',['5']],
  ['let class=2\nprint class',['2']],
  ['print 2\nprint 3',['2','3']],
  ['print 2\n\nprint 3',['2','3']],
  ['# comment\nprint 6 # inline',['6']],
  ['\r\nprint 6\r\n',['6']],
  ['let x=0\nprint x*1234',['0']],
  ['print 0012',['12']],
  ['print 1000000*1000000',['1000000000000']],
  ['print 9007199254740991-1',['9007199254740990']],
  ['print (4*5)+(10-3)',['27']],
  ['let a=1\nlet b=2\nlet c=a+b\nprint c',['3']],
  ['print (3+4)*(9-2)',['49']],
  ['print 2-4',['-2']],['print -0',['0']],
  ['print ((5))',['5']],['print 3+4+5',['12']],
  ['print 2*3*4',['24']],
  ['let x=9007199254740991\nprint x',['9007199254740991']],
  ['let x=3\nprint x\nprint x+5',['3','8']],
  ['print 999999999',['999999999']],
  ['print 4*0+2',['2']],['print -3+-4',['-7']],
  ['print 2--3',['5']],['print 2*-(3-5)',['4']],
  ['let x=2\nlet y=x*x\nprint y+y',['8']],
  ['print 2+3*4-5',['9']],['print 2*3+4*5',['26']],
  ['let x=1\nlet y=2\nprint (x+y)*3',['9']],
  ['print 3*3*3*3',['81']],['print 2+1 # math',['3']],
  ['print 1\rprint 2',['1','2']],
  ['print (((1+2)))',['3']],
  ['let default=2\nprint default',['2']],
  ['let constructor=2\nprint constructor',['2']],
  ['print 9-9',['0']],['print 10-11',['-1']],
  ['print 1000000000*1000000',['1000000000000000']],
  ['let x=10\nprint -x+20',['10']],
  ['print 7*8-6',['50']],['print 5-9+2',['-2']],
  ['print 0*9007199254740991',['0']],
  ['print 9007199254740991*1',['9007199254740991']],
  ['print -9007199254740991+9007199254740991',['0']],
];

test('M1A: 60+ independently expected programs match evaluator, JS, Python', () => {
  assert.ok(valid.length >= 60);
  const expected=[], jsPrograms=[], pyPrograms=[];
  for (let i=0;i<valid.length;i++) {
    const [source, lines] = valid[i];
    const ir = parse(source);
    assert.equal(ir.version, IR_VERSION);
    assert.deepEqual(validateIR(ir), ir);
    assert.deepEqual(parseIRJSON(JSON.stringify(ir)), ir);
    assert.deepEqual(evaluateIR(ir).stdout, lines, source);
    expected.push(...lines);
    jsPrograms.push('{\n'+compile(source,'js')+'\n}');
    const python = compile(source,'python').trimEnd().split('\n')
      .map(line=>'    '+line).join('\n');
    pyPrograms.push('def _rhen_case_'+i+'():\n'+python+'\n_rhen_case_'+i+'()\n');
  }
  assert.deepEqual(outputLines(run(process.execPath,['--input-type=commonjs'],
    jsPrograms.join('\n'))), expected);
  if (pythonAvailable) assert.deepEqual(outputLines(run('python3',['-'],
    pyPrograms.join('\n'))), expected);
});

const invalidSource = [
  'print missing','let a=a','let a=1\nlet a=2',
  'print 2/3','print 2**3','print 3;','print "hello"',
  'print 1.0','print 9007199254740992','print 1 2',
  'let = 1','let a 1','let a=','print',
  'unknown','let print=1','let let=1','print (1+2',
  'print 1+)','print (','print )','let a=1 print a',
  'print x\nlet x=3','print 0xFF','print 2 && 3',
  'print 1\nlet a = (3','let x=-','print 1\t2',
  'let x=1\nprint y','print @',
];
test('30+ invalid source programs fail before code generation', () => {
  assert.ok(invalidSource.length >= 30);
  for (const source of invalidSource)
    assert.throws(() => parse(source), undefined, source);
});

const overflow = [
  'print 9007199254740991+1',
  'print (9007199254740991+1)-1',
  'print 9007199254740991*2',
  'print 0-9007199254740991-1',
  'let x=9007199254740991\nprint x+x',
  'print (100000000*100000000)*0',
  'print -(9007199254740991+1)',
];
test('overflow is observed at each arithmetic operation', () => {
  for (const source of overflow) {
    const ir=parse(source);
    assert.deepEqual(validateIR(ir), ir);
    assert.throws(() => evaluateIR(ir), /integer overflow/, source);
    const js=run(process.execPath,['--input-type=commonjs'],compile(source,'js'));
    assert.notEqual(js.status, 0, source);
    assert.match(js.stderr,/integer overflow/);
    if (pythonAvailable) {
      const py=run('python3',['-'],compile(source,'python'));
      assert.notEqual(py.status, 0, source);
      assert.match(py.stderr,/integer overflow/);
    }
  }
});

test('foreign malformed IR is rejected, including structural and scope errors', () => {
  const irStatement=node=>({version:IR_VERSION,statements:[node]});
  const bad=[
    null,0,'not an object',[],{}, {version:'rhen.ir.v99',statements:[]},
    {version:IR_VERSION,statements:{}},
    {version:IR_VERSION,statements:[],extra:true},
    irStatement({kind:'Print',value:{kind:'Number',value:-1}}),
    irStatement({kind:'Print',value:{kind:'Number',value:9007199254740992}}),
    irStatement({kind:'Print',value:{kind:'Number',value:-0}}),
    irStatement({kind:'Print',value:{kind:'Number',value:0.1}}),
    irStatement({kind:'Print',value:{kind:'Number',value:NaN}}),
    irStatement({kind:'Print',value:{kind:'Number',value:Infinity}}),
    irStatement({kind:'Print',value:{kind:'Number',value:0,extra:1}}),
    irStatement({kind:'Print',value:{kind:'Binary',op:'/',
      left:{kind:'Number',value:1},right:{kind:'Number',value:2}}}),
    irStatement({kind:'Print',value:{kind:'Read',slot:0}}),
    irStatement({kind:'Let',slot:1,name:'a',value:{kind:'Number',value:1}}),
    irStatement({kind:'Let',slot:0,name:'print',value:{kind:'Number',value:1}}),
    irStatement({kind:'Let',slot:0,name:'let',value:{kind:'Number',value:1}}),
    irStatement({kind:'Let',slot:0,name:'a-b',value:{kind:'Number',value:1}}),
    irStatement({kind:'Let',slot:0,name:'a',value:{kind:'Read',slot:0}}),
    irStatement({kind:'X',value:{kind:'Number',value:1}}),
    irStatement({kind:'Print',value:{kind:'X'}}),
    irStatement({kind:'Print',value:null}),
    {version:IR_VERSION,statements:[
      {kind:'Let',slot:0,name:'a',value:{kind:'Number',value:1}},
      {kind:'Let',slot:1,name:'a',value:{kind:'Number',value:2}}]},
    {version:IR_VERSION,statements:[
      {kind:'Let',slot:0,name:'a',value:{kind:'Number',value:1}},
      {kind:'Print',value:{kind:'Read',slot:1}}]},
  ];
  for (const sample of bad) {
    assert.throws(() => validateIR(sample), undefined, JSON.stringify(sample));
    assert.throws(() => evaluateIR(sample), undefined, JSON.stringify(sample));
  }
  let nested={kind:'Number',value:1};
  for (let i=0;i<50;i++) nested={kind:'Negate',value:nested};
  assert.throws(() => validateIR(irStatement({kind:'Print',value:nested})),/depth/);
  assert.throws(() => validateIR({version:IR_VERSION,statements:
    Array.from({length:2050},()=>({kind:'Print',value:{kind:'Number',value:0}}))}),/statement count/);
  assert.throws(() => parseIRJSON(' '.repeat(1_048_577)),/byte limit/);
  assert.throws(() => parseIRJSON('not-json'),SyntaxError);
});

test('non-JSON object attacks are rejected, not executed as getters', () => {
  const getter={kind:'Print',get value(){throw new Error('getter ran')}};
  assert.throws(()=>validateIR({version:IR_VERSION,statements:[getter]}),/accessor/);
  const sym={version:IR_VERSION,statements:[]};sym[Symbol('hidden')]=1;
  assert.throws(()=>validateIR(sym),/symbol/);
  const cyclic={kind:'Negate'};cyclic.value=cyclic;
  assert.throws(()=>validateIR({version:IR_VERSION,statements:[
    {kind:'Print',value:cyclic}]}),/depth/);
});

test('160 seeded arithmetic statements match independent expected results', () => {
  let state=0xC0FFEE;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
  const sources=[],expected=[];
  for(let i=0;i<160;i++){
    const a=random()%10000,b=random()%10000,c=random()%100;
    sources.push('print ('+a+'+'+b+')*'+c);
    expected.push(String((a+b)*c));
  }
  const program=sources.join('\n');
  assert.deepEqual(evaluateIR(parse(program)).stdout,expected);
  assert.deepEqual(outputLines(run(process.execPath,['--input-type=commonjs'],
    compile(program,'js'))),expected);
  if(pythonAvailable) assert.deepEqual(outputLines(run('python3',['-'],
    compile(program,'python'))),expected);
});

test('CLI runs reference evaluator and original example',()=>{
  assert.deepEqual(outputLines(run(process.execPath,
    ['bin/rhen.mjs','examples/hello.rn','--target','eval'],'')),['36']);
});

test('IR output cannot bypass emitter expression depth limitations',()=>{
  const source='print '+Array.from({length:75},()=> '1').join('+');
  for(const target of ['ir','js','python'])
    assert.throws(()=>compile(source,target),/maximum expression depth/);
});

test('documented schema is a structural aid, not complete semantic validation',()=>{
  const schema=JSON.parse(readFileSync('docs/ir/v0.schema.json','utf8'));
  assert.equal(schema.properties.version.const,IR_VERSION);
  assert.equal(schema.properties.statements.type,'array');
  assert.equal(schema.additionalProperties,false);
  assert.equal(schema.$defs.expression.oneOf.length,4);
});