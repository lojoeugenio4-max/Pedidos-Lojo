export default function RuletaCanvas({
  premios = [],
  rotacion = 0,
  girando = false,
  tick = 0,
}) {
  if (!premios.length) return null;

  return (
    <div style={contenedor}>
      <div
        style={{
          ...puntero,
          transform: `translateX(-50%) rotate(${tick % 2 === 0 ? -13 : 13}deg)`,
          transition: "transform 90ms ease-out",
        }}
      >
        <div style={punteroCabeza}>●</div>
        <div style={punteroPunta}>▼</div>
      </div>

      <div style={aroExterior}>
        <div
          style={{
            ...ruleta,
            transform: `rotate(${rotacion}deg)`,
            transition: "none",
            background: crearGradient(premios),
          }}
        >
          <div style={brilloInterior} />
          <div style={centro}>
            <div style={logo}>Lojo</div>
          </div>
        </div>

        {Array.from({ length: 28 }).map((_, index) => (
          <span
            key={index}
            style={{
              ...bombilla,
              transform: `rotate(${(360 / 28) * index}deg) translateY(-174px)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function crearGradient(premios) {
  const grados = 360 / premios.length;

  return `conic-gradient(${premios
    .map((premio, index) => {
      const inicio = index * grados;
      const fin = inicio + grados;
      return `${premio.color || colores[index % colores.length]} ${inicio}deg ${fin}deg`;
    })
    .join(", ")})`;
}

const colores = [
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#2563eb",
  "#7c3aed",
  "#db2777",
];

const contenedor = {
  position: "relative",
  width: "min(82vw, 370px)",
  height: "min(82vw, 370px)",
  margin: "0 auto",
};

const puntero = {
  position: "absolute",
  left: "50%",
  top: "-18px",
  transform: "translateX(-50%)",
  transformOrigin: "50% 20px",
  zIndex: 30,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const punteroCabeza = {
  width: "34px",
  height: "34px",
  borderRadius: "50%",
  background: "linear-gradient(180deg, #fef3c7, #f59e0b)",
  border: "4px solid #b45309",
  boxShadow: "0 6px 18px rgba(0,0,0,.45)",
  color: "transparent",
};

const punteroPunta = {
  marginTop: "-9px",
  color: "#dc2626",
  fontSize: "42px",
  lineHeight: "32px",
  textShadow: "0 4px 8px rgba(0,0,0,.45)",
};

const aroExterior = {
  position: "relative",
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  background:
    "radial-gradient(circle, #fde68a 0%, #f59e0b 55%, #92400e 100%)",
  padding: "18px",
  boxSizing: "border-box",
  boxShadow:
    "0 0 0 4px #78350f, 0 22px 55px rgba(0,0,0,.45), 0 0 45px rgba(245,158,11,.65)",
};

const ruleta = {
  position: "relative",
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  overflow: "hidden",
  border: "5px solid rgba(120,53,15,.8)",
  boxShadow: "inset 0 0 30px rgba(0,0,0,.35)",
};

const brilloInterior = {
  position: "absolute",
  inset: 0,
  borderRadius: "50%",
  background:
    "radial-gradient(circle at 35% 30%, rgba(255,255,255,.34), transparent 24%, rgba(0,0,0,.16) 78%)",
  pointerEvents: "none",
};

const centro = {
  position: "absolute",
  left: "50%",
  top: "50%",
  transform: "translate(-50%,-50%)",
  width: "30%",
  height: "30%",
  borderRadius: "50%",
  background: "linear-gradient(180deg, #111827, #030712)",
  border: "6px solid #f59e0b",
  boxShadow: "0 0 0 3px #fde68a, 0 12px 28px rgba(0,0,0,.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const logo = {
  color: "#ffffff",
  fontSize: "clamp(24px, 7vw, 42px)",
  fontWeight: "900",
  fontStyle: "italic",
  letterSpacing: "-2px",
};

const bombilla = {
  position: "absolute",
  left: "50%",
  top: "50%",
  width: "15px",
  height: "15px",
  marginLeft: "-7.5px",
  marginTop: "-7.5px",
  borderRadius: "50%",
  background: "#fff7ad",
  boxShadow: "0 0 12px #fde047, 0 0 20px #facc15",
  transformOrigin: "50% 50%",
};
