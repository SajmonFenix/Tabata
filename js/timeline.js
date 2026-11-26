// Skladanie tréningu do fáz a zvukových signálov (cue). Čistá logika bez DOM-u.

export const DEFAULT_CONFIG = { prep: 10, work: 20, rest: 10, rounds: 8, sets: 1, setRest: 60 };

export const TEMPLATES = [
  { id: 'tpl-tabata', name: 'TABATA', hint: 'WORK 0:20 · REST 0:10 · 8 ROUNDS',
    config: { prep: 10, work: 20, rest: 10, rounds: 8, sets: 1, setRest: 60 } },
  { id: 'tpl-hiit', name: 'HIIT', hint: 'WORK 0:30 OR LONGER',
    config: { prep: 10, work: 40, rest: 20, rounds: 10, sets: 1, setRest: 60 } },
  { id: 'tpl-emom', name: 'EMOM', hint: 'EVERY MINUTE ON THE MINUTE',
    config: { prep: 10, work: 60, rest: 0, rounds: 10, sets: 1, setRest: 60 } },
];

export function normalizeConfig(c) {
  const n = (v, lo, hi, d) => {
    v = Math.round(Number(v));
    if (!Number.isFinite(v)) v = d;
    return Math.min(hi, Math.max(lo, v));
  };
  return {
    prep: n(c.prep, 0, 5999, DEFAULT_CONFIG.prep),
    work: n(c.work, 1, 5999, DEFAULT_CONFIG.work),
    rest: n(c.rest, 0, 5999, DEFAULT_CONFIG.rest),
    rounds: n(c.rounds, 1, 99, DEFAULT_CONFIG.rounds),
    sets: n(c.sets, 1, 99, DEFAULT_CONFIG.sets),
    setRest: n(c.setRest, 0, 5999, DEFAULT_CONFIG.setRest),
  };
}

/**
 * Fázy: GET READY -> (WORK, REST)xrounds, medzi setmi SET REST.
 * Po poslednom WORK-u nasleduje rovno koniec. Nulové fázy sa vynechajú.
 */
export function buildPhases(cfg) {
  const c = normalizeConfig(cfg);
  const phases = [];
  let t = 0;
  const push = (type, dur, set, round) => {
    if (dur <= 0) return;
    phases.push({ type, start: t, dur, end: t + dur, set, sets: c.sets, round, rounds: c.rounds });
    t += dur;
  };
  push('prep', c.prep, 1, 1);
  for (let s = 1; s <= c.sets; s++) {
    for (let r = 1; r <= c.rounds; r++) {
      push('work', c.work, s, r);
      const lastRound = r === c.rounds;
      const lastSet = s === c.sets;
      if (lastRound && lastSet) continue;
      if (lastRound) push('setrest', c.setRest > 0 ? c.setRest : c.rest, s, r);
      else push('rest', c.rest, s, r);
    }
  }
  return { phases, total: t };
}

/** Celkový čas bez GET READY (zobrazuje sa v zozname). */
export function totalTime(cfg) {
  const { phases, total } = buildPhases(cfg);
  const prep = phases.length && phases[0].type === 'prep' ? phases[0].dur : 0;
  return total - prep;
}

/**
 * Zvukové signály: CD3/CD2/CD1 posledné 3 s fázy, GO na začiatku WORK,
 * REST na začiatku odpočinku, HALF v polovici WORK, FINISH na konci.
 */
export function buildCues(phases, total, { halfway = false } = {}) {
  const cues = [];
  for (const p of phases) {
    if (p.type === 'work') cues.push({ t: p.start, cue: 'GO' });
    else if (p.type === 'rest' || p.type === 'setrest') cues.push({ t: p.start, cue: 'REST' });
    for (const k of [3, 2, 1]) {
      const t = p.end - k;
      if (t > p.start + 0.5) cues.push({ t, cue: 'CD' + k });
    }
    if (halfway && p.type === 'work' && p.dur >= 10) cues.push({ t: p.start + p.dur / 2, cue: 'HALF' });
  }
  cues.push({ t: total, cue: 'FINISH' });
  cues.sort((a, b) => a.t - b.t);
  return cues;
}

export function phaseAt(phases, t) {
  for (let i = 0; i < phases.length; i++) if (t < phases[i].end) return i;
  return phases.length; // hotovo
}

export function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

export const PHASE_LABEL = { prep: 'GET READY', work: 'WORK', rest: 'REST', setrest: 'SET REST' };
