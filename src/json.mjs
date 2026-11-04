// Reject ambiguous duplicate JSON object keys, including keys encoded with \u escapes.
// JSON.parse performs final syntax validation; this bounded scanner only establishes
// object membership without running user code or retaining untrusted references.
const MAX_JSON_DEPTH = 96;

export function rejectDuplicateJSONMembers(text) {
  let cursor = 0;
  const fail = message => { throw new SyntaxError(`Rhen IR JSON at offset ${cursor}: ${message}`); };
  const whitespace = () => {
    while (cursor < text.length && /[ \t\r\n]/.test(text[cursor])) cursor++;
  };
  const stringToken = decode => {
    if (text[cursor] !== '"') fail('expected string');
    const start = cursor++;
    while (cursor < text.length) {
      const char = text[cursor++];
      if (char === '\\') {
        // The next code unit is escaped, including quotes. JSON.parse will
        // reject invalid escapes and incomplete Unicode sequences.
        cursor++;
      } else if (char === '"') {
        return decode ? JSON.parse(text.slice(start, cursor)) : undefined;
      }
    }
    fail('unterminated string');
  };
  const value = depth => {
    if (depth > MAX_JSON_DEPTH) fail('maximum JSON nesting exceeded');
    whitespace();
    const char = text[cursor];
    if (char === '"') return stringToken(false);
    if (char === '{') {
      cursor++;
      whitespace();
      const names = new Set();
      if (text[cursor] === '}') { cursor++; return; }
      while (cursor < text.length) {
        whitespace();
        const name = stringToken(true);
        if (names.has(name)) fail(`duplicate JSON member ${JSON.stringify(name)}`);
        names.add(name);
        whitespace();
        if (text[cursor++] !== ':') fail('expected colon');
        value(depth + 1);
        whitespace();
        const separator = text[cursor++];
        if (separator === '}') return;
        if (separator !== ',') fail('expected comma or closing brace');
      }
      fail('unterminated object');
    }
    if (char === '[') {
      cursor++;
      whitespace();
      if (text[cursor] === ']') { cursor++; return; }
      while (cursor < text.length) {
        value(depth + 1);
        whitespace();
        const separator = text[cursor++];
        if (separator === ']') return;
        if (separator !== ',') fail('expected comma or closing bracket');
      }
      fail('unterminated array');
    }
    if (char === '-' || (char >= '0' && char <= '9')) {
      // Final numeric grammar (fraction, exponent, leading zero etc.) is
      // always validated by JSON.parse; this scanner only locates boundaries.
      cursor++;
      while (cursor < text.length && /[\d.eE+\-]/.test(text[cursor])) cursor++;
      return;
    }
    for (const word of ['true', 'false', 'null']) {
      if (text.startsWith(word, cursor)) { cursor += word.length; return; }
    }
    fail('unexpected token');
  };
  value(0);
  whitespace();
  if (cursor !== text.length) fail('trailing content');
}
