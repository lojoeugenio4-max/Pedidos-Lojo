// Ubicaciones de almacén (Código + Nombre). Cada artículo se asigna a una
// ubicación desde su ficha, y los pedidos se ordenan por el código de la
// ubicación para facilitar la preparación.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { compararCodigosUbicacion } from "../utils/ordenUbicacionPedido";

export default function Ubicaciones() {
  const [ubicaciones, setUbicaciones] = useState([]);
  const [articulosPorUbicacion, setArticulosPorUbicacion] = useState({});
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [codigoEditado, setCodigoEditado] = useState("");
  const [nombreEditado, setNombreEditado] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    cargarUbicaciones();
  }, []);

  async function cargarUbicaciones() {
    setCargando(true);
    setError("");

    const { data, error: errorCarga } = await supabase
      .from("ubicaciones")
      .select("id, codigo, nombre");

    if (errorCarga) {
      console.error(errorCarga);
      setError(
        "No se pudieron cargar las ubicaciones. Comprueba que se ha ejecutado migracion_ubicaciones.sql en Supabase."
      );
      setUbicaciones([]);
      setCargando(false);
      return;
    }

    setUbicaciones(
      (data || []).slice().sort((a, b) => compararCodigosUbicacion(a.codigo, b.codigo))
    );

    // Cuántos artículos tiene cada ubicación (solo informativo).
    const conteo = {};
    const TAMANO_PAGINA = 1000;
    let desde = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: articulos, error: errorArticulos } = await supabase
        .from("articulos")
        .select("id, ubicacion_id")
        .not("ubicacion_id", "is", null)
        .order("id", { ascending: true })
        .range(desde, desde + TAMANO_PAGINA - 1);
      if (errorArticulos) break;
      (articulos || []).forEach((a) => {
        const clave = String(a.ubicacion_id);
        conteo[clave] = (conteo[clave] || 0) + 1;
      });
      if (!articulos || articulos.length < TAMANO_PAGINA) break;
      desde += TAMANO_PAGINA;
    }
    setArticulosPorUbicacion(conteo);

    setCargando(false);
  }

  function codigoRepetido(codigoNuevo, idExcluido = null) {
    const normalizado = codigoNuevo.trim().toUpperCase();
    return ubicaciones.some(
      (u) => String(u.codigo).trim().toUpperCase() === normalizado && u.id !== idExcluido
    );
  }

  async function crearUbicacion() {
    const codigoLimpio = codigo.trim();
    const nombreLimpio = nombre.trim();

    if (!codigoLimpio) return alert("Escribe el código de la ubicación");
    if (!nombreLimpio) return alert("Escribe el nombre de la ubicación");
    if (codigoRepetido(codigoLimpio)) return alert("Ya existe una ubicación con ese código");

    const { error: errorAlta } = await supabase
      .from("ubicaciones")
      .insert([{ codigo: codigoLimpio, nombre: nombreLimpio }]);

    if (errorAlta) {
      console.error(errorAlta);
      alert("Error creando la ubicación");
      return;
    }

    setCodigo("");
    setNombre("");
    cargarUbicaciones();
  }

  function empezarEdicion(ubicacion) {
    setEditandoId(ubicacion.id);
    setCodigoEditado(ubicacion.codigo || "");
    setNombreEditado(ubicacion.nombre || "");
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setCodigoEditado("");
    setNombreEditado("");
  }

  async function guardarEdicion(id) {
    const codigoLimpio = codigoEditado.trim();
    const nombreLimpio = nombreEditado.trim();

    if (!codigoLimpio) return alert("El código no puede quedar vacío");
    if (!nombreLimpio) return alert("El nombre no puede quedar vacío");
    if (codigoRepetido(codigoLimpio, id)) return alert("Ya existe otra ubicación con ese código");

    const { error: errorEdicion } = await supabase
      .from("ubicaciones")
      .update({ codigo: codigoLimpio, nombre: nombreLimpio })
      .eq("id", id);

    if (errorEdicion) {
      console.error(errorEdicion);
      alert("Error actualizando la ubicación");
      return;
    }

    cancelarEdicion();
    cargarUbicaciones();
  }

  async function eliminarUbicacion(ubicacion) {
    const total = articulosPorUbicacion[String(ubicacion.id)] || 0;
    const aviso = total
      ? `La ubicación ${ubicacion.codigo} tiene ${total} artículo(s). Si la eliminas, esos artículos se quedarán sin ubicación. ¿Eliminar?`
      : `¿Eliminar la ubicación ${ubicacion.codigo}?`;

    if (!confirm(aviso)) return;

    const { error: errorBorrado } = await supabase
      .from("ubicaciones")
      .delete()
      .eq("id", ubicacion.id);

    if (errorBorrado) {
      console.error(errorBorrado);
      alert("No se pudo eliminar la ubicación.");
      return;
    }

    cargarUbicaciones();
  }

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return ubicaciones;
    return ubicaciones.filter((u) =>
      `${u.codigo} ${u.nombre}`.toLowerCase().includes(texto)
    );
  }, [ubicaciones, busqueda]);

  const totalAsignados = Object.values(articulosPorUbicacion).reduce((t, n) => t + n, 0);

  return (
    <div style={page}>
      <div style={hero}>
        <div>
          <div style={pill}>Administración</div>
          <h1 style={title}>Ubicaciones</h1>
          <p style={subtitle}>
            Los pedidos se imprimen ordenados por el código de ubicación de cada artículo.
            Los artículos sin ubicación salen al final, por orden alfabético.
          </p>
        </div>
      </div>

      <div style={stats}>
        <div style={card}>
          <div style={value}>{ubicaciones.length}</div>
          <div style={label}>Ubicaciones</div>
        </div>
        <div style={card}>
          <div style={value}>{totalAsignados}</div>
          <div style={label}>Artículos con ubicación</div>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={panel}>
        <h2 style={{ marginTop: 0 }}>Nueva ubicación</h2>

        <div style={filaAlta}>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código (p. ej. 01, A-01)"
            style={{ ...input, maxWidth: 220 }}
          />
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && crearUbicacion()}
            placeholder="Nombre (p. ej. Pasillo 1 - Cervezas)"
            style={input}
          />
          <button style={saveBtn} onClick={crearUbicacion}>
            + Crear
          </button>
        </div>
      </div>

      <div style={panel}>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por código o nombre..."
          style={input}
        />

        {cargando ? (
          <p>Cargando ubicaciones...</p>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th style={{ ...th, width: 160 }}>Código</th>
                <th style={th}>Nombre</th>
                <th style={{ ...th, width: 110 }}>Artículos</th>
                <th style={{ ...th, width: 220 }}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filtradas.map((u) => (
                <tr key={u.id}>
                  <td style={td}>
                    {editandoId === u.id ? (
                      <input
                        value={codigoEditado}
                        onChange={(e) => setCodigoEditado(e.target.value)}
                        style={input}
                      />
                    ) : (
                      <strong>{u.codigo}</strong>
                    )}
                  </td>
                  <td style={td}>
                    {editandoId === u.id ? (
                      <input
                        value={nombreEditado}
                        onChange={(e) => setNombreEditado(e.target.value)}
                        style={input}
                      />
                    ) : (
                      u.nombre
                    )}
                  </td>
                  <td style={td}>{articulosPorUbicacion[String(u.id)] || 0}</td>
                  <td style={td}>
                    {editandoId === u.id ? (
                      <>
                        <button style={{ ...saveBtn, marginRight: 8 }} onClick={() => guardarEdicion(u.id)}>
                          Guardar
                        </button>
                        <button style={cancelBtn} onClick={cancelarEdicion}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button style={editBtn} onClick={() => empezarEdicion(u)}>
                          Editar
                        </button>
                        <button style={deleteBtn} onClick={() => eliminarUbicacion(u)}>
                          Eliminar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!filtradas.length && (
                <tr>
                  <td style={td} colSpan={4}>
                    No hay ubicaciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const page = { padding: "24px", background: "#f8fafc", minHeight: "100vh" };
const hero = { background: "linear-gradient(135deg,#111827,#0f766e)", padding: "28px", borderRadius: "24px", color: "#fff", marginBottom: "18px" };
const pill = { display: "inline-block", padding: "6px 12px", background: "rgba(255,255,255,.15)", borderRadius: "999px" };
const title = { margin: "12px 0 0", fontSize: "34px" };
const subtitle = { opacity: 0.9 };
const stats = { display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "18px" };
const card = { background: "#fff", padding: "18px", borderRadius: "18px", boxShadow: "0 10px 25px rgba(0,0,0,.06)", minWidth: 180 };
const value = { fontSize: "32px", fontWeight: "900" };
const label = { color: "#64748b" };
const panel = { background: "#fff", padding: "18px", borderRadius: "18px", marginBottom: "18px", boxShadow: "0 10px 25px rgba(0,0,0,.06)" };
const filaAlta = { display: "flex", gap: 12, flexWrap: "wrap" };
const input = { width: "100%", flex: 1, minWidth: 160, padding: "12px", border: "1px solid #d1d5db", borderRadius: "12px", boxSizing: "border-box" };
const table = { width: "100%", borderCollapse: "collapse", marginTop: "12px" };
const th = { textAlign: "left", padding: "12px", borderBottom: "2px solid #e5e7eb" };
const td = { padding: "12px", borderBottom: "1px solid #f1f5f9" };
const saveBtn = { background: "#22c55e", color: "#fff", border: "none", padding: "12px 16px", borderRadius: "12px", cursor: "pointer" };
const cancelBtn = { background: "#e5e7eb", color: "#111827", border: "none", padding: "10px 14px", borderRadius: "10px", cursor: "pointer" };
const editBtn = { background: "#2563eb", color: "#fff", border: "none", padding: "10px 14px", borderRadius: "10px", marginRight: "8px", cursor: "pointer" };
const deleteBtn = { background: "#ef4444", color: "#fff", border: "none", padding: "10px 14px", borderRadius: "10px", cursor: "pointer" };
const errorBox = { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", padding: "12px 16px", borderRadius: "12px", marginBottom: "18px" };
