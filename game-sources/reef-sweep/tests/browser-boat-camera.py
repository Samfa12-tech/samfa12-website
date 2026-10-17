"""Boat camera regression: isolated muted Chrome, native mouse/touch, simulated standard pad; no user saves."""
import os,json,functools,http.server,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
OUT=Path(os.environ.get('REEF_SWEEP_QA_OUT',ROOT/'qa-output'/'boat-camera'));OUT.mkdir(parents=True,exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/?debug=1'
report={'scope':__doc__,'checks':[],'errors':[]}
def save():(OUT/'browser.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
def check(name,value,detail=None):
 report['checks'].append({'name':name,'pass':bool(value),'detail':detail});save();assert value,(name,detail)
def cam(p):return p.evaluate('({yaw:__REEF__.renderer.camera.rotation.y,pitch:__REEF__.renderer.camera.rotation.x,boat:__REEF__.boat?.yaw,x:__REEF__.renderer.camera.position.x,y:__REEF__.renderer.camera.position.y,z:__REEF__.renderer.camera.position.z})')
def launch(p):
 p.locator('[data-action="boat-launch"]').click();p.wait_for_function('__REEF__.boat && !__REEF__.paused');p.wait_for_timeout(150)
def entry(p):
 p.evaluate('Object.assign(__REEF__.boat,{x:38,z:55,speed:0})');p.wait_for_function('!document.getElementById("boat-enter").disabled');p.locator('#boat-enter').click();p.wait_for_function('__REEF__.boatEntry?.elapsed>.15')
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True,args=['--mute-audio','--autoplay-policy=user-gesture-required','--disable-background-networking'])
 try:
  for touch in [False,True]:
   ctx=browser.new_context(viewport={'width':390 if touch else 1280,'height':844 if touch else 800},has_touch=touch,is_mobile=touch)
   p=ctx.new_page();p.on('pageerror',lambda e:report['errors'].append(str(e)));p.goto(url);p.wait_for_function('window.__REEF__');p.evaluate('__REEF__.profile.tutorial=1');launch(p)
   start=cam(p);p.screenshot(path=str(OUT/f'initial-{touch}.png'));check(f'{touch} centred rear initial view',abs(start['yaw']-start['boat'])<.02 and .30<start['pitch']<.40,start)
   if touch:
    cdp=ctx.new_cdp_session(p)
    for event,x,y in [('touchStart',90,310),('touchMove',170,345),('touchMove',210,355),('touchEnd',0,0)]:
     cdp.send('Input.dispatchTouchEvent',{'type':event,'touchPoints':[] if event=='touchEnd' else [{'x':x,'y':y,'id':1}]});p.wait_for_timeout(40)
   else:
    p.mouse.move(150,300);p.mouse.move(310,350,steps=6)
   p.wait_for_timeout(160);look=cam(p);check(f'{touch} native look changes camera',abs(look['yaw']-start['yaw'])>.15 and abs(look['pitch']-start['pitch'])>.04,look)
   p.screenshot(path=str(OUT/f'look-{touch}.png'))
   if not touch:
    p.mouse.down(button='right');p.mouse.move(390,370,steps=4);p.mouse.up(button='right');p.wait_for_timeout(100);check('mouse drag look without spear or pointer lock',cam(p)['yaw']>look['yaw']+.08 and p.evaluate('!document.pointerLockElement && !__REEF__.input.keys.has("Mouse0")'))
    offset=cam(p)['yaw']-cam(p)['boat'];p.keyboard.down('w');p.keyboard.down('d');p.wait_for_timeout(450);p.keyboard.up('w');p.keyboard.up('d');p.wait_for_timeout(100);after=cam(p);check('steering retains user camera offset',abs(after['yaw']-after['boat']-offset)<.025 and p.evaluate('__REEF__.boat.distance>0'),after)
    p.evaluate('''()=>{window.testPad={id:'Camera regression pad',mapping:'standard',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.testPad]});}''');p.wait_for_timeout(100);before=cam(p);p.evaluate('testPad.axes[2]=.8');p.wait_for_timeout(350);p.evaluate('testPad.axes[2]=0');p.wait_for_timeout(100);check('standard controller right stick looks',cam(p)['yaw']>before['yaw']+.15)
   p.locator('#pause-button').click();p.wait_for_function('__REEF__.paused');frozen=cam(p);p.mouse.move(90,240);p.mouse.move(220,300,steps=3);p.wait_for_timeout(150);check(f'{touch} pause keeps view and consumes look',cam(p)==frozen)
   p.locator('[data-action="boat-resume"]').click();p.wait_for_timeout(120);check(f'{touch} resume preserves user view',abs(cam(p)['yaw']-frozen['yaw'])<.01)
   entry(p);check(f'{touch} entry alone owns cinematic view',abs(cam(p)['yaw']-cam(p)['boat'])>.15)
   held=p.evaluate('JSON.stringify(__REEF__.boatRenderer.look)');p.mouse.move(80,300);p.mouse.move(220,350,steps=4);p.wait_for_timeout(100);check(f'{touch} cinematic ignores player look',p.evaluate('JSON.stringify(__REEF__.boatRenderer.look)')==held)
   p.locator('#pause-button').click();p.wait_for_function('__REEF__.paused');frozen=cam(p);elapsed=p.evaluate('__REEF__.boatEntry.elapsed');p.wait_for_timeout(180);check(f'{touch} paused cinematic freezes',cam(p)==frozen and p.evaluate('__REEF__.boatEntry.elapsed')==elapsed)
   p.locator('[data-action="boat-resume"]').click();p.wait_for_function(f'__REEF__.boatEntry.elapsed>{elapsed}');check(f'{touch} cinematic resumes from held time',p.evaluate('__REEF__.boatEntry.elapsed')>elapsed)
   p.evaluate('__REEF__.dispatch("boat-harbour")');p.wait_for_function('!__REEF__.boat && !__REEF__.boatEntry');launch(p);reset=cam(p);check(f'{touch} cancel and new trip reset ownership',abs(reset['yaw']-reset['boat'])<.02 and .30<reset['pitch']<.40,reset)
   entry(p)
   if touch:
    # Restore native touch after the deliberately injected paused mouse input.
    p.locator('#ocean').tap(position={'x':80,'y':310});p.locator('#boat-entry-status button').tap()
   else:
    p.wait_for_function('__REEF__.sim && !__REEF__.boatEntry',timeout=10000)
   p.wait_for_function('__REEF__.sim && !__REEF__.boat && !__REEF__.boatEntry');p.wait_for_timeout(650)
   check(f'{touch} complete or skip releases boat mode',p.evaluate('!__REEF__.input.boatMode && !__REEF__.boatRenderer && Math.abs(__REEF__.renderer.camera.rotation.y-__REEF__.sim.run.yaw)<.02'))
   dive_before=cam(p)
   if touch:
    for event,x,y in [('touchStart',90,310),('touchMove',190,330),('touchEnd',0,0)]:
     cdp.send('Input.dispatchTouchEvent',{'type':event,'touchPoints':[] if event=='touchEnd' else [{'x':x,'y':y,'id':2}]});p.wait_for_timeout(50)
   else:
    p.mouse.move(150,300);p.mouse.move(320,340,steps=6)
   p.wait_for_timeout(150);check(f'{touch} dive camera responds after handoff',abs(cam(p)['yaw']-dive_before['yaw'])>.1,{'before':dive_before,'after':cam(p),'state':p.evaluate('({paused:__REEF__.paused,screen:__REEF__.ui.screen,active:__REEF__.input.active,touch:__REEF__.input.touchMode,point:document.elementFromPoint(90,310)?.id,locked:!!document.pointerLockElement})')})
   ctx.close()
  check('no page errors',not report['errors'],report['errors'])
 finally:save();browser.close();server.shutdown()
print(json.dumps({'checks':len(report['checks']),'pass':all(c['pass'] for c in report['checks']),'output':str(OUT)}))
