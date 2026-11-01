import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const code = readFileSync(new URL("../assets/no-wall-trailer.js", import.meta.url), "utf8");
function setup(portrait) {
  const nodes = Object.fromEntries(["play", "video", "poster", "status", "fallback"].map(key => [key, {hidden:true, dataset:{}, handlers:{}, addEventListener(type, fn){ this.handlers[type]=fn; }, focus(){ this.focused=true; }}]));
  let plays=0; nodes.video.play=()=>{ plays++; return Promise.resolve(); };
  const root={querySelector(selector){return nodes[selector.match(/data-trailer-(\w+)/)[1]];}};
  const media={matches:portrait};
  vm.runInNewContext(code, {document:{querySelector:()=>root},window:{matchMedia:()=>media}});
  return {nodes,media,get plays(){return plays;}};
}
for (const portrait of [false,true]) test(`selects only the ${portrait ? "portrait" : "landscape"} video after a click and keeps it on rotation`, async () => {
  const t=setup(portrait); assert.equal(t.nodes.video.src,undefined); assert.equal(t.nodes.play.hidden,false);
  t.nodes.play.handlers.click(); const expected=`/assets/videos/no-wall-to-hold-${portrait ? "portrait" : "landscape"}.mp4`;
  assert.equal(t.nodes.video.src,expected); assert.equal(t.plays,1); assert.equal(t.nodes.video.hidden,false); assert.equal(t.nodes.video.focused,true);
  t.media.matches=!portrait; assert.equal(t.nodes.video.src,expected); assert.equal(t.plays,1);
  t.nodes.video.handlers.error(); assert.equal(t.nodes.fallback.hidden,false);
});
