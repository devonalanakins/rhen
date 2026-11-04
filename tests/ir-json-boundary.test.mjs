import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIRJSON,validateIR} from '../src/ir.mjs';
const blank = '{"version":"rhen.ir.v0","statements":[]}';
const doc = (statements=[]) => ({version:'rhen.ir.v0',statements});

// This is an independent reproduction of a previously accepted non-roundtrippable input.
test('nonenumerable records fail instead of changing meaning on serialization',()=>{
  const source={statements:[]};
  Object.defineProperty(source,'version',{value:'rhen.ir.v0',enumerable:false});
  assert.throws(()=>validateIR(source),/nonenumerable/);
  assert.deepEqual(validateIR(Object.freeze(doc())),doc());
  const expression={kind:'Number'};
  Object.defineProperty(expression,'value',{value:2,enumerable:false});
  assert.throws(()=>validateIR(doc([{kind:'Print',value:expression}])),/nonenumerable/);
});

test('duplicate root keys rejected instead of last-one-wins',()=>{
  assert.throws(()=>parseIRJSON('{"version":"rhen.ir.v99","version":"rhen.ir.v0","statements":[]}'),/duplicate JSON member/);
  assert.throws(()=>parseIRJSON('{"version":"rhen.ir.v0","statements":[],"statements":[]}'),/duplicate JSON member/);
});

test('escaped keys are decoded before detecting duplicates',()=>{
  assert.throws(()=>parseIRJSON('{"version":"rhen.ir.v0","versi\\u006fn":"rhen.ir.v0","statements":[]}'),/duplicate JSON member/);
  assert.deepEqual(parseIRJSON('{"versi\\u006fn":"rhen.ir.v0","statements":[]}'),doc());
});

test('duplicate nested members and mixed values rejected',()=>{
  const input='{"version":"rhen.ir.v0","statements":[{"kind":"Print","value":{"kind":"Number","value":1,"value":2}}]}';
  assert.throws(()=>parseIRJSON(input),/duplicate JSON member/);
  assert.deepEqual(parseIRJSON('{"version":"rhen.ir.v0","statements":[{"kind":"Print","value":{"kind":"Number","value":1}}]}'),doc([{kind:'Print',value:{kind:'Number',value:1}}]));
});

test('whitespace, escaped strings and normal JSON remain supported',()=>{
  assert.deepEqual(parseIRJSON('\n {\t"version":"rhen.ir.v0", "statements" : [ ] } \n'),doc());
  assert.deepEqual(parseIRJSON(blank),doc());
  assert.throws(()=>parseIRJSON('{"version": "rhen.ir.v0", "statements":[], "str\\u0061nge": "quoted \\""}'),/expected fields/);
});

test('incomplete input and invalid syntax fail without side effects',()=>{
  const invalid=[
    '{"version":', '{"version":"rhen.ir.v0", "statements":[}',
    '{"version":"rhen.ir.v0", "statements":[],}',
    '{"version":"rhen.ir.v0", "statements":[,]}',
    '1e+', 'true false', '["unterminated', '{"bad\\uQ123":4}',
  ];
  for(const raw of invalid) assert.throws(()=>parseIRJSON(raw),undefined,raw);
});

test('excessive JSON nesting fails with controlled error before JSON.parse',()=>{
  const nested='['.repeat(120)+'0'+']'.repeat(120);
  assert.throws(()=>parseIRJSON(nested),/maximum JSON nesting exceeded/);
});

test('1 MB JSON byte boundary remains enforced before lexical scan',()=>{
  assert.throws(()=>parseIRJSON(' '.repeat(1_048_577)),/JSON byte limit exceeded/);
});
