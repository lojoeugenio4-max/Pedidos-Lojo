import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import FormArticulo from "./FormArticulo";
import TablaArticulos from "./TablaArticulos";

export default function Articulos() {
  const [articulos, setArticulos] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("visibles");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    departamento_id: "",
    precio: "",
    permite_unidades: true,
    activo: true,
    novedad: false,
    oculto: false,
    oferta_texto: "",
    oferta_fecha_inicio: "",
    oferta_fecha_fin: "",
  });

  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);

    const { data: articulosData, error: articulosError } = await supabase
      .from("articulos")
      .select(`
        id,
        codigo,
        nombre,
        precio,
        activo,
        permite_unidades,
        novedad,
        oculto,
        foto,
        departamento_id,
        departamentos ( nombre ),
        ofertas ( id, texto, fecha_inicio, fecha_fin )
      `)
      .order("nombre", { ascending: true });

    const { data: departamentosData } = await supabase
      .from("departamentos")
      .select("id, nombre")
      .order("nombre", { ascending: true });

    if (articulosError) {
      console.error(articulosError);
      alert("Error cargando artículos");
    }

    setArticulos(articulosData || []);
    setDepartamentos(departamentosData || []);
    setCargando(false);
  }

  function cambiarCampo(campo, valor) {
    setForm({ ...form, [campo]: valor });
  }

  function seleccionarFoto(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;

    setFoto(archivo);
    setPreview(URL.createObjectURL(archivo));
  }

  function nuevoArticulo() {
    setEditando(null);
    setForm({
      codigo: "",
      nombre: "",
      departamento_id: "",
      precio: "",
      permite_unidades: true,
      activo: true,
      novedad: false,
      oculto: false,
      oferta_texto: "",
      oferta_fecha_inicio: "",
      oferta_fecha_fin: "",
    });
    setFoto(null);
    setPreview("");
    setMostrarFormulario(true);
  }

  function editarArticulo(articulo) {
    const oferta =
      Array.isArray(articulo.ofertas) && articulo.ofertas.length > 0
        ? articulo.ofertas[0]
        : null;

    setEditando(articulo);
    setForm({
      codigo: String(articulo.codigo || ""),
      nombre: articulo.nombre || "",
      departamento_id: String(articulo.departamento_id || ""),
      precio: articulo.precio ?? "",
      permite_unidades: Boolean(articulo.permite_unidades),
      activo: Boolean(articulo.activo),
      novedad: Boolean(articulo.novedad),
      oculto: Boolean(articulo.oculto),
      oferta_texto: oferta?.texto || "",
      oferta_fecha_inicio: oferta?.fecha_inicio || "",
      oferta_fecha_fin: oferta?.fecha_fin || "",
    });

    setFoto(null);
    setPreview("");
    setMostrarFormulario(true);
  }

  function cancelarFormulario() {
    setEditando(null);
    setMostrarFormulario(false);
    setFoto(null);
    setPreview("");
  }

  async function guardarArticulo() {
    const codigoLimpio = String(form.codigo).trim();
    const nombreLimpio = form.nombre.trim();

    if (!codigoLimpio) return alert("El código es obligatorio");
    if (!nombreLimpio) return alert("El nombre es obligatorio");

    if (!form.oculto && !form.departamento_id) {
      return alert("Selecciona un departamento o marca el artículo como oculto");
    }

    const codigoDuplicado = articulos.some(
      (articulo) =>
        String(articulo.codigo) === codigoLimpio &&
        articulo.id !== editando?.id
    );

    if (codigoDuplicado) {
      alert("Ya existe un artículo con ese código");
      return;
    }

    let nombreFoto = editando?.foto || null;

    if (foto) {
      const extension = foto.name.split(".").pop().toLowerCase();

      // CLAVE: nombre único para que cambie la foto y no se vea la antigua por caché
      nombreFoto = `${codigoLimpio}_${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("productos")
        .upload(nombreFoto, foto, { upsert: true });

      if (uploadError) {
        console.error(uploadError);
        alert("Error subiendo la foto");
        return;
      }
    }

    const datosArticulo = {
      codigo: Number(codigoLimpio),
      nombre: nombreLimpio,
      departamento_id: form.oculto ? null : Number(form.departamento_id),
      precio: form.precio === "" ? null : Number(form.precio),
      permite_unidades: form.permite_unidades,
      activo: form.activo,
      novedad: form.novedad,
      oculto: form.oculto,
      foto: nombreFoto,
    };

    let articuloId = editando?.id;

    if (editando) {
      const { error } = await supabase
        .from("articulos")
        .update(datosArticulo)
        .eq("id", editando.id);

      if (error) {
        console.error(error);
        alert("Error actualizando el artículo");
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("articulos")
        .insert([datosArticulo])
        .select("id")
        .single();

      if (error) {
        console.error(error);
        alert("Error creando el artículo");
        return;
      }

      articuloId = data.id;
    }

    await guardarOferta(articuloId);
    cancelarFormulario();
    cargarDatos();
  }

  async function guardarOferta(articuloId) {
    const texto = form.oferta_texto.trim();

    const ofertaActual =
      editando?.ofertas && editando.ofertas.length > 0
        ? editando.ofertas[0]
        : null;

    if (!texto) {
      if (ofertaActual) {
        await supabase.from("ofertas").delete().eq("id", ofertaActual.id);
      }
      return;
    }

    const datosOferta = {
      articulo_id: articuloId,
      texto,
      fecha_inicio: form.oferta_fecha_inicio || null,
      fecha_fin: form.oferta_fecha_fin || null,
    };

    if (ofertaActual) {
      await supabase.from("ofertas").update(datosOferta).eq("id", ofertaActual.id);
    } else {
      await supabase.from("ofertas").insert([datosOferta]);
    }
  }

  async function desactivarArticulo(articulo) {
    await supabase.from("articulos").update({ activo: false }).eq("id", articulo.id);
    cargarDatos();
  }

  async function activarArticulo(articulo) {
    await supabase.from("articulos").update({ activo: true }).eq("id", articulo.id);
    cargarDatos();
  }

  async function eliminarArticulo(articulo) {
    const confirmar = confirm(`¿Eliminar definitivamente "${articulo.nombre}"?`);
    if (!confirmar) return;

    await supabase.from("ofertas").delete().eq("articulo_id", articulo.id);
    await supabase.from("articulos").delete().eq("id", articulo.id);

    cargarDatos();
  }

  const articulosFiltrados = articulos.filter((articulo) => {
    const texto = `${articulo.codigo} ${articulo.nombre} ${
      articulo.departamentos?.nombre || ""
    }`.toLowerCase();

    const tieneOferta =
      Array.isArray(articulo.ofertas) && articulo.ofertas.length > 0;

    const coincideBusqueda = texto.includes(busqueda.toLowerCase());

    const coincideFiltro =
      filtro === "todos" ||
      (filtro === "activos" && articulo.activo) ||
      (filtro === "inactivos" && !articulo.activo) ||
      (filtro === "novedades" && articulo.novedad) ||
      (filtro === "sin_foto" && !articulo.foto) ||
      (filtro === "con_oferta" && tieneOferta) ||
      (filtro === "visibles" && !articulo.oculto) ||
      (filtro === "ocultos" && articulo.oculto);

    return coincideBusqueda && coincideFiltro;
  });

  return (
    <div>
      <div style={header}>
        <div>
          <h1 style={title}>Artículos</h1>
          <p style={subtitle}>
            {articulosFiltrados.length} artículos mostrados de {articulos.length}
          </p>
        </div>

        <button onClick={nuevoArticulo} style={newButton}>
          + Nuevo artículo
        </button>
      </div>

      {mostrarFormulario && (
        <FormArticulo
          form={form}
          departamentos={departamentos}
          preview={preview}
          onChange={cambiarCampo}
          onFotoChange={seleccionarFoto}
          onGuardar={guardarArticulo}
          onCancelar={cancelarFormulario}
        />
      )}

      <div style={toolbar}>
        <input
          type="text"
          placeholder="Buscar por código, nombre o departamento..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={searchInput}
        />

        <div style={filters}>
          <button style={filterButton(filtro === "todos")} onClick={() => setFiltro("todos")}>
            Todos
          </button>
          <button style={filterButton(filtro === "activos")} onClick={() => setFiltro("activos")}>
            Activos
          </button>
          <button style={filterButton(filtro === "inactivos")} onClick={() => setFiltro("inactivos")}>
            Inactivos
          </button>
          <button style={filterButton(filtro === "novedades")} onClick={() => setFiltro("novedades")}>
            ⭐ Novedades
          </button>
          <button style={filterButton(filtro === "sin_foto")} onClick={() => setFiltro("sin_foto")}>
            Sin foto
          </button>
          <button style={filterButton(filtro === "con_oferta")} onClick={() => setFiltro("con_oferta")}>
            Con oferta
          </button>
          <button style={filterButton(filtro === "visibles")} onClick={() => setFiltro("visibles")}>
            Visibles
          </button>
          <button style={filterButton(filtro === "ocultos")} onClick={() => setFiltro("ocultos")}>
            Ocultos
          </button>
        </div>
      </div>

      {cargando ? (
        <p>Cargando artículos...</p>
      ) : (
        <TablaArticulos
          articulos={articulosFiltrados}
          onEditar={editarArticulo}
          onDesactivar={desactivarArticulo}
          onActivar={activarArticulo}
          onEliminar={eliminarArticulo}
        />
      )}
    </div>
  );
}

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  marginBottom: "24px",
};

const title = {
  margin: 0,
  fontSize: "28px",
  color: "#111827",
};

const subtitle = {
  margin: "6px 0 0",
  color: "#6b7280",
  fontSize: "14px",
};

const newButton = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: "12px",
  padding: "13px 20px",
  fontSize: "15px",
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(37,99,235,0.25)",
};

const toolbar = {
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "16px",
  marginBottom: "18px",
};

const searchInput = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px 16px",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  fontSize: "15px",
  marginBottom: "14px",
  outline: "none",
};

const filters = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const filterButton = (active) => ({
  border: "none",
  borderRadius: "999px",
  padding: "9px 14px",
  cursor: "pointer",
  fontWeight: "bold",
  background: active ? "#111827" : "#e5e7eb",
  color: active ? "#fff" : "#374151",
});
