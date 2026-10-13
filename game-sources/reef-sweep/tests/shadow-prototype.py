import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
r=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ['CHROMIUM_BIN'],headless=True);page=b.new_page(viewport={'width':1280,'height':800});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.goto('http://localhost:8008/games/reef-sweep/play/?debug=1');page.locator('[data-action=dive]').click();page.wait_for_timeout(200)
 page.evaluate("const a=__REEF__;a.input.settings.quality='high';a.renderer.configure(a.input.settings);a.refresh();a.teleport(0,7,-28);a.aimAt({x:-5,y:2,z:-5})")
 page.wait_for_timeout(1200);page.screenshot(path=str(r/'reef-shadow-prototype.png'));print(json.dumps({'errors':errors,'stats':page.evaluate('__REEF__.renderer.stats()')}))
 b.close()
