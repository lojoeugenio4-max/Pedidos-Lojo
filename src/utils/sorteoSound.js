// Sonido y voz para la cuadrícula del Sorteo, en la pantalla grande (TV).
// Mismo patrón que ya se usa y probó en BingoDrumStage.jsx: un único
// AudioContext compartido y reutilizado (crear uno nuevo por sonido hace
// que el navegador lo deje "pausado" para siempre si no se reanuda dentro
// de un gesto del usuario, y en la TV no hay gesto de usuario en cada bola).
let sorteoAudioContext = null;

function obtenerAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sorteoAudioContext) {
    sorteoAudioContext = new AudioContextClass();
  }
  sorteoAudioContext.resume?.().catch(() => {});
  return sorteoAudioContext;
}

// Campanilla de dos notas ascendentes, tipo "acierto"/moneda, corta y
// clara para que se note al instante que se ha rellenado una casilla.
export function playSorteoDing() {
  try {
    const ctx = obtenerAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);

    [880, 1318.5].forEach((frecuencia, indice) => {
      const at = t + indice * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frecuencia, at);
      gain.gain.setValueAtTime(0.001, at);
      gain.gain.exponentialRampToValueAtTime(0.32, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.55);
      osc.connect(gain).connect(master);
      osc.start(at);
      osc.stop(at + 0.6);
    });
  } catch (error) {
    console.warn("Audio del Sorteo no disponible:", error);
  }
}

// --- Sorteo en directo (rotación de números) -----------------------------

// Clic seco y corto, como el trinquete de una ruleta al pasar cada número.
export function playSorteoTick() {
  try {
    const ctx = obtenerAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1500, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.03);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.09, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  } catch (error) {
    console.warn("Audio del Sorteo no disponible:", error);
  }
}

// Golpe grave + campanilla: una rueda se acaba de parar.
export function playSorteoParada() {
  try {
    const ctx = obtenerAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const golpe = ctx.createOscillator();
    const golpeGain = ctx.createGain();
    golpe.type = "sine";
    golpe.frequency.setValueAtTime(190, t);
    golpe.frequency.exponentialRampToValueAtTime(70, t + 0.28);
    golpeGain.gain.setValueAtTime(0.001, t);
    golpeGain.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
    golpeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    golpe.connect(golpeGain).connect(ctx.destination);
    golpe.start(t);
    golpe.stop(t + 0.4);

    const campana = ctx.createOscillator();
    const campanaGain = ctx.createGain();
    campana.type = "sine";
    campana.frequency.setValueAtTime(1046.5, t + 0.04);
    campanaGain.gain.setValueAtTime(0.001, t + 0.04);
    campanaGain.gain.exponentialRampToValueAtTime(0.22, t + 0.06);
    campanaGain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    campana.connect(campanaGain).connect(ctx.destination);
    campana.start(t + 0.04);
    campana.stop(t + 0.95);
  } catch (error) {
    console.warn("Audio del Sorteo no disponible:", error);
  }
}

// Fanfarria corta (arpegio ascendente + acorde final) al salir el número.
export function playSorteoFanfarria() {
  try {
    const ctx = obtenerAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);

    const notas = [523.25, 659.25, 783.99, 1046.5];
    notas.forEach((frecuencia, indice) => {
      const at = t + indice * 0.13;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(frecuencia, at);
      gain.gain.setValueAtTime(0.001, at);
      gain.gain.exponentialRampToValueAtTime(0.5, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.4);
      osc.connect(gain).connect(master);
      osc.start(at);
      osc.stop(at + 0.45);
    });

    const inicioAcorde = t + notas.length * 0.13;
    [523.25, 659.25, 783.99, 1046.5].forEach((frecuencia) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(frecuencia, inicioAcorde);
      gain.gain.setValueAtTime(0.001, inicioAcorde);
      gain.gain.exponentialRampToValueAtTime(0.35, inicioAcorde + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, inicioAcorde + 1.3);
      osc.connect(gain).connect(master);
      osc.start(inicioAcorde);
      osc.stop(inicioAcorde + 1.35);
    });
  } catch (error) {
    console.warn("Audio del Sorteo no disponible:", error);
  }
}

function decirEnVoz(texto) {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = "es-ES";
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  } catch (error) {
    console.warn("Voz del Sorteo no disponible:", error);
  }
}

// No cancela lo que se esté diciendo (como encolarMensajeVoz en Bingo): si
// un pedido da varios números seguidos, se cantan uno detrás de otro en
// vez de cortarse entre sí. Solo dice el número, nada más (ni la
// cuadrícula ni el nombre del cliente, y sin deletrear dígito a dígito
// para que no suene como si lo repitiera).
export function cantarNumeroSorteo({ numero }) {
  if (!Number.isFinite(Number(numero))) return;
  decirEnVoz(String(Number(numero)));
}
