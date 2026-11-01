export const PUBLIC_FILTERS = ['platform','model','gpu','build','profileId','courseRevision','profileRevision','backend','width','height','water','dielectric','fire','evidenceClass','bucket'];
export function publicQuery(input = {}) {
  const q = new URLSearchParams();
  for (const [key,value] of Object.entries(input)) {
    if (PUBLIC_FILTERS.includes(key)) { if(typeof value !== 'string' || !value.length || value.length > 128) throw Error('Invalid filter'); }
    else if(key === 'sort') { if(!['date','frameMedianMs','gpuMedianMs','sampleCount'].includes(value)) throw Error('Invalid sort'); }
    else if(key === 'order') { if(!['asc','desc'].includes(value)) throw Error('Invalid order'); }
    else if(key === 'limit') { if(!Number.isInteger(value) || value < 1 || value > 100) throw Error('Invalid limit'); }
    else if(key === 'cursor') { if(typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(value)) throw Error('Invalid cursor'); }
    else throw Error('Unknown query field');
    q.set(key,String(value));
  }
  return q.toString();
}
const keys = ['schemaVersion','product','classification','countUnit','reportCount','matchingReportCount','provisionalReportCount','rankingEligibleReportCount','revision','bucketDefinitions','missingDataFlags','rows','nextCursor'];
export function readPublicPage(body) {
  if(!body || Object.keys(body).length !== keys.length || keys.some(k=>!Object.hasOwn(body,k)) || body.schemaVersion !== 1 || body.product !== 'horde-lantern-rt' || body.classification !== 'community-client-reported' || body.countUnit !== 'reports') throw Error('Invalid public response');
  for(const k of ['reportCount','matchingReportCount','provisionalReportCount','rankingEligibleReportCount']) if(!Number.isInteger(body[k]) || body[k]<0 || body[k]>1024) throw Error('Invalid count');
  if(body.rankingEligibleReportCount !== 0 || body.provisionalReportCount !== body.matchingReportCount || body.matchingReportCount>body.reportCount || !Array.isArray(body.rows) || body.rows.length>100 || body.rows.length>body.matchingReportCount || !Array.isArray(body.bucketDefinitions) || !body.missingDataFlags || typeof body.missingDataFlags !== 'object') throw Error('Invalid public page');
  if(!(Number.isSafeInteger(body.revision) && body.revision>=0) && !(typeof body.revision==='string' && /^[0-9a-f]{64}$/.test(body.revision))) throw Error('Invalid revision');
  if(body.nextCursor !== null) publicQuery({cursor:body.nextCursor});
  // The staged receiver emits only provisional custom results. Never promote them to a ranking.
  for(const row of body.rows) if(!row || row.evidenceClass !== 'community-client-reported' || row.validationState !== 'syntax-checked-client-report' || row.deviceCompatibilityVerified !== false || row.rankingEligible !== false || row.scanoutFpsMeasured !== false || row.comparability?.exactBucketEligible !== false) throw Error('Invalid evidence class');
  return {...body, bucketDefinitions: body.bucketDefinitions.map(b => ({key:b.key,workload:b.workload,platform:b.platform,profileId:b.profileId,exactBucketEligible:false})),
    rows:body.rows.map(r => ({resultId:r.resultId,dateUtc:r.dateUtc,bucket:r.bucket,evidenceClass:r.evidenceClass,
      validationState:r.validationState,deviceCompatibilityVerified:false,rankingEligible:false,
      sampleCount:r.sampleCount,frameMedianMs:r.frameMedianMs,frameP95Ms:r.frameP95Ms,gpuMedianMs:r.gpuMedianMs,
      cpuTimingScope:r.cpuTimingScope,gpuTimingScope:r.gpuTimingScope,scanoutFpsMeasured:false})),
    missingDataFlags:Object.fromEntries(['courseRevision','profileRevision','outputPolicy','packageArtifactHash','osMajor','rawDriverVersion','measuredThermal','scanoutFps','submittedDimensions','gpuTiming'].map(k=>[k,body.missingDataFlags[k] === true]))};
}
// No default endpoint or fetch: a caller must explicitly inject the reviewed transport.
export async function loadPublicPage(query, transport) {
  if(typeof transport !== 'function') return {state:'unavailable'};
  const encoded=publicQuery(query);
  const response=await transport(encoded);
  if(response.status===202) return {state:'pending'};
  if(response.status===400) return {state:'restart-required'};
  if(!response.ok) return {state:'error'};
  const text=await response.text();
  if(new TextEncoder().encode(text).length>256*1024) throw Error('Response too large');
  const page=readPublicPage(JSON.parse(text));
  return {state:page.rows.length ? 'ready':'empty',page};
}
