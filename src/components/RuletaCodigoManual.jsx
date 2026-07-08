import { useState } from "react";

function normalizarCodigoRuleta(valor) {
  return String(valor || "")
    .trim()
    .toUpperCase()
    .replace(/[’‘`´']/g, "-")
    .replace(/\s+/g, "");
}

export default function RuletaCodigoManual({
  onValidar,
  cargando = false,
}) {
  const [codigo, setCodigo] = useState("");

  function cambiarCodigo(evento) {
    setCodigo(normalizarCodigoRuleta(evento.target.value));
  }

  function enviar(evento) {
    evento.preventDefault();

    const valor = normalizarCodigoRuleta(codigo);

    if (!valor) return;

    setCodigo(valor);
    onValidar?.(valor);
  }

  return (
    <form style={formulario} onSubmit={enviar}>
      <label style={label}>
        Código manual
      </label>

      <div style={fila}>
        <input
          value={codigo}
          onChange={cambiarCodigo}
          placeholder="Introduce el código"
          style={input}
          disabled={cargando}
        />

        <button
          type="submit"
          style={boton}
          disabled={cargando || !codigo.trim()}
        >
          {cargando ? "Validando..." : "Validar"}
        </button>
      </div>
    </form>
  );
}

const formulario = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const label = {
  fontSize: 14,
  fontWeight: 700,
  color: "#111827",
};

const fila = {
  display: "flex",
  gap: 10,
};

const input = {
  flex: 1,
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "12px",
  fontSize: 15,
};

const boton = {
  border: 0,
  borderRadius: 12,
  background: "#2563eb",
  color: "#fff",
  padding: "0 18px",
  fontWeight: 800,
  cursor: "pointer",
};
