export default function RuletaResumenPromocion({
  resumen,
}) {
  if (!resumen) return null;

  return (
    <div style={panel}>
      <h3 style={titulo}>
        Resumen de la promoción
      </h3>

      <div style={fila}>
        <span>Variedad mínima</span>
        <strong>{resumen.variedadMinima}</strong>
      </div>

      <div style={fila}>
        <span>Referencias válidas</span>
        <strong>{resumen.variedadValida}</strong>
      </div>

      <div style={fila}>
        <span>Referencias restantes</span>
        <strong>{resumen.variedadRestante}</strong>
      </div>

      <div style={fila}>
        <span>Unidades válidas</span>
        <strong>{resumen.totalUnidadesValidas}</strong>
      </div>

      <div
        style={{
          ...estado,
          background: resumen.cumple
            ? "#dcfce7"
            : "#fee2e2",
          color: resumen.cumple
            ? "#166534"
            : "#991b1b",
        }}
      >
        {resumen.cumple
          ? "✔ Cumple promoción"
          : "✖ No cumple promoción"}
      </div>

      {!!resumen.articulos.length && (
        <>
          <h4 style={subtitulo}>
            Artículos
          </h4>

          <div style={lista}>
            {resumen.articulos.map((articulo) => (
              <div
                key={articulo.codigo}
                style={item}
              >
                <span>
                  {articulo.codigo}
                </span>

                <span>
                  {articulo.cantidad}/
                  {articulo.cantidadMinima}
                </span>

                <span
                  style={{
                    color: articulo.cumple
                      ? "#16a34a"
                      : "#dc2626",
                    fontWeight: 700,
                  }}
                >
                  {articulo.cumple
                    ? "✔"
                    : "✖"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const panel = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  background: "#fff",
};

const titulo = {
  margin: "0 0 14px",
};

const subtitulo = {
  margin: "20px 0 10px",
};

const fila = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 8,
};

const estado = {
  marginTop: 18,
  padding: 12,
  borderRadius: 12,
  fontWeight: 700,
  textAlign: "center",
};

const lista = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const item = {
  display: "grid",
  gridTemplateColumns: "1fr auto auto",
  gap: 12,
  padding: 10,
  borderRadius: 10,
  background: "#f8fafc",
};
