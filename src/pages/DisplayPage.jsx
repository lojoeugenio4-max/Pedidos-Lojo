import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import StoreWheel from "../components/StoreWheel";
import BingoDrumStage from "../components/BingoDrumStage";
import logoLojo from "../assets/logo-lojo.jpg";

const DISPLAY_EVENT_KEY = "lojo-ruleta-display-event";
const SPIN_DURATION_MS = 9200;

const PRODUCTOS_PUBLIC_URL =
  "https://bohlxagrtpjvqrgkonlo.supabase.co/storage/v1/object/public/productos";

const COLORS = [
  "#ef4444",
  "#f97316",
  "#facc15",
  "#65a30d",
  "#059669",
  "#0ea5e9",
  "#2563eb",
  "#7c3aed",
  "#c026d3",
  "#db2777",
];

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

function DisplayWheel({ premios = [], girando, premioFinal }) {
  const segmentos = useMemo(() => {
    const base =
      premios.length >= 8
        ? premios
        : Array.from(
            { length: 10 },
            (_, index) => premios[index % Math.max(premios.length, 1)] || { id: index }
          );

    const grados = 360 / base.length;

    return base.map((premio, index) => ({
      premio,
      color: COLORS[index % COLORS.length],
      start: index * grados,
      end: index * grados + grados,
      icono: ["?", "★", "🎁", "♦"][index % 4],
    }));
  }, [premios]);

  const conic = segmentos
    .map((seg) => `${seg.color} ${seg.start}deg ${seg.end}deg`)
    .join(", ");

  return (
    <div style={wheelStyles.wrap}>
      <div style={wheelStyles.pointer}>
        <div style={wheelStyles.pointerDot} />
      </div>

      <div style={wheelStyles.wheelOuter}>
        <div style={wheelStyles.bulbs}>
          {Array.from({ length: 36 }, (_, index) => {
            const angle = (360 / 36) * index;

            return (
              <span
                key={index}
                style={{
                  ...wheelStyles.bulb,
                  transform: `rotate(${angle}deg) translateY(calc(var(--display-wheel-size) / -2 + 15px))`,
                  animationDelay: `${index * 0.035}s`,
                }}
              />
            );
          })}
        </div>

        <div
          style={{
            ...wheelStyles.wheel,
            background: `conic-gradient(${conic})`,
            animation: girando
              ? "lojoRealSpin 4.2s cubic-bezier(.08,.72,.12,1) forwards"
              : "lojoSlowWheel 18s linear infinite",
          }}
        >
          {segmentos.map((segmento, index) => (
            <div
              key={index}
              style={{
                ...wheelStyles.segmentIcon,
                transform: `rotate(${segmento.start + (segmento.end - segmento.start) / 2}deg) translateY(calc(var(--display-wheel-size) * -0.28))`,
              }}
            >
              <span
                style={{
                  transform: `rotate(-${segmento.start + (segmento.end - segmento.start) / 2}deg)`,
                }}
              >
                {segmento.icono}
              </span>
            </div>
          ))}

          <div style={wheelStyles.center}>
            <img src={logoLojo} alt="Lojo" style={wheelStyles.logo} />
          </div>
        </div>
      </div>

      {!premioFinal && !girando && (
        <div style={wheelStyles.attractLabel}>RULETA ACTIVA</div>
      )}
    </div>
  );
}

export default function DisplayPage() {
  const [premios, setPremios] = useState([]);
  const [estado, setEstado] = useState("waiting");
  const [entrada, setEntrada] = useState(null);
  const [premioFinal, setPremioFinal] = useState(null);
  const [premioObjetivo, setPremioObjetivo] = useState(null);
  const [girando, setGirando] = useState(false);
  const [bingoNumbers, setBingoNumbers] = useState([]);
  const [bingoTrigger, setBingoTrigger] = useState(null);
  const [premiosBingoTV, setPremiosBingoTV] = useState([]);

  useEffect(() => {
    cargarPremios();
    return escucharEventos();
  }, []);

  useEffect(() => {
    if (estado.startsWith("bingo")) cargarPremiosBingoTV();
  }, [estado]);

  async function cargarPremiosBingoTV() {
    const hoy = new Date().toISOString().slice(0, 10);
    const { data: promo, error: promoError } = await supabase
      .from("promociones_bingo")
      .select("*")
      .eq("activa", true)
      .or(`fecha_inicio.is.null,fecha_inicio.lte.${hoy}`)
      .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (promoError || !promo) {
      setPremiosBingoTV([]);
      return;
    }

    const prizeIds = [
      promo.premio_linea_articulo_id,
      promo.premio_linea_especial_articulo_id,
      promo.premio_bingo_articulo_id,
      promo.premio_especial_articulo_id,
    ].filter(Boolean);

    let articulosPorId = new Map();
    if (prizeIds.length) {
      const { data: articulos } = await supabase
        .from("articulos")
        .select("id,nombre,foto")
        .in("id", prizeIds);
      articulosPorId = new Map((articulos || []).map((a) => [String(a.id), a]));
    }

    const construir = (tipo, label, special = false) => {
      const articulo = articulosPorId.get(String(promo[`premio_${tipo}_articulo_id`] || ""));
      return {
        active: Boolean(promo[`premio_${tipo}_activo`]),
        name: promo[`premio_${tipo}_nombre`] || articulo?.nombre || "",
        message: promo[`premio_${tipo}_mensaje`] || "",
        image: getPrizeImageUrl(articulo),
        label,
        special,
      };
    };

    setPremiosBingoTV([
      construir("linea", "Premio por línea"),
      construir("linea_especial", `Línea en ${promo.premio_linea_especial_max_bolas || 0} bolas`, true),
      construir("bingo", "Premio por Bingo"),
      construir("especial", `Bingo en ${promo.premio_especial_max_bolas || 0} bolas`, true),
    ]);
  }

  async function cargarPremios() {
    const hoy = new Date().toISOString().slice(0, 10);

    const { data: promociones, error: promocionError } = await supabase
      .from("promociones_ruleta")
      .select("*")
      .eq("activa", true)
      .order("created_at", { ascending: true });

    if (promocionError) {
      console.error(promocionError);
      setPremios([]);
      return;
    }

    const promocion = (promociones || []).find((item) => {
      const inicioOk = !item.fecha_inicio || item.fecha_inicio <= hoy;
      const finOk = !item.fecha_fin || item.fecha_fin >= hoy;
      return inicioOk && finOk;
    });

    if (!promocion?.id) {
      setPremios([]);
      return;
    }

    const { data, error } = await supabase
      .from("promociones_ruleta_premios")
      .select("*")
      .eq("promocion_id", promocion.id)
      .eq("activo", true)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setPremios([]);
      return;
    }

    setPremios(data || []);
  }

  function aplicarEvento(event) {
    if (!event?.type) return;

    const payload = event.payload || {};

    if (event.type === "waiting") {
      setEstado("waiting");
      setEntrada(null);
      setPremioFinal(null);
      setPremioObjetivo(null);
      setGirando(false);
      return;
    }

    if (event.type === "ready") {
      setEstado("ready");
      setEntrada(payload.entrada || null);
      setPremios(payload.premios || premios);
      setPremioFinal(null);
      setPremioObjetivo(null);
      setGirando(false);
      return;
    }

    if (event.type === "spin") {
      setEstado("spin");
      setEntrada(payload.entrada || null);
      setPremios(payload.premios || premios);
      setPremioFinal(null);
      setPremioObjetivo(payload.premio || null);
      setGirando(true);
      return;
    }

    if (event.type === "result") {
      setEstado("result");
      setEntrada(payload.entrada || null);
      setPremios(payload.premios || premios);
      setPremioFinal(payload.premio || null);
      setPremioObjetivo(null);
      setGirando(false);

      window.setTimeout(() => {
        setEstado("waiting");
        setEntrada(null);
        setPremioFinal(null);
        setPremioObjetivo(null);
        setGirando(false);
      }, 12000);
      return;
    }

    // Eventos del Bingo: mismo mecanismo que la Ruleta (misma pantalla del
    // Televisor, ya abierta de forma permanente), solo cambia lo que se pinta.
    if (event.type === "bingo-waiting") {
      setEstado("bingo-waiting");
      setBingoNumbers(payload.numeros || bingoNumbers);
      return;
    }

    if (event.type === "bingo-spin") {
      setEstado("bingo-spin");
      if (payload.numero && payload.token) {
        setBingoTrigger({ number: Number(payload.numero), token: payload.token });
      }
      return;
    }

    if (event.type === "bingo-result") {
      setEstado("bingo-result");

      window.setTimeout(() => {
        setEstado("waiting");
        setBingoNumbers([]);
        setBingoTrigger(null);
      }, 12000);
    }
  }

  function escucharEventos() {
    try {
      const saved = localStorage.getItem(DISPLAY_EVENT_KEY);
      if (saved) aplicarEvento(JSON.parse(saved));
    } catch {}

    const onStorage = (event) => {
      if (event.key !== DISPLAY_EVENT_KEY || !event.newValue) return;

      try {
        aplicarEvento(JSON.parse(event.newValue));
      } catch {}
    };

    window.addEventListener("storage", onStorage);

    let channel = null;

    try {
      channel = new BroadcastChannel("lojo-ruleta-display");
      channel.onmessage = (event) => aplicarEvento(event.data);
    } catch {}

    return () => {
      window.removeEventListener("storage", onStorage);
      channel?.close?.();
    };
  }

  const premioImagen = getPrizeImageUrl(premioFinal);
  const esJackpot =
    premioFinal?.tipo_sonido === "jackpot" || premioFinal?.tipo_sonido === "sirena";

  if (estado.startsWith("bingo")) {
    // El bombo trae su propia cabecera y su propio fondo (igual que esta
    // pantalla trae la suya para la Ruleta), así que aquí no se envuelve
    // en el layout de la ruleta: se pinta a pantalla completa tal cual.
    return (
      <BingoDrumStage
        numbers={bingoNumbers}
        pendingTrigger={bingoTrigger}
        mostrarControles={false}
        premios={premiosBingoTV}
      />
    );
  }

  return (
    <main style={styles.page}>
      <style>
        {`
          @keyframes lojoDisplayFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-12px); }
          }

          @keyframes lojoDisplayGlow {
            0%, 100% { opacity: .55; transform: scale(.98); }
            50% { opacity: 1; transform: scale(1.04); }
          }

          @keyframes lojoPrizePop {
            0% { transform: scale(.72); opacity: 0; }
            55% { transform: scale(1.07); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }

          @keyframes lojoIdleLightsRotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes lojoBulbPulse {
            from { opacity: .52; filter: brightness(.75); }
            to { opacity: 1; filter: brightness(1.45); }
          }

          @media (max-width: 1200px) {
            .display-stage {
              grid-template-columns: 1fr !important;
            }

            .display-side {
              display: none !important;
            }
          }
        `}
      </style>

      <div style={styles.confettiLayer}>
        {Array.from({ length: 44 }, (_, index) => (
          <span
            key={index}
            style={{
              ...styles.confetti,
              left: `${(index * 29) % 100}%`,
              top: `${(index * 17) % 92}%`,
              background: ["#ef4444", "#facc15", "#22c55e", "#06b6d4", "#a855f7"][index % 5],
              animationDelay: `${index * 0.07}s`,
            }}
          />
        ))}
      </div>

      <section style={styles.header}>
        <div style={styles.kicker}>CASH LOJO</div>
        <h1 style={styles.title}>¡GIRA Y GANA!</h1>
        <p style={styles.subtitle}>Ruleta promocional en tienda</p>
      </section>

      <section className="display-stage" style={styles.stage}>
        <div style={styles.wheelWrap}>
          <StoreWheel
            premios={premios}
            girando={girando}
            premioFinal={premioFinal}
            premioObjetivo={premioObjetivo}
            mostrarBoton={false}
            lucesReposo={estado !== "spin" && estado !== "result"}
            modoDisplay
            duracionGiro={SPIN_DURATION_MS}
          />

          {estado !== "result" && (
            <div style={styles.waitingBadge}>
              <span style={styles.pulseDot} />
              {estado === "spin"
                ? "Girando..."
                : estado === "ready"
                  ? "Participante listo"
                  : "Esperando siguiente participante"}
            </div>
          )}
        </div>

        <div className="display-side" style={styles.side}>
          {estado !== "result" ? (
            <div style={styles.waitPanel}>
              <div style={styles.bigIcon}>🎁</div>
              <h2 style={styles.waitTitle}>
                {estado === "ready" ? "Código válido" : "Premio sorpresa"}
              </h2>
              <p style={styles.waitText}>
                {estado === "ready"
                  ? "El participante ya puede girar la ruleta."
                  : "Escanea tu QR en caja y gira la ruleta delante de todos."}
              </p>

              {entrada?.customer_name && (
                <div style={styles.customerName}>{entrada.customer_name}</div>
              )}
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
              <strong style={styles.prizeName}>{premioFinal?.nombre}</strong>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

const wheelStyles = {
  wrap: {
    "--display-wheel-size": "min(72vh, 48vw, 760px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "clamp(6px, 1vh, 12px)",
  },
  pointer: {
    position: "relative",
    zIndex: 10,
    width: "clamp(54px, 8vh, 88px)",
    height: "clamp(78px, 11vh, 126px)",
    marginBottom: "clamp(-82px, -9vh, -54px)",
    background: "linear-gradient(180deg, #ef4444, #991b1b)",
    clipPath: "polygon(50% 100%, 10% 28%, 50% 0, 90% 28%)",
    filter: "drop-shadow(0 6px 10px rgba(0,0,0,.65))",
    border: "4px solid #facc15",
  },
  pointerDot: {
    position: "absolute",
    top: "18%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "clamp(18px, 3vh, 32px)",
    height: "clamp(18px, 3vh, 32px)",
    borderRadius: "50%",
    background: "radial-gradient(circle, #fff7ed, #facc15 70%)",
    boxShadow: "0 0 20px rgba(250,204,21,.9)",
  },
  wheelOuter: {
    position: "relative",
    width: "var(--display-wheel-size)",
    height: "var(--display-wheel-size)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "radial-gradient(circle, #fff7ed 0%, #facc15 38%, #b45309 68%, #451a03 100%)",
    boxShadow:
      "0 30px 100px rgba(0,0,0,.75), 0 0 65px rgba(250,204,21,.6)",
    flexShrink: 0,
  },
  bulbs: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
  },
  bulb: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "clamp(13px, 2vh, 23px)",
    height: "clamp(13px, 2vh, 23px)",
    marginLeft: "-10px",
    marginTop: "-10px",
    borderRadius: "50%",
    background: "radial-gradient(circle, #ffffff 0%, #fde68a 42%, #f59e0b 100%)",
    boxShadow: "0 0 18px rgba(250,204,21,.95), 0 0 34px rgba(250,204,21,.55)",
    animation: "lojoBulbPulse .78s infinite alternate",
  },
  wheel: {
    width: "calc(100% - clamp(58px, 8vh, 90px))",
    height: "calc(100% - clamp(58px, 8vh, 90px))",
    borderRadius: "50%",
    border: "clamp(6px, 1vh, 10px) solid rgba(255,255,255,.88)",
    boxShadow:
      "inset 0 0 0 3px rgba(0,0,0,.28), inset 0 0 40px rgba(0,0,0,.35), 0 18px 55px rgba(0,0,0,.52)",
    position: "relative",
    overflow: "hidden",
  },
  segmentIcon: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 68,
    height: 68,
    marginLeft: -34,
    marginTop: -34,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    fontSize: "clamp(24px, 4.5vh, 44px)",
    fontWeight: 1000,
    color: "#ffffff",
    textShadow: "0 4px 12px rgba(0,0,0,.75)",
    transformOrigin: "34px 34px",
  },
  center: {
    position: "absolute",
    inset: "33%",
    borderRadius: "50%",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "clamp(7px, 1.2vh, 12px) solid #facc15",
    boxShadow: "0 10px 30px rgba(0,0,0,.55)",
    overflow: "hidden",
  },
  logo: {
    width: "78%",
    height: "78%",
    objectFit: "contain",
  },
  attractLabel: {
    marginTop: 0,
    color: "#facc15",
    fontSize: "clamp(14px, 2.2vh, 24px)",
    fontWeight: 1000,
    letterSpacing: ".18em",
    textShadow: "0 4px 18px rgba(0,0,0,.7)",
  },
};

const styles = {
  page: {
    minHeight: "100dvh",
    height: "100dvh",
    maxHeight: "100dvh",
    background:
      "radial-gradient(circle at 50% 0%, rgba(30,64,175,.58), transparent 36%), radial-gradient(circle at 0% 100%, rgba(250,204,21,.14), transparent 38%), #030712",
    color: "#ffffff",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: "clamp(8px, 1.4vh, 20px)",
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
    opacity: 0.68,
    overflow: "hidden",
  },
  confetti: {
    position: "absolute",
    width: "clamp(8px, 1vw, 16px)",
    height: "clamp(8px, 1vw, 16px)",
    borderRadius: "4px",
    transform: "rotate(45deg)",
    boxShadow: "0 0 18px rgba(255,255,255,.22)",
    animation: "lojoDisplayFloat 3.2s ease-in-out infinite",
  },
  header: {
    position: "relative",
    zIndex: 2,
    textAlign: "center",
    flexShrink: 0,
    marginBottom: "clamp(4px, 0.8vh, 10px)",
  },
  kicker: {
    color: "#ef4444",
    fontSize: "clamp(18px, 2.8vh, 34px)",
    fontWeight: 1000,
    lineHeight: 1,
    textShadow: "0 4px 18px rgba(0,0,0,.65)",
  },
  title: {
    margin: "2px 0",
    fontSize: "clamp(34px, 6.8vh, 86px)",
    lineHeight: 0.9,
    fontWeight: 1000,
    letterSpacing: "-0.055em",
    textShadow: "0 6px 28px rgba(0,0,0,.72)",
  },
  subtitle: {
    margin: 0,
    fontSize: "clamp(15px, 2.2vh, 26px)",
    color: "#e5e7eb",
    fontWeight: 800,
  },
  stage: {
    position: "relative",
    zIndex: 2,
    flex: 1,
    minHeight: 0,
    maxWidth: 1760,
    width: "100%",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, .9fr)",
    gap: "clamp(10px, 1.8vw, 30px)",
    alignItems: "center",
    overflow: "hidden",
  },
  wheelWrap: {
    minHeight: 0,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(8px, 1.2vh, 16px)",
    overflow: "hidden",
  },
  waitingBadge: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    borderRadius: 999,
    padding: "clamp(10px, 1.4vh, 14px) clamp(18px, 3vw, 34px)",
    background: "rgba(15,23,42,.78)",
    border: "1px solid rgba(255,255,255,.16)",
    color: "#ffffff",
    fontSize: "clamp(16px, 2.1vh, 25px)",
    fontWeight: 1000,
    boxShadow: "0 18px 48px rgba(0,0,0,.36)",
  },
  pulseDot: {
    width: "clamp(12px, 1.8vh, 20px)",
    height: "clamp(12px, 1.8vh, 20px)",
    borderRadius: "50%",
    background: "#22c55e",
    boxShadow: "0 0 26px rgba(34,197,94,.95)",
    animation: "lojoDisplayGlow 1s infinite",
  },
  side: {
    minHeight: 0,
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  waitPanel: {
    width: "100%",
    minHeight: "min(48vh, 560px)",
    borderRadius: 30,
    border: "1px solid rgba(255,255,255,.16)",
    background: "linear-gradient(180deg, rgba(15,23,42,.82), rgba(2,6,23,.92))",
    boxShadow: "0 24px 72px rgba(0,0,0,.45)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "clamp(20px, 3vh, 40px)",
    boxSizing: "border-box",
  },
  bigIcon: {
    width: "clamp(120px, 18vh, 210px)",
    height: "clamp(120px, 18vh, 210px)",
    borderRadius: "50%",
    background: "radial-gradient(circle, #fff7ed 0%, #facc15 60%, #b45309 100%)",
    color: "#111827",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "clamp(64px, 11vh, 125px)",
    boxShadow: "0 0 80px rgba(250,204,21,.55)",
    marginBottom: "clamp(14px, 2vh, 24px)",
    animation: "lojoDisplayGlow 2.4s ease-in-out infinite",
  },
  waitTitle: {
    margin: 0,
    fontSize: "clamp(28px, 4.8vh, 58px)",
    lineHeight: 1,
    fontWeight: 1000,
    color: "#facc15",
    textShadow: "0 5px 18px rgba(0,0,0,.65)",
  },
  waitText: {
    margin: "clamp(12px, 1.8vh, 20px) 0 0",
    maxWidth: 520,
    fontSize: "clamp(17px, 2.6vh, 30px)",
    lineHeight: 1.16,
    color: "#ffffff",
    fontWeight: 800,
  },
  customerName: {
    marginTop: 22,
    borderRadius: 999,
    padding: "10px 22px",
    background: "rgba(255,255,255,.1)",
    fontSize: "clamp(16px, 2.3vh, 26px)",
    fontWeight: 1000,
  },
  resultBox: {
    width: "100%",
    height: "100%",
    minHeight: "min(58vh, 620px)",
    borderRadius: 30,
    border: "1px solid rgba(255,255,255,.16)",
    background: "linear-gradient(180deg, rgba(15,23,42,.9), rgba(2,6,23,.96))",
    color: "#ffffff",
    padding: "clamp(20px, 3vh, 40px)",
    textAlign: "center",
    boxShadow: "0 28px 90px rgba(0,0,0,.52)",
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
      "radial-gradient(circle at top, rgba(250,204,21,.28), rgba(127,29,29,.42) 42%, rgba(2,6,23,.97) 100%)",
    boxShadow:
      "0 0 90px rgba(250,204,21,.6), 0 28px 100px rgba(220,38,38,.42)",
  },
  resultIcon: {
    color: "#facc15",
    fontSize: "clamp(26px, 4.4vh, 50px)",
    fontWeight: 1000,
    lineHeight: 1,
    marginBottom: "clamp(12px, 2vh, 24px)",
    textShadow: "0 4px 24px rgba(250,204,21,.6)",
  },
  imageGlow: {
    width: "min(560px, 94%)",
    maxHeight: "40vh",
    borderRadius: 24,
    padding: 12,
    background: "#ffffff",
    boxShadow: "0 0 40px rgba(250,204,21,.82), 0 0 90px rgba(250,204,21,.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "clamp(14px, 2.4vh, 28px)",
  },
  prizeImage: {
    maxWidth: "100%",
    maxHeight: "37vh",
    objectFit: "contain",
    borderRadius: 18,
    background: "#ffffff",
  },
  giftPlaceholder: {
    width: "min(350px, 70%)",
    aspectRatio: "1",
    borderRadius: "50%",
    background: "radial-gradient(circle, #fff7ed, #facc15)",
    color: "#b45309",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "clamp(80px, 14vh, 150px)",
    boxShadow: "0 0 70px rgba(250,204,21,.68)",
    marginBottom: 24,
  },
  hasGanado: {
    fontSize: "clamp(24px, 4vh, 44px)",
    fontWeight: 1000,
    color: "#ffffff",
    marginBottom: 8,
    textShadow: "0 4px 18px rgba(0,0,0,.65)",
  },
  prizeName: {
    display: "block",
    color: "#facc15",
    fontSize: "clamp(34px, 6vh, 70px)",
    fontWeight: 1000,
    lineHeight: 1.02,
    textShadow: "0 5px 22px rgba(0,0,0,.72)",
  },
};
