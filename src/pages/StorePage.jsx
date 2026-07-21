import { useEffect, useRef, useState } from "react";
import { CheckCircle, RotateCcw, Search, XCircle } from "lucide-react";
import { supabase } from "../supabaseClient";
import StoreWheel from "../components/StoreWheel";

const DISPLAY_EVENT_KEY = "lojo-ruleta-display-event";
const BINGO_CONTROL_CHANNEL = "lojo-bingo-control";
const SPIN_DURATION_MS = 9200;

const PRODUCTOS_PUBLIC_URL =
  "https://bohlxagrtpjvqrgkonlo.supabase.co/storage/v1/object/public/productos";

function enviarEventoDisplay(type, payload = {}) {
  if (typeof window === "undefined") return;

  const event = {
    type,
    payload,
    createdAt: Date.now(),
  };

  try {
    localStorage.setItem(DISPLAY_EVENT_KEY, JSON.stringify(event));
  } catch {}

  try {
    const channel = new BroadcastChannel("lojo-ruleta-display");
    channel.postMessage(event);
    channel.close();
  } catch {}
}


let audioContext = null;
let giroTimeout = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function beep({ frequency = 440, duration = 120, type = "sine", volume = 0.08 } = {}) {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + duration / 1000);
  } catch {}
}

function startSpinSound(duration = SPIN_DURATION_MS) {
  stopSpinSound();

  const start = performance.now();
  let step = 0;

  function tick() {
    const elapsed = performance.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const fade = Math.max(0.08, 1 - progress);

    beep({
      frequency: 230 + (step % 6) * 24,
      duration: Math.max(35, 62 - progress * 28),
      type: "square",
      volume: 0.04 * fade,
    });

    step += 1;

    if (progress < 1) {
      const nextDelay = 58 + progress * 230;
      giroTimeout = window.setTimeout(tick, nextDelay);
    } else {
      giroTimeout = null;
    }
  }

  tick();
}

function stopSpinSound() {
  if (giroTimeout) {
    window.clearTimeout(giroTimeout);
    giroTimeout = null;
  }
}

function playCampana() {
  [0, 160, 320, 520, 760].forEach((delay, index) => {
    window.setTimeout(() => {
      beep({
        frequency: [784, 988, 1175, 988, 1319][index],
        duration: 180,
        type: "sine",
        volume: 0.11,
      });
    }, delay);
  });
}

function playSirena() {
  for (let i = 0; i < 12; i += 1) {
    window.setTimeout(() => {
      beep({
        frequency: i % 2 === 0 ? 880 : 440,
        duration: 180,
        type: "sawtooth",
        volume: 0.1,
      });
    }, i * 190);
  }
}

function normalizarCodigo(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[’‘`´']/g, "-")
    .replace(/\s+/g, "");
}

// Los lectores físicos pueden entregar el código puro o la URL completa
// contenida en el QR. Esta función mantiene ambos formatos compatibles,
// incluidos todos los QR históricos todavía pendientes de utilizar.
function extraerCodigoQr(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const candidatos = [raw];
  try {
    const decodificado = decodeURIComponent(raw);
    if (decodificado !== raw) candidatos.push(decodificado);
  } catch {}

  for (const candidato of candidatos) {
    try {
      const url = new URL(candidato, window.location.origin);
      const codigoUrl =
        url.searchParams.get("code") ||
        url.searchParams.get("codigo") ||
        url.searchParams.get("qr");
      if (codigoUrl) return normalizarCodigo(codigoUrl);
    } catch {}
  }

  return normalizarCodigo(raw);
}

function getPrizeImageUrl(premio) {
  const raw =
    premio?.imagen_url ||
    premio?.foto_url ||
    premio?.image_url ||
    premio?.foto ||
    premio?.imagen ||
    "";

  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.startsWith("http") || value.startsWith("data:") || value.startsWith("blob:")) return value;

  return `${PRODUCTOS_PUBLIC_URL}/${value.replace(/^\/+/, "")}`;
}


function seleccionarPremioRuleta(premios = []) {
  const activos = (premios || []).filter(Boolean);
  if (!activos.length) return null;

  const pesos = activos.map((premio) => {
    const peso = Number(
      premio.probabilidad ??
        premio.peso ??
        premio.weight ??
        premio.porcentaje ??
        1
    );

    return Number.isFinite(peso) && peso > 0 ? peso : 1;
  });

  const total = pesos.reduce((acc, peso) => acc + peso, 0);
  let cursor = Math.random() * total;

  for (let index = 0; index < activos.length; index += 1) {
    cursor -= pesos[index];
    if (cursor <= 0) return activos[index];
  }

  return activos[activos.length - 1];
}

async function actualizarSaldoTiradas(entry, prize = null, qrCode = "") {
  if (!entry?.id) {
    throw new Error("La participación no tiene un identificador válido.");
  }

  if (entry.is_permanent === true) {
    return {
      ...entry,
      status: "pending",
      spins_total: 1,
      spins_used: 0,
      played_at: null,
    };
  }

  const normalizedQr = normalizarCodigo(qrCode);
  let spinResult = null;

  if (normalizedQr) {
    const { data, error } = await supabase.rpc(
      "consume_game_roulette_play_by_code",
      {
        p_code: normalizedQr,
        p_prize_id: prize?.id == null ? null : String(prize.id),
      }
    );
    spinResult = Array.isArray(data) ? data[0] : data;

    if (error || !spinResult?.ok) {
      const detail = spinResult?.message || error?.message || "No se pudo registrar la tirada.";
      console.error("No se pudo registrar la tirada por QR:", error || spinResult);
      throw new Error(detail);
    }
  } else {
    const { data, error } = await supabase.rpc("register_promotion_spin", {
      p_participation_id: entry.id,
      p_prize_id: prize?.id == null ? null : String(prize.id),
    });
    spinResult = data;
    if (error) {
      console.error("No se pudo registrar la tirada:", error);
      throw error;
    }
  }

  const { data: participation, error: participationError } = await supabase
    .from("promotion_participations")
    .select("*")
    .eq("id", entry.id)
    .single();

  if (participationError) {
    console.error("La tirada se registró, pero no se pudo recargar la participación:", participationError);
    return {
      ...entry,
      spins_total: Number(spinResult?.spins_total ?? entry.spins_total ?? 1),
      spins_used: Number(spinResult?.spins_used ?? entry.spins_used ?? 0),
      status: Number(spinResult?.spins_remaining ?? 0) > 0 ? "pending" : "played",
    };
  }

  return participation;
}

function obtenerTiradasTotalesEntrada(entrada) {
  if (entrada?.is_permanent === true) return 1;
  const total = Number(entrada?.spins_total ?? 1);
  return Number.isFinite(total) && total > 0 ? total : 1;
}

function obtenerTiradasUsadasEntrada(entrada) {
  if (entrada?.is_permanent === true) return 0;
  const usadas = Number(entrada?.spins_used ?? 0);
  return Number.isFinite(usadas) && usadas > 0 ? usadas : 0;
}

function obtenerTiradasRestantesEntrada(entrada) {
  if (entrada?.is_permanent === true) return 1;
  return Math.max(
    0,
    obtenerTiradasTotalesEntrada(entrada) - obtenerTiradasUsadasEntrada(entrada)
  );
}

export default function StorePage() {
  const inputRef = useRef(null);
  const autoValidatedCodeRef = useRef("");

  const [codigo, setCodigo] = useState("");
  const [entrada, setEntrada] = useState(null);
  const [premios, setPremios] = useState([]);
  const [estado, setEstado] = useState("idle");
  const [mensaje, setMensaje] = useState("");
  const [girando, setGirando] = useState(false);
  const [premioFinal, setPremioFinal] = useState(null);
  const [premioObjetivo, setPremioObjetivo] = useState(null);
  const [entitlement, setEntitlement] = useState(null);
  const [bolaBingo, setBolaBingo] = useState(null);
  const [procesandoBingo, setProcesandoBingo] = useState(false);
  const [bomboGirando, setBomboGirando] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, [estado]);

  useEffect(() => {
    enviarEventoDisplay("waiting");
    return () => stopSpinSound();
  }, []);

  useEffect(() => {
    function handleBingoEvent(event) {
      const message = event?.data || event;
      if (!message || message.type !== "bingo-complete") return;
      const eventCode = normalizarCodigo(message.code);
      const currentCode = normalizarCodigo(entitlement?.code || codigo);
      if (!eventCode || eventCode !== currentCode) return;

      setProcesandoBingo(false);
      setBolaBingo(Number(message.ball_number) || null);
      setEntitlement((current) => ({
        ...current,
        bingo_available: false,
        bingo_remaining: Number(message.bingo_remaining || 0),
      }));
      setMensaje(`Bola ${message.ball_number} registrada correctamente.`);
      setEstado(entitlement?.roulette_available ? "game-choice" : "bingo-result");
    }

    let channel;
    try {
      channel = new BroadcastChannel(BINGO_CONTROL_CHANNEL);
      channel.addEventListener("message", handleBingoEvent);
    } catch {}

    function handleStorage(event) {
      if (event.key !== BINGO_CONTROL_CHANNEL || !event.newValue) return;
      try { handleBingoEvent(JSON.parse(event.newValue)); } catch {}
    }
    window.addEventListener("storage", handleStorage);

    return () => {
      channel?.removeEventListener?.("message", handleBingoEvent);
      channel?.close?.();
      window.removeEventListener("storage", handleStorage);
    };
  }, [codigo, entitlement?.code, entitlement?.roulette_available]);

  useEffect(() => {
    const codeFromUrl = extraerCodigoQr(
      new URLSearchParams(window.location.search).get("code")
    );
    if (!codeFromUrl || autoValidatedCodeRef.current === codeFromUrl) return;
    autoValidatedCodeRef.current = codeFromUrl;
    setCodigo(codeFromUrl);
    validarCodigo(codeFromUrl);
  }, []);

  async function validarCodigo(codeFromScanner = codigo) {
    const code = extraerCodigoQr(codeFromScanner);

    if (!code) {
      setMensaje("Introduce o escanea un código.");
      setEstado("error");
      return;
    }

    setEstado("loading");
    setMensaje("");
    setEntrada(null);
    setEntitlement(null);
    setBolaBingo(null);
    setPremios([]);
    setPremioFinal(null);

    // Los QR maestros se comprueban exclusivamente en PRODUCCIÓN.
    // La migración ya está finalizada y el lector no debe consultar BETA.
    const { data: masterEntry, error: masterError } = await supabase
      .from("promotion_participations")
      .select("*")
      .eq("code", code)
      .eq("is_permanent", true)
      .maybeSingle();

    if (masterError) {
      console.warn("No se pudo comprobar el QR maestro en producción:", masterError);
    }

    if (masterEntry) {
      const { data: premiosMaster, error: premiosMasterError } = await supabase
        .from("promociones_ruleta_premios")
        .select("*")
        .eq("promocion_id", masterEntry.promotion_id)
        .eq("activo", true)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true });

      if (premiosMasterError || !premiosMaster?.length) {
        console.error(premiosMasterError);
        setMensaje("El QR maestro es válido, pero la promoción no tiene premios activos.");
        setEstado("error");
        return;
      }

      setCodigo(code);
      setEntrada(masterEntry);
      setPremios(premiosMaster);
      setEstado("ready");
      enviarEventoDisplay("ready", { entrada: masterEntry, premios: premiosMaster });
      return;
    }

    // Después se valida el QR común. La función bloquea estados inválidos y
    // devuelve los juegos realmente pendientes para este pedido.
    const { data: unifiedRaw, error: unifiedError } = await supabase.rpc(
      "validate_game_qr",
      { p_code: code }
    );
    const unified = Array.isArray(unifiedRaw) ? unifiedRaw[0] : unifiedRaw;

    if (!unifiedError && unified?.ok) {
      setCodigo(code);
      setEntitlement(unified);

      if (unified.roulette_available && unified.roulette_participation_id) {
        const { data: rouletteEntry, error: rouletteError } = await supabase
          .from("promotion_participations")
          .select("*")
          .eq("id", unified.roulette_participation_id)
          .maybeSingle();

        if (rouletteError || !rouletteEntry) {
          console.error(rouletteError);
          setMensaje("El QR es válido, pero no se pudo cargar la participación de Ruleta.");
          setEstado("error");
          return;
        }

        const { data: premiosData, error: premiosError } = await supabase
          .from("promociones_ruleta_premios")
          .select("*")
          .eq("promocion_id", rouletteEntry.promotion_id)
          .eq("activo", true)
          .order("orden", { ascending: true })
          .order("created_at", { ascending: true });

        if (premiosError || !premiosData?.length) {
          console.error(premiosError);
          setMensaje("La Ruleta asociada no tiene premios activos.");
          setEstado("error");
          return;
        }

        setEntrada(rouletteEntry);
        setPremios(premiosData);
      }

      setEstado(
        unified.bingo_available && unified.roulette_available
          ? "game-choice"
          : unified.bingo_available
            ? "bingo-ready"
            : "ready"
      );
      return;
    }

    // Compatibilidad temporal con los QR históricos de solo Ruleta mientras
    // todos los pedidos activos terminan de migrarse al QR común.
    if (unifiedError) {
      console.warn("validate_game_qr no disponible; usando validación histórica:", unifiedError);
    } else if (unified && unified.ok === false && unified.reason !== "not_found") {
      setMensaje(unified.message || "Este código no se puede utilizar.");
      setEstado(unified.reason === "used" ? "used" : "error");
      return;
    }

    const { data, error } = await supabase
      .from("promotion_participations")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (error || !data) {
      console.error(error);
      setMensaje("Código no encontrado.");
      setEstado("error");
      return;
    }

    const estadoCodigo = String(data.status || "").toLowerCase();
    const estadosBloqueados = ["disabled", "cancelled", "canceled", "blocked"];
    if (estadosBloqueados.includes(estadoCodigo)) {
      setEntrada(data);
      setMensaje("Este código está desactivado o bloqueado.");
      setEstado("used");
      return;
    }
    if (data.is_permanent !== true && obtenerTiradasRestantesEntrada(data) <= 0) {
      setEntrada(data);
      setMensaje("Este código ya fue utilizado.");
      setEstado("used");
      return;
    }
    if (data.is_permanent !== true && data.expires_at && new Date(data.expires_at) < new Date()) {
      setEntrada(data);
      setMensaje("Este código está caducado.");
      setEstado("error");
      return;
    }

    const { data: premiosData, error: premiosError } = await supabase
      .from("promociones_ruleta_premios")
      .select("*")
      .eq("promocion_id", data.promotion_id)
      .eq("activo", true)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    if (premiosError || !premiosData?.length) {
      setMensaje("Esta promoción no tiene premios activos.");
      setEstado("error");
      return;
    }

    setCodigo(code);
    setEntrada(data);
    setPremios(premiosData);
    setEstado("ready");
    enviarEventoDisplay("ready", { entrada: data, premios: premiosData });
  }

  async function consumirBingo() {
    if (!entitlement?.id || procesandoBingo) return;

    const qrCode = normalizarCodigo(entitlement.code || codigo);
    const displayUrl = `${window.location.origin}/?bingoDisplay=1&code=${encodeURIComponent(qrCode)}`;
    const displayWindow = window.open(displayUrl, "lojo-bingo-display");

    if (!displayWindow) {
      setMensaje("El navegador ha bloqueado la pantalla oficial del Bingo. Permite ventanas emergentes y vuelve a intentarlo.");
      setEstado("error");
      return;
    }

    setProcesandoBingo(true);
    setMensaje("Bombo oficial preparado. Pulsa GIRAR BOMBO en la pantalla de Bingo.");
    setEstado("bingo-waiting");
  }

  async function girar() {
    if (!entrada || girando) return;

    try {
      getAudioContext().resume?.();
    } catch {}

    setPremioFinal(null);
    setPremioObjetivo(null);
    setMensaje("");

    const tiradasUsadasAntes = obtenerTiradasUsadasEntrada(entrada);
    const tiradasTotalesAntes = obtenerTiradasTotalesEntrada(entrada);
    const tiradasRestantesAntes = Math.max(0, tiradasTotalesAntes - tiradasUsadasAntes);

    if (tiradasRestantesAntes <= 0) {
      stopSpinSound();
      setGirando(false);
      setMensaje("Este código ya no tiene tiradas disponibles.");
      setEstado("used");
      return;
    }

    const prize = seleccionarPremioRuleta(premios);

    if (!prize) {
      stopSpinSound();
      setGirando(false);
      setMensaje("No se pudo seleccionar premio.");
      setEstado("error");
      return;
    }

    setPremioObjetivo(prize);
    setGirando(true);
    startSpinSound(SPIN_DURATION_MS);

    enviarEventoDisplay("spin", {
      entrada,
      premios,
      premio: prize,
    });

    window.setTimeout(async () => {
      stopSpinSound();

      try {
        const entryActualizada = await actualizarSaldoTiradas(entrada, prize, entitlement?.code || codigo);

        setEntrada(entryActualizada);
        setPremioFinal(prize);
        setPremioObjetivo(null);
        setGirando(false);
        setEntitlement((current) => current ? ({
          ...current,
          roulette_available: obtenerTiradasRestantesEntrada(entryActualizada) > 0,
          roulette_remaining: obtenerTiradasRestantesEntrada(entryActualizada),
        }) : current);
        setEstado("result");

        enviarEventoDisplay("result", {
          entrada: entryActualizada,
          premios,
          premio: prize,
        });

        if (prize.tipo_sonido === "sirena" || prize.tipo_sonido === "jackpot") {
          playSirena();
        } else {
          playCampana();
        }
      } catch (error) {
        console.error(error);
        setPremioObjetivo(null);
        setGirando(false);
        setMensaje(
          error?.message ||
            "No se pudo registrar la tirada. No vuelvas a girar hasta comprobar la conexión."
        );
        setEstado("error");
        enviarEventoDisplay("waiting");
      }
    }, SPIN_DURATION_MS);
  }

  function prepararSiguienteTirada() {
    if (!entrada || obtenerTiradasRestantesEntrada(entrada) <= 0) {
      reset();
      return;
    }

    setPremioFinal(null);
    setPremioObjetivo(null);
    setMensaje("");
    setEstado("ready");
    enviarEventoDisplay("ready", {
      entrada,
      premios,
    });
  }

  function continuarTrasRuleta() {
    setPremioFinal(null);
    setPremioObjetivo(null);
    setMensaje("");

    if (entitlement?.bingo_available) {
      setEstado(entitlement?.roulette_available ? "game-choice" : "bingo-ready");
      return;
    }

    if (entitlement?.roulette_available && entrada && obtenerTiradasRestantesEntrada(entrada) > 0) {
      setEstado("ready");
      return;
    }

    reset();
  }

  function reset() {
    stopSpinSound();
    setCodigo("");
    setEntrada(null);
    setEntitlement(null);
    setBolaBingo(null);
    setPremios([]);
    setEstado("idle");
    setMensaje("");
    setGirando(false);
    setPremioFinal(null);
    setPremioObjetivo(null);
    enviarEventoDisplay("waiting");

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }

  function manejarSubmit(event) {
    event.preventDefault();
    validarCodigo();
  }

  const premioImagen = getPrizeImageUrl(premioFinal);
  const tiradasTotales = obtenerTiradasTotalesEntrada(entrada);
  const tiradasUsadas = obtenerTiradasUsadasEntrada(entrada);
  const tiradasRestantes = obtenerTiradasRestantesEntrada(entrada);
  const esJackpot =
    premioFinal?.tipo_sonido === "jackpot" || premioFinal?.tipo_sonido === "sirena";

  return (
    <main style={styles.page}>
      <style>
        {`
          @keyframes lojoBulbPulse {
            from { opacity: .55; filter: brightness(.75); }
            to { opacity: 1; filter: brightness(1.35); }
          }

          @keyframes lojoIdleLightsRotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes lojoPrizePop {
            0% { transform: scale(.72); opacity: 0; }
            55% { transform: scale(1.07); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }

          @keyframes lojoBingoDrumSpin { to { transform: rotate(360deg); } }

          @keyframes lojoFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }

          @media (max-width: 950px) {
            .store-game-layout {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>

      <div style={styles.confettiLayer}>
        {Array.from({ length: 34 }, (_, index) => (
          <span
            key={index}
            style={{
              ...styles.confetti,
              left: `${(index * 37) % 100}%`,
              top: `${(index * 19) % 92}%`,
              background: ["#ef4444", "#facc15", "#22c55e", "#06b6d4", "#a855f7"][index % 5],
              animationDelay: `${index * 0.08}s`,
            }}
          />
        ))}
      </div>

      <section style={styles.header}>
        <div style={styles.validBadge}>
          <span style={styles.shield}>🛡️</span>
          <span>
            <strong>Promoción válida</strong>
            <small>hasta fin de campaña</small>
          </span>
        </div>

        <div style={styles.titleBlock}>
          <h1 style={styles.mainTitle}>¡GIRA Y GANA!</h1>
          <p style={styles.subtitle}>
            Por confiar en <strong>Lojo</strong>, hoy puedes ganar un premio sorpresa.
          </p>
        </div>

        <button type="button" onClick={reset} style={styles.closeButton}>
          ×
        </button>
      </section>

      {(estado === "idle" ||
        estado === "loading" ||
        estado === "error" ||
        estado === "used") && (
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Escanear o introducir código</h2>

          <form onSubmit={manejarSubmit} style={styles.form}>
            <input
              ref={inputRef}
              value={codigo}
              onChange={(event) => setCodigo(event.target.value.toUpperCase())}
              placeholder="••••••••"
              autoComplete="off"
              type="password"
              inputMode="text"
              style={styles.input}
            />

            <button
              type="submit"
              disabled={estado === "loading"}
              style={styles.validateButton}
            >
              <Search size={24} />
              VALIDAR
            </button>
          </form>

          {estado === "loading" && <p style={styles.info}>Validando código...</p>}

          {(estado === "error" || estado === "used") && (
            <div style={estado === "used" ? styles.usedBox : styles.errorBox}>
              <XCircle size={40} />
              <strong>{mensaje}</strong>

              {entrada?.played_at && (
                <span>
                  Utilizado: {new Date(entrada.played_at).toLocaleString("es-ES")}
                </span>
              )}
            </div>
          )}
        </section>
      )}

      {(estado === "game-choice" || estado === "bingo-ready" || estado === "bingo-waiting" || estado === "bingo-result" || estado === "bingo-result-with-roulette") && entitlement && (
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>QR válido · Pedido identificado</h2>
          <p style={styles.info}>Cliente: <strong>{entitlement.customer_name || "sin nombre"}</strong></p>
          <p style={styles.info}>Pedido: <strong>{entitlement.order_id || "sin referencia"}</strong></p>

          {(estado === "game-choice" || estado === "bingo-ready") && (
            <div style={styles.gameChoiceGrid}>
              {entitlement.bingo_available && (
                <button type="button" onClick={consumirBingo} disabled={procesandoBingo} style={styles.bingoActionButton}>
                  🎱 {procesandoBingo ? "ABRIENDO BOMBO..." : "ABRIR BOMBO"}
                </button>
              )}
              {entitlement.roulette_available && entrada && (
                <button type="button" onClick={() => setEstado("ready")} style={styles.rouletteActionButton}>
                  🎡 ABRIR RULETA
                </button>
              )}
            </div>
          )}

          {estado === "bingo-waiting" && (
            <div style={styles.bingoResultBox}>
              <h3 style={{ margin: 0 }}>BOMBO OFICIAL EN ESPERA</h3>
              <p style={styles.info}>Pulsa <strong>GIRAR BOMBO</strong> en la pantalla oficial. La bola no se extraerá hasta ese momento.</p>
            </div>
          )}

          {(estado === "bingo-result" || estado === "bingo-result-with-roulette") && (
            <div style={styles.bingoResultBox}>
              <div style={styles.bingoBall}>{bolaBingo}</div>
              <h2 style={{ margin: 0 }}>Bola registrada</h2>
              <p style={styles.info}>El cartón del cliente se actualizará en tiempo real si contiene este número.</p>
              {estado === "bingo-result-with-roulette" ? (
                <button type="button" onClick={() => setEstado("game-choice")} style={styles.rouletteActionButton}>ELEGIR SIGUIENTE JUEGO ›</button>
              ) : (
                <button type="button" onClick={reset} style={styles.nextButton}>FINALIZAR ›</button>
              )}
            </div>
          )}
        </section>
      )}

      {(estado === "ready" || estado === "result") && entrada && (
        <section className="store-game-layout" style={styles.gameLayout}>
          <div style={styles.wheelSide}>
            <StoreWheel
              premios={premios}
              girando={girando}
              premioFinal={premioFinal}
              premioObjetivo={premioObjetivo}
              onGirar={girar}
              duracionGiro={SPIN_DURATION_MS}
            />

            <div style={styles.note}>
              <span style={styles.noteIcon}>ⓘ</span>
              <span>
                Código <strong>••••••••</strong> · Cliente{" "}
                <strong>{entrada.customer_name || "sin nombre"}</strong>
                {tiradasTotales > 1 && (
                  <>
                    {" "}· Tiradas <strong>{tiradasUsadas}/{tiradasTotales}</strong>
                  </>
                )}
              </span>
            </div>
          </div>

          <div style={styles.resultPanel}>
            {!premioFinal ? (
              <div style={styles.waitPanel}>
                <CheckCircle size={72} color="#22c55e" />
                <h2>Código válido</h2>
                <p>Pulse el botón para girar la ruleta.</p>
              </div>
            ) : (
              <div
                style={{
                  ...styles.resultBox,
                  ...(esJackpot ? styles.resultBoxJackpot : {}),
                }}
              >
                <div style={styles.resultIcon}>{esJackpot ? "🚨🎉🚨" : "★ ¡ENHORABUENA! ★"}</div>

                {premioImagen ? (
                  <div style={styles.imageGlow}>
                    <img src={premioImagen} alt="" style={styles.prizeImage} />
                  </div>
                ) : (
                  <div style={styles.giftPlaceholder}>🎁</div>
                )}

                <div style={styles.hasGanado}>HAS GANADO</div>
                <strong style={styles.prizeName}>{premioFinal.nombre}</strong>

                {tiradasRestantes > 0 ? (
                  <button type="button" onClick={prepararSiguienteTirada} style={styles.nextButton}>
                    SIGUIENTE TIRADA ({tiradasRestantes}) ›
                  </button>
                ) : (
                  <button type="button" onClick={continuarTrasRuleta} style={styles.nextButton}>
                    {entitlement?.bingo_available ? "ELEGIR BINGO ›" : "FINALIZAR ›"}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

const styles = {
  gameChoiceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
    marginTop: 20,
  },
  bingoActionButton: {
    border: 0,
    borderRadius: 16,
    padding: "20px 18px",
    background: "linear-gradient(135deg, #7c3aed, #4c1d95)",
    color: "#fff",
    fontSize: 20,
    fontWeight: 900,
    cursor: "pointer",
  },
  rouletteActionButton: {
    border: 0,
    borderRadius: 16,
    padding: "20px 18px",
    background: "linear-gradient(135deg, #f59e0b, #b45309)",
    color: "#fff",
    fontSize: 20,
    fontWeight: 900,
    cursor: "pointer",
  },
  bingoDrum: {
    position: "relative",
    width: 170,
    height: 170,
    margin: "4px auto 16px",
    border: "10px solid #d9a52b",
    borderRadius: "50%",
    overflow: "hidden",
    background: "radial-gradient(circle, #174a8b 0 55%, #071c46 58%)",
    boxShadow: "inset 0 0 0 4px #ffef9d, 0 12px 28px #0006",
  },
  bingoDrumSpinning: {
    animation: "lojoBingoDrumSpin .28s linear infinite",
  },
  bingoDrumBars: {
    position: "absolute",
    inset: -15,
    background: "repeating-linear-gradient(75deg, transparent 0 14px, #ffe58a99 15px 20px, transparent 21px 31px)",
  },
  bingoDrumHub: {
    position: "absolute",
    inset: 55,
    display: "grid",
    placeItems: "center",
    border: "4px double #fff0a0",
    borderRadius: "50%",
    background: "#a96b0c",
    color: "#fff4c2",
    fontWeight: 950,
    zIndex: 2,
  },
  bingoResultBox: {
    display: "grid",
    justifyItems: "center",
    gap: 14,
    textAlign: "center",
    padding: 24,
  },
  bingoBall: {
    width: 150,
    height: 150,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "#fff",
    color: "#111827",
    border: "12px solid #7c3aed",
    boxShadow: "0 18px 45px rgba(124,58,237,.45)",
    fontSize: 64,
    fontWeight: 1000,
  },
  page: {
    minHeight: "100dvh",
    height: "100dvh",
    maxHeight: "100dvh",
    background:
      "radial-gradient(circle at 50% 0%, rgba(30,64,175,.52), transparent 36%), radial-gradient(circle at 0% 100%, rgba(250,204,21,.13), transparent 38%), #030712",
    color: "#ffffff",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: "clamp(12px, 2vh, 26px)",
    boxSizing: "border-box",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },
  confettiLayer: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    opacity: 0.72,
    overflow: "hidden",
  },
  confetti: {
    position: "absolute",
    width: "clamp(8px, 1.2vw, 16px)",
    height: "clamp(8px, 1.2vw, 16px)",
    borderRadius: "3px",
    transform: "rotate(45deg)",
    boxShadow: "0 0 18px rgba(255,255,255,.22)",
    animation: "lojoFloat 3.2s ease-in-out infinite",
  },
  header: {
    position: "relative",
    zIndex: 2,
    display: "grid",
    gridTemplateColumns: "280px 1fr 80px",
    alignItems: "center",
    gap: 16,
    width: "100%",
    maxWidth: 1520,
    margin: "0 auto clamp(10px, 1.5vh, 18px)",
    flexShrink: 0,
  },
  validBadge: {
    border: "1px solid rgba(255,255,255,.13)",
    background: "rgba(15,23,42,.62)",
    borderRadius: 24,
    padding: "12px 18px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    boxShadow: "0 12px 34px rgba(0,0,0,.28)",
  },
  shield: {
    fontSize: 32,
  },
  titleBlock: {
    textAlign: "center",
  },
  mainTitle: {
    margin: 0,
    fontSize: "clamp(42px, 7.2vh, 82px)",
    lineHeight: 0.92,
    fontWeight: 1000,
    letterSpacing: "-0.04em",
    color: "#ffffff",
    textShadow: "0 5px 24px rgba(0,0,0,.65)",
  },
  subtitle: {
    margin: "10px 0 0",
    fontSize: "clamp(18px, 2.5vh, 26px)",
    color: "#ffffff",
  },
  closeButton: {
    justifySelf: "end",
    width: "clamp(52px, 7vh, 70px)",
    height: "clamp(52px, 7vh, 70px)",
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,.24)",
    background: "rgba(15,23,42,.78)",
    color: "#ffffff",
    fontSize: "clamp(38px, 6vh, 58px)",
    lineHeight: 1,
    cursor: "pointer",
    boxShadow: "0 14px 36px rgba(0,0,0,.35)",
  },
  card: {
    position: "relative",
    zIndex: 2,
    maxWidth: 820,
    width: "min(820px, 100%)",
    margin: "auto",
    background: "rgba(255,255,255,.96)",
    color: "#0f172a",
    borderRadius: 28,
    padding: "clamp(18px, 4vh, 34px)",
    boxShadow: "0 30px 90px rgba(0,0,0,.45)",
    textAlign: "center",
    boxSizing: "border-box",
  },
  cardTitle: {
    margin: "0 0 20px",
    fontSize: "clamp(24px, 4vh, 34px)",
  },
  form: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 12,
  },
  input: {
    height: "clamp(58px, 8vh, 72px)",
    border: "3px solid #cbd5e1",
    borderRadius: 18,
    padding: "0 20px",
    fontSize: "clamp(24px, 5vh, 34px)",
    fontWeight: 1000,
    letterSpacing: 2,
    textTransform: "uppercase",
    outline: "none",
    minWidth: 0,
  },
  validateButton: {
    border: "none",
    borderRadius: 18,
    background: "#22c55e",
    color: "#ffffff",
    padding: "0 clamp(18px, 3vw, 28px)",
    fontSize: "clamp(17px, 2.5vh, 22px)",
    fontWeight: 1000,
    display: "flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
  },
  info: {
    fontSize: 22,
    fontWeight: 800,
    color: "#475569",
  },
  errorBox: {
    marginTop: 20,
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: 22,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    alignItems: "center",
    fontSize: 20,
  },
  usedBox: {
    marginTop: 20,
    background: "#ffedd5",
    color: "#9a3412",
    borderRadius: 22,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    alignItems: "center",
    fontSize: 20,
  },
  gameLayout: {
    position: "relative",
    zIndex: 2,
    maxWidth: 1520,
    width: "100%",
    minHeight: 0,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.18fr) minmax(380px, .82fr)",
    gap: "clamp(18px, 2.3vw, 34px)",
    alignItems: "stretch",
    flex: 1,
    overflow: "hidden",
  },
  wheelSide: {
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(10px, 1.4vh, 18px)",
    overflow: "hidden",
  },
  note: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: "rgba(15,23,42,.68)",
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 20,
    padding: "12px 22px",
    color: "#ffffff",
    fontSize: "clamp(15px, 2.1vh, 20px)",
    maxWidth: "min(740px, 100%)",
    boxSizing: "border-box",
  },
  noteIcon: {
    color: "#facc15",
    fontSize: 28,
    fontWeight: 1000,
  },
  resultPanel: {
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  waitPanel: {
    width: "100%",
    minHeight: "min(52vh, 560px)",
    borderRadius: 30,
    border: "1px solid rgba(255,255,255,.14)",
    background: "linear-gradient(180deg, rgba(15,23,42,.82), rgba(2,6,23,.9))",
    boxShadow: "0 26px 75px rgba(0,0,0,.42)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 30,
    boxSizing: "border-box",
  },
  resultBox: {
    width: "100%",
    height: "100%",
    minHeight: "min(62vh, 640px)",
    borderRadius: 30,
    border: "1px solid rgba(255,255,255,.16)",
    background: "linear-gradient(180deg, rgba(15,23,42,.9), rgba(2,6,23,.95))",
    color: "#ffffff",
    padding: "clamp(20px, 3vh, 34px)",
    textAlign: "center",
    boxShadow: "0 28px 84px rgba(0,0,0,.5)",
    animation: "lojoPrizePop .55s ease-out",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  resultBoxJackpot: {
    background:
      "radial-gradient(circle at top, rgba(250,204,21,.25), rgba(127,29,29,.38) 42%, rgba(2,6,23,.96) 100%)",
    boxShadow:
      "0 0 72px rgba(250,204,21,.55), 0 28px 90px rgba(220,38,38,.38)",
  },
  resultIcon: {
    color: "#facc15",
    fontSize: "clamp(28px, 5vh, 48px)",
    fontWeight: 1000,
    lineHeight: 1,
    marginBottom: "clamp(12px, 2vh, 22px)",
    textShadow: "0 4px 22px rgba(250,204,21,.55)",
  },
  imageGlow: {
    width: "min(520px, 92%)",
    maxHeight: "42vh",
    borderRadius: 24,
    padding: 12,
    background: "#ffffff",
    boxShadow: "0 0 34px rgba(250,204,21,.75), 0 0 80px rgba(250,204,21,.28)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "clamp(14px, 2.2vh, 26px)",
  },
  prizeImage: {
    maxWidth: "100%",
    maxHeight: "38vh",
    objectFit: "contain",
    borderRadius: 18,
    background: "#ffffff",
  },
  giftPlaceholder: {
    width: "min(360px, 70%)",
    aspectRatio: "1",
    borderRadius: "50%",
    background: "radial-gradient(circle, #fff7ed, #facc15)",
    color: "#b45309",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "clamp(80px, 14vh, 150px)",
    boxShadow: "0 0 60px rgba(250,204,21,.65)",
    marginBottom: 22,
  },
  hasGanado: {
    fontSize: "clamp(22px, 4vh, 38px)",
    fontWeight: 1000,
    color: "#ffffff",
    marginBottom: 6,
    textShadow: "0 4px 18px rgba(0,0,0,.65)",
  },
  prizeName: {
    display: "block",
    color: "#facc15",
    fontSize: "clamp(32px, 6vh, 58px)",
    fontWeight: 1000,
    lineHeight: 1.04,
    textShadow: "0 4px 20px rgba(0,0,0,.7)",
    marginBottom: "clamp(16px, 3vh, 34px)",
  },
  nextButton: {
    border: "none",
    borderRadius: 999,
    padding: "clamp(14px, 2vh, 20px) clamp(42px, 6vw, 70px)",
    background: "linear-gradient(180deg, #fb7185 0%, #ef4444 45%, #b91c1c 100%)",
    color: "#ffffff",
    fontSize: "clamp(20px, 3vh, 30px)",
    fontWeight: 1000,
    cursor: "pointer",
    boxShadow: "0 18px 42px rgba(239,68,68,.42), inset 0 2px 0 rgba(255,255,255,.25)",
  },
};
