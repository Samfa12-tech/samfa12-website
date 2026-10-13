"""Browser regression for input consumed on a render frame without a simulation tick.
Use --url for a served build; optionally compare against an original handoff ZIP.
"""
import os, json, argparse
from pathlib import Path
from zipfile import ZipFile
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://127.0.0.1:4173/')
parser.add_argument('--baseline-handoff')
args=parser.parse_args()
original=None
if args.baseline_handoff:
    with ZipFile(args.baseline_handoff) as archive:original=archive.read('reef-sweep/dist/game.js')
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_BIN'),headless=True,args=['--enable-unsafe-swiftshader'])
    for label in (['baseline','fixed'] if original else ['fixed']):
        page=browser.new_page(viewport={'width':900,'height':600})
        page.add_init_script('window._frames=[];window.requestAnimationFrame=fn=>{window._frames.push(fn);return window._frames.length}')
        if label=='baseline':page.route('**/game.js',lambda route:route.fulfill(body=original,content_type='text/javascript'))
        page.goto(args.url.rstrip('/')+'/?debug=1')
        page.locator('[data-action=dive]').click()
        first=page.evaluate('''()=>{window._step=t=>{const i=_frames.findIndex(fn=>fn.name==='frame');if(i<0)throw Error('Game frame callback not queued');_frames.splice(i,1)[0](t)};window._now=16.67;_step(_now);const a=__REEF__;a.sim.run.charge=1;a.input.lookX=80;a.input.release=true;window._yaw=a.sim.run.yaw;window._now+=.5;_step(_now);return {look:a.input.lookX,release:a.input.release,charge:a.sim.run.charge,yaw:a.sim.run.yaw-_yaw}}''')
        second=page.evaluate('''()=>{window._now+=17;_step(_now);return {look:__REEF__.input.lookX,release:__REEF__.input.release,charge:__REEF__.sim.run.charge,yaw:__REEF__.sim.run.yaw-_yaw}}''')
        if label=='baseline':passed=first['look']==0 and not first['release'] and second['charge']==1 and second['yaw']==0
        else:passed=first['look']==80 and first['release'] and second['charge']==0 and abs(second['yaw']-.2)<1e-6
        result={'build':label,'pass':passed,'noSimulationTick':first,'nextSimulationTick':second}
        results.append(result);print(json.dumps(result),flush=True);page.close()
    browser.close()
(Path(__file__).resolve().parents[1]/'docs/timing-test-results.json').write_text(json.dumps(results,indent=2))
if not all(r['pass'] for r in results):raise SystemExit(1)
