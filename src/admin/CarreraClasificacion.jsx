import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { contenedor, tituloSeccion, botonSecundario, avisoError, ayuda, urlFotoArticulo } from "./lojopolyEstilos";

// Fichas de todos los clientes y premios ganados en esta edición.

export default function CarreraClasificacion({ edicion }) {
  const [jugadores, setJugadores] = useState([]);
  const [premios, setPremios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [marcando, setMarcando] = useState(null);

  const cargar = useCallback(async () => {
    setError("");
    const [j, p] = await Promise.all([
      supabase.rpc("admin_carrera_jugadores", { p_edicion: edicion.id }),
      supabase.rpc("admin_listar_premios_carrera", { p_edicion: edicion.id }),
    ]);
    if (j.error || p.error) setError(`No se han podido cargar los datos: ${(j.error || p.error).message}`);
    setJugadores(j.data || []);
    setPremios(p.data || []);
    setCargando(false);
  }, [edicion.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function marcar(premio, entregado) {
    setMarcando(premio.id);
    const { error: err } = await supabase.rpc("admin_marcar_premio_carrera", { p_id: premio.id, p_entregado: entregado });
    setMarcando(null);
    if (err) {
      setError(`No se ha podido marcar el premio: ${err.message}`);
      return;
    }
    setPremios((lista) => lista.map((x) => (x.id === premio.id ? { ...x, entregado, entregado_at: entregado ? new Date().toISOString() : null } : x)));
  }

  if (cargando) return <p style={{ color: "#6b7280" }}>Cargando clasificación...</p>;

  return (
    <>
      {error && <div style={{ ...avisoError, marginBottom: 14 }}>{error}</div>}

      <div style={contenedor}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h4 style={tituloSeccion}>🎁 Premios ganados ({premios.length})</h4>
          <button type="button" style={botonSecundario} onClick={cargar}>
            Actualizar
          </button>
        </div>
        {premios.length === 0 ? (
          <p style={ayuda}>Todavía nadie ha ganado ningún premio en esta edición.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tabla}>
              <thead>
                <tr>
                  <th style={th}>Fecha</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Casilla</th>
                  <th style={th}>Premio</th>
                  <th style={th}>Entregado</th>
                </tr>
              </thead>
              <tbody>
                {premios.map((p) => {
                  const foto = urlFotoArticulo(p.articulo_foto);
                  return (
                    <tr key={p.id} style={p.tipo === "final" ? { background: "#fffbeb" } : undefined}>
                      <td style={td}>{new Date(p.created_at).toLocaleString("es-ES")}</td>
                      <td style={td}>
                        <strong>{p.cliente_nombre || "Cliente"}</strong>
                      </td>
                      <td style={td}>{p.tipo === "final" ? "🏆 Meta" : p.tipo === "mitad" ? "🚩 Mitad (32)" : p.casilla}</td>
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {foto && <img src={foto} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />}
                          <span>
                            {p.texto || p.articulo_nombre || "Premio"}
                            {p.articulo_nombre && (
                              <span style={{ color: "#6b7280", fontSize: 12 }}>
                                {" "}
                                · {p.cantidad} {p.formato} de {p.articulo_nombre} (cód. {p.articulo_codigo || "—"})
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td style={td}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                          <input type="checkbox" checked={Boolean(p.entregado)} disabled={marcando === p.id} onChange={(e) => marcar(p, e.target.checked)} />
                          {p.entregado && p.entregado_at ? new Date(p.entregado_at).toLocaleDateString("es-ES") : ""}
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={contenedor}>
        <h4 style={tituloSeccion}>🏁 Clasificación ({jugadores.length} clientes en el tablero)</h4>
        {jugadores.length === 0 ? (
          <p style={ayuda}>Todavía no ha tirado nadie. Los clientes aparecen aquí con su primera tirada.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tabla}>
              <thead>
                <tr>
                  <th style={th}>Puesto</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Casilla</th>
                  <th style={th}>Tiradas hechas</th>
                  <th style={th}>Tiradas sin jugar</th>
                  <th style={th}>Última tirada</th>
                </tr>
              </thead>
              <tbody>
                {jugadores.map((j) => (
                  <tr key={j.cliente_id} style={Number(j.puesto) <= 10 ? { background: "#f0fdf4" } : undefined}>
                    <td style={td}>{j.puesto}</td>
                    <td style={td}>
                      <strong>{j.cliente_nombre || "Cliente"}</strong>
                    </td>
                    <td style={td}>{j.casilla}</td>
                    <td style={td}>{j.tiradas_hechas}</td>
                    <td style={td}>{j.tiradas_pendientes}</td>
                    <td style={td}>{j.updated_at ? new Date(j.updated_at).toLocaleString("es-ES") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={ayuda}>En verde, los 10 primeros: son los que se ven en la TV grande.</p>
      </div>
    </>
  );
}

const tabla = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const th = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #e5e7eb", color: "#374151", fontSize: 13, whiteSpace: "nowrap" };
const td = { padding: "8px 10px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle" };
