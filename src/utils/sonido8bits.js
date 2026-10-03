// Sonidos estilo ordenador de los 80 (chiptune) para Cliente del mes.
// Se generan con Web Audio, sin archivos. Usan el mismo AudioContext que el
// resto de la TV, así que se activan con el mismo toque de pantalla.
import { obtenerAudioCompartido } from "./sorteoSound";

const NOTA = (n) => 440 * Math.pow(2, (n - 69) / 12); // número MIDI -> Hz

function tono(midi, inicio, dur, { tipo = "square", vol = 0.09, deslizar = 0 } = {}) {
  const a = obtenerAudioCompartido();
  if (!a) return;
  const t = a.currentTime + inicio;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(NOTA(midi), t);
  if (deslizar) o.frequency.exponentialRampToValueAtTime(NOTA(midi + deslizar), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function ruido(inicio, dur, vol = 0.05) {
  const a = obtenerAudioCompartido();
  if (!a) return;
  const t = a.currentTime + inicio;
  const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource();
  const g = a.createGain();
  const f = a.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 1800;
  s.buffer = buf;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(a.destination);
  s.start(t);
}

function seguro(fn) {
  return (...args) => {
    try {
      fn(...args);
    } catch (error) {
      console.warn("Sonido 8 bits no disponible:", error);
    }
  };
}

// "¡Fin de la carrera!": arpegio rápido y nota larga
export const sonidoFinCarrera = seguro(() => {
  [72, 76, 79, 84].forEach((n, i) => tono(n, i * 0.09, 0.1));
  tono(88, 0.38, 0.45, { vol: 0.08 });
  tono(48, 0.38, 0.45, { tipo: "triangle", vol: 0.18 });
});

// Cofres temblando: traqueteo
export const sonidoTemblor = seguro((duracion = 1) => {
  for (let t = 0; t < duracion; t += 0.11) {
    ruido(t, 0.04, 0.035);
    tono(40 + (Math.floor(t * 20) % 3), t, 0.05, { tipo: "triangle", vol: 0.12 });
  }
});

// Cofre que se abre: subida tipo "power-up" y destellos (alto: semitonos)
export const sonidoAbrirCofre = seguro((alto = 0) => {
  tono(60 + alto, 0, 0.18, { deslizar: 12, vol: 0.07 });
  [76, 80, 83, 88].forEach((n, i) => tono(n + alto, 0.18 + i * 0.06, 0.07, { vol: 0.07 }));
  [96, 100, 103].forEach((n, i) => tono(n + alto, 0.48 + i * 0.07, 0.09, { tipo: "triangle", vol: 0.06 }));
});

// Fanfarria del 1º puesto
export const sonidoVictoria = seguro(() => {
  const melodia = [[67, 0.12], [72, 0.12], [76, 0.12], [79, 0.3], [76, 0.12], [79, 0.6]];
  let t = 0;
  melodia.forEach(([n, d]) => {
    tono(n, t, d * 0.95, { vol: 0.08 });
    tono(n - 12, t, d * 0.95, { tipo: "triangle", vol: 0.12 });
    t += d;
  });
  [48, 55, 60].forEach((n, i) => tono(n, i * 0.42, 0.4, { tipo: "triangle", vol: 0.14 }));
});

// Aviso que salta en el móvil
export const sonidoAviso = seguro(() => {
  tono(84, 0, 0.08, { vol: 0.07 });
  tono(91, 0.09, 0.16, { vol: 0.07 });
});

// Premio en el móvil: abrir + melodía de "objeto conseguido"
export const sonidoPremioMovil = seguro(() => {
  sonidoAbrirCofre(0);
  let t = 0.75;
  [[79, 0.1], [84, 0.1], [88, 0.1], [91, 0.35]].forEach(([n, d]) => {
    tono(n, t, d, { vol: 0.07 });
    t += d;
  });
});

// En el móvil hay que despertar el audio dentro de un toque.
export function despertarAudio() {
  try {
    obtenerAudioCompartido();
  } catch {
    // sin audio
  }
}
