// Pantalla del SORTEO EN DIRECTO: dos ruedas de números (decenas y unidades)
// que giran y se paran una detrás de otra —primero unidades, después
// decenas— y dan el número premiado.
//
// Se usa igual en la TV grande (variante "tv", con sonido y voz) y en el móvil
// del cliente (variante "movil"). El número YA lo ha elegido el servidor
// (iniciar_sorteo_edition); aquí solo se dibuja la animación en función de
// "hora del servidor − instante de arranque", por eso todas las pantallas
// van a la vez y una que se abra tarde se incorpora en el punto correcto.
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { lanzarConfeti } from "../../utils/confetti";
import {
  audioSorteoActivo,
  cantarResultadoSorteo,
  desbloquearAudioSorteo,
  iniciarRedobleSorteo,
  playSorteoParada,
  playSorteoPlatillos,
} from "../../utils/sorteoSound";
import {
  SORTEO_T_DECENAS_MS,
  SORTEO_T_REVELAR_MS,
  SORTEO_T_UNIDADES_MS,
} from "../../utils/sorteoDirecto";
import logoLojo from "../../assets/logo-lojo.jpg";

// Velocidad de giro rápido (dígitos por milisegundo) y duración del frenado.
const VELOCIDAD = 0.024;
const FRENADA_MS = 4200;

// Posición de una rueda (en "dígitos recorridos") a los t ms del arranque.
// Gira a velocidad constante y frena suave hasta clavarse EXACTAMENTE en el
// dígito objetivo justo en tParada (la posición final es siempre ≡ objetivo
// mod 10).
export function posicionRueda(t, objetivo, tParada) {
  if (t <= 0) return 0;
  const tFrenada = tParada - FRENADA_MS;
  const posIniFrenada = VELOCIDAD * tFrenada;
  const minimo = posIniFrenada + 27;
  const total = Math.ceil((minimo - objetivo) / 10) * 10 + objetivo;

  if (t < tFrenada) return VELOCIDAD * t;
  if (t >= tParada) return total;

  const u = (t - tFrenada) / FRENADA_MS;
  const suavizado = 1 - Math.pow(1 - u, 3);
  return posIniFrenada + (total - posIniFrenada) * suavizado;
}

function Rueda({ objetivo, tParada, t, etiqueta, enMarcha, alto }) {
  const pos = posicionRueda(t, objetivo, tParada);
  const parada = t >= tParada;
  const velocidad = (posicionRueda(t + 16, objetivo, tParada) - pos) / 16;
  const desenfoque = parada ? 0 : Math.min(4, velocidad * 150);
  const base = Math.floor(pos);
  const fraccion = pos - base;

  return (
    <div style={estilos.ruedaColumna}>
      <div
        style={{
          ...estilos.rueda,
          height: alto,
          width: `calc(${alto} * 0.62)`,
          ...(parada ? estilos.ruedaParada : null),
        }}
      >
        {[0, 1].map((j) => (
          <div
            key={j}
            style={{
              ...estilos.digito,
              fontSize: `calc(${alto} * 0.8)`,
              transform: `translateY(${(j - fraccion) * 100}%)`,
              filter: desenfoque > 0.2 ? `blur(${desenfoque.toFixed(1)}px)` : "none",
              color: parada ? "#fde047" : "#ffffff",
              textShadow: parada
                ? "0 0 26px rgba(250,204,21,.85), 0 0 60px rgba(250,204,21,.45)"
                : "0 4px 14px rgba(0,0,0,.5)",
            }}
          >
            {(base + j) % 10}
          </div>
        ))}
        <div style={estilos.sombraArriba} />
        <div style={estilos.sombraAbajo} />
        <div style={estilos.lineaCentro} />
      </div>
      <div
        style={{
          ...estilos.etiquetaRueda,
          ...(parada ? estilos.etiquetaRuedaLista : enMarcha ? estilos.etiquetaRuedaActiva : null),
        }}
      >
        {parada ? `✓ ${etiqueta}` : etiqueta}
      </div>
    </div>
  );
}

export default function SorteoDirecto({
  edicion,
  getAhora,
  variante = "tv",
  sonido = false,
  misNumeros = [],
  onCerrar,
}) {
  const esTV = variante === "tv";
  const alto = esTV ? "min(46vh, 34vw)" : "min(30vh, 40vw)";

  const numeroFinal = edicion.decenas * 10 + edicion.unidades;

  const [t, setT] = useState(() => Math.max(0, getAhora() - edicion.inicioAt));
  const [casillas, setCasillas] = useState([]);

  // Lo que ya había pasado al abrir la pantalla no vuelve a sonar ni a
  // lanzar confeti (p. ej. un móvil que abre la app cuando ya salió).
  const disparado = useRef(null);
  if (disparado.current === null) {
    disparado.current = {
      unidades: t >= SORTEO_T_UNIDADES_MS,
      decenas: t >= SORTEO_T_DECENAS_MS,
      resultado: t >= SORTEO_T_REVELAR_MS,
    };
  }
  const temporizadorVoz = useRef(null);

  // ¿Está despierto el audio? (los navegadores lo bloquean hasta que alguien
  // toca la pantalla). Se vigila para arrancar el redoble en cuanto se pueda.
  const [audioActivo, setAudioActivo] = useState(() => (sonido ? audioSorteoActivo() : false));
  useEffect(() => {
    if (!sonido) return undefined;
    const revisar = () => setAudioActivo(audioSorteoActivo());
    revisar();
    const intervalo = window.setInterval(revisar, 400);
    return () => window.clearInterval(intervalo);
  }, [sonido]);

  // Redoble de tambor mientras giran las ruedas (solo en la TV). Arranca en
  // el punto que toca del sorteo: sirve tanto si la pantalla se abre a mitad
  // como si el audio se desbloquea con un toque a mitad del sorteo.
  useEffect(() => {
    if (!sonido || !audioActivo) return undefined;
    const tAhora = Math.max(0, getAhora() - edicion.inicioAt);
    if (tAhora >= SORTEO_T_REVELAR_MS) return undefined;
    return iniciarRedobleSorteo({ desdeMs: tAhora, hastaMs: SORTEO_T_REVELAR_MS });
  }, [sonido, audioActivo, getAhora, edicion.inicioAt]);

  useEffect(
    () => () => {
      if (temporizadorVoz.current) window.clearTimeout(temporizadorVoz.current);
    },
    []
  );

  // Reloj de la animación: se repinta en cada fotograma hasta poco después
  // de revelar el resultado; luego ya no hace falta.
  useEffect(() => {
    let raf = null;
    const paso = () => {
      const ahora = Math.max(0, getAhora() - edicion.inicioAt);
      setT(ahora);
      if (ahora < SORTEO_T_REVELAR_MS + 1500) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [edicion.inicioAt, getAhora]);

  // Nombres de la cuadrícula, para anunciar al ganador.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase.rpc("obtener_cuadricula_sorteo", { p_edition_id: edicion.id });
      if (error) {
        console.error("No se pudo cargar la cuadrícula del sorteo:", error);
        return;
      }
      if (!cancelado) setCasillas(data?.casillas || []);
    })();
    return () => {
      cancelado = true;
    };
  }, [edicion.id]);

  // Sonidos y celebración, cada uno una sola vez en su momento.
  useEffect(() => {
    const marca = disparado.current;
    // Si el audio sigue bloqueado, nada suena (y no se acumula para sonar
    // tarde cuando se desbloquee).
    const sonar = sonido && audioSorteoActivo();

    if (!marca.unidades && t >= SORTEO_T_UNIDADES_MS) {
      marca.unidades = true;
      if (sonar) playSorteoParada();
    }
    if (!marca.decenas && t >= SORTEO_T_DECENAS_MS) {
      marca.decenas = true;
      if (sonar) playSorteoParada();
    }
    if (!marca.resultado && t >= SORTEO_T_REVELAR_MS) {
      marca.resultado = true;
      lanzarConfeti({ duracionMs: 7000 });
      if (sonar) {
        // Platillazo al aparecer el número y, un instante después (para que
        // se oigan los platillos), la voz canta el número y felicita.
        playSorteoPlatillos();
        temporizadorVoz.current = window.setTimeout(() => cantarResultadoSorteo({ numero: numeroFinal }), 1100);
      }
    }
  }, [t, sonido, numeroFinal]);

  const revelado = t >= SORTEO_T_REVELAR_MS;
  const fase = t < SORTEO_T_UNIDADES_MS ? "unidades" : t < SORTEO_T_DECENAS_MS ? "decenas" : revelado ? "resultado" : "suspense";
  const titulo = {
    unidades: "Sorteando las UNIDADES…",
    decenas: "Sorteando las DECENAS…",
    suspense: "Y el número premiado es…",
    resultado: "¡NÚMERO PREMIADO!",
  }[fase];

  const ganador = casillas.find((c) => Number(c.numero) === numeroFinal);
  const esMio = misNumeros.includes(numeroFinal);
  const premio = edicion.premioTexto;

  return (
    <div
      style={{ ...estilos.pantalla, zIndex: esTV ? 5000 : 10100 }}
      role="dialog"
      aria-modal="true"
      aria-label="Sorteo en directo"
      onPointerDown={sonido && !audioActivo ? () => desbloquearAudioSorteo().then((ok) => ok && setAudioActivo(true)) : undefined}
    >
      <style>{`
        @keyframes lojoSorteoLatido { 0%,100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.06); opacity: 1; } }
        @keyframes lojoSorteoPop { 0% { transform: scale(.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes lojoSorteoBrillo { 0%,100% { box-shadow: 0 0 30px 6px rgba(250,204,21,.45); } 50% { box-shadow: 0 0 70px 20px rgba(250,204,21,.85); } }
      `}</style>

      <header style={estilos.cabecera}>
        <img src={logoLojo} alt="Cash Lojo" style={{ ...estilos.logo, width: esTV ? 64 : 44, height: esTV ? 64 : 44 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...estilos.kicker, fontSize: esTV ? "clamp(18px, 2.6vh, 30px)" : 15 }}>CASH LOJO · 🎟️ SORTEO EN DIRECTO</div>
          <div style={{ ...estilos.subtitulo, fontSize: esTV ? "clamp(14px, 2vh, 22px)" : 13 }}>{edicion.nombre}</div>
        </div>
        {!esTV && onCerrar && (
          <button type="button" onClick={onCerrar} style={estilos.cerrar} aria-label="Cerrar sorteo">
            ✕
          </button>
        )}
      </header>

      <main style={estilos.centro}>
        <div
          style={{
            ...estilos.fase,
            fontSize: esTV ? "clamp(24px, 4.2vh, 52px)" : 20,
            color: fase === "resultado" ? "#fde047" : "#ffffff",
            animation: fase === "resultado" ? "lojoSorteoPop .5s ease-out" : "lojoSorteoLatido 1.1s ease-in-out infinite",
          }}
        >
          {titulo}
        </div>

        <div style={{ ...estilos.ruedas, gap: esTV ? "3vw" : 16 }}>
          <Rueda
            objetivo={edicion.decenas}
            tParada={SORTEO_T_DECENAS_MS}
            t={t}
            etiqueta="DECENAS"
            enMarcha={fase === "decenas"}
            alto={alto}
          />
          <Rueda
            objetivo={edicion.unidades}
            tParada={SORTEO_T_UNIDADES_MS}
            t={t}
            etiqueta="UNIDADES"
            enMarcha={fase === "unidades"}
            alto={alto}
          />
        </div>

        <div style={{ ...estilos.resultadoZona, minHeight: esTV ? "16vh" : 130 }}>
          {revelado && (
            <div style={estilos.resultadoCaja}>
              {esTV ? (
                <>
                  <div style={{ ...estilos.ganador, fontSize: "clamp(26px, 5vh, 62px)" }}>
                    🏆 {ganador?.cliente_nombre || "¡Ya tenemos ganador!"}
                  </div>
                  {premio && (
                    <div style={{ ...estilos.premio, fontSize: "clamp(18px, 3vh, 38px)" }}>🎁 {premio}</div>
                  )}
                </>
              ) : esMio ? (
                <>
                  <div style={{ ...estilos.ganador, fontSize: 30, color: "#4ade80" }}>🎉 ¡HAS GANADO! 🎉</div>
                  <div style={{ ...estilos.subtitulo, fontSize: 15 }}>
                    Tu número {String(numeroFinal).padStart(2, "0")} de {edicion.nombre} ha sido el premiado.
                  </div>
                  {premio && <div style={{ ...estilos.premio, fontSize: 20 }}>🎁 {premio}</div>}
                </>
              ) : (
                <div style={{ ...estilos.subtitulo, fontSize: 16 }}>
                  El número premiado es el <strong>{String(numeroFinal).padStart(2, "0")}</strong>. ¡Suerte en el próximo sorteo!
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {sonido && !audioActivo && (
        <div style={estilos.avisoSonido}>🔊 Toca la pantalla para activar el sonido</div>
      )}

      {!esTV && (
        <footer style={estilos.pie}>
          {misNumeros.length > 0 && (
            <div style={estilos.misNumeros}>
              Tus números:{" "}
              {misNumeros.map((n) => (
                <span
                  key={n}
                  style={{
                    ...estilos.chip,
                    ...(revelado && n === numeroFinal ? estilos.chipGanador : null),
                  }}
                >
                  {String(n).padStart(2, "0")}
                </span>
              ))}
            </div>
          )}
          {revelado && onCerrar && (
            <button type="button" onClick={onCerrar} style={estilos.botonCerrar}>
              Continuar
            </button>
          )}
        </footer>
      )}
    </div>
  );
}

const estilos = {
  pantalla: {
    position: "fixed",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    color: "#ffffff",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    background:
      "radial-gradient(circle at 50% 0%, rgba(255,30,30,.42), transparent 45%), radial-gradient(circle at 0% 100%, rgba(250,204,21,.14), transparent 40%), #050818",
    padding: "clamp(10px, 2vh, 28px)",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  cabecera: { display: "flex", alignItems: "center", gap: 12, flexShrink: 0 },
  logo: {
    objectFit: "contain",
    borderRadius: 12,
    background: "#ffffff",
    padding: 5,
    boxShadow: "0 6px 16px rgba(0,0,0,.35)",
    flexShrink: 0,
  },
  kicker: { color: "#ff4d4d", fontWeight: 1000, letterSpacing: "0.03em", lineHeight: 1.15 },
  subtitulo: { margin: 0, color: "rgba(255,255,255,.85)", fontWeight: 700 },
  cerrar: {
    border: "1px solid rgba(255,255,255,.3)",
    borderRadius: 999,
    width: 40,
    height: 40,
    background: "rgba(255,255,255,.1)",
    color: "#fff",
    fontSize: 18,
    fontWeight: 800,
    cursor: "pointer",
    flexShrink: 0,
  },
  centro: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(10px, 2.4vh, 32px)",
  },
  fase: { fontWeight: 1000, textAlign: "center", textShadow: "0 4px 18px rgba(0,0,0,.55)" },
  ruedas: { display: "flex", alignItems: "flex-start", justifyContent: "center" },
  ruedaColumna: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10 },
  rueda: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 22,
    background: "linear-gradient(180deg, #0a1030 0%, #16245a 50%, #0a1030 100%)",
    border: "6px solid #f5c542",
    boxShadow: "0 0 0 3px rgba(0,0,0,.4), 0 18px 50px rgba(0,0,0,.6), inset 0 0 40px rgba(0,0,0,.7)",
    boxSizing: "content-box",
  },
  ruedaParada: { animation: "lojoSorteoBrillo 1.4s ease-in-out infinite" },
  digito: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
    lineHeight: 1,
    fontFamily: '"Arial Black", Impact, system-ui, sans-serif',
    willChange: "transform",
  },
  sombraArriba: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "28%",
    background: "linear-gradient(180deg, rgba(5,8,24,.85), transparent)",
    pointerEvents: "none",
  },
  sombraAbajo: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "28%",
    background: "linear-gradient(0deg, rgba(5,8,24,.85), transparent)",
    pointerEvents: "none",
  },
  lineaCentro: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 0,
    borderTop: "2px solid rgba(255,30,30,.35)",
    pointerEvents: "none",
  },
  etiquetaRueda: {
    fontSize: "clamp(11px, 1.8vh, 20px)",
    fontWeight: 900,
    letterSpacing: "0.12em",
    color: "rgba(255,255,255,.55)",
  },
  etiquetaRuedaActiva: { color: "#ffffff", animation: "lojoSorteoLatido 1s ease-in-out infinite" },
  etiquetaRuedaLista: { color: "#fde047" },
  resultadoZona: { display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" },
  resultadoCaja: { display: "grid", gap: 8, animation: "lojoSorteoPop .55s ease-out", justifyItems: "center" },
  ganador: { fontWeight: 1000, textShadow: "0 4px 18px rgba(0,0,0,.6)" },
  premio: {
    padding: "8px 20px",
    borderRadius: 16,
    background: "#fef9c3",
    color: "#713f12",
    fontWeight: 900,
    border: "2px solid #eab308",
  },
  avisoSonido: {
    position: "absolute",
    left: "50%",
    bottom: "3vh",
    transform: "translateX(-50%)",
    padding: "12px 26px",
    borderRadius: 999,
    background: "rgba(255,255,255,.95)",
    color: "#7f1d1d",
    fontSize: "clamp(16px, 2.4vh, 28px)",
    fontWeight: 900,
    boxShadow: "0 10px 30px rgba(0,0,0,.5)",
    animation: "lojoSorteoLatido 1.2s ease-in-out infinite",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  pie: { flexShrink: 0, display: "grid", gap: 10, justifyItems: "center", paddingBottom: "env(safe-area-inset-bottom, 0px)" },
  misNumeros: { fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,.85)", textAlign: "center" },
  chip: {
    display: "inline-block",
    margin: "0 3px",
    padding: "3px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,.14)",
    fontWeight: 900,
  },
  chipGanador: { background: "#16a34a", boxShadow: "0 0 14px 3px rgba(34,197,94,.7)" },
  botonCerrar: {
    border: 0,
    borderRadius: 999,
    padding: "13px 34px",
    background: "linear-gradient(135deg, #ff1e1e, #a30f0f)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(255,30,30,.4)",
  },
};
