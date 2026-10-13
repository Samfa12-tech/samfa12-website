from playwright.sync_api import sync_playwright
from pathlib import Path
import json,re,traceback,os,shutil,argparse
parser=argparse.ArgumentParser(description="Reef Sweep deterministic browser acceptance. Use --url for a normal served build; otherwise inject local scripts.")
parser.add_argument("--url",default="",help="For example http://127.0.0.1:4173/")
parser.add_argument("--headless",action="store_true",help="Default is headed. Use xvfb-run on a Linux CI machine without a display.")
args=parser.parse_args()
root=Path(__file__).resolve().parents[1];results=[];errors=[]
def check(name,condition,detail=''):
 results.append({'test':name,'pass':bool(condition),'detail':detail});print(('PASS ' if condition else 'FAIL ')+name,detail)
def load(page):
 if args.url:
  page.add_init_script("window.REEF_TEST_MODE=true;");page.goto(args.url,wait_until="load");page.wait_for_function("window.__REEF__ !== undefined");page.wait_for_timeout(1200);return
 html=(root/'index.html').read_text();html=re.sub(r'<link rel="stylesheet"[^>]*>','<style>'+(root/'style.css').read_text()+'</style>',html);html=re.sub(r'<script src=[^>]*></script>','',html);page.set_content(html)
 page.evaluate('''window.REEF_TEST_MODE=true;window._saved=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>window._saved.get(k)||null,setItem:(k,v)=>window._saved.set(k,v),removeItem:k=>window._saved.delete(k),clear:()=>window._saved.clear(),key:i=>[...window._saved.keys()][i]||null,get length(){return window._saved.size}}});''')
 page.add_script_tag(content=(root/'public/babylon.js').read_text());page.add_script_tag(content=(root/'public/game.js').read_text());page.wait_for_timeout(1200)
def shot(page,name):
 page.evaluate("document.getElementById('debug-stats').style.display='none'");page.screenshot(path=str(root/'screenshots'/name))
def evaluate(page,expression):return page.evaluate('(()=>{const a=window.__REEF__;'+expression+'})()')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_BIN') or shutil.which('chromium'),headless=args.headless,args=['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1200,'height':760});page.set_default_timeout(30000);page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 try:
  load(page);check('Harbour boot',page.locator('[data-action=dive]').is_visible());check('Babylon WebGL 2 scene',evaluate(page,'return a.renderer.engine.webGLVersion===2;'));shot(page,'01-harbour.png')
  page.locator('[data-action=dive]').click();page.wait_for_timeout(300);check('Dive begins',evaluate(page,'return !a.paused && a.profile.active!==null;'))
  evaluate(page,"a.teleport(3,4,-33);a.aimAt(a.sim.run.fish[0].p);")
  page.keyboard.down('w');before=evaluate(page,'return a.sim.run.p.z;');evaluate(page,'a.tick(.25,a.input.sample(1/60));');page.keyboard.up('w');check('Keyboard swimming moves diver',evaluate(page,'return a.sim.run.p.z;')>before,'DOM key state consumed by deterministic simulation step')
  evaluate(page,"const f=a.sim.run.fish[0];a.teleport(f.p.x,f.p.y,f.p.z-2);a.aimAt(f.p);a.sim.nativeTargets=[];")
  page.keyboard.down('r');evaluate(page,'a.tick(0.9,a.input.sample(1/60));');check('Keyboard spear draw reaches charge',evaluate(page,'return a.sim.run.charge>.9;'));page.keyboard.up('r');evaluate(page,'a.tick(.02,a.input.sample(1/60));');check('Release hits visible target',evaluate(page,'return a.sim.run.removed===1 && !!a.sim.run.exposed;'));page.wait_for_timeout(300);shot(page,'03-manual-catch.png')
  page.keyboard.down('e');evaluate(page,'a.tick(.8,a.input.sample(1/60));');page.keyboard.up('e');check('Manual secure transfers catch',evaluate(page,'return a.sim.run.cargo.length===1 && a.sim.run.exposed===null;'))
  for jid in ['debris-0','coral-0','survey-0']:
   evaluate(page,f"const j=a.sim.run.jobs.find(j=>j.id==='{jid}');a.teleport(j.p.x,j.p.y+1.2,j.p.z-1.3);a.aimAt(j.p);")
   page.keyboard.down('e');evaluate(page,'a.tick(4,a.input.sample(1/60));');page.keyboard.up('e');check('Work interaction '+jid,evaluate(page,f"return a.sim.run.jobs.find(j=>j.id==='{jid}').done;"))
  page.keyboard.press('Escape');page.wait_for_timeout(100);check('Escape pauses',evaluate(page,'return a.paused;'));air=evaluate(page,'return a.sim.run.air;');page.wait_for_timeout(400);check('Pause preserves air',evaluate(page,'return a.sim.run.air;')==air)
  page.locator('[data-screen=journal]').click();page.wait_for_timeout(100);check('Chart renders in pause',page.locator('#chart').is_visible());shot(page,'04-reef-chart.png');page.locator('[data-close]').first.click();page.locator('[data-action=resume]').click()
  evaluate(page,"a.teleport(-4,6,13);a.aimAt(a.sim.run.animals[0].p);");page.wait_for_timeout(300);shot(page,'05-marlow.png')
  evaluate(page,'const j=a.renderer.site.landmarks[0];a.teleport(j.p.x,j.p.y,j.p.z);');page.keyboard.down('e');evaluate(page,'a.tick(1.4,a.input.sample(1/60));');page.keyboard.up('e');check('Mooring return opens debrief',page.locator('[data-action=settle]').is_visible());page.wait_for_timeout(300);check('Automatic captured image cards',page.locator('.highlight img').count()>=2);shot(page,'06-debrief.png')
  page.locator('[data-action=settle]').click();check('Settlement advances day and closes run',evaluate(page,'return a.profile.day===2 && a.profile.active===null && a.profile.pending===null;'));check('Settlement preserves work',evaluate(page,"return !!a.profile.reefs.gardens.restored['coral-0'] && a.profile.totalCleaned===1;"))
  page.locator('[data-screen=gear]').click();cash=evaluate(page,'return a.profile.cash;');page.locator('[data-buy=fins]').click();check('Equipment purchase updates funds',evaluate(page,"return a.profile.upgrades.includes('fins') && a.profile.cash;")==cash-95)
  evaluate(page,"a.dispatch('screen','dock');a.profile.cash=500;a.profile.totalRemoved=6;a.dispatch('buy','scooter');a.dispatch('screen','dock');a.dispatch('site','passage');a.dispatch('dive');a.sim.toggleScooter();")
  check('Second site and scooter operate',evaluate(page,"return a.sim.run.site==='passage' && a.sim.run.scooter;"));page.wait_for_timeout(300);shot(page,'07-tideglass-scooter.png')
  meshCounts=[]
  for i in range(3):
   evaluate(page,'a.refresh();');meshCounts.append(evaluate(page,'return a.renderer.scene.meshes.length;'))
  check('Repeated rebuild mesh count stable',len(set(meshCounts))==1,str(meshCounts))
  evaluate(page,"a.dispatch('screen','pause');a.dispatch('suspend');");check('Suspend returns to harbour',page.locator('[data-action=resume]').is_visible());saved=evaluate(page,'return a.store.load(a.profile.slot);');check('Serialized active dive roundtrip',saved['active']['site']=='passage' and saved['active']['scooter'])
  evaluate(page,"a.dispatch('resume');a.sim.run.air=.001;a.tick(.1);");check('Air exhaustion opens rescue debrief',evaluate(page,'return a.profile.pending.rescued && a.paused;'));evaluate(page,"a.dispatch('settle');");check('Rescue retains purchased gear',evaluate(page,"return a.profile.upgrades.includes('scooter');"))
  evaluate(page,"a.dispatch('screen','settings');");page.locator('[data-setting=toggleDraw]').check();check('Toggle-draw option persists',evaluate(page,'return a.input.settings.toggleDraw;'));page.locator('[data-bind=up]').click();page.keyboard.press('t');check('Keyboard rebinding',evaluate(page,"return a.input.settings.keys.up==='KeyT';"))
  if args.url:
   page.locator('[data-setting=quality]').select_option('high');check('High graphics asks before reload',page.locator('.quality-reload-note').is_visible());page.locator('[data-action=quality-reload]').click();page.wait_for_function('window.__REEF__ !== undefined');page.wait_for_timeout(500);check('High graphics preference survives reload',evaluate(page,"return a.input.settings.quality==='high' && a.store.settings().quality==='high';"));page.locator('[data-action=fullscreen]').first.click();page.wait_for_function('document.fullscreenElement===document.documentElement');check('Fullscreen click enters browser fullscreen',page.evaluate('document.fullscreenElement===document.documentElement'));page.locator('[data-fullscreen-label]').first.click();page.wait_for_function('document.fullscreenElement===null');check('Fullscreen action exits browser fullscreen',page.evaluate('document.fullscreenElement===null'))
  check('No runtime or shader errors',len(errors)==0,str(errors[:2]));page.close()
 except Exception as e:
  check('Desktop acceptance completed',False,str(e));traceback.print_exc()
 # Separate coarse-pointer viewport. Exercise actual pointer dispatch through the touch controls.
 mobile=b.new_page(viewport={'width':844,'height':390},is_mobile=True,has_touch=True,device_scale_factor=1);mobile.on('pageerror',lambda e:errors.append('mobile '+str(e)))
 try:
  load(mobile);shot(mobile,'08-mobile-harbour.png');check('Landscape dock controls reachable',mobile.locator('[data-action=dive]').is_visible());footer=mobile.locator('.bottomline').bounding_box();card=mobile.locator('.dock-card').bounding_box();check('Compact dock footer follows the card without overlap',bool(footer and card and footer['y']>=card['y']+card['height']),str({'footer':footer,'card':card}));mobile.locator('[data-action=dive]').tap();mobile.wait_for_timeout(200);check('Touch HUD shown',mobile.locator('#joystick').is_visible());shot(mobile,'09-mobile-dive.png')
  evaluate(mobile,"const f=a.sim.run.fish[0];a.teleport(f.p.x,f.p.y,f.p.z-2);a.aimAt(f.p);a.sim.nativeTargets=[];")
  btn=mobile.locator('[data-touch=spear]');box=btn.bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2;session=mobile.context.new_cdp_session(mobile)
  session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]});evaluate(mobile,'a.tick(1,a.input.sample(1/60));');session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});evaluate(mobile,'a.tick(.02,a.input.sample(1/60));');check('Touch draw and release',evaluate(mobile,'return a.sim.run.removed===1;'))
  mobile.set_viewport_size({'width':390,'height':844});mobile.wait_for_timeout(250);check('Landscape-to-portrait rotation keeps dive running',evaluate(mobile,'return !a.paused && document.getElementById("rotate").hidden && a.sim.run.time>0;'))
  mobile.set_viewport_size({'width':320,'height':600});mobile.evaluate("__REEF__.dispatch('setting',{name:'touchScale',value:1.3})");mobile.wait_for_timeout(150)
  control_check=mobile.evaluate('''()=>{const els=[...document.querySelectorAll('#joystick,[data-touch]')].filter(e=>e.getClientRects().length),r=els.map(e=>e.getBoundingClientRect()),outside=r.some(x=>x.left< -1||x.top< -1||x.right>innerWidth+1||x.bottom>innerHeight+1),overlap=[];for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++)if(r[i].left<r[j].right-1&&r[i].right>r[j].left+1&&r[i].top<r[j].bottom-1&&r[i].bottom>r[j].top+1)overlap.push([i,j]);return {outside,overlap,smallTargets:els.filter((e,i)=>e.matches('[data-touch]')&&(r[i].width<44||r[i].height<44)).length}}''')
  check('Portrait touch controls fit, stay separated and remain 44px at 320×600 (scale 1.3)',not control_check['outside'] and not control_check['overlap'] and control_check['smallTargets']==0,str(control_check));check('Portrait rotation keeps dive running at 320×600',evaluate(mobile,'return !a.paused && document.getElementById("rotate").hidden;'));mobile.screenshot(path=str(root/'screenshots'/'12-portrait-running-320x600.png'));mobile.set_viewport_size({'width':390,'height':844});mobile.wait_for_timeout(120);check('Portrait controls remain separated at 390×844',mobile.evaluate('''()=>{const es=[...document.querySelectorAll('#joystick,[data-touch]')].filter(e=>e.getClientRects().length),r=es.map(e=>e.getBoundingClientRect());for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++)if(r[i].left<r[j].right-1&&r[i].right>r[j].left+1&&r[i].top<r[j].bottom-1&&r[i].bottom>r[j].top+1)return false;return r.every(x=>x.left>=-1&&x.top>=-1&&x.right<=innerWidth+1&&x.bottom<=innerHeight+1)}'''));mobile.set_viewport_size({'width':844,'height':390})
 except Exception as e:check('Mobile acceptance completed',False,str(e));traceback.print_exc()
 # Initial portrait launch also remains playable, with the same landscape touch controls.
 portrait=b.new_page(viewport={'width':320,'height':600},is_mobile=True,has_touch=True,device_scale_factor=1);portrait.on('pageerror',lambda e:errors.append('portrait '+str(e)))
 try:
  load(portrait);portrait.locator('[data-action=dive]').tap();portrait.wait_for_timeout(200);check('Initial portrait launch remains playable',evaluate(portrait,'return !a.paused && document.getElementById("rotate").hidden && a.sim.run.time>0;'));portrait.screenshot(path=str(root/'screenshots'/'10-portrait-dive-320x600.png'));portrait.locator('#pause-button').tap();portrait.wait_for_timeout(100);check('Portrait pause menu stays inside viewport',portrait.locator('#panel .modal').bounding_box()['height']<=600);portrait.screenshot(path=str(root/'screenshots'/'11-portrait-pause-320x600.png'))
 except Exception as e:check('Initial portrait acceptance completed',False,str(e));traceback.print_exc()
 portrait.close()
 b.close()
(root/'docs/browser-test-results.json').write_text(json.dumps({'environment':'Windows Chromium headless, local GPU; URL origin Storage when --url supplied, otherwise injected in-memory Storage; test-only helpers and placement/granted progression fixtures.','results':results,'errors':errors},indent=2))
print('SUMMARY',sum(r['pass'] for r in results),'/',len(results))

if any(not r["pass"] for r in results) or errors: raise SystemExit(1)
