export default function RuletaResultado({ premio }) {
  if (!premio) return null;

  return (
    <div style={contenedor}>
      {premio.esNoPremio ? (
        <>
          <div style={icono}>😊</div>
          <h3 style={titulo}>Gracias por participar</h3>
          <p style={texto}>Esta vez no ha habido premio.</p>
        </>
      ) : (
        <>
          <div style={icono}>🎁</div>
          <h3 style={titulo}>¡Enhorabuena!</h3>
          <p style={texto}>Has ganado:</p>
          <strong style={premioTexto}>{premio.nombre}</strong>
        </>
      )}
    </div>
  );
}

const contenedor = {
  marginTop: "18px",
  padding: "18px",
  borderRadius: "20px",
  background: "rgba(255,255,255,.08)",
  border: "1px solid rgba(250,204,21,.35)",
  color: "#ffffff",
  textAlign: "center",
};

const icono = {
  fontSize: "54px",
};

const titulo = {
  margin: "8px 0",
  color: "#fde047",
  fontSize: "28px",
  fontWeight: "900",
};

const texto = {
  margin: "6px 0",
  color: "#e5e7eb",
};

const premioTexto = {
  display: "block",
  marginTop: "8px",
  fontSize: "24px",
  color: "#ffffff",
};
