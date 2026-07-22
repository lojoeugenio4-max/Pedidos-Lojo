import BingoConfiguracion from "./BingoConfiguracion";
import BingoArticulos from "./BingoArticulos";
import BingoPruebas from "./BingoPruebas";

export default function Bingo() {
  return (
    <div>
      <h3 style={titulo}>🎱 Bingo promocional</h3>
      <p style={texto}>
        Configura las condiciones que debe cumplir un pedido y los artículos válidos para que un cliente identificado consiga su cartón personal.
      </p>
      <div style={aviso}>
        Guardar o activar el Bingo no crea cartones automáticamente. El cartón se entrega únicamente tras validar un pedido que cumpla las condiciones.
      </div>
      <BingoConfiguracion />
      <BingoPruebas />
      <BingoArticulos />
    </div>
  );
}

const titulo = { margin: "0 0 8px", fontSize: "22px", color: "#111827" };
const texto = { margin: "0 0 12px", color: "#6b7280", fontSize: "15px" };
const aviso = { margin: "0 0 16px", padding: "11px 13px", borderRadius: "11px", background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: "13px", fontWeight: "700" };
