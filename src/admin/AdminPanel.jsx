import { useEffect, useState } from "react";
import MenuAdmin from "./MenuAdmin";
import Articulos from "./Articulos";
import Departamentos from "./Departamentos";
import Ubicaciones from "./Ubicaciones";
import BusquedaFoto from "./BusquedaFoto";
import Ofertas from "./Ofertas";
import Pushes from "./Pushes";
import Estadisticas from "./Estadisticas";
import Regalos from "./Regalos";
import Configuracion from "./Configuracion";
import Promociones from "./Promociones";
import Clientes from "./Clientes";
import PedidosExportar from "./PedidosExportar";
import ClienteMes from "./ClienteMes";
import Inventario from "./Inventario";
import AccesoAdmin, { CambiarClaveAdmin, borrarAcceso, leerAcceso } from "./AccesoAdmin";

// Opciones de menú válidas como destino directo por URL, p.ej.
// "?admin&seccion=pedidos" para abrir el Admin ya en Pedidos recibidos.
const OPCIONES_VALIDAS = [
  "clientes",
  "articulos",
  "departamentos",
  "ubicaciones",
  "ofertas",
  "promociones",
  "pushes",
  "estadisticas",
  "premios-bingo",
  "pedidos",
  "inventario",
  "configuracion",
];

function leerParametrosURL() {
  if (typeof window === "undefined") return { seccionInicial: null, modoAlmacen: false };
  const parametros = new URLSearchParams(window.location.search);
  const seccion = parametros.get("seccion");
  return {
    seccionInicial: OPCIONES_VALIDAS.includes(seccion) ? seccion : null,
    // "?admin&seccion=pedidos&modo=almacen": acceso directo del almacén,
    // pensado para un acceso directo de Windows en otro ordenador — abre
    // solo la pantalla de Pedidos recibidos, sin el menú completo del Admin.
    modoAlmacen: parametros.get("modo") === "almacen",
    // "?admin&modo=inventario": enlace para el móvil de los trabajadores.
    // Pide la contraseña de trabajadores ("coke") y abre solo el Inventario.
    modoInventario: parametros.get("modo") === "inventario",
  };
}

// Puerta de entrada del Admin: pide contraseña.
//   "coke" -> solo Inventario (trabajadores) · contraseña del dueño -> todo.
export default function AdminPanel() {
  const [{ modoAlmacen, modoInventario }] = useState(leerParametrosURL);
  const [acceso, setAcceso] = useState(leerAcceso);

  const salir = () => {
    borrarAcceso();
    setAcceso(null);
  };

  // El acceso directo del almacén (Pedidos recibidos) NO pide contraseña.
  if (modoAlmacen) return <PanelCompleto onSalir={salir} />;

  // Enlace de los trabajadores: solo contraseña "coke" y solo Inventario.
  if (modoInventario) {
    if (!acceso) return <AccesoAdmin soloInventario onEntrar={setAcceso} />;
    return <PanelInventario onSalir={salir} />;
  }

  if (!acceso) return <AccesoAdmin onEntrar={setAcceso} />;
  if (acceso === "inventario") return <PanelInventario onSalir={salir} />;
  return <PanelCompleto onSalir={salir} />;
}

// Lo que ven los trabajadores: solo el Inventario.
function PanelInventario({ onSalir }) {
  return (
    <div id="lojo-admin-panel" style={layoutAlmacen}>
      <div style={{ ...topBarAlmacen, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={logoAlmacen}>L</div>
          <div>
            <h1 style={tituloAlmacen}>Inventario</h1>
            <p style={subtituloAlmacen}>Cash Lojo · Trabajadores</p>
          </div>
        </div>
        <button type="button" style={botonSalir} onClick={onSalir}>
          🔒 Salir
        </button>
      </div>
      <main style={contenidoAlmacen}>
        <Inventario soloTrabajador />
      </main>
    </div>
  );
}

function PanelCompleto({ onSalir }) {
  const [{ seccionInicial, modoAlmacen }] = useState(leerParametrosURL);
  const [cambiandoClave, setCambiandoClave] = useState(false);
  // Al entrar en el Admin se abre siempre en "Pedidos recibidos" (salvo que
  // la URL pida otra sección con "?admin&seccion=...").
  const [opcion, setOpcion] = useState(seccionInicial || "pedidos");
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

  if (modoAlmacen) {
    return (
      <div id="lojo-admin-panel" style={layoutAlmacen}>
        <div style={topBarAlmacen}>
          <div style={logoAlmacen}>L</div>
          <div>
            <h1 style={tituloAlmacen}>Pedidos recibidos — Almacén</h1>
            <p style={subtituloAlmacen}>Lojo</p>
          </div>
        </div>
        <main style={contenidoAlmacen}>
          <PedidosExportar />
        </main>
      </div>
    );
  }

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
          <div style={botonesSesion}>
            <button type="button" style={botonSesion} onClick={() => setCambiandoClave(true)}>
              🔑 Contraseña
            </button>
            <button type="button" style={botonSesion} onClick={onSalir}>
              🔒 Salir
            </button>
          </div>
        </div>
        {cambiandoClave && <CambiarClaveAdmin onCerrar={() => setCambiandoClave(false)} />}

        {/* En Artículos la tarjeta no recorta (overflow visible) para que el
            buscador pueda quedarse fijo arriba al hacer scroll. */}
        <section
          style={
            opcion === "articulos" ? { ...card(esMovil, esBajo), overflow: "visible" } : card(esMovil, esBajo)
          }
        >
          <div style={cardInner}>
            {opcion === "articulos" && <Articulos />}
            {opcion === "departamentos" && <Departamentos />}
            {opcion === "ubicaciones" && <Ubicaciones />}
            {opcion === "busqueda-foto" && <BusquedaFoto />}
            {opcion === "ofertas" && <Ofertas />}
            {opcion === "clientes" && <Clientes />}
            {opcion === "promociones" && <Promociones />}
            {opcion === "pushes" && <Pushes />}
            {opcion === "estadisticas" && <Estadisticas />}
            {opcion === "premios-bingo" && <Regalos />}
            {opcion === "cliente-mes" && <ClienteMes />}
            {opcion === "pedidos" && <PedidosExportar />}
            {opcion === "inventario" && <Inventario />}
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

// Estilos del modo almacén: pantalla mínima sin menú lateral, pensada para
// el acceso directo que abren los operarios en otro ordenador.
const botonesSesion = { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" };

const botonSesion = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  borderRadius: "12px",
  padding: "9px 14px",
  fontSize: "14px",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const botonSalir = {
  border: "1px solid rgba(255,255,255,0.35)",
  background: "transparent",
  color: "#fff",
  borderRadius: "12px",
  padding: "9px 14px",
  fontSize: "14px",
  fontWeight: 800,
  cursor: "pointer",
};

const layoutAlmacen = {
  minHeight: "100dvh",
  width: "100%",
  background: "#f3f4f6",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  boxSizing: "border-box",
};

const topBarAlmacen = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "16px 22px",
  background: "linear-gradient(180deg, #0f172a 0%, #111827 48%, #1e1b4b 100%)",
  color: "#ffffff",
};

const logoAlmacen = {
  width: "40px",
  height: "40px",
  borderRadius: "14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #ef4444, #f97316)",
  color: "#ffffff",
  fontWeight: 900,
  fontSize: "18px",
  flexShrink: 0,
};

const tituloAlmacen = { margin: 0, fontSize: "18px", color: "#ffffff" };

const subtituloAlmacen = { margin: "2px 0 0", color: "#cbd5e1", fontSize: "12px" };

const contenidoAlmacen = { padding: "18px", maxWidth: "1400px", margin: "0 auto" };

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
