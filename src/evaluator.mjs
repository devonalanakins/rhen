// A separate M0 semantic oracle. Uses exact BigInt intermediate arithmetic.
// This evaluator does not execute generated JavaScript or Python source.
import {validateIR} from './ir.mjs';

const MAX = BigInt(Number.MAX_SAFE_INTEGER);
const MIN = -MAX;

function checked(value) {
  if (value > MAX || value < MIN) throw new RangeError('Rhen M0 integer overflow');
  return value;
}

function evaluateExpression(node, slots) {
  switch (node.kind) {
    case 'Number': return BigInt(node.value);
    case 'Read': return slots[node.slot];
    case 'Negate': return checked(-evaluateExpression(node.value, slots));
    case 'Binary': {
      const left = evaluateExpression(node.left, slots);
      const right = evaluateExpression(node.right, slots);
      if (node.op === '+') return checked(left + right);
      if (node.op === '-') return checked(left - right);
      if (node.op === '*') return checked(left * right);
      throw new TypeError('unreachable IR operator');
    }
    default: throw new TypeError('unreachable IR expression');
  }
}

/**
 * Evaluate only validated M0 semantics.
 * Returns observable print lines and binding values, without writing to stdout.
 * Throws on arithmetic overflow exactly where a target's safe check should fail.
 */
export function evaluateIR(input) {
  const ir = validateIR(input);
  const slots = [];
  const stdout = [];
  for (const statement of ir.statements) {
    let value;
    try {
      value = checked(evaluateExpression(statement.value, slots));
    } catch (error) {
      // Earlier prints are already observable in emitted target programs.
      // Preserve that trace when a later operation traps.
      Object.defineProperty(error, 'stdout', {value: [...stdout]});
      throw error;
    }
    if (statement.kind === 'Let') slots.push(value);
    else if (statement.kind === 'Print') stdout.push(value.toString());
  }
  return {version: 'rhen.eval.v0', stdout, bindings: slots.map(value => Number(value))};
}
