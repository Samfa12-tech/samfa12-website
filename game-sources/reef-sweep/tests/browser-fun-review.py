"""Player-facing response and workbench QA. Debug creates late-career/landed
fixtures and positions the diver; actions then use normal UI/keyboard/touch.
Not a human campaign or a physical-phone test.
"""
import json,os,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'qa-output'/'expedition'/'fun-review';OUT.mkdir(parents=True,exist_ok=True)
data={'scope':'Local Chrome touch emulation; fixtures establish career and positions, actual UI performs actions','checks':[],'errors':[]}
def check(name,value,detail=None):
 data['checks'].append({'name':name,'pass':bool(value),'detail':detail});(OUT/'fun-review.json').write_text(json.dumps(data,indent=2));assert value,(name,detail)
def fit(p,name):
 result=p.locator('.preparation-modal').evaluate('''e=>{const box=e.getBoundingClientRect();const items=[...e.querySelectorAll('canvas,button,.prep-instruction,#mini-cue,#fillet-cue,#fillet-feedback,.prep-meter,.fillet-steps')].filter(n=>n.getBoundingClientRect().height>0).map(n=>{const b=n.getBoundingClientRect();return {name:n.id||n.className||n.tagName,left:b.left,top:b.top,right:b.right,bottom:b.bottom}});return {items,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,fit:box.top>=0&&box.bottom<=innerHeight+.5&&items.every(b=>b.left>=0&&b.right<=innerWidth+.5&&b.top>=box.top&&b.bottom<=box.bottom+.5)}}''')
 check(name,result['fit'] and result['scrollHeight']<=result['clientHeight']+1,result)
def boot(browser,touch=False):
 ctx=browser.new_context(viewport={'width':1280,'height':800},has_touch=touch);p=ctx.new_page();p.on('pageerror',lambda e:data['errors'].append(str(e)));p.goto('http://127.0.0.1:4173/?debug=1');p.wait_for_function('window.__REEF__');p.add_style_tag(content='#debug-stats{display:none!important}');return ctx,p
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True,args=['--no-first-run','--disable-extensions','--disable-background-networking'])
 ctx,p=boot(browser,True)
 p.evaluate("__REEF__.profile.tutorial=1;__REEF__.dispatch('dive');let q=__REEF__,r=q.sim.run;r.cargo=[{id:'juvenile',size:.5,weight:.2,value:0},...[0,1,2,3].map(i=>({id:'adult'+i,size:1,weight:1,value:20}))];q.sim.finish(false);q.tick(.02)")
 check('default mixed allocation sells adults and keeps juvenile',p.locator('[data-allocate=sell]').input_value()=='4' and p.locator('[data-allocate=eat]').input_value()=='1')
 for screen in ['scaling','filleting','cooking']:
  p.evaluate("s=>__REEF__.dispatch('screen',s)",screen)
  for w,h in [(844,390),(667,375),(568,320),(740,320),(390,844)]:
   p.set_viewport_size({'width':w,'height':h});p.wait_for_timeout(120);fit(p,f'{screen} {w}x{h} whole activity fits')
   if (w,h)==(568,320):p.screenshot(path=str(OUT/(screen+'-568x320.png')))
  p.set_viewport_size({'width':844,'height':390});p.evaluate("__REEF__.dispatch('prep-return')")
 # Direct manipulation on the actual 3D board; pointer cancellation cannot score.
 p.locator('[data-screen=scaling]').click();p.wait_for_timeout(200);canvas=p.locator('#preparation-3d');b=canvas.bounding_box()
 p.mouse.move(b['x']+b['width']*.08,b['y']+b['height']*.5);p.mouse.down();p.mouse.move(b['x']+b['width']*.30,b['y']+b['height']*.5,steps=10);p.mouse.up()
 check('direct scaling pass saves once',p.evaluate('__REEF__.profile.pending.scalingPasses.length')==1)
 client=ctx.new_cdp_session(p);point={'id':1,'x':b['x']+b['width']*.5,'y':b['y']+b['height']*.5};client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]});client.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]});check('cancelled scaling drag never scores',p.evaluate('__REEF__.profile.pending.scalingPasses.length')==1)
 for target in [.56,.78]:
  p.wait_for_function('t=>performance.now()>__REEF__.ui.miniReady&&Math.abs(__REEF__.ui.miniPosition-t)<.035',arg=target,timeout=20000);p.locator('[data-action=mini-action]').click();p.wait_for_timeout(500)
 p.locator('[data-screen=filleting]').click();p.wait_for_timeout(200);b=p.locator('#preparation-3d').bounding_box();dest=1-(109-62)/236
 p.mouse.move(b['x']+b['width']*.5,b['y']+b['height']*.5);p.mouse.down();p.mouse.move(b['x']+b['width']*dest,b['y']+b['height']*.5,steps=10);p.mouse.up();check('direct 3D cut scores once',p.evaluate('__REEF__.profile.pending.filletCuts.length')==1);p.screenshot(path=str(OUT/'fillet-direct-action.png'))
 for target in [176,242]:
  p.wait_for_function('t=>performance.now()>__REEF__.ui.filletReadyAt&&Math.abs(__REEF__.ui.filletBladeX-t)<6',arg=target,timeout=12000);p.locator('[data-action=fillet-cut]').click()
 p.locator('[data-action=fillet-cancel]').click();p.locator('[data-screen=cooking]').click();p.wait_for_timeout(200);p.screenshot(path=str(OUT/'citrus-pan.png'))
 for target in [.30,.62,.46]:
  p.wait_for_function('t=>performance.now()>__REEF__.ui.miniReady&&Math.abs(__REEF__.ui.miniPosition-t)<.07',arg=target,timeout=12000);p.locator('#cooking-canvas').click()
 check('pan interaction completes real recipe',p.evaluate('__REEF__.profile.pending.cooking.complete'));p.locator('[data-close]').first.click();p.locator('#settle').click();check('mixed-size normal UI Kitchen reward',p.evaluate('__REEF__.ui.receipt.sales===80&&__REEF__.ui.receipt.contract===45'))
 # A separate meal fixture shows the alternate recipe without overwriting a meal.
 p.evaluate("let q=__REEF__;q.dispatch('dive');q.sim.run.cargo=[{id:'meal',weight:1,value:20}];q.sim.finish(false);q.tick(.02)");p.locator('[data-screen=cooking]').click();p.locator('[data-recipe=stew]').click();p.screenshot(path=str(OUT/'coconut-stew.png'))
 for target in [.65,.40,.75]:
  p.wait_for_function('t=>performance.now()>__REEF__.ui.miniReady&&Math.abs(__REEF__.ui.miniPosition-t)<.07',arg=target,timeout=20000);p.locator('[data-action=mini-action]').click();p.wait_for_timeout(500)
 check('alternate stew recipe completes',p.evaluate('__REEF__.profile.pending.cooking.recipe')=='stew');ctx.close()
 # Representative first-response introduction -> chart -> treatment -> safe return.
 ctx,p=boot(browser)
 p.evaluate("let q=__REEF__;q.profile.day=7;q.profile.tutorial=1;q.profile.reputation=20;q.profile.totalRemoved=18;q.dispatch('dive');q.sim.finish(false);q.tick(.02)")
 p.locator('#settle').click();p.locator('[data-screen=dock]').click();check('earned first response harbour briefing',p.evaluate('__REEF__.ui.moment?.id')=='outbreak-report');p.screenshot(path=str(OUT/'response-first-report.png'));p.locator('[data-close]').first.click();check('harbour keeps response site and bounty visible','Sunlit Gardens' in p.locator('.outbreak-report').inner_text())
 p.locator('[data-action=boat-launch]').click();p.wait_for_timeout(300)
 # Actual steering to the first buoy; no travel teleport in this sequence.
 p.evaluate('__REEF__.boat.yaw=Math.atan2(38,55)');p.keyboard.down('w');p.wait_for_function('Math.hypot(__REEF__.boat.x-38,__REEF__.boat.z-55)<18',timeout=30000);p.keyboard.up('w');p.keyboard.down('s');p.wait_for_function('__REEF__.boat.speed<2.5',timeout=10000);p.keyboard.up('s');p.wait_for_timeout(100)
 check('drive reaches correct buoy',p.locator('#boat-enter').is_enabled());p.locator('#boat-contract').select_option('none');p.locator('#boat-enter').click();check('first treatment field guide visible',p.evaluate('__REEF__.ui.moment?.id')=='outbreak-field-guide');p.screenshot(path=str(OUT/'response-field-guide.png'));p.locator('[data-close]').first.click()
 p.keyboard.press('j');p.wait_for_timeout(120);check('chart explains treatment marks','Amber triangles' in p.locator('.chart-layout').inner_text());p.screenshot(path=str(OUT/'response-chart.png'));p.locator('[data-close]').first.click()
 p.evaluate("let q=__REEF__,j=q.sim.run.jobs.find(j=>j.kind==='outbreak');q.teleport(j.p.x,j.p.y+.8,j.p.z-2.1);q.aimAt(j.p)");p.wait_for_timeout(150);p.screenshot(path=str(OUT/'response-target-recognition.png'))
 p.keyboard.down('e');p.wait_for_function("__REEF__.sim.run.jobs.find(j=>j.kind==='outbreak').stage===1",timeout=10000);p.screenshot(path=str(OUT/'response-positioned.png'));p.keyboard.up('e');p.wait_for_function("__REEF__.sim.run.jobs.find(j=>j.kind==='outbreak').stage===2",timeout=10000)
 # Look away, re-aim and choose spear; staged injector must stow.
 p.evaluate('__REEF__.sim.run.yaw+=1.5');p.wait_for_timeout(150);check('look away stows injector',p.evaluate('!__REEF__.renderer.injector.isEnabled()'));p.evaluate("__REEF__.aimAt(__REEF__.sim.run.jobs.find(j=>j.kind==='outbreak').p)")
 p.keyboard.down('r');p.wait_for_timeout(250);check('spear draw has coherent visible tool',p.evaluate('!__REEF__.renderer.injector.isEnabled()&&__REEF__.renderer.spear.isEnabled()'));p.keyboard.up('r');p.wait_for_timeout(200)
 p.keyboard.down('e');p.wait_for_function('__REEF__.sim.run.treated===1',timeout=10000);p.keyboard.up('e');p.wait_for_timeout(700);check('treated target remains as quiet completed silhouette',p.evaluate("__REEF__.renderer.jobMeshes.get(__REEF__.sim.run.jobs.find(j=>j.kind==='outbreak'&&j.done).id).isEnabled()"));p.screenshot(path=str(OUT/'response-completion.png'))
 p.evaluate("let q=__REEF__,s=q.sim;q.teleport(s.site.landmarks[0].p.x,s.site.surface+.2,s.site.landmarks[0].p.z)");p.keyboard.down('e');p.wait_for_function('__REEF__.ui.screen===\'debrief\'',timeout=10000);p.keyboard.up('e');check('debrief names treatment tally', '1 / 3 treated' in p.locator('.outbreak-report').inner_text());p.screenshot(path=str(OUT/'response-debrief.png'));p.locator('#settle').click();check('receipt separates treatment bounty',p.evaluate('__REEF__.ui.receipt.treatmentPay===14&&__REEF__.ui.receipt.treatments===1'));p.screenshot(path=str(OUT/'response-receipt.png'))
 p.reload();p.wait_for_function('window.__REEF__');check('reload remembers one treatment independently from rubbish',p.evaluate('__REEF__.profile.reefs.gardens.treatments.length===1&&__REEF__.profile.reefs.gardens.cleaned.length===0'))
 check('no page errors',not data['errors'],data['errors']);ctx.close();browser.close()
print(json.dumps({'checks':len(data['checks']),'errors':data['errors']}))


