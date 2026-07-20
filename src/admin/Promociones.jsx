import { useState } from "react";
import Ruleta from "./Ruleta";
import Bingo from "./Bingo";

export default function Promociones() {
  const [seccion, setSeccion] = useState("inicio");

  return (
    <div>
      <div style={cabecera}>
        <div>
          <h2 style={titulo}>🎁 Promociones</h2>
          <p style={texto}>
            Configura desde aquí ruleta, regalos, campañas y artículos que generan participaciones.
          </p>
        </div>

        {seccion !== "inicio" && (
          <button type="button" style={botonVolver} onClick={() => setSeccion("inicio")}>
            ← Volver
          </button>
        )}
      </div>

      {seccion === "inicio" && (
        <div style={grid}>
          <Tarjeta
            icono="🎡"
            titulo="Ruleta"
            descripcion="Configuración de premios, probabilidades y estado de la ruleta."
            textoBoton="Configurar ruleta"
            onClick={() => setSeccion("ruleta")}
          />

          <Tarjeta
            icono="🎱"
            titulo="Bingo"
            descripcion="Condiciones de participación y artículos que dan derecho al cartón personal."
            textoBoton="Configurar Bingo"
            onClick={() => setSeccion("bingo")}
          />

          <Tarjeta
            icono="🎁"
            titulo="Regalos"
            descripcion="Gestión de regalos disponibles, stock y activación."
            textoBoton="Gestionar regalos"
            onClick={() => setSeccion("regalos")}
          />

          <Tarjeta
            icono="📢"
            titulo="Campañas"
            descripcion="Creación y control de campañas promocionales por fechas."
            textoBoton="Gestionar campañas"
            onClick={() => setSeccion("campanas")}
          />

          <Tarjeta
            icono="🛒"
            titulo="Artículos que cuentan"
            descripcion="Selección de artículos que generan participaciones en promociones."
            textoBoton="Configurar artículos"
            onClick={() => setSeccion("articulos")}
          />
        </div>
      )}

      {seccion === "ruleta" && <Ruleta />}

      {seccion === "bingo" && <Bingo />}

      {seccion === "regalos" && (
        <PanelSeccion
          icono="🎁"
          titulo="Regalos"
          descripcion="Aquí gestionaremos los regalos promocionales disponibles, su stock y si están activos o no."
        />
      )}

      {seccion === "campanas" && (
        <PanelSeccion
          icono="📢"
          titulo="Campañas"
          descripcion="Aquí crearemos campañas promocionales por fechas, estado y condiciones."
        />
      )}

      {seccion === "articulos" && (
        <PanelSeccion
          icono="🛒"
          titulo="Artículos que cuentan"
          descripcion="Aquí seleccionaremos qué artículos generan participaciones para promociones."
        />
      )}
    </div>
  );
}

function Tarjeta({ icono, titulo, descripcion, textoBoton, onClick }) {
  return (
    <div style={tarjeta}>
      <div style={iconoStyle}>{icono}</div>
      <h3 style={subtitulo}>{titulo}</h3>
      <p style={descripcionStyle}>{descripcion}</p>
      <button type="button" style={boton} onClick={onClick}>
        {textoBoton}
      </button>
    </div>
  );
}

function PanelSeccion({ icono, titulo, descripcion }) {
  return (
    <div style={panel}>
      <div style={panelIcono}>{icono}</div>
      <h3 style={panelTitulo}>{titulo}</h3>
      <p style={panelTexto}>{descripcion}</p>

      <div style={aviso}>
        Módulo preparado. En el siguiente paso añadiremos la estructura de datos y formularios.
      </div>
    </div>
  );
}

const cabecera = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "24px",
};

const titulo = {
  margin: "0 0 8px",
  fontSize: "24px",
  color: "#111827",
};

const texto = {
  margin: 0,
  color: "#6b7280",
  fontSize: "15px",
  maxWidth: "720px",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "16px",
};

const tarjeta = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  padding: "18px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const iconoStyle = {
  fontSize: "30px",
  marginBottom: "10px",
};

const subtitulo = {
  margin: "0 0 8px",
  fontSize: "18px",
  color: "#111827",
};

const descripcionStyle = {
  margin: "0 0 16px",
  color: "#6b7280",
  fontSize: "14px",
  lineHeight: "1.45",
};

const boton = {
  border: "none",
  background: "#111827",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "10px 14px",
  fontSize: "14px",
  cursor: "pointer",
};

const botonVolver = {
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  borderRadius: "10px",
  padding: "9px 13px",
  fontSize: "14px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const panel = {
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "22px",
  background: "#ffffff",
};

const panelIcono = {
  fontSize: "34px",
  marginBottom: "10px",
};

const panelTitulo = {
  margin: "0 0 8px",
  fontSize: "22px",
  color: "#111827",
};

const panelTexto = {
  margin: "0 0 18px",
  color: "#6b7280",
  fontSize: "15px",
  lineHeight: "1.5",
};

const aviso = {
  background: "#f9fafb",
  border: "1px dashed #d1d5db",
  borderRadius: "12px",
  padding: "14px",
  color: "#374151",
  fontSize: "14px",
};
