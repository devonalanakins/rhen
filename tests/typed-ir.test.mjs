import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {
  parseTypedPreview, validateTypedPreviewIR, parseTypedPreviewIRJSON,
  evaluateTypedPreview, evaluateTypedPreviewIR, compileTypedPreviewIR,
  compileTypedPreview,
} from '../src/typed-preview.mjs';

const sample = [
  'fn area(width: SafeInt, height: SafeInt) -> SafeInt { width * height }',
  'fn twice(a: SafeInt, b: SafeInt) -> SafeInt { area(a, b) * 2 }',
  'let result = twice(12, 3)',
  'print result',
].join('\n');
const base = () => parseTypedPreview(sample);
const run = (bin, args, source) => spawnSync(bin, args, {
  input: source, encoding: 'utf8', timeout: 3000, maxBuffer: 128 * 1024,
});

function rejects(modifier, message) {
  const ir = base();
  modifier(ir);
  assert.throws(() => validateTypedPreviewIR(ir), message);
  assert.throws(() => evaluateTypedPreviewIR(ir), message);
  assert.throws(() => compileTypedPreviewIR(ir), message);
}

test('source-derived IR validates, round-trips JSON and is detached', () => {
  const ir = base();
  assert.deepEqual(validateTypedPreviewIR(ir), ir);
  assert.deepEqual(parseTypedPreviewIRJSON(JSON.stringify(ir)), ir);
  const copy = validateTypedPreviewIR(ir);
  ir.functions[0].params[0] = 'modified';
  ir.statements[0].value.args[0].value = 50;
  assert.equal(copy.functions[0].params[0], 'width');
  assert.equal(copy.statements[0].value.args[0].value, 12);
});

test('independent evaluation and JS/Python emission consume the same valid IR', () => {
  const ir = parseTypedPreviewIRJSON(JSON.stringify(base()));
  assert.deepEqual(evaluateTypedPreviewIR(ir).stdout, ['72']);
  assert.deepEqual(evaluateTypedPreviewIR(ir), evaluateTypedPreview(sample));
  const js = run(process.execPath, ['--input-type=commonjs'], compileTypedPreviewIR(ir, 'js'));
  assert.equal(js.status, 0, js.stderr);
  assert.equal(js.stdout, '72\n');
  assert.equal(compileTypedPreviewIR(ir, 'js'), compileTypedPreview(sample, 'js'));
  const python = run('python3', ['-'], compileTypedPreviewIR(ir, 'python'));
  if (python.error?.code !== 'ENOENT') {
    assert.equal(python.status, 0, python.stderr);
    assert.equal(python.stdout, '72\n');
  }
});

test('incorrect function call metadata, cycles and forward references reject', () => {
  rejects(ir => {ir.functions[1].callDepth = 1;}, /call depth metadata/);
  rejects(ir => {ir.functions[0].body = {kind:'Call', fn:0, args:[]};}, /expected integer/);
  rejects(ir => {ir.functions[0].body = {kind:'Call', fn:1, args:[]};}, /expected integer/);
  rejects(ir => {ir.functions[1].body.left.fn = 999;}, /expected integer/);
  rejects(ir => {ir.functions[1].body.left.args.pop();}, /arity mismatch/);
});

test('scope and variable identity violations reject', () => {
  rejects(ir => {ir.functions[0].body.left.scope = 'global';}, /wrong scope/);
  rejects(ir => {ir.functions[0].body.left.slot = 2;}, /expected integer/);
  rejects(ir => {ir.statements[0].slot = 1;}, /sequential/);
  rejects(ir => {ir.statements[1].value.slot = 99;}, /expected integer/);
  rejects(ir => {ir.functions[0].params = ['width','width'];}, /duplicate parameter/);
  rejects(ir => {ir.functions[1].name = 'area';}, /duplicate function/);
  rejects(ir => {ir.statements[0].name = 'twice';}, /conflicting/);
  rejects(ir => {ir.functions[0].params[0] = 'let';}, /invalid source identifier/);
});

test('unknown fields, node kinds, operators and invalid numbers reject', () => {
  rejects(ir => {ir.extra = true;}, /expected keys/);
  rejects(ir => {ir.functions[0].body.extra = 1;}, /expected keys/);
  rejects(ir => {ir.statements[1].value = {kind:'Dynamic', value: 1};}, /unsupported expression/);
  rejects(ir => {ir.functions[0].body.op = '/';}, /unsupported operator/);
  rejects(ir => {ir.statements[0].value.args[0].value = -0;}, /expected integer/);
  rejects(ir => {ir.statements[0].value.args[0].value = 9007199254740992;}, /expected integer/);
  rejects(ir => {ir.statements[0].value.args[0].value = NaN;}, /expected integer/);
  rejects(ir => {ir.statements[0].value.args[0].value = 1.5;}, /expected integer/);
  rejects(ir => {ir.version = 'rhen.typed.preview.v1';}, /version/);
});

test('accessor-backed records and statement arrays fail without triggering getters', () => {
  let calls = 0;
  rejects(ir => {
    Object.defineProperty(ir.functions[0], 'body', {enumerable:true, get() {calls++; return {kind:'Number',value:1};}});
  }, /enumerable data/);
  assert.equal(calls, 0);
  rejects(ir => {
    Object.defineProperty(ir.statements, '0', {enumerable:true, get() {calls++; return {kind:'Print',value:{kind:'Number',value:1}};}});
  }, /enumerable data/);
  assert.equal(calls, 0);
  rejects(ir => {delete ir.functions[0].params[0];}, /sparse or extended/);
  rejects(ir => {ir.functions[0].params.custom = 2;}, /sparse or extended/);
  rejects(ir => {Object.defineProperty(ir.functions[0], 'callDepth', {value:1, enumerable:false});}, /enumerable data/);
  rejects(ir => {ir.statements[Symbol('extra')] = true;}, /symbols forbidden/);
});

test('bounded JSON input rejects duplicates, excessive nesting, oversized files', () => {
  const json = JSON.stringify(base());
  assert.deepEqual(parseTypedPreviewIRJSON(json), base());
  assert.throws(() => parseTypedPreviewIRJSON(json.replace('"version":', '"version":"wrong","version":')), /duplicate JSON member/);
  assert.throws(() => parseTypedPreviewIRJSON(json.replace('"version":', '"versi\\u006fn":"wrong","version":')), /duplicate JSON member/);
  assert.throws(() => parseTypedPreviewIRJSON('['.repeat(120)+'0'+']'.repeat(120)), /nesting/);
  assert.throws(() => parseTypedPreviewIRJSON(' '.repeat(1_048_577)), /byte limit/);
  assert.throws(() => parseTypedPreviewIRJSON('{broken'), SyntaxError);
});

test('expression node limits and untrusted cycles are rejected', () => {
  rejects(ir => {ir.functions[0].body.left = ir.functions[0].body;}, /expression depth/);
  rejects(ir => {
    let node = {kind:'Number',value:1};
    for (let i=0; i<60; i++) node = {kind:'Negate',value:node};
    ir.statements[1].value = node;
  }, /expression depth/);
  rejects(ir => {ir.functions[1].body.left.args.push({kind:'Number',value:3});}, /arity mismatch/);
});

test('IR consumers refuse malformed trees instead of passing through source emitters', () => {
  const bad = {version:'rhen.typed.preview.v0', functions:[], statements:[{kind:'Print',value:{kind:'Read',scope:'global',slot:0}}]};
  assert.throws(() => compileTypedPreviewIR(bad, 'js'), /expected integer/);
  assert.throws(() => evaluateTypedPreviewIR(bad), /expected integer/);
  assert.throws(() => compileTypedPreviewIR(base(), 'bash'), /unsupported preview target/);
});
