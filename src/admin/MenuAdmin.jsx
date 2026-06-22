export default function MenuAdmin({
  opcion,
  setOpcion,
  esMovil = false,
  esTablet = false,
}) {
  const opciones = [
    {
      id: "articulos",
      icono: "📦",
      titulo: "Artículos",
      descripcion: "Catálogo, fotos y precios",
    },
    {
      id: "departamentos",
      icono: "🗂️",
      titulo: "Departamentos",
      descripcion: "Organización del catálogo",
    },
    {
      id: "ofertas",
      icono: "🏷️",
      titulo: "Ofertas",
      descripcion: "Promociones y avisos",
    },
    {
      id: "estadisticas",
      icono: "📊",
      titulo: "Estadísticas",
      descripcion: "Resumen y actividad",
    },
    {
      id: "configuracion",
      icono: "⚙️",
      titulo: "Configuración",
      descripcion: "Ajustes generales",
    },
  ];

  return (
    <aside style={sidebar(esMovil, esTablet)}>
      <div style={brandBox(esMovil, esTablet)}>
        <div style={logoCircle(esMovil, esTablet)}>L</div>

        {!esTablet && (
          <div>
            <h2 style={brandTitle(esMovil)}>Lojo</h2>
            <p style={brandSubtitle}>Administración</p>
          </div>
        )}
      </div>

      {!esMovil && !esTablet && <div style={sectionLabel}>Menú principal</div>}

      <nav style={nav(esMovil, esTablet)}>
        {opciones.map((item) => {
          const activo = opcion === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setOpcion(item.id)}
              style={menuButton(activo, esMovil, esTablet)}
              title={item.titulo}
            >
              <span style={iconBox(activo, esMovil, esTablet)}>{item.icono}</span>

              {!esTablet && (
                <span style={textBox}>
                  <span style={menuTitle(activo, esMovil)}>{item.titulo}</span>
                  {!esMovil && (
                    <span style={menuDescription(activo)}>
                      {item.descripcion}
                    </span>
                  )}
                </span>
              )}

              {activo && !esMovil && !esTablet && <span style={activeDot} />}
            </button>
          );
        })}
      </nav>

      {!esMovil && !esTablet && (
        <div style={bottomBox}>
          <div style={statusDot} />
          <div>
            <strong style={bottomTitle}>Producción activa</strong>
            <p style={bottomText}>pedidos-lojo.vercel.app</p>
          </div>
        </div>
      )}
    </aside>
  );
}

const sidebar = (esMovil, esTablet) => ({
  width: esMovil ? "100%" : esTablet ? "82px" : "292px",
  minWidth: esMovil ? "100%" : esTablet ? "82px" : "292px",
  minHeight: esMovil ? "auto" : "100vh",
  boxSizing: "border-box",
  padding: esMovil ? "10px" : esTablet ? "14px 10px" : "22px 18px",
  background:
    "linear-gradient(180deg, #0f172a 0%, #111827 48%, #1e1b4b 100%)",
  color: "#ffffff",
  display: "flex",
  flexDirection: esMovil ? "row" : "column",
  alignItems: esMovil ? "center" : "stretch",
  gap: esMovil ? "10px" : "18px",
  position: "sticky",
  top: 0,
  zIndex: 1000,
  boxShadow: esMovil
    ? "0 12px 28px rgba(15,23,42,0.22)"
    : "18px 0 40px rgba(15,23,42,0.22)",
  overflowX: esMovil ? "auto" : "hidden",
});

const brandBox = (esMovil, esTablet) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: esTablet ? "center" : "flex-start",
  gap: "13px",
  padding: esMovil ? "8px" : esTablet ? "8px" : "15px",
  borderRadius: esMovil ? "16px" : "22px",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 18px 30px rgba(0,0,0,0.18)",
  flex: esMovil ? "0 0 auto" : "initial",
});

const logoCircle = (esMovil, esTablet) => ({
  width: esMovil || esTablet ? "40px" : "48px",
  height: esMovil || esTablet ? "40px" : "48px",
  borderRadius: "16px",
  background: "linear-gradient(135deg, #2563eb 0%, #22c55e 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: esMovil || esTablet ? "21px" : "25px",
  fontWeight: "1000",
  color: "#ffffff",
  boxShadow: "0 12px 25px rgba(37,99,235,0.34)",
  flex: "0 0 auto",
});

const brandTitle = (esMovil) => ({
  margin: 0,
  fontSize: esMovil ? "18px" : "23px",
  lineHeight: "1",
  fontWeight: "1000",
  letterSpacing: "-0.02em",
});

const brandSubtitle = {
  margin: "5px 0 0",
  fontSize: "12px",
  fontWeight: "800",
  color: "#c7d2fe",
};

const sectionLabel = {
  marginTop: "6px",
  padding: "0 10px",
  fontSize: "11px",
  fontWeight: "950",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#94a3b8",
};

const nav = (esMovil, esTablet) => ({
  display: "flex",
  flexDirection: esMovil ? "row" : "column",
  gap: esMovil ? "8px" : "9px",
  width: esMovil ? "auto" : "100%",
  overflowX: esMovil ? "auto" : "visible",
  paddingBottom: esMovil ? "2px" : 0,
});

const menuButton = (activo, esMovil, esTablet) => ({
  width: esMovil ? "auto" : "100%",
  minWidth: esMovil ? "78px" : "auto",
  border: activo
    ? "1px solid rgba(255,255,255,0.22)"
    : "1px solid rgba(255,255,255,0.07)",
  borderRadius: esMovil ? "16px" : "18px",
  padding: esMovil ? "9px 10px" : esTablet ? "10px" : "12px",
  background: activo
    ? "linear-gradient(135deg, rgba(37,99,235,0.95) 0%, rgba(34,197,94,0.82) 100%)"
    : "rgba(255,255,255,0.055)",
  color: "#ffffff",
  display: "grid",
  gridTemplateColumns: esTablet ? "1fr" : esMovil ? "1fr" : "42px 1fr auto",
  alignItems: "center",
  justifyItems: esTablet || esMovil ? "center" : "stretch",
  gap: esMovil ? "5px" : "11px",
  textAlign: esMovil || esTablet ? "center" : "left",
  cursor: "pointer",
  boxShadow: activo
    ? "0 14px 26px rgba(37,99,235,0.26)"
    : "0 8px 18px rgba(0,0,0,0.08)",
  transition: "transform 150ms ease, background 150ms ease, box-shadow 150ms ease",
  flex: esMovil ? "0 0 auto" : "initial",
});

const iconBox = (activo, esMovil, esTablet) => ({
  width: esMovil || esTablet ? "34px" : "42px",
  height: esMovil || esTablet ? "34px" : "42px",
  borderRadius: "14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: activo ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)",
  fontSize: esMovil || esTablet ? "18px" : "20px",
});

const textBox = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

const menuTitle = (activo, esMovil) => ({
  fontSize: esMovil ? "11px" : "15px",
  fontWeight: "950",
  color: "#ffffff",
  lineHeight: "1.1",
  whiteSpace: "nowrap",
});

const menuDescription = (activo) => ({
  marginTop: "4px",
  fontSize: "11px",
  fontWeight: "750",
  color: activo ? "#eef2ff" : "#94a3b8",
  lineHeight: "1.15",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const activeDot = {
  width: "9px",
  height: "9px",
  borderRadius: "999px",
  background: "#ffffff",
  boxShadow: "0 0 0 5px rgba(255,255,255,0.18)",
};

const bottomBox = {
  marginTop: "auto",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "14px",
  borderRadius: "18px",
  background: "rgba(34,197,94,0.12)",
  border: "1px solid rgba(34,197,94,0.28)",
};

const statusDot = {
  width: "11px",
  height: "11px",
  borderRadius: "999px",
  background: "#22c55e",
  boxShadow: "0 0 0 5px rgba(34,197,94,0.16)",
  flex: "0 0 auto",
};

const bottomTitle = {
  display: "block",
  color: "#dcfce7",
  fontSize: "13px",
  lineHeight: "1.1",
};

const bottomText = {
  margin: "4px 0 0",
  color: "#86efac",
  fontSize: "11px",
  fontWeight: "750",
};
