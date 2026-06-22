import { useEffect, useState } from "react";
import MenuAdmin from "./MenuAdmin";
import Articulos from "./Articulos";
import Departamentos from "./Departamentos";
import Ofertas from "./Ofertas";
import Estadisticas from "./Estadisticas";
import Configuracion from "./Configuracion";

export default function AdminPanel() {
  const [opcion, setOpcion] = useState("articulos");
  const [ancho, setAncho] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  useEffect(() => {
    const actualizarAncho = () => setAncho(window.innerWidth);

    actualizarAncho();
    window.addEventListener("resize", actualizarAncho);

    return () => window.removeEventListener("resize", actualizarAncho);
  }, []);

  const esMovil = ancho < 760;
  const esTablet = ancho >= 760 && ancho < 1100;

  return (
    <div style={layout(esMovil)}>
      <MenuAdmin
        opcion={opcion}
        setOpcion={setOpcion}
        esMovil={esMovil}
        esTablet={esTablet}
      />

      <main style={content(esMovil, esTablet)}>
        <div style={topBar(esMovil)}>
          <div>
            <h1 style={title(esMovil)}>Panel de administración</h1>
            <p style={subtitle}>
              Gestión de artículos, departamentos, ofertas y configuración.
            </p>
          </div>
        </div>

        <section style={card(esMovil)}>
          {opcion === "articulos" && <Articulos />}
          {opcion === "departamentos" && <Departamentos />}
          {opcion === "ofertas" && <Ofertas />}
          {opcion === "estadisticas" && <Estadisticas />}
          {opcion === "configuracion" && <Configuracion />}
        </section>
      </main>
    </div>
  );
}

const layout = (esMovil) => ({
  display: "flex",
  flexDirection: esMovil ? "column" : "row",
  minHeight: "100vh",
  width: "100%",
  maxWidth: "100vw",
  overflowX: "hidden",
  background: "#f3f4f6",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  boxSizing: "border-box",
});

const content = (esMovil, esTablet) => ({
  flex: 1,
  minWidth: 0,
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  padding: esMovil ? "12px" : esTablet ? "18px" : "28px",
  overflowX: "hidden",
});

const topBar = (esMovil) => ({
  marginBottom: esMovil ? "12px" : "22px",
  padding: esMovil ? "0 2px" : 0,
});

const title = (esMovil) => ({
  margin: 0,
  fontSize: esMovil ? "22px" : "30px",
  lineHeight: "1.1",
  color: "#111827",
});

const subtitle = {
  margin: "6px 0 0",
  color: "#6b7280",
  fontSize: "14px",
};

const card = (esMovil) => ({
  background: "#ffffff",
  borderRadius: esMovil ? "16px" : "22px",
  padding: esMovil ? "10px" : "18px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  overflowX: "auto",
});
