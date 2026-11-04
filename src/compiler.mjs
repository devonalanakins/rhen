import {validateIR} from './ir.mjs';
// Rhen M0 research prototype: a deliberately narrow, deterministic frontend.
const MAX_CHARS = 65536;
const MAX_TOKENS = 4096;
const MAX_DEPTH = 48;

function fail(line, column, message) {
  throw new SyntaxError(`Rhen M0 ${line}:${column}: ${message}`);
}

export function tokenize(source) {
  if (typeof source !== 'string') throw new TypeError('Rhen M0 expects source text');
  if (source.length > MAX_CHARS) throw new RangeError('Rhen M0 source limit exceeded');
  const tokens = [];
  let index = 0;
  let line = 1;
  let column = 1;
  const push = (kind, value, l = line, c = column) => {
    tokens.push({ kind, value, line: l, column: c });
    if (tokens.length > MAX_TOKENS) throw new RangeError('Rhen M0 token limit exceeded');
  };
  while (index < source.length) {
    const char = source[index];
    if (char === ' ' || char === '\t') { index++; column++; continue; }
    if (char === '\r' || char === '\n') {
      if (char === '\r' && source[index + 1] === '\n') index++;
      push('newline', '\n'); index++; line++; column = 1; continue;
    }
    if (char === '#') {
      while (index < source.length && source[index] !== '\n' && source[index] !== '\r') { index++; column++; }
      continue;
    }
    if (/[0-9]/.test(char)) {
      const start = index; const begin = column;
      while (index < source.length && /[0-9]/.test(source[index])) { index++; column++; }
      const raw = source.slice(start, index);
      const value = Number(raw);
      if (!Number.isSafeInteger(value)) fail(line, begin, 'integer literal outside safe range');
      push('number', value, line, begin);
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const start = index; const begin = column;
      while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) { index++; column++; }
      const word = source.slice(start, index);
      push(word === 'let' || word === 'print' ? word : 'name', word, line, begin);
      continue;
    }
    if ('+-*=()'.includes(char)) { push(char, char); index++; column++; continue; }
    fail(line, column, `unsupported character ${JSON.stringify(char)}`);
  }
  push('eof', '', line, column);
  return tokens;
}

export function parse(source) {
  const tokens = tokenize(source);
  let cursor = 0;
  let depth = 0;
  const bindings = new Map();
  const peek = () => tokens[cursor];
  const consume = (kind) => {
    const found = peek();
    if (found.kind !== kind) fail(found.line, found.column, `expected ${kind}, got ${found.kind}`);
    cursor++;
    return found;
  };
  const expression = () => {
    let node = product();
    while (peek().kind === '+' || peek().kind === '-') {
      const op = tokens[cursor++].kind;
      node = { kind: 'Binary', op, left: node, right: product() };
    }
    return node;
  };
  const product = () => {
    let node = atom();
    while (peek().kind === '*') {
      cursor++;
      node = { kind: 'Binary', op: '*', left: node, right: atom() };
    }
    return node;
  };
  const atom = () => {
    const found = peek();
    depth++;
    if (depth > MAX_DEPTH) fail(found.line, found.column, 'maximum expression depth exceeded');
    try {
      if (found.kind === '-') { cursor++; return { kind: 'Negate', value: atom() }; }
      if (found.kind === 'number') { cursor++; return { kind: 'Number', value: found.value }; }
      if (found.kind === 'name') {
        cursor++;
        if (!bindings.has(found.value)) fail(found.line, found.column, `unknown name ${found.value}`);
        return { kind: 'Read', slot: bindings.get(found.value) };
      }
      if (found.kind === '(') {
        cursor++;
        const inner = expression();
        consume(')');
        return inner;
      }
      fail(found.line, found.column, `expected expression, got ${found.kind}`);
    } finally {
      depth--;
    }
  };
  const statements = [];
  while (peek().kind !== 'eof') {
    if (peek().kind === 'newline') { cursor++; continue; }
    const start = peek();
    if (start.kind === 'let') {
      cursor++;
      const name = consume('name');
      if (bindings.has(name.value)) fail(name.line, name.column, `duplicate name ${name.value}`);
      consume('=');
      const value = expression();
      const slot = bindings.size;
      bindings.set(name.value, slot);
      statements.push({ kind: 'Let', slot, name: name.value, value });
    } else if (start.kind === 'print') {
      cursor++;
      statements.push({ kind: 'Print', value: expression() });
    } else {
      fail(start.line, start.column, 'expected let or print');
    }
    if (peek().kind === 'newline') cursor++;
    else if (peek().kind !== 'eof') fail(peek().line, peek().column, 'expected newline');
  }
  return { version: 'rhen.ir.v0', statements };
}

function emitExpression(value, depth = 0) {
  if (depth > MAX_DEPTH) throw new RangeError('Rhen M0 output expression depth exceeded');
  switch (value.kind) {
    case 'Number': return String(value.value);
    case 'Read': return `_rhen_${value.slot}`;
    case 'Negate': return `_rhen_safe((-${emitExpression(value.value, depth + 1)}))`;
    case 'Binary':
      return `_rhen_safe((${emitExpression(value.left, depth + 1)} ${value.op} ${emitExpression(value.right, depth + 1)}))`;
    default: throw new TypeError('unknown IR expression kind');
  }
}

export function compile(source, target = 'ir') {
  if (!['ir', 'js', 'python'].includes(target)) throw new TypeError('unknown output target');
  const ir = validateIR(parse(source));
  if (target === 'ir') return `${JSON.stringify(ir, null, 2)}
`;
  const js = target === 'js';
  const lines = js
    ? ['"use strict";', 'const _rhen_safe = (n) => { if (!Number.isSafeInteger(n)) throw new RangeError("Rhen M0 integer overflow"); return n === 0 ? 0 : n; };']
    : ['def _rhen_safe(n):', '    if not isinstance(n, int) or not -(2 ** 53 - 1) <= n <= (2 ** 53 - 1):', '        raise OverflowError("Rhen M0 integer overflow")', '    return n'];
  for (const statement of ir.statements) {
    const rendered = `_rhen_safe(${emitExpression(statement.value)})`;
    if (statement.kind === 'Let') lines.push(js ? `let _rhen_${statement.slot} = ${rendered};` : `_rhen_${statement.slot} = ${rendered}`);
    else if (statement.kind === 'Print') lines.push(js ? `console.log(${rendered});` : `print(${rendered})`);
    else throw new TypeError('unknown IR statement kind');
  }
  return lines.join('\n') + '\n';
}
