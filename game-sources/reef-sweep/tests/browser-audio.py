"""Muted local Chromium audio regression: graph RMS, gestures and controlled lifecycle.
No microphone, captured audio file, physical listening, or device certification.
"""
import argparse, functools, http.server, json, os, threading, math
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--dist',type=Path,default=ROOT/'dist');parser.add_argument('--baseline',action='store_true');args=parser.parse_args()
OUT=Path(os.environ.get('REEF_SWEEP_QA_OUT',ROOT/'qa-output'/'audio'));OUT.mkdir(parents=True,exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def translate_path(self,path):
  if path.split('?')[0]=='/standalone.html':return str(args.dist.parent/'Reef-Sweep.html')
  prefix='/games/reef-sweep/play'
  path=path[len(prefix):] if path.startswith(prefix) else path
  return super().translate_path(path)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(args.dist)))
threading.Thread(target=server.serve_forever,daemon=True).start();URL=f'http://127.0.0.1:{server.server_port}/games/reef-sweep/play/?debug=1'
report={'scope':__doc__,'baseline':args.baseline,'checks':[],'pageErrors':[],'failedRequests':[],'nonlocalRequests':[]}
def save(): (OUT/('baseline.json' if args.baseline else 'browser.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
def check(name,passed,detail=None):
 report['checks'].append({'name':name,'pass':bool(passed),'detail':detail});save();assert passed,(name,detail)
def state(p):return p.evaluate('JSON.parse(render_game_to_text())')
def rms(p,bus):
 return p.evaluate('''async bus=>{const a=__REEF__.audio,n=a.ctx.createAnalyser();n.fftSize=1024;const sink=a.ctx.createGain();sink.gain.value=0;n.connect(sink);sink.connect(a.ctx.destination);a[bus].connect(n);let peak=0;for(let i=0;i<6;i++){await new Promise(r=>setTimeout(r,60));let b=new Float32Array(n.fftSize);n.getFloatTimeDomainData(b);peak=Math.max(peak,Math.sqrt(b.reduce((s,x)=>s+x*x,0)/b.length));}a[bus].disconnect(n);n.disconnect();sink.disconnect();return peak;}''',bus)
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_BIN',r'C:\Program Files\Google\Chrome\Application\chrome.exe'),headless=True,args=['--mute-audio','--autoplay-policy=user-gesture-required','--no-first-run','--disable-extensions','--disable-background-networking'])
  for touch in ([False] if args.baseline else [False,True]):
   label='portrait-touch' if touch else 'desktop-keyboard'
   ctx=browser.new_context(viewport={'width':390 if touch else 1280,'height':844 if touch else 800},has_touch=touch,is_mobile=touch)
   p=ctx.new_page();p.on('pageerror',lambda e:report['pageErrors'].append(str(e)));p.on('requestfailed',lambda r:report['failedRequests'].append(r.url))
   p.on('request',lambda r:report['nonlocalRequests'].append(r.url) if not r.url.startswith(('http://127.0.0.1:','data:','blob:')) else None)
   p.goto(URL);p.wait_for_function('window.__REEF__');p.evaluate('__REEF__.profile.tutorial=1')
   check(label+' no autoplay before gesture',state(p)['audio']['context']=='not-started')
   if args.baseline:
    p.locator('[data-action="boat-launch"]').click();p.wait_for_timeout(350)
    snapshot=state(p);check('baseline boat launch leaves audio unstarted',snapshot['audio']['context']=='not-started',snapshot['audio'])
    check('baseline has no travel engine',not snapshot['audio'].get('boatMotor'));ctx.close();break
   if touch:p.touchscreen.tap(20,20)
   else:p.keyboard.press('Tab')
   p.wait_for_function('__REEF__.audio.ctx?.state==="running" && __REEF__.audio.ctx.currentTime>.5 && __REEF__.audio.step>=4')
   music=rms(p,'music');check(label+' menu music produces signal',music>1e-5,{'rms':music,'audio':state(p)['audio'],'time':p.evaluate('__REEF__.audio.ctx.currentTime')});p.screenshot(path=str(OUT/(label+'-menu.png')))
   p.locator('[data-action="boat-launch"]').click();p.wait_for_function('__REEF__.boat!==null && !__REEF__.paused');p.wait_for_function('__REEF__.audio.stats().boatMotor.active')
   idle=state(p)['audio']['boatMotor'];engine=rms(p,'effects');check(label+' boat idle produces signal',engine>1e-5,{'rms':engine,'motor':idle})
   if touch:
    cdp=ctx.new_cdp_session(p);box=p.locator('#joystick').bounding_box();point={'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'id':1}
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]});point['y']-=35;cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[point]})
   else:p.keyboard.down('w')
   p.wait_for_function('__REEF__.boat.speed>4');motor=state(p)['audio']['boatMotor'];check(label+' actual throttle raises engine pitch',motor['pitchHz']>idle['pitchHz']+5,motor)
   if touch:cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
   else:p.keyboard.up('w')
   p.screenshot(path=str(OUT/(label+'-boat.png')))
   p.evaluate('__REEF__.dispatch("screen","pause")');p.wait_for_function('__REEF__.paused');p.wait_for_timeout(400)
   check(label+' pause stops motor and effects',not state(p)['audio']['boatMotor']['active'] and rms(p,'effects')<1e-6)
   p.evaluate('__REEF__.dispatch("screen","settings")');slider=p.locator('[data-setting="effects"]');slider.focus();slider.press('Home');p.wait_for_timeout(200)
   check(label+' volume change stays silent while paused',p.evaluate('__REEF__.audio.effects.gain.value')<1e-6)
   p.evaluate('__REEF__.dispatch("boat-resume")');p.wait_for_timeout(200);check(label+' persisted effect mute stops motor',not state(p)['audio']['boatMotor']['active'])
   p.evaluate('__REEF__.dispatch("screen","settings")');slider=p.locator('[data-setting="effects"]');slider.focus();slider.press('End');p.evaluate('__REEF__.dispatch("boat-resume")');p.wait_for_function('__REEF__.audio.stats().boatMotor.active')
   # Actual application visibility handler with explicitly controlled document.hidden.
   p.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))');p.wait_for_timeout(450)
   check(label+' controlled hidden tab silences all buses',all(rms(p,b)<1e-6 for b in ['music','effects','ambience']) and not state(p)['audio']['boatMotor']['active'])
   p.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"))')
   check(label+' visibility return keeps gameplay paused',p.evaluate('__REEF__.paused'))
   p.evaluate('__REEF__.dispatch("boat-resume")');p.wait_for_function('__REEF__.audio.stats().boatMotor.active')
   p.evaluate('Object.assign(__REEF__.boat,{x:38,z:55,speed:0})');p.wait_for_function('!document.getElementById("boat-enter").disabled');p.locator('#boat-enter').click();p.wait_for_function('__REEF__.sim && !__REEF__.boat')
   if p.evaluate('__REEF__.paused'):p.locator('[data-action="resume"]').click()
   p.wait_for_timeout(150);check(label+' dive entry stops boat motor',not state(p)['audio']['boatMotor']['active']);check(label+' dive music continues',rms(p,'music')>1e-5)
   p.evaluate('__REEF__.dispatch("suspend")');p.wait_for_timeout(200);check(label+' suspended dive harbour music continues',state(p)['audio']['context']=='running' and rms(p,'music')>1e-5)
   p.evaluate('__REEF__.dispatch("screen","settings")')
   for bus in ['music','effects','ambience']:
    slider=p.locator(f'[data-setting="{bus}"]');slider.focus();slider.press('Home')
   p.reload();p.wait_for_function('window.__REEF__');p.keyboard.press('Tab');p.wait_for_function('__REEF__.audio.ctx?.state==="running"');p.wait_for_timeout(250)
   check(label+' reload preserves all zero volumes',all(p.evaluate(f'__REEF__.audio.settings.{bus}')==0 and rms(p,bus)<1e-6 for bus in ['music','effects','ambience']))
   check(label+' one context with fixed motor voices',p.evaluate('__REEF__.audio.stats().motor.voices===2 && __REEF__.audio.stats().boatMotor.voices===2'))
   ctx.close()
  if not args.baseline:
   ctx=browser.new_context();p=ctx.new_page();p.on('pageerror',lambda e:report['pageErrors'].append(str(e)));p.goto(URL.split('/games/')[0]+'/standalone.html?debug=1');p.wait_for_function('window.__REEF__');p.keyboard.press('Tab');p.wait_for_function('__REEF__.audio.ctx?.state==="running"');check('standalone embedded score produces music',rms(p,'music')>1e-5);ctx.close()
  check('no page errors',not report['pageErrors'],report['pageErrors']);check('no failed requests',not report['failedRequests'],report['failedRequests']);check('all runtime requests local',not report['nonlocalRequests'],report['nonlocalRequests']);browser.close()
finally:save();server.shutdown()
print(json.dumps({'checks':len(report['checks']),'pass':all(c['pass'] for c in report['checks']),'output':str(OUT)}))
