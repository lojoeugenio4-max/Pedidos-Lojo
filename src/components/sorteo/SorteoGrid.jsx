// Cuadrícula de 100 casillas (00-99) del Sorteo. Se usa tanto en la
// pantalla grande (TV) como en el panel de Admin. `casillas` es el
// array devuelto por obtener_cuadricula_sorteo: [{numero, cliente_nombre}].
// `numerosDestacados` resalta en dorado los números recién asignados
// (p. ej. justo después de escanear un QR en el TPV).
export default function SorteoGrid({
  titulo,
  casillas = [],
  numeroPremiado = null,
  numerosDestacados = [],
  compacto = false,
  alturaGrid = "62vh",
}) {
  const ocupadas = new Map(casillas.map((c) => [c.numero, c]));
  const destacados = new Set(numerosDestacados);

  return (
    <div style={estilos.contenedor}>
      {titulo && <h3 style={estilos.titulo}>{titulo}</h3>}
      <div
        style={{
          ...estilos.grid,
          gap: compacto ? 4 : 8,
          // Altura fija en vez de aspect-ratio: en una TV ancha, si cada
          // celda fuera cuadrada (alto = ancho de columna), las 10 filas
          // no cabían en la pantalla y se cortaban a mitad. Con alto y
          // ancho de celda independientes (filas y columnas por
          // separado), las 10 filas caben siempre, sea cual sea el ancho.
          height: compacto ? undefined : alturaGrid,
          maxHeight: compacto ? undefined : alturaGrid,
          gridTemplateRows: compacto ? undefined : "repeat(10, 1fr)",
        }}
      >
        {Array.from({ length: 100 }, (_, numero) => {
          const casilla = ocupadas.get(numero);
          const esPremiado = numeroPremiado !== null && numero === numeroPremiado;
          const esDestacado = destacados.has(numero);

          return (
            <div
              key={numero}
              style={{
                ...estilos.celda,
                ...(compacto ? estilos.celdaCompacta : estilos.celdaAmplia),
                ...(casilla ? estilos.celdaOcupada : estilos.celdaLibre),
                ...(esDestacado ? estilos.celdaDestacada : null),
                ...(esPremiado ? estilos.celdaPremiada : null),
              }}
              title={casilla?.cliente_nombre || ""}
            >
              <span style={estilos.numero}>{String(numero).padStart(2, "0")}</span>
              {casilla?.cliente_nombre && (
                <span style={estilos.nombre}>{casilla.cliente_nombre}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const estilos = {
  contenedor: { width: "100%" },
  titulo: { margin: "0 0 10px", color: "#fff", fontSize: 20, fontWeight: 900, textAlign: "center" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(10, 1fr)",
  },
  celda: {
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    padding: 2,
    textAlign: "center",
    overflow: "hidden",
  },
  celdaAmplia: { aspectRatio: "unset" },
  celdaCompacta: { aspectRatio: "1 / 1", borderRadius: 5 },
  numero: { fontSize: "clamp(11px, 1.6vw, 20px)", fontWeight: 900, lineHeight: 1 },
  nombre: {
    fontSize: "clamp(7px, 0.85vw, 11px)",
    fontWeight: 700,
    lineHeight: 1.1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  },
  celdaLibre: { background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.35)" },
  // Rojo corporativo Cash Lojo (mismo tono que el logo y la cabecera de la app)
  celdaOcupada: { background: "linear-gradient(135deg, #ff1e1e, #a30f0f)", color: "#fff" },
  celdaDestacada: {
    background: "#fbbf24",
    color: "#111827",
    boxShadow: "0 0 0 3px #fff, 0 0 24px 4px #fbbf24",
    transform: "scale(1.08)",
  },
  celdaPremiada: {
    background: "#16a34a",
    color: "#fff",
    boxShadow: "0 0 0 3px #fff, 0 0 30px 6px #22c55e",
  },
};

