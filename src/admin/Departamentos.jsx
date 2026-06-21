import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Departamentos() {
  const [departamentos, setDepartamentos] = useState([]);
  const [nombre, setNombre] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarDepartamentos();
  }, []);

  async function cargarDepartamentos() {
    setCargando(true);

    const { data, error } = await supabase
      .from("departamentos")
      .select("id, nombre")
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
      console.error(error);
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

    if (!nombreLimpio) {
      alert("El nombre no puede estar vacío");
      return;
    }

    const existe = departamentos.some(
      (dep) =>
        dep.id !== id &&
        dep.nombre.toLowerCase() === nombreLimpio.toLowerCase()
    );

    if (existe) {
      alert("Ya existe otro departamento con ese nombre");
      return;
    }

    const { error } = await supabase
      .from("departamentos")
      .update({ nombre: nombreLimpio })
      .eq("id", id);

    if (error) {
      alert("Error actualizando departamento");
      console.error(error);
      return;
    }

    setEditandoId(null);
    setNombreEditado("");
    cargarDepartamentos();
  }

  async function eliminarDepartamento(id) {
    const confirmar = confirm(
      "¿Seguro que quieres eliminar este departamento?"
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("departamentos")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Error eliminando departamento. Puede que tenga artículos asociados.");
      console.error(error);
      return;
    }

    cargarDepartamentos();
  }

  return (
    <div>
      <h1>📂 Departamentos</h1>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Nombre del departamento"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          style={inputStyle}
        />

        <button onClick={crearDepartamento}>+ Crear</button>
      </div>

      {cargando ? (
        <p>Cargando departamentos...</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Nombre</th>
              <th style={thStyle}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {departamentos.map((dep) => (
              <tr key={dep.id}>
                <td style={tdStyle}>
                  {editandoId === dep.id ? (
                    <input
                      value={nombreEditado}
                      onChange={(e) => setNombreEditado(e.target.value)}
                      style={inputStyle}
                    />
                  ) : (
                    dep.nombre
                  )}
                </td>

                <td style={tdStyle}>
                  {editandoId === dep.id ? (
                    <>
                      <button onClick={() => guardarEdicion(dep.id)}>
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditandoId(null)}
                        style={{ marginLeft: "8px" }}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => empezarEdicion(dep)}>✏️ Editar</button>
                      <button
                        onClick={() => eliminarDepartamento(dep.id)}
                        style={{ marginLeft: "8px" }}
                      >
                        🗑️ Eliminar
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
  );
}

const inputStyle = {
  padding: "10px",
  fontSize: "16px",
  flex: 1,
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: "20px",
};

const thStyle = {
  borderBottom: "2px solid #ddd",
  textAlign: "left",
  padding: "10px",
};

const tdStyle = {
  borderBottom: "1px solid #eee",
  padding: "10px",
};
