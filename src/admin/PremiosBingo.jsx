import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

// Reutiliza la función admin_listar_premios_bingo (ver migración
// migracion_admin_listar_premios_bingo.sql), que a su vez usa la misma
// obtener_estado_carton_bingo(...) que ya usa el TPV en
// comprobarPremiosBingo — así que un cliente sale aquí en el mismo
// momento en que se le celebra el premio en tienda, ni antes ni después.

function normalizarBusqueda(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatearFechaHora(valor) {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("es-ES");
}

function Badge({ children, tono = "gris" }) {
  return <span style={badgeStyle(tono)}>{children}</span>;
}

export default function PremiosBingo() {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const montado = useRef(true);

  async function cargar() {
    setCargando(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_listar_premios_bingo");
      if (rpcError) throw rpcError;
      if (montado.current) setFilas(data || []);
    } catch (err) {
      if (montado.current) {
        setError(
          err?.message ||
            "No se pudieron cargar los premios de Bingo. Comprueba que la función admin_listar_premios_bingo está creada en Supabase."
        );
      }
    } finally {
      if (montado.current) setCargando(false);
    }
  }

  useEffect(() => {
    montado.current = true;
    cargar();
    return () => {
      montado.current = false;
    };
  }, []);

  const filasFiltradas = useMemo(() => {
    const query = normalizarBusqueda(busqueda);
    if (!query) return filas;
    return filas.filter((fila) => {
      const nombre = normalizarBusqueda(fila.customer_name);
      const token = normalizarBusqueda(fila.customer_token);
      return nombre.includes(query) || token.includes(query);
    });
  }, [filas, busqueda]);

  return (
    <div style={contenedor}>
      <div style={cabecera}>
        <div>
          <h2 style={titulo}>🎉 Premios de Bingo</h2>
          <p style={subtitulo}>
            Clientes que han conseguido línea o bingo (normal o especial). Cada cartón cuenta por separado: si un cliente completa su cartón y sigue con el siguiente, sale una fila por cartón.
          </p>
        </div>
        <div style={acciones}>
          <input
            type="text"
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            style={inputBusqueda}
          />
          <button type="button" onClick={cargar} disabled={cargando} style={botonRefrescar}>
            {cargando ? "Actualizando…" : "🔄 Actualizar"}
          </button>
        </div>
      </div>

      {error && <div style={cajaError}>{error}</div>}

      {!error && !cargando && filasFiltradas.length === 0 && (
        <div style={cajaVacia}>Todavía no hay ningún cliente con línea o bingo conseguidos.</div>
      )}

      {filasFiltradas.length > 0 && (
        <div style={tablaContenedor}>
          <table style={tabla}>
            <thead>
              <tr>
                <th style={th}>Cliente</th>
                <th style={th}>Premios conseguidos</th>
                <th style={th}>Bolas cantadas</th>
                <th style={th}>Última bola</th>
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.map((fila) => (
                <tr key={fila.carton_id || fila.customer_token}>
                  <td style={td}>
                    <strong>{fila.customer_name || "Cliente sin nombre"}</strong>
                    <div style={tokenPequeno}>
                      {fila.customer_token}
                      {fila.ronda ? ` · Cartón nº ${fila.ronda}` : ""}
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {fila.tiene_bingo_especial && <Badge tono="dorado">★ BINGO ESPECIAL</Badge>}
                      {fila.tiene_bingo && !fila.tiene_bingo_especial && <Badge tono="rojo">BINGO</Badge>}
                      {fila.tiene_linea_especial && <Badge tono="dorado">★ LÍNEA ESPECIAL</Badge>}
                      {fila.tiene_linea && !fila.tiene_linea_especial && <Badge tono="azul">LÍNEA</Badge>}
                    </div>
                  </td>
                  <td style={td}>{fila.bolas_cantadas ?? "—"}</td>
                  <td style={td}>{formatearFechaHora(fila.ultima_bola_en)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const contenedor = { display: "flex", flexDirection: "column", gap: 16 };
const cabecera = {
  display: "flex",
  flexWrap: "wrap",
  gap: 16,
  alignItems: "center",
  justifyContent: "space-between",
};
const titulo = { margin: 0, fontSize: 22 };
const subtitulo = { margin: "4px 0 0", color: "#64748b", fontSize: 14 };
const acciones = { display: "flex", gap: 10, flexWrap: "wrap" };
const inputBusqueda = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 14,
  minWidth: 220,
};
const botonRefrescar = {
  border: "none",
  borderRadius: 10,
  background: "#0f172a",
  color: "#fff",
  padding: "10px 16px",
  fontWeight: 700,
  cursor: "pointer",
};
const cajaError = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  borderRadius: 12,
  padding: "12px 16px",
};
const cajaVacia = {
  border: "1px dashed #cbd5e1",
  borderRadius: 12,
  padding: "24px 16px",
  textAlign: "center",
  color: "#64748b",
};
const tablaContenedor = { overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 14 };
const tabla = { width: "100%", borderCollapse: "collapse" };
const th = {
  textAlign: "left",
  padding: "12px 14px",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 13,
  color: "#475569",
};
const td = { padding: "12px 14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top", fontSize: 14 };
const tokenPequeno = { color: "#94a3b8", fontSize: 12, marginTop: 2 };

function badgeStyle(tono) {
  const tonos = {
    gris: { bg: "#e2e8f0", color: "#334155" },
    azul: { bg: "#dbeafe", color: "#1d4ed8" },
    rojo: { bg: "#fee2e2", color: "#b91c1c" },
    dorado: { bg: "#fef3c7", color: "#92400e" },
  };
  const elegido = tonos[tono] || tonos.gris;
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: elegido.bg,
    color: elegido.color,
    whiteSpace: "nowrap",
  };
}
