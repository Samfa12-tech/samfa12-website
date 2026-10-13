from playwright.sync_api import sync_playwright
from pathlib import Path
import json,re,traceback,os,shutil,argparse
parser=argparse.ArgumentParser()
parser.add_argument('--headless',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1];results=[];errors=[]
def check(n,c,d=''):
 results.append({'test':n,'pass':bool(c),'detail':d});print('PASS' if c else 'FAIL',n,d,flush=True)
mem="""window.REEF_TEST_MODE=true;window._saved=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>window._saved.get(k)||null,setItem:(k,v)=>window._saved.set(k,v),removeItem:k=>window._saved.delete(k),clear:()=>window._saved.clear(),key:i=>[...window._saved.keys()][i]||null,get length(){return window._saved.size}}});"""
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_BIN') or shutil.which('chromium'),headless=args.headless,args=['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1200,'height':760});page.on('pageerror',lambda e:errors.append(str(e)));requests=[];page.on('request',lambda req:requests.append(req.url))
 try:
  page.evaluate(mem);page.set_content((root/'Reef-Sweep.html').read_text(),wait_until='load',timeout=60000);page.wait_for_function('window.__REEF__ && !document.getElementById("loading").offsetParent',timeout=30000)
  check('Actual self-contained HTML boots',page.locator('[data-action=dive]').is_visible());check('Standalone starts Babylon 9.26.1',page.evaluate('BABYLON.Engine.Version')=='9.26.1');check('Standalone makes no network requests',len(requests)==0,str(requests[:3]));page.locator('[data-action=dive]').click();page.wait_for_timeout(1500)
  page.evaluate("document.getElementById('debug-stats').style.display='none'; __REEF__.teleport(3,5,-33);__REEF__.aimAt({x:2,y:3,z:-15});");page.wait_for_timeout(700);page.screenshot(path=str(root/'screenshots/02-first-dive.png'))
  stats=page.evaluate('__REEF__.audio.stats()');check('AudioContext runs after user start',stats['context']=='running',str(stats));check('Audio voices remain bounded',stats['voices']<=48)
  page.evaluate("window.fakePad={connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.fakePad]});__REEF__.input.settings.toggleDraw=true;__REEF__.input.previousPad=[];window.fakePad.buttons[7].pressed=true;window.frameOne=__REEF__.input.sample(1/60);window.fakePad.buttons[7].pressed=false;__REEF__.input.sample(1/60);window.fakePad.buttons[7].pressed=true;window.frameTwo=__REEF__.input.sample(1/60);")
  check('Virtual controller RT supports toggle-draw',page.evaluate('frameOne.draw && !frameTwo.draw && frameTwo.release'),'Synthetic Gamepad API object; not physical controller evidence')
  page.evaluate("__REEF__.input.clear();window.fakePad.connected=false;__REEF__.input.settings.toggleDraw=false;")
  page.evaluate("__REEF__.input.settings.keys.up='KeyR';__REEF__.input.keys.add('KeyR');window.rebound=__REEF__.input.sample(1/60);__REEF__.input.clear();")
  check('Rebinding R does not also draw spear',page.evaluate('rebound.vertical>0 && !rebound.draw'))
  check('Standalone has no runtime errors',not errors,str(errors[:2]));page.close()
 except Exception as e:check('Standalone release check completed',False,str(e));traceback.print_exc()
 editor=b.new_page(viewport={'width':1280,'height':800});ederrors=[];editor.on('pageerror',lambda e:ederrors.append(str(e)))
 try:
  editor.evaluate(mem);h=(root/'reference/Pocket-Chordsmith-v65.html').read_text();h=re.sub(r'<link[^>]*rel="(?:icon|apple-touch-icon)"[^>]*>','',h);editor.set_content(h,wait_until='load',timeout=60000);editor.wait_for_function('typeof importProject==="function"',timeout=15000)
  score=json.loads((root/'public/music/room-for-life.pcs.json').read_text());out=editor.evaluate('(score)=>{importProject(score);return exportProject();}',score)
  check('Music imports into supplied Pocket Chordsmith v65',out['projectVersion']==16 and out['bpm']==92 and out['key']=='G')
  check('Pocket Chordsmith roundtrip preserves A/B note grids',all(out['melodyTracks'+s]==score['melodyTracks'+s] and out['grid'+s]==score['grid'+s] and out['progression'+s]==score['progression'+s] for s in ['A','B']))
  check('Editor import raises no runtime errors',not ederrors,str(ederrors[:2]));editor.close()
 except Exception as e:check('Pocket Chordsmith integration check completed',False,str(e));traceback.print_exc()
 b.close()
(root/'docs/release-test-results.json').write_text(json.dumps({'environment':'Windows Chromium headless on local GPU; actual standalone HTML loaded through content injection with in-memory Storage. Virtual Gamepad is not hardware evidence.','results':results,'errors':errors},indent=2))
print('SUMMARY',sum(t['pass'] for t in results),'/',len(results))

if any(not r["pass"] for r in results) or errors: raise SystemExit(1)
