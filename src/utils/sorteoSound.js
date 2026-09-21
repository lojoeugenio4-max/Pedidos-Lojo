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

// ¿Puede sonar ya el audio de esta pantalla? Los navegadores bloquean el
// sonido automático hasta que alguien toca/hace clic en la página; si la TV
// se ha recargado (p. ej. al desplegar una versión nueva) y nadie la ha
// tocado, el audio queda "suspendido" y NADA suena, ni voz ni platillos.
export function audioSorteoActivo() {
  const ctx = obtenerAudioContext();
  return Boolean(ctx) && ctx.state === "running";
}

// Debe llamarse dentro de un clic/toque. Despierta el audio (y la voz) y
// devuelve true si ya puede sonar.
export async function desbloquearAudioSorteo() {
  const ctx = obtenerAudioContext();
  if (!ctx) return false;
  try {
    await ctx.resume();
    const silencio = ctx.createBuffer(1, 1, 22050);
    const fuente = ctx.createBufferSource();
    fuente.buffer = silencio;
    fuente.connect(ctx.destination);
    fuente.start(0);
  } catch (error) {
    console.warn("No se pudo activar el audio del Sorteo:", error);
  }
  try {
    // Un "hola" mudo para que la síntesis de voz también quede autorizada.
    window.speechSynthesis?.cancel();
    const mudo = new SpeechSynthesisUtterance(" ");
    mudo.volume = 0;
    window.speechSynthesis?.speak(mudo);
  } catch {
    // sin voz, el resto sigue funcionando
  }
  return ctx.state === "running";
}

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

// --- Redoble de tambor, platillos y voz del Sorteo en directo ---------------

let bufferRuido = null;

// Ruido blanco (3 s) reutilizable: es la "materia prima" del parche de la
// caja y de los platillos.
function obtenerBufferRuido(ctx) {
  if (!bufferRuido || bufferRuido.sampleRate !== ctx.sampleRate) {
    const longitud = Math.floor(ctx.sampleRate * 3);
    const buffer = ctx.createBuffer(1, longitud, ctx.sampleRate);
    const datos = buffer.getChannelData(0);
    for (let i = 0; i < longitud; i += 1) datos[i] = Math.random() * 2 - 1;
    bufferRuido = buffer;
  }
  return bufferRuido;
}

function crearSalidaConCompresor(ctx, volumen = 1) {
  const master = ctx.createGain();
  master.gain.value = volumen;
  const compresor = ctx.createDynamicsCompressor();
  compresor.threshold.value = -14;
  compresor.ratio.value = 6;
  master.connect(compresor);
  compresor.connect(ctx.destination);
  return { master, compresor };
}

// REDOBLE de caja mientras giran las ruedas: golpes rápidos y seguidos que
// van a más (crescendo) hasta el momento de revelar. Se programan todos de
// una vez con el reloj del audio (así no se corta si la pantalla va justa).
// desdeMs/hastaMs son milisegundos desde el arranque del sorteo: si la
// pantalla se abre a mitad, el redoble entra ya en el punto que toca.
// Devuelve una función para pararlo.
export function iniciarRedobleSorteo({ desdeMs = 0, hastaMs = 15500 } = {}) {
  try {
    const ctx = obtenerAudioContext();
    if (!ctx) return () => {};
    const duracion = (hastaMs - desdeMs) / 1000;
    if (duracion < 0.3) return () => {};

    const ruido = obtenerBufferRuido(ctx);
    const { master } = crearSalidaConCompresor(ctx, 0.9);
    const inicio = ctx.currentTime + 0.05;
    const golpesPorSegundo = 17;
    const total = Math.floor(duracion * golpesPorSegundo);

    for (let i = 0; i < total; i += 1) {
      const at = inicio + i / golpesPorSegundo;
      // 0 al arrancar el sorteo, 1 al revelar: el redoble sube de volumen.
      const progreso = Math.min(1, (desdeMs / 1000 + i / golpesPorSegundo) / (hastaMs / 1000));
      const fuerza = 0.14 + 0.62 * Math.pow(progreso, 1.4);
      const acento = i % 2 === 0 ? 1 : 0.72;

      // Parche: ruido filtrado, seco y corto (como la bordonera de una caja).
      const fuente = ctx.createBufferSource();
      fuente.buffer = ruido;
      const filtro = ctx.createBiquadFilter();
      filtro.type = "bandpass";
      filtro.frequency.value = 2300 + (i % 2) * 350;
      filtro.Q.value = 0.7;
      const ganancia = ctx.createGain();
      ganancia.gain.setValueAtTime(0.0001, at);
      ganancia.gain.exponentialRampToValueAtTime(fuerza * acento, at + 0.004);
      ganancia.gain.exponentialRampToValueAtTime(0.0001, at + 0.075);
      fuente.connect(filtro).connect(ganancia).connect(master);
      fuente.start(at, Math.random() * 2, 0.09);

      // Cuerpo del tambor: tono grave que cae rápido.
      const cuerpo = ctx.createOscillator();
      const cuerpoGanancia = ctx.createGain();
      cuerpo.type = "sine";
      cuerpo.frequency.setValueAtTime(210, at);
      cuerpo.frequency.exponentialRampToValueAtTime(130, at + 0.05);
      cuerpoGanancia.gain.setValueAtTime(0.0001, at);
      cuerpoGanancia.gain.exponentialRampToValueAtTime(fuerza * 0.55 * acento, at + 0.004);
      cuerpoGanancia.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
      cuerpo.connect(cuerpoGanancia).connect(master);
      cuerpo.start(at);
      cuerpo.stop(at + 0.08);
    }

    return () => {
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
        window.setTimeout(() => master.disconnect(), 400);
      } catch {
        // nada que hacer
      }
    };
  } catch (error) {
    console.warn("Audio del Sorteo no disponible:", error);
    return () => {};
  }
}

// PLATILLOS fuertes (crash de batería) + bombo, al aparecer el número.
export function playSorteoPlatillos() {
  try {
    const ctx = obtenerAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const { master } = crearSalidaConCompresor(ctx, 1);

    // Chapa brillante: ruido con los graves recortados y caída larga.
    const ruido = ctx.createBufferSource();
    ruido.buffer = obtenerBufferRuido(ctx);
    const agudos = ctx.createBiquadFilter();
    agudos.type = "highpass";
    agudos.frequency.value = 5200;
    const ruidoGanancia = ctx.createGain();
    ruidoGanancia.gain.setValueAtTime(0.0001, t);
    ruidoGanancia.gain.exponentialRampToValueAtTime(1.0, t + 0.004);
    ruidoGanancia.gain.exponentialRampToValueAtTime(0.25, t + 0.35);
    ruidoGanancia.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    ruido.connect(agudos).connect(ruidoGanancia).connect(master);
    ruido.start(t, 0, 3);

    // Metal: varias ondas cuadradas desafinadas dan el "cling" del platillo.
    const metal = ctx.createGain();
    metal.gain.setValueAtTime(0.0001, t);
    metal.gain.exponentialRampToValueAtTime(0.16, t + 0.005);
    metal.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    const filtroMetal = ctx.createBiquadFilter();
    filtroMetal.type = "highpass";
    filtroMetal.frequency.value = 6500;
    metal.connect(filtroMetal).connect(master);
    [4160, 5430, 6790, 8210, 9540, 11000].forEach((frecuencia) => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = frecuencia;
      osc.connect(metal);
      osc.start(t);
      osc.stop(t + 1.7);
    });

    // Bombo que empuja el golpe.
    const bombo = ctx.createOscillator();
    const bomboGanancia = ctx.createGain();
    bombo.type = "sine";
    bombo.frequency.setValueAtTime(120, t);
    bombo.frequency.exponentialRampToValueAtTime(45, t + 0.35);
    bomboGanancia.gain.setValueAtTime(0.0001, t);
    bomboGanancia.gain.exponentialRampToValueAtTime(0.95, t + 0.01);
    bomboGanancia.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    bombo.connect(bomboGanancia).connect(master);
    bombo.start(t);
    bombo.stop(t + 0.65);

    window.setTimeout(() => master.disconnect(), 3500);
  } catch (error) {
    console.warn("Audio del Sorteo no disponible:", error);
  }
}

function vozEspanola() {
  try {
    const voces = window.speechSynthesis.getVoices?.() || [];
    return (
      voces.find((voz) => /^es[-_]ES/i.test(voz.lang)) ||
      voces.find((voz) => /^es/i.test(voz.lang)) ||
      null
    );
  } catch {
    return null;
  }
}

// Cómo se dice el número: los de una cifra con "cero" delante ("cero siete")
// para que quede claro que es el 07 de la cuadrícula.
function numeroHablado(numero) {
  const n = Number(numero);
  return n < 10 ? `cero ${n}` : String(n);
}

// La voz CANTA el número (despacio, con énfasis) y remata con "¡Enhorabuena!".
// Se corta cualquier voz anterior para que no se pise.
export function cantarResultadoSorteo({ numero, felicitar = true }) {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (!Number.isFinite(Number(numero))) return;
    window.speechSynthesis.cancel();
    const voz = vozEspanola();

    const decir = (texto, { rate, pitch }) => {
      const utter = new SpeechSynthesisUtterance(texto);
      utter.lang = "es-ES";
      if (voz) utter.voice = voz;
      utter.rate = rate;
      utter.pitch = pitch;
      utter.volume = 1;
      window.speechSynthesis.speak(utter);
    };

    decir(numeroHablado(numero), { rate: 0.75, pitch: 1.15 });
    if (felicitar) decir("¡Enhorabuena!", { rate: 0.9, pitch: 1.2 });
  } catch (error) {
    console.warn("Voz del Sorteo no disponible:", error);
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
