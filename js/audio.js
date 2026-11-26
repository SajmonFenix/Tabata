// Syntéza zvukov a vyrenderovanie celého tréningu do jedného WAV súboru.
// iPhone prehráva <audio> aj so zamknutou obrazovkou, preto sú signály "zapečené" do stopy.

export const SOUNDS = ['CLASSIC', 'DIGITAL', 'RISING', 'BOXING GONG'];
export const SAMPLE_RATE = 8000; // dosť pre tóny do ~3 kHz, a stopa zostane malá (16 kB/s)

const TAU = Math.PI * 2;

function addTone(buf, sr, t0, dur, freq, vol, { wave = 'sine', attack = 0.004, decay = 6, freqEnd = null } = {}) {
  const start = Math.floor(t0 * sr);
  const n = Math.floor(dur * sr);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const idx = start + i;
    if (idx < 0 || idx >= buf.length) continue;
    const t = i / sr;
    const f = freqEnd ? freq + (freqEnd - freq) * (t / dur) : freq;
    phase += (TAU * f) / sr;
    let s = wave === 'square' ? (Math.sin(phase) >= 0 ? 0.6 : -0.6) : Math.sin(phase);
    const env = Math.min(1, t / attack) * Math.exp(-decay * t / dur) * Math.min(1, (dur - t) / 0.006);
    buf[idx] += s * env * vol;
  }
}

function gong(buf, sr, t0, base, vol, len) {
  const partials = [[1, 1], [2.76, 0.6], [5.4, 0.35], [6.6, 0.2]];
  for (const [r, a] of partials) {
    const f = base * r;
    if (f > sr / 2 - 300) continue;
    addTone(buf, sr, t0, len, f, vol * a * 0.55, { attack: 0.002, decay: 4.5 + r * 0.6 });
  }
}

// Každý zvukový štýl: cue -> funkcia, ktorá pridá tóny do bufferu v čase t
const STYLES = {
  CLASSIC: {
    CD3: (b, sr, t) => addTone(b, sr, t, 0.14, 880, 0.7, { decay: 2 }),
    CD2: (b, sr, t) => addTone(b, sr, t, 0.14, 880, 0.7, { decay: 2 }),
    CD1: (b, sr, t) => addTone(b, sr, t, 0.14, 880, 0.7, { decay: 2 }),
    GO: (b, sr, t) => addTone(b, sr, t, 0.6, 1320, 0.8, { decay: 2.5 }),
    REST: (b, sr, t) => { addTone(b, sr, t, 0.2, 660, 0.75, { decay: 2 }); addTone(b, sr, t + 0.24, 0.4, 495, 0.75, { decay: 2.5 }); },
    HALF: (b, sr, t) => { addTone(b, sr, t, 0.09, 990, 0.6, { decay: 2 }); addTone(b, sr, t + 0.14, 0.09, 990, 0.6, { decay: 2 }); },
    FINISH: (b, sr, t) => { [880, 1100, 1320].forEach((f, i) => addTone(b, sr, t + i * 0.2, 0.16, f, 0.8, { decay: 2 })); addTone(b, sr, t + 0.65, 0.9, 1760, 0.8, { decay: 3 }); },
  },
  DIGITAL: {
    CD3: (b, sr, t) => addTone(b, sr, t, 0.08, 1000, 0.55, { wave: 'square', decay: 0.5 }),
    CD2: (b, sr, t) => addTone(b, sr, t, 0.08, 1000, 0.55, { wave: 'square', decay: 0.5 }),
    CD1: (b, sr, t) => addTone(b, sr, t, 0.08, 1000, 0.55, { wave: 'square', decay: 0.5 }),
    GO: (b, sr, t) => addTone(b, sr, t, 0.5, 2000, 0.5, { wave: 'square', decay: 0.8 }),
    REST: (b, sr, t) => { addTone(b, sr, t, 0.12, 700, 0.5, { wave: 'square', decay: 0.5 }); addTone(b, sr, t + 0.16, 0.3, 500, 0.5, { wave: 'square', decay: 0.8 }); },
    HALF: (b, sr, t) => { addTone(b, sr, t, 0.06, 1500, 0.45, { wave: 'square', decay: 0.4 }); addTone(b, sr, t + 0.1, 0.06, 1500, 0.45, { wave: 'square', decay: 0.4 }); },
    FINISH: (b, sr, t) => { for (let i = 0; i < 4; i++) addTone(b, sr, t + i * 0.16, 0.1, 1800, 0.5, { wave: 'square', decay: 0.4 }); addTone(b, sr, t + 0.8, 0.7, 1200, 0.5, { wave: 'square', decay: 1.2 }); },
  },
  RISING: {
    CD3: (b, sr, t) => addTone(b, sr, t, 0.16, 600, 0.7, { decay: 2 }),
    CD2: (b, sr, t) => addTone(b, sr, t, 0.16, 800, 0.7, { decay: 2 }),
    CD1: (b, sr, t) => addTone(b, sr, t, 0.16, 1000, 0.7, { decay: 2 }),
    GO: (b, sr, t) => addTone(b, sr, t, 0.55, 700, 0.8, { decay: 1.5, freqEnd: 1500 }),
    REST: (b, sr, t) => addTone(b, sr, t, 0.55, 1200, 0.75, { decay: 1.5, freqEnd: 500 }),
    HALF: (b, sr, t) => addTone(b, sr, t, 0.22, 800, 0.6, { decay: 2, freqEnd: 1100 }),
    FINISH: (b, sr, t) => { [600, 750, 900, 1200, 1500].forEach((f, i) => addTone(b, sr, t + i * 0.13, 0.15, f, 0.8, { decay: 2 })); addTone(b, sr, t + 0.7, 0.9, 1800, 0.8, { decay: 3 }); },
  },
  'BOXING GONG': {
    CD3: (b, sr, t) => addTone(b, sr, t, 0.07, 1800, 0.6, { attack: 0.001, decay: 7 }),
    CD2: (b, sr, t) => addTone(b, sr, t, 0.07, 1800, 0.6, { attack: 0.001, decay: 7 }),
    CD1: (b, sr, t) => addTone(b, sr, t, 0.07, 1800, 0.6, { attack: 0.001, decay: 7 }),
    GO: (b, sr, t) => gong(b, sr, t, 420, 0.9, 1.6),
    REST: (b, sr, t) => gong(b, sr, t, 300, 0.9, 1.4),
    HALF: (b, sr, t) => addTone(b, sr, t, 0.12, 1400, 0.5, { attack: 0.001, decay: 6 }),
    FINISH: (b, sr, t) => { gong(b, sr, t, 420, 0.9, 1.4); gong(b, sr, t + 0.55, 420, 0.9, 1.4); gong(b, sr, t + 1.1, 420, 0.9, 2.0); },
  },
};

/**
 * Vyrenderuje stopu po jednotlivých signáloch: každý cue sa vysyntetizuje do malého
 * dočasného bufferu a pripočíta do Int16 poľa (60 min tréning ~ 57 MB, nie stovky MB).
 */
export function renderCueList(cues, totalSec, sound, sr = SAMPLE_RATE) {
  const style = STYLES[sound] || STYLES.CLASSIC;
  const tail = 2.6; // dozvuk po FINISH
  const pcm = new Int16Array(Math.ceil((totalSec + tail) * sr));
  const scratch = new Float32Array(Math.ceil(3.6 * sr));
  for (const { t, cue } of cues) {
    scratch.fill(0);
    style[cue]?.(scratch, sr, 0);
    const off = Math.floor(t * sr);
    for (let i = 0; i < scratch.length; i++) {
      const j = off + i;
      if (j >= pcm.length) break;
      const v = scratch[i];
      if (v === 0) continue;
      const x = pcm[j] + Math.round(Math.tanh(v * 1.1) * 30000);
      pcm[j] = x > 32767 ? 32767 : x < -32768 ? -32768 : x;
    }
  }
  return pcm;
}

function wavHeader(samples, sr) {
  const dataLen = samples * 2;
  const out = new ArrayBuffer(44);
  const dv = new DataView(out);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  w(36, 'data'); dv.setUint32(40, dataLen, true);
  return new Uint8Array(out);
}

export function pcmToWavBytes(pcm, sr = SAMPLE_RATE) {
  const head = wavHeader(pcm.length, sr);
  const out = new Uint8Array(44 + pcm.length * 2);
  out.set(head, 0);
  out.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), 44);
  return out;
}

export function renderWorkoutBlob(cues, totalSec, sound) {
  const pcm = renderCueList(cues, totalSec, sound);
  return new Blob([wavHeader(pcm.length, SAMPLE_RATE), pcm], { type: 'audio/wav' }); // bez kópie dát
}

/** Krátky náhľad zvuku (GO + REST + FINISH) pre obrazovku nastavení. */
export function renderPreviewBlob(sound) {
  const cues = [{ t: 0.1, cue: 'CD1' }, { t: 1.1, cue: 'GO' }, { t: 2.6, cue: 'REST' }, { t: 4.0, cue: 'FINISH' }];
  return new Blob([pcmToWavBytes(renderCueList(cues, 4.0, sound))], { type: 'audio/wav' });
}
