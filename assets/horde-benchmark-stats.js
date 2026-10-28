import { FILTER_FIELDS as fields, SORT_FIELDS as sorts, checkedQuery, loadExamples, selectExamples } from "./horde-benchmark-core.js";
(() => {
  "use strict";
  const root = document.querySelector(".benchmark");
  if (!root) return;
  const status = root.querySelector("[data-status]"), demo = root.querySelector("[data-demo]"), form = root.querySelector("[data-filters]"), results = root.querySelector("[data-results]"), count = root.querySelector("[data-count]"), open = root.querySelector("[data-example]"), close = root.querySelector("[data-reset]");
  let rows = [], generation = 0;
  const el = (tag, value, className) => { const n = document.createElement(tag); if (value !== undefined) n.textContent = value; if (className) n.className = className; return n; };
  // The proposed public API is not connected; only explicit local examples are available.
  function options(items) {
    for (const field of fields) {
      const select = form.elements[field];
      while (select.options.length > 1) select.remove(1);
      const values = [...new Set(items.map(row => row[field]).filter(value => typeof value === "string" && value.length <= 160))].sort();
      for (const value of values) select.add(new Option(value, value));
    }
  }
  function render() {
    const q = Object.fromEntries(fields.map(field => [field, form.elements[field].value]));
    const sort = form.elements.sort.value;
    checkedQuery({...q, sort, order:"asc", limit:100, cursor:null});
    if (!sorts.includes(sort) || fields.some(field => q[field] && ![...form.elements[field].options].some(option => option.value === q[field]))) { status.textContent = "Choose one of the available filters."; return; }
    const {selected, groups} = selectExamples(rows, {...q, sort, order:"asc", limit:100, cursor:null});
    results.replaceChildren(); count.textContent = `${selected.length} synthetic example row${selected.length === 1 ? "" : "s"} shown · ${selected.reduce((sum,row)=>sum+row.reports,0)} provisional reports · 0 eligible reports.`;
    if (!selected.length) { results.append(el("p", "No examples match these filters. Clear a filter to see more.")); return; }
    for (const group of groups) {
      const first=group[0], section=el("section",undefined,"benchmark-group"); section.append(el("h3", first.bucket),el("p", first.configuration),el("p", first.revision ? `Revision: ${first.revision} · provisional, custom and unranked; shown separately` : "Revision unknown · provisional example displayed separately"));
      const wrap=el("div",undefined,"benchmark-table-wrap"), table=el("table"), cap=el("caption","Synthetic example reports within this configuration"), head=el("thead"), tr=el("tr");
      for(const title of ["Device / platform", "Build", "Reports", "Frame duration", "GPU duration", "Evidence"]) {const th=el("th",title);th.scope="col";tr.append(th);} head.append(tr);const body=el("tbody"),cards=el("div",undefined,"benchmark-cards");
      for(const row of group){const values=[`${row.model} · ${row.platform}`,row.build,String(row.reports),row.frameMs === null ? "Unavailable" : `${row.frameMs} ms · ${row.frameScope}`,row.gpuMs === null ? "Unavailable" : `${row.gpuMs} ms · ${row.gpuScope}`,`${row.evidence} · unverified · provisional`]; const line=el("tr");for(const value of values)line.append(el("td",value));body.append(line);const card=el("article",undefined,"benchmark-card");card.append(el("h4",values[0]));const dl=el("dl");["Build","Reports","Frame duration","GPU duration","Evidence"].forEach((label,i)=>{dl.append(el("dt",label),el("dd",values[i+1]));});card.append(dl);cards.append(card);}
      table.append(cap,head,body);wrap.append(table);section.append(wrap,cards);results.append(section);
    }
  }
  open.addEventListener("click", async () => { const request = ++generation; status.textContent = "Loading synthetic examples…"; open.disabled=true; try { const data=await loadExamples({...Object.fromEntries(fields.map(field => [field, ""])),limit:100,sort:"model",order:"asc",cursor:null}); if(request!==generation)return; rows=data;options(rows);demo.hidden=false;close.hidden=false;status.textContent="Synthetic examples loaded. No public reports are shown.";render(); } catch { if(request===generation)status.textContent="The local examples could not be loaded. No public results are available."; } finally {if(request===generation)open.disabled=false;} });
  close.addEventListener("click",()=>{generation++;rows=[];demo.hidden=true;close.hidden=true;open.disabled=false;form.reset();results.replaceChildren();count.textContent="";status.textContent="Public results are not available yet. No results are being requested.";open.focus();});
  form.addEventListener("change",render);form.addEventListener("submit",e=>e.preventDefault());form.addEventListener("reset",()=>setTimeout(render,0));
})();
