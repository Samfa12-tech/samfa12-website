"""Local review fixtures: revision-three landforms, route swimming and boat motion.
Controlled debug placements/steering, not a human playthrough or phone proof.
"""
import os,json,math
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'qa-output'/'expedition'/'review';OUT.mkdir(parents=True,exist_ok=True)
URL='http://127.0.0.1:4173/'
data={'scope':'Local Chromium; debug route start placement and simulation steering; touch emulation, not physical device','checks':[],'errors':[],'routes':{}}
def check(name,value,detail=None):
 data['checks'].append({'name':name,'pass':bool(value),'detail':detail});(OUT/'review-browser.json').write_text(json.dumps(data,indent=2));assert value,(name,detail)
# The route data is exactly the authoring fixture compiled by TypeScript.
import subprocess
reuse=bool(os.environ.get('REEF_QA_REUSE_ROUTES'));previous=json.loads((OUT/'review-browser.json').read_text()) if reuse else None
if previous:data['routes']=previous['routes'];data['checks']=[c for c in previous['checks'] if any(c['name'].startswith(s) for s in ['gardens','passage','mangrove','cenote','harbour'])]
routes=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {EXPLORATION_ROUTES} from './build/game/site-authorship.js';console.log(JSON.stringify(EXPLORATION_ROUTES))"],cwd=ROOT,text=True))
views={
 'gardens':[[[3,4,-24],[-23,2,-12]],[[16,3.4,-6],[16,3.4,8]],[[0,7,25],[-22,5,28]]],
 'passage':[[[-28,11,-2],[-2,0,9]],[[0,6,17],[0,7,29]],[[7,7,38],[-4,2,45]]],
 'mangrove':[[[-9,3,-15],[-5,3,15]],[[-7,4,26],[-4,3,35]],[[15,8,45],[0,0,15]]],
 'cenote':[[[-2,-4,-27],[-10,-24,-2]],[[-5,-13,7],[-5,-12,21]],[[12,-9,26],[12,-28,39]]],
 'harbour':[[[7,-5,-24],[7,-13,-5]],[[-5,-5,17],[-5,-6,29]],[[-19,-12,30],[-31,-24,40]]]
}
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True,args=['--no-first-run','--disable-extensions','--disable-background-networking'])
 ctx=browser.new_context(viewport={'width':1280,'height':800});p=ctx.new_page();p.on('pageerror',lambda e:data['errors'].append(str(e)))
 p.goto(URL+'?debug=1');p.wait_for_function('window.__REEF__');p.add_style_tag(content='#debug-stats{display:none!important}')
 p.evaluate('__REEF__.profile.tutorial=1;__REEF__.profile.reputation=100;__REEF__.profile.totalRemoved=100')
 for site,route in ([] if reuse else routes.items()):
  p.evaluate("id=>{let q=__REEF__;q.profile.active=null;q.profile.pending=null;q.dispatch('site',id);q.dispatch('dive');}",site);p.wait_for_timeout(250)
  if p.evaluate("__REEF__.paused && __REEF__.ui.screen==='moment'"):p.evaluate("__REEF__.dispatch('close')")
  check(site+' revision-three scene',p.evaluate('__REEF__.sim.run.siteRevision')==3)
  result=p.evaluate("""points=>{const q=__REEF__,s=q.sim,r=s.run; q.teleport(...points[0]);let reached=[],failed=null;
   for(let i=1;i<points.length;i++){const [x,y,z]=points[i];let frames=0;
    for(;frames<4000;frames++){const d=Math.hypot(x-r.p.x,y-r.p.y,z-r.p.z);if(d<1.25)break;
     q.aimAt({x,y,z});s.update(1/60,{moveX:0,moveZ:Math.min(1,d/2),vertical:0,lookX:0,lookY:0,boost:false,steady:false,draw:false,release:false,cancelDraw:false,interact:false});r.air=200;r.health=100;
    }reached.push({waypoint:i,frames,position:{...r.p}});if(frames===4000){failed=i;break;}
   }return {name:points.length,reached,failed};}""",route[0]['points'])
  data['routes'][site]=result;check(site+' actual simulation swims authored route',result['failed'] is None,result)
  for i,(position,target) in enumerate(views[site]):
   p.evaluate("v=>{__REEF__.teleport(...v[0]);__REEF__.aimAt({x:v[1][0],y:v[1][1],z:v[1][2]});}",[position,target]);p.wait_for_timeout(170)
   p.screenshot(path=str(OUT/(site+'-route-'+str(i+1)+'.png')))
  p.evaluate("__REEF__.dispatch('screen','journal')");p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(150);p.screenshot(path=str(OUT/(site+'-chart-portrait.png')))
  check(site+' five-POI chart fits portrait',p.locator('#chart').evaluate('e=>e.getBoundingClientRect().right<=innerWidth'))
  p.set_viewport_size({'width':1280,'height':800});p.evaluate("__REEF__.dispatch('close')")
 check('no terrain page errors',not data['errors'],data['errors']);ctx.close()
 # Record actual driving with real keyboard steering, retaining visible swell motion.
 ctx=browser.new_context(viewport={'width':1280,'height':800},record_video_dir=str(OUT/'video'),record_video_size={'width':1280,'height':800});p=ctx.new_page();p.on('pageerror',lambda e:data['errors'].append(str(e)))
 p.goto(URL+'?debug=1');p.wait_for_function('window.__REEF__');p.add_style_tag(content='#debug-stats{display:none!important}');p.evaluate("__REEF__.dispatch('boat-launch')");p.wait_for_timeout(300)
 p.keyboard.down('w');p.wait_for_function('__REEF__.boat.speed>7',timeout=15000)
 for i in range(3):
  if i==1:p.keyboard.down('d')
  if i==2:p.keyboard.up('d')
  p.wait_for_timeout(1500);p.screenshot(path=str(OUT/('boat-driving-'+str(i+1)+'.png')))
 p.keyboard.up('w');check('boat driving moved and steered',p.evaluate('__REEF__.boat.distance>25&&__REEF__.boat.yaw>.8'),p.evaluate('({...__REEF__.boat})'))
 video=p.video.path();ctx.close();Path(video).replace(OUT/'boat-driving.webm')
 # Touch accessibility: unaffordable clearing is disabled, generic Interact boards.
 ctx=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True);p=ctx.new_page();p.on('pageerror',lambda e:data['errors'].append(str(e)))
 p.goto(URL+'?debug=1');p.wait_for_function('window.__REEF__');p.add_style_tag(content='#debug-stats{display:none!important}');p.evaluate("__REEF__.profile.tutorial=1;__REEF__.dispatch('dive')");p.wait_for_timeout(300)
 p.evaluate("let q=__REEF__,s=q.sim;s.run.maskFlood=.24;s.run.air=.7;s.run.p={...s.site.landmarks[0].p,y:s.site.surface+.2};s.run.velocity={x:0,y:0,z:0};s.updateAim();")
 p.wait_for_timeout(100);check('unaffordable touch mask clear disabled',p.locator('#clear-mask').is_disabled());check('touch Interact still offers boarding',p.evaluate("__REEF__.sim.aim.kind==='boat'&&__REEF__.sim.aim.valid"))
 button=p.locator('[data-touch="interact"]');box=button.bounding_box();client=ctx.new_cdp_session(p);point={'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'id':1}
 client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]});p.wait_for_function('__REEF__.profile.pending?.finished',timeout=10000);client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 check('flooded low-air touch boarding returns safely',p.evaluate('!__REEF__.profile.pending.rescued'));p.screenshot(path=str(OUT/'low-air-touch-safe-return.png'))
 check('no page errors',not data['errors'],data['errors']);ctx.close();browser.close()
print(json.dumps({'checks':len(data['checks']),'errors':data['errors']}))

