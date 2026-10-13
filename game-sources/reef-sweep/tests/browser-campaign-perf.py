# Controlled browser QA fixtures; never a natural or physical-device playtest claim.
from pathlib import Path
import os,json,statistics
from playwright.sync_api import sync_playwright
from urllib.parse import urlparse
candidate=os.environ.get('REEF_SWEEP_QA_URL','http://127.0.0.1:4173/').rstrip('/')+'/'
assert urlparse(candidate).hostname in ['localhost','127.0.0.1','::1'],'QA fixtures are restricted to loopback'
out=Path(os.environ.get('REEF_SWEEP_QA_OUT',str(Path(__file__).resolve().parent.parent/'qa-output')));report={}
out.mkdir(exist_ok=True,parents=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['CHROMIUM_BIN'],headless=True)
 for site in ['gardens','passage']:
  report[site]={}
  for name,port in [('baseline',os.environ['REEF_SWEEP_BASELINE_URL']),('candidate',candidate)]:
   c=b.new_context(viewport={'width':1280,'height':800});p=c.new_page();assert urlparse(port).hostname in ['localhost','127.0.0.1','::1'];p.goto(port.rstrip('/')+'/?debug=1');p.wait_for_function('window.__REEF__')
   p.evaluate("__REEF__.profile.totalRemoved=6;__REEF__.profile.tutorial=1;if(__REEF__.profile.campaign)__REEF__.profile.campaign.characterFlags.push('passage-arrival');__REEF__.dispatch('setting',{name:'quality',value:'high'});__REEF__.dispatch('site',"+json.dumps(site)+");__REEF__.dispatch('dive')")
   if p.evaluate('__REEF__.paused'):p.locator('[data-close]').last.click()
   p.evaluate('__REEF__.teleport(0,12,-44);__REEF__.sim.run.yaw=0;__REEF__.sim.run.pitch=0');p.wait_for_timeout(1800);samples=[]
   for i in range(3):
    values=p.evaluate('''()=>new Promise(resolve=>{const times=[];let last=0;function frame(t){if(last)times.push(t-last);last=t;if(times.length<180)requestAnimationFrame(frame);else resolve(times)}requestAnimationFrame(frame)})''')
    samples.append({'medianMs':statistics.median(values),'p95Ms':sorted(values)[int(len(values)*.95)],'frames':len(values)})
   details=p.evaluate('JSON.parse(render_game_to_text()).renderer');report[site][name]={'samples':samples,'renderer':details,'gpu':p.evaluate("(()=>{const g=document.querySelector('canvas').getContext('webgl2');const e=g?.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'unavailable'})()")}
   p.screenshot(path=str(out/(name+'-'+site+'-high.png')));c.close()
 b.close()
(out/'paired-performance.json').write_text(json.dumps({'viewport':[1280,800],'quality':'high','camera':[0,12,-44],'sites':report,'physicalPhone':False,'sustained':False},indent=2)+'\n');print('Completed paired High GPU samples:',json.dumps({s:{n:[x['medianMs'] for x in v['samples']] for n,v in vs.items()} for s,vs in report.items()}))
