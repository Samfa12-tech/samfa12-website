"""Local Chrome; controlled buoy/catch placements, native touch emulation.
Not physical iPhone/Android proof or a complete human playthrough.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'qa-output'/'refinements';OUT.mkdir(parents=True,exist_ok=True)
report={'checks':[],'errors':[],'scope':__doc__}
def check(name,value,detail=None):
 report['checks'].append({'name':name,'pass':bool(value),'detail':detail})
 (OUT/'browser.json').write_text(json.dumps(report,indent=2));assert value,(name,detail)
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True,args=['--no-first-run','--disable-extensions','--disable-background-networking'])
 for width,height in [(1280,800),(390,844),(844,390),(320,568)]:
  touch=width!=1280;portrait=width<height
  ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=touch,is_mobile=touch)
  p=ctx.new_page();p.on('pageerror',lambda e:report['errors'].append(str(e)))
  p.goto('http://127.0.0.1:4173/?debug=1');p.wait_for_function('window.__REEF__');p.add_style_tag(content='#debug-stats{display:none!important}')
  p.evaluate('__REEF__.profile.tutorial=1')
  check(str(width)+' harbour has launch without redundant selectors',p.locator('[data-action="boat-launch"]').count()==1 and p.locator('.site-selector,#order-choice').count()==0)
  p.screenshot(path=str(OUT/f'after-menu-{width}.png'))
  p.locator('[data-action="boat-launch"]').click();p.wait_for_function('__REEF__.boat!==null');p.wait_for_timeout(200)
  if p.evaluate('__REEF__.paused'):p.evaluate('__REEF__.dispatch("boat-resume")')
  check(str(width)+' assignments await actual buoy',not p.locator('#boat-mooring').is_visible() and p.locator('#boat-contract').is_disabled())
  check(str(width)+' responsive chart default',p.locator('#boat-map').evaluate('e=>e.open')== (not portrait))
  nav=p.locator('#boat-navigation').bounding_box()
  check(str(width)+' navigation fits',nav['x']>=0 and nav['x']+nav['width']<=width+1 and nav['height']<height*(.22 if portrait else .83),nav)
  p.screenshot(path=str(OUT/f'after-boat-{width}.png'))
  p.locator('#boat-map summary').click();check(str(width)+' chart disclosure works',p.locator('#boat-map').evaluate('e=>e.open')==portrait);p.locator('#boat-map summary').click()
  gulls=p.evaluate('''()=>__REEF__.renderer.scene.meshes.filter(m=>m.name.startsWith('coastal-seagull-')).map(m=>({enabled:m.isEnabled(),position:m.position.asArray(),vertices:m.getTotalVertices()}))''')
  check(str(width)+' few bounded local gull meshes',3<=len(gulls)<=5 and all(g['enabled'] and g['position'][1]>8 and g['vertices']<1000 for g in gulls),gulls)
  if touch:
   client=ctx.new_cdp_session(p);box=p.locator('#joystick').bounding_box();joy={'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'id':1}
   client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[joy]});joy['y']-=35;joy['x']+=18;client.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[joy]})
  else:p.keyboard.down('w');p.keyboard.down('d')
  p.wait_for_function('__REEF__.boat.distance>4',timeout=12000)
  if touch:client.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
  else:p.keyboard.up('w');p.keyboard.up('d')
  check(str(width)+' actual throttle and steering',p.evaluate('__REEF__.boat.distance>4 && Math.abs(__REEF__.boat.yaw-.4)>.1'))
  p.evaluate('Object.assign(__REEF__.boat,{x:38,z:55,speed:0})');p.wait_for_function('!document.getElementById("boat-enter").disabled')
  check(str(width)+' buoy shows assignment and fuel',p.locator('#boat-mooring').is_visible() and 'Towing' in p.locator('#boat-site-detail').inner_text() and 'Sunlit Gardens' in p.locator('#boat-enter').inner_text())
  p.locator('#boat-contract').select_option('none');check(str(width)+' native assignment select usable',p.evaluate('__REEF__.ui.order')=='none');p.screenshot(path=str(OUT/f'buoy-{width}.png'))
  p.locator('#boat-enter').click();p.wait_for_function('__REEF__.sim?.run.site==="gardens" && __REEF__.boat===null')
  if p.evaluate('__REEF__.paused'):p.evaluate('__REEF__.dispatch("resume")')
  p.wait_for_timeout(250);check(str(width)+' selected assignment starts',p.evaluate('__REEF__.sim.run.order==="none"'))
  p.screenshot(path=str(OUT/f'after-tube-{width}.png'))
  def resting():return p.evaluate('__REEF__.renderer.tube.rotation.x')>1.3 if portrait else abs(p.evaluate('__REEF__.renderer.tube.rotation.x'))<.01
  check(str(width)+' correct resting tube pose',resting())
  p.evaluate('''()=>{let q=__REEF__,r=q.sim.run;r.fish.forEach(f=>f.alive=false);let a=r.fish[0],b=r.fish[1];a.alive=true;b.alive=true;r.p={x:0,y:8,z:-41};r.velocity={x:0,y:0,z:0};r.yaw=0;r.pitch=0;a.p=a.home={x:0,y:8,z:-39};b.p=b.home={x:3,y:8,z:-39};window.originalCatch=q.renderer.fishMeshes.get(a.id);q.sim.strike(1);}''');p.wait_for_timeout(500)
  p.evaluate('''()=>{let q=__REEF__,r=q.sim.run,b=r.fish[1];r.strikeCooldown=0;b.p=b.home={x:r.p.x,y:r.p.y,z:r.p.z+2};r.yaw=0;r.pitch=0;q.sim.strike(1);}''');p.wait_for_timeout(500)
  check(str(width)+' original fish mesh and Shishkabob retained',p.evaluate('__REEF__.sim.run.skewered.length===1 && originalCatch===__REEF__.renderer.fishMeshes.get(__REEF__.sim.run.exposed.id) && __REEF__.sim.run.clips.some(c=>c.kind==="shishkabob"&&!!c.image)'))
  def hold():
   if touch:
    box=p.locator('[data-touch="interact"]').bounding_box();point={'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'id':2};client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]})
   else:p.keyboard.down('e')
  def release(cancel=False):
   if touch:client.send('Input.dispatchTouchEvent',{'type':'touchCancel' if cancel else 'touchEnd','touchPoints':[]})
   else:p.keyboard.up('e')
  hold();p.wait_for_function('__REEF__.sim.run.interaction>.32');check(str(width)+' tube raises before insertion',abs(p.evaluate('__REEF__.renderer.tube.rotation.x'))<.01)
  release(True);p.wait_for_timeout(650)
  check(str(width)+' cancel retains fish without cargo',p.evaluate('__REEF__.sim.run.cargo.length===0 && __REEF__.sim.run.exposed!==null && __REEF__.sim.run.skewered.length===1'));check(str(width)+' cancel restores tube pose',resting())
  hold();p.wait_for_function('__REEF__.sim.run.interaction>.65');p.screenshot(path=str(OUT/f'tube-insertion-{width}.png'));p.wait_for_function('__REEF__.sim.run.cargo.length===2',timeout=10000);release();p.wait_for_function('!__REEF__.sim.run.transfer');p.wait_for_timeout(700)
  check(str(width)+' both fish secure once and original mesh hides',p.evaluate('__REEF__.sim.run.cargo.length===2&&!__REEF__.sim.run.exposed&&!originalCatch.isEnabled()'));check(str(width)+' tube lowers after empty prongs withdraw',resting())
  p.evaluate('__REEF__.save()');p.reload();p.wait_for_function('window.__REEF__');p.add_style_tag(content='#debug-stats{display:none!important}')
  check(str(width)+' resume remains available without selector',p.locator('[data-action="resume"]').count()==1 and p.locator('.site-selector').count()==0)
  p.locator('[data-action="resume"]').click();p.wait_for_timeout(150)
  if p.evaluate('__REEF__.paused'):p.evaluate('__REEF__.dispatch("resume")')
  check(str(width)+' reload resume retains two catches',p.evaluate('__REEF__.sim.run.cargo.length===2'))
  if touch:
   p.set_viewport_size({'width':height,'height':width});p.wait_for_timeout(700)
   check(str(width)+' orientation change settles tube',p.evaluate('__REEF__.renderer.tube.rotation.x')>1.3 if not portrait else abs(p.evaluate('__REEF__.renderer.tube.rotation.x'))<.01)
   p.set_viewport_size({'width':width,'height':height});p.wait_for_timeout(500)
  p.evaluate('let q=__REEF__,r=q.sim.run;r.p.y=q.sim.site.surface+.35;r.velocity={x:0,y:0,z:0};r.yaw=0;r.pitch=-.28;')
  p.wait_for_function('__REEF__.renderer.seagulls.meshes.every(m=>m.isEnabled())',timeout=3000)
  check(str(width)+' surface gulls visible',p.evaluate('__REEF__.renderer.seagulls.meshes.every(m=>m.isEnabled())'));p.screenshot(path=str(OUT/f'surface-gulls-{width}.png'))
  p.evaluate('__REEF__.sim.run.p.y-=3');p.wait_for_function('__REEF__.renderer.seagulls.meshes.every(m=>!m.isEnabled())');check(str(width)+' submerged birds hidden',p.evaluate('__REEF__.renderer.seagulls.meshes.every(m=>!m.isEnabled())'))
  p.evaluate('__REEF__.refresh()');p.wait_for_timeout(50);check(str(width)+' rebuild has no duplicate flock',p.evaluate('__REEF__.renderer.scene.meshes.filter(m=>m.name.startsWith("coastal-seagull-")).length')==len(gulls));ctx.close()
 check('no page errors',not report['errors'],report['errors']);browser.close()
print(json.dumps({'checks':len(report['checks']),'errors':report['errors']}))
