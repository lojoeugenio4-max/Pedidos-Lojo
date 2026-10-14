// Sonidos de LojoPoly, generados con Web Audio (sin archivos).
// Mismos sonidos que el boceto aprobado: dado agitándose, botes, campanazo,
// marimba en cada paso de la ficha y fanfarria al completar un grupo.
//
// Un único AudioContext compartido; se reanuda en cada sonido porque el
// navegador lo deja pausado si se creó fuera de un gesto del usuario.

let ac = null;
let master = null;
let ruido = null;

function contexto() {
  if (typeof window === "undefined") return null;
  try {
    if (!ac) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ac = new Ctx();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master = ac.createGain();
      master.gain.value = 0.9;
      master.connect(comp).connect(ac.destination);
      ruido = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const datos = ruido.getChannelData(0);
      for (let i = 0; i < datos.length; i += 1) datos[i] = Math.random() * 2 - 1;
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  } catch {
    return null;
  }
}

function tono(f, { type = "sine", t = 0, dur = 0.3, vol = 0.2, to = null, att = 0.005 } = {}) {
  const a = contexto();
  if (!a) return;
  try {
    const o = a.createOscillator();
    const g = a.createGain();
    const s = a.currentTime + t;
    o.type = type;
    o.frequency.setValueAtTime(f, s);
    if (to) o.frequency.exponentialRampToValueAtTime(to, s + dur);
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(vol, s + att);
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    o.connect(g).connect(master);
    o.start(s);
    o.stop(s + dur + 0.02);
  } catch {
    // sin sonido
  }
}

function soplido({ t = 0, dur = 0.05, vol = 0.3, type = "bandpass", f = 3000, q = 1 } = {}) {
  const a = contexto();
  if (!a) return;
  try {
    const src = a.createBufferSource();
    const fl = a.createBiquadFilter();
    const g = a.createGain();
    const s = a.currentTime + t;
    src.buffer = ruido;
    fl.type = type;
    fl.frequency.value = f;
    fl.Q.value = q;
    g.gain.setValueAtTime(vol, s);
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    src.connect(fl).connect(g).connect(master);
    src.start(s, Math.random() * 0.5);
    src.stop(s + dur + 0.02);
  } catch {
    // sin sonido
  }
}

export const sonidoLojoPoly = {
  preparar() {
    contexto();
  },
  agitar(ms) {
    for (let t = 0; t < ms / 1000; t += 0.045 + Math.random() * 0.03) {
      soplido({ t, dur: 0.04, vol: 0.35 + Math.random() * 0.25, f: 2500 + Math.random() * 2500, q: 4 });
      tono(1800 + Math.random() * 900, { type: "square", t, dur: 0.02, vol: 0.05 });
    }
    for (let t = 0; t < ms / 1000; t += 0.03) soplido({ t, dur: 0.03, vol: 0.06 + t * 0.25, type: "lowpass", f: 400, q: 0.7 });
  },
  bote(p = 1) {
    tono(140 * p, { dur: 0.18, vol: 0.55 * p, to: 45 });
    soplido({ dur: 0.03, vol: 0.6 * p, type: "highpass", f: 1800 });
    tono(900 + Math.random() * 300, { type: "triangle", dur: 0.06, vol: 0.18 * p });
  },
  resultado() {
    [784, 988, 1175].forEach((f, i) => tono(f, { type: "triangle", t: i * 0.07, dur: 0.5, vol: 0.18 }));
    tono(1568, { t: 0.21, dur: 0.9, vol: 0.12 });
    soplido({ t: 0.21, dur: 0.6, vol: 0.18, type: "highpass", f: 6000 });
  },
  paso(k) {
    const escala = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];
    const f = escala[Math.min(k, escala.length - 1)];
    tono(f, { dur: 0.22, vol: 0.35 });
    tono(f * 4, { dur: 0.05, vol: 0.08 });
    tono(f / 2, { type: "triangle", dur: 0.12, vol: 0.12 });
    soplido({ dur: 0.025, vol: 0.25, f: 1200, q: 6 });
  },
  caer() {
    tono(220, { dur: 0.25, vol: 0.5, to: 90 });
    soplido({ dur: 0.06, vol: 0.4, type: "lowpass", f: 900 });
  },
  nueva() {
    [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tono(f, { type: "triangle", t: i * 0.06, dur: 0.35, vol: 0.16 }));
    soplido({ t: 0.2, dur: 0.8, vol: 0.12, type: "highpass", f: 7000 });
  },
  repetida() {
    tono(392, { type: "sawtooth", dur: 0.25, vol: 0.08, to: 370 });
    tono(330, { type: "sawtooth", t: 0.25, dur: 0.45, vol: 0.08, to: 290 });
  },
  premioPequeno() {
    [659, 784, 1047].forEach((f, i) => tono(f, { type: "square", t: i * 0.09, dur: 0.25, vol: 0.07 }));
  },
  salida() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tono(f, { type: "square", t: i * 0.05, dur: 0.2, vol: 0.06 }));
  },
  fanfarria() {
    const notas = [[523, 0], [523, 0.12], [523, 0.24], [659, 0.36], [784, 0.6], [659, 0.84], [784, 0.96], [1047, 1.2]];
    notas.forEach(([f, t]) => {
      tono(f, { type: "sawtooth", t, dur: 0.32, vol: 0.09 });
      tono(f * 2, { type: "square", t, dur: 0.2, vol: 0.04 });
    });
    [523, 659, 784, 1047].forEach((f) => tono(f, { type: "triangle", t: 1.2, dur: 1.6, vol: 0.12 }));
    soplido({ t: 1.2, dur: 1.8, vol: 0.4, type: "highpass", f: 5000 });
    tono(80, { t: 1.2, dur: 0.6, vol: 0.6, to: 40 });
    for (let t = 0; t < 1.1; t += 0.04) soplido({ t, dur: 0.04, vol: 0.05 + t * 0.15, type: "lowpass", f: 500 });
  },
};

// Tiempos de la animación de una tirada (ms). Los usan la TV y el TPV para
// ir a la par: el TPV no deja tirar otra vez hasta que la TV ha terminado.
export const TIEMPOS_TIRADA = {
  agitar: 700,
  lanzar: 1350,
  pausa: 450,
  paso: 330,
  resultado: 700,
};

export function duracionTirada(dado) {
  const t = TIEMPOS_TIRADA;
  return t.agitar + t.lanzar + t.pausa + Math.max(1, Number(dado) || 1) * t.paso + t.resultado;
}
