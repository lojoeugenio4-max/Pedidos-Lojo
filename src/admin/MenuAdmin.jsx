export default function MenuAdmin({
  opcion,
  setOpcion,
  esMovil = false,
  esTablet = false,
  esBajo = false,
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
      id: "promociones",
      icono: "🎁",
      titulo: "Promociones",
      descripcion: "Ruleta, regalos y campañas",
    },
    {
      id: "pushes",
      icono: "📣",
      titulo: "Push Diario",
      descripcion: "Programación de push",
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
    <aside style={sidebar(esMovil, esTablet, esBajo)}>
      <div style={brandBox(esMovil, esTablet, esBajo)}>
        <div style={logoCircle(esMovil, esTablet, esBajo)}>L</div>

        {!esTablet && !esMovil && (
          <div>
            <h2 style={brandTitle(esBajo)}>Lojo</h2>
            {!esBajo && <p style={brandSubtitle}>Administración</p>}
          </div>
        )}
      </div>

      {!esMovil && !esTablet && !esBajo && (
        <div style={sectionLabel}>Menú principal</div>
      )}

      <nav style={nav(esMovil, esTablet)}>
        {opciones.map((item) => {
          const activo = opcion === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setOpcion(item.id)}
              style={menuButton(activo, esMovil, esTablet, esBajo)}
              title={item.titulo}
            >
              <span style={iconBox(activo, esMovil, esTablet, esBajo)}>
                {item.icono}
              </span>

              {!esTablet && !esMovil && (
                <span style={textBox}>
                  <span style={menuTitle(activo, esBajo)}>{item.titulo}</span>
                  {!esBajo && (
                    <span style={menuDescription(activo)}>
                      {item.descripcion}
                    </span>
                  )}
                </span>
              )}

              {activo && !esMovil && !esTablet && !esBajo && (
                <span style={activeDot} />
              )}
            </button>
          );
        })}
      </nav>

      {!esMovil && !esTablet && !esBajo && (
        <div style={bottomBox}>
          <div style={statusDot} />
          <div>
            <strong style={bottomTitle}>Entorno de pruebas</strong>
            <p style={bottomText}>miweb-staging</p>
          </div>
        </div>
      )}
    </aside>
  );
}

const sidebar = (esMovil, esTablet, esBajo) => ({
  width: esMovil ? "100%" : esTablet ? "74px" : esBajo ? "230px" : "270px",
  minWidth: esMovil ? "100%" : esTablet ? "74px" : esBajo ? "230px" : "270px",
  height: esMovil ? "74px" : "100dvh",
  minHeight: esMovil ? "74px" : "100dvh",
  boxSizing: "border-box",
  padding: esMovil ? "8px" : esTablet ? "10px 8px" : esBajo ? "12px" : "18px 14px",
  background:
    "linear-gradient(180deg, #0f172a 0%, #111827 48%, #1e1b4b 100%)",
  color: "#ffffff",
  display: "flex",
  flexDirection: esMovil ? "row" : "column",
  alignItems: esMovil ? "center" : "stretch",
  gap: esMovil ? "8px" : esBajo ? "10px" : "14px",
  position: "sticky",
  top: 0,
  zIndex: 1000,
  boxShadow: esMovil
    ? "0 12px 28px rgba(15,23,42,0.22)"
    : "14px 0 36px rgba(15,23,42,0.2)",
  overflowX: esMovil ? "auto" : "hidden",
  overflowY: esMovil ? "hidden" : "auto",
  overscrollBehavior: "contain",
});

const brandBox = (esMovil, esTablet, esBajo) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: esTablet ? "center" : "flex-start",
  gap: "11px",
  padding: esMovil ? "7px" : esTablet ? "7px" : esBajo ? "10px" : "12px",
  borderRadius: esMovil ? "14px" : "18px",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 14px 26px rgba(0,0,0,0.16)",
  flex: esMovil ? "0 0 auto" : "initial",
});

const logoCircle = (esMovil, esTablet, esBajo) => ({
  width: esMovil || esTablet || esBajo ? "38px" : "46px",
  height: esMovil || esTablet || esBajo ? "38px" : "46px",
  borderRadius: "16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #ef4444, #f97316)",
  color: "#ffffff",
  fontWeight: "900",
  fontSize: "21px",
  boxShadow: "0 10px 22px rgba(239,68,68,0.28)",
  flexShrink: 0,
});

const brandTitle = (esBajo) => ({
  margin: 0,
  fontSize: esBajo ? "20px" : "24px",
  lineHeight: 1,
  color: "#ffffff",
});

const brandSubtitle = {
  margin: "4px 0 0",
  color: "#cbd5e1",
  fontSize: "12px",
};

const sectionLabel = {
  color: "#94a3b8",
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontWeight: "800",
  padding: "0 8px",
};

const nav = (esMovil, esTablet) => ({
  display: "flex",
  flexDirection: esMovil ? "row" : "column",
  gap: esMovil ? "8px" : "8px",
  flex: 1,
  minHeight: 0,
  overflowX: esMovil ? "auto" : "hidden",
  overflowY: esMovil ? "hidden" : "auto",
  paddingBottom: esMovil ? 0 : "4px",
});

const menuButton = (activo, esMovil, esTablet, esBajo) => ({
  width: esMovil ? "auto" : "100%",
  minWidth: esMovil ? "72px" : "0",
  border: "none",
  borderRadius: esMovil ? "13px" : "16px",
  padding: esMovil
    ? "8px 9px"
    : esTablet
      ? "9px"
      : esBajo
        ? "9px 10px"
        : "11px 12px",
  background: activo ? "rgba(255,255,255,0.14)" : "transparent",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: esTablet ? "center" : esMovil ? "center" : "flex-start",
  gap: "10px",
  textAlign: "left",
  cursor: "pointer",
  position: "relative",
  boxShadow: activo ? "0 12px 28px rgba(0,0,0,0.22)" : "none",
  transition: "background 0.15s ease, transform 0.15s ease",
  flexShrink: 0,
});

const iconBox = (activo, esMovil, esTablet, esBajo) => ({
  width: esMovil || esTablet || esBajo ? "34px" : "38px",
  height: esMovil || esTablet || esBajo ? "34px" : "38px",
  borderRadius: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: activo ? "#ffffff" : "rgba(255,255,255,0.09)",
  color: activo ? "#111827" : "#ffffff",
  fontSize: esMovil || esTablet || esBajo ? "17px" : "19px",
  flexShrink: 0,
});

const textBox = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  minWidth: 0,
};

const menuTitle = (activo, esBajo) => ({
  color: "#ffffff",
  fontSize: esBajo ? "13px" : "14px",
  fontWeight: activo ? "900" : "800",
  lineHeight: "1.15",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const menuDescription = (activo) => ({
  color: activo ? "#e5e7eb" : "#94a3b8",
  fontSize: "11px",
  lineHeight: "1.15",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const activeDot = {
  marginLeft: "auto",
  width: "8px",
  height: "8px",
  borderRadius: "999px",
  background: "#22c55e",
  boxShadow: "0 0 16px rgba(34,197,94,0.9)",
  flexShrink: 0,
};

const bottomBox = {
  marginTop: "auto",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "12px",
  borderRadius: "16px",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const statusDot = {
  width: "10px",
  height: "10px",
  borderRadius: "999px",
  background: "#22c55e",
  boxShadow: "0 0 16px rgba(34,197,94,0.9)",
  flexShrink: 0,
};

const bottomTitle = {
  display: "block",
  color: "#ffffff",
  fontSize: "12px",
};

const bottomText = {
  margin: "2px 0 0",
  color: "#94a3b8",
  fontSize: "11px",
};
