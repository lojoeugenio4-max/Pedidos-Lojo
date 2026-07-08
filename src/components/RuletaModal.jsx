import { useState } from "react";
import RuletaVisual from "./RuletaVisual";

export default function RuletaModal({
  premios,
  resumenPromocion,
  mensajeCliente,
  onPremioGanado,
}) {
  const [premioFinal, setPremioFinal] = useState(null);

  function manejarPremioGanado(premio) {
    setPremioFinal(premio);

    window.setTimeout(() => {
      onPremioGanado(premio);
    }, 1800);
  }

  return (
    <div style={overlay}>
      <div style={confeti}>✦ ✺ ◆ ● ✨ ★ ✦ ◆ ✺ ✨</div>

      <div style={panel}>
        <header style={cabecera}>
          <div style={decoracion}>‹‹</div>
          <h2 style={titulo}>¡GIRA Y GANA!</h2>
          <div style={decoracion}>››</div>
        </header>

        <p style={subtitulo}>
          {mensajeCliente || "Por confiar en Lojo, hoy puedes ganar un premio."}
        </p>

        <RuletaVisual
          premios={premios}
          onPremioGanado={manejarPremioGanado}
        />

        {premioFinal && (
          <div style={resultado}>
            {premioFinal.esNoPremio ? (
              <>
                <div style={resultadoIcono}>😊</div>
                <h3 style={resultadoTitulo}>¡Gracias por participar!</h3>
                <p style={resultadoTexto}>
                  Esta vez no ha habido suerte. Sigue probando en próximos
                  pedidos.
                </p>
              </>
            ) : (
              <>
                <div style={resultadoIcono}>🎁</div>
                <h3 style={resultadoTitulo}>¡ENHORABUENA!</h3>
                <p style={resultadoTexto}>Has conseguido:</p>
                <strong style={resultadoPremio}>{premioFinal.nombre}</strong>
                <p style={resultadoTexto}>
                  Tu premio se añadirá automáticamente al pedido.
                </p>
              </>
            )}
          </div>
        )}

        {resumenPromocion && (
          <div style={nota}>
            Has comprado{" "}
            <strong>{resumenPromocion.variedadValida}</strong> referencias
            válidas de{" "}
            <strong>{resumenPromocion.variedadMinima}</strong> necesarias para
            participar.
          </div>
        )}
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  zIndex: 99999,
  background:
    "radial-gradient(circle at center, rgba(30,64,175,.55), rgba(2,6,23,.96))",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "14px",
  overflow: "hidden",
};

const confeti = {
  position: "absolute",
  inset: 0,
  color: "#facc15",
  opacity: 0.35,
  fontSize: "28px",
  letterSpacing: "22px",
  lineHeight: "80px",
  transform: "rotate(-12deg)",
  pointerEvents: "none",
};

const panel = {
  position: "relative",
  width: "min(560px, 100%)",
  maxHeight: "94dvh",
  overflowY: "auto",
  background:
    "linear-gradient(180deg, rgba(15,23,42,.96), rgba(2,6,23,.98))",
  border: "1px solid rgba(255,255,255,.16)",
  borderRadius: "28px",
  padding: "22px",
  textAlign: "center",
  boxShadow: "0 35px 100px rgba(0,0,0,.6)",
};

const cabecera = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "12px",
};

const titulo = {
  margin: 0,
  fontSize: "clamp(34px, 10vw, 54px)",
  fontWeight: "1000",
  color: "#ffffff",
  textShadow: "0 5px 18px rgba(0,0,0,.55)",
  letterSpacing: "-1px",
};

const decoracion = {
  color: "#facc15",
  fontSize: "30px",
  fontWeight: "900",
};

const subtitulo = {
  margin: "6px auto 18px",
  color: "#e5e7eb",
  fontSize: "16px",
  maxWidth: "440px",
};

const resultado = {
  marginTop: "16px",
  background:
    "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.03))",
  border: "1px solid rgba(250,204,21,.35)",
  borderRadius: "22px",
  padding: "18px",
  color: "#ffffff",
  boxShadow: "0 0 30px rgba(250,204,21,.18)",
};

const resultadoIcono = {
  fontSize: "58px",
  marginBottom: "6px",
};

const resultadoTitulo = {
  margin: "0 0 8px",
  color: "#fde047",
  fontSize: "28px",
  fontWeight: "1000",
};

const resultadoTexto = {
  margin: "6px 0",
  color: "#e5e7eb",
  fontSize: "16px",
};

const resultadoPremio = {
  display: "block",
  margin: "8px 0",
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: "1000",
};

const nota = {
  marginTop: "14px",
  background: "rgba(15,23,42,.8)",
  border: "1px solid rgba(255,255,255,.14)",
  color: "#e5e7eb",
  borderRadius: "16px",
  padding: "12px",
  fontSize: "14px",
};
