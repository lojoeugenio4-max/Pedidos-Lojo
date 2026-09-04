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
