#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { compile } from '../src/compiler.mjs';

function usage() {
  return 'Usage: node bin/rhen.mjs <file.rn> --target ir|js|python
';
}

async function main(args) {
  if (args.length === 1 && args[0] === '--help') { process.stdout.write(usage()); return; }
  if (args.length !== 3 || args[1] !== '--target' || !['ir','js','python'].includes(args[2])) {
    throw new Error(usage().trim());
  }
  if (!args[0].endsWith('.rn')) throw new Error('source file must end in .rn');
  const text = await readFile(args[0], 'utf8');
  process.stdout.write(compile(text, args[2]));
}
main(process.argv.slice(2)).catch(error => {
  process.stderr.write(`${error.message}
`);
  process.exitCode = 1;
});
