// Sonidos del REPOSTAJE EXTRA (Cliente del mes): alarma de reserva, petardeo
// del motor, manguera, "glug" de gasolina, rugido y salida. Estilo 8 bits,
// generados con Web Audio (sin archivos) y con el mismo AudioContext que el
// resto de la TV, así que se activan con el mismo toque de pantalla.
import { obtenerAudioCompartido } from "./sorteoSound";

const NOTA = (n) => 440 * Math.pow(2, (n - 69) / 12);

function tono(midi, ini, dur, { tipo = "square", vol = 0.09, deslizar = 0, vibrato = 0 } = {}) {
  const a = obtenerAudioCompartido();
  if (!a) return;
  const t = a.currentTime + ini;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(NOTA(midi), t);
  if (deslizar) o.frequency.exponentialRampToValueAtTime(NOTA(midi + deslizar), t + dur);
  if (vibrato) {
    const l = a.createOscillator();
    const lg = a.createGain();
    l.frequency.value = 7;
    lg.gain.value = vibrato;
    l.connect(lg).connect(o.frequency);
    l.start(t);
    l.stop(t + dur + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function ruido(ini, dur, vol = 0.05, { tipo = "highpass", f = 1800, fFin = 0 } = {}) {
  const a = obtenerAudioCompartido();
  if (!a) return;
  const t = a.currentTime + ini;
  const b = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource();
  const g = a.createGain();
  const fl = a.createBiquadFilter();
  fl.type = tipo;
  fl.frequency.setValueAtTime(f, t);
  if (fFin) fl.frequency.exponentialRampToValueAtTime(fFin, t + dur);
  s.buffer = b;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl).connect(g).connect(a.destination);
  s.start(t);
}

function seguro(fn) {
  return (...args) => {
    try {
      fn(...args);
    } catch (error) {
      console.warn("Sonido de repostaje no disponible:", error);
    }
  };
}

export const repEntrada = seguro(() => {
  [60, 64, 67, 72].forEach((n, i) => tono(n, i * 0.07, 0.09));
  ruido(0, 0.3, 0.05);
});

// "wah-wah-waaah": pocos puntos
export const repTrombon = seguro(() => {
  [55, 54, 53].forEach((n, i) => tono(n, i * 0.38, 0.36, { tipo: "sawtooth", vol: 0.07, vibrato: 3 }));
  tono(52, 1.14, 0.9, { tipo: "sawtooth", vol: 0.07, deslizar: -2, vibrato: 6 });
});

export const repAlarma = seguro(() => {
  for (let i = 0; i < 8; i += 1) tono(i % 2 ? 76 : 81, i * 0.22, 0.2, { vol: 0.07 });
});

// Motor que se ahoga sin gasolina
export const repPetardeo = seguro(() => {
  for (let i = 0; i < 9; i += 1) {
    const t = i * 0.21 + Math.random() * 0.06;
    ruido(t, 0.07, 0.12, { tipo: "lowpass", f: 420 });
    tono(31 + Math.random() * 4, t, 0.08, { tipo: "square", vol: 0.1 });
  }
  ruido(1.9, 0.18, 0.25, { tipo: "lowpass", f: 900 });
});

export const repBoxes = seguro(() => {
  [67, 72, 76, 79, 84].forEach((n, i) => tono(n, i * 0.06, 0.08));
  tono(88, 0.32, 0.3, { vol: 0.07 });
});

// Manguera que se engancha
export const repClank = seguro(() => {
  ruido(0, 0.08, 0.3, { tipo: "bandpass", f: 2600 });
  tono(84, 0, 0.05, { vol: 0.08 });
  tono(79, 0.06, 0.12, { tipo: "triangle", vol: 0.15 });
  ruido(0.2, 0.6, 0.06, { tipo: "lowpass", f: 600, fFin: 2000 });
});

// Chorro continuo de gasolina
export const repChorro = seguro((dur = 5) => {
  ruido(0, dur, 0.07, { tipo: "bandpass", f: 500, fFin: 1400 });
});

// Un "glug", cada vez más agudo (el depósito se va llenando)
export const repGlug = seguro((i = 1) => {
  const base = 50 + i * 4;
  tono(base, 0, 0.11, { tipo: "sine", vol: 0.25, deslizar: 10 });
  tono(base + 3, 0.13, 0.1, { tipo: "sine", vol: 0.22, deslizar: 12 });
  tono(base + 7, 0.26, 0.14, { tipo: "sine", vol: 0.25, deslizar: 14 });
  ruido(0, 0.4, 0.04, { tipo: "lowpass", f: 700 });
});

export const repMoneda = seguro(() => {
  tono(83, 0, 0.07, { vol: 0.08 });
  tono(88, 0.07, 0.22, { vol: 0.08 });
});

export const repLleno = seguro(() => {
  [72, 76, 79, 84, 88, 91].forEach((n, i) => tono(n, i * 0.07, 0.1, { vol: 0.08 }));
  tono(96, 0.45, 0.5, { vol: 0.06, vibrato: 8 });
  tono(48, 0.45, 0.5, { tipo: "triangle", vol: 0.18 });
});

// Rugido del motor subiendo de vueltas
export const repRugido = seguro(() => {
  const a = obtenerAudioCompartido();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const o2 = a.createOscillator();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  o.type = "sawtooth";
  o2.type = "square";
  o.frequency.setValueAtTime(42, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.4);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.6);
  o.frequency.exponentialRampToValueAtTime(190, t + 1.6);
  o2.frequency.setValueAtTime(21, t);
  o2.frequency.exponentialRampToValueAtTime(95, t + 1.6);
  f.type = "lowpass";
  f.frequency.setValueAtTime(500, t);
  f.frequency.exponentialRampToValueAtTime(2600, t + 1.6);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.08);
  g.gain.setValueAtTime(0.22, t + 1.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
  o.connect(f);
  o2.connect(f);
  f.connect(g).connect(a.destination);
  o.start(t);
  o2.start(t);
  o.stop(t + 2.5);
  o2.stop(t + 2.5);
  ruido(0, 1.6, 0.05, { tipo: "lowpass", f: 300, fFin: 3000 });
});

// Salida disparada: explosión
export const repSalida = seguro(() => {
  ruido(0, 0.9, 0.35, { tipo: "lowpass", f: 3000, fFin: 120 });
  tono(36, 0, 0.6, { tipo: "triangle", vol: 0.3, deslizar: -12 });
  for (let i = 0; i < 6; i += 1) tono(72 + i * 3, 0.05 + i * 0.05, 0.08, { vol: 0.05 });
});

export const repVictoria = seguro(() => {
  const m = [[72, 0.12], [72, 0.12], [72, 0.12], [76, 0.36], [74, 0.12], [77, 0.12], [79, 0.6]];
  let t = 0;
  m.forEach(([n, d]) => {
    tono(n, t, d * 0.95, { vol: 0.08 });
    tono(n - 12, t, d * 0.95, { tipo: "triangle", vol: 0.12 });
    t += d;
  });
  [84, 88, 91, 96].forEach((n, i) => tono(n, t + i * 0.08, 0.12, { vol: 0.06 }));
});

export const repFuegos = seguro((n = 6) => {
  for (let i = 0; i < n; i += 1) {
    const t = i * 0.45;
    tono(60 + Math.random() * 12, t, 0.35, { tipo: "triangle", vol: 0.05, deslizar: 24 });
    ruido(t + 0.35, 0.5, 0.12, { tipo: "lowpass", f: 1500, fFin: 200 });
  }
});

// Frenazo seco al salir la señal de STOP
export const repFrenazo = seguro(() => {
  ruido(0, 0.9, 0.22, { tipo: "bandpass", f: 3200, fFin: 900 });
  tono(88, 0, 0.8, { tipo: "sawtooth", vol: 0.04, deslizar: -10, vibrato: 18 });
  ruido(0.85, 0.25, 0.3, { tipo: "lowpass", f: 700 });
  tono(33, 0.85, 0.3, { tipo: "triangle", vol: 0.3, deslizar: -5 });
});

// Sirena de policía (sube y baja), "dur" segundos
export const repSirena = seguro((dur = 3.6) => {
  const a = obtenerAudioCompartido();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const o2 = a.createOscillator();
  const g = a.createGain();
  o.type = "square";
  o2.type = "sawtooth";
  const ciclo = 0.9;
  for (let x = 0; x < dur; x += ciclo) {
    o.frequency.setValueAtTime(640, t + x);
    o.frequency.linearRampToValueAtTime(1280, t + x + ciclo / 2);
    o.frequency.linearRampToValueAtTime(640, t + x + ciclo);
    o2.frequency.setValueAtTime(645, t + x);
    o2.frequency.linearRampToValueAtTime(1290, t + x + ciclo / 2);
    o2.frequency.linearRampToValueAtTime(645, t + x + ciclo);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.05);
  g.gain.setValueAtTime(0.06, t + dur - 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  o2.connect(g);
  g.connect(a.destination);
  o.start(t);
  o2.start(t);
  o.stop(t + dur + 0.05);
  o2.stop(t + dur + 0.05);
});
