import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIRJSON, validateIR} from '../src/ir.mjs';

const number = (n = 1) => ({kind:'Number', value:n});
const stmt = () => ({kind:'Print', value:number()});
const doc = (statements) => ({version:'rhen.ir.v0', statements});

// Previously an element getter was invoked and its returned statement accepted.
test('array element getters are rejected without executing application code', () => {
  let calls = 0;
  const entries = [];
  Object.defineProperty(entries, '0', {
    enumerable:true, configurable:true, get() {calls++; return stmt();}
  });
  assert.throws(() => validateIR(doc(entries)), /accessor or hole/);
  assert.equal(calls, 0);
});

test('array setter-only properties are rejected without reading them', () => {
  const entries = [];
  Object.defineProperty(entries, '0', {enumerable:true, configurable:true, set(_v) {throw Error('setter invoked');}});
  assert.throws(() => validateIR(doc(entries)), /accessor or hole/);
});

test('sparse statements arrays cannot be treated as JSON arrays', () => {
  const entries = [stmt(), ,stmt()];
  assert.throws(() => validateIR(doc(entries)), /dense array/);
});

test('extra string and symbol properties on arrays are rejected', () => {
  const extra = [stmt()];
  Object.defineProperty(extra, 'hidden', {value:'ignored',enumerable:false});
  assert.throws(() => validateIR(doc(extra)), /dense array/);
  const sym = [stmt()];
  sym[Symbol('leak')] = 1;
  assert.throws(() => validateIR(doc(sym)), /symbol/);
});

test('modified array prototypes are rejected', () => {
  const entries = [stmt()];
  Object.setPrototypeOf(entries, null);
  assert.throws(() => validateIR(doc(entries)), /ordinary array/);
});

test('readonly frozen ordinary arrays still work', () => {
  const entries = Object.freeze([stmt()]);
  assert.deepEqual(validateIR(doc(entries)), doc([stmt()]));
});

test('no source-object aliasing is retained in validated result', () => {
  const entries = [stmt()];
  const safe = validateIR(doc(entries));
  entries[0].value.value = 99;
  assert.equal(safe.statements[0].value.value, 1);
});

test('JSON entry point validates only admitted objects and rejects extra fields', () => {
  assert.deepEqual(parseIRJSON(JSON.stringify(doc([stmt()]))), doc([stmt()]));
  assert.throws(() => parseIRJSON('{"version":"rhen.ir.v0","statements":[],"__proto__":{}}'), /expected fields/);
});

test('nonenumerable array entries are rejected as non-JSON-like', () => {
  const entries = [];
  Object.defineProperty(entries, '0', {value:stmt(), enumerable:false});
  assert.throws(() => validateIR(doc(entries)), /accessor or hole/);
});
