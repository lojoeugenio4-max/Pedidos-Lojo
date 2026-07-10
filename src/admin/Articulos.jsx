import { useEffect, useMemo, useState } from "react";
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
  const [guardando, setGuardando] = useState(false);

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

    const { data: departamentosData, error: departamentosError } = await supabase
      .from("departamentos")
      .select("id, nombre")
      .order("nombre", { ascending: true });

    if (articulosError) {
      console.error(articulosError);
      alert("Error cargando artículos");
    }

    if (departamentosError) {
      console.error(departamentosError);
      alert("Error cargando departamentos");
    }

    setArticulos(articulosData || []);
    setDepartamentos(departamentosData || []);
    setCargando(false);
  }

  async function obtenerSiguienteCodigo() {
    const { data, error } = await supabase
      .from("articulos")
      .select("codigo")
      .not("codigo", "is", null)
      .order("codigo", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error obteniendo el último código:", error);

      const codigosLocales = articulos
        .map((articulo) => Number(articulo.codigo))
        .filter((codigo) => Number.isFinite(codigo));

      const ultimoCodigoLocal =
        codigosLocales.length > 0 ? Math.max(...codigosLocales) : 0;

      return String(ultimoCodigoLocal + 1);
    }

    const ultimoCodigo = Number(data?.codigo || 0);
    return String(ultimoCodigo + 1);
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

  async function nuevoArticulo() {
    setEditando(null);

    const siguienteCodigo = await obtenerSiguienteCodigo();

    setForm({
      codigo: siguienteCodigo,
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

    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 60);
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

    setGuardando(true);

    try {
      let nombreFoto = editando?.foto || null;

      if (foto) {
        const extension = foto.name.split(".").pop().toLowerCase();

        // Nombre único para evitar que se siga viendo la foto antigua por caché
        nombreFoto = `${codigoLimpio}_${Date.now()}.${extension}`;
        const lista = await supabase.storage.from("productos").list();
  console.log("BUCKET PRODUCTOS:", lista);
        const { error: uploadError } = await supabase.storage
          .from("productos")
          .upload(nombreFoto, foto, { upsert: true });

        if (uploadError) {
          console.error(uploadError);
          alert("Error subiendo la foto");
          setGuardando(false);
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
          setGuardando(false);
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
          setGuardando(false);
          return;
        }

        articuloId = data.id;
      }

      await guardarOferta(articuloId);
      cancelarFormulario();
      await cargarDatos();
    } finally {
      setGuardando(false);
    }
  }

  async function guardarOferta(articuloId) {
    const texto = form.oferta_texto.trim();

    const ofertaActual =
      editando?.ofertas && editando.ofertas.length > 0
        ? editando.ofertas[0]
        : null;

    if (!texto) {
      if (ofertaActual) {
        const { error } = await supabase
          .from("ofertas")
          .delete()
          .eq("id", ofertaActual.id);

        if (error) {
          console.error(error);
          alert("Error eliminando la oferta");
        }
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
      const { error } = await supabase
        .from("ofertas")
        .update(datosOferta)
        .eq("id", ofertaActual.id);

      if (error) {
        console.error(error);
        alert("Error actualizando la oferta");
      }
    } else {
      const { error } = await supabase.from("ofertas").insert([datosOferta]);

      if (error) {
        console.error(error);
        alert("Error creando la oferta");
      }
    }
  }

  async function desactivarArticulo(articulo) {
    const { error } = await supabase
      .from("articulos")
      .update({ activo: false })
      .eq("id", articulo.id);

    if (error) {
      console.error(error);
      alert("Error desactivando el artículo");
      return;
    }

    await cargarDatos();
  }

  async function activarArticulo(articulo) {
    const { error } = await supabase
      .from("articulos")
      .update({ activo: true })
      .eq("id", articulo.id);

    if (error) {
      console.error(error);
      alert("Error activando el artículo");
      return;
    }

    await cargarDatos();
  }

  async function eliminarArticulo(articulo) {
    const confirmar = confirm(
      `¿Eliminar definitivamente "${articulo.nombre}"?\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmar) return;

    const { error: errorOfertas } = await supabase
      .from("ofertas")
      .delete()
      .eq("articulo_id", articulo.id);

    if (errorOfertas) {
      console.error(errorOfertas);
      alert("No se pudo eliminar la oferta del artículo. El artículo NO se ha borrado.");
      return;
    }

    const { error: errorArticulo } = await supabase
      .from("articulos")
      .delete()
      .eq("id", articulo.id);

    if (errorArticulo) {
      console.error(errorArticulo);
      alert(
        "No se pudo eliminar el artículo. Puede tener datos relacionados en Supabase."
      );
      return;
    }

    if (articulo.foto) {
      const { error: errorFoto } = await supabase.storage
        .from("productos")
        .remove([articulo.foto]);

      if (errorFoto) {
        console.warn("El artículo se borró, pero no se pudo borrar la foto:", errorFoto);
      }
    }

    setArticulos((prev) => prev.filter((item) => item.id !== articulo.id));

    alert("Artículo eliminado definitivamente.");
    await cargarDatos();
  }

  const resumen = useMemo(() => {
    const activos = articulos.filter((articulo) => articulo.activo).length;
    const inactivos = articulos.filter((articulo) => !articulo.activo).length;
    const ocultos = articulos.filter((articulo) => articulo.oculto).length;
    const sinFoto = articulos.filter((articulo) => !articulo.foto).length;
    const conOferta = articulos.filter(
      (articulo) => Array.isArray(articulo.ofertas) && articulo.ofertas.length > 0
    ).length;

    return {
      total: articulos.length,
      activos,
      inactivos,
      ocultos,
      sinFoto,
      conOferta,
    };
  }, [articulos]);

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
    <div style={page}>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Administración</div>
          <h1 style={title}>Artículos</h1>
          <p style={subtitle}>
            Gestiona altas, fotos, ofertas, visibilidad y códigos del catálogo.
          </p>
        </div>

        <button onClick={nuevoArticulo} style={newButton}>
          + Nuevo artículo
        </button>
      </section>

      <section style={statsGrid}>
        <StatCard label="Total" value={resumen.total} />
        <StatCard label="Activos" value={resumen.activos} />
        <StatCard label="Inactivos" value={resumen.inactivos} />
        <StatCard label="Ocultos" value={resumen.ocultos} />
        <StatCard label="Sin foto" value={resumen.sinFoto} />
        <StatCard label="Con oferta" value={resumen.conOferta} />
      </section>

      {mostrarFormulario && (
        <section style={formShell}>
          <div style={formHeader}>
            <div>
              <h2 style={formTitle}>
                {editando ? "Editar artículo" : "Nuevo artículo"}
              </h2>
              <p style={formSubtitle}>
                {editando
                  ? "Modifica los datos del artículo seleccionado."
                  : "El código se rellena automáticamente con el siguiente disponible."}
              </p>
            </div>

            <button type="button" onClick={cancelarFormulario} style={closeButton}>
              Cerrar
            </button>
          </div>

          <FormArticulo
            form={form}
            departamentos={departamentos}
            preview={preview}
            onChange={cambiarCampo}
            onFotoChange={seleccionarFoto}
            onGuardar={guardarArticulo}
            onCancelar={cancelarFormulario}
            guardando={guardando}
          />
        </section>
      )}

      <section style={toolbar}>
        <div style={searchRow}>
          <div style={searchBox}>
            <span style={searchIcon}>🔎</span>
            <input
              type="text"
              placeholder="Buscar por código, nombre o departamento..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={searchInput}
            />
          </div>

          <div style={resultCounter}>
            <strong>{articulosFiltrados.length}</strong>
            <span> mostrados</span>
          </div>
        </div>

        <div style={filters}>
          <FilterButton active={filtro === "visibles"} onClick={() => setFiltro("visibles")}>
            Visibles
          </FilterButton>
          <FilterButton active={filtro === "todos"} onClick={() => setFiltro("todos")}>
            Todos
          </FilterButton>
          <FilterButton active={filtro === "activos"} onClick={() => setFiltro("activos")}>
            Activos
          </FilterButton>
          <FilterButton active={filtro === "inactivos"} onClick={() => setFiltro("inactivos")}>
            Inactivos
          </FilterButton>
          <FilterButton active={filtro === "novedades"} onClick={() => setFiltro("novedades")}>
            ⭐ Novedades
          </FilterButton>
          <FilterButton active={filtro === "sin_foto"} onClick={() => setFiltro("sin_foto")}>
            Sin foto
          </FilterButton>
          <FilterButton active={filtro === "con_oferta"} onClick={() => setFiltro("con_oferta")}>
            Con oferta
          </FilterButton>
          <FilterButton active={filtro === "ocultos"} onClick={() => setFiltro("ocultos")}>
            Ocultos
          </FilterButton>
        </div>
      </section>

      <section style={tableShell}>
        <div style={tableHeader}>
          <div>
            <h2 style={tableTitle}>Listado de artículos</h2>
            <p style={tableSubtitle}>
              Los cambios se reflejan en la página de pedidos al guardar.
            </p>
          </div>

          <button type="button" onClick={cargarDatos} style={refreshButton}>
            Actualizar
          </button>
        </div>

        {cargando ? (
          <div style={loadingBox}>Cargando artículos...</div>
        ) : (
          <TablaArticulos
            articulos={articulosFiltrados}
            onEditar={editarArticulo}
            onDesactivar={desactivarArticulo}
            onActivar={activarArticulo}
            onEliminar={eliminarArticulo}
          />
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={statCard}>
      <div style={statValue}>{value}</div>
      <div style={statLabel}>{label}</div>
    </div>
  );
}

function FilterButton({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={filterButton(active)}>
      {children}
    </button>
  );
}

const page = {
  minHeight: "100vh",
  padding: "24px",
  background:
    "linear-gradient(180deg, #eef2ff 0%, #f8fafc 38%, #ffffff 100%)",
  boxSizing: "border-box",
};

const hero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  background: "linear-gradient(135deg, #111827 0%, #1d4ed8 100%)",
  borderRadius: "24px",
  padding: "28px",
  color: "#ffffff",
  boxShadow: "0 22px 45px rgba(29,78,216,0.22)",
  marginBottom: "18px",
};

const eyebrow = {
  display: "inline-block",
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "999px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: "900",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  marginBottom: "12px",
};

const title = {
  margin: 0,
  fontSize: "34px",
  lineHeight: "1",
  fontWeight: "950",
};

const subtitle = {
  margin: "10px 0 0",
  color: "#dbeafe",
  fontSize: "15px",
  maxWidth: "640px",
};

const newButton = {
  background: "#22c55e",
  color: "#fff",
  border: "none",
  borderRadius: "16px",
  padding: "15px 22px",
  fontSize: "15px",
  fontWeight: "950",
  cursor: "pointer",
  boxShadow: "0 14px 26px rgba(34,197,94,0.28)",
  whiteSpace: "nowrap",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
  gap: "12px",
  marginBottom: "18px",
};

const statCard = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  padding: "16px",
  boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
};

const statValue = {
  fontSize: "28px",
  fontWeight: "950",
  color: "#111827",
  lineHeight: "1",
};

const statLabel = {
  marginTop: "8px",
  fontSize: "12px",
  fontWeight: "850",
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const formShell = {
  background: "#ffffff",
  border: "1px solid #dbeafe",
  borderRadius: "22px",
  padding: "18px",
  marginBottom: "18px",
  boxShadow: "0 18px 40px rgba(29,78,216,0.12)",
};

const formHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "14px",
  marginBottom: "14px",
};

const formTitle = {
  margin: 0,
  color: "#111827",
  fontSize: "21px",
  fontWeight: "950",
};

const formSubtitle = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "13px",
};

const closeButton = {
  border: "none",
  borderRadius: "999px",
  padding: "9px 14px",
  background: "#f1f5f9",
  color: "#334155",
  fontWeight: "900",
  cursor: "pointer",
};

const toolbar = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "22px",
  padding: "16px",
  marginBottom: "18px",
  boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
};

const searchRow = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "12px",
  alignItems: "center",
  marginBottom: "14px",
};

const searchBox = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  background: "#f8fafc",
  border: "1px solid #dbe4ef",
  borderRadius: "16px",
  padding: "0 14px",
};

const searchIcon = {
  fontSize: "17px",
};

const searchInput = {
  width: "100%",
  boxSizing: "border-box",
  padding: "15px 0",
  border: "none",
  fontSize: "15px",
  outline: "none",
  background: "transparent",
  color: "#111827",
};

const resultCounter = {
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: "14px",
  padding: "12px 15px",
  fontSize: "14px",
  whiteSpace: "nowrap",
};

const filters = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const filterButton = (active) => ({
  border: "none",
  borderRadius: "999px",
  padding: "10px 15px",
  cursor: "pointer",
  fontWeight: "900",
  background: active ? "#111827" : "#f1f5f9",
  color: active ? "#fff" : "#334155",
  boxShadow: active ? "0 10px 18px rgba(17,24,39,0.18)" : "none",
});

const tableShell = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "22px",
  padding: "16px",
  boxShadow: "0 14px 35px rgba(15,23,42,0.07)",
};

const tableHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  marginBottom: "14px",
};

const tableTitle = {
  margin: 0,
  color: "#111827",
  fontSize: "20px",
  fontWeight: "950",
};

const tableSubtitle = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "13px",
};

const refreshButton = {
  border: "none",
  borderRadius: "14px",
  padding: "11px 15px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: "950",
  cursor: "pointer",
};

const loadingBox = {
  padding: "30px",
  textAlign: "center",
  color: "#64748b",
  fontWeight: "900",
  background: "#f8fafc",
  borderRadius: "16px",
};

