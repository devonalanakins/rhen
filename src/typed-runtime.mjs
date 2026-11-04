import {parseTypedPreview} from './typed-parser.mjs';
import {validateTypedPreviewIR} from './typed-ir.mjs';
const MAX_CALL_DEPTH = 16;
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
function checked(number) {
  if (number > MAX || number < -MAX) throw new RangeError('Rhen SafeInt overflow');
  return number;
}

function calculate(node,program,params,globals,callDepth=0) {
  switch(node.kind) {
    case 'Number':return BigInt(node.value);
    case 'Read':return (node.scope==='param'?params:globals)[node.slot];
    case 'Negate':return checked(-calculate(node.value,program,params,globals,callDepth));
    case 'Binary': {
      const a=calculate(node.left,program,params,globals,callDepth);
      const b=calculate(node.right,program,params,globals,callDepth);
      return checked(node.op==='+'?a+b:node.op==='-'?a-b:a*b);
    }
    case 'Call': {
      if(callDepth>=MAX_CALL_DEPTH)throw new RangeError('Rhen function call depth exceeded');
      const values=node.args.map(a=>checked(calculate(a,program,params,globals,callDepth)));
      return checked(calculate(program.functions[node.fn].body,program,values,[],callDepth+1));
    }
    default:throw new TypeError('unknown preview expression');
  }
}

export function evaluateTypedPreviewIR(input) {
  const program=validateTypedPreviewIR(input);
  const globals=[],stdout=[];
  try {
    for(const statement of program.statements) {
      const value=checked(calculate(statement.value,program,[],globals));
      if(statement.kind==='Let')globals.push(value);
      else stdout.push(value.toString());
    }
  } catch(error) {
    Object.defineProperty(error,'stdout',{value:[...stdout]});
    throw error;
  }
  return {version:'rhen.typed.eval.v0',stdout};
}

export function evaluateTypedPreview(source) {
  return evaluateTypedPreviewIR(parseTypedPreview(source));
}

function emitNode(node,language,functions) {
  const checkedName='_rhen_safe';
  switch(node.kind) {
    case 'Number':return String(node.value);
    case 'Read':return node.scope==='param'?`_rhen_p_${node.slot}`:`_rhen_g_${node.slot}`;
    case 'Negate':return `${checkedName}((-${emitNode(node.value,language,functions)}))`;
    case 'Binary':return `${checkedName}((${emitNode(node.left,language,functions)} ${node.op} ${emitNode(node.right,language,functions)}))`;
    case 'Call':return `${checkedName}(_rhen_fn_${node.fn}(${node.args.map(a=>emitNode(a,language,functions)).join(', ')}))`;
    default:throw new TypeError('unsupported IR node');
  }
}

export function compileTypedPreviewIR(input,target='js') {
  if(!['js','python'].includes(target))throw new TypeError('unsupported preview target');
  const program=validateTypedPreviewIR(input);
  const js=target==='js';
  const lines=js
    ? ['"use strict";','const _rhen_safe = n => {if (!Number.isSafeInteger(n)) throw new RangeError("Rhen SafeInt overflow"); return n===0?0:n;};']
    : ['def _rhen_safe(n):','    if not isinstance(n, int) or not -(2 ** 53 - 1) <= n <= (2 ** 53 - 1):','        raise OverflowError("Rhen SafeInt overflow")','    return n'];
  for(let i=0;i<program.functions.length;i++) {
    const fn=program.functions[i];
    const args=fn.params.map((_,j)=>`_rhen_p_${j}`).join(', ');
    const value=`_rhen_safe(${emitNode(fn.body,target,program.functions)})`;
    if(js)lines.push(`function _rhen_fn_${i}(${args}) { return ${value}; }`);
    else lines.push(`def _rhen_fn_${i}(${args}):`,`    return ${value}`);
  }
  for(const statement of program.statements) {
    const value=`_rhen_safe(${emitNode(statement.value,target,program.functions)})`;
    if(statement.kind==='Let')lines.push(js?`const _rhen_g_${statement.slot} = ${value};`:`_rhen_g_${statement.slot} = ${value}`);
    else lines.push(js?`console.log(${value});`:`print(${value})`);
  }
  return lines.join('\n')+'\n';
}

export function compileTypedPreview(source,target='js') {
  return compileTypedPreviewIR(parseTypedPreview(source), target);
}
