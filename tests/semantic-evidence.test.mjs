import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {exportTypedSemanticEvidence} from '../src/semantic-evidence.mjs';
import {parseTypedPreviewIRJSON} from '../src/typed-ir.mjs';
import {parseTypedPreview} from '../src/typed-parser.mjs';

const sha = source => createHash('sha256').update(source).digest('hex');
const opts={
  repository:'devonalanakins/rhen',
  revision:'a'.repeat(40),
  claim_id:'safeint-demo',
  policy_digest:'b'.repeat(64),
  run_id:'reference-1',
  observed_at:'2026-11-04T21:00:00Z',
  predicate:'The validated Rhen SafeInt program has the claimed execution trace',
};
test('export binds exact source, validated IR, two nonexecuted target artifacts and actual evaluation',()=>{
  const source='fn twice(n: SafeInt) -> SafeInt { n * 2 }\nprint twice(21)';
  const p=exportTypedSemanticEvidence(source,opts);
  assert.equal(p.schema_version,'merit.evidence.v1');
  assert.equal(p.subject.source_sha256,sha(source));
  assert.equal(p.subject.ir_version,'rhen.typed.preview.v0');
  assert.equal(p.subject.ir_sha256,sha(JSON.stringify(parseTypedPreviewIRJSON(JSON.stringify(parseTypedPreview(source))))));
  assert.match(p.artifacts.js,/^[a-f0-9]{64}$/);
  assert.match(p.artifacts.python,/^[a-f0-9]{64}$/);
  assert.deepEqual(p.witnesses[0].outcome,{stdout:['42'],trap:'none'});
  assert.deepEqual(p.open_obligations,['independent-oracle','js-execution','python-execution']);
  assert.equal(p.witnesses.length,1);
});
test('the exporter preserves observable prefix and overflow classification',()=>{
  const p=exportTypedSemanticEvidence('print 7\nprint 9007199254740991 + 1',opts);
  assert.deepEqual(p.witnesses[0].outcome,{stdout:['7'],trap:'overflow'});
});
test('unsupported source syntax and false metadata are rejected',()=>{
  assert.throws(()=>exportTypedSemanticEvidence('print 1 / 2',opts));
  assert.throws(()=>exportTypedSemanticEvidence('print 1',{...opts,revision:'not-commit'}),/invalid or incomplete/);
  assert.throws(()=>exportTypedSemanticEvidence('print 1',{...opts,policy_digest:'NOT_PINNED'}),/invalid or incomplete/);
});
test('source variations change the source hash even if observable behavior is equal',()=>{
  const a=exportTypedSemanticEvidence('print 2',opts);
  const b=exportTypedSemanticEvidence('print 1 + 1',opts);
  assert.notEqual(a.subject.source_sha256,b.subject.source_sha256);
  assert.notEqual(a.subject.ir_sha256,b.subject.ir_sha256);
});
