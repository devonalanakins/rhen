import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {
  evaluateTypedPreview,
  compileTypedPreview,
  evaluateTypedPreviewIR,
  compileTypedPreviewIR,
  parseTypedPreview,
} from '../src/typed-preview.mjs';

const run=(bin,args,source)=>spawnSync(bin,args,{input:source,encoding:'utf8',timeout:5000,maxBuffer:256*1024});
const hasPython=run('python3',['--version'],'').status===0;

// Compact, nonrecursive source can cause exponential dynamic work.
function repeatedCalls(depth) {
  const lines=['fn f0() -> SafeInt { 0 }'];
  for(let i=1;i<=depth;i++) {
    const calls=Array.from({length:4},()=> 'f'+(i-1)+'()').join(' + ');
    lines.push('fn f'+i+'() -> SafeInt { '+calls+' }');
  }
  lines.push('print 7');
  lines.push('print f'+depth+'()');
  return lines.join('\n')+'\n';
}

test('shallow exponential calls halt under shared evaluation budget on all backends',()=>{
  const source=repeatedCalls(8);
  const ir=parseTypedPreview(source);
  let error;
  try {evaluateTypedPreviewIR(ir);} catch(e) {error=e;}
  assert.match(error?.message||'',/evaluation budget exceeded/);
  assert.deepEqual(error.stdout,['7']);
  assert.throws(()=>evaluateTypedPreview(source),/evaluation budget exceeded/);
  const js=run(process.execPath,['--input-type=commonjs'],compileTypedPreviewIR(ir,'js'));
  assert.equal(js.error,undefined,js.error?.message);
  assert.notEqual(js.status,0);
  assert.match(js.stderr,/evaluation budget exceeded/);
  assert.equal(js.stdout,'7\n');
  if(hasPython) {
    const py=run('python3',['-'],compileTypedPreviewIR(ir,'python'));
    assert.equal(py.error,undefined,py.error?.message);
    assert.notEqual(py.status,0);
    assert.match(py.stderr,/evaluation budget exceeded/);
    assert.equal(py.stdout,'7\n');
  }
});

test('bounded branching program still executes normally',()=>{
  const source=repeatedCalls(5);
  assert.deepEqual(evaluateTypedPreview(source).stdout,['7','0']);
  const js=run(process.execPath,['--input-type=commonjs'],compileTypedPreview(source,'js'));
  assert.equal(js.status,0,js.stderr);
  assert.equal(js.stdout,'7\n0\n');
  if(hasPython){
    const py=run('python3',['-'],compileTypedPreview(source,'python'));
    assert.equal(py.status,0,py.stderr);
    assert.equal(py.stdout,'7\n0\n');
  }
});

test('budget is shared across top-level statements, not reset per expression',()=>{
  const source=repeatedCalls(5).replace('print f5()', Array(10).fill('print f5()').join('\n'));
  let error;
  try {evaluateTypedPreview(source);} catch(e) {error=e;}
  assert.match(error?.message||'',/evaluation budget exceeded/);
  assert.equal(error.stdout[0],'7');
  const js=run(process.execPath,['--input-type=commonjs'],compileTypedPreview(source,'js'));
  assert.notEqual(js.status,0);
  assert.match(js.stderr,/evaluation budget exceeded/);
  assert.deepEqual(js.stdout.trim().split('\n'),error.stdout);
  if(hasPython){
    const py=run('python3',['-'],compileTypedPreview(source,'python'));
    assert.notEqual(py.status,0);
    assert.match(py.stderr,/evaluation budget exceeded/);
    assert.deepEqual(py.stdout.trim().split('\n'),error.stdout);
  }
});

test('budget check precedes any overflowing arithmetic after limit reached',()=>{
  const source=repeatedCalls(8).replace('print f8()', 'print f8() + 9007199254740991');
  assert.throws(()=>evaluateTypedPreview(source),/evaluation budget exceeded/);
  const js=run(process.execPath,['--input-type=commonjs'],compileTypedPreview(source,'js'));
  assert.match(js.stderr,/evaluation budget exceeded/);
  if(hasPython) {
    const py=run('python3',['-'],compileTypedPreview(source,'python'));
    assert.match(py.stderr,/evaluation budget exceeded/);
  }
});

test('generated code includes an explicit budget guard instead of relying on host timeout',()=>{
  const source='fn inc(x: SafeInt) -> SafeInt { x + 1 }\nprint inc(3)';
  const js=compileTypedPreview(source,'js');
  const py=compileTypedPreview(source,'python');
  assert.match(js,/const _rhen_step/);
  assert.match(py,/def _rhen_step/);
  assert.match(js,/25_000|25000/);
  assert.match(py,/25_000|25000/);
});
