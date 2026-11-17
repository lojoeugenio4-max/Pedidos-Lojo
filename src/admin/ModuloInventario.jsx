// Módulo de Inventario: al entrar se elige entre
//   📋 Inventario  (contar unidades)  y  📍 Ubicaciones (ordenar artículos).
// Lo usan el Admin (Admin > Inventario) y el enlace de los trabajadores.
import { useState } from "react";
import Inventario from "./Inventario";
import ListadosUbicacion from "./ListadosUbicacion";

const CLAVE_SECCION = "lojo-modulo-inventario";

function leerSeccion() {
  try {
    const v = sessionStorage.getItem(CLAVE_SECCION);
    return v === "inventario" || v === "ubicaciones" ? v : null;
  } catch {
    return null;
  }
}

export default function ModuloInventario({ soloTrabajador = false }) {
  const [seccion, setSeccionEstado] = useState(leerSeccion);

  const setSeccion = (valor) => {
    setSeccionEstado(valor);
    try {
      if (valor) sessionStorage.setItem(CLAVE_SECCION, valor);
      else sessionStorage.removeItem(CLAVE_SECCION);
    } catch {
      // nada
    }
  };

  if (!seccion) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 950, color: "#0f172a" }}>¿Qué vamos a hacer?</h1>
        <div style={opciones}>
          <button type="button" style={opcionGrande("#16a34a")} onClick={() => setSeccion("inventario")}>
            <span style={{ fontSize: "40px" }}>📋</span>
            <span style={{ fontSize: "22px", fontWeight: 950 }}>Inventario</span>
            <span style={textoOpcion}>Leer artículos y contar unidades</span>
          </button>
          <button type="button" style={opcionGrande("#4f46e5")} onClick={() => setSeccion("ubicaciones")}>
            <span style={{ fontSize: "40px" }}>📍</span>
            <span style={{ fontSize: "22px", fontWeight: 950 }}>Ubicaciones</span>
            <span style={textoOpcion}>Ordenar los artículos según están colocados</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={pestanas}>
        <button type="button" style={pestana(seccion === "inventario")} onClick={() => setSeccion("inventario")}>
          📋 Inventario
        </button>
        <button type="button" style={pestana(seccion === "ubicaciones")} onClick={() => setSeccion("ubicaciones")}>
          📍 Ubicaciones
        </button>
      </div>
      {seccion === "inventario" ? (
        <Inventario soloTrabajador={soloTrabajador} />
      ) : (
        <ListadosUbicacion soloTrabajador={soloTrabajador} />
      )}
    </div>
  );
}

const opciones = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" };
const opcionGrande = (color) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "6px",
  border: "none",
  borderRadius: "22px",
  padding: "28px 18px",
  background: color,
  color: "#fff",
  cursor: "pointer",
  boxShadow: "0 14px 28px rgba(15,23,42,0.18)",
});
const textoOpcion = { fontSize: "14px", fontWeight: 700, opacity: 0.9, textAlign: "center" };
const pestanas = {
  display: "flex",
  gap: "6px",
  background: "#e2e8f0",
  padding: "4px",
  borderRadius: "14px",
};
const pestana = (activa) => ({
  flex: 1,
  border: "none",
  borderRadius: "11px",
  padding: "11px",
  fontSize: "15px",
  fontWeight: 900,
  cursor: "pointer",
  background: activa ? "#fff" : "transparent",
  color: activa ? "#0f172a" : "#475569",
  boxShadow: activa ? "0 2px 6px rgba(15,23,42,0.12)" : "none",
});
