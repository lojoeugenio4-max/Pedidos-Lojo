// Aviso a pantalla completa con globos y confeti para el cliente que
// acaba de descubrir (al abrir la app) que ha ganado un Sorteo. Se
// muestra una sola vez (App.jsx la marca como vista tras cerrarla).
const COLORES = ["#ff1e1e", "#facc15", "#22c55e", "#38bdf8", "#f472b6", "#ffffff"];

function numeroAleatorioEntre(min, max) {
  return Math.random() * (max - min) + min;
}

export default function CelebracionPremio({ premio, onCerrar }) {
  if (!premio) return null;

  const globos = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    izquierda: numeroAleatorioEntre(2, 92),
    color: COLORES[i % COLORES.length],
    retraso: numeroAleatorioEntre(0, 2.4),
    duracion: numeroAleatorioEntre(6, 10),
  }));

  const confeti = Array.from({ length: 46 }, (_, i) => ({
    id: i,
    izquierda: numeroAleatorioEntre(0, 100),
    color: COLORES[i % COLORES.length],
    retraso: numeroAleatorioEntre(0, 2.5),
    duracion: numeroAleatorioEntre(2.6, 4.6),
    rotacionInicial: numeroAleatorioEntre(0, 360),
  }));

  return (
    <div style={estilos.overlay} role="dialog" aria-modal="true" aria-label="Premio de Sorteo">
      <style>{`
        @keyframes lojoGloboSube {
          0% { transform: translateY(0) rotate(-4deg); opacity: 0; }
          8% { opacity: 1; }
          100% { transform: translateY(-115vh) rotate(4deg); opacity: 1; }
        }
        @keyframes lojoConfetiCae {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; }
        }
        @keyframes lojoPremioPop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {globos.map((g) => (
        <div
          key={`globo-${g.id}`}
          style={{
            ...estilos.globo,
            left: `${g.izquierda}%`,
            background: g.color,
            animationDelay: `${g.retraso}s`,
            animationDuration: `${g.duracion}s`,
          }}
        >
          <div style={estilos.globoHilo} />
        </div>
      ))}

      {confeti.map((c) => (
        <div
          key={`confeti-${c.id}`}
          style={{
            ...estilos.confeti,
            left: `${c.izquierda}%`,
            background: c.color,
            animationDelay: `${c.retraso}s`,
            animationDuration: `${c.duracion}s`,
            transform: `rotate(${c.rotacionInicial}deg)`,
          }}
        />
      ))}

      <div style={estilos.tarjeta}>
        <div style={estilos.emoji}>🎉🏆🎉</div>
        <h2 style={estilos.titulo}>¡ENHORABUENA!</h2>
        <p style={estilos.subtitulo}>
          Tu número <strong>{String(premio.numero).padStart(2, "0")}</strong> de{" "}
          <strong>{premio.edition_nombre}</strong> ha sido el número premiado.
        </p>
        {premio.premio_texto && (
          <div style={estilos.premioBox}>
            🎁 <strong>{premio.premio_texto}</strong>
          </div>
        )}
        <p style={estilos.nota}>Pásate por tienda para recogerlo. ¡Gracias por participar!</p>
        <button type="button" onClick={onCerrar} style={estilos.boton}>
          ¡Genial! ✕
        </button>
      </div>
    </div>
  );
}

const estilos = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 3000,
    background: "radial-gradient(circle at 50% 20%, rgba(255,30,30,.5), rgba(5,8,24,.94) 70%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  globo: {
    position: "absolute",
    bottom: "-140px",
    width: 56,
    height: 70,
    borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
    animationName: "lojoGloboSube",
    animationTimingFunction: "ease-in",
    animationIterationCount: "infinite",
    boxShadow: "inset -8px -8px 14px rgba(0,0,0,.18)",
  },
  globoHilo: {
    position: "absolute",
    left: "50%",
    top: "100%",
    width: 1,
    height: 26,
    background: "rgba(255,255,255,.5)",
  },
  confeti: {
    position: "absolute",
    top: "-12px",
    width: 9,
    height: 14,
    borderRadius: 2,
    animationName: "lojoConfetiCae",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
  },
  tarjeta: {
    position: "relative",
    zIndex: 1,
    width: "min(92vw, 380px)",
    background: "#ffffff",
    borderRadius: 24,
    padding: "30px 22px",
    textAlign: "center",
    boxShadow: "0 24px 60px rgba(0,0,0,.5)",
    animation: "lojoPremioPop .5s ease-out",
  },
  emoji: { fontSize: 34, marginBottom: 6 },
  titulo: { margin: "0 0 8px", fontSize: 26, fontWeight: 1000, color: "#ff1e1e" },
  subtitulo: { margin: "0 0 14px", fontSize: 15, color: "#111827", lineHeight: 1.4 },
  premioBox: {
    margin: "0 0 14px",
    padding: "12px 14px",
    borderRadius: 14,
    background: "#fef9c3",
    border: "2px solid #eab308",
    color: "#713f12",
    fontSize: 16,
  },
  nota: { margin: "0 0 18px", fontSize: 13, color: "#6b7280" },
  boton: {
    border: 0,
    borderRadius: 999,
    padding: "13px 30px",
    background: "linear-gradient(135deg, #ff1e1e, #a30f0f)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(255,30,30,.4)",
  },
};
