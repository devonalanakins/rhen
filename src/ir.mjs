// Versioned Rhen M0 IR validator. This module does not execute input code.
export const IR_VERSION = 'rhen.ir.v0';
const MAX_IR_BYTES = 1_048_576;
const MAX_STATEMENTS = 2_048;
const MAX_NODES = 4_096;
const MAX_EXPRESSION_DEPTH = 48; // Matches the existing M0 emitter's depth guard.
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function invalid(location, reason) {
  throw new TypeError(`Rhen IR ${location}: ${reason}`);
}

function record(value, path, expected) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid(path, 'expected object');
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) invalid(path, 'expected plain JSON object');
  if (Object.getOwnPropertySymbols(value).length !== 0) invalid(path, 'symbol properties are unsupported');
  const descs = Object.getOwnPropertyDescriptors(value);
  const fields = Object.keys(descs).sort();
  if (fields.length !== expected.length || fields.some((name, i) => name !== [...expected].sort()[i])) {
    invalid(path, `expected fields ${expected.join(', ')}`);
  }
  for (const field of fields) {
    if (!('value' in descs[field])) invalid(path, 'accessor properties are not permitted');
  }
  return Object.fromEntries(fields.map(field => [field, descs[field].value]));
}

function nonnegativeSafeInteger(value, path) {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) invalid(path, 'expected a nonnegative safe integer');
  return value;
}

function expression(value, path, maxReadableSlot, budget, depth = 0) {
  if (depth > MAX_EXPRESSION_DEPTH) invalid(path, 'maximum expression depth exceeded');
  if (++budget.nodes > MAX_NODES) invalid(path, 'maximum node count exceeded');
  const kind = recordKind(value, path);
  switch (kind) {
    case 'Number': {
      const node = record(value, path, ['kind', 'value']);
      return {kind, value: nonnegativeSafeInteger(node.value, `${path}.value`)};
    }
    case 'Read': {
      const node = record(value, path, ['kind', 'slot']);
      const slot = nonnegativeSafeInteger(node.slot, `${path}.slot`);
      if (slot >= maxReadableSlot) invalid(path, 'read of uninitialized or unknown slot');
      return {kind, slot};
    }
    case 'Negate': {
      const node = record(value, path, ['kind', 'value']);
      return {kind, value: expression(node.value, `${path}.value`, maxReadableSlot, budget, depth + 1)};
    }
    case 'Binary': {
      const node = record(value, path, ['kind', 'op', 'left', 'right']);
      if (!['+', '-', '*'].includes(node.op)) invalid(path, 'unsupported arithmetic operator');
      return {
        kind, op: node.op,
        left: expression(node.left, `${path}.left`, maxReadableSlot, budget, depth + 1),
        right: expression(node.right, `${path}.right`, maxReadableSlot, budget, depth + 1),
      };
    }
    default: invalid(path, `unknown expression kind ${JSON.stringify(kind)}`);
  }
}

function recordKind(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid(path, 'expected object');
  const desc = Object.getOwnPropertyDescriptor(value, 'kind');
  if (!desc || !('value' in desc) || typeof desc.value !== 'string') invalid(path, 'missing string kind');
  return desc.value;
}

/** Validates and returns an independent, sanitized representation. */
export function validateIR(input) {
  const root = record(input, '$', ['version', 'statements']);
  if (root.version !== IR_VERSION) invalid('$.version', `expected ${IR_VERSION}`);
  if (!Array.isArray(root.statements)) invalid('$.statements', 'expected array');
  if (root.statements.length > MAX_STATEMENTS) invalid('$.statements', 'maximum statement count exceeded');
  const result = [];
  const named = new Set();
  const budget = {nodes: 0};
  let nextSlot = 0;
  for (let i = 0; i < root.statements.length; i++) {
    const path = `$.statements[${i}]`;
    const node = root.statements[i];
    const kind = recordKind(node, path);
    if (++budget.nodes > MAX_NODES) invalid(path, 'maximum node count exceeded');
    if (kind === 'Let') {
      const value = record(node, path, ['kind', 'slot', 'name', 'value']);
      if (value.slot !== nextSlot) invalid(path, `expected sequential slot ${nextSlot}`);
      if (typeof value.name !== 'string' || !NAME.test(value.name) || ['let', 'print'].includes(value.name)) {
        invalid(path, 'invalid source identifier');
      }
      if (named.has(value.name)) invalid(path, 'duplicate binding name');
      const expr = expression(value.value, `${path}.value`, nextSlot, budget);
      result.push({kind, slot: nextSlot, name: value.name, value: expr});
      named.add(value.name);
      nextSlot++;
    } else if (kind === 'Print') {
      const value = record(node, path, ['kind', 'value']);
      result.push({kind, value: expression(value.value, `${path}.value`, nextSlot, budget)});
    } else {
      invalid(path, `unknown statement kind ${JSON.stringify(kind)}`);
    }
  }
  return {version: IR_VERSION, statements: result};
}

/** Strict size cap before JSON decoding; output is a sanitized validated IR. */
export function parseIRJSON(json) {
  if (typeof json !== 'string') throw new TypeError('Rhen IR: expected JSON string');
  if (Buffer.byteLength(json, 'utf8') > MAX_IR_BYTES) throw new RangeError('Rhen IR: JSON byte limit exceeded');
  return validateIR(JSON.parse(json));
}
