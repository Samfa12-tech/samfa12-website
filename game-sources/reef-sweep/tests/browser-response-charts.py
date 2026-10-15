"""All five active response charts; local late-career debug fixture."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parents[1]/'qa-output'/'expedition'/'review';checks=[];errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
 c=b.new_context(viewport={'width':1280,'height':800});p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto('http://127.0.0.1:4173/?debug=1');p.wait_for_function('window.__REEF__');p.add_style_tag(content='#debug-stats{display:none!important}')
 p.evaluate("__REEF__.profile.tutorial=1;__REEF__.profile.reputation=100;__REEF__.profile.totalRemoved=100;__REEF__.profile.campaign={researchInvitationSeen:false,researchAccepted:false,researchCompleted:false,characterFlags:['passage-arrival','outbreak-field-guide'],milestoneFlags:[]}")
 for i,site in enumerate(['gardens','passage','mangrove','cenote','harbour']):
  p.evaluate("v=>{let q=__REEF__;q.profile.active=null;q.profile.pending=null;q.profile.day=v[1];q.dispatch('site',v[0]);q.dispatch('dive');q.dispatch('screen','journal')}",[site,8+i*4]);p.wait_for_timeout(150)
  assert p.evaluate("__REEF__.sim.run.jobs.filter(j=>j.kind==='outbreak').length") == 3
  p.screenshot(path=str(OUT/(site+'-response-chart-wide.png')))
  p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(120);p.screenshot(path=str(OUT/(site+'-response-chart-portrait.png')))
  checks.append({'name':site+' active response chart fits portrait','pass':p.locator('#chart').evaluate('e=>e.getBoundingClientRect().left>=0&&e.getBoundingClientRect().right<=innerWidth')});p.set_viewport_size({'width':1280,'height':800});p.evaluate("__REEF__.dispatch('close')")
 c.close();b.close()
(OUT/'response-charts.json').write_text(json.dumps({'checks':checks,'errors':errors},indent=2));assert all(c['pass'] for c in checks) and not errors
print(json.dumps({'checks':len(checks),'errors':errors}))
