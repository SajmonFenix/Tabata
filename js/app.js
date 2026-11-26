import { DEFAULT_CONFIG, TEMPLATES, normalizeConfig, buildPhases, buildCues, phaseAt, totalTime, fmt, PHASE_LABEL } from './timeline.js';
import { SOUNDS, renderWorkoutBlob, renderPreviewBlob } from './audio.js';
import { store, THEMES } from './store.js';

const $app = document.getElementById('app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

/* ---------- téma ---------- */
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`; }
function setPal(which) {
  const th = THEMES[store.get().theme];
  const p = th[which];
  const st = document.documentElement.style;
  st.setProperty('--bg', p.bg); st.setProperty('--fg', p.fg); st.setProperty('--btn', p.btn);
  st.setProperty('--fg-rgb', hexToRgb(p.fg)); st.setProperty('--alpha', th.labelAlpha);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', p.bg);
}

/* ---------- stav obrazoviek ---------- */
let view = { name: 'home' };
let keypad = null; // {field, kind, digits}
let run = null;    // bežiaci tréning
let toastTimer = null;

function go(v) { view = v; keypad = null; render(); }
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ---------- render ---------- */
function render() {
  if (view.name !== 'timer' && view.name !== 'done') setPal('rest');
  const fn = { home: renderHome, edit: renderEdit, settings: renderSettings, timer: renderTimer, done: renderDone }[view.name];
  $app.innerHTML = fn() + (keypad ? renderKeypad() : '');
  if (view.name === 'timer') tick();
}

function summary(c) {
  const parts = [`${fmt(c.work)} / ${fmt(c.rest)} × ${c.rounds}`];
  if (c.sets > 1) parts.push(`${c.sets} SETS`);
  return parts.join(' · ');
}

function renderHome() {
  const s = store.get();
  const hint = isIOS && !isStandalone && !localStorage.getItem('tabata.hint')
    ? `<div class="banner" data-act="hide-hint"><b>ADD TO HOME SCREEN</b><span>SHARE → ADD TO HOME SCREEN, THEN OPEN FROM THE ICON.</span></div>` : '';
  const cards = s.workouts.length
    ? s.workouts.map(w => `
      <div class="card">
        <div class="card-main">
          <div class="card-name">${esc(w.name)}</div>
          <div class="card-sum">${summary(w.config)}</div>
          <div class="card-total"><span>TOTAL TIME</span> ${fmt(totalTime(w.config))}</div>
        </div>
        <div class="card-btns">
          <button class="btn primary" data-act="start" data-id="${w.id}">START</button>
          <button class="btn ghost" data-act="edit" data-id="${w.id}">EDIT</button>
        </div>
      </div>`).join('')
    : `<div class="empty"><h2>NO WORKOUTS YET</h2><p>CREATE ONE FOR EACH TRAINING YOU DO, LIKE JUMP ROPE OR KETTLEBELL</p></div>`;
  const tpl = s.templates ? `
    <h3 class="section">START FROM TEMPLATE</h3>
    <p class="muted small">TABATA, HIIT, EMOM FOR NEW WORKOUTS</p>
    <div class="tpl-row">${TEMPLATES.map(t => `
      <button class="tpl" data-act="template" data-id="${t.id}"><b>${t.name}</b><span>${t.hint}</span></button>`).join('')}
    </div>` : '';
  return `
    <header class="top">
      <h1>MY WORKOUTS</h1>
      <button class="icon-btn" data-act="settings" aria-label="Settings">${gearSvg()}</button>
    </header>
    <main class="scroll">
      ${hint}${cards}
      <button class="btn primary wide" data-act="new">+ NEW WORKOUT</button>
      ${tpl}
    </main>`;
}

function renderEdit() {
  const e = view.draft, c = e.config;
  const row = (field, label, val, kind) => `
    <button class="field" data-act="field" data-field="${field}" data-kind="${kind}">
      <span class="field-l">${label}</span><span class="field-v">${kind === 'time' ? fmt(val) : val}</span>
    </button>`;
  return `
    <header class="top">
      <button class="icon-btn" data-act="back" aria-label="Back">&lt;</button>
      <h1>${e.isNew ? 'NEW WORKOUT' : 'EDIT'}</h1>
      <span class="spacer"></span>
    </header>
    <main class="scroll">
      <label class="name-wrap">
        <span class="muted small">NAME IT</span>
        <input id="name" class="name ${e.nameError ? 'err' : ''}" maxlength="24" autocomplete="off" autocapitalize="characters"
               value="${esc(e.name)}" placeholder="${e.nameError ? 'GIVE IT A NAME FIRST' : 'E.G. JUMP ROPE'}">
      </label>
      ${row('prep', 'GET READY', c.prep, 'time')}
      ${row('work', 'WORK', c.work, 'time')}
      ${row('rest', 'REST', c.rest, 'time')}
      ${row('rounds', 'ROUNDS', c.rounds, 'num')}
      ${row('sets', 'SETS', c.sets, 'num')}
      ${c.sets > 1 ? row('setRest', 'SET REST', c.setRest, 'time') : ''}
      <div class="total"><span>TOTAL TIME</span><b ${totalTime(c) > 3 * 3600 ? 'style="color:#D6362F"' : ''}>${fmt(totalTime(c))}</b></div>
      ${totalTime(c) > 3 * 3600 ? '<p class="muted small note">MAX 3 HOURS PER WORKOUT.</p>' : ''}
      <button class="btn primary wide" data-act="save">SAVE</button>
      ${e.isNew ? '' : `<button class="btn ghost wide ${e.confirmDelete ? 'danger' : ''}" data-act="delete">${e.confirmDelete ? 'SURE?' : 'DELETE'}</button>`}
    </main>`;
}

function renderKeypad() {
  const k = keypad, isTime = k.kind === 'time';
  const d = k.digits.padStart(isTime ? 4 : 2, '0');
  const shown = isTime ? `<span>${d.slice(0, 2)}</span><i>M</i><span>${d.slice(2)}</span><i>S</i>` : `<span>${d.slice(-2)}</span>`;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLEAR', '0', '<'];
  return `
    <div class="sheet-bg" data-act="kp-cancel"></div>
    <div class="sheet" role="dialog">
      <div class="sheet-title">${isTime ? 'TYPE MINUTES AND SECONDS' : 'TYPE A NUMBER'}</div>
      <div class="sheet-val">${shown}</div>
      <div class="keys">${keys.map(x => `<button class="key ${x.length > 1 ? 'small-key' : ''}" data-act="key" data-k="${x}">${x === '<' ? '⌫' : x}</button>`).join('')}</div>
      <div class="sheet-btns"><button class="btn ghost" data-act="kp-cancel">CANCEL</button><button class="btn primary" data-act="kp-set">SET</button></div>
    </div>`;
}

function renderSettings() {
  const s = store.get();
  const tog = (k, label, extra = '') => `
    <button class="toggle ${s[k] ? 'on' : ''}" data-act="toggle" data-k="${k}">
      <span class="field-l">${label}</span><span class="sw"><i></i></span>
    </button>${extra}`;
  return `
    <header class="top">
      <button class="icon-btn" data-act="back" aria-label="Back">&lt;</button>
      <h1>SETTINGS</h1><span class="spacer"></span>
    </header>
    <main class="scroll">
      <h3 class="section">THEME</h3>
      <div class="themes">${THEMES.map((t, i) => `
        <button class="theme ${s.theme === i ? 'sel' : ''}" data-act="theme" data-i="${i}">
          <span class="chip" style="background:${t.work.bg};color:${t.work.fg}">${t.work.bg === '#FFFFFF' ? '' : ''}<i style="background:${t.work.fg}"></i></span>
          <span class="chip" style="background:${t.rest.bg}"><i style="background:${t.rest.fg}"></i></span>
          <b>${t.name}</b></button>`).join('')}
      </div>
      <h3 class="section">SOUND</h3>
      <div class="list">${SOUNDS.map((n, i) => `
        <button class="opt ${s.sound === i ? 'sel' : ''}" data-act="sound" data-i="${i}"><span>${n}</span><em>${s.sound === i ? '●' : '▶'}</em></button>`).join('')}
      </div>
      ${tog('halfway', 'HALFWAY BEEP')}
      ${tog('vibrate', 'VIBRATE', 'vibrate' in navigator ? '' : '<p class="muted small note">NOT SUPPORTED ON IPHONE — SOUND ONLY.</p>')}
      ${tog('templates', 'SHOW TEMPLATES')}
      <p class="muted small note">THE WORKOUT SOUNDS ARE PLAYED AS ONE AUDIO TRACK, SO THEY KEEP GOING WITH THE SCREEN LOCKED. MUSIC FROM OTHER APPS PAUSES DURING A WORKOUT.</p>
    </main>`;
}

/* ---------- časovač ---------- */
function renderTimer() {
  const r = run;
  return `
    <div class="timer">
      <div class="t-top"><span class="t-name">${esc(r.name)}</span></div>
      <div class="t-phase" id="t-phase">&nbsp;</div>
      <div class="t-time" id="t-time">0:00</div>
      <div class="t-meta" id="t-meta">&nbsp;</div>
      <div class="t-bar"><i id="t-bar"></i></div>
      <div class="t-next" id="t-next">&nbsp;</div>
      <div class="t-controls">
        <button class="btn ghost" id="b-stop" data-act="stop">STOP</button>
        <button class="btn primary" id="b-pause" data-act="pause">PAUSE</button>
        <button class="btn ghost" data-act="skip">SKIP</button>
      </div>
    </div>`;
}

function renderDone() {
  return `
    <div class="timer done">
      <div class="t-top"><span class="t-name">${esc(run?.name || '')}</span></div>
      <div class="t-phase">WORKOUT DONE</div>
      <div class="t-time">${fmt(run?.worked || 0)}</div>
      <div class="t-meta">TOTAL TIME</div>
      <div class="t-controls two">
        <button class="btn ghost" data-act="again">AGAIN</button>
        <button class="btn primary" data-act="finish">DONE</button>
      </div>
    </div>`;
}

const MAX_TOTAL = 3 * 3600;
function startWorkout(name, config) {
  const cfg = normalizeConfig(config);
  const { phases, total } = buildPhases(cfg);
  if (total > MAX_TOTAL) { toast('WORKOUT TOO LONG — MAX 3 HOURS'); return; }
  stopRun();
  const s = store.get();
  const cues = buildCues(phases, total, { halfway: s.halfway });
  const blob = renderWorkoutBlob(cues, total, SOUNDS[s.sound]);
  const url = URL.createObjectURL(blob);
  const audio = new Audio();
  audio.preload = 'auto';
  audio.src = url;
  run = { name, cfg, phases, total, cues, audio, url, paused: false, idx: -1, cuePtr: 0, wake: null, timer: null, lastShown: '', worked: totalTime(cfg), stopArm: 0 };
  audio.addEventListener('ended', onEnded);
  // play() musí ísť priamo z ťuknutia (iOS)
  const p = audio.play();
  if (p && p.catch) p.catch(() => toast('AUDIO BLOCKED — TAP PAUSE / RESUME'));
  acquireWake();
  setupMediaSession();
  view = { name: 'timer' }; keypad = null; render();
  run.timer = setInterval(tick, 100);
}

function onEnded() { if (run && view.name === 'timer') finishRun(); }

function finishRun() {
  if (!run) return;
  clearInterval(run.timer); run.timer = null;
  releaseWake();
  view = { name: 'done' }; render();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
}

function stopRun() {
  if (!run) return;
  clearInterval(run.timer);
  run.audio.removeEventListener('ended', onEnded);
  run.audio.pause(); run.audio.removeAttribute('src'); run.audio.load();
  URL.revokeObjectURL(run.url);
  releaseWake();
  if ('mediaSession' in navigator) { navigator.mediaSession.playbackState = 'none'; navigator.mediaSession.metadata = null; }
  run = null;
}

function tick() {
  if (!run || view.name !== 'timer') return;
  const t = run.audio.currentTime;
  const idx = phaseAt(run.phases, t);
  if (idx >= run.phases.length) { if (t >= run.total) finishRun(); return; }
  const p = run.phases[idx];
  if (idx !== run.idx) { run.idx = idx; onPhaseChange(p); }
  // vibrácie (Android) na signály
  while (run.cuePtr < run.cues.length && run.cues[run.cuePtr].t <= t) {
    const c = run.cues[run.cuePtr++];
    if (!run.paused && t - c.t < 0.8 && store.get().vibrate && navigator.vibrate && document.visibilityState === 'visible') {
      navigator.vibrate(c.cue === 'GO' ? 300 : c.cue === 'FINISH' ? [200, 100, 200, 100, 400] : c.cue === 'REST' ? [120, 60, 120] : 60);
    }
  }
  const remain = Math.max(0, Math.ceil(p.end - t - 1e-6));
  const key = idx + ':' + remain + ':' + run.paused;
  if (key !== run.lastShown) {
    run.lastShown = key;
    const set = (id, txt) => { const el = document.getElementById(id); if (el && el.textContent !== txt) el.textContent = txt; };
    set('t-time', fmt(remain));
    set('t-phase', run.paused ? 'PAUSED' : PHASE_LABEL[p.type]);
  }
  const bar = document.getElementById('t-bar');
  if (bar) bar.style.width = Math.min(100, (t - p.start) / p.dur * 100).toFixed(1) + '%';
}

function onPhaseChange(p) {
  setPal(p.type === 'work' ? 'work' : 'rest');
  const meta = p.type === 'prep' ? `${run.cfg.rounds} ROUNDS${run.cfg.sets > 1 ? ' · ' + run.cfg.sets + ' SETS' : ''}`
    : `ROUND ${p.round}/${p.rounds}` + (p.sets > 1 ? ` · SET ${p.set}/${p.sets}` : '');
  const nxt = run.phases[run.idx + 1];
  const nextTxt = nxt ? `NEXT: ${PHASE_LABEL[nxt.type]} ${fmt(nxt.dur)}` : 'NEXT: FINISH';
  const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  setTxt('t-meta', meta); setTxt('t-next', nextTxt);
  document.getElementById('app').dataset.phase = p.type;
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${PHASE_LABEL[p.type]} · ${fmt(p.dur)}`, artist: `${run.name} · ${meta}`, album: 'Tabata',
      artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
    });
  }
}

function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  ms.playbackState = 'playing';
  ms.setActionHandler('play', () => setPaused(false));
  ms.setActionHandler('pause', () => setPaused(true));
  ms.setActionHandler('nexttrack', skip);
  try { ms.setActionHandler('stop', () => { stopRun(); go({ name: 'home' }); }); } catch { /* nepodporované */ }
}

function setPaused(on) {
  if (!run) return;
  run.paused = on; run.lastShown = '';
  if (on) run.audio.pause(); else run.audio.play().catch(() => {});
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = on ? 'paused' : 'playing';
  const b = document.getElementById('b-pause'); if (b) b.textContent = on ? 'RESUME' : 'PAUSE';
  tick();
}

function skip() {
  if (!run) return;
  const idx = phaseAt(run.phases, run.audio.currentTime);
  const target = idx >= run.phases.length - 1 ? run.total : run.phases[idx + 1].start;
  run.audio.currentTime = target;
  run.cuePtr = run.cues.findIndex(c => c.t >= target - 1e-6);
  if (run.cuePtr < 0) run.cuePtr = run.cues.length;
  tick();
}

async function acquireWake() {
  try { if ('wakeLock' in navigator && run) run.wake = await navigator.wakeLock.request('screen'); } catch { /* nepodporované / zamietnuté */ }
}
function releaseWake() { try { run?.wake?.release(); } catch { /* nič */ } if (run) run.wake = null; }

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && run && view.name === 'timer') { acquireWake(); tick(); }
});

/* ---------- ovládanie ---------- */
let previewAudio = null;
function playPreview(i) {
  try { previewAudio?.pause(); } catch { /* nič */ }
  const a = new Audio(URL.createObjectURL(renderPreviewBlob(SOUNDS[i])));
  previewAudio = a; a.play().catch(() => {});
}

function openKeypad(field, kind) {
  const v = view.draft.config[field];
  const digits = kind === 'time' ? String(Math.floor(v / 60) * 100 + v % 60) : String(v);
  keypad = { field, kind, digits: digits === '0' ? '' : digits, fresh: true };
  render();
}

$app.addEventListener('input', e => { if (e.target.id === 'name' && view.draft) { view.draft.name = e.target.value.toUpperCase(); view.draft.nameError = false; } });

$app.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, s = store.get();
  switch (act) {
    case 'settings': go({ name: 'settings' }); break;
    case 'back': go({ name: 'home' }); break;
    case 'hide-hint': localStorage.setItem('tabata.hint', '1'); render(); break;
    case 'new': go({ name: 'edit', draft: { isNew: true, id: store.newId(), name: '', config: { ...DEFAULT_CONFIG } } }); break;
    case 'template': {
      const t = TEMPLATES.find(x => x.id === el.dataset.id);
      go({ name: 'edit', draft: { isNew: true, id: store.newId(), name: t.name, config: { ...t.config } } }); break;
    }
    case 'edit': {
      const w = store.workout(Number(el.dataset.id));
      if (w) go({ name: 'edit', draft: { isNew: false, id: w.id, name: w.name, config: { ...w.config } } }); break;
    }
    case 'start': {
      const w = store.workout(Number(el.dataset.id));
      if (w) startWorkout(w.name, w.config); break;
    }
    case 'field': openKeypad(el.dataset.field, el.dataset.kind); break;
    case 'save': {
      const d = view.draft; d.name = (document.getElementById('name')?.value ?? d.name).trim().toUpperCase();
      if (!d.name) { d.nameError = true; render(); document.getElementById('name')?.focus(); break; }
      store.upsert({ id: d.id, name: d.name, config: normalizeConfig(d.config) });
      go({ name: 'home' }); break;
    }
    case 'delete': {
      const d = view.draft;
      if (!d.confirmDelete) { d.confirmDelete = true; render(); setTimeout(() => { if (view.draft === d && d.confirmDelete) { d.confirmDelete = false; render(); } }, 3000); }
      else { store.remove(d.id); go({ name: 'home' }); }
      break;
    }
    case 'key': {
      const k = el.dataset.k, max = keypad.kind === 'time' ? 4 : 2;
      if (k === 'CLEAR') keypad.digits = '';
      else if (k === '<') keypad.digits = keypad.digits.slice(0, -1);
      else {
        if (keypad.fresh) keypad.digits = ''; // prvá číslica prepíše pôvodnú hodnotu
        if (keypad.digits.length < max) keypad.digits = (keypad.digits + k).replace(/^0+/, '');
      }
      keypad.fresh = false;
      render(); break;
    }
    case 'kp-cancel': keypad = null; render(); break;
    case 'kp-set': {
      const f = keypad.field, n = Number(keypad.digits || 0);
      let v = keypad.kind === 'time' ? Math.floor(n / 100) * 60 + n % 100 : n;
      const min = (f === 'work' || f === 'rounds' || f === 'sets') ? 1 : 0;
      if (v < min) { toast(f === 'work' ? 'WORK MUST BE AT LEAST 0:01' : 'MUST BE AT LEAST 1'); break; }
      view.draft.name = (document.getElementById('name')?.value ?? view.draft.name).toUpperCase();
      view.draft.config[f] = v; view.draft.config = normalizeConfig(view.draft.config);
      keypad = null; render(); break;
    }
    case 'theme': store.set({ theme: Number(el.dataset.i) }); render(); break;
    case 'sound': store.set({ sound: Number(el.dataset.i) }); playPreview(Number(el.dataset.i)); render(); break;
    case 'toggle': store.set({ [el.dataset.k]: !s[el.dataset.k] }); if (el.dataset.k === 'vibrate' && !s.vibrate && navigator.vibrate) navigator.vibrate(80); render(); break;
    case 'pause': setPaused(!run.paused); break;
    case 'skip': skip(); break;
    case 'stop': {
      if (Date.now() - run.stopArm < 2500) { stopRun(); go({ name: 'home' }); }
      else { run.stopArm = Date.now(); el.textContent = 'SURE?'; el.classList.add('danger'); setTimeout(() => { if (el.isConnected) { el.textContent = 'STOP'; el.classList.remove('danger'); } }, 2500); }
      break;
    }
    case 'again': { const r = run; startWorkout(r.name, r.cfg); break; }
    case 'finish': stopRun(); go({ name: 'home' }); break;
  }
});

function gearSvg() {
  return '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/></svg>';
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
render();

// pre testy
window.__tabata = { store, buildPhases, buildCues };
