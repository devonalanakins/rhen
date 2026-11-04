// Validation for the isolated SafeInt typed-function experiment.
// This is not the normative future Rhen CSIR or checked-i64 type system.
import {rejectDuplicateJSONMembers} from './json.mjs';

export const TYPED_PREVIEW_IR_VERSION = 'rhen.typed.preview.v0';
const MAX_IR_BYTES = 1_048_576;
const MAX_FUNCTIONS = 64;
const MAX_PARAMS = 16;
const MAX_STATEMENTS = 2_048;
const MAX_NODES = 4_096;
const MAX_EXPRESSION_DEPTH = 48;
const MAX_CALL_DEPTH = 16;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED = new Set(['fn', 'let', 'print']);

function invalid(path, reason) {
  throw new TypeError(`Rhen typed IR ${path}: ${reason}`);
}
function record(input, path, keys) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    invalid(path, 'expected plain record');
  }
  if (![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    invalid(path, 'unsupported record prototype');
  }
  if (Object.getOwnPropertySymbols(input).length !== 0) invalid(path, 'symbol keys forbidden');
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const found = Object.keys(descriptors).sort();
  const expected = [...keys].sort();
  if (found.length !== expected.length || found.some((key, i) => key !== expected[i])) {
    invalid(path, `expected keys: ${keys.join(', ')}`);
  }
  const result = Object.create(null);
  for (const key of keys) {
    const field = descriptors[key];
    if (!field || !('value' in field) || !field.enumerable) {
      invalid(path, `field ${key} must be enumerable data`);
    }
    Object.defineProperty(result, key, {
      value: field.value, enumerable: true, configurable: true, writable: true,
    });
  }
  return result;
}
function array(input, path, max) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) {
    invalid(path, 'expected ordinary array');
  }
  if (input.length > max) invalid(path, 'array length limit exceeded');
  if (Object.getOwnPropertySymbols(input).length) invalid(path, 'array symbols forbidden');
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Object.keys(descriptors).length !== input.length + 1) {
    invalid(path, 'sparse or extended array');
  }
  const copy = [];
  for (let i = 0; i < input.length; i++) {
    const field = descriptors[String(i)];
    if (!field || !('value' in field) || !field.enumerable) {
      invalid(`${path}[${i}]`, 'array element must be enumerable data');
    }
    copy.push(field.value);
  }
  return copy;
}
function uint(value, path, bound) {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0) || value > bound) {
    invalid(path, `expected integer from 0 to ${bound}`);
  }
  return value;
}
function name(value, path) {
  if (typeof value !== 'string' || !IDENTIFIER.test(value) || RESERVED.has(value)) {
    invalid(path, 'invalid source identifier');
  }
  return value;
}
function expr(input, path, env, functions, budget, depth = 0) {
  if (depth > MAX_EXPRESSION_DEPTH) invalid(path, 'expression depth limit exceeded');
  if (++budget.nodes > MAX_NODES) invalid(path, 'node count limit exceeded');
  const raw = recordKind(input, path);
  switch (raw) {
    case 'Number': {
      const n = record(input, path, ['kind', 'value']);
      return {node: {kind: 'Number', value: uint(n.value, `${path}.value`, Number.MAX_SAFE_INTEGER)}, calls: 0};
    }
    case 'Read': {
      const n = record(input, path, ['kind', 'scope', 'slot']);
      if (n.scope !== env.scope) invalid(path, 'read in wrong scope');
      return {node: {kind: 'Read', scope: env.scope, slot: uint(n.slot, `${path}.slot`, env.slots - 1)}, calls: 0};
    }
    case 'Negate': {
      const n = record(input, path, ['kind', 'value']);
      const value = expr(n.value, `${path}.value`, env, functions, budget, depth + 1);
      return {node: {kind: 'Negate', value: value.node}, calls: value.calls};
    }
    case 'Binary': {
      const n = record(input, path, ['kind', 'op', 'left', 'right']);
      if (!['+', '-', '*'].includes(n.op)) invalid(path, 'unsupported operator');
      const left = expr(n.left, `${path}.left`, env, functions, budget, depth + 1);
      const right = expr(n.right, `${path}.right`, env, functions, budget, depth + 1);
      return {
        node: {kind: 'Binary', op: n.op, left: left.node, right: right.node},
        calls: Math.max(left.calls, right.calls),
      };
    }
    case 'Call': {
      const n = record(input, path, ['kind', 'fn', 'args']);
      const index = uint(n.fn, `${path}.fn`, functions.length - 1);
      const actual = functions[index];
      const args = array(n.args, `${path}.args`, MAX_PARAMS);
      if (args.length !== actual.params.length) invalid(path, 'function arity mismatch');
      const checkedArgs = args.map((arg, i) => expr(
        arg, `${path}.args[${i}]`, env, functions, budget, depth + 1,
      ));
      return {
        node: {kind: 'Call', fn: index, args: checkedArgs.map(arg => arg.node)},
        calls: Math.max(actual.callDepth, ...checkedArgs.map(arg => arg.calls)),
      };
    }
    default: invalid(path, `unsupported expression kind ${JSON.stringify(raw)}`);
  }
}
function recordKind(input, path) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) invalid(path, 'expected expression');
  const descriptor = Object.getOwnPropertyDescriptor(input, 'kind');
  if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string') {
    invalid(path, 'missing kind');
  }
  return descriptor.value;
}

/** Validates all scope, call, depth and shape invariants, returning a detached tree. */
export function validateTypedPreviewIR(input) {
  const root = record(input, '$', ['version', 'functions', 'statements']);
  if (root.version !== TYPED_PREVIEW_IR_VERSION) invalid('$.version', 'unsupported IR version');
  const functionsInput = array(root.functions, '$.functions', MAX_FUNCTIONS);
  const statementsInput = array(root.statements, '$.statements', MAX_STATEMENTS);
  const functions = [];
  const functionNames = new Set();
  const budget = {nodes: 0};
  for (let i = 0; i < functionsInput.length; i++) {
    const path = `$.functions[${i}]`;
    if (++budget.nodes > MAX_NODES) invalid(path, 'node count limit exceeded');
    const raw = record(functionsInput[i], path, ['name', 'params', 'body', 'callDepth']);
    const fnName = name(raw.name, `${path}.name`);
    if (functionNames.has(fnName)) invalid(path, 'duplicate function');
    const params = array(raw.params, `${path}.params`, MAX_PARAMS)
      .map((param, p) => name(param, `${path}.params[${p}]`));
    if (new Set(params).size !== params.length) invalid(path, 'duplicate parameter');
    const body = expr(raw.body, `${path}.body`, {scope: 'param', slots: params.length}, functions, budget);
    const calculatedDepth = body.calls + 1;
    if (calculatedDepth > MAX_CALL_DEPTH) invalid(path, 'function call depth limit exceeded');
    if (raw.callDepth !== calculatedDepth) invalid(path, 'incorrect function call depth metadata');
    functions.push({name: fnName, params, body: body.node, callDepth: calculatedDepth});
    functionNames.add(fnName);
  }
  const globalNames = new Set();
  const statements = [];
  let slotCount = 0;
  for (let i = 0; i < statementsInput.length; i++) {
    const path = `$.statements[${i}]`;
    if (++budget.nodes > MAX_NODES) invalid(path, 'node count limit exceeded');
    const kind = recordKind(statementsInput[i], path);
    if (kind === 'Let') {
      const raw = record(statementsInput[i], path, ['kind', 'slot', 'name', 'value']);
      if (raw.slot !== slotCount) invalid(path, 'expected sequential binding slot');
      const binding = name(raw.name, `${path}.name`);
      if (globalNames.has(binding) || functionNames.has(binding)) invalid(path, 'conflicting binding name');
      const value = expr(raw.value, `${path}.value`, {scope: 'global', slots: slotCount}, functions, budget);
      statements.push({kind: 'Let', slot: slotCount, name: binding, value: value.node});
      globalNames.add(binding);
      slotCount++;
    } else if (kind === 'Print') {
      const raw = record(statementsInput[i], path, ['kind', 'value']);
      const value = expr(raw.value, `${path}.value`, {scope: 'global', slots: slotCount}, functions, budget);
      statements.push({kind: 'Print', value: value.node});
    } else invalid(path, 'unsupported statement kind');
  }
  return {version: TYPED_PREVIEW_IR_VERSION, functions, statements};
}

/** External JSON ingress. Do not pass hostile JavaScript Proxies to object validator. */
export function parseTypedPreviewIRJSON(text) {
  if (typeof text !== 'string') throw new TypeError('expected typed IR JSON text');
  if (Buffer.byteLength(text, 'utf8') > MAX_IR_BYTES) throw new RangeError('typed IR byte limit exceeded');
  rejectDuplicateJSONMembers(text);
  return validateTypedPreviewIR(JSON.parse(text));
}
