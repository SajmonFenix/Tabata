// Ukladanie do localStorage (tréningy + nastavenia).
import { DEFAULT_CONFIG, normalizeConfig } from './timeline.js';

const KEY = 'tabata.v1';

export const THEMES = [
  { name: 'GRAPHITE', work: { bg: '#17191C', fg: '#FF7A2C', btn: '#1D2023' }, rest: { bg: '#17191C', fg: '#F2F2F0', btn: '#1D2023' }, labelAlpha: 0.6 },
  { name: 'MUSTARD', work: { bg: '#E3A92B', fg: '#17191C', btn: '#D79D20' }, rest: { bg: '#17191C', fg: '#E3A92B', btn: '#1D2023' }, labelAlpha: 0.65 },
  { name: 'ELECTRIC BLUE', work: { bg: '#0A1226', fg: '#3D9BFF', btn: '#101B35' }, rest: { bg: '#0A1226', fg: '#F2F5FF', btn: '#101B35' }, labelAlpha: 0.6 },
  { name: 'PINK', work: { bg: '#EE2F78', fg: '#FFFFFF', btn: '#E0256C' }, rest: { bg: '#FFFFFF', fg: '#EE2F78', btn: '#FBE6EE' }, labelAlpha: 0.85 },
];

const DEFAULTS = { workouts: [], theme: 0, sound: 0, halfway: false, vibrate: true, templates: true };

let state = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw) return { ...DEFAULTS };
    const s = { ...DEFAULTS, ...raw };
    s.workouts = (raw.workouts || []).map(w => ({ id: w.id, name: String(w.name || ''), config: normalizeConfig(w.config || DEFAULT_CONFIG) }));
    s.theme = Math.min(THEMES.length - 1, Math.max(0, s.theme | 0));
    s.sound = Math.min(3, Math.max(0, s.sound | 0));
    return s;
  } catch { return { ...DEFAULTS }; }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* súkromný režim / plné úložisko */ }
}

export const store = {
  get: () => state,
  set(patch) { state = { ...state, ...patch }; save(); },
  workout: id => state.workouts.find(w => w.id === id),
  upsert(w) {
    const i = state.workouts.findIndex(x => x.id === w.id);
    const workouts = state.workouts.slice();
    if (i >= 0) workouts[i] = w; else workouts.push(w);
    state = { ...state, workouts }; save();
  },
  remove(id) { state = { ...state, workouts: state.workouts.filter(w => w.id !== id) }; save(); },
  newId: () => Date.now() + Math.floor(Math.random() * 1000),
};
