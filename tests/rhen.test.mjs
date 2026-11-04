import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parse, tokenize, compile } from '../src/compiler.mjs';

const example = 'let width = 12
let height = width * (2 + 1)
print height
';
const run = (bin, args, input) => spawnSync(bin, args, { input, encoding: 'utf8' });

test('portable IR has stable version and source order', () => {
  const ir = parse(example);
  assert.equal(ir.version, 'rhen.ir.v0');
  assert.deepEqual(ir.statements.map(s => s.kind), ['Let', 'Let', 'Print']);
  assert.equal(ir.statements[1].slot, 1);
  assert.deepEqual(parse(example), parse(example));
});

test('JS generated code executes with expected result', () => {
  const result = run(process.execPath, ['--input-type=commonjs'], compile(example, 'js'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '36');
});

test('Python generated code executes with same result when python3 is available', t => {
  const check = run('python3', ['--version'], '');
  if (check.error?.code === 'ENOENT') { t.skip('python3 not installed'); return; }
  const result = run('python3', ['-'], compile(example, 'python'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '36');
});

test('comments and CRLF preserve statement separation', () => {
  const ast = parse('# note
let x = 2
print x # safe
');
  assert.equal(ast.statements.length, 2);
  assert.equal(ast.statements[1].value.slot, 0);
});

test('empty source is valid and does not execute user input', () => {
  assert.deepEqual(parse('  # only comment'), {version: 'rhen.ir.v0', statements: []});
});

test('unbound and duplicate variables fail closed', () => {
  assert.throws(() => parse('print missing'), /unknown name/);
  assert.throws(() => parse('let x = x'), /unknown name/);
  assert.throws(() => parse('let x = 1
let x = 2'), /duplicate name/);
});

test('reject non-M0 expressions and code injection', () => {
  for (const source of ['print 1 / 0', 'print "hello"', 'print 1; process.exit(9)', 'let x = 1.2']) {
    assert.throws(() => parse(source), /Rhen M0/);
  }
  assert.throws(() => compile(example, 'bash'), /unknown output target/);
});

test('safe integer literal and operation bounds are explicit', () => {
  assert.throws(() => parse('print 9007199254740992'), /safe range/);
  const source = 'print (9007199254740991 + 1) - 1';
  const js = run(process.execPath, ['--input-type=commonjs'], compile(source, 'js'));
  assert.notEqual(js.status, 0);
  assert.match(js.stderr, /integer overflow/);
  const python = run('python3', ['-'], compile(source, 'python'));
  if (python.error?.code !== 'ENOENT') {
    assert.notEqual(python.status, 0);
    assert.match(python.stderr, /integer overflow/);
  }
});

test('bounded source and nesting reject adversarial inputs', () => {
  assert.throws(() => tokenize(' '.repeat(65537)), /source limit/);
  assert.throws(() => parse('print ' + '('.repeat(50) + '1' + ')'.repeat(50)), /expression depth/);
  assert.throws(() => parse('print ' + '-'.repeat(200) + '1'), /expression depth/);
  assert.throws(() => parse('print 1
'.repeat(2500)), /token limit/);
});

test('reserved and odd identifier names are isolated from target identifiers', () => {
  const source = 'let class = 3
let __proto__ = class + 2
print __proto__';
  const js = run(process.execPath, ['--input-type=commonjs'], compile(source, 'js'));
  assert.equal(js.status, 0, js.stderr);
  assert.equal(js.stdout.trim(), '5');
  assert.ok(!compile(source, 'js').includes('let class'));
});
