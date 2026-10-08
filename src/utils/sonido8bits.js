// Sonidos estilo ordenador de los 80 (chiptune) para Cliente del mes.
// Se generan con Web Audio, sin archivos. Usan el mismo AudioContext que el
// resto de la TV, así que se activan con el mismo toque de pantalla.
import { obtenerAudioCompartido } from "./sorteoSound";

const NOTA = (n) => 440 * Math.pow(2, (n - 69) / 12); // número MIDI -> Hz

function tono(midi, inicio, dur, { tipo = "square", vol = 0.09, deslizar = 0, vibrato = 0 } = {}) {
  const a = obtenerAudioCompartido();
  if (!a) return;
  const t = a.currentTime + inicio;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(NOTA(midi), t);
  if (deslizar) o.frequency.exponentialRampToValueAtTime(NOTA(midi + deslizar), t + dur);
  if (vibrato) {
    const lfo = a.createOscillator();
    const lg = a.createGain();
    lfo.frequency.value = 6;
    lg.gain.value = vibrato;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function ruido(inicio, dur, vol = 0.05, { tipo = "highpass", frecuencia = 1800 } = {}) {
  const a = obtenerAudioCompartido();
  if (!a) return;
  const t = a.currentTime + inicio;
  const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource();
  const g = a.createGain();
  const f = a.createBiquadFilter();
  f.type = tipo;
  f.frequency.value = frecuencia;
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

// ---------------------------------------------------------------------
// CELEBRACIÓN DE PUNTOS en la TV grande (al pasar el QR en caja)
// ---------------------------------------------------------------------

// Bocina de coche: dos notas desafinadas (como el claxon real) con filtro,
// fuerte y corta. Una por cada punto que avanza el carrito.
export const sonidoBocina = seguro((variante = 0) => {
  const a = obtenerAudioCompartido();
  if (!a) return;
  const t = a.currentTime;
  const dur = 0.55;
  const master = a.createGain();
  const filtro = a.createBiquadFilter();
  filtro.type = "lowpass";
  filtro.frequency.value = 2400;
  filtro.Q.value = 2;
  master.gain.setValueAtTime(0.0001, t);
  master.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
  master.gain.setValueAtTime(0.22, t + dur - 0.1);
  master.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  // Cada bocinazo un pelín distinto para que no suene a disco rayado.
  const sube = [0, 1.5, -1, 2.5][variante % 4];
  [392, 494].forEach((f, i) => {
    const o = a.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f * Math.pow(2, sube / 12), t);
    o.frequency.linearRampToValueAtTime(f * Math.pow(2, sube / 12) * 0.985, t + dur);
    o.detune.value = i ? 6 : -6;
    o.connect(filtro);
    o.start(t);
    o.stop(t + dur + 0.05);
  });
  filtro.connect(master).connect(a.destination);
});

// Semáforo de salida: pitidos graves y el último agudo y largo (¡YA!)
export const sonidoSemaforo = seguro((verde = false) => {
  if (verde) {
    tono(81, 0, 0.7, { vol: 0.12 });
    tono(69, 0, 0.7, { tipo: "triangle", vol: 0.18 });
  } else {
    tono(69, 0, 0.32, { vol: 0.11 });
    tono(57, 0, 0.32, { tipo: "triangle", vol: 0.16 });
  }
});

// Acelerón del carrito
export const sonidoAcelerar = seguro(() => {
  tono(36, 0, 0.6, { tipo: "sawtooth", vol: 0.09, deslizar: 19 });
  tono(43, 0.05, 0.55, { tipo: "square", vol: 0.04, deslizar: 17 });
  ruido(0, 0.35, 0.04);
});

// Moneda al caer el punto en el marcador
export const sonidoMoneda = seguro(() => {
  tono(83, 0, 0.08, { vol: 0.09 });
  tono(88, 0.08, 0.38, { vol: 0.09 });
});

// Entrada: sirena de recreativa + arpegio
export const sonidoEntradaPuntos = seguro(() => {
  for (let i = 0; i < 4; i += 1) {
    tono(72, i * 0.24, 0.12, { deslizar: 7, vol: 0.07 });
    tono(79, i * 0.24 + 0.12, 0.12, { deslizar: -7, vol: 0.07 });
  }
  [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tono(n, 1.0 + i * 0.05, 0.08, { vol: 0.07 }));
  tono(48, 1.0, 0.5, { tipo: "triangle", vol: 0.18 });
});

// Fuegos artificiales: silbido que sube y estallido
export const sonidoFuegos = seguro((veces = 5) => {
  for (let i = 0; i < veces; i += 1) {
    const t = i * 0.55 + Math.random() * 0.2;
    tono(84 + Math.floor(Math.random() * 6), t, 0.35, { tipo: "sine", vol: 0.035, deslizar: 12 });
    ruido(t + 0.38, 0.5, 0.09);
    tono(36, t + 0.38, 0.25, { tipo: "triangle", vol: 0.2, deslizar: -12 });
  }
});

// Pitido de marcha atrás de camión (broma al líder en la TV)
export const sonidoMarchaAtras = seguro((veces = 6) => {
  for (let i = 0; i < veces; i += 1) {
    tono(83, i * 0.7, 0.38, { tipo: "square", vol: 0.08 });
  }
});

// ---------------------------------------------------------------------
// BROMA AL LÍDER (BromaLiderTV)
// ---------------------------------------------------------------------

// Rascada de caja de cambios al meter la marcha atrás: ¡CRRRRK!
export const sonidoRascada = seguro(() => {
  ruido(0, 0.7, 0.14, { tipo: "bandpass", frecuencia: 900 });
  for (let i = 0; i < 9; i += 1) tono(30 + (i % 3), i * 0.07, 0.06, { tipo: "sawtooth", vol: 0.12 });
  tono(40, 0.65, 0.35, { tipo: "triangle", vol: 0.2, deslizar: -10 });
});

// Un pitido de camión marcha atrás (se repite mientras retrocede)
export const sonidoPitidoAtras = seguro(() => {
  tono(83, 0, 0.32, { tipo: "square", vol: 0.09 });
});

// Tono que cae cada 5 puntos perdidos
export const sonidoBajada = seguro((midi = 60) => {
  tono(midi, 0, 0.1, { vol: 0.06 });
});

// Alarma al cruzar el 0
export const sonidoAlarma = seguro(() => {
  for (let i = 0; i < 3; i += 1) tono(76, i * 0.4, 0.4, { tipo: "sawtooth", vol: 0.06, deslizar: -12 });
  ruido(0, 0.3, 0.08);
});

// Golpe seco al pararse en -50
export const sonidoGolpe = seguro(() => {
  ruido(0, 0.4, 0.18, { tipo: "lowpass", frecuencia: 400 });
  tono(31, 0, 0.5, { tipo: "triangle", vol: 0.3, deslizar: -12 });
});

// Trombón triste: wah-wah-wah-waaah
export const sonidoTrombonTriste = seguro(() => {
  let t = 0;
  [[55, 0.45], [54, 0.45], [53, 0.45], [52, 1.5]].forEach(([n, d]) => {
    tono(n, t, d, { tipo: "sawtooth", vol: 0.07, vibrato: d > 1 ? 7 : 0 });
    tono(n - 12, t, d, { tipo: "triangle", vol: 0.12 });
    t += d;
  });
});

// Risita de "¡es broma!"
export const sonidoRisa = seguro(() => {
  [0, 0.14, 0.28, 0.42, 0.56].forEach((t, i) => tono(84 - i, t, 0.1, { vol: 0.06, deslizar: -3 }));
});
