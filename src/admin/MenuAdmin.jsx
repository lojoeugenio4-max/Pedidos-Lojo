export default function MenuAdmin({ opcion, setOpcion }) {
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
    <aside style={sidebar}>
      <div style={brandBox}>
        <div style={logoCircle}>L</div>

        <div>
          <h2 style={brandTitle}>Lojo</h2>
          <p style={brandSubtitle}>Administración</p>
        </div>
      </div>

      <div style={sectionLabel}>Menú principal</div>

      <nav style={nav}>
        {opciones.map((item) => {
          const activo = opcion === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setOpcion(item.id)}
              style={menuButton(activo)}
            >
              <span style={iconBox(activo)}>{item.icono}</span>

              <span style={textBox}>
                <span style={menuTitle(activo)}>{item.titulo}</span>
                <span style={menuDescription(activo)}>{item.descripcion}</span>
              </span>

              {activo && <span style={activeDot} />}
            </button>
          );
        })}
      </nav>

      <div style={bottomBox}>
        <div style={statusDot} />
        <div>
          <strong style={bottomTitle}>Producción activa</strong>
          <p style={bottomText}>pedidos-lojo.vercel.app</p>
        </div>
      </div>
    </aside>
  );
}

const sidebar = {
  width: "292px",
  minHeight: "100vh",
  boxSizing: "border-box",
  padding: "22px 18px",
  background:
    "linear-gradient(180deg, #0f172a 0%, #111827 48%, #1e1b4b 100%)",
  color: "#ffffff",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
  position: "sticky",
  top: 0,
  boxShadow: "18px 0 40px rgba(15,23,42,0.22)",
};

const brandBox = {
  display: "flex",
  alignItems: "center",
  gap: "13px",
  padding: "15px",
  borderRadius: "22px",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 18px 30px rgba(0,0,0,0.18)",
};

const logoCircle = {
  width: "48px",
  height: "48px",
  borderRadius: "16px",
  background: "linear-gradient(135deg, #2563eb 0%, #22c55e 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "25px",
  fontWeight: "1000",
  color: "#ffffff",
  boxShadow: "0 12px 25px rgba(37,99,235,0.34)",
};

const brandTitle = {
  margin: 0,
  fontSize: "23px",
  lineHeight: "1",
  fontWeight: "1000",
  letterSpacing: "-0.02em",
};

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

const nav = {
  display: "flex",
  flexDirection: "column",
  gap: "9px",
};

const menuButton = (activo) => ({
  width: "100%",
  border: activo
    ? "1px solid rgba(255,255,255,0.22)"
    : "1px solid rgba(255,255,255,0.07)",
  borderRadius: "18px",
  padding: "12px",
  background: activo
    ? "linear-gradient(135deg, rgba(37,99,235,0.95) 0%, rgba(34,197,94,0.82) 100%)"
    : "rgba(255,255,255,0.055)",
  color: "#ffffff",
  display: "grid",
  gridTemplateColumns: "42px 1fr auto",
  alignItems: "center",
  gap: "11px",
  textAlign: "left",
  cursor: "pointer",
  boxShadow: activo
    ? "0 14px 26px rgba(37,99,235,0.26)"
    : "0 8px 18px rgba(0,0,0,0.08)",
  transition: "transform 150ms ease, background 150ms ease, box-shadow 150ms ease",
});

const iconBox = (activo) => ({
  width: "42px",
  height: "42px",
  borderRadius: "14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: activo ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)",
  fontSize: "20px",
});

const textBox = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

const menuTitle = (activo) => ({
  fontSize: "15px",
  fontWeight: "950",
  color: "#ffffff",
  lineHeight: "1.1",
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
