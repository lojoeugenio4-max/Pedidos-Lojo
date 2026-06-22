// Versión visual mejorada de Departamentos
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Departamentos() {
  const [departamentos, setDepartamentos] = useState([]);
  const [nombre, setNombre] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    cargarDepartamentos();
  }, []);

  async function cargarDepartamentos() {
    setCargando(true);

    const { data, error } = await supabase
      .from("departamentos")
      .select("id,nombre")
      .order("nombre", { ascending: true });

    if (error) {
      alert("Error cargando departamentos");
      console.error(error);
    } else {
      setDepartamentos(data || []);
    }

    setCargando(false);
  }

  async function crearDepartamento() {
    const nombreLimpio = nombre.trim();

    if (!nombreLimpio) {
      alert("Escribe un nombre de departamento");
      return;
    }

    const existe = departamentos.some(
      (dep) => dep.nombre.toLowerCase() === nombreLimpio.toLowerCase()
    );

    if (existe) {
      alert("Ese departamento ya existe");
      return;
    }

    const { error } = await supabase
      .from("departamentos")
      .insert([{ nombre: nombreLimpio }]);

    if (error) {
      alert("Error creando departamento");
      return;
    }

    setNombre("");
    cargarDepartamentos();
  }

  function empezarEdicion(dep) {
    setEditandoId(dep.id);
    setNombreEditado(dep.nombre);
  }

  async function guardarEdicion(id) {
    const nombreLimpio = nombreEditado.trim();

    const { error } = await supabase
      .from("departamentos")
      .update({ nombre: nombreLimpio })
      .eq("id", id);

    if (error) {
      alert("Error actualizando departamento");
      return;
    }

    setEditandoId(null);
    setNombreEditado("");
    cargarDepartamentos();
  }

  async function eliminarDepartamento(id) {
    if (!confirm("¿Eliminar departamento?")) return;

    const { error } = await supabase
      .from("departamentos")
      .delete()
      .eq("id", id);

    if (error) {
      alert("No se puede eliminar. Tiene artículos asociados.");
      return;
    }

    cargarDepartamentos();
  }

  const filtrados = useMemo(() => {
    return departamentos.filter((d) =>
      d.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );
  }, [departamentos, busqueda]);

  return (
    <div style={page}>
      <div style={hero}>
        <div>
          <div style={pill}>Administración</div>
          <h1 style={title}>Departamentos</h1>
          <p style={subtitle}>
            Organiza y mantiene la estructura del catálogo.
          </p>
        </div>
      </div>

      <div style={stats}>
        <div style={card}>
          <div style={value}>{departamentos.length}</div>
          <div style={label}>Departamentos</div>
        </div>
      </div>

      <div style={panel}>
        <h2>Nuevo departamento</h2>

        <div style={{ display: "flex", gap: 12 }}>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del departamento"
            style={input}
          />

          <button style={saveBtn} onClick={crearDepartamento}>
            + Crear
          </button>
        </div>
      </div>

      <div style={panel}>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar departamento..."
          style={input}
        />

        {cargando ? (
          <p>Cargando departamentos...</p>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Nombre</th>
                <th style={th}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filtrados.map((dep) => (
                <tr key={dep.id}>
                  <td style={td}>
                    {editandoId === dep.id ? (
                      <input
                        value={nombreEditado}
                        onChange={(e) => setNombreEditado(e.target.value)}
                        style={input}
                      />
                    ) : (
                      dep.nombre
                    )}
                  </td>

                  <td style={td}>
                    {editandoId === dep.id ? (
                      <>
                        <button style={saveBtn} onClick={() => guardarEdicion(dep.id)}>
                          Guardar
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
const input={width:"100%",padding:"12px",border:"1px solid #d1d5db",borderRadius:"12px"};
const table={width:"100%",borderCollapse:"collapse",marginTop:"12px"};
const th={textAlign:"left",padding:"12px",borderBottom:"2px solid #e5e7eb"};
const td={padding:"12px",borderBottom:"1px solid #f1f5f9"};
const saveBtn={background:"#22c55e",color:"#fff",border:"none",padding:"12px 16px",borderRadius:"12px"};
const editBtn={background:"#2563eb",color:"#fff",border:"none",padding:"10px 14px",borderRadius:"10px",marginRight:"8px"};
const deleteBtn={background:"#ef4444",color:"#fff",border:"none",padding:"10px 14px",borderRadius:"10px"};
