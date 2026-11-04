// Rhen typed-function preview. This is a separate, deliberately restricted edition.
// Int64 and source-to-source imports are NOT provided here. SafeInt = JS safe range.
const MAX_SOURCE = 65_536;
const MAX_TOKENS = 4_096;
const MAX_DEPTH = 48;
const MAX_FUNCTIONS = 64;
const MAX_PARAMS = 16;
const MAX_CALL_DEPTH = 16;
const MAX = BigInt(Number.MAX_SAFE_INTEGER);

function invalid(token, message) {
  throw new SyntaxError(`Rhen typed preview ${token.line}:${token.column}: ${message}`);
}

function tokenize(source) {
  if (typeof source !== 'string') throw new TypeError('expected source text');
  if (source.length > MAX_SOURCE) throw new RangeError('source size limit exceeded');
  const tokens = [];
  let index = 0, line = 1, column = 1;
  function add(kind, value, col = column) {
    tokens.push({kind, value, line, column: col});
    if (tokens.length > MAX_TOKENS) throw new RangeError('token limit exceeded');
  }
  while (index < source.length) {
    const ch = source[index];
    if (ch === ' ' || ch === '\t') { index++; column++; continue; }
    if (ch === '\n' || ch === '\r') {
      const start = column;
      if (ch === '\r' && source[index + 1] === '\n') index++;
      add('newline', '\n', start); index++; line++; column = 1; continue;
    }
    if (ch === '#') {
      while (index < source.length && !'\n\r'.includes(source[index])) { index++; column++; }
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      const start = index, col = column;
      while (index < source.length && source[index] >= '0' && source[index] <= '9') {index++; column++;}
      const number = Number(source.slice(start, index));
      if (!Number.isSafeInteger(number)) invalid({line,column:col}, 'literal outside SafeInt range');
      add('number', number, col); continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const start=index, col=column;
      while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) {index++;column++;}
      const word=source.slice(start,index);
      add(['fn','let','print'].includes(word) ? word : 'name', word, col); continue;
    }
    if ('+-*=(){},:>'.includes(ch)) {add(ch,ch);index++;column++;continue;}
    invalid({line,column},`unsupported character ${JSON.stringify(ch)}`);
  }
  add('eof','');
  return tokens;
}

/** Parse an opt-in SafeInt-only typed function experiment, not canonical Rhen. */
export function parseTypedPreview(source) {
  const tokens=tokenize(source);
  let pos=0,depth=0,statementPhase=false;
  const functions=[], topBindings=new Map();
  const functionNames=new Map();
  const peek=()=>tokens[pos];
  function take(kind) {
    const token=peek();
    if (token.kind!==kind) invalid(token,`expected ${kind}, got ${token.kind}`);
    pos++;return token;
  }
  function skipNewlines() {while(peek().kind==='newline')pos++;}
  const scope=(bindings,where)=>({bindings,where});
  function expression(env) {
    let current=product(env);
    while (peek().kind==='+'||peek().kind==='-') {
      const op=tokens[pos++].kind;
      current={kind:'Binary',op,left:current,right:product(env)};
    }
    return current;
  }
  function product(env) {
    let current=atom(env);
    while (peek().kind==='*') {
      pos++;
      current={kind:'Binary',op:'*',left:current,right:atom(env)};
    }
    return current;
  }
  function atom(env) {
    const token=peek();
    if (++depth>MAX_DEPTH) invalid(token,'maximum expression depth exceeded');
    try {
      if (token.kind==='-') {pos++;return {kind:'Negate',value:atom(env)};}
      if (token.kind==='number') {pos++;return {kind:'Number',value:token.value};}
      if (token.kind==='(') {
        pos++;const result=expression(env);take(')');return result;
      }
      if (token.kind==='name') {
        pos++;
        const name=token.value;
        if (peek().kind==='(') {
          const fnIndex=functionNames.get(name);
          if (fnIndex===undefined) invalid(token,`unknown or forward function ${name}`);
          take('(');
          const args=[];
          if (peek().kind!==')') {
            do {
              if (args.length>=MAX_PARAMS) invalid(peek(),'too many arguments');
              args.push(expression(env));
              if (peek().kind!==',')break;
              pos++;
            } while (true);
          }
          take(')');
          const fn=functions[fnIndex];
          if(args.length!==fn.params.length) invalid(token,`function ${name} expects ${fn.params.length} arguments`);
          if(fn.callDepth+1>MAX_CALL_DEPTH) invalid(token,'maximum function call depth exceeded');
          return {kind:'Call',fn:fnIndex,args};
        }
        const slot=env.bindings.get(name);
        if(slot===undefined) invalid(token,`unknown ${env.where} binding ${name}`);
        return {kind:'Read',scope:env.where,slot};
      }
      invalid(token,`expected SafeInt expression, got ${token.kind}`);
    } finally {depth--;}
  }
  // Every function is pure. The small preview only allows calls to earlier
  // declared functions, so recursion and forward calls are rejected.
  skipNewlines();
  while(peek().kind==='fn') {
    if (functions.length>=MAX_FUNCTIONS) invalid(peek(),'function limit exceeded');
    take('fn');
    const name=take('name');
    if(functionNames.has(name.value)) invalid(name,'duplicate function');
    take('(');
    const params=[],names=new Map();
    if(peek().kind!==')') {
      do {
        if(params.length>=MAX_PARAMS) invalid(peek(),'parameter limit exceeded');
        const param=take('name');
        if (names.has(param.value)) invalid(param,'duplicate parameter');
        take(':');
        const type=take('name');
        if(type.value!=='SafeInt') invalid(type,'only SafeInt is supported');
        names.set(param.value,params.length);
        params.push(param.value);
        if(peek().kind!==',')break;
        pos++;
      } while(true);
    }
    take(')');take('-');take('>');
    const returnType=take('name');
    if(returnType.value!=='SafeInt')invalid(returnType,'only SafeInt returns are supported');
    take('{');skipNewlines();
    const body=expression(scope(names,'param'));
    skipNewlines();take('}');
    if(peek().kind!=='newline'&&peek().kind!=='eof')invalid(peek(),'expected newline after function');
    skipNewlines();
    assertExpressionDepth(body);
    const callDepth=1+maxCallDepth(body,functions);
    if(callDepth>MAX_CALL_DEPTH)invalid(name,'maximum function call depth exceeded');
    const fn={name:name.value,params,body,callDepth};
    functionNames.set(name.value,functions.length);
    functions.push(fn);
  }
  const statements=[];
  while(peek().kind!=='eof') {
    skipNewlines();
    if(peek().kind==='eof')break;
    if(peek().kind==='fn')invalid(peek(),'functions must precede statements');
    const token=peek();
    if(token.kind==='let') {
      take('let');const name=take('name');
      if(topBindings.has(name.value)||functionNames.has(name.value))invalid(name,'duplicate or conflicting binding');
      take('=');
      const value=expression(scope(topBindings,'global'));
      assertExpressionDepth(value);
      const slot=topBindings.size;
      topBindings.set(name.value,slot);
      statements.push({kind:'Let',slot,name:name.value,value});
    } else if(token.kind==='print') {
      take('print');
      const value=expression(scope(topBindings,'global'));
      assertExpressionDepth(value);
      statements.push({kind:'Print',value});
    } else invalid(token,'expected let or print');
    if(peek().kind!=='newline'&&peek().kind!=='eof')invalid(peek(),'expected newline');
    skipNewlines();
  }
  return {version:'rhen.typed.preview.v0',functions,statements};
}

function assertExpressionDepth(node, depth = 0) {
  if (depth > MAX_DEPTH) throw new RangeError('Rhen typed preview expression depth exceeded');
  if (node.kind === 'Negate') assertExpressionDepth(node.value, depth + 1);
  if (node.kind === 'Binary') {
    assertExpressionDepth(node.left, depth + 1);
    assertExpressionDepth(node.right, depth + 1);
  }
  if (node.kind === 'Call') {
    for (const arg of node.args) assertExpressionDepth(arg, depth + 1);
  }
}

function maxCallDepth(node,functions) {
  switch(node.kind) {
    case 'Call':return Math.max(functions[node.fn].callDepth,...node.args.map(a=>maxCallDepth(a,functions)));
    case 'Binary':return Math.max(maxCallDepth(node.left,functions),maxCallDepth(node.right,functions));
    case 'Negate':return maxCallDepth(node.value,functions);
    default:return 0;
  }
}

