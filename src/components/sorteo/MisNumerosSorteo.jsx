// "Mi Sorteo" en el móvil del cliente: sus números ordenados POR CUADRÍCULA.
//
// Una tarjeta por cuadrícula (las que siguen en juego arriba, las ya
// sorteadas debajo), con:
//   - el estado y, si está programado, cuándo es el sorteo,
//   - sus números en grande,
//   - una mini-cuadrícula 00-99 con SUS casillas marcadas, para ver de un
//     vistazo dónde están.
// Recibe la lista tal cual la devuelve obtener_numeros_sorteo_cliente:
// [{ edition_nombre, estado, numero, numero_premiado, ganador }].
import { formatearFechaSorteo } from "../../utils/sorteoDirecto";

const dos = (n) => String(n).padStart(2, "0");

// "Sorteo 3" -> 3 (para casar con la fecha programada de esa cuadrícula).
function numeroDeEdicion(nombre) {
  const m = String(nombre || "").match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

function agruparPorCuadricula(numeros) {
  const mapa = new Map();
  numeros.forEach((n) => {
    const clave = n.edition_nombre || "Sorteo";
    if (!mapa.has(clave)) {
      mapa.set(clave, {
        nombre: clave,
        orden: numeroDeEdicion(clave) ?? 0,
        resuelta: n.estado === "resuelta",
        numeroPremiado: n.numero_premiado ?? null,
        numeros: [],
        ganador: false,
      });
    }
    const grupo = mapa.get(clave);
    grupo.numeros.push(Number(n.numero));
    if (n.ganador) grupo.ganador = true;
  });
  const grupos = [...mapa.values()];
  grupos.forEach((g) => g.numeros.sort((a, b) => a - b));
  // Primero las que siguen en juego; dentro de cada bloque, la más nueva arriba.
  return grupos.sort((a, b) => Number(a.resuelta) - Number(b.resuelta) || b.orden - a.orden);
}

function MiniCuadricula({ mios, premiado }) {
  const misNumeros = new Set(mios);
  return (
    <div style={estilos.mini} aria-label="Tus casillas en la cuadrícula">
      {Array.from({ length: 100 }, (_, n) => {
        const esMio = misNumeros.has(n);
        const esPremiado = premiado != null && n === premiado;
        return (
          <div
            key={n}
            style={{
              ...estilos.celda,
              ...(esMio ? estilos.celdaMia : null),
              ...(esPremiado ? (esMio ? estilos.celdaGanadora : estilos.celdaPremiada) : null),
            }}
          >
            {dos(n)}
          </div>
        );
      })}
    </div>
  );
}

export default function MisNumerosSorteo({ numeros = [], proximas = [], fechasSorteo = {} }) {
  const grupos = agruparPorCuadricula(numeros);
  const total = numeros.length;
  const fechaPorEdicion = new Map(proximas.map((p) => [p.numero, p.programadoAt]));

  return (
    <div style={estilos.contenedor}>
      <p style={estilos.resumen}>
        Tienes <strong>{total}</strong> {total === 1 ? "número" : "números"} en{" "}
        <strong>{grupos.length}</strong> {grupos.length === 1 ? "cuadrícula" : "cuadrículas"}.
      </p>

      {grupos.map((g) => {
        const fecha = fechaPorEdicion.get(g.orden);
        // Cuándo se sorteó (solo las cuadrículas sorteadas con el sorteo en directo).
        const sorteadaEn = g.resuelta ? fechasSorteo[g.orden] : null;
        return (
          <section key={g.nombre} style={{ ...estilos.tarjeta, ...(g.resuelta ? estilos.tarjetaResuelta : null), ...(g.ganador ? estilos.tarjetaGanadora : null) }}>
            <header style={estilos.cabecera}>
              <strong style={estilos.nombre}>{g.nombre}</strong>
              <span style={{ ...estilos.estado, ...(g.resuelta ? estilos.estadoResuelta : estilos.estadoJuego) }}>
                {g.resuelta ? "Sorteado" : "En juego"}
              </span>
            </header>

            {sorteadaEn && <div style={estilos.detalle}>🏁 Sorteada el {formatearFechaSorteo(sorteadaEn)}</div>}

            {g.ganador ? (
              <div style={estilos.ganadorAviso}>🏆 ¡Enhorabuena, uno de tus números ha sido el premiado!</div>
            ) : g.resuelta ? (
              <div style={estilos.detalle}>
                Número premiado: <strong>{g.numeroPremiado != null ? dos(g.numeroPremiado) : "—"}</strong>. Esta vez no ha tocado.
              </div>
            ) : fecha ? (
              <div style={estilos.detalle}>📅 Sorteo el {formatearFechaSorteo(fecha)}</div>
            ) : (
              <div style={estilos.detalle}>Todavía sin fecha de sorteo. Te avisaremos aquí cuando se programe.</div>
            )}

            <div style={estilos.etiqueta}>
              {g.numeros.length === 1 ? "Tu número" : `Tus ${g.numeros.length} números`}
            </div>
            <div style={estilos.chips}>
              {g.numeros.map((n) => (
                <span
                  key={n}
                  style={{ ...estilos.chip, ...(g.resuelta && n === g.numeroPremiado ? estilos.chipGanador : null) }}
                >
                  {dos(n)}
                </span>
              ))}
            </div>

            <MiniCuadricula mios={g.numeros} premiado={g.resuelta ? g.numeroPremiado : null} />
          </section>
        );
      })}
    </div>
  );
}

const estilos = {
  contenedor: { display: "grid", gap: 14 },
  resumen: { margin: 0, fontSize: 15, color: "#374151" },
  tarjeta: {
    display: "grid",
    gap: 10,
    padding: "14px 14px 16px",
    borderRadius: 16,
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
  },
  tarjetaResuelta: { background: "#f9fafb", border: "1px solid #e5e7eb" },
  tarjetaGanadora: { background: "#dcfce7", border: "2px solid #16a34a" },
  cabecera: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  nombre: { fontSize: 18, color: "#111827" },
  estado: { padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800 },
  estadoJuego: { background: "#16a34a", color: "#fff" },
  estadoResuelta: { background: "#e5e7eb", color: "#4b5563" },
  detalle: { fontSize: 14, color: "#166534", fontWeight: 600 },
  ganadorAviso: { fontSize: 15, color: "#166534", fontWeight: 900 },
  etiqueta: { fontSize: 12, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" },
  chips: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: {
    minWidth: 54,
    textAlign: "center",
    padding: "8px 12px",
    borderRadius: 12,
    background: "linear-gradient(135deg, #ff1e1e, #a30f0f)",
    color: "#fff",
    fontSize: 24,
    fontWeight: 900,
    fontVariantNumeric: "tabular-nums",
  },
  chipGanador: { background: "#16a34a", boxShadow: "0 0 0 3px #fff, 0 0 14px 3px #22c55e" },
  mini: {
    display: "grid",
    gridTemplateColumns: "repeat(10, 1fr)",
    gap: 3,
    padding: 8,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
  },
  celda: {
    aspectRatio: "1 / 1",
    display: "grid",
    placeItems: "center",
    borderRadius: 5,
    fontSize: 10,
    fontWeight: 700,
    color: "#9ca3af",
    background: "#f3f4f6",
    fontVariantNumeric: "tabular-nums",
  },
  celdaMia: { background: "#ff1e1e", color: "#fff", fontWeight: 900 },
  celdaPremiada: { background: "#fde047", color: "#713f12", fontWeight: 900 },
  celdaGanadora: { background: "#16a34a", color: "#fff", fontWeight: 900, boxShadow: "0 0 0 2px #bbf7d0" },
};
