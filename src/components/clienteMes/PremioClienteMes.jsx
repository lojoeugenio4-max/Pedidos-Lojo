// Aviso de premio de CLIENTE DEL MES en el móvil del cliente.
// Sale la primera vez que abre la App después del cierre del mes (como el
// aviso de premio del Sorteo): cofre que tiembla -> al tocarlo (o solo a
// los pocos segundos) se abre y sale el premio -> "Aceptar".
import { useEffect, useRef, useState } from "react";
import CofreAnimado from "./CofreAnimado";
import { nombreMes } from "../../utils/clienteMes";
import { despertarAudio, sonidoAviso, sonidoPremioMovil, sonidoTemblor } from "../../utils/sonido8bits";

const ABRIR_SOLO_MS = 7000;

export default function PremioClienteMes({ premio, onCerrar }) {
  const [abierto, setAbierto] = useState(false);
  const abiertoRef = useRef(false);
  abiertoRef.current = abierto;

  function abrir() {
    if (abierto) return;
    despertarAudio();
    sonidoPremioMovil();
    setAbierto(true);
  }

  useEffect(() => {
    sonidoAviso();
    // Traqueteo mientras espera a que lo toque.
    const temblor = window.setInterval(() => {
      if (!abiertoRef.current) sonidoTemblor(0.6);
    }, 1300);
    const solo = window.setTimeout(() => {
      if (abiertoRef.current) return;
      sonidoPremioMovil();
      setAbierto(true);
    }, ABRIR_SOLO_MS);
    return () => {
      window.clearInterval(temblor);
      window.clearTimeout(solo);
    };
  }, []);

  return (
    <div style={estilos.velo} role="dialog" aria-modal="true" aria-label="Premio de Cliente del mes">
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rubik:wght@500;700;800;900&display=swap');
@keyframes pcmEntrar{ from{transform:scale(.4);opacity:0} to{transform:scale(1);opacity:1} }
@keyframes pcmParpadeo{ 50%{opacity:.25} }
@keyframes pcmCaer{ from{transform:translateY(-10px) rotate(0)} to{transform:translateY(105vh) rotate(720deg)} }
@keyframes pcmAparecer{ from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
`}</style>
      <div style={estilos.ventana}>
        <div style={estilos.kicker}>CLIENTE DEL MES · {nombreMes(premio?.mes).toUpperCase()}</div>
        <h2 style={estilos.titulo}>¡ENHORABUENA!</h2>
        <p style={estilos.texto}>
          Has quedado <strong style={{ color: "#fff" }}>{premio?.posicion}º</strong> en la carrera con{" "}
          <strong style={{ color: "#fff" }}>{premio?.puntos} puntos</strong>.
        </p>

        <div style={estilos.cofre}>
          <CofreAnimado
            abierto={abierto}
            tiembla={!abierto}
            premio={premio?.premio || "¡Premio!"}
            puesto={premio?.posicion || 1}
            style={{ fontSize: 16 }}
            onClick={abrir}
            etiqueta="Abrir el cofre"
          />
        </div>

        {!abierto ? (
          <div style={estilos.ayuda}>TOCA EL COFRE</div>
        ) : (
          <div style={{ animation: "pcmAparecer .4s ease .9s both" }}>
            <p style={estilos.final}>Pásate por Cash Lojo para recoger tu premio. ¡Gracias por pedir con la app!</p>
            <button type="button" style={estilos.boton} onClick={onCerrar}>
              ACEPTAR
            </button>
          </div>
        )}
      </div>

      {abierto && (
        <div style={estilos.confeti} aria-hidden="true">
          {Array.from({ length: 30 }, (_, i) => (
            <i
              key={i}
              style={{
                position: "absolute",
                top: -10,
                left: `${(i * 37) % 100}%`,
                width: 8,
                height: 12,
                borderRadius: 2,
                background: ["#ffe14d", "#ff2d75", "#7cf9ff", "#76ff03", "#d500f9"][i % 5],
                animation: `pcmCaer ${(2.6 + (i % 5) * 0.35).toFixed(2)}s linear ${((i % 9) * 0.17).toFixed(2)}s infinite`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const estilos = {
  velo: {
    position: "fixed",
    inset: 0,
    zIndex: 10050,
    display: "grid",
    placeItems: "center",
    padding: 18,
    background: "rgba(9,4,24,.78)",
    backdropFilter: "blur(3px)",
    WebkitBackdropFilter: "blur(3px)",
  },
  ventana: {
    position: "relative",
    width: "min(380px, 100%)",
    borderRadius: 24,
    padding: "22px 18px 20px",
    textAlign: "center",
    color: "#fff",
    background: "radial-gradient(ellipse at 50% 0%, #3b1d7a, #1a0f45 60%, #0b0620)",
    border: "3px solid #ffe14d",
    boxShadow: "0 0 30px rgba(255,225,77,.45)",
    animation: "pcmEntrar .5s cubic-bezier(.2,1.5,.4,1) both",
    fontFamily: "'Rubik', system-ui, sans-serif",
  },
  kicker: { fontFamily: "'Press Start 2P', monospace", fontSize: 9, letterSpacing: 2, color: "#7cf9ff" },
  titulo: {
    margin: "10px 0 6px",
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 16,
    lineHeight: 1.5,
    color: "#ffe14d",
    textShadow: "2px 2px 0 #ff2d75",
  },
  texto: { margin: 0, fontSize: 15, lineHeight: 1.4, color: "#ede9fe" },
  cofre: { width: "44%", margin: "78px auto 10px", cursor: "pointer" },
  ayuda: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 9,
    color: "#7cf9ff",
    animation: "pcmParpadeo 1s steps(2) infinite",
    marginTop: 6,
  },
  final: { fontSize: 14, lineHeight: 1.45, color: "#ede9fe", margin: "6px 0 0" },
  boton: {
    marginTop: 14,
    border: 0,
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 11,
    padding: "12px 18px",
    borderRadius: 10,
    background: "#ffe14d",
    color: "#2a1600",
    cursor: "pointer",
    boxShadow: "0 4px 0 #9a6a00",
  },
  confeti: { position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" },
};
