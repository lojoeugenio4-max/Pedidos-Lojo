import SorteoConfiguracion from "./SorteoConfiguracion";
import SorteoEditions from "./SorteoEditions";

export default function Sorteo() {
  return (
    <div>
      <h3 style={titulo}>🎟️ Sorteo promocional</h3>
      <p style={texto}>
        Por cada N artículos distintos (configurable) el cliente recibe un número del 00 al 99 en la cuadrícula activa. Al llenarse las 100 casillas se abre otra automáticamente.
      </p>
      <div style={aviso}>
        En construcción: de momento el Sorteo solo se activa para el cliente marcado como "de pruebas" (es_pruebas), para poder probarlo en real sin que el resto de clientes vea nada nuevo.
      </div>
      <SorteoConfiguracion />
      <SorteoEditions />
    </div>
  );
}

const titulo = { margin: "0 0 8px", fontSize: "22px", color: "#111827" };
const texto = { margin: "0 0 12px", color: "#6b7280", fontSize: "15px" };
const aviso = { margin: "0 0 16px", padding: "11px 13px", borderRadius: "11px", background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: "13px", fontWeight: "700" };
