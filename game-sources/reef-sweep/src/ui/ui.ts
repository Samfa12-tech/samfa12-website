import { CookingView } from '../render/cooking.js';
import { outbreakPlan, allocateCatch } from '../game/expedition.js';
import { clearedDebris } from '../game/data.js';
import { PreparationView } from '../render/preparation.js';
import { BAY_SITES, travelCosts, CHARMS, RECIPES, type BoatState } from '../game/expedition.js';
import { fullscreenAvailable, wavedashHost } from '../host.js';
import { layoutChartLabels } from './chart-labels.js';
import { contractOptions } from '../game/campaign.js';
import { lessonActive, lessonPrompt } from '../game/tutorial.js';
import { momentView, careerView, eventView, contractNote, eventNote, receiptView, upgradeNumbers, filletResult, type CharacterMoment } from './campaign-ui.js';
import type { Profile, Run, Settings, SiteId, Action } from '../game/types.js';
import { SITES, UPGRADES, siteUnlocked, siteUnlockText, healthOfReef, capacity, airCapacity, upgradeLevel, upgradeCost, upgradeServiceRequirement, MAX_UPGRADE_LEVEL, siteForRun } from '../game/data.js';
import { money, timeText, clamp, distance } from '../game/math.js';
import type { Simulation, Settlement } from '../game/simulation.js';
import { recoveryFromProgress } from '../game/reef-recovery.js';
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const key = (s: string) => s.replace('Key', '').replace('Left', '').replace('Mouse0', 'Mouse 1');
const orderText = { none: 'Explore at your own pace. No contract bonus is promised.', catch: 'The Sandbar Kitchen · Land and sell 4 fish for a $45 order bonus.', cleanup: 'Lantern Bay Trust · Remove 2 pieces of fishing gear for a $40 contract bonus.', restore: 'Coral Commons · Plant 2 nursery-grown fragments for a $45 contract bonus.', research: 'Lantern Bay Field Archive · Survey 2 different field stations. First assignment: $65 by day / $72 at night, including station pay. Later Monitoring: $38 / $45.' };
function reefRecoveryText(p: Profile, site: SiteId) { const stage = recoveryFromProgress(p.reefs[site]); return stage === 0 ? 'Reef life returns between productive visits. Revisit over 3–5 outings to see more fish.' : stage < 5 ? 'Fish are returning between visits. Each productive outing helps the reef grow livelier.' : 'Fish and reef life are returning between visits. Keep revisiting to see the change.'; }
const upgradeIcon = (id: string) => {
    const drawings: Record<string, string> = {
        fins: '<path d="M15 37c4-10 3-19 2-25 7 4 13 12 14 23M28 40c5-9 11-14 18-16-1 9-6 17-15 21"/><path d="M11 40c7 3 13 3 20 0M29 45c6 2 12 1 17-2"/>',
        tube: '<path d="M20 10h16l3 6v25l-4 5H21l-4-5V16z"/><path d="M19 18h18M19 38h18M24 10V6h8v4"/><circle cx="28" cy="28" r="5"/>',
        spear: '<path d="m14 42 27-28M34 12l9-3-3 9M11 45l6-1-4-5"/><path d="m20 36 5 5M26 30l5 5M32 24l5 5"/>',
        scooter: '<path d="M10 29h29l7 5-7 5H10z"/><path d="M18 29v-6h12l5 6M17 39v5M39 39v5"/><circle cx="17" cy="46" r="2"/><circle cx="39" cy="46" r="2"/><path d="M47 25c3 2 3 6 0 8M51 22c5 4 5 11 0 15"/>',
        air: '<rect x="20" y="12" width="16" height="34" rx="6"/><path d="M24 12V8h8v4M20 20h16M20 38h16M36 16h6v7"/><circle cx="43" cy="13" r="5"/><path d="M43 13l2-2"/>',
        camera: '<rect x="9" y="18" width="38" height="26" rx="5"/><path d="m18 18 3-5h13l4 5M40 23h3"/><circle cx="28" cy="31" r="9"/><circle cx="28" cy="31" r="4"/>',
        kit: '<path d="M28 44V20M28 29l-9-7M28 34l10-8M28 25l7-8M19 22l-1-7M18 15l-5 2M38 26l5-5M43 21l5 2M35 17l1-6"/><path d="M14 45h28"/><circle cx="18" cy="15" r="2"/><circle cx="36" cy="11" r="2"/>',
        battery: '<rect x="14" y="16" width="28" height="32" rx="4"/><path d="M23 11h10v5M23 28h10M28 23v10M20 39h16"/><path d="m31 21-7 10h6l-3 8 9-12h-6z"/>',
        torch: '<path d="M21 10h14l5 7-4 5H20l-4-5z"/><path d="M22 22v12l6 7 6-7V22M28 41v5M23 47h10"/><path d="M18 17h20"/><path d="M13 8l-4-3M43 8l4-3M28 5V2"/>'
    };
    return `<svg viewBox="0 0 56 56" focusable="false" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${drawings[id] ?? ''}</g></svg>`;
};
export type Screen = 'dock' | 'gear' | 'help' | 'journal' | 'pause' | 'settings' | 'saves' | 'events' | 'debrief' | 'filleting' | 'receipt' | 'confirm' | 'moment' | 'performance' | 'boat-pause' | 'scaling' | 'cooking';
/** DOM views only. Economic and ecological rules remain in the simulation. */
export class UI {
    preparation:PreparationView|null=null;
    recipe: keyof typeof RECIPES='citrus';
    cookingView:CookingView|null=null;directPrepUntil=0;miniScores:number[]=[]; miniStarted=0;miniPosition=0;miniReady=0;
    screen: Screen = 'dock';
    moment: CharacterMoment|null=null;
    filletReadyAt=0;
    back: Screen = 'dock';
    site: SiteId = 'gardens';
    order: Run['order'] = 'catch';
    event = false;
    night = false;
    toastTimer = 0;
    filletFrame = 0;
    filletStarted = 0;
    filletStage = 0;
    filletScores: number[] = [];
    filletBladeX = 64;
    receipt: Settlement | null = null;
    binding: Action | null = null;
    chosen = new Set<string>();
    allocation = { sell: 0, eat: 0, donate: 0 };
    confirmAction = '';
    confirmText = '';
    controllerInventory = '';
    qualityReloadPending = false;
    controllerReadout: any = { pads: [], selectedKey: null, connected: false, rawAxes: [], rawButtons: [], saved: false, calibration: { phase: 'idle', prompt: '', step: 0, total: 19, completed: false }, scanning: true };
    panel = document.getElementById('panel')!;
    hud = document.getElementById('hud')!;
    constructor(public getProfile: () => Profile, public getSettings: () => Settings, public dispatch: (action: string, data?: any) => void) {
        this.panel.addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!b || b.disabled)
            return; if (b.dataset.close !== undefined) {
            this.dispatch('close');
            return;
        } if (b.dataset.screen) {
            const next = b.dataset.screen as Screen;
            if (this.screen !== 'settings')
                this.back = this.screen;
            this.dispatch('screen', next);
            return;
        } if (b.dataset.site) {
            this.dispatch('site', b.dataset.site);
            return;
        } if (b.dataset.buy) {
            this.dispatch('buy', b.dataset.buy);
            return;
        } if (b.dataset.bind) {
            this.binding = b.dataset.bind as Action;
            b.textContent = 'Press a key…';
            return;
        } if (b.dataset.clip) {
            const id = b.dataset.clip;
            if (this.chosen.has(id))
                this.chosen.delete(id);
            else if (this.chosen.size < 2)
                this.chosen.add(id);
            else {
                this.toast('Choose up to two highlights. Deselect one first.');
                return;
            }
            this.refreshClips();
            return;
        } if(b.dataset.recipe){this.recipe=b.dataset.recipe as keyof typeof RECIPES;this.show('cooking');return;}
        if(b.dataset.action==='mini-action'){this.miniAction();return;}
        if (b.dataset.action === 'fillet-cut') {
            this.tryFilletCut();
            return;
        } if (b.dataset.action === 'fillet-cancel') {
            this.dispatch('prep-return');
            return;
        } if (b.dataset.action)
            this.dispatch(b.dataset.action, b.dataset.value); });
        this.panel.addEventListener('change', e => { const el = e.target as HTMLInputElement; if (el.id === 'order-choice') {
            this.order = el.value as Run['order'];
            document.getElementById('order-detail')!.textContent = orderText[this.order];
        } if (el.dataset.night !== undefined) {
            this.night = el.checked;
        } if (el.id === 'gamepad-choice') {
            this.dispatch('gamepad-select', el.value || null);
        } if (el.dataset.setting) {
            const name = el.dataset.setting;
            const value = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
            this.dispatch('setting', { name, value });
        } if (el.dataset.allocate) {
            const n = this.getProfile().pending?.rescued ? 0 : this.getProfile().pending?.cargo.length || 0;
            const max=el.dataset.allocate==='sell'?this.getProfile().pending?.cargo.filter(c=>c.value>0).length??0:n;
            this.allocation[el.dataset.allocate as 'sell'] = clamp(Math.floor(Number(el.value) || 0), 0, max);
            el.value = String(this.allocation[el.dataset.allocate as 'sell']);
            this.updateAllocation();
        } });
        this.panel.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (el.type === 'range' && el.dataset.setting) {
            const value = Number(el.value), read = document.getElementById('read-' + el.dataset.setting);
            if (read)
                read.textContent = el.dataset.setting === 'fov' ? `${value}°` : el.dataset.setting === 'sensitivity' ? value.toFixed(2) : Math.round(value * 100) + '%';
            this.dispatch('setting', { name: el.dataset.setting, value });
        } });
        document.addEventListener('keydown', e => { if(e.code==='Enter'&&!e.repeat&&!(e.target as HTMLElement)?.matches('input,select,textarea,button')){if(this.screen==='filleting'){e.preventDefault();this.tryFilletCut();return;}if(['scaling','cooking'].includes(this.screen)){e.preventDefault();this.miniAction();return;}} if (this.binding) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (e.code !== 'Escape')
                this.dispatch('binding', { action: this.binding, code: e.code });
            this.binding = null;
            this.show('settings');
            return;
        } if (e.key === 'Tab' && !this.panel.hidden) {
            const a = Array.from(this.panel.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,a[href]')).filter(x => x.offsetParent !== null);
            if (!a.length)
                return;
            const idx = a.indexOf(document.activeElement as HTMLElement);
            if (e.shiftKey && idx <= 0) {
                e.preventDefault();
                a.at(-1)!.focus();
            }
            else if (!e.shiftKey && (idx === a.length - 1 || idx < 0)) {
                e.preventDefault();
                a[0].focus();
            }
        } }, true);
        document.getElementById('clear-mask')!.onclick = () => this.dispatch('clear-mask');
        document.getElementById('pause-button')!.onclick = () => this.dispatch('screen', 'pause');
        document.getElementById('chart-button')!.onclick = () => this.dispatch('screen', 'journal');
        document.getElementById('watch-button')!.onclick = () => this.dispatch('watch');
        document.getElementById('fullscreen-button')!.onclick = () => this.dispatch('fullscreen');
    }
    updateControllerStatus(status: any) {
        this.controllerReadout = status;
        if (this.screen !== 'settings') return;
        const select = document.getElementById('gamepad-choice') as HTMLSelectElement | null;
        const inventory = status.pads.map((p: any) => p.key).join('|');
        if (select && inventory !== this.controllerInventory) {
            const hadFocus = document.activeElement === select;
            select.innerHTML = status.pads.length ? status.pads.map((p: any) => `<option value="${esc(p.key)}">Gamepad ${p.index + 1} · ${esc(p.id)} · ${esc(p.mapping)} · ${p.axes.length} axes / ${p.buttons.length} buttons</option>`).join('') : '<option value="">No controller detected</option>';
            if (status.selectedKey) select.value = status.selectedKey;
            this.controllerInventory = inventory;
            if (hadFocus) select.focus({ preventScroll: true });
        }
        const statusEl = document.getElementById('gamepad-status'), rawEl = document.getElementById('gamepad-raw'), stepEl = document.getElementById('gamepad-step'), testEl = document.getElementById('gamepad-test');
        if (statusEl) statusEl.textContent = status.connected ? `${status.pads.find((p: any) => p.key === status.selectedKey)?.id || 'Controller'} · ${status.pads.find((p: any) => p.key === status.selectedKey)?.mapping || 'raw'} · ${status.pads.find((p: any) => p.key === status.selectedKey)?.axes.length ?? 0} axes / ${status.pads.find((p: any) => p.key === status.selectedKey)?.buttons.length ?? 0} buttons · ${status.saved ? 'saved calibration active' : status.preset ? 'known Backbone USB preset active' : 'standard fallback active'}` : 'Waiting for a controller. Click Scan after plugging it in, then press any controller button if the browser needs a wake gesture.';
        if (rawEl) rawEl.textContent = `Axes: [${status.rawAxes.map((v: number, i: number) => `${i}:${v.toFixed(2)}`).join('  ')}]\nButtons: [${status.rawButtons.map((v: number, i: number) => `${i}:${v.toFixed(2)}`).join('  ')}]`;
        if (stepEl) stepEl.textContent = status.calibration.phase === 'idle' ? '' : `${status.calibration.step}/${status.calibration.total} · ${status.calibration.prompt}`;
        if (testEl) testEl.textContent = `Live test · ${status.test}`;
        const start = document.getElementById('gamepad-start') as HTMLButtonElement | null, use = document.getElementById('gamepad-use') as HTMLButtonElement | null;
        const cancel = document.getElementById('gamepad-cancel') as HTMLButtonElement | null, restore = document.getElementById('gamepad-restore') as HTMLButtonElement | null;
        if (start) start.disabled = !status.connected || status.calibration.phase !== 'idle';
        if (use) use.hidden = !status.calibration.completed;
        if (cancel) cancel.hidden = status.calibration.phase === 'idle';
        if (restore) restore.disabled = !status.connected || !status.saved;
    }
    header(title: string, eyebrow = 'REEF SWEEP / LANTERN BAY') { return `<div class="modal-header"><div><div class="eyebrow">${eyebrow}</div><h2>${title}</h2></div><button class="close" data-close aria-label="Close">×</button></div>`; }
    updateFullscreenState(active: boolean) { const available = fullscreenAvailable(document, document.documentElement, wavedashHost(location.href, document.referrer) || typeof (globalThis as any).Wavedash?.init==='function'); for (const control of document.querySelectorAll<HTMLElement>('[data-fullscreen-label],#fullscreen-button')) control.hidden = !available; for (const button of document.querySelectorAll<HTMLElement>('[data-fullscreen-label]')) { button.textContent = active ? 'Exit full screen' : 'Full screen'; button.setAttribute('aria-label', active ? 'Exit full screen' : 'Enter full screen'); button.title = active ? 'Exit full screen' : 'Enter full screen'; } const hud = document.getElementById('fullscreen-button'); if (hud) { hud.textContent = active ? '×' : '⛶'; hud.setAttribute('aria-label', active ? 'Exit full screen' : 'Enter full screen'); hud.title = active ? 'Exit full screen' : 'Enter full screen'; } }
    show(screen: Screen) {
        this.preparation?.dispose();this.preparation=null;this.cookingView?.dispose();this.cookingView=null;
        this.stopFilleting();
        this.screen = screen;
        document.getElementById('toast')!.classList.remove('visible');
        document.body.classList.remove('game');
        this.hud.hidden = true;
        this.panel.hidden = false;
        document.getElementById('menu-backdrop')!.hidden = false;
        const p = this.getProfile(), s = this.getSettings();
        this.event=p.eventRegistrationDay===p.day;
        document.body.classList.toggle('story-recognised',!!p.campaign?.milestoneFlags.length);
        if(screen==='dock'&&!p.active&&!p.pending&&!contractOptions(p,this.site).find(o=>o.kind===this.order)?.available)this.order=contractOptions(p,this.site).find(o=>o.available&&o.kind!=='none')?.kind ?? 'none';
        let html = '';
        switch (screen) {
            case 'boat-pause': html=`<section class="modal narrow">${this.header('At the helm.','BOAT PAUSED')}<p>The boat and ocean are paused.</p><div class="button-row"><button class="primary" data-action="boat-resume">Continue voyage</button><button data-action="boat-harbour">Return to harbour</button></div></section>`;break;
            case 'scaling':case 'cooking':html=this.miniView(p,screen);break;
            case 'performance': html = `<section class="modal narrow">${this.header('A smoother dive?')}<p>Frame rate has stayed low during active diving. Try a lower graphics preset? Your progress is saved.</p><div class="button-row"><button class="primary" data-action="performance-apply">Apply</button><button data-action="performance-dismiss">Not now</button></div><p class="tiny muted">You can change graphics in Settings. This suggestion will not repeat.</p></section>`; break;
            case 'dock':
                html = this.dock(p);
                break;
            case 'gear':
                html = `<section class="modal">${this.header('A little further.', 'EQUIPMENT / ' + money(p.cash) + ' AVAILABLE')}<p class="muted tiny">Grow your kit one careful upgrade at a time. Every improvement is permanent, and the loan gear always gets you back in the water.</p><div class="gear-grid" style="margin-top:18px">${UPGRADES.map(u => this.gearCard(u, p)).join('')}</div>${p.active ? '<p class="status-note">Finish the suspended outing before changing equipment.</p>' : ''}${p.pending ? '<p class="status-note">Settle the last outing before changing equipment.</p>' : ''}</section>`;
                break;
            case 'help':
                html = this.help(s);
                break;
            case 'pause':
                html = `<section class="modal narrow">${this.header('Take a breath.', 'DIVE PAUSED')}<p class="muted">Your air, wildlife and work are paused.</p><div class="button-row"><button class="primary" data-action="resume">Back to the reef</button><button data-screen="journal">Chart & field notes</button><button data-screen="settings">Settings</button><button data-screen="help">How to dive</button><button data-action="fullscreen" data-fullscreen-label>Full screen</button></div><div class="rule"></div><p class="tiny muted">Save and return to the harbour without ending this outing. Resume from this position later.</p><div class="button-row"><button data-action="suspend">Suspend dive</button><button class="danger" data-action="rescue-confirm">Request rescue</button></div><p class="tiny muted" style="margin-top:15px">A rescue forfeits this outing’s catch and costs $85. Completed conservation work remains.</p></section>`;
                break;
            case 'settings':
                html = this.settings(s);
                break;
            case 'journal':
                html = this.journal(p);
                break;
            case 'saves':
                html = `<section class="modal narrow">${this.header('Your logbooks.', 'THREE LOCAL SAVE SLOTS')}<p class="tiny muted">Saved in this browser on this device. Export a backup before clearing browser data or changing hosts.</p><div id="slots"></div><div class="button-row"><button data-action="export">Export current save</button><button data-action="import">Import JSON backup</button></div><div class="rule"></div><button class="link-button danger" data-action="reset-confirm">Start this slot again</button></section>`;
                break;
            case 'moment':html=this.moment?momentView(this.moment):this.dock(p);break;
            case 'events':html=eventView(p,this.site,this.event);break;
            case 'debrief':
                html = this.debrief(p);
                break;
            case 'filleting':
                html = this.filleting(p);
                break;
            case 'receipt':html=this.receipt?receiptView(p,this.receipt):this.dock(p);break;
            case 'confirm':
                html = `<section class="modal narrow">${this.header('Just checking.')}<p class="muted">${esc(this.confirmText)}</p><div class="button-row"><button class="danger" data-action="${this.confirmAction}">Confirm</button><button data-close>Cancel</button></div></section>`;
                break;
        }
        this.panel.innerHTML = html;
        if(screen === 'settings') this.panel.querySelector('.modal')?.insertAdjacentHTML('beforeend','<p class="tiny muted">No sound on iPhone? Check the media volume and Silent Mode, then tap a control to start audio.</p>');
        if(screen==='gear')this.panel.querySelector('.modal')?.insertAdjacentHTML('beforeend',`<h3>Found keepsakes</h3><p class="tiny muted">A small, quietly moving charm beneath the spear grip.</p><div class="button-row"><button data-action="charm-equip" data-value="">Unclip charm</button>${CHARMS.filter(c=>p.charms?.includes(c.id)).map(c=>`<button data-action="charm-equip" data-value="${c.id}" aria-pressed="${p.equippedCharm===c.id}">${c.name}</button>`).join('')}</div>`);
        if(screen==='gear')for(const button of this.panel.querySelectorAll<HTMLElement>('[data-buy]'))button.insertAdjacentHTML('beforebegin',`<p class="tiny upgrade-benefit">${esc(upgradeNumbers(p,button.dataset.buy!))}</p>`);
        if(screen==='pause'&&p.active){this.panel.querySelector('.button-row')?.insertAdjacentHTML('beforeend',p.active.practice?'<button data-action="practice-exit">End practice</button>':lessonActive(p.active)?'<button data-action="tutorial-skip">Skip tutorial</button>':'');}
        if (screen === 'settings' && this.qualityReloadPending) this.panel.querySelector('[data-setting="quality"]')?.closest('.setting')?.insertAdjacentHTML('afterend', '<div class="quality-reload-note" role="status"><p>High graphics saved. Reload to apply full reef detail and shadows.</p><div class="button-row"><button class="primary" data-action="quality-reload">Reload now</button><button data-action="quality-later">Later</button></div></div>');
        if (screen === 'dock') {
            this.panel.querySelector('.launch-row')?.insertAdjacentHTML('beforebegin', this.nightControl(p));
            const orderSelect = this.panel.querySelector<HTMLSelectElement>('#order-choice');
            const offers=contractOptions(p,this.site),labels={catch:'Kitchen · Sell 4 fish',cleanup:'Cleanup · Remove 2 pieces of gear',restore:'Restoration · Plant 2 fragments',research:'Research · Read 2 stations',none:'Free exploration · No contract'};
            if(orderSelect)orderSelect.innerHTML=offers.map(o=>`<option value="${o.kind}" ${this.order===o.kind?'selected':''} ${o.available?'':'disabled'}>${labels[o.kind]}${o.available?'':' — unavailable'}</option>`).join('');
            const unavailable=offers.filter(o=>!o.available);
            this.panel.querySelector('.dock-card')?.insertAdjacentHTML('beforeend',`${unavailable.length?`<details class="offer-notes"><summary>Why some offers are unavailable</summary>${unavailable.map(o=>`<p class="tiny">${labels[o.kind]}: ${esc(o.reason)}</p>`).join('')}</details>`:''}${careerView(p)}`);
            if(p.day%3===0)this.panel.querySelector('.dock-card')?.insertAdjacentHTML('afterbegin',`<p class="event-banner">Lantern Bay Sweep today · ${this.event?'Registered':'Register in Events'} · safe return needed</p>`);
        }
        if(screen==='debrief')this.panel.querySelector('.modal')?.insertAdjacentHTML('beforeend','<p id="fillet-sale-bonus" class="status-note"></p>');
        if (screen === 'help')this.panel.querySelector('.button-row')?.insertAdjacentHTML('afterbegin','<button data-action="practice">Replay first-dive practice</button>');
        if (screen === 'help')
            this.panel.querySelector('.help-copy .two-col>div')?.insertAdjacentHTML('beforeend', '<p><b>Research contract:</b> record surveys at the shallow reef and one deep wreck or pipe field station.</p>');
        this.panel.setAttribute('aria-label', screen === 'dock' ? 'Harbour' : 'Game ' + screen);
        if (screen !== 'dock')
            this.panel.setAttribute('role', 'dialog');
        else
            this.panel.removeAttribute('role');
        if (screen === 'debrief') {
            this.refreshClips();
            this.updateAllocation();
        }
        if (screen === 'filleting')this.startFilleting();
        if(screen==='scaling'||screen==='cooking')this.startMini(screen);
        this.updateFullscreenState(!!document.fullscreenElement || !!(document as any).webkitFullscreenElement);
        requestAnimationFrame(() => (screen === 'filleting' ? this.panel.querySelector<HTMLElement>('[data-action="fillet-cut"]') : this.panel.querySelector<HTMLElement>('button:not(:disabled),select'))?.focus({ preventScroll: true }));
    }
    dock(p: Profile) { const site = SITES[this.site],response=outbreakPlan(p); return `<header class="topbar"><div class="wordmark">Reef Sweep<span>DIVING CO.</span></div><nav class="toplinks" aria-label="Harbour"><span class="wallet"><strong>${money(p.cash)}</strong> Day ${p.day} · ${p.audience} followers</span><button data-screen="gear">Equipment</button><button data-screen="events">Events${p.day % 3 === 0 ? ' •' : ''}</button><button data-screen="settings" aria-label="Settings">⚙</button><button data-screen="saves" aria-label="Save slots">Saves</button><button data-action="fullscreen" data-fullscreen-label aria-label="Enter full screen">Full screen</button></nav></header><div class="dock-main"><section class="hero"><div class="eyebrow overline">A SAMFA12 GAME · LANTERN BAY</div><h1>A little room<br>for <em>life.</em></h1><p>Follow the light. Learn the reef.<br>Build a diving company that leaves<br>something better behind.</p><div class="hero-progress"><div><strong>${p.totalRemoved}</strong><span>lionfish removed</span></div><div><strong>${p.totalRestored}</strong><span>fragments planted</span></div><div><strong>${p.reputation}</strong><span>reputation</span></div></div><button class="link-button" data-screen="help" style="margin-top:18px;font-size:12px">Your first dive? Start here ↗</button></section><section class="dock-card"><div class="eyebrow">THE NEXT OUTING</div>${response?`<p class="outbreak-report"><b>Trust field response · ${esc(SITES[response.site].name)}</b><br>${response.remaining?`${response.remaining} marked crown-of-thorns targets remaining · $14 + 1 reputation each`:`This response area is complete. Thank you for the careful work.`}<br><span class="tiny">Optional alongside your usual contract. Next area in ${response.daysLeft} days. Amber triangles on the chart.</span></p>`:''}<h2>The bay is waiting.</h2><p class="tiny muted">Take the helm, follow the navigation chart and stop beside a gold buoy to choose your dive.</p><div class="site-selector">${Object.values(SITES).map((t, index) => `<button class="site-choice ${this.site === t.id ? 'selected' : ''}" data-site="${t.id}" ${!siteUnlocked(p, t.id) ? 'disabled' : ''}><span class="micro">${String(index + 1).padStart(2, '0')} / ${esc(t.label ?? t.name)}</span><strong>${esc(t.name)}</strong><span class="tiny">${siteUnlocked(p, t.id) ? esc(t.shortDescription ?? t.description) : esc(siteUnlockText(p, t.id))}</span></button>`).join('')}</div><p class="site-copy">${esc(site.description)}</p><p class="tiny muted">Towing ${BAY_SITES[this.site].towKm} km · sea route ${BAY_SITES[this.site].seaKm} km · fuel from $${travelCosts(this.site).tow+travelCosts(this.site).boat}</p><p class="recovery-note">${reefRecoveryText(p, this.site)}</p><div class="reef-strip"><span>Reef condition</span><strong>${healthOfReef(p, this.site)} / 100</strong></div><div class="meter"><i style="width:${healthOfReef(p, this.site)}%"></i></div><label class="field" for="order-choice">Take a field contract</label><select id="order-choice" ${p.active || p.pending ? 'disabled' : ''}><option value="catch" ${this.order === 'catch' ? 'selected' : ''}>Restaurant · Sell 4 lionfish</option><option value="cleanup" ${this.order === 'cleanup' ? 'selected' : ''}>Cleanup · Remove 2 pieces of gear</option><option value="restore" ${this.order === 'restore' ? 'selected' : ''}>Restoration · Plant 2 fragments</option></select><p id="order-detail" class="contract-note">${orderText[this.order]}</p><div class="launch-row"><button class="primary" data-action="${p.pending ? 'review' : p.active ? 'resume' : 'boat-launch'}">${p.pending ? 'Review landed catch' : p.active ? 'Resume suspended dive' : 'Take the helm'} <span aria-hidden="true">↗</span></button><button data-screen="journal" title="Reef chart">Chart</button></div><p class="status-note">${p.pending ? 'Your last outing is ready to settle.' : p.active ? 'Saved mid-dive. Air and wildlife have been paused.' : this.event ? 'Event entered · Land safely to record your score.' : 'Air filled · Nursery fragments stocked · Pole spear ready'}</p></section></div><footer class="bottomline"><span>Reef Sweep · v0.5 expedition preview · Local saves</span><button class="link-button" data-screen="help" style="font-size:10px">Credits & controls</button></footer>`; }
    nightControl(p: Profile) { const available = upgradeLevel(p, 'torch') >= 1 && siteUnlocked(p, 'passage'), lockedReason = upgradeLevel(p, 'torch') < 1 ? 'Regulator level 2 → fit a head torch → unlock Tideglass Passage.' : 'Unlock Tideglass Passage to open night dives.'; return `<label class="night-option"><span><strong>Night dive</strong><small>${available ? 'Challenge conditions · torch and wildlife adapt to the dark.' : lockedReason}</small></span><input type="checkbox" aria-label="Night dive" data-night ${this.night ? 'checked' : ''} ${available && !p.active && !p.pending ? '' : 'disabled'}></label>`; }
    gearCard(u: typeof UPGRADES[number], p: Profile) { const level = upgradeLevel(p, u.id), maxed = level >= MAX_UPGRADE_LEVEL, cost = upgradeCost(p, u.id), blockedBy = u.requires && upgradeLevel(p, u.requires) < (u.requiredLevel ?? 1), prerequisiteName = u.requires ? UPGRADES.find(item => item.id === u.requires)?.name || u.requires : '', requirement = u.requires === 'air' ? `Regulator level ${u.requiredLevel ?? 1} needed` : `${prerequisiteName} needed`, service=upgradeServiceRequirement(p,u.id), disabled = !service.available || maxed || p.cash < cost || !!p.active || !!p.pending || !!blockedBy; return `<article class="gear-card"><div class="gear-art" aria-hidden="true">${upgradeIcon(u.id)}</div><div class="eyebrow">${u.tag}</div><h3>${u.name}</h3><div class="gear-rank">Level ${level} <span>/ ${MAX_UPGRADE_LEVEL}</span></div><p>${u.description}</p>${!service.available?`<p class="tiny status-note">${esc(service.reason)}</p>`:""}<div class="price"><strong>${maxed ? 'MAX LEVEL' : money(cost)}</strong><button data-buy="${u.id}" ${disabled ? 'disabled' : ''}>${maxed ? 'Maxed' : blockedBy ? requirement : `Upgrade to ${level + 1}`}</button></div></article>`; }
    help(s: Settings) { return `<section class="modal help-copy">${this.header('Work gently. Come home.', 'DIVER’S FIELD GUIDE')}<p><b>Find the striped, fan-finned lionfish.</b> Move close, settle your aim, hold to draw the pole spear and release to strike. A fish stays exposed until you hold Interact to secure it in your tube.</p><div class="control-sheet"><div><b>Keyboard & mouse</b><p>${key(s.keys.forward)}${key(s.keys.left)}${key(s.keys.back)}${key(s.keys.right)} swim · mouse look<br>${key(s.keys.up)} ascend · ${key(s.keys.down)} descend<br>${key(s.keys.boost)} stronger fin kick · ${key(s.keys.steady)} steady<br>Mouse 1 draw / release · ${key(s.keys.interact)} hold to interact<br>${key(s.keys.scooter)} scooter · ${key(s.keys.light)} light · ${key(s.keys.journal)} chart · ${key(s.keys.watch)} raise/lower watch · Esc pause</p></div><div><b>Touch & controller</b><p>Touch (portrait or landscape): left stick moves; drag the scene to look. Hold and drag Draw to aim, then release. Hold Interact to secure catches or work. Use the Watch button in the upper HUD to check your instruments.<br>Controller: sticks move / look. Click the left stick for the dive computer by default. Button meanings vary by browser and device; open Settings → Controller calibration to see live readings and set your own map. The standard browser layout has a ready-to-use fallback.</p></div></div><p>Aim with the centre reticle. Hold Mouse 1 to draw, then release to strike. This also requests mouse capture. If capture is unavailable, simply move the mouse over the scene to look without holding a button. Left-hold still draws while aiming; right-drag also looks. Hold <b>R</b> as an alternate spear input. Uncaptured look is bounded by the browser window. Releasing or cancelling a pointer outside the canvas will not leave the controls stuck.</p><div class="rule"></div><div class="two-col"><div><h3>A living reef</h3><p><b>Cleanup:</b> hold Interact near discarded nets or crates.<br><b>Restore:</b> plant nursery-grown fragments at the marked nursery plots. Growth happens between game days.<br><b>Survey:</b> record the site at the teal survey sign. The chart marks all work areas.</p><p><b>Field response:</b> after sustained reef work the Trust reports a crown-of-thorns outbreak in one area. Amber triangles mark purple many-armed spiny targets; ordinary orange five-arm stars stay part of the scenery. Approach with your catch secured, hold Interact to position the injector, release the safety, then hold to press the plunger. You can stop and resume, switch back to spear or scooter, or ignore the optional response. Each treatment is logged once.</p><p><b>Marlow:</b> this grouper may watch, approach and then steal an exposed fish. Secure it or move away. Your tube is safe.<br><b>Moray:</b> give its crevice room. If it moves towards you and a warning appears, back away.</p></div><div><h3>Leave a reserve</h3><p>The home marker points towards the mooring. Return to it, ascend alongside the rope, and hold Interact to board. The chart shows a route around major rocks.</p><p>Rescue costs $85 and forfeits the day’s catch, but equipment and completed reef work remain. Loan gear is always available. Pause or suspend at any time.</p><p>After the dive, sell, keep a meal or donate. Choose two highlight <b>image cards</b> to publish. They represent footage in the fiction; this build does not record playable video.</p></div></div><div class="rule"></div><h3>Inspiration, not instruction.</h3><p>Inspired by the underwater storytelling and conservation work of <b>Lionfish Extermination Corp</b>; art and loop inspiration from <b>Dave the Diver</b>. This is an independent fictional game, not affiliated with or endorsed by either. Marlow, the companies and the island are fictional. Music is an original composition using <b>Samfa12’s Pocket Chordsmith</b> instruments.</p><p>Lionfish are native in the Indo-Pacific and invasive in the Atlantic/Caribbean setting used here. Do not feed wild predators. Morays normally open their mouths to breathe; mouth opening alone is not a warning. Coral recovery is time-compressed. Air, ascent, currents, handling and restoration are simplified gameplay—not dive training, medical advice or permission to undertake real restoration.</p><p class="tiny">Babylon.js 9.26.1 · Apache-2.0. Original procedural art and game code. Source details and third-party notices are included in the handoff package.</p><div class="button-row"><button class="primary" data-close>Ready for the reef</button><button data-screen="settings">Adjust controls</button></div></section>`; }
    gamepadSettings() {
        const state = this.controllerReadout, selected = state.selectedKey || '';
        const options = state.pads.length ? state.pads.map((p: any) => `<option value="${esc(p.key)}" ${p.key === selected ? 'selected' : ''}>Gamepad ${p.index + 1} · ${esc(p.id)} · ${esc(p.mapping)} · ${p.axes.length} axes / ${p.buttons.length} buttons</option>`).join('') : '<option value="">No controller detected</option>';
        return `<div class="settings-section">CONTROLLER CALIBRATION</div><p class="tiny muted">Select the USB controller the game should use. Scan and calibration require a click; the controller profile stays in this browser on this device.</p><label class="setting">Active controller<select id="gamepad-choice">${options}</select></label><p id="gamepad-status" class="tiny muted" aria-live="polite"></p><pre id="gamepad-raw" class="gamepad-raw" aria-label="Live raw controller axes and buttons">Waiting for controller readings…</pre><p id="gamepad-step" class="status-note" aria-live="polite"></p><p id="gamepad-test" class="tiny muted" aria-live="polite">Live test · Connect a controller to test it.</p><div class="button-row controller-actions"><button data-action="gamepad-scan">Scan controllers</button><button id="gamepad-start" data-action="gamepad-start" ${state.connected && state.calibration.phase === 'idle' ? '' : 'disabled'}>Start guided calibration</button><button id="gamepad-cancel" data-action="gamepad-cancel" ${state.calibration.phase === 'idle' ? 'hidden' : ''}>Cancel setup</button><button id="gamepad-use" class="primary" data-action="gamepad-use" ${state.calibration.completed ? '' : 'hidden'}>Use this calibration</button><button id="gamepad-restore" data-action="gamepad-restore" ${state.connected && state.saved ? '' : 'disabled'}>Restore controller defaults</button></div><p class="tiny muted">Keep still for the neutral sample. Move each stick when prompted, then release it. For each action, press or move only that control and release before the next prompt. Trigger axes are supported. Resume your dive only after selecting Use or Cancel.</p>`;
    }
    settings(s: Settings) { const slider = (id: keyof Settings, label: string, min: number, max: number, step: number) => `<label class="setting">${label}<span id="read-${id}" class="tiny muted">${id === 'fov' ? s[id] + '°' : id === 'sensitivity' ? Number(s[id]).toFixed(2) : Math.round(Number(s[id]) * 100) + '%'}</span><input aria-label="${label}" data-setting="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${s[id]}"></label>`; const check = (id: keyof Settings, label: string, detail: string) => `<label class="setting"><span>${label}<small>${detail}</small></span><input type="checkbox" data-setting="${id}" ${(id === 'instrumentHud' ? s.instrumentHud !== false : s[id]) ? 'checked' : ''}></label>`; return `<section class="modal">${this.header('Make yourself comfortable.', 'SETTINGS')}<div class="two-col"><div><div class="settings-section">SOUND</div>${slider('music', 'Pocket Chordsmith music', 0, 1, .01)}${slider('ambience', 'Breathing & ambience', 0, 1, .01)}${slider('effects', 'Equipment & warnings', 0, 1, .01)}<div class="settings-section">WATER & DISPLAY</div><label class="setting">Render quality<select data-setting="quality"><option value="high" ${s.quality === 'high' ? 'selected' : ''}>High</option><option value="balanced" ${s.quality === 'balanced' ? 'selected' : ''}>Balanced</option><option value="low" ${s.quality === 'low' ? 'selected' : ''}>Performance</option></select></label><p class="tiny muted">Resolution changes immediately; decorative population changes on the next site load. Targets, wildlife and rules are unchanged.</p>${slider('fov', 'Field of view', 60, 100, 1)}${check('reducedMotion', 'Steady camera & reduced motion', 'Suppresses equipment sway and coral animation.')}${check('assist', 'Target identification', 'Names visible targets in the aiming reticle.')}${check('instrumentHud', 'Show air and timer HUD', 'Keeps air and elapsed time in view while the wrist computer is lowered.')}</div><div><div class="settings-section">CONTROLS</div>${slider('sensitivity', 'Look sensitivity', .25, 2.5, .05)}${check('invertY', 'Invert vertical look', 'Mouse, touch and controller.')}${check('toggleDraw', 'Toggle spear draw', 'Press once to draw; press again to strike.')}${slider('touchScale', 'Touch control size', .8, 1.3, .05)}<div class="settings-section">KEY BINDINGS · SELECT TO REASSIGN</div><div class="bindings">${(['forward', 'back', 'left', 'right', 'up', 'down', 'boost', 'steady', 'interact', 'scooter', 'journal', 'light', 'watch'] as Action[]).map(a => `<div class="bind"><span>${a}</span><button data-bind="${a}">${key(s.keys[a])}</button></div>`).join('')}</div><button class="link-button tiny" data-action="defaults" style="margin-top:12px">Restore default settings</button>${this.gamepadSettings()}</div></div><div class="button-row"><button class="primary" data-close>Done</button><button data-action="fullscreen" data-fullscreen-label>Full screen</button></div></section>`; }
    journal(p: Profile) { const run = p.active || p.pending, id = run?.site || this.site, site = run?siteForRun(run):SITES[id], reef = p.reefs[id]; return `<section class="modal">${this.header(site.name, 'CHART / FIELD NOTES')}<div class="chart-layout"><div><canvas id="chart" width="660" height="660" class="chart" aria-label="Top-down reef chart: home buoy, player, obstacles, work sites and return route"></canvas><p class="tiny muted" style="margin-top:8px">Gold: you · cream: mooring · teal: work sites<br>Amber triangles: marked crown-of-thorns targets; rings: treated<br>Line: estimated return route · North is up</p></div><div><div class="reef-strip"><span>Reef condition</span><strong>${healthOfReef(p, id)} / 100</strong></div><div class="meter"><i style="width:${healthOfReef(p, id)}%"></i></div><div class="row-stats"><div><strong>${reef.removed.length}</strong>removals recorded</div><div><strong>${clearedDebris(p,id)}</strong>cleanup sites</div><div><strong>${Object.keys(reef.restored).length}</strong>coral plots</div></div><p class="recovery-note">${reefRecoveryText(p, id)}</p>${run ? `<div class="field-note"><b>Your contract</b><p>${orderText[run.order]}</p><p>This outing: ${run.removed} removed · ${run.cleaned} cleaned · ${run.restored} planted · ${run.surveyed} surveyed · ${run.fragments} fragments left. ${esc(contractNote(run))}</p></div>` : ''}<div class="field-note"><b>The nursery</b><p>Plant fragments at gold-tagged plots, remove nearby rubbish and record a survey. Revisit on later days to see growth.</p></div><div class="field-note"><b>${p.discoveries.includes('marlow') ? 'Marlow’s ledge' : 'A large shadow beneath the ledge'}</b><p>A broad mottled grouper sometimes follows working divers. Not a pet. Secure your catch and respect its space.</p></div><div class="field-note"><b>Company support</b><p>Stories earn followers; careful field work earns reputation. At 80, 160 and 300 followers, eligible divers can take camera and conservation story assignments. Completing them earns recognition and a gold highlight frame, without extra cash.</p></div></div></div><div class="button-row"><button class="primary" data-close>${run && !run.finished ? 'Back to the dive' : 'Back to harbour'}</button></div></section>`; }
    initDebrief(r: Run) { const n = r.rescued ? 0 : r.cargo.length; const market=r.cargo.filter(c=>c.value>0).length; this.allocation = { sell: r.rescued?0:market, eat: n-(r.rescued?0:market), donate: 0 }; this.chosen = new Set(r.clips.slice().sort((a, b) => b.quality - a.quality).slice(0, 2).map(c => c.id)); }
    debrief(p: Profile) {
        const r = p.pending;
        if (!r)
            return `<section class="modal narrow">${this.header('Nothing waiting at the dock.')}<button data-screen="dock">Harbour</button></section>`;
        const n = r.rescued ? 0 : r.cargo.length;
        const quality = typeof r.filletQuality === 'number' ? Math.round(clamp(r.filletQuality, 0, 1) * 100) : null;
        const filletStatus = quality === null
            ? (n ? `<div class="fillet-summary"><div class="fillet-stamp" aria-hidden="true">✦</div><div><strong>Fresh catch, ready for the table</strong><p>Optional careful filleting can improve its sale value. Your allocation stays the same.</p></div><button class="outline" data-screen="scaling">Scale & prepare</button></div>` : '')
            : `<div class="fillet-summary completed"><div class="fillet-stamp" aria-hidden="true">${quality >= 75 ? '✦' : '≈'}</div><div><strong>Fillet quality · ${quality}%</strong><p>The preparation bonus will be added once when you settle this catch.</p></div></div>`;
        return `<section class="modal">${this.header(r.rescued ? 'Tomorrow is another dive.' : 'Back with a story.', 'DAY ' + r.day + ' / ' + SITES[r.site].name.toUpperCase())}<p class="muted tiny">${r.rescued ? 'Rescue recovered you and your equipment. The catch is lost, but your reef work remains.' : 'The engine settles. The catch goes on ice. Decide what this outing becomes.'}</p><p class="recovery-note">${reefRecoveryText(p, r.site)}</p><div class="row-stats"><div><strong>${timeText(r.time)}</strong>underwater</div><div><strong>${n}</strong>fish landed</div><div><strong>${r.cleaned}</strong>cleanup jobs</div><div><strong>${r.restored}</strong>corals planted</div><div><strong>${r.stolen}</strong>fish stolen</div></div>${r.jobs.some(j=>j.kind==='outbreak')?`<p class="outbreak-report"><b>Field response · ${r.treated??0} / ${r.jobs.filter(j=>j.kind==='outbreak').length} treated this outing</b><br>$${(r.treated??0)*14} bounty + ${r.treated??0} reputation logged. Untreated targets stay available during this report window.</p>`:''}<h3>Allocate your catch</h3><div class="allocation">${(['sell', 'eat', 'donate'] as const).map(a => `<label>${a === 'sell' ? 'Sell to restaurants' : a === 'eat' ? 'Keep for meals' : 'Donate to the community'}<input aria-label="${a} catch" data-allocate="${a}" type="number" min="0" max="${a==='sell'?r.cargo.filter(c=>c.value>0).length:n}" step="1" value="${this.allocation[a]}" ${n ? '' : 'disabled'}></label>`).join('')}</div><p id="allocation-status" class="tiny muted"></p><p class="tiny muted">Restaurants take your highest-value market-size fish first. Meals use juveniles first; donations receive the remainder. Juveniles count fully for eradication and cannot be sold. Selling four market-size fish meets a restaurant order. A kept meal offsets $8 in food costs; extras have no further bonus. Donations build reputation.</p>${filletStatus}${n?'<div class="button-row"><button data-screen="cooking">Cook a meal</button></div>':''}<div class="rule"></div><h3>Choose the stories to tell <span id="chosen-count" class="muted tiny"></span></h3><p class="tiny muted" style="margin-top:6px">Automatic highlight image cards. Publish up to two. Repeating a familiar subject earns less attention.</p><div class="highlight-grid">${r.clips.length ? r.clips.map(c => `<button class="highlight" data-clip="${esc(c.id)}" aria-pressed="false">${c.image ? `<img src="${c.image}" alt="Captured gameplay: ${esc(c.title)}">` : '<div class="blank-image">≈</div>'}<div class="card-copy"><strong>${esc(c.title)}</strong><span>${esc(c.kind)} · quality ${c.quality}</span></div><i class="check" hidden>✓</i></button>`).join('') : '<p class="tiny muted">No highlight cards this time. A quiet dive still counts.</p>'}</div><div class="button-row"><button id="settle" class="primary" data-action="settle">Settle the outing & publish</button></div></section>`;
    }
    filleting(p: Profile) {
        const r = p.pending;
        if(r?.filletQuality!==undefined)return filletResult(r);
        if (!r || r.rescued || !r.cargo.length)
            return `<section class="modal narrow">${this.header('Catch preparation')}<p class="muted">There is no catch waiting to be filleted.</p><div class="button-row"><button class="primary" data-action="fillet-cancel">Return to the debrief</button></div></section>`;
        return `<section class="modal fillet-modal preparation-modal">${this.header('A careful hand.','THE SANDBAR / FILLET BENCH')}<div class="prep-layout"><div class="prep-work"><canvas id="preparation-3d" aria-label="Three dimensional fish, knife and three guided cuts"></canvas><div class="fillet-illustration prep-meter" aria-label="Knife position and three cut targets"><svg viewBox="0 0 360 50"><path d="M45 25H315" stroke="#709e91"/><g class="fillet-band" data-fillet-band="0"><rect x="99" y="6" width="20" height="38" rx="6"/><path d="M109 10v30"/></g><g class="fillet-band" data-fillet-band="1"><rect x="166" y="6" width="20" height="38" rx="6"/><path d="M176 10v30"/></g><g class="fillet-band" data-fillet-band="2"><rect x="232" y="6" width="20" height="38" rx="6"/><path d="M242 10v30"/></g><g id="fillet-knife"><path d="m0 -16 8 -10h-16zM0 -14v28"/></g></svg></div></div><aside class="prep-controls"><p class="prep-instruction">Place three guided cuts. Press Cut as the knife reaches the gold guide, or drag to a gold guide and release.</p><div class="fillet-steps" aria-label="Filleting steps"><span data-step="0">1 · Gill</span><span data-step="1">2 · Belly</span><span data-step="2">3 · Tail</span></div><p id="fillet-cue" class="fillet-cue" aria-live="polite">Cut 1 of 3 · Behind the gill</p><p id="fillet-feedback" class="tiny muted" aria-live="polite">Careful cuts add a sale bonus. Every attempt counts.</p><div class="fillet-actions"><button class="primary" data-action="fillet-cut" aria-keyshortcuts="Enter">Cut 1 / 3</button><button data-action="fillet-cancel">Back to catch</button></div></aside></div></section>`;
    }
    stopFilleting() { if (this.filletFrame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.filletFrame); this.filletFrame = 0; }
    startFilleting() {
        if (!document.getElementById('fillet-knife')) return;
        const canvas=document.getElementById('preparation-3d') as HTMLCanvasElement|null;if(canvas)this.preparation=new PreparationView(canvas);
        this.filletScores = [...(this.getProfile().pending?.filletCuts ?? [])];
        this.filletStage = this.filletScores.length;
        if(this.filletStage===3&&this.getProfile().pending?.filletQuality===undefined){this.dispatch('fillet',this.filletScores.reduce((a,b)=>a+b,0)/3);this.show('filleting');return;}
        this.filletReadyAt=0;
        this.filletScores.forEach((score,i)=>{this.panel.querySelector(`[data-fillet-band="${i}"]`)?.classList.add(score>=.55?'clean-cut':'rough-cut');this.panel.querySelector(`[data-step="${i}"]`)?.classList.add('done');});
        const nextButton=this.panel.querySelector<HTMLButtonElement>('[data-action="fillet-cut"]');if(nextButton)nextButton.textContent=`Cut ${this.filletStage+1} / 3`;
        const nextCue=document.getElementById('fillet-cue');if(nextCue)nextCue.textContent=`Cut ${this.filletStage+1} of 3 · ${['Behind the gill','Along the belly','Release the tail'][this.filletStage]}`;
        this.filletStarted = performance.now();
        const targets = [109, 176, 242];
        const animate = (now: number) => {
            if (this.screen !== 'filleting') return;
            const phase = now<this.directPrepUntil?clamp((this.filletBladeX-62)/236,0,1):((now - this.filletStarted) % 3100) / 3100;
            this.filletBladeX = 62 + phase * 236;this.preparation?.update(phase,this.filletStage);
            document.getElementById('fillet-knife')?.setAttribute('transform', `translate(${this.filletBladeX} 30)`);
            for (let i = 0; i < targets.length; i++) document.querySelector(`[data-fillet-band="${i}"]`)?.classList.toggle('active', i === this.filletStage);
            this.filletFrame = requestAnimationFrame(animate);
        };
        this.bindPreparationPointer('filleting');
        this.filletFrame = requestAnimationFrame(animate);
    }
    tryFilletCut() {
        if (this.screen !== 'filleting' || this.filletStage > 2 || performance.now()<this.filletReadyAt) return;
        this.filletReadyAt=performance.now()+500;
        const targets = [109, 176, 242], target = targets[this.filletStage], score = clamp(1 - Math.abs(this.filletBladeX - target) / 46, 0, 1);
        this.filletScores.push(score);
        this.dispatch('fillet-cut-save',[...this.filletScores]);
        this.panel.querySelector(`[data-fillet-band="${this.filletStage}"]`)?.classList.add(score>=.55?'clean-cut':'rough-cut');
        const feedback = score >= .82 ? 'Beautifully placed.' : score >= .55 ? 'A clean, useful cut.' : score > 0 ? 'A little rough, but the catch is prepared.' : 'You missed the line; the cut still counts.';
        this.filletStage++;
        if (this.filletStage === 3) {
            const quality = this.filletScores.reduce((sum, value) => sum + value, 0) / this.filletScores.length;
            this.stopFilleting();
            this.dispatch('fillet', quality);
            this.show('filleting');
            return;
        }
        this.filletStarted = performance.now();
        const cue = ['Behind the gill', 'Along the belly', 'Release the tail'][this.filletStage];
        const button = this.panel.querySelector<HTMLButtonElement>('[data-action="fillet-cut"]');
        if (button) button.textContent = `Cut ${this.filletStage + 1} / 3`;
        const status = document.getElementById('fillet-cue');
        if (status) status.textContent = `Cut ${this.filletStage + 1} of 3 · ${cue}`;
        const hint = document.getElementById('fillet-feedback');
        if (hint) hint.textContent = feedback;
        this.panel.querySelector(`[data-step="${this.filletStage - 1}"]`)?.classList.add('done');
    }
    refreshClips() { for (const e of this.panel.querySelectorAll<HTMLElement>('[data-clip]')) {
        const chosen = this.chosen.has(e.dataset.clip!);
        e.classList.toggle('selected', chosen);
        e.setAttribute('aria-pressed', String(chosen));
        (e.querySelector('.check') as HTMLElement).hidden = !chosen;
    } const n = document.getElementById('chosen-count'); if (n)
        n.textContent = `${this.chosen.size} / 2 selected`; }
    updateAllocation() { const r = this.getProfile().pending, n = r && !r.rescued ? r.cargo.length : 0, total = this.allocation.sell + this.allocation.eat + this.allocation.donate, el = document.getElementById('allocation-status'); if (el) {
        el.textContent = total === n ? `${n} fish allocated. ${r?allocateCatch(r.rescued?[]:r.cargo,this.allocation).sell.filter(c=>c.value>0).length:0} market fish sold; juveniles go to meals first, then donations. Ready to settle.` : `Allocate exactly ${n} fish. Currently allocated: ${total}.`;
        el.style.color = total === n ? 'var(--muted)' : 'var(--red)';
    } const fillet=document.getElementById('fillet-sale-bonus');if(fillet&&r){const market=r.cargo.filter(c=>c.value>0).sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id));const base=market.slice(0,this.allocation.sell).reduce((n,c)=>n+c.value,0);fillet.textContent=`Filleting sale bonus: ${money(Math.round(base*(r.filletQuality??0)*.3))} on ${this.allocation.sell} fish sold.`;}
    (document.getElementById('settle') as HTMLButtonElement | null)?.toggleAttribute('disabled', total !== n); }
    playBoat() {
        this.preparation?.dispose();this.preparation=null;this.cookingView?.dispose();this.cookingView=null;this.stopFilleting();this.panel.hidden=true;this.hud.hidden=false;document.body.classList.add('game','boat-travel');document.getElementById('menu-backdrop')!.hidden=true;
        let navigation=document.getElementById('boat-navigation');if(!navigation){navigation=document.createElement('section');navigation.id='boat-navigation';navigation.innerHTML=`<canvas id="bay-chart" width="260" height="215" aria-label="Bay navigation chart with five dive buoys"></canvas><p id="boat-status" aria-live="polite"></p><label class="tiny" for="boat-contract">Dive assignment</label><select id="boat-contract"><option value="none">Free exploration</option></select><div class="button-row"><button id="boat-enter" class="primary" disabled>Stop by a dive buoy</button><button id="boat-return">Harbour</button></div><p class="tiny">W/S or joystick: throttle · A/D: steer · slow beside a buoy</p>`;this.hud.append(navigation);document.getElementById('boat-enter')!.onclick=()=>this.dispatch('boat-dive');document.getElementById('boat-return')!.onclick=()=>this.dispatch('boat-harbour');(document.getElementById('boat-contract') as HTMLSelectElement).onchange=e=>{this.order=(e.target as HTMLSelectElement).value as Run['order'];};}
    }
    boatSite: SiteId|null=null;
    updateBoat(b:BoatState,site:SiteId|null){if(this.boatSite!==site){this.boatSite=site;const select=document.getElementById('boat-contract') as HTMLSelectElement|null;if(select){const offers=site?contractOptions(this.getProfile(),site):[];select.innerHTML=offers.length?offers.map(o=>`<option value="${o.kind}" ${o.available?'':'disabled'}>${o.kind==='none'?'Free exploration':o.kind==='catch'?'Kitchen · sell 4 market fish':o.kind==='cleanup'?'Cleanup · remove 2':o.kind==='restore'?'Restore · plant 2':'Research · 2 stations'}</option>`).join(''):'<option value="none">Choose at a dive buoy</option>';this.order=offers.find(o=>o.available)?.kind??'none';select.value=this.order;select.disabled=!site;}}const status=document.getElementById('boat-status');if(status)status.textContent=site?SITES[site].name+' · mooring within reach · Interact to dive':`${Math.round(Math.abs(b.speed)*1.94)} knots · steer towards a gold buoy`;const button=document.getElementById('boat-enter') as HTMLButtonElement|null;if(button){button.disabled=!site;button.textContent=site?'Dive '+SITES[site].name:'Slow to moor at a gold buoy';}}
    miniView(p:Profile,screen:'scaling'|'cooking'){
        const r=p.pending;if(!r||r.rescued||!r.cargo.length)return `<section class="modal narrow">${this.header('No catch on the board.')}<button data-close>Back</button></section>`;
        if(screen==='scaling'&&(r.scalingPasses?.length===3||r.filletQuality!==undefined))return `<section class="modal narrow">${this.header('Ready for the knife.')}<p>The scales are lifted. Follow the three guided cuts.</p><button class="primary" data-screen="filleting">Fillet the catch</button></section>`;
        if(screen==='cooking'&&r.cooking?.complete)return `<section class="modal narrow">${this.header('A meal well earned.')}<p>${RECIPES[r.cooking.recipe as keyof typeof RECIPES].name} · ${Math.round(r.cooking.quality*100)}% quality.</p><p>Keep one fish for a meal at allocation. Your recipe offsets up to $4 extra in meal costs, once.</p><button data-close>Back to allocation</button></section>`;
        const recipe=RECIPES[this.recipe];return `<section class="modal fillet-modal preparation-modal">${this.header(screen==='scaling'?'Lift the scales.':recipe.name,'THE SANDBAR / OPTIONAL PREPARATION')}<div class="prep-layout"><div class="prep-work">${screen==='cooking'?'<canvas id="cooking-canvas" aria-label="Animated recipe: fish, herbs, lime and cooking pan"></canvas>':'<canvas id="preparation-3d" aria-label="Three dimensional scaling board"></canvas>'}<div id="mini-stage" class="mini-stage prep-meter"><div id="mini-band"></div><div id="mini-needle"></div></div></div><aside class="prep-controls"><p class="prep-instruction">${screen==='scaling'?'Lift three sections. Drag on the board to guide the scaler, then release in gold. Or press Lift scales as the tool crosses the guide.':recipe.instruction+' Tap the pan or use the action button as the heat reaches gold.'}</p>${screen==='cooking'?`<div class="recipe-choices">${Object.entries(RECIPES).map(([id,rec])=>`<button data-recipe="${id}" aria-pressed="${id===this.recipe}">${id==='citrus'?'Citrus pan fish':'Coconut stew'}</button>`).join('')}</div>`:''}<p id="mini-cue" aria-live="polite">${screen==='scaling'?'Section 1 / 3':this.recipe==='stew'?'Stir gently · 1 / 3':'Sear the first side · 1 / 3'}</p><div class="button-row"><button class="primary" data-action="mini-action">${screen==='scaling'?'Lift scales':this.recipe==='stew'?'Stir gently':'Sear'}</button><button data-close>Back to catch</button></div></aside></div></section>`;
    }
    bindPreparationPointer(screen:'scaling'|'filleting') {
        const canvas=document.getElementById('preparation-3d');if(!canvas)return;
        let active:number|null=null,start=0,moved=false;
        const place=(e:PointerEvent)=>{const box=canvas.getBoundingClientRect(),p=clamp((e.clientX-box.left)/box.width,0,1);this.directPrepUntil=performance.now()+1500;if(screen==='scaling')this.miniPosition=p;else this.filletBladeX=62+(1-p)*236;};
        canvas.onpointerdown=e=>{if(active!==null)return;e.preventDefault();active=e.pointerId;start=e.clientX;moved=false;canvas.setPointerCapture(e.pointerId);place(e);};
        canvas.onpointermove=e=>{if(e.pointerId!==active)return;e.preventDefault();moved ||= Math.abs(e.clientX-start)>12;place(e);};
        canvas.onpointerup=e=>{if(e.pointerId!==active)return;place(e);active=null;if(moved){screen==='scaling'?this.miniAction():this.tryFilletCut();}};
        canvas.onpointercancel=()=>{active=null;this.directPrepUntil=0;};canvas.onlostpointercapture=()=>{active=null;};
    }

    startMini(screen:'scaling'|'cooking'){
        this.miniScores=screen==='scaling'?[...(this.getProfile().pending?.scalingPasses??[])]:[];this.miniStarted=performance.now();this.miniReady=0;
        const canvas=document.getElementById('preparation-3d') as HTMLCanvasElement|null;if(canvas){this.preparation=new PreparationView(canvas,true);this.bindPreparationPointer('scaling');}const cooking=document.getElementById('cooking-canvas') as HTMLCanvasElement|null;if(cooking){this.cookingView=new CookingView(cooking,this.recipe);cooking.onclick=()=>this.miniAction();}
        const animate=(now:number)=>{if(this.screen!==screen)return;if(now>=this.directPrepUntil)this.miniPosition=screen==='scaling'?((now-this.miniStarted)%2400)/2400:(1-Math.cos((now-this.miniStarted)/850))/2;
            const stage=this.miniScores.length,target=screen==='scaling'?[.3,.56,.78][stage]:RECIPES[this.recipe].targets[stage];
            const needle=document.getElementById('mini-needle'),band=document.getElementById('mini-band');if(needle)needle.style.left=this.miniPosition*100+'%';if(band)band.style.left=target*100+'%';
            this.preparation?.update(this.miniPosition,stage);this.cookingView?.update(this.miniPosition,stage);this.filletFrame=requestAnimationFrame(animate);};this.filletFrame=requestAnimationFrame(animate);
    }
    miniAction(){const r=this.getProfile().pending;if(!r||!['scaling','cooking'].includes(this.screen)||this.miniScores.length>=3||performance.now()<this.miniReady)return;this.miniReady=performance.now()+450;const stage=this.miniScores.length,target=this.screen==='scaling'?[.3,.56,.78][stage]:RECIPES[this.recipe].targets[stage];
        this.miniScores.push(clamp(1-Math.abs(this.miniPosition-target)/.24,0,1));if(this.screen==='scaling')this.dispatch('scaling-save',[...this.miniScores]);
        if(this.miniScores.length===3){if(this.screen==='cooking')this.dispatch('cook-save',{recipe:this.recipe,scores:this.miniScores});this.show(this.screen);return;}
        this.miniStarted=performance.now();const action=this.panel.querySelector('[data-action=mini-action]');if(action&&this.screen==='cooking')action.textContent=(this.recipe==='stew'?['Stir gently','Fold in fish','Finish with lime']:['Sear','Turn the fish','Finish with citrus'])[this.miniScores.length];const cue=document.getElementById('mini-cue');if(cue)cue.textContent=`${this.screen==='scaling'?'Pass':this.recipe==='stew'?['Stir','Fold in fish','Finish with lime'][this.miniScores.length]:['Sear','Turn','Finish'][this.miniScores.length]} ${this.miniScores.length+1} / 3 · ${Math.round(this.miniScores.at(-1)!*100)}%`;
    }
    play() { this.panel.hidden = true; this.hud.hidden = false; document.body.classList.add('game'); document.getElementById('menu-backdrop')!.hidden = true; }
    toast(text: string) {
        const el=document.getElementById('toast')!;el.textContent=text;el.classList.add('visible');clearTimeout(this.toastTimer);
        this.panel.querySelector('#menu-message')?.remove();
        let message:HTMLElement|null=null;
        if(!this.panel.hidden){message=document.createElement('p');message.id='menu-message';message.className='menu-message';message.setAttribute('role','status');message.textContent=text;(this.panel.querySelector('.modal,.dock-card')??this.panel).prepend(message);}
        this.toastTimer=window.setTimeout(()=>{el.classList.remove('visible');message?.remove();},4500);
    }
    slots(profiles: Profile[]) { const parent = document.getElementById('slots'); if (!parent)
        return; parent.innerHTML = profiles.map(p => `<article class="save-card ${p.slot === this.getProfile().slot ? 'current' : ''}"><div><h3>Logbook ${p.slot}</h3><p>Day ${p.day} · ${money(p.cash)} · ${p.totalRemoved} removals${p.active ? ' · dive suspended' : ''}${p.pending ? ' · ready to settle' : ''}</p></div><button data-action="slot" data-value="${p.slot}">${p.slot === this.getProfile().slot ? 'Current' : 'Open'}</button></article>`).join(''); }
    confirm(action: string, text: string) { this.confirmAction = action; this.confirmText = text; this.show('confirm'); }
    updateHUD(sim: Simulation, control: 'touch' | 'gamepad' | 'keyboard') { const objective=document.getElementById('campaign-progress'),lesson=document.getElementById('lesson-text'),skip=document.getElementById('lesson-skip');
        if(objective){objective.hidden=false;objective.textContent=contractNote(sim.run)+(sim.run.event?' · '+eventNote(sim.run):'');}
        if(objective&&sim.run.jobs.some(j=>j.kind==='outbreak'))objective.textContent+=' · Response '+(sim.run.treated??0)+' treated / '+sim.run.jobs.filter(j=>j.kind==='outbreak'&&!j.done).length+' remaining';
        if(lesson){lesson.hidden=!lessonActive(sim.run);lesson.textContent=lessonActive(sim.run)?`First dive ${1+(sim.run.lesson?.step??0)}/7 · ${lessonPrompt(sim.run,control,this.getSettings())}`:'';}
        if(skip){skip.hidden=!lessonActive(sim.run);skip.onclick=()=>this.dispatch('tutorial-skip');}
 const r = sim.run, p = sim.profile, s = this.getSettings(); document.getElementById('air')!.textContent = Math.ceil(r.air).toString(); const fill = document.getElementById('air-fill')!; fill.style.width = String(Math.min(100, r.air / airCapacity(p) * 100)) + '%'; fill.style.background = r.air < sim.reserve ? 'var(--sand)' : 'var(--teal)'; const depth = Math.max(0, sim.site.surface - r.p.y), depthEl = document.getElementById('depth')!; depthEl.textContent = depth === 0 ? 'SURFACE' : depth.toFixed(1) + ' m'; depthEl.setAttribute('aria-label', depth === 0 ? 'At the surface' : `${depth.toFixed(1)} metres deep`); depthEl.classList.toggle('surface-state', depth === 0); document.getElementById('bag')!.textContent = `${r.cargo.length} / ${capacity(p)} secured${r.exposed ? ' + 1 exposed' : ''}`; document.getElementById('clock')!.textContent = timeText(r.time); document.getElementById('condition')!.textContent = [r.health < 100 ? `Condition ${Math.ceil(r.health)}%` : '', r.scooter || r.light ? `Battery ${Math.ceil(r.battery)}%` : ''].filter(Boolean).join(' · '); const ret = document.getElementById('reticle')!; ret.classList.toggle('charging', r.charge > .01); ret.classList.toggle('valid', sim.aim.valid); document.getElementById('charge-ring')!.style.strokeDashoffset = String(157 * (1 - r.charge)); const aim = sim.aim, inter = document.getElementById('interaction')!; const show = !!aim.label && (s.assist || aim.kind !== 'fish' || aim.id === 'held'); inter.style.opacity = show ? '1' : '0'; document.getElementById('aim-label')!.textContent = aim.label; let hint = aim.hint; const interactKey = control === 'touch' ? 'Interact' : control === 'gamepad' ? 'your mapped Interact control' : key(s.keys.interact); hint = hint.replace(/Interact/g, interactKey); document.getElementById('aim-hint')!.textContent = hint + (aim.distance > 0 ? ` · ${aim.distance.toFixed(1)} m` : ''); const work = document.getElementById('work-meter')!; work.style.opacity = r.interaction > 0 ? '1' : '0'; (work.firstElementChild as HTMLElement).style.width = r.interaction * 100 + '%'; document.getElementById('return-warning')!.hidden = !r.returnWarn; document.getElementById('dive-caption')!.textContent = r.scooter ? 'MINNOW / CRUISING · Stow to use the spear' : `LANTERN BAY / ${sim.site.name.toUpperCase()}${r.time < 45 ? ' · The chart marks the nursery and cleanup sites.' : ''}`; document.getElementById('controls-hint')!.textContent = control === 'gamepad' ? 'Controller · map controls in Settings' : `${key(s.keys.steady)} steady · Hold ${key(s.keys.interact)} interact · ${key(s.keys.up)} up / ${key(s.keys.down)} down · ${key(s.keys.journal)} chart`; }
    chart(sim: Simulation | null) { const el = document.getElementById('chart') as HTMLCanvasElement | null; if (!el)
        return; const p = this.getProfile(), currentRun=sim?.run||p.active||p.pending, id = currentRun?.site || this.site, site = currentRun?siteForRun(currentRun):SITES[id], ctx = el.getContext('2d')!, w = el.width, scale = w / (site.radius * 2 + 20), to = (x: number, z: number) => [w / 2 + x * scale, w / 2 - z * scale]; ctx.fillStyle = '#123a42'; ctx.fillRect(0, 0, w, w); ctx.strokeStyle = '#94c9b31b'; ctx.lineWidth = 1; for (let i = 0; i < w; i += w / 10) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, w);
        ctx.moveTo(0, i);
        ctx.lineTo(w, i);
        ctx.stroke();
    } ctx.fillStyle = '#91c5b729'; ctx.strokeStyle = '#aad7c346'; for (const r of site.rocks) {
        const [x, y] = to(r.p.x, r.p.z);
        ctx.beginPath();
        ctx.ellipse(x, y, r.s.x * scale, r.s.z * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    } ctx.strokeStyle = '#ecd095aa'; ctx.lineWidth = 2; if (sim?.route.length) {
        ctx.beginPath();
        sim.route.forEach((p, i) => { const [x, y] = to(p.x, p.z); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke();
    } const labelFont=Math.max(17,Math.round(13*w/Math.max(1,el.clientWidth)));ctx.font=labelFont+'px Trebuchet MS'; for (const l of site.landmarks) {
        const [x, y] = to(l.p.x, l.p.z);
        ctx.fillStyle = l.kind === 'boat' ? '#f1e6c4' : '#88d9be';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 7);
        ctx.fill();
    }
    const markerLabels=site.landmarks.map(l=>{const [x,y]=to(l.p.x,l.p.z);return {name:l.name,x,y};});
    sim?.run.jobs.filter(j=>j.kind==='outbreak').forEach((j,i)=>{const [x,y]=to(j.p.x,j.p.z);markerLabels.push({name:'T'+(i+1)+(j.done?' treated':' response'),x,y});});
    const labels = layoutChartLabels(markerLabels, w, text => ctx.measureText(text).width,labelFont+5);
    for (const label of labels) {
        ctx.strokeStyle='#a9d7bb99'; ctx.beginPath(); ctx.moveTo(label.x,label.y); ctx.lineTo(label.left+label.width/2,label.top+label.height/2); ctx.stroke();
        ctx.fillStyle='#123a42ee';ctx.fillRect(label.left,label.top,label.width,label.height);ctx.fillStyle='#e8ead0';
        label.lines.forEach((line,i)=>ctx.fillText(line,label.left+6,label.top+labelFont+3+i*(labelFont+5),label.width-12));
    } if (sim) {
        for (const j of sim.run.jobs) {
            const [x, y] = to(j.p.x, j.p.z);
            if(j.kind==='outbreak'){
                ctx.strokeStyle=j.done?'#a5d8bc':'#f3bd75';ctx.fillStyle=j.done?'#679d86':'#f3bd75';ctx.lineWidth=2;ctx.beginPath();
                if(j.done)ctx.arc(x,y,7,0,Math.PI*2);else {ctx.moveTo(x,y-8);ctx.lineTo(x-7,y+6);ctx.lineTo(x+7,y+6);ctx.closePath();}ctx.fill();ctx.stroke();

            }else{ctx.fillStyle=j.done?'#669e83':'#9adfc3';ctx.fillRect(x-3,y-3,6,6);}
        }
        const r = sim.run, [x, y] = to(r.p.x, r.p.z);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(r.yaw);
        ctx.fillStyle = '#efc78f';
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(-6, 7);
        ctx.lineTo(0, 4);
        ctx.lineTo(6, 7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    } ctx.fillStyle = '#cfe4cc'; ctx.font = '15px Trebuchet MS'; ctx.fillText('N ↑', w - 54, 30); ctx.fillStyle = '#aed4c099'; ctx.font = '12px Trebuchet MS'; ctx.fillText('CHARTED REEF / NOT TO DIVE-PLANNING SCALE', 18, w - 16); }
}
