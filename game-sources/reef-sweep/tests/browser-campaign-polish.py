# Controlled browser QA fixtures; never a natural or physical-device playtest claim.
from pathlib import Path
import os,json,time,statistics
from playwright.sync_api import sync_playwright
from urllib.parse import urlparse
candidate=os.environ.get('REEF_SWEEP_QA_URL','http://127.0.0.1:4173/').rstrip('/')+'/'
assert urlparse(candidate).hostname in ['localhost','127.0.0.1','::1'],'QA fixtures are restricted to loopback'
out=Path(os.environ.get('REEF_SWEEP_QA_OUT',str(Path(__file__).resolve().parent.parent/'qa-output')));out.mkdir(exist_ok=True,parents=True)
checks=[];errors=[];notes=[]
def check(name,value,detail=None):
 checks.append({'test':name,'pass':bool(value),'detail':detail})
 if not value:
  debug={'checks':checks,'errors':errors}
  try:
   debug.update({'state':state(p),'panel':p.locator('#panel').inner_text(),'toast':p.locator('#toast').inner_text()});p.screenshot(path=str(out/'failure.png'))
  except Exception:pass
  (out/'failure.json').write_text(json.dumps(debug,indent=2)+'\n')
  raise AssertionError(name+' '+str(detail))
def raw(page,code):return page.evaluate(code)
def state(page):return json.loads(raw(page,'render_game_to_text()'))
def boot(browser,viewport={'width':1280,'height':800},touch=False):
 c=browser.new_context(viewport=viewport,has_touch=touch,is_mobile=touch);p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(candidate+'?debug=1');p.wait_for_function('window.__REEF__');raw(p,"document.getElementById('debug-stats').style.display='none'");return c,p
def tick(p,t,inputs={}):raw(p,'__REEF__.tick('+json.dumps(t)+','+json.dumps(inputs)+')')
def hunt(p,secure=True):
 # Controlled placement is explicit QA. Spearing/collection use the real simulation,
 # ray obstruction, native targets and drawn/release/interact actions.
 return raw(p,'''()=>{const reef=__REEF__,sim=reef.sim,r=sim.run,before=r.cargo.length;
 for(const fish of r.fish.filter(f=>f.alive))for(const [dx,dz] of [[0,-2],[2,0],[0,2],[-2,0],[1.4,-1.4],[-1.4,1.4]]){
  reef.teleport(fish.p.x+dx,fish.p.y,fish.p.z+dz);reef.aimAt(fish.p);sim.updateAim();if(sim.aim.kind!=='fish'||!sim.aim.valid)continue;
  reef.tick(1.1,{draw:true,steady:true});reef.aimAt(fish.p);reef.tick(.017,{release:true,steady:true});
  if(r.exposed){if('''+('true' if secure else 'false')+''')reef.tick(.9,{interact:true,steady:true});return {hit:true,secured:r.cargo.length>before,value:r.cargo.at(-1)?.value}};
 }return {hit:false,secured:false}}''')
def work(p,kind):
 return raw(p,'''()=>{const reef=__REEF__,s=reef.sim,r=s.run,j=r.jobs.find(j=>j.kind==='''+json.dumps(kind)+'''&&!j.done);if(!j)return {exists:false};
 for(const [dx,dz] of [[0,-2],[2,0],[0,2],[-2,0]]){reef.teleport(j.p.x+dx,j.p.y+.3,j.p.z+dz);reef.aimAt(j.p);s.updateAim();if(s.aim.id!==j.id)continue;reef.tick(4,{interact:true,steady:true});return {exists:true,done:j.done,progress:j.progress,aim:s.aim,id:j.id}}
 return {exists:true,done:false,id:j.id}}''')
def return_home(p):
 # Swim home through open surface water, using accelerated ordinary movement.
 raw(p,"__REEF__.sim.run.charge=0;__REEF__.sim.run.scooter=false")
 tick(p,40,{'vertical':1})
 for i in range(4):
  d=raw(p,'''()=>{const s=__REEF__.sim,r=s.run,h=s.site.landmarks[0].p;__REEF__.aimAt({x:h.x,y:r.p.y,z:h.z});return Math.hypot(r.p.x-h.x,r.p.z-h.z)}''')
  if d<4:break
  tick(p,d/2.2+.4,{'moveZ':1})
 tick(p,1.5,{'interact':True})
 check('Actual ascent/swim/boarding safely lands',state(p)['screen']=='debrief' and raw(p,'__REEF__.profile.pending && !__REEF__.profile.pending.rescued'))
def settle(p):
 raw(p,"__REEF__.dispatch('settle')");check('Settlement shows explicit full account',state(p)['screen']=='receipt' and 'Filleting bonus' in p.locator('#panel').inner_text() and 'Station readings' in p.locator('#panel').inner_text())
 raw(p,"__REEF__.dispatch('screen','dock')")
 if state(p)['screen']=='moment':p.locator('[data-close]').last.click()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['CHROMIUM_BIN'],headless=True)
 c,p=boot(b);check('Five sites and only achievable initial contracts',p.locator('.site-choice').count()==5 and p.locator('#order-choice option[value=research]').is_disabled())
 p.locator('[data-action=dive]').click();tick(p,30);check('Lesson does not advance on elapsed time',raw(p,'__REEF__.sim.run.lesson.step')==0)
 tick(p,.017,{'lookX':.3});tick(p,1.1,{'moveZ':1});check('Actual look and movement advance separate lessons',raw(p,'__REEF__.sim.run.lesson.step')==2)
 raw(p,'__REEF__.save()');p.reload();p.wait_for_function('window.__REEF__');p.locator('[data-action=resume]').click();check('Lesson survives saved-game reload',raw(p,'__REEF__.sim.run.lesson.step')==2)
 hit=hunt(p);check('Draw/release and manual collection advance lesson',hit['secured'] and raw(p,'__REEF__.sim.run.lesson.step')>=5,hit)
 done=work(p,'debris');check('First field task advances lesson',done['done'] and raw(p,'__REEF__.sim.run.lesson.step')==6,done)
 return_home(p);check('Boarding completes the action-driven lesson',raw(p,'__REEF__.profile.tutorial')==1)
 # Three cuts persist individually and grade a sale-only bonus; no reroll after preparation.
 raw(p,"__REEF__.dispatch('screen','filleting')");p.locator('[data-action=fillet-cut]').click();check('One cut is persisted',raw(p,'__REEF__.profile.pending.filletCuts.length')==1)
 raw(p,'__REEF__.save()');p.reload();p.wait_for_function('window.__REEF__');p.locator('[data-action=review]').click();raw(p,"__REEF__.dispatch('screen','filleting')");check('Partial filleting survives reload',raw(p,'__REEF__.ui.filletStage')==1)
 for i in range(2):p.wait_for_timeout(600);p.locator('[data-action=fillet-cut]').click()
 check('Result grade and exact sale uplift are visible','sale bonus' in p.locator('#panel').inner_text().lower() and raw(p,'__REEF__.profile.pending.filletQuality!==undefined'))
 quality=raw(p,'__REEF__.profile.pending.filletQuality');p.locator('[data-action=fillet-cancel]').click();raw(p,'__REEF__.dispatch("fillet",1)');check('Completed fillet cannot be replaced',raw(p,'__REEF__.profile.pending.filletQuality')==quality)
 p.screenshot(path=str(out/'fillet-debrief.png'));settle(p);check('First successful dive enables a modest upgrade',raw(p,'__REEF__.profile.cash')>=95)
 raw(p,"__REEF__.dispatch('buy','fins')");check('First fins purchase succeeds',raw(p,"__REEF__.profile.upgrades.includes('fins')"))
 raw(p,"__REEF__.dispatch('screen','dock')")
 if state(p)['screen']=='moment':p.locator('[data-close]').last.click()
 # Productive campaign progression, real strikes/work/boarding; placement is a fixture.
 history=[]
 for outing in range(4):
  raw(p,"__REEF__.ui.site='gardens';__REEF__.ui.order='catch';__REEF__.dispatch('dive')")
  for fish in range(4):check('Campaign manual hunt and secure',hunt(p)['secured'])
  work(p,'debris')
  if outing==1:work(p,'coral');work(p,'coral')
  return_home(p);settle(p);history.append(raw(p,'({day:__REEF__.profile.day,cash:__REEF__.profile.cash,reputation:__REEF__.profile.reputation,removed:__REEF__.profile.totalRemoved})'))
  if raw(p,'__REEF__.profile.reputation')>=8:break
 check('Productive loop reaches research threshold without a cash grant fixture',raw(p,'__REEF__.profile.reputation')>=8,history)
 if state(p)['screen']=='moment':p.locator('[data-close]').last.click()
 raw(p,"__REEF__.dispatch('research-visit')");check('University approach offers funded assignment',state(p)['screen']=='moment' and 'mira vale' in p.locator('#panel').inner_text().lower());p.screenshot(path=str(out/'university-invitation.png'));p.locator('[data-action=research-accept]').click();check('Research acceptance unlocks actual interaction',raw(p,'__REEF__.profile.campaign.researchAccepted'))
 raw(p,"__REEF__.ui.order='research';__REEF__.dispatch('dive')");check('Survey enabled only after acceptance',work(p,'survey')['done']);check('Second distinct survey records once',work(p,'survey')['done']);before=raw(p,'__REEF__.sim.run.surveyed');tick(p,4,{'interact':True});check('Holding completed survey cannot repeat rewards',raw(p,'__REEF__.sim.run.surveyed')==before)
 return_home(p);raw(p,"__REEF__.dispatch('settle')");check('First research settlement totals $65 inclusive',raw(p,'__REEF__.ui.receipt.surveyPay+__REEF__.ui.receipt.researchTopUp')==65);p.screenshot(path=str(out/'research-receipt.png'));raw(p,"__REEF__.dispatch('screen','dock')")
 if state(p)['screen']=='moment':p.locator('[data-close]').last.click()
 # Resume bug regression, including same-site preview, actual camera position and reload.
 raw(p,"__REEF__.ui.order='none';__REEF__.dispatch('dive')");tick(p,2,{'moveZ':1});raw(p,"__REEF__.dispatch('suspend');__REEF__.dispatch('site','passage');__REEF__.dispatch('resume')");p.wait_for_timeout(100)
 check('Resume rebinds simulation, camera and Gardens world after Passage preview',raw(p,"__REEF__.renderer.run===__REEF__.sim.run&&__REEF__.sim.run.site==='gardens'&&Math.abs(__REEF__.renderer.camera.position.x-__REEF__.sim.run.p.x)<.1"))
 raw(p,"__REEF__.dispatch('suspend');__REEF__.dispatch('site','gardens');__REEF__.dispatch('resume')");check('Same-site preview cannot leave a stale run',raw(p,'__REEF__.renderer.run===__REEF__.sim.run'))
 raw(p,'__REEF__.save()');p.reload();p.wait_for_function('window.__REEF__');p.locator('[data-action=resume]').click();check('Reloaded suspended world also matches the active run',raw(p,'__REEF__.renderer.run===__REEF__.sim.run'))
 # Reward-free replay is isolated, even while a real outing is suspended.
 raw(p,"__REEF__.dispatch('suspend')");career=raw(p,'JSON.stringify(__REEF__.profile)');raw(p,"__REEF__.dispatch('practice')");hunt(p);work(p,'debris');raw(p,"__REEF__.dispatch('practice-exit')");check('Replay changes no campaign/save contents',raw(p,'JSON.stringify(__REEF__.profile)')==career)
 # Independent save-slot event registration is retained only for its specific day.
 raw(p,"__REEF__.dispatch('slot',2);__REEF__.profile.day=3;__REEF__.save();__REEF__.dispatch('event-toggle')");p.reload();p.wait_for_function('window.__REEF__');check('Pre-launch event registration survives reload',raw(p,'__REEF__.ui.event&&__REEF__.profile.eventRegistrationDay===3'))
 raw(p,"__REEF__.dispatch('slot',3)");check('Event registration does not leak into another slot',not raw(p,'__REEF__.ui.event'));raw(p,"__REEF__.dispatch('slot',2);__REEF__.dispatch('dive')");check('Registered outing has visible event objective/score',raw(p,'__REEF__.sim.run.event&&__REEF__.sim.run.eventTheme==="catch"'));p.wait_for_timeout(150);check('Event score visible during the dive','points' in p.locator('#campaign-progress').inner_text());c.close()
 # Controlled high/night/encounter fixtures are separate from earned progression above.
 c,p=boot(b);raw(p,"__REEF__.profile.cash=100000;__REEF__.profile.totalRemoved=50;__REEF__.profile.reputation=30;__REEF__.profile.tutorial=1;__REEF__.dispatch('research-visit')");p.locator('[data-action=research-accept]').click()
 for gear in ['air','air','torch','scooter']:raw(p,"__REEF__.dispatch('buy',"+json.dumps(gear)+")")
 raw(p,"__REEF__.dispatch('setting',{name:'quality',value:'high'});__REEF__.dispatch('screen','dock')")
 for site in ['gardens','passage','mangrove','cenote','harbour']:
  raw(p,"__REEF__.ui.site="+json.dumps(site)+";__REEF__.ui.order='none';__REEF__.ui.night=true;__REEF__.dispatch('dive')")
  if state(p)['screen']=='moment':p.locator('[data-close]').last.click()
  p.wait_for_timeout(150);check('Night '+site+' has correct world, torch and High depth maps',raw(p,'__REEF__.sim.run.night&&__REEF__.sim.run.light&&__REEF__.renderer.run===__REEF__.sim.run') and state(p)['renderer']['shadows']['sunResolution']==2048 and state(p)['renderer']['shadows']['torchResolution']==1024)
  home=raw(p,"(()=>{const s=__REEF__.sim,a=s.run.animals.find(a=>a.id==='shark');return {y:a.home.y,ground:s.run.jobs.find(j=>j.id==='survey-1').p.y}})()");check('Night shark home is finite for '+site,home['y']> -100)
  raw(p,"__REEF__.dispatch('watch')");p.wait_for_timeout(120);check('Night watch remains readable in '+site,state(p)['renderer']['watchRaised']);p.screenshot(path=str(out/('night-'+site+'.png')))
  raw(p,"__REEF__.dispatch('watch')");p.keyboard.press('l');check('Torch can switch off in '+site,not raw(p,'__REEF__.sim.run.light'));p.keyboard.press('l')
  return_home(p);settle(p)
 # Actual motor responds to real thrust and goes silent on all tested transitions.
 raw(p,"__REEF__.ui.night=false;__REEF__.ui.site='gardens';__REEF__.ui.order='none';__REEF__.dispatch('dive')");p.keyboard.press('q');p.wait_for_function('JSON.parse(render_game_to_text()).audio.motor.active');idle=state(p)['audio']['motor'];p.keyboard.down('w');p.wait_for_function('JSON.parse(render_game_to_text()).audio.motor.thrust>.5');thrust=state(p)['audio']['motor'];p.keyboard.up('w');check('Scooter motor responds to real thrust',idle['active'] and thrust['pitchHz']>idle['pitchHz'],{'idle':idle,'thrust':thrust})
 p.keyboard.press('Escape');check('Scooter motor stops on pause',not state(p)['audio']['motor']['active']);p.locator('[data-action=resume]').click();p.keyboard.press('q');p.wait_for_timeout(100);check('Scooter motor stops on stow',not state(p)['audio']['motor']['active']);p.keyboard.press('q');raw(p,'__REEF__.sim.run.battery=0');p.wait_for_timeout(150);check('Scooter motor stops on depleted battery',not state(p)['audio']['motor']['active']);c.close()
 # Portrait/landscape overlays and touch targets, actual touch pointer cancellation.
 for size in [(320,600),(390,844),(844,390)]:
  c,p=boot(b,{'width':size[0],'height':size[1]},True);p.locator('[data-action=dive]').click();p.wait_for_timeout(150)
  check('Readable tutorial and 44px touch targets '+str(size),p.locator('#lesson-skip').bounding_box()['height']>=44 and all(p.locator('[data-touch="'+a+'"]').bounding_box()['width']>=44 for a in ['spear','interact','up','down']))
  p.locator('#watch-button').click();p.wait_for_timeout(150);check('Wrist view hides optional objective overlay '+str(size),not p.locator('#campaign-objective').is_visible());p.screenshot(path=str(out/('phone-'+str(size[0])+'x'+str(size[1])+'.png')))
  p.set_viewport_size({'width':size[1],'height':size[0]});p.set_viewport_size({'width':size[0],'height':size[1]});check('Rotation retains active play '+str(size),state(p)['screen']=='dive');c.close()
 check('No runtime errors',not errors,errors);b.close()
report={'version':'0.4.0-preview.1','checks':checks,'errors':errors,'progressionHistory':history,'placementFixtures':True,'acceleratedSimulationActions':True,'physicalDevices':False,'transmissionEnabled':False}
(out/'browser.json').write_text(json.dumps(report,indent=2)+'\n');print('PASS',len(checks),'browser campaign checks. Placements/accelerated actions are explicit fixtures; physical device feel remains manual.')
