"""Muted local Babylon crew/entry integration; debug placements, real UI/touch, no physical-device claim."""
import os,json,functools,http.server,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
OUT=Path(os.environ.get('REEF_SWEEP_QA_OUT',ROOT/'qa-output'/'boat-entry'));OUT.mkdir(parents=True,exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/?debug=1'
report={'scope':__doc__,'checks':[],'errors':[]}
def check(name,value,detail=None):
 report['checks'].append({'name':name,'pass':bool(value),'detail':detail});save();assert value,(name,detail)
def save():(OUT/'browser.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_BIN',r'C:\Program Files\Google\Chrome\Application\chrome.exe'),headless=True,args=['--mute-audio','--autoplay-policy=user-gesture-required','--disable-background-networking'])
 try:
  for touch in [False,True]:
   ctx=browser.new_context(viewport={'width':390 if touch else 1280,'height':844 if touch else 800},has_touch=touch,is_mobile=touch)
   p=ctx.new_page();p.on('pageerror',lambda e:report['errors'].append(str(e)));p.goto(url);p.wait_for_function('window.__REEF__');p.add_style_tag(content='#debug-stats{display:none!important}')
   p.evaluate('__REEF__.profile.tutorial=1');p.locator('[data-action="boat-launch"]').click();p.wait_for_function('__REEF__.boat && !__REEF__.paused')
   crew=p.evaluate('''()=>['boat-pilot','boat-diver'].map(n=>{const m=__REEF__.renderer.scene.getMeshByName(n);return {name:n,vertices:m?.getTotalVertices(),enabled:m?.isEnabled(),finite:m?.getVerticesData('position').every(Number.isFinite)}})''')
   check(str(touch)+' two visible finite crew batches',all(m['enabled'] and m['finite'] and m['vertices']>0 for m in crew),crew)
   p.screenshot(path=str(OUT/f'driving-{touch}.png'))
   p.evaluate('Object.assign(__REEF__.boat,{x:38,z:55,speed:0,distance:123.45})');p.wait_for_function('!document.getElementById("boat-enter").disabled');p.locator('#boat-contract').select_option('none')
   if touch:p.locator('#boat-enter').tap()
   else:p.locator('#boat-enter').click()
   p.wait_for_function('__REEF__.boatEntry?.elapsed>.55');p.evaluate('window.firstEntry=__REEF__.boatEntry;__REEF__.dispatch("boat-dive");__REEF__.dispatch("boat-dive")')
   check(str(touch)+' no early save or duplicate sequence',p.evaluate('__REEF__.boatEntry===firstEntry && !__REEF__.profile.active && !__REEF__.sim'))
   p.screenshot(path=str(OUT/f'gear-check-{touch}.png'));p.locator('#pause-button').click();p.wait_for_function('__REEF__.paused');elapsed=p.evaluate('__REEF__.boatEntry.elapsed');p.wait_for_timeout(300)
   check(str(touch)+' pause freezes clip and retains controls',p.evaluate('__REEF__.boatEntry.elapsed')==elapsed and p.locator('[data-action="boat-resume"]').is_visible())
   p.locator('[data-action="boat-resume"]').click();p.keyboard.down('w');p.wait_for_function('__REEF__.boatEntry?.elapsed>2.05');p.keyboard.up('w')
   check(str(touch)+' entry blocks steering and engine',p.evaluate('__REEF__.boat.distance===123.45 && !__REEF__.audio.stats().boatMotor.active'))
   p.screenshot(path=str(OUT/f'backward-roll-{touch}.png'));p.wait_for_function('__REEF__.boatEntry?.elapsed>2.67');p.screenshot(path=str(OUT/f'water-contact-{touch}.png'))
   p.wait_for_function('__REEF__.sim && !__REEF__.boatEntry && !__REEF__.boat');p.wait_for_timeout(600)
   check(str(touch)+' selected dive begins once with original distance',p.evaluate('__REEF__.sim.run.site==="gardens" && __REEF__.sim.run.order==="none" && __REEF__.sim.run.boatDistance===123.45'))
   active=p.evaluate('__REEF__.profile.active.id');p.evaluate('__REEF__.dispatch("boat-entry-skip");__REEF__.dispatch("boat-entry-skip")');check(str(touch)+' repeated skip cannot replace active dive',p.evaluate('__REEF__.profile.active.id')==active)
   check(str(touch)+' fade clears and crew disposed at dive',p.evaluate('Number(document.getElementById("boat-entry-fade").style.opacity)===0 && !__REEF__.renderer.scene.getMeshByName("boat-diver")'))
   p.screenshot(path=str(OUT/f'dive-{touch}.png'));ctx.close()
  sites={'gardens':(38,55),'passage':(-65,115),'mangrove':(-125,8),'cenote':(115,160),'harbour':(12,-118)}
  for site,(x,z) in sites.items():
   ctx=browser.new_context();p=ctx.new_page();p.on('pageerror',lambda e:report['errors'].append(str(e)));p.goto(url);p.wait_for_function('window.__REEF__')
   p.evaluate('''()=>{let q=__REEF__;q.profile.tutorial=1;q.profile.totalRemoved=80;q.profile.reputation=100;q.profile.upgradeLevels={air:2,torch:1};q.profile.upgrades=['air','torch'];}''');p.locator('[data-action="boat-launch"]').click();p.wait_for_function('__REEF__.boat && !__REEF__.paused')
   p.evaluate('([x,z,night])=>{Object.assign(__REEF__.boat,{x,z,speed:0,distance:77.25});__REEF__.ui.night=night}',[x,z,site=='passage']);p.wait_for_function('!document.getElementById("boat-enter").disabled');p.locator('#boat-contract').select_option('none');p.locator('#boat-enter').click();p.wait_for_function('__REEF__.boatEntry')
   p.locator('#boat-entry-status button').click();p.wait_for_function('__REEF__.profile.active');run=p.evaluate('({site:__REEF__.profile.active.site,order:__REEF__.profile.active.order,night:__REEF__.profile.active.night,distance:__REEF__.profile.active.boatDistance})')
   check(site+' skip preserves complete payload',run=={'site':site,'order':'none','night':site=='passage','distance':77.25},run);ctx.close()
  ctx=browser.new_context();p=ctx.new_page();p.goto(url);p.wait_for_function('window.__REEF__');p.locator('[data-action="boat-launch"]').click();p.wait_for_function('__REEF__.boat');p.evaluate('Object.assign(__REEF__.boat,{x:38,z:55,speed:0})');p.wait_for_function('!document.getElementById("boat-enter").disabled');p.locator('#boat-enter').click();p.wait_for_function('__REEF__.boatEntry');p.reload();p.wait_for_function('window.__REEF__')
  check('reload during entry leaves no partial dive',p.evaluate('!__REEF__.profile.active && !__REEF__.profile.pending && !__REEF__.boatEntry'))
  p.evaluate('__REEF__.audio.settings.reducedMotion=true');p.locator('[data-action="boat-launch"]').click();p.wait_for_function('__REEF__.boat');p.evaluate('Object.assign(__REEF__.boat,{x:38,z:55,speed:0})');p.wait_for_function('!document.getElementById("boat-enter").disabled');p.locator('#boat-enter').click();p.wait_for_function('__REEF__.sim')
  check('steady camera uses same once-only immediate entry',p.evaluate('!__REEF__.boatEntry && !__REEF__.boat && __REEF__.sim.run.site==="gardens"'))
  ctx.close();check('no page errors',not report['errors'],report['errors'])
 finally:save();browser.close();server.shutdown()
print(json.dumps({'checks':len(report['checks']),'pass':all(c['pass'] for c in report['checks']),'output':str(OUT)}))
