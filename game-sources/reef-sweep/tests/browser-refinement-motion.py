"""Short portrait motion receipt: controlled two-fish placement, native touch holds."""
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parent.parent/'qa-output/refinements';OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
 c=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,record_video_dir=str(OUT/'video'),record_video_size={'width':390,'height':844})
 p=c.new_page();p.goto('http://127.0.0.1:4173/?debug=1');p.wait_for_function('window.__REEF__');p.add_style_tag(content='#debug-stats{display:none!important}')
 p.evaluate('''()=>{let q=__REEF__;q.profile.tutorial=1;q.dispatch('dive');let r=q.sim.run;r.fish.forEach(f=>f.alive=false);let a=r.fish[0],b=r.fish[1];a.alive=true;b.alive=true;r.p={x:0,y:8,z:-41};r.velocity={x:0,y:0,z:0};r.yaw=0;r.pitch=0;a.p=a.home={x:0,y:8,z:-39};b.p=b.home={x:3,y:8,z:-39};q.sim.strike(1);}''');p.wait_for_timeout(600)
 p.evaluate('''()=>{let q=__REEF__,r=q.sim.run,b=r.fish[1];r.strikeCooldown=0;b.p=b.home={x:r.p.x,y:r.p.y,z:r.p.z+2};r.yaw=0;r.pitch=0;q.sim.strike(1);}''');p.wait_for_timeout(700)
 client=c.new_cdp_session(p);box=p.locator('[data-touch="interact"]').bounding_box();point={'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'id':1}
 client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]});p.wait_for_function('__REEF__.sim.run.interaction>.34');client.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]});p.wait_for_timeout(850)
 assert p.evaluate('__REEF__.sim.run.cargo.length===0&&__REEF__.sim.run.skewered.length===1')
 client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]});p.wait_for_function('__REEF__.sim.run.cargo.length===2');client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});p.wait_for_function('!__REEF__.sim.run.transfer');p.wait_for_timeout(900)
 assert p.evaluate('__REEF__.renderer.tube.rotation.x>1.3&&__REEF__.sim.run.cargo.length===2')
 path=p.video.path();c.close();Path(path).replace(OUT/'portrait-collection.webm');b.close()
print('Portrait cancellation + two-catch insertion/withdrawal/stow video captured.')
