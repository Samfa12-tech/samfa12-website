"""Muted catalogue regression checks against a local static server.

Set CHROMIUM_BIN to an existing Chromium executable and optionally set
CATALOGUE_TEST_ORIGIN (default http://127.0.0.1:8000). Requires Playwright.
"""
import json
import os
from pathlib import Path
import time
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
origin = os.environ.get('CATALOGUE_TEST_ORIGIN', 'http://127.0.0.1:8000').rstrip('/')
out = root / 'output/catalogue-fallback'
out.mkdir(parents=True, exist_ok=True)
projects = json.loads((root / 'data/projects.json').read_text(encoding='utf-8'))
checks = []


def check(name, condition):
    assert condition, name
    checks.append(name)


def cards(page):
    return page.locator('#project-grid .project-card').evaluate_all('''cards => cards.map(card => ({
      id:card.querySelector('.project-card-title-link')?.getAttribute('href') || card.querySelector('h3').textContent.trim(),
      title:card.querySelector('h3').textContent.trim(),
      links:Array.from(card.querySelectorAll('a[href]'),a=>a.getAttribute('href'))
    }))''')


def controls_ready(page):
    page.locator('#catalogue-controls').wait_for(state='visible', timeout=4000)


def steam(page):
    page.locator('#catalogue-controls').get_by_role('button', name='Steam', exact=True).click()


def all_cards(page):
    page.locator('#catalogue-controls').get_by_role('button', name='All', exact=True).click()


def selected(page):
    return (page.locator('#catalogue-controls [aria-pressed="true"]').get_attribute('data-filter-value'),
            page.locator('#catalogue-sort').input_value())


def title_key(card):
    title = card['title'].lower()
    return next((title[len(prefix):] for prefix in ('the ', 'a ', 'an ') if title.startswith(prefix)), title)


def exercise_filters(page, label, saved_nodes=False):
    before = cards(page)
    check(label + ': complete 29-card catalogue', len(before) == 29)
    expected_steam = {card['id'] for card in before if any('://store.steampowered.com/' in link for link in card['links'])}
    if saved_nodes:
        page.evaluate('window.__savedNodes = new Map(Array.from(document.querySelectorAll("#project-grid .project-card"), card=>[card.dataset.projectId,card]))')
    steam(page)
    check(label + ': Steam filter matches original links', {card['id'] for card in cards(page)} == expected_steam and len(expected_steam) > 0)
    page.locator('#catalogue-sort').select_option('title')
    visible = cards(page)
    check(label + ': alphabetical sort', [title_key(card) for card in visible] == sorted(title_key(card) for card in visible))
    page.locator('#catalogue-sort').select_option('label')
    check(label + ': platform sort retains matching cards', {card['id'] for card in cards(page)} == expected_steam)
    all_cards(page)
    page.locator('#catalogue-sort').select_option('curated')
    check(label + ': All/Curated restores exact cards, links and order', cards(page) == before)
    if saved_nodes:
        check(label + ': original DOM nodes preserved', page.evaluate('Array.from(document.querySelectorAll("#project-grid .project-card")).every(card=>window.__savedNodes.get(card.dataset.projectId)===card)'))


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ['CHROMIUM_BIN'],
        args=['--mute-audio', '--disable-background-networking'])
    for mode in ['blocked', 'http500', 'malformed', 'empty', 'wrong-shape', 'no-games', 'analytics-blocked', 'normal', 'stalled', 'delayed-recovery', 'empty-match-recovery']:
        context = browser.new_context(viewport={'width':1280, 'height':900})
        context.add_init_script('localStorage.setItem("samfa12:analytics-consent", "granted")')
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(origin + '/') else route.abort())
        held = []
        failed_analytics = []

        def project_request(route):
            if mode == 'blocked': route.abort()
            elif mode == 'http500': route.fulfill(status=500, body='Unavailable')
            elif mode in ('malformed', 'empty', 'wrong-shape', 'no-games'):
                body = {'malformed':'{broken', 'empty':'[]', 'wrong-shape':'{}',
                        'no-games':json.dumps([next(project for project in projects if project['category'] == 'Books')])}[mode]
                route.fulfill(status=200, content_type='application/json', body=body)
            elif mode in ('stalled', 'delayed-recovery', 'empty-match-recovery'): held.append(route)
            else: route.continue_()

        context.route('**/data/projects.json*', project_request)
        page = context.new_page()
        page.set_default_timeout(5000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('requestfailed', lambda request: failed_analytics.append(request.url) if 'clarity.ms' in request.url else None)
        started = time.monotonic()
        page.goto(origin + '/games/', wait_until='domcontentloaded')
        controls_ready(page)
        check(mode + ': controls available without waiting for JSON timeout', time.monotonic() - started < 5)

        if mode in ('stalled', 'delayed-recovery', 'empty-match-recovery'):
            steam(page)
            page.locator('#catalogue-sort').select_option('title')
            initial_ids = [card['id'] for card in cards(page)]
            check(mode + ': selection usable while request is pending', selected(page) == ('Steam', 'title') and bool(initial_ids))
            if mode == 'stalled':
                page.wait_for_function('document.querySelector("#data-status").textContent.includes("could not be loaded")', timeout=12000)
                check(mode + ': real eight-second timeout observed', time.monotonic() - started >= 7.8)
                check(mode + ': timeout preserves filter and sort', selected(page) == ('Steam', 'title') and [card['id'] for card in cards(page)] == initial_ids)
            elif mode == 'delayed-recovery':
                held[0].continue_()
                page.wait_for_function('!document.querySelector("#data-status").textContent.includes("Saved catalogue")')
                check(mode + ': successful fetch preserves selected filter/sort', selected(page) == ('Steam', 'title') and [card['id'] for card in cards(page)] == initial_ids)
            else:
                reef = next(project for project in projects if project.get('id') == 'game-reef-sweep')
                held[0].fulfill(status=200, content_type='application/json', body=json.dumps([reef]))
                page.wait_for_function('document.querySelector("#data-status").textContent.includes("No games match Steam")')
                check(mode + ': valid zero-match selection stays selected', selected(page) == ('Steam', 'title') and cards(page) == [])
                all_cards(page)
                check(mode + ': All recovers from empty results', [card['id'] for card in cards(page)] == ['/games/reef-sweep/'])
            if mode != 'empty-match-recovery':
                all_cards(page)
                page.locator('#catalogue-sort').select_option('curated')
                exercise_filters(page, mode, saved_nodes=mode == 'stalled')
        else:
            fallback = mode not in ('normal', 'analytics-blocked')
            if fallback:
                page.wait_for_function('document.querySelector("#data-status").textContent.includes("could not be loaded")')
                check(mode + ': saved-data warning and Retry are available', page.locator('#data-status').get_by_role('button', name='Retry', exact=True).is_visible())
            else:
                page.wait_for_function('!document.querySelector("#data-status").textContent.includes("Saved catalogue")')
            exercise_filters(page, mode, saved_nodes=fallback)
            if mode == 'analytics-blocked':
                check(mode + ': analytics rejection does not prevent filters', bool(failed_analytics))
            if mode == 'blocked':
                context.unroute('**/data/projects.json*')
                page.locator('#data-status').get_by_role('button', name='Retry', exact=True).click()
                controls_ready(page)
                page.wait_for_function('!document.querySelector("#data-status").textContent.includes("Saved catalogue")')
                check(mode + ': Retry recovers normal fetch', len(cards(page)) == 29)
            if mode == 'http500':
                page.set_viewport_size({'width':390, 'height':844})
                steam(page)
                check(mode + ': phone layout remains usable', page.evaluate('document.documentElement.scrollWidth <= innerWidth') and len(cards(page)) > 0)
                page.screenshot(path=str(out / 'games-fallback-phone.png'))
        check(mode + ': no uncaught JavaScript errors', not errors)
        if mode == 'stalled':
            for route in held:
                route.abort()
        print('Passed ' + mode, flush=True)
        context.close()

    # Books shares this control path: confirm its saved storefronts still work.
    context = browser.new_context()
    context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(origin + '/') else route.abort())
    context.route('**/data/projects.json*', lambda route: route.abort())
    page = context.new_page()
    page.goto(origin + '/books/')
    controls_ready(page)
    original = cards(page)
    page.locator('#catalogue-controls').get_by_role('button', name='Amazon', exact=True).click()
    check('Books: saved storefront filter works', len(cards(page)) > 0 and all(any('amazon.' in link for link in card['links']) for card in cards(page)))
    all_cards(page)
    check('Books: All restores cards and links', cards(page) == original)
    context.close()
    browser.close()

(out / 'results.json').write_text(json.dumps({'count':len(checks), 'checks':checks, 'muted':True,
    'cases':12, 'limitations':'Headless Chromium; school network/device not directly inspected.'}, indent=2), encoding='utf-8')
print(json.dumps({'passed':len(checks), 'cases':12}))
