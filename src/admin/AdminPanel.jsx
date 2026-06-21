import { useState } from "react";

import MenuAdmin from "./MenuAdmin";
import Articulos from "./Articulos";
import Departamentos from "./Departamentos";
import Ofertas from "./Ofertas";
import Estadisticas from "./Estadisticas";
import Configuracion from "./Configuracion";

export default function AdminPanel() {
  const [opcion, setOpcion] = useState("articulos");

  return (
    <div style={layout}>
      <MenuAdmin opcion={opcion} setOpcion={setOpcion} />

      <main style={content}>
        <div style={topBar}>
          <div>
            <h1 style={title}>Pedidos Lojo</h1>
            <p style={subtitle}>Panel de administración</p>
          </div>
        </div>

        <div style={card}>
          {opcion === "articulos" && <Articulos />}
          {opcion === "departamentos" && <Departamentos />}
          {opcion === "ofertas" && <Ofertas />}
          {opcion === "estadisticas" && <Estadisticas />}
          {opcion === "configuracion" && <Configuracion />}
        </div>
      </main>
    </div>
  );
}

const layout = {
  display: "flex",
  minHeight: "100vh",
  background: "#f3f4f6",
  fontFamily: "Arial, sans-serif",
};

const content = {
  flex: 1,
  padding: "28px",
};

const topBar = {
  marginBottom: "22px",
};

const title = {
  margin: 0,
  fontSize: "30px",
  color: "#111827",
};

const subtitle = {
  margin: "6px 0 0",
  color: "#6b7280",
};

const card = {
  background: "#ffffff",
  borderRadius: "18px",
  padding: "26px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
};
