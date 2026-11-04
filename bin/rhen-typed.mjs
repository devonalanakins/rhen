#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {compileTypedPreview,evaluateTypedPreview} from '../src/typed-preview.mjs';

async function main(args) {
  if(args.length===1 && args[0]==='--help') {
    process.stdout.write('Usage: node bin/rhen-typed.mjs <file.rn> --target eval|js|python\n');
    return;
  }
  if(args.length!==3||args[1]!=='--target'||!['eval','js','python'].includes(args[2])||!args[0].endsWith('.rn')) {
    throw new Error('Usage: node bin/rhen-typed.mjs <file.rn> --target eval|js|python');
  }
  const src=await readFile(args[0],'utf8');
  if(args[2]==='eval') {
    const values=evaluateTypedPreview(src).stdout;
    if(values.length)process.stdout.write(values.join('\n')+'\n');
  } else process.stdout.write(compileTypedPreview(src,args[2]));
}
main(process.argv.slice(2)).catch(err=>{process.stderr.write(`${err.message}\n`);process.exitCode=1;});
