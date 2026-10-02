// Departamentos con Código (cod) numérico. La lista se ordena por código.
// Requiere haber ejecutado migracion_departamentos_cod.sql en Supabase.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Departamentos() {
  const [departamentos, setDepartamentos] = useState([]);
  const [cod, setCod] = useState("");
  const [nombre, setNombre] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [codEditado, setCodEditado] = useState("");
  const [nombreEditado, setNombreEditado] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    cargarDepartamentos();
  }, []);

  async function cargarDepartamentos() {
    setCargando(true);
    setError("");

    const { data, error: errorCarga } = await supabase
      .from("departamentos")
      .select("id, cod, nombre")
      .order("cod", { ascending: true, nullsFirst: false })
      .order("nombre", { ascending: true });

    if (errorCarga) {
      console.error(errorCarga);
      setError(
        "No se pudieron cargar los departamentos. Comprueba que se ha ejecutado migracion_departamentos_cod.sql en Supabase."
      );
      setDepartamentos([]);
    } else {
      setDepartamentos(data || []);
    }

    setCargando(false);
  }

  // Siguiente código libre sugerido (último + 10)
  const siguienteCod = useMemo(() => {
    const max = departamentos.reduce(
      (m, d) => (Number.isFinite(d.cod) && d.cod > m ? d.cod : m),
      0
    );
    return max + 10;
  }, [departamentos]);

  function validarCod(texto) {
    const limpio = String(texto).trim();
    if (!/^\d+$/.test(limpio)) return null;
    const n = parseInt(limpio, 10);
    return n > 0 ? n : null;
  }

  function codRepetido(n, idExcluido = null) {
    return departamentos.some((d) => d.cod === n && d.id !== idExcluido);
  }

  async function crearDepartamento() {
    const nombreLimpio = nombre.trim();
    const codTexto = cod.trim() || String(siguienteCod);
    const codNum = validarCod(codTexto);

    if (!nombreLimpio) return alert("Escribe un nombre de departamento");
    if (codNum === null) return alert("El código debe ser un número entero mayor que 0");
    if (codRepetido(codNum)) return alert(`Ya existe un departamento con el código ${codNum}`);

    const existe = departamentos.some(
      (dep) => dep.nombre.toLowerCase() === nombreLimpio.toLowerCase()
    );
    if (existe) return alert("Ese departamento ya existe");

    const { error: errorAlta } = await supabase
      .from("departamentos")
      .insert([{ cod: codNum, nombre: nombreLimpio }]);

    if (errorAlta) {
      console.error(errorAlta);
      alert("Error creando departamento");
      return;
    }

    setCod("");
    setNombre("");
    cargarDepartamentos();
  }

  function empezarEdicion(dep) {
    setEditandoId(dep.id);
    setCodEditado(dep.cod != null ? String(dep.cod) : "");
    setNombreEditado(dep.nombre);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setCodEditado("");
    setNombreEditado("");
  }

  async function guardarEdicion(id) {
    const nombreLimpio = nombreEditado.trim();
    const codNum = validarCod(codEditado);

    if (!nombreLimpio) return alert("El nombre no puede quedar vacío");
    if (codNum === null) return alert("El código debe ser un número entero mayor que 0");
    if (codRepetido(codNum, id)) return alert(`Ya existe otro departamento con el código ${codNum}`);

    const { error: errorEdicion } = await supabase
      .from("departamentos")
      .update({ cod: codNum, nombre: nombreLimpio })
      .eq("id", id);

    if (errorEdicion) {
      console.error(errorEdicion);
      alert("Error actualizando departamento");
      return;
    }

    cancelarEdicion();
    cargarDepartamentos();
  }

  async function eliminarDepartamento(id) {
    if (!confirm("¿Eliminar departamento?")) return;

    const { error: errorBorrado } = await supabase
      .from("departamentos")
      .delete()
      .eq("id", id);

    if (errorBorrado) {
      alert("No se puede eliminar. Tiene artículos asociados.");
      return;
    }

    cargarDepartamentos();
  }

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return departamentos;
    return departamentos.filter((d) =>
      `${d.cod ?? ""} ${d.nombre}`.toLowerCase().includes(texto)
    );
  }, [departamentos, busqueda]);

  return (
    <div style={page}>
      <div style={hero}>
        <div>
          <div style={pill}>Administración</div>
          <h1 style={title}>Departamentos</h1>
          <p style={subtitle}>
            Organiza y mantiene la estructura del catálogo. Los departamentos se
            ordenan por su código (Cod).
          </p>
        </div>
      </div>

      <div style={stats}>
        <div style={card}>
          <div style={value}>{departamentos.length}</div>
          <div style={label}>Departamentos</div>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={panel}>
        <h2 style={{ marginTop: 0 }}>Nuevo departamento</h2>

        <div style={filaAlta}>
          <input
            value={cod}
            onChange={(e) => setCod(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder={`Cod (sugerido: ${siguienteCod})`}
            style={{ ...input, maxWidth: 200 }}
          />
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && crearDepartamento()}
            placeholder="Nombre del departamento"
            style={input}
          />
          <button style={saveBtn} onClick={crearDepartamento}>
            + Crear
          </button>
        </div>
        <p style={ayuda}>
          Si dejas el código vacío se asigna el siguiente libre ({siguienteCod}).
        </p>
      </div>

      <div style={panel}>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por código o nombre..."
          style={input}
        />

        {cargando ? (
          <p>Cargando departamentos...</p>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th style={{ ...th, width: 120 }}>Cod</th>
                <th style={th}>Nombre</th>
                <th style={{ ...th, width: 220 }}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filtrados.map((dep) => (
                <tr key={dep.id}>
                  <td style={td}>
                    {editandoId === dep.id ? (
                      <input
                        value={codEditado}
                        onChange={(e) => setCodEditado(e.target.value.replace(/[^\d]/g, ""))}
                        inputMode="numeric"
                        style={input}
                      />
                    ) : (
                      <strong>{dep.cod ?? "—"}</strong>
                    )}
                  </td>

                  <td style={td}>
                    {editandoId === dep.id ? (
                      <input
                        value={nombreEditado}
                        onChange={(e) => setNombreEditado(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && guardarEdicion(dep.id)}
                        style={input}
                      />
                    ) : (
                      dep.nombre
                    )}
                  </td>

                  <td style={td}>
                    {editandoId === dep.id ? (
                      <>
                        <button
                          style={{ ...saveBtn, marginRight: 8 }}
                          onClick={() => guardarEdicion(dep.id)}
                        >
                          Guardar
                        </button>
                        <button style={cancelBtn} onClick={cancelarEdicion}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button style={editBtn} onClick={() => empezarEdicion(dep)}>
                          Editar
                        </button>
                        <button
                          style={deleteBtn}
                          onClick={() => eliminarDepartamento(dep.id)}
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!filtrados.length && (
                <tr>
                  <td style={td} colSpan={3}>
                    No hay departamentos.
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

const page={padding:"24px",background:"#f8fafc",minHeight:"100vh"};
const hero={background:"linear-gradient(135deg,#111827,#2563eb)",padding:"28px",borderRadius:"24px",color:"#fff",marginBottom:"18px"};
const pill={display:"inline-block",padding:"6px 12px",background:"rgba(255,255,255,.15)",borderRadius:"999px"};
const title={margin:"12px 0 0",fontSize:"34px"};
const subtitle={opacity:.9};
const stats={marginBottom:"18px"};
const card={background:"#fff",padding:"18px",borderRadius:"18px",boxShadow:"0 10px 25px rgba(0,0,0,.06)"};
const value={fontSize:"32px",fontWeight:"900"};
const label={color:"#64748b"};
const panel={background:"#fff",padding:"18px",borderRadius:"18px",marginBottom:"18px",boxShadow:"0 10px 25px rgba(0,0,0,.06)"};
const filaAlta={display:"flex",gap:12,flexWrap:"wrap"};
const ayuda={margin:"10px 0 0",color:"#64748b",fontSize:"14px"};
const input={width:"100%",flex:1,minWidth:120,padding:"12px",border:"1px solid #d1d5db",borderRadius:"12px",boxSizing:"border-box"};
const table={width:"100%",borderCollapse:"collapse",marginTop:"12px"};
const th={textAlign:"left",padding:"12px",borderBottom:"2px solid #e5e7eb"};
const td={padding:"12px",borderBottom:"1px solid #f1f5f9"};
const saveBtn={background:"#22c55e",color:"#fff",border:"none",padding:"12px 16px",borderRadius:"12px",cursor:"pointer"};
const cancelBtn={background:"#e5e7eb",color:"#111827",border:"none",padding:"10px 14px",borderRadius:"10px",cursor:"pointer"};
const editBtn={background:"#2563eb",color:"#fff",border:"none",padding:"10px 14px",borderRadius:"10px",marginRight:"8px",cursor:"pointer"};
const deleteBtn={background:"#ef4444",color:"#fff",border:"none",padding:"10px 14px",borderRadius:"10px",cursor:"pointer"};
const errorBox={background:"#fef2f2",color:"#991b1b",border:"1px solid #fecaca",padding:"12px 16px",borderRadius:"12px",marginBottom:"18px"};
