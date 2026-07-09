import { useEffect, useMemo, useRef, useState } from "react";
import logoLojo from "../assets/logo-lojo.jpg";

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

const DEFAULT_SPIN_DURATION = 9200;

const PRODUCTOS_PUBLIC_URL =
  "https://bohlxagrtpjvqrgkonlo.supabase.co/storage/v1/object/public/productos";

function normalizarGrados(valor) {
  return ((valor % 360) + 360) % 360;
}

function easeCasino(t) {
  // Mucha inercia al principio y frenada muy larga al final.
  return 1 - Math.pow(1 - t, 4.6);
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

function mismoPremio(a, b) {
  if (!a || !b) return false;
  if (a.id != null && b.id != null) return String(a.id) === String(b.id);
  return a === b;
}

export default function StoreWheel({
  premios = [],
  girando = false,
  premioFinal,
  premioObjetivo,
  onGirar,
  mostrarBoton = true,
  lucesReposo = false,
  modoDisplay = false,
  duracionGiro = DEFAULT_SPIN_DURATION,
}) {
  const [rotacion, setRotacion] = useState(0);
  const [tickFreno, setTickFreno] = useState(0);

  const rotacionRef = useRef(0);
  const frameRef = useRef(null);
  const ultimoSectorRef = useRef(null);
  const estabaGirandoRef = useRef(false);

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

  useEffect(() => {
    if (!girando) {
      estabaGirandoRef.current = false;
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    if (estabaGirandoRef.current) return;
    estabaGirandoRef.current = true;

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const inicio = rotacionRef.current;
    const inicioNormalizado = normalizarGrados(inicio);
    const vueltas = 15 + Math.floor(Math.random() * 4);
    const premioDestino = premioObjetivo || premioFinal;
    const indiceDestino = segmentos.findIndex((segmento) => mismoPremio(segmento.premio, premioDestino));
    const totalSegmentosDestino = Math.max(segmentos.length, 1);
    const gradosSegmentoDestino = 360 / totalSegmentosDestino;
    const centroDestino = indiceDestino >= 0
      ? indiceDestino * gradosSegmentoDestino + gradosSegmentoDestino / 2
      : 0;
    const rotacionObjetivo = normalizarGrados(360 - centroDestino);
    const ajusteFinal = normalizarGrados(rotacionObjetivo - inicioNormalizado);
    const destino = inicio + vueltas * 360 + ajusteFinal;
    const distancia = destino - inicio;
    const inicioTiempo = performance.now();
    const totalSegmentos = Math.max(segmentos.length, 1);
    const gradosSector = 360 / totalSegmentos;

    function animar(ahora) {
      const progreso = Math.min((ahora - inicioTiempo) / duracionGiro, 1);
      const suavizado = easeCasino(progreso);
      const nuevaRotacion = inicio + distancia * suavizado;

      rotacionRef.current = nuevaRotacion;
      setRotacion(nuevaRotacion);

      const sectorActual = Math.floor(normalizarGrados(nuevaRotacion) / gradosSector);
      if (sectorActual !== ultimoSectorRef.current) {
        ultimoSectorRef.current = sectorActual;
        setTickFreno((valor) => valor + 1);
      }

      if (progreso < 1 && girando) {
        frameRef.current = requestAnimationFrame(animar);
      } else {
        rotacionRef.current = destino;
        setRotacion(destino);
        frameRef.current = null;
      }
    }

    frameRef.current = requestAnimationFrame(animar);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [girando, duracionGiro, segmentos, premioObjetivo, premioFinal]);

  const frenoActivo = girando;
  const anguloFreno = frenoActivo ? (tickFreno % 2 === 0 ? -8 : 8) : 0;

  return (
    <div
      style={{
        ...styles.wrap,
        ...(modoDisplay ? styles.wrapDisplay : {}),
      }}
    >
      <div
        style={{
          ...styles.pointer,
          transform: `rotate(${anguloFreno}deg)`,
          transition: frenoActivo ? "transform 75ms ease-out" : "transform 180ms ease-out",
        }}
      >
        <div style={styles.pointerDot} />
      </div>

      <div
        style={{
          ...styles.wheelOuter,
          ...(girando ? styles.wheelOuterSpinning : {}),
        }}
      >
        <div
          style={{
            ...styles.bulbs,
            animation: lucesReposo && !girando ? "lojoIdleLightsRotate 24s linear infinite" : "none",
          }}
        >
          {Array.from({ length: modoDisplay ? 36 : 32 }, (_, index) => {
            const total = modoDisplay ? 36 : 32;
            const angle = (360 / total) * index;

            return (
              <span
                key={index}
                style={{
                  ...styles.bulb,
                  transform: `rotate(${angle}deg) translateY(calc(var(--wheel-size) / -2 + 14px))`,
                  animationDelay: `${index * 0.08}s`,
                  animationDuration: lucesReposo && !girando ? "1.65s" : ".78s",
                }}
              />
            );
          })}
        </div>

        <div
          style={{
            ...styles.wheel,
            background: `conic-gradient(${conic})`,
            transform: `rotate(${rotacion}deg)`,
          }}
        >
          {segmentos.map((segmento, index) => {
            const anguloCentro = segmento.start + (segmento.end - segmento.start) / 2;
            const imagenPremio = getPrizeImageUrl(segmento.premio);
            const esGanador = premioFinal && mismoPremio(segmento.premio, premioFinal);

            return (
              <div
                key={index}
                style={{
                  ...styles.segmentPrize,
                  transform: `rotate(${anguloCentro}deg) translateY(calc(var(--wheel-size) * -0.28))`,
                }}
              >
                <div
                  style={{
                    ...styles.segmentPrizeInner,
                    ...(esGanador ? styles.segmentPrizeWinner : {}),
                    transform: `rotate(-${anguloCentro}deg)${esGanador ? " scale(1.08)" : ""}`,
                  }}
                >
                  {imagenPremio ? (
                    <img
                      src={imagenPremio}
                      alt="Premio"
                      style={styles.segmentPrizeImage}
                      draggable={false}
                    />
                  ) : (
                    <span style={styles.segmentPrizeFallback}>{segmento.icono}</span>
                  )}
                </div>
              </div>
            );
          })}

          <div style={styles.center}>
            <img src={logoLojo} alt="Lojo" style={styles.logo} />
          </div>
        </div>
      </div>

      {mostrarBoton && !premioFinal && (
        <button
          type="button"
          onClick={onGirar}
          disabled={girando || premios.length === 0}
          style={{
            ...styles.button,
            opacity: girando || premios.length === 0 ? 0.55 : 1,
            cursor: girando || premios.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          {girando ? "GIRANDO..." : "GIRAR RULETA"}
        </button>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    "--wheel-size": "min(61vh, 45vw, 650px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "clamp(10px, 1.6vh, 18px)",
  },
  wrapDisplay: {
    "--wheel-size": "min(72vh, 48vw, 760px)",
    gap: "clamp(6px, 1vh, 12px)",
  },
  pointer: {
    position: "relative",
    zIndex: 10,
    width: "clamp(54px, 8vh, 82px)",
    height: "clamp(78px, 11vh, 118px)",
    marginBottom: "clamp(-76px, -9vh, -54px)",
    background: "linear-gradient(180deg, #ef4444, #991b1b)",
    clipPath: "polygon(50% 100%, 10% 28%, 50% 0, 90% 28%)",
    filter: "drop-shadow(0 6px 10px rgba(0,0,0,.65))",
    border: "4px solid #facc15",
    transformOrigin: "50% 18%",
  },
  pointerDot: {
    position: "absolute",
    top: "18%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "clamp(18px, 3vh, 30px)",
    height: "clamp(18px, 3vh, 30px)",
    borderRadius: "50%",
    background: "radial-gradient(circle, #fff7ed, #facc15 70%)",
    boxShadow: "0 0 20px rgba(250,204,21,.9)",
  },
  wheelOuter: {
    position: "relative",
    width: "var(--wheel-size)",
    height: "var(--wheel-size)",
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
  wheelOuterSpinning: {
    boxShadow:
      "0 30px 100px rgba(0,0,0,.78), 0 0 82px rgba(250,204,21,.78)",
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
    width: "clamp(13px, 2.1vh, 22px)",
    height: "clamp(13px, 2.1vh, 22px)",
    marginLeft: "-10px",
    marginTop: "-10px",
    borderRadius: "50%",
    background: "radial-gradient(circle, #ffffff 0%, #fde68a 42%, #f59e0b 100%)",
    boxShadow: "0 0 18px rgba(250,204,21,.95), 0 0 34px rgba(250,204,21,.55)",
    animation: "lojoBulbPulse .78s infinite alternate",
  },
  wheel: {
    width: "calc(100% - clamp(58px, 8vh, 86px))",
    height: "calc(100% - clamp(58px, 8vh, 86px))",
    borderRadius: "50%",
    border: "clamp(6px, 1vh, 10px) solid rgba(255,255,255,.88)",
    boxShadow:
      "inset 0 0 0 3px rgba(0,0,0,.28), inset 0 0 40px rgba(0,0,0,.35), 0 18px 55px rgba(0,0,0,.52)",
    position: "relative",
    overflow: "hidden",
    willChange: "transform",
  },
  segmentPrize: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "clamp(54px, 8vh, 82px)",
    height: "clamp(54px, 8vh, 82px)",
    marginLeft: "clamp(-41px, -4vh, -27px)",
    marginTop: "clamp(-41px, -4vh, -27px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transformOrigin: "50% 50%",
    pointerEvents: "none",
  },
  segmentPrizeInner: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    background: "rgba(255,255,255,.92)",
    border: "3px solid rgba(255,255,255,.95)",
    boxShadow: "0 8px 22px rgba(0,0,0,.42), inset 0 0 0 2px rgba(250,204,21,.28)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  segmentPrizeWinner: {
    boxShadow: "0 0 0 5px rgba(250,204,21,.95), 0 0 34px rgba(250,204,21,.95), 0 10px 28px rgba(0,0,0,.5)",
  },
  segmentPrizeImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  segmentPrizeFallback: {
    fontSize: "clamp(22px, 4vh, 38px)",
    fontWeight: 1000,
    color: "#b45309",
    textShadow: "0 2px 8px rgba(255,255,255,.8)",
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
  button: {
    border: "none",
    borderRadius: 999,
    padding: "clamp(14px, 2vh, 22px) clamp(34px, 6vw, 60px)",
    background: "linear-gradient(180deg, #fb7185 0%, #ef4444 45%, #b91c1c 100%)",
    color: "#ffffff",
    fontSize: "clamp(20px, 3vw, 34px)",
    fontWeight: 1000,
    boxShadow: "0 18px 38px rgba(239,68,68,.42), inset 0 2px 0 rgba(255,255,255,.25)",
    flexShrink: 0,
    letterSpacing: ".02em",
  },
};
