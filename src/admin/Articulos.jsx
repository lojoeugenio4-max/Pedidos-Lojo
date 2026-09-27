import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { supabaseStorage } from "../supabaseStorageClient";
import FormArticulo from "./FormArticulo";
import TablaArticulos from "./TablaArticulos";
import { comprimirImagen } from "../utils/comprimirImagen";
import { cargarUbicacionesPorArticulo } from "../utils/ordenUbicacionPedido";

export default function Articulos() {
  const [articulos, setArticulos] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [ubicacionesDisponibles, setUbicacionesDisponibles] = useState(false);
  // Asignación masiva de ubicación: artículos marcados en el listado.
  const [seleccionados, setSeleccionados] = useState(() => new Set());
  const [ubicacionMasiva, setUbicacionMasiva] = useState("");
  const [asignandoMasivo, setAsignandoMasivo] = useState(false);
  const [mensajeMasivo, setMensajeMasivo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("visibles");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState({
    codigo: "",
    codigo_lojo: "",
    nombre: "",
    departamento_id: "",
    ubicacion_id: "",
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
        codigo_lojo,
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

    // La ubicación se carga aparte (ver cargarUbicacionesPorArticulo):
    // si todavía no existe la tabla en Supabase, los artículos cargan igual.
    const resultadoUbicaciones = await cargarUbicacionesPorArticulo(supabase);
    setUbicaciones(resultadoUbicaciones.ubicaciones);
    setUbicacionesDisponibles(resultadoUbicaciones.ok);

    setArticulos(
      (articulosData || []).map((articulo) => {
        const ubicacion = resultadoUbicaciones.porArticulo[String(articulo.id)] || null;
        return { ...articulo, ubicacion, ubicacion_id: ubicacion?.id ?? null };
      })
    );
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

  async function seleccionarFoto(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;

    // La previsualización se muestra ya (con el archivo original, es
    // instantáneo); la compresión tarda un instante y no debe bloquear
    // ver la foto elegida.
    setPreview(URL.createObjectURL(archivo));

    const archivoComprimido = await comprimirImagen(archivo);
    setFoto(archivoComprimido);
  }

  async function nuevoArticulo() {
    setEditando(null);

    const siguienteCodigo = await obtenerSiguienteCodigo();

    setForm({
      codigo: siguienteCodigo,
      codigo_lojo: "",
      nombre: "",
      departamento_id: "",
      ubicacion_id: "",
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
      codigo_lojo: articulo.codigo_lojo || "",
      nombre: articulo.nombre || "",
      departamento_id: String(articulo.departamento_id || ""),
      ubicacion_id: String(articulo.ubicacion_id || ""),
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
    const codigoLojoLimpio = String(form.codigo_lojo || "").trim();

    if (!codigoLimpio) return alert("El código es obligatorio");
    if (!nombreLimpio) return alert("El nombre es obligatorio");
    if (!codigoLojoLimpio) return alert("El código Lojo es obligatorio");

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

    const codigoLojoDuplicado = articulos.some(
      (articulo) =>
        String(articulo.codigo_lojo || "").trim() === codigoLojoLimpio &&
        articulo.id !== editando?.id
    );

    if (codigoLojoDuplicado) {
      alert("Ya existe otro artículo con ese código Lojo");
      return;
    }

    setGuardando(true);

    try {
      let nombreFoto = editando?.foto || null;

      if (foto) {
        const extension = foto.name.split(".").pop().toLowerCase();

        // Nombre único para evitar que se siga viendo la foto antigua por caché
        nombreFoto = `${codigoLimpio}_${Date.now()}.${extension}`;

        const { error: uploadError } = await supabaseStorage.storage
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
        codigo_lojo: codigoLojoLimpio === "" ? null : codigoLojoLimpio,
        nombre: nombreLimpio,
        departamento_id: form.oculto ? null : Number(form.departamento_id),
        precio: form.precio === "" ? null : Number(form.precio),
        permite_unidades: form.permite_unidades,
        activo: form.activo,
        novedad: form.novedad,
        oculto: form.oculto,
        foto: nombreFoto,
      };

      // Solo se guarda la ubicación si la tabla ya existe en Supabase
      // (migracion_ubicaciones.sql ejecutada); si no, se guardaría con error.
      if (ubicacionesDisponibles) {
        datosArticulo.ubicacion_id = form.ubicacion_id ? Number(form.ubicacion_id) : null;
      }

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
      const { error: errorFoto } = await supabaseStorage.storage
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

  // Pone la misma ubicación (o la quita) a todos los artículos marcados.
  async function asignarUbicacionMasiva() {
    const ids = Array.from(seleccionados);
    if (!ids.length) return alert("Marca primero los artículos en el listado");
    if (!ubicacionMasiva) return alert("Elige la ubicación que quieres asignar");

    const quitar = ubicacionMasiva === "__ninguna__";
    const ubicacion = quitar
      ? null
      : ubicaciones.find((u) => String(u.id) === String(ubicacionMasiva)) || null;
    if (!quitar && !ubicacion) return alert("Ubicación no encontrada");

    const textoDestino = quitar
      ? "QUITAR la ubicación a"
      : `asignar la ubicación ${ubicacion.codigo} — ${ubicacion.nombre} a`;
    if (!confirm(`¿Seguro que quieres ${textoDestino} ${ids.length} artículo(s)?`)) return;

    setAsignandoMasivo(true);
    setMensajeMasivo("");

    try {
      // Por bloques, para no pasar el límite de longitud de la petición.
      const BLOQUE = 150;
      for (let i = 0; i < ids.length; i += BLOQUE) {
        const bloque = ids.slice(i, i + BLOQUE);
        const { error } = await supabase
          .from("articulos")
          .update({ ubicacion_id: quitar ? null : Number(ubicacion.id) })
          .in("id", bloque);
        if (error) throw error;
      }

      const idsSet = new Set(ids);
      setArticulos((prev) =>
        prev.map((articulo) =>
          idsSet.has(articulo.id)
            ? { ...articulo, ubicacion, ubicacion_id: ubicacion?.id ?? null }
            : articulo
        )
      );
      setSeleccionados(new Set());
      setMensajeMasivo(
        quitar
          ? `✅ Ubicación quitada a ${ids.length} artículo(s).`
          : `✅ ${ids.length} artículo(s) asignados a ${ubicacion.codigo} — ${ubicacion.nombre}.`
      );
    } catch (error) {
      console.error(error);
      alert("Error asignando la ubicación. No se ha completado el cambio; vuelve a intentarlo.");
      await cargarDatos();
    } finally {
      setAsignandoMasivo(false);
    }
  }

  const resumen = useMemo(() => {
    const activos = articulos.filter((articulo) => articulo.activo).length;
    const inactivos = articulos.filter((articulo) => !articulo.activo).length;
    const ocultos = articulos.filter((articulo) => articulo.oculto).length;
    const sinFoto = articulos.filter((articulo) => !articulo.foto).length;
    const conOferta = articulos.filter(
      (articulo) => Array.isArray(articulo.ofertas) && articulo.ofertas.length > 0
    ).length;
    const conPrecio = articulos.filter(
      (articulo) => articulo.precio !== null && articulo.precio !== undefined
    ).length;

    return {
      total: articulos.length,
      activos,
      inactivos,
      ocultos,
      sinFoto,
      conOferta,
      conPrecio,
    };
  }, [articulos]);

  const articulosFiltrados = articulos.filter((articulo) => {
    const texto = `${articulo.codigo} ${articulo.nombre} ${
      articulo.departamentos?.nombre || ""
    } ${articulo.ubicacion?.codigo || ""} ${articulo.ubicacion?.nombre || ""}`.toLowerCase();

    const tieneOferta =
      Array.isArray(articulo.ofertas) && articulo.ofertas.length > 0;

    const coincideBusqueda = texto.includes(busqueda.toLowerCase());

    const coincideFiltro =
      filtro === "todos" ||
      (filtro === "activos" && articulo.activo) ||
      (filtro === "inactivos" && !articulo.activo) ||
      (filtro === "novedades" && articulo.novedad) ||
      (filtro === "sin_foto" && !articulo.foto) ||
      (filtro === "sin_ubicacion" && !articulo.ubicacion_id) ||
      (filtro === "sin_lojo" &&
        !String(articulo.codigo_lojo || "").trim()) ||
      (filtro === "con_oferta" && tieneOferta) ||
      (filtro === "con_precio" &&
        articulo.precio !== null &&
        articulo.precio !== undefined) ||
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
        <StatCard label="Con precio" value={resumen.conPrecio} />
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
            ubicaciones={ubicaciones}
            ubicacionesDisponibles={ubicacionesDisponibles}
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
              placeholder="Buscar por código, nombre, departamento o ubicación..."
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
          <FilterButton active={filtro === "sin_lojo"} onClick={() => setFiltro("sin_lojo")}>
            ⚠️ Sin código Lojo
          </FilterButton>
          <FilterButton active={filtro === "sin_ubicacion"} onClick={() => setFiltro("sin_ubicacion")}>
            📍 Sin ubicación
          </FilterButton>
          <FilterButton active={filtro === "con_oferta"} onClick={() => setFiltro("con_oferta")}>
            Con oferta
          </FilterButton>
          <FilterButton active={filtro === "con_precio"} onClick={() => setFiltro("con_precio")}>
            💶 Con precio
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

        {ubicacionesDisponibles && (
          <div style={barraMasiva}>
            <strong style={{ whiteSpace: "nowrap" }}>
              📍 {seleccionados.size} marcado{seleccionados.size === 1 ? "" : "s"}
            </strong>
            <select
              value={ubicacionMasiva}
              onChange={(e) => setUbicacionMasiva(e.target.value)}
              style={selectMasivo}
            >
              <option value="">Elegir ubicación…</option>
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.codigo} — {u.nombre}
                </option>
              ))}
              <option value="__ninguna__">✖ Quitar ubicación</option>
            </select>
            <button
              type="button"
              style={botonMasivo(!seleccionados.size || !ubicacionMasiva || asignandoMasivo)}
              disabled={!seleccionados.size || !ubicacionMasiva || asignandoMasivo}
              onClick={asignarUbicacionMasiva}
            >
              {asignandoMasivo ? "Asignando…" : "Asignar a los marcados"}
            </button>
            {seleccionados.size > 0 && (
              <button
                type="button"
                style={botonDesmarcar}
                onClick={() => setSeleccionados(new Set())}
              >
                Desmarcar todo
              </button>
            )}
            <span style={ayudaMasiva}>
              Consejo: filtra por “📍 Sin ubicación” o busca (p. ej. “cruzcampo”), marca la casilla de
              la cabecera para marcar toda la lista, o usa Mayúsculas + clic para marcar un rango.
            </span>
            {mensajeMasivo && <span style={mensajeOk}>{mensajeMasivo}</span>}
          </div>
        )}

        {cargando ? (
          <div style={loadingBox}>Cargando artículos...</div>
        ) : (
          <TablaArticulos
            seleccionable={ubicacionesDisponibles}
            seleccionados={seleccionados}
            onCambiarSeleccion={(nuevos) => {
              setSeleccionados(nuevos);
              setMensajeMasivo("");
            }}
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
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
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


const barraMasiva = {
  position: "sticky",
  top: 0,
  zIndex: 5,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "10px",
  padding: "12px 14px",
  margin: "0 0 12px",
  background: "#f0fdfa",
  border: "1px solid #99f6e4",
  borderRadius: "14px",
  color: "#134e4a",
};

const selectMasivo = {
  minWidth: "240px",
  padding: "10px 12px",
  border: "1px solid #5eead4",
  borderRadius: "10px",
  background: "#ffffff",
};

const botonMasivo = (desactivado) => ({
  padding: "10px 16px",
  border: "none",
  borderRadius: "10px",
  background: desactivado ? "#94a3b8" : "#0f766e",
  color: "#ffffff",
  fontWeight: 700,
  cursor: desactivado ? "not-allowed" : "pointer",
});

const botonDesmarcar = {
  padding: "10px 14px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#334155",
  cursor: "pointer",
};

const ayudaMasiva = { flexBasis: "100%", fontSize: "12px", color: "#0f766e" };

const mensajeOk = { flexBasis: "100%", fontWeight: 700, color: "#15803d" };
