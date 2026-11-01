import {loadPublicPage} from './horde-public-api.js';
export function mountPublicResults(root, transport) {
 if(!root) return;
 const form=root.querySelector('[data-public-filters]'), status=root.querySelector('[data-public-status]'), results=root.querySelector('[data-public-results]'), next=root.querySelector('[data-public-next]');
 let generation=0,cursor=null;
 const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 async function load(paging=false) {
  const token=++generation,query=Object.fromEntries([...new FormData(form)].filter(([,v])=>v!==''));query.limit=25;if(paging&&cursor)query.cursor=cursor;
  status.textContent='Loading public reports…';next.hidden=true;results.replaceChildren();
  try {const response=await loadPublicPage(query,transport);if(token!==generation)return;
   const messages={unavailable:'Public results service is not connected yet. No reports are requested.',pending:'Results are pending. Pending submissions are not public rows.',error:'Results could not be loaded. Try applying the filters again.', 'restart-required':'The result list changed or the cursor expired. Apply filters to restart.',empty:'No published reports match these filters.'};
   if(response.state!=='ready'){status.textContent=messages[response.state];return;}
   const p=response.page;status.textContent=`${p.matchingReportCount} matching reports; ${p.provisionalReportCount} provisional; ${p.rankingEligibleReportCount} ranking eligible. Sorting is browsing, not a ranking.`;
   for(const r of p.rows){const section=el('section','');section.className='benchmark-group';section.append(el('h2',`${r.model} · ${r.platform}`),el('p',`Build ${r.build}; GPU ${r.gpu}; profile ${r.profile}; backend ${r.backend}. Provisional, unverified and custom/unranked.`),el('p',`Internal ${r.internal}; output ${r.output}; water ${r.water}; dielectric ${r.dielectric}; fire ${r.fire}.`),el('p',`Shader pair: ${r.shaderPair}`),el('p',`Bucket: ${r.bucket}. Course/profile revisions and output policy unavailable; shown separately.`));
    const values=[['Measured samples',r.sampleCount],['Frame median',r.frameMedianMs===null?'Unavailable':`${r.frameMedianMs} ms (${r.cpuTimingScope})`],['Frame p95',r.frameP95Ms===null?'Unavailable':`${r.frameP95Ms} ms`],['GPU median',r.gpuMedianMs===null?'Unavailable':`${r.gpuMedianMs} ms (${r.gpuTimingScope})`]];
    const wrap=el('div','');wrap.className='benchmark-table-wrap';const table=el('table','');table.append(el('caption','One provisional public report'));const body=el('tbody','');for(const [k,v]of values){const tr=el('tr',''),th=el('th',k);th.scope='row';tr.append(th,el('td',String(v)));body.append(tr);}table.append(body);wrap.append(table);
    const card=el('dl','');card.className='benchmark-cards';for(const[k,v]of values)card.append(el('dt',k),el('dd',String(v)));section.append(wrap,card);results.append(section);
   }cursor=p.nextCursor;next.hidden=!cursor;
  }catch{if(token===generation)status.textContent='The results response could not be verified. Try again later.';}
 }
 form.addEventListener('submit',e=>{e.preventDefault();cursor=null;load();});form.addEventListener('reset',()=>{cursor=null;setTimeout(()=>load(),0);});next.addEventListener('click',()=>load(true));load();
}
// Live transport is deliberately absent until the reviewed deployment is approved.
mountPublicResults(document.querySelector('.benchmark'));
