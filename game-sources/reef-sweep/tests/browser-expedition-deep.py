"""Controlled fixtures for all sites, carried-mesh continuity, input and boat QA.
Run after build, using the same dependencies/browser as browser-expedition.py.
"""
import os,json,time,statistics,math
from pathlib import Path
from playwright.sync_api import sync_playwright
URL=os.environ.get('REEF_SWEEP_QA_URL','http://127.0.0.1:4173/')
assert URL.startswith(('http://127.0.0.1:','http://localhost:'))
OUT=Path(__file__).resolve().parent.parent/'qa-output'/'expedition';OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];timings={}
def check(name,value,detail=None):
 checks.append({'name':name,'pass':bool(value),'detail':detail})
 (OUT/'deep-browser.json').write_text(json.dumps({'checks':checks,'errors':errors,'timings':timings,'fixture':'Controlled local debug placements; Chromium touch emulation; not physical Android/iPhone'},indent=2))
 assert value,(name,detail)
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True,args=['--no-first-run','--disable-extensions','--disable-background-networking'])
 ctx=browser.new_context(viewport={'width':1280,'height':800});p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(URL+'?debug=1');p.wait_for_function('window.__REEF__');p.add_style_tag(content='#debug-stats{display:none!important}');p.evaluate("document.getElementById('debug-stats').style.display='none';__REEF__.profile.tutorial=1;__REEF__.profile.reputation=100;__REEF__.profile.totalRemoved=100")
 for site in ['gardens','passage','mangrove','cenote','harbour']:
  p.evaluate("""id=>{let q=__REEF__;q.profile.active=null;q.profile.pending=null;q.dispatch('site',id);q.dispatch('dive');}""",site);p.wait_for_timeout(700)
  check(site+' actual scene',p.evaluate('JSON.parse(render_game_to_text()).site')==site)
  p.screenshot(path=str(OUT/(site+'-gameplay.png')))
  p.evaluate("__REEF__.dispatch('screen','journal')");p.screenshot(path=str(OUT/(site+'-chart-wide.png')))
  p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(200);p.screenshot(path=str(OUT/(site+'-chart-portrait.png')))
  check(site+' chart fits portrait',p.locator('#chart').evaluate('e=>e.getBoundingClientRect().right<=innerWidth && e.getBoundingClientRect().left>=0'))
  p.set_viewport_size({'width':1280,'height':800});p.evaluate("__REEF__.dispatch('close')")
 # Real struck mesh retained through a two-fish capture and insertion into tube.
 p.evaluate("""()=>{let q=__REEF__;q.profile.active=null;q.profile.pending=null;q.dispatch('site','gardens');q.dispatch('dive');let r=q.sim.run;r.fish.forEach(f=>f.alive=false);let a=r.fish[0],b=r.fish[1];a.alive=true;b.alive=true;r.p={x:0,y:8,z:-41};r.velocity={x:0,y:0,z:0};r.yaw=0;r.pitch=0;a.p=a.home={x:0,y:8,z:-39};b.p=b.home={x:3,y:8,z:-39};window.firstMesh=q.renderer.fishMeshes.get(a.id);q.sim.strike(1);}""")
 p.wait_for_timeout(600);check('first caught model is original world mesh',p.evaluate("__REEF__.renderer.fishMeshes.get(__REEF__.sim.run.exposed.id)===firstMesh && firstMesh.parent===__REEF__.renderer.camera"));p.screenshot(path=str(OUT/'catch-one.png'))
 p.evaluate("""()=>{let q=__REEF__,r=q.sim.run,b=r.fish[1];r.strikeCooldown=0;b.p=b.home={x:r.p.x,y:r.p.y,z:r.p.z+2};r.yaw=0;r.pitch=0;q.sim.strike(1);}""")
 p.wait_for_timeout(500);check('second fish produces Shishkabob photo',p.evaluate("__REEF__.sim.run.skewered.length===1 && __REEF__.sim.run.clips.some(c=>c.kind==='shishkabob'&&!!c.image)"));p.screenshot(path=str(OUT/'catch-shishkabob.png'))
 p.keyboard.down('e');p.wait_for_timeout(700);p.screenshot(path=str(OUT/'catch-insertion.png'))
 p.wait_for_timeout(950);p.keyboard.up('e');check('both fish secured exactly once',p.evaluate("__REEF__.sim.run.cargo.length===2&&!__REEF__.sim.run.exposed"));p.screenshot(path=str(OUT/'catch-tube-entry.png'))
 p.wait_for_timeout(1500);check('old fish geometry hidden after tube transfer',p.evaluate('!firstMesh.isEnabled()'))
 # Surface droplets and partial-flood clear action, with clear central aiming view.
 p.evaluate("""()=>{let q=__REEF__,r=q.sim.run;r.p.y=q.sim.site.surface-.01;r.velocity.y=1;q.tick(.05,{vertical:1});}""");p.wait_for_timeout(100);check('breach droplets appear',p.evaluate('(__REEF__.sim.run.droplets??0)>.5'));p.screenshot(path=str(OUT/'surface-droplets.png'))
 p.evaluate("__REEF__.sim.run.maskFlood=.24");p.wait_for_timeout(120);air=p.evaluate('__REEF__.sim.run.air');p.locator('#clear-mask').click();check('mask clear consumes small bounded air',p.evaluate('__REEF__.sim.run.maskFlood===0') and air-p.evaluate('__REEF__.sim.run.air')<2.2)
 # Meaningful late-game treatment model, with finite fixture target.
 p.evaluate("""()=>{let q=__REEF__;q.profile.active=null;q.profile.pending=null;q.profile.day=8;q.dispatch('site','gardens');q.dispatch('dive');let s=q.sim,j=s.run.jobs.find(j=>j.kind==='outbreak');q.teleport(j.p.x,j.p.y+.5,j.p.z-1.8);q.aimAt(j.p);q.tick(.5,{interact:true,steady:true});}""");p.wait_for_timeout(100);p.screenshot(path=str(OUT/'outbreak-injector.png'))
 # Boat actual steering integration, model/water frames and medium/low views.
 p.evaluate("__REEF__.profile.active=null;__REEF__.profile.pending=null;__REEF__.dispatch('boat-launch')");p.keyboard.down('w');p.wait_for_timeout(2500);p.keyboard.up('w');
 b=p.evaluate('({...__REEF__.boat})');check('boat travelled under keyboard input',b['distance']>5,b)
 p.keyboard.down('d');p.keyboard.down('w');p.wait_for_timeout(1000);p.keyboard.up('d');p.keyboard.up('w');check('boat steering changes heading',abs(p.evaluate('__REEF__.boat.yaw')-b['yaw'])>.2)
 for preset in ['high','balanced','low']:
  p.evaluate("q=>__REEF__.dispatch('setting',{name:'quality',value:q})",preset);p.evaluate("if(__REEF__.paused)__REEF__.dispatch('boat-resume')");p.wait_for_timeout(500)
  samples=p.evaluate("""()=>new Promise(resolve=>{const samples=[];let last=performance.now();function sample(now){samples.push(now-last);last=now;if(samples.length<180)requestAnimationFrame(sample);else resolve(samples.slice(20));}requestAnimationFrame(sample);})""")
  timings[preset]={'medianMs':round(statistics.median(samples),2),'p95Ms':round(sorted(samples)[int(len(samples)*.95)],2),'frames':len(samples),'scope':'short desktop Chrome boat sample; not sustained phone/thermal proof'}
  p.screenshot(path=str(OUT/('boat-'+preset+'.png')))
 # Controlled buoy placement checks real launch action validates speed and site.
 p.evaluate("Object.assign(__REEF__.boat,{x:38,z:55,speed:8});__REEF__.dispatch('boat-dive')");check('fast boat cannot start dive',p.evaluate('__REEF__.boat!==null'))
 p.evaluate("Object.assign(__REEF__.boat,{x:38,z:55,speed:0})");p.wait_for_timeout(150);p.locator('#boat-enter').click();check('buoy selects correct dive',p.evaluate("__REEF__.sim.run.site==='gardens' && __REEF__.boat===null"))
 check('no desktop page errors',not errors,errors);ctx.close()
 ctx=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True);p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(URL+'?debug=1');p.wait_for_function('window.__REEF__');p.add_style_tag(content='#debug-stats{display:none!important}');p.evaluate("__REEF__.profile.tutorial=1;__REEF__.dispatch('dive')");p.wait_for_timeout(300)
 client=ctx.new_cdp_session(p)
 def point(selector,id):
  b=p.locator(selector).bounding_box();return {'x':b['x']+b['width']/2,'y':b['y']+b['height']/2,'id':id}
 joy=point('#joystick',1);draw=point('.spear-touch',2);removed=p.evaluate('__REEF__.sim.run.removed');yaw=p.evaluate('__REEF__.sim.run.yaw')
 client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[joy,draw]});p.wait_for_timeout(600)
 joy['y']-=28;draw['x']-=24;client.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[joy,draw]});p.wait_for_timeout(200)
 check('multitouch holds draw and drag aims',p.evaluate('__REEF__.sim.run.charge')>.6 and abs(p.evaluate('__REEF__.sim.run.yaw')-yaw)>.02)
 client.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]});p.wait_for_timeout(100)
 check('cancellation does not strike',p.evaluate('__REEF__.sim.run.removed')==removed and p.evaluate('__REEF__.sim.run.charge')==0)
 check('button hold does not select text',p.evaluate('getSelection().toString()')=='')
 p.screenshot(path=str(OUT/'touch-multitouch.png'))
 p.evaluate("__REEF__.dispatch('screen','settings')");check('settings keyboard controls remain reachable',p.locator('select[data-setting=quality]').is_visible())
 check('no touch page errors',not errors,errors)
 ctx.close();browser.close()
print(json.dumps({'checks':len(checks),'errors':errors,'timings':timings}))
