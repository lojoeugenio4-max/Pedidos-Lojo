import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { contenedor, tituloSeccion, texto, botonSecundario, avisoError } from "./lojopolyEstilos";

const ESTADOS = {
  pendiente: { texto: "Pendiente", fondo: "#fef3c7", color: "#92400e" },
  entregado: { texto: "Entregado", fondo: "#dcfce7", color: "#166534" },
  caducado: { texto: "Caducado", fondo: "#f3f4f6", color: "#6b7280" },
};

const fecha = (iso) =>
  iso ? new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function LojoPolyPremios({ campana }) {
  const [premios, setPremios] = useState([]);
  const [filtro, setFiltro] = useState("pendiente");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ocupadoId, setOcupadoId] = useState(null);

  async function cargar() {
    setError("");
    const { data, error: err } = await supabase.rpc("admin_listar_premios_lojopoly", { p_campana_id: campana.id });
    if (err) setError(`No se han podido cargar los premios: ${err.message}`);
    else setPremios(data || []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campana.id]);

  async function marcar(id, estado) {
    setOcupadoId(id);
    const { error: err } = await supabase.rpc("admin_marcar_premio_lojopoly", { p_premio_id: id, p_estado: estado });
    setOcupadoId(null);
    if (err) setError(`No se ha podido actualizar: ${err.message}`);
    else cargar();
  }

  const cuentas = useMemo(() => {
    const c = { todos: premios.length, pendiente: 0, entregado: 0, caducado: 0 };
    premios.forEach((p) => {
      c[p.estado] = (c[p.estado] || 0) + 1;
    });
    return c;
  }, [premios]);

  const visibles = filtro === "todos" ? premios : premios.filter((p) => p.estado === filtro);

  return (
    <div style={contenedor}>
      <h4 style={tituloSeccion}>Premios ganados</h4>
      <p style={texto}>
        Premios de grupo completado y premios instantáneos. Cuando el cliente recoja el suyo en caja, márcalo como entregado.
      </p>

      {error && <div style={avisoError}>{error}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["pendiente", "entregado", "caducado", "todos"].map((f) => (
          <button key={f} type="button" onClick={() => setFiltro(f)} style={filtroBoton(filtro === f)}>
            {f === "todos" ? "Todos" : ESTADOS[f].texto} ({cuentas[f] || 0})
          </button>
        ))}
      </div>

      {cargando ? (
        <p style={texto}>Cargando premios...</p>
      ) : visibles.length === 0 ? (
        <p style={texto}>
          {premios.length === 0 ? "Todavía no hay premios. Aparecerán aquí cuando los clientes empiecen a jugar." : "No hay premios con este estado."}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tabla}>
            <thead>
              <tr>
                {["Cliente", "Premio", "Ganado", "Recoger antes de", "Estado", ""].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr key={p.id}>
                  <td style={td}>
                    <strong>{p.cliente_nombre}</strong>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>{p.cliente_telefono}</div>
                  </td>
                  <td style={td}>
                    {p.tipo === "grupo" ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 3, background: p.grupo_color || "#9ca3af" }} />
                        Grupo {p.grupo_nombre}: <strong>{p.texto || "sin premio definido"}</strong>
                      </span>
                    ) : (
                      <span>Instantáneo: <strong>{p.texto}</strong></span>
                    )}
                  </td>
                  <td style={td}>{fecha(p.ganado_at)}</td>
                  <td style={td}>{p.caduca_el ? new Date(`${p.caduca_el}T12:00:00`).toLocaleDateString("es-ES") : "—"}</td>
                  <td style={td}>
                    <span style={pastilla(p.estado)}>{ESTADOS[p.estado]?.texto}</span>
                    {p.entregado_at && <div style={{ color: "#6b7280", fontSize: 12 }}>{fecha(p.entregado_at)}</div>}
                  </td>
                  <td style={td}>
                    {p.estado === "pendiente" ? (
                      <button type="button" style={{ ...botonSecundario, color: "#166534", borderColor: "#86efac" }} disabled={ocupadoId === p.id} onClick={() => marcar(p.id, "entregado")}>
                        Marcar entregado
                      </button>
                    ) : (
                      <button type="button" style={botonSecundario} disabled={ocupadoId === p.id} onClick={() => marcar(p.id, "pendiente")}>
                        Volver a pendiente
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const filtroBoton = (activo) => ({
  border: activo ? "1px solid #111827" : "1px solid #d1d5db",
  background: activo ? "#111827" : "#fff",
  color: activo ? "#fff" : "#374151",
  borderRadius: 999,
  padding: "6px 12px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
});
const tabla = { width: "100%", minWidth: 720, borderCollapse: "collapse", fontSize: 14 };
const th = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #e5e7eb", color: "#6b7280", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" };
const td = { padding: "10px", borderBottom: "1px solid #f3f4f6", verticalAlign: "top", color: "#111827" };
const pastilla = (estado) => ({ padding: "3px 9px", borderRadius: 999, fontSize: 12, fontWeight: 800, background: ESTADOS[estado]?.fondo, color: ESTADOS[estado]?.color });
