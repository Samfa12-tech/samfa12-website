"""Muted Chrome integration; controlled fish placements and short paired GPU observations.
Portrait touch emulation uses the same desktop GPU and is not a physical-phone benchmark.
"""
import os,json,argparse,functools,http.server,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--dist',type=Path,default=ROOT/'dist');parser.add_argument('--baseline',action='store_true');args=parser.parse_args()
OUT=Path(os.environ.get('REEF_SWEEP_QA_OUT',ROOT/'qa-output'/'lionfish'));OUT.mkdir(parents=True,exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(args.dist)))
threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/?debug=1'
report={'scope':__doc__,'baseline':args.baseline,'checks':[],'performance':[],'errors':[],'consoleErrors':[]}
def save():(OUT/('baseline.json' if args.baseline else 'browser.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
def check(name,value,detail=None):
 report['checks'].append({'name':name,'pass':bool(value),'detail':detail});save();assert value,(name,detail)
def states(p):return p.evaluate('Object.fromEntries(__REEF__.renderer.lionfishDefense)')
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_BIN',r'C:\Program Files\Google\Chrome\Application\chrome.exe'),headless=True,args=['--mute-audio','--autoplay-policy=user-gesture-required','--disable-background-networking'])
 try:
  for touch in [False,True]:
   label='portrait' if touch else 'desktop';ctx=browser.new_context(viewport={'width':390 if touch else 1280,'height':844 if touch else 800},has_touch=touch,is_mobile=touch)
   p=ctx.new_page();p.on('pageerror',lambda e:report['errors'].append(str(e)));p.on('console',lambda m:report['consoleErrors'].append(m.text) if m.type=='error' else None)
   p.goto(url);p.wait_for_function('window.__REEF__');p.add_style_tag(content='#debug-stats{display:none!important}');p.evaluate('__REEF__.profile.tutorial=1')
   p.locator('[data-action="boat-launch"]').click();p.wait_for_function('__REEF__.boat && !__REEF__.paused');p.evaluate('Object.assign(__REEF__.boat,{x:38,z:55,speed:0})');p.wait_for_function('!document.getElementById("boat-enter").disabled');p.locator('#boat-contract').select_option('none');p.locator('#boat-enter').click();p.locator('#boat-entry-status button').click();p.wait_for_function('__REEF__.sim && !__REEF__.paused');p.wait_for_timeout(1400)
   samples=[]
   for _ in range(2):
    samples.append(p.evaluate('''()=>new Promise(resolve=>{let last=performance.now(),gaps=[];function sample(t){gaps.push(t-last);last=t;if(gaps.length<90)requestAnimationFrame(sample);else {gaps.shift();gaps.sort((a,b)=>a-b);resolve({median:gaps[Math.floor(gaps.length*.5)],p95:gaps[Math.floor(gaps.length*.95)],max:gaps.at(-1),renderer:__REEF__.renderer.stats(),fish:__REEF__.sim.run.fish.length,sharedGeometries:new Set([...__REEF__.renderer.fishMeshes.values()].map(m=>m.geometry.uniqueId)).size});}}requestAnimationFrame(sample);})'''))
   report['performance'].append({'viewport':label,'quality':'high','samples':samples});save()
   if args.baseline:ctx.close();continue
   p.evaluate('''()=>{let q=__REEF__,r=q.sim.run;r.p={x:0,y:8,z:-41};r.velocity={x:0,y:0,z:0};r.yaw=0;r.pitch=0;r.fish.forEach((f,i)=>f.alive=i<2);const a=r.fish[0],b=r.fish[1];a.size=.92;b.size=1.22;a.home={x:-.5,y:8,z:-38.4};b.home={x:1.3,y:8,z:-33};a.p={...a.home};b.p={...b.home};window.nearId=a.id;window.farId=b.id;window.originalFish=q.renderer.fishMeshes.get(a.id);window.originalGeometry=originalFish.geometry;window.originalVertices=originalFish.getVertexBuffer('position').getData();window.startHealth=r.health;
     window.gpuBindings={};window.recordGpu=true;for(const id of [a.id,b.id]){let m=q.renderer.fishMeshes.get(id);gpuBindings[id]={};m.onBeforeDrawObservable.add(()=>{if(!recordGpu)return;let gl=q.renderer.engine._gl,program=gl.getParameter(gl.CURRENT_PROGRAM),location=gl.getUniformLocation(program,'uLionfishDefense');gpuBindings[id][q.renderer.engine.currentRenderPassId]=location===null?null:gl.getUniform(program,location);});}}''')
   p.wait_for_function('__REEF__.renderer.lionfishDefense.get(nearId).value>.96');p.wait_for_timeout(120)
   values=states(p);check(label+' independent near flare and distant calm',values[p.evaluate('nearId')]['value']>.96 and values[p.evaluate('farId')]['value']==0,values)
   binding=p.evaluate('gpuBindings');sun=p.evaluate('__REEF__.renderer.shadows.sunPass');near= binding[p.evaluate('nearId')];far=binding[p.evaluate('farId')]
   check(label+' actual GPU colour and sun-depth bindings are per fish',len(near)>=2 and len(far)>=2 and all(v is not None and v>.94 for v in near.values()) and all(v==0 for v in far.values()) and str(sun) in near,{'near':near,'far':far,'sunPass':sun})
   p.evaluate('recordGpu=false');check(label+' geometry is shared and never rebuilt',p.evaluate('originalFish.geometry===originalGeometry && originalFish.getVertexBuffer("position").getData()===originalVertices && new Set([...__REEF__.renderer.fishMeshes.values()].map(m=>m.geometry.uniqueId)).size===1'))
   check(label+' authoring scale applied exactly once',p.evaluate('[...__REEF__.renderer.fishMeshes].every(([id,m])=>Math.abs(m.scaling.x-__REEF__.sim.run.fish.find(f=>f.id===id).size*.65)<1e-6)'))
   p.screenshot(path=str(OUT/(label+'-near-flare-far-calm.png')))
   (p.locator('#pause-button').click() if touch else p.keyboard.press('Escape'));p.wait_for_function('__REEF__.paused');before=states(p);p.wait_for_timeout(250);check(label+' pause freezes defense states',states(p)==before);p.locator('[data-action="resume"]').click();p.wait_for_function('!__REEF__.paused')
   p.evaluate('__REEF__.sim.run.fish[0].home={x:-.5,y:8,z:-37.2}');p.wait_for_timeout(350);check(label+' dead band holds defense latch',p.evaluate('__REEF__.renderer.lionfishDefense.get(nearId).active'))
   p.evaluate('__REEF__.sim.run.fish[0].home={x:-.5,y:8,z:-35.7}');p.wait_for_function('__REEF__.renderer.lionfishDefense.get(nearId).value<.04',timeout=9000);check(label+' retreat relaxes without new damage',p.evaluate('!__REEF__.renderer.lionfishDefense.get(nearId).active && __REEF__.sim.run.health===startHealth'))
   p.screenshot(path=str(OUT/(label+'-relaxed.png')))
   time1=p.evaluate('__REEF__.sim.run.time');p.wait_for_timeout(180);check(label+' tail clock advances with fixed geometry',p.evaluate('__REEF__.sim.run.time')>time1 and p.evaluate('originalFish.getVertexBuffer("position").getData()===originalVertices'))
   p.evaluate('''()=>{let q=__REEF__,r=q.sim.run,f=r.fish[0];f.home={x:0,y:8,z:-38.6};f.p={...f.home};q.aimAt(f.p);q.sim.strike(1);q.tick(.02);}''');p.wait_for_function('__REEF__.sim.run.exposed?.id===nearId')
   check(label+' capture keeps actual mesh and clears defense',p.evaluate('__REEF__.renderer.fishMeshes.get(nearId)===originalFish && !__REEF__.renderer.lionfishDefense.get(nearId).active'))
   p.keyboard.down('e');p.wait_for_function('__REEF__.sim.run.cargo.length===1',timeout=12000);p.keyboard.up('e');p.wait_for_function('!__REEF__.sim.run.transfer');check(label+' remodeled catch enters existing tube once',p.evaluate('__REEF__.sim.run.cargo.length===1 && !__REEF__.sim.run.exposed && __REEF__.renderer.fishMeshes.get(nearId)===originalFish'))
   ctx.close()
  check('no page errors',not report['errors'],report['errors']);check('no shader/console errors',not report['consoleErrors'],report['consoleErrors'])
 finally:save();browser.close();server.shutdown()
print(json.dumps({'baseline':args.baseline,'checks':len(report['checks']),'pass':all(c['pass'] for c in report['checks']),'output':str(OUT)}))
