// Bombo de Bingo reutilizable. Se usa tal cual tanto en el TPV (caja) como
// en la pantalla del Televisor, exactamente igual que StoreWheel se reutiliza
// para la Ruleta: el mismo componente, con props distintas según dónde se
// pinte (modoDisplay agranda el bombo para el TV; mostrarBoton oculta el
// botón "GIRAR BOMBO" en el TV, que allí es solo un espectador pasivo).
export default function StoreBingoDrum({
  girando = false,
  numeroFinal = null,
  onGirar,
  mostrarBoton = true,
  modoDisplay = false,
  mensaje = "",
}) {
  return (
    <div style={styles.wrap}>
      <style>
        {`@keyframes lojoBingoDrumSpin { to { transform: rotate(360deg); } }`}
      </style>

      <div
        style={{
          ...styles.drum,
          ...(modoDisplay ? styles.drumBig : {}),
          ...(girando ? styles.drumSpinning : {}),
        }}
      >
        <div style={{ ...styles.drumBars, ...(modoDisplay ? styles.drumBarsBig : {}) }} />
        <div style={{ ...styles.drumHub, ...(modoDisplay ? styles.drumHubBig : {}) }}>
          {girando ? "?" : numeroFinal != null ? numeroFinal : "🎱"}
        </div>
      </div>

      {mensaje && <p style={{ ...styles.mensaje, ...(modoDisplay ? styles.mensajeBig : {}) }}>{mensaje}</p>}

      {mostrarBoton && (
        <button type="button" onClick={onGirar} disabled={girando} style={styles.boton}>
          {girando ? "GIRANDO..." : "🎱 GIRAR BOMBO"}
        </button>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
  },
  drum: {
    position: "relative",
    width: 170,
    height: 170,
    border: "10px solid #d9a52b",
    borderRadius: "50%",
    overflow: "hidden",
    background: "radial-gradient(circle, #174a8b 0 55%, #071c46 58%)",
    boxShadow: "inset 0 0 0 4px #ffef9d, 0 12px 28px #0006",
  },
  drumBig: {
    width: "min(46vh, 420px)",
    height: "min(46vh, 420px)",
    border: "clamp(10px, 1.4vh, 18px) solid #d9a52b",
    boxShadow: "inset 0 0 0 6px #ffef9d, 0 24px 60px #0009",
  },
  drumSpinning: {
    animation: "lojoBingoDrumSpin .28s linear infinite",
  },
  drumBars: {
    position: "absolute",
    inset: -15,
    background:
      "repeating-linear-gradient(75deg, transparent 0 14px, #ffe58a99 15px 20px, transparent 21px 31px)",
  },
  drumBarsBig: {
    inset: -30,
  },
  drumHub: {
    position: "absolute",
    inset: 55,
    display: "grid",
    placeItems: "center",
    border: "4px double #fff0a0",
    borderRadius: "50%",
    background: "#a96b0c",
    color: "#fff4c2",
    fontWeight: 950,
    fontSize: 34,
    zIndex: 2,
  },
  drumHubBig: {
    inset: "26%",
    border: "clamp(4px, .6vh, 8px) double #fff0a0",
    fontSize: "clamp(48px, 8vh, 96px)",
  },
  mensaje: {
    margin: 0,
    textAlign: "center",
    color: "#e5e7eb",
    fontWeight: 700,
  },
  mensajeBig: {
    color: "#facc15",
    fontSize: "clamp(16px, 2.2vh, 26px)",
    fontWeight: 900,
    textShadow: "0 4px 18px rgba(0,0,0,.65)",
  },
  boton: {
    border: 0,
    borderRadius: 16,
    padding: "16px 26px",
    background: "linear-gradient(135deg, #7c3aed, #4c1d95)",
    color: "#fff",
    fontSize: 18,
    fontWeight: 900,
    cursor: "pointer",
  },
};
