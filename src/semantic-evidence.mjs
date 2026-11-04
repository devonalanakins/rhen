// Optional read-only Merit evidence adapter for the isolated Rhen SafeInt preview.
// The caller supplies revision and policy identifiers: this module cannot attest them.
import {createHash} from 'node:crypto';
import {parseTypedPreview} from './typed-parser.mjs';
import {validateTypedPreviewIR} from './typed-ir.mjs';
import {evaluateTypedPreviewIR,compileTypedPreviewIR} from './typed-runtime.mjs';

const hex = text => createHash('sha256').update(text,'utf8').digest('hex');
const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/;
const REPO = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
const TIMESTAMP = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;

/** The export does NOT execute generated JS/Python or authenticate its own witness. */
export function exportTypedSemanticEvidence(source, options) {
  if (typeof source !== 'string') throw new TypeError('expected Rhen source text');
  if (!options || typeof options !== 'object') throw new TypeError('missing evidence identity options');
  const {repository,revision,claim_id,policy_digest,run_id,observed_at,predicate} = options;
  if(!REPO.test(repository)||!SHA.test(revision)||!ID.test(claim_id)||
     !DIGEST.test(policy_digest)||!ID.test(run_id)||
     typeof observed_at!=='string'||!TIMESTAMP.test(observed_at)||Number.isNaN(Date.parse(observed_at))||
     typeof predicate!=='string'||predicate.length<1||predicate.length>1000||/[\x00-\x1f\x7f]/.test(predicate)) {
    throw new TypeError('invalid or incomplete source, run, claim or policy identity');
  }
  const ir = validateTypedPreviewIR(parseTypedPreview(source));
  const source_sha256=hex(source),ir_sha256=hex(JSON.stringify(ir));
  const artifacts={js:hex(compileTypedPreviewIR(ir,'js')),python:hex(compileTypedPreviewIR(ir,'python'))};
  let outcome;
  try {
    outcome={stdout:evaluateTypedPreviewIR(ir).stdout,trap:'none'};
  } catch(error) {
    const trap=error.message==='Rhen SafeInt overflow'?'overflow':
      error.message==='Rhen typed preview evaluation budget exceeded'?'budget':null;
    if(!trap || !Array.isArray(error.stdout))throw error;
    outcome={stdout:[...error.stdout],trap};
  }
  return {
    schema_version:'merit.evidence.v1',claim_id,
    subject:{repository,revision,source_sha256,ir_version:ir.version,ir_sha256},
    predicate,scope:{language:'Rhen',semantics:ir.version,targets:['reference','js','python']},
    assumptions:['Source revision, policy and run metadata are caller assertions, not independently authenticated'],
    policy_digest,artifacts,
    witnesses:[{id:'rhen-reference',obligation:'program-trace',producer:'rhen-reference',run_id,attempt:1,
      revision,source_sha256,ir_sha256,toolchain:'node-'+process.versions.node,
      observed_at,outcome,depends_on:[]}],
    unsupported:[],open_obligations:['independent-oracle','js-execution','python-execution'],
    verification_method:'Rhen typed-preview reference evaluator; JS/Python artifacts hashed without execution',
  };
}
