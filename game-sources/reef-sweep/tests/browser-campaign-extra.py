# Controlled browser QA fixtures; never a natural or physical-device playtest claim.
from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright
from urllib.parse import urlparse
candidate=os.environ.get('REEF_SWEEP_QA_URL','http://127.0.0.1:4173/').rstrip('/')+'/'
assert urlparse(candidate).hostname in ['localhost','127.0.0.1','::1'],'QA fixtures are restricted to loopback'
out=Path(os.environ.get('REEF_SWEEP_QA_OUT',str(Path(__file__).resolve().parent.parent/'qa-output')));checks=[];errors=[]
def check(name,value,detail=None):
 checks.append({'test':name,'pass':bool(value),'detail':detail})
 if not value:
  (out/'extra-failure.json').write_text(json.dumps(checks,indent=2));p.screenshot(path=str(out/'extra-failure.png'));raise AssertionError(name+' '+str(detail))
def raw(p,s):return p.evaluate(s)
def tick(p,t,inputs={}):raw(p,'__REEF__.tick('+json.dumps(t)+','+json.dumps(inputs)+')')
def boot(b,w=1280,h=800,touch=False):
 c=b.new_context(viewport={'width':w,'height':h},has_touch=touch,is_mobile=touch);p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(candidate+'?debug=1');p.wait_for_function('window.__REEF__');raw(p,"document.querySelector('#debug-stats').style.display='none';__REEF__.profile.campaign??={researchInvitationSeen:false,researchAccepted:false,researchCompleted:false,characterFlags:[],milestoneFlags:[]}");return c,p
out.mkdir(exist_ok=True,parents=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['CHROMIUM_BIN'],headless=True)
 c,p=boot(b);raw(p,"__REEF__.profile.totalRemoved=50;__REEF__.profile.tutorial=1;__REEF__.profile.campaign.characterFlags.push('passage-arrival');__REEF__.profile.day=6;__REEF__.ui.site='harbour';__REEF__.ui.order='none';__REEF__.dispatch('dive')")
 raw(p,"(()=>{const r=__REEF__.sim.run;const point={...r.jobs.find(j=>j.kind==='survey').p};r.fish.forEach(f=>f.alive=false);r.animals=[];r.encounter={kind:'fishing',phase:'warning',start:180,p:point,cleanProgress:0,rewarded:false};r.time=180;__REEF__.refresh()})()")
 tick(p,.05);check('Boat warning is audible/visible and lasts before gear descends',raw(p,"__REEF__.sim.run.cooldowns.boatWarned===1&&__REEF__.sim.run.encounter.phase==='warning'") and 'Fishing boat overhead' in p.locator('#toast').inner_text())
 tick(p,11);check('Warning remains for a full approach interval',raw(p,"__REEF__.sim.run.encounter.phase==='warning'"));tick(p,1.5);check('Gear appears after warning',raw(p,"__REEF__.sim.run.encounter.phase==='active'"))
 contact=raw(p,"(()=>{const r=__REEF__.sim.run,e=r.encounter;__REEF__.teleport(e.p.x,e.p.y,e.p.z);const before=r.air;__REEF__.tick(.05);return {before,after:r.air,contact:r.cooldowns.boatContact}})()");after=contact['after'];check('Fishing contact loses about 2 bar with a single cooldown',1.9<contact['before']-after<2.2,contact);tick(p,.1);check('Lingering cannot cause repeated snag damage',after-raw(p,'__REEF__.sim.run.air')<.2)
 raw(p,'__REEF__.save()');p.reload();p.wait_for_function('window.__REEF__');p.locator('[data-action=resume]').click();check('Active boat phase/contact cooldown survives reload',raw(p,"__REEF__.sim.run.encounter.phase==='active'&&__REEF__.sim.run.cooldowns.boatContact===1"));tick(p,21)
 raw(p,"(()=>{const e=__REEF__.sim.run.encounter;__REEF__.teleport(e.p.x,e.p.y,e.p.z-2);__REEF__.aimAt(e.p);__REEF__.sim.updateAim()})()");check('Abandoned gear is a valid aimed interaction',raw(p,"__REEF__.sim.aim.id==='boat-cleanup'&&__REEF__.sim.aim.valid"));tick(p,3.5,{'interact':True});check('Gear cleanup marks one recovery without permanent-job credit',raw(p,"__REEF__.sim.run.encounter.rewarded&&__REEF__.sim.run.encounter.phase==='cleared'&&__REEF__.sim.run.cleaned===0"));tick(p,8,{'interact':True});check('Repeated cleanup cannot duplicate recovery',raw(p,"__REEF__.sim.run.cleaned===0&&__REEF__.sim.run.encounter.rewarded"));p.screenshot(path=str(out/'boat-recovered.png'))
 raw(p,"__REEF__.sim.finish(false);__REEF__.dispatch('review');__REEF__.dispatch('settle')");check('One exact $5 recovery line settles',raw(p,'__REEF__.ui.receipt.boatPay===5'));cash=raw(p,'__REEF__.profile.cash');raw(p,"__REEF__.dispatch('settle')");check('Repeated settlement cannot pay again',raw(p,'__REEF__.profile.cash')==cash)
 raw(p,"__REEF__.dispatch('screen','dock');__REEF__.ui.site='harbour';__REEF__.dispatch('dive');(()=>{const r=__REEF__.sim.run;r.encounter={kind:'rubbish',phase:'warning',start:260,p:{...r.p},cleanProgress:0,rewarded:false};r.time=260})()");tick(p,.1);check('Boat avoids unavoidable close spawn',raw(p,"__REEF__.sim.run.encounter.phase==='passed'"));c.close()
 # Actual recognition settlements, explicit progression/clip fixtures.
 c,p=boot(b);raw(p,"__REEF__.profile.totalRemoved=50;__REEF__.profile.reputation=30;__REEF__.profile.audience=350;__REEF__.profile.tutorial=1;__REEF__.profile.campaign.characterFlags.push('passage-arrival')")
 for milestone,kind in [('recognition-80','turtle'),('recognition-160','cleanup'),('recognition-300','ray')]:
  raw(p,"__REEF__.dispatch('opportunity',"+json.dumps(milestone)+")");check('Assignment accepted '+milestone,raw(p,'__REEF__.profile.campaign.activeOpportunity')==milestone)
  if milestone=='recognition-300':raw(p,'__REEF__.profile.day++')
  raw(p,"__REEF__.ui.order='none';__REEF__.dispatch('dive');(()=>{const r=__REEF__.sim.run;r.clips=[{id:'qa-clip',kind:"+json.dumps(kind)+",title:'QA fixture',caption:'Explicit test fixture',quality:90}];"+("r.cleaned=1;__REEF__.profile.totalCleaned++;" if kind=='cleanup' else '')+"__REEF__.sim.finish(false)})()");raw(p,"__REEF__.dispatch('review');__REEF__.ui.chosen.add('qa-clip');__REEF__.dispatch('settle')")
  check('Assignment recognized at actual settlement without extra cash '+milestone,raw(p,"__REEF__.profile.campaign.milestoneFlags.includes("+json.dumps(milestone)+")&&__REEF__.ui.receipt.sponsor===0&&__REEF__.ui.receipt.recognition.length===1"));raw(p,"__REEF__.dispatch('screen','dock')")
  if raw(p,'__REEF__.ui.screen')=='moment':p.locator('[data-close]').last.click()
 c.close()
 # Browser Gamepad API input, not a claim about the physical USB controller.
 c,p=boot(b);raw(p,"window.qaPad={id:'QA standard pad',mapping:'standard',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[qaPad];__REEF__.dispatch('screen','settings')");p.wait_for_timeout(150)
 p.locator('[data-setting=effects]').focus();value=float(p.locator('[data-setting=effects]').input_value());raw(p,'qaPad.axes[0]=-1');p.wait_for_timeout(90);raw(p,'qaPad.axes[0]=0');check('Controller adjusts native settings range',float(p.locator('[data-setting=effects]').input_value())<value)
 raw(p,"__REEF__.dispatch('screen','dock')");p.wait_for_timeout(350);p.locator('#order-choice').focus();initial=p.locator('#order-choice').input_value();raw(p,'qaPad.axes[0]=1');p.wait_for_function('document.querySelector("#order-choice").value!=='+json.dumps(initial));raw(p,'qaPad.axes[0]=0');p.wait_for_timeout(100);check('Controller adjusts achievable contract selector',p.locator('#order-choice').input_value()!=initial)
 p.locator('[data-action=dive]').focus();raw(p,'qaPad.buttons[0]={pressed:true,value:1}');p.wait_for_timeout(120);raw(p,'qaPad.buttons[0]={pressed:false,value:0}');check('Controller begins from dock',raw(p,'!__REEF__.paused'))
 pos=raw(p,'({...__REEF__.sim.run.p})');yaw=raw(p,'__REEF__.sim.run.yaw');raw(p,'qaPad.axes=[.5,-.7,.6,.1]');p.wait_for_timeout(600);raw(p,'qaPad.axes=[0,0,0,0]');after=raw(p,'({p:__REEF__.sim.run.p,yaw:__REEF__.sim.run.yaw,paused:__REEF__.paused})');check('Controller moves and looks in real RAF frames',abs(after['p']['z']-pos['z'])>.1 and abs(after['yaw']-yaw)>.03,{'before':pos,'yaw':yaw,'after':after})
 raw(p,'qaPad.buttons[9]={pressed:true,value:1}');p.wait_for_timeout(100);raw(p,'qaPad.buttons[9]={pressed:false,value:0}');check('Controller pause clears interaction',raw(p,'__REEF__.paused&&__REEF__.sim.run.charge===0'));c.close()
 # Menus reserve space for messages; short/narrow screens scroll and wrap.
 for w,h in [(320,600),(390,844),(844,390)]:
  c,p=boot(b,w,h,True);raw(p,"__REEF__.dispatch('research-visit')");check('Unavailable research does not offer a premature invitation '+str(w),raw(p,"__REEF__.ui.screen==='dock'&&!__REEF__.profile.campaign.researchInvitationSeen"))
  check('Menu message occupies layout without overlay '+str(w),not p.locator('#toast').is_visible() and p.locator('#menu-message').is_visible());p.screenshot(path=str(out/('menu-'+str(w)+'x'+str(h)+'.png')))
  raw(p,"__REEF__.profile.reputation=8;__REEF__.dispatch('research-visit')");p.locator('[data-action=research-accept]').click();check('Phone character acceptance stays usable '+str(w),raw(p,'__REEF__.profile.campaign.researchAccepted'))
  p.locator('[data-action=dive]').click();p.wait_for_timeout(100);box=p.locator('[data-touch=spear]').bounding_box();cdp=c.new_cdp_session(p)
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'id':4}]});p.wait_for_timeout(100);check('Actual browser touch draws before cancellation '+str(w),raw(p,'__REEF__.sim.run.charge>0'))
  cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]});p.wait_for_timeout(100);check('Cancelled touch cannot leave draw/release stuck '+str(w),raw(p,'__REEF__.sim.run.charge===0'))
  c.close()
 # Shipping disabled tracker also remains silent in normal, non-debug play.
 c=b.new_context();p=c.new_page();requests=[];p.on('request',lambda r:requests.append(r.url));p.goto(candidate);p.locator('[data-action=dive]').click();p.wait_for_timeout(200);p.keyboard.press('Escape');p.locator('[data-action=resume]').click();p.wait_for_timeout(100);check('Shipping gameplay creates no analytics request',not any('/api/game-starts/' in u or 'clarity.ms' in u for u in requests));c.close()
 check('No runtime errors',not errors,errors);b.close()
(out/'extra-browser.json').write_text(json.dumps({'checks':checks,'errors':errors,'fixtures':True,'physicalDevices':False},indent=2)+'\n');print('PASS',len(checks),'additional browser checks')
