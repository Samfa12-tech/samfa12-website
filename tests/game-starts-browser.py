"""Headless loopback review only; uses an existing Playwright/browser installation."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
origin = 'http://127.0.0.1:8029'
out = root / 'output' / 'game-starts'
out.mkdir(parents=True, exist_ok=True)
fixture = (root / 'tests/fixtures/game-starts/stats.json').read_text()
checks = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ['CHROMIUM_BIN'])
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(origin) else route.abort())
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(origin + '/stats/')
    page.wait_for_function("document.querySelector('[data-game-start-stats]').textContent.includes('not enabled')")
    assert page.locator('[data-game-start-stats]').inner_text().find('not enabled') >= 0
    page.get_by_role('button', name='No thanks', exact=True).click()
    checks.append('Shipping Stats displays disabled state without invented zeros')
    page.locator('[aria-labelledby="game-starts-title"]').screenshot(path=str(out / 'stats-disabled.png'))
    page.route('**/data/game-start-stats.json', lambda route: route.fulfill(status=200, content_type='application/json', body=fixture))
    page.reload()
    page.get_by_text('LOCAL TEST FIXTURE', exact=False).wait_for()
    assert page.locator('[data-game-start-stats] table').count() == 2
    assert 'Unavailable' in page.locator('[data-game-start-stats]').inner_text()
    assert '17' in page.locator('[data-game-start-stats]').inner_text()
    checks.append('Fixture is labelled; complete week renders; missing week stays unavailable')
    page.locator('[aria-labelledby="game-starts-title"]').screenshot(path=str(out / 'stats-fixture-desktop.png'))
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    checks.append('390px Stats layout has no document overflow')
    page.locator('[aria-labelledby="game-starts-title"]').screenshot(path=str(out / 'stats-fixture-mobile.png'))
    page.route('**/data/game-start-stats.json', lambda route: route.fulfill(status=503, body='Unavailable'))
    page.reload()
    page.get_by_text('Start statistics are unavailable.', exact=False).wait_for()
    checks.append('Failed stats fetch is explicitly unavailable')
    page.unroute('**/data/game-start-stats.json')
    context.close()

    # Real browser -> actual loopback HTTP collector -> disposable SQLite, without game code.
    context = browser.new_context(viewport={'width': 1000, 'height': 700})
    context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(origin) else route.abort())
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(origin + '/stats/')
    result = page.evaluate("""async () => {
      const baseline = await (await fetch('/api/game-starts/v1/stats')).json();
      const prior = baseline.games.find(g => g.gameId === 'briarhold').daily.reduce((n,d)=>n+d.starts,0);
      const {createGameStartTracker} = await import('/assets/game-starts-client.js');
      const disabled = createGameStartTracker({gameId:'reef-sweep'});
      disabled.markReady(); const off = await disabled.start(); disabled.dispose();
      const denied = createGameStartTracker({gameId:'reef-sweep',enabled:true,endpoint:'/api/game-starts/v1/start'});
      denied.markReady(); const refusal = await denied.start();
      localStorage.setItem('samfa12:analytics-consent','granted'); denied.syncConsent();
      const retrospective = await denied.start(); denied.dispose();
      const tracker = createGameStartTracker({gameId:'briarhold',enabled:true,endpoint:'/api/game-starts/v1/start'});
      const notReady = await tracker.start(); tracker.markReady();
      const first = await tracker.start(), repeat = await tracker.start(); tracker.activity();
      const stats = await (await fetch('/api/game-starts/v1/stats')).json();
      tracker.dispose();
      return {off,refusal,retrospective,notReady,first,repeat,stats,prior};
    }""")
    assert result['off']['status'] == 'inactive'
    assert result['refusal']['status'] == 'consent-required'
    assert result['retrospective']['status'] == 'suppressed'
    assert result['notReady']['status'] == 'inactive'
    assert result['first']['status'] == 'accepted'
    briar = next(game for game in result['stats']['games'] if game['gameId'] == 'briarhold')
    assert sum(day['starts'] for day in briar['daily']) == result['prior'] + 1
    checks.append('Browser consent/readiness gates and actual local HTTP acceptance work')
    page.reload()
    page.evaluate("""async () => { const {createGameStartTracker} = await import('/assets/game-starts-client.js');
      const t = createGameStartTracker({gameId:'briarhold',enabled:true,endpoint:'/api/game-starts/v1/start'});
      t.markReady(); await t.start(); t.dispose(); }""")
    data = page.evaluate("async () => (await fetch('/api/game-starts/v1/stats')).json()")
    briar = next(game for game in data['games'] if game['gameId'] == 'briarhold')
    assert sum(day['starts'] for day in briar['daily']) == result['prior'] + 1
    assert 'eventId' not in json.dumps(data) and 'hash' not in json.dumps(data)
    checks.append('Real browser reload stays one start; public aggregate response has no receipts')
    assert not errors, errors
    checks.append('No page JavaScript errors')
    browser.close()

(out / 'browser-results.json').write_text(json.dumps({'checks': checks, 'passed': len(checks), 'fixtureOnly': True}, indent=2) + '\n')
print(json.dumps({'passed': len(checks), 'checks': checks}, indent=2))
