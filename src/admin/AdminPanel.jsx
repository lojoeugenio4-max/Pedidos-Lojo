import { useEffect, useState } from "react";
import MenuAdmin from "./MenuAdmin";
import Articulos from "./Articulos";
import Departamentos from "./Departamentos";
import Ofertas from "./Ofertas";
import Pushes from "./Pushes";
import Estadisticas from "./Estadisticas";
import Configuracion from "./Configuracion";
import Promociones from "./Promociones";
import Clientes from "./Clientes";

export default function AdminPanel() {
  const [opcion, setOpcion] = useState("articulos");
  const [tamano, setTamano] = useState({
    ancho: typeof window !== "undefined" ? window.innerWidth : 1440,
    alto: typeof window !== "undefined" ? window.innerHeight : 900,
  });

  useEffect(() => {
    const actualizarTamano = () =>
      setTamano({
        ancho: window.innerWidth,
        alto: window.innerHeight,
      });

    actualizarTamano();
    window.addEventListener("resize", actualizarTamano);

    return () => window.removeEventListener("resize", actualizarTamano);
  }, []);

  const esMovil = tamano.ancho < 860;
  const esTablet = tamano.ancho >= 860 && tamano.ancho < 1280;
  const esBajo = tamano.alto < 820;

  return (
    <div id="lojo-admin-panel" style={layout(esMovil)}>
      <style>
        {`
          #lojo-admin-panel,
          #lojo-admin-panel * {
            box-sizing: border-box;
          }

          #lojo-admin-panel {
            width: 100%;
            max-width: 100vw;
            overflow: hidden;
          }

          #lojo-admin-panel input,
          #lojo-admin-panel select,
          #lojo-admin-panel textarea,
          #lojo-admin-panel button {
            max-width: 100%;
          }

          #lojo-admin-panel table {
            max-width: 100%;
            border-collapse: collapse;
          }

          #lojo-admin-panel img {
            max-width: 100%;
          }

          @media (max-width: 1280px) {
            #lojo-admin-panel h1 {
              font-size: 24px !important;
            }

            #lojo-admin-panel h2 {
              font-size: 20px !important;
            }

            #lojo-admin-panel h3 {
              font-size: 18px !important;
            }
          }

          @media (max-width: 860px) {
            #lojo-admin-panel table {
              font-size: 13px;
            }
          }
        `}
      </style>

      <MenuAdmin
        opcion={opcion}
        setOpcion={setOpcion}
        esMovil={esMovil}
        esTablet={esTablet}
        esBajo={esBajo}
      />

      <main style={content(esMovil, esTablet, esBajo)}>
        <div style={topBar(esMovil, esBajo)}>
          <div style={topBarText}>
            <h1 style={title(esMovil, esBajo)}>Panel de administración</h1>
            {!esBajo && (
              <p style={subtitle}>
                Gestión de artículos, departamentos, ofertas, promociones y configuración.
              </p>
            )}
          </div>
        </div>

        <section style={card(esMovil, esBajo)}>
          <div style={cardInner}>
            {opcion === "articulos" && <Articulos />}
            {opcion === "departamentos" && <Departamentos />}
            {opcion === "ofertas" && <Ofertas />}
            {opcion === "clientes" && <Clientes />}
            {opcion === "promociones" && <Promociones />}
            {opcion === "pushes" && <Pushes />}
            {opcion === "estadisticas" && <Estadisticas />}
            {opcion === "configuracion" && <Configuracion />}
          </div>
        </section>
      </main>
    </div>
  );
}

const layout = (esMovil) => ({
  display: "flex",
  flexDirection: esMovil ? "column" : "row",
  height: "100dvh",
  minHeight: "100dvh",
  width: "100%",
  maxWidth: "100vw",
  overflow: "hidden",
  background: "#f3f4f6",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  boxSizing: "border-box",
});

const content = (esMovil, esTablet, esBajo) => ({
  flex: 1,
  minWidth: 0,
  width: "100%",
  maxWidth: "100%",
  height: esMovil ? "calc(100dvh - 74px)" : "100dvh",
  boxSizing: "border-box",
  padding: esMovil
    ? "10px"
    : esTablet
      ? esBajo
        ? "10px 12px"
        : "14px"
      : esBajo
        ? "14px 18px"
        : "22px",
  overflow: "auto",
  overscrollBehavior: "contain",
});

const topBar = (esMovil, esBajo) => ({
  marginBottom: esMovil ? "8px" : esBajo ? "10px" : "16px",
  padding: esMovil ? "0 2px" : 0,
});

const topBarText = {
  minWidth: 0,
};

const title = (esMovil, esBajo) => ({
  margin: 0,
  fontSize: esMovil ? "20px" : esBajo ? "24px" : "28px",
  lineHeight: "1.08",
  color: "#111827",
});

const subtitle = {
  margin: "5px 0 0",
  color: "#6b7280",
  fontSize: "13px",
};

const card = (esMovil, esBajo) => ({
  background: "#ffffff",
  borderRadius: esMovil ? "14px" : "18px",
  padding: esMovil ? "8px" : esBajo ? "10px" : "14px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  overflow: "auto",
});

const cardInner = {
  width: "100%",
  minWidth: 0,
};
