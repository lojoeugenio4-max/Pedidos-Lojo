export default function MenuAdmin({ opcion, setOpcion }) {
  return (
    <div
      style={{
        width: "220px",
        background: "#f5f5f5",
        padding: "20px",
        minHeight: "100vh",
        borderRight: "1px solid #ddd",
      }}
    >
      <h2>Administración</h2>

      <button onClick={() => setOpcion("articulos")}>📦 Artículos</button>
      <br /><br />

      <button onClick={() => setOpcion("departamentos")}>📂 Departamentos</button>
      <br /><br />

      <button onClick={() => setOpcion("ofertas")}>🏷️ Ofertas</button>
      <br /><br />

      <button onClick={() => setOpcion("estadisticas")}>📊 Estadísticas</button>
      <br /><br />

      <button onClick={() => setOpcion("configuracion")}>⚙️ Configuración</button>

    </div>
  );
}
