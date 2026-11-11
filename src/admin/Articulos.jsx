import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabaseClient";
import { supabaseStorage } from "../supabaseStorageClient";
import FormArticulo from "./FormArticulo";
import ImportarEan from "./ImportarEan";
import TablaArticulos from "./TablaArticulos";
import { comprimirImagen } from "../utils/comprimirImagen";
import { cargarUbicacionesPorArticulo } from "../utils/ordenUbicacionPedido";

export default function Articulos() {
  const [articulos, setArticulos] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [ubicacionesDisponibles, setUbicacionesDisponibles] = useState(false);
  // Códigos de barras (EAN): solo se usan si ya existe la columna "eans"
  // (supabase/migracion_eans.sql ejecutada).
  const [eansDisponibles, setEansDisponibles] = useState(false);
  // Asignación masiva de departamento y de ubicación: artículos marcados
  // en el listado.
  const [seleccionados, setSeleccionados] = useState(() => new Set());
  const [departamentoMasivo, setDepartamentoMasivo] = useState("");
  const [ubicacionMasiva, setUbicacionMasiva] = useState("");
  const [asignandoMasivo, setAsignandoMasivo] = useState(false);
  const [mensajeMasivo, setMensajeMasivo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  // Filtros combinables: se aplican TODOS a la vez (el artículo tiene que
  // cumplir cada uno de los que no estén en "todos").
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  // Panel con todos los filtros: plegado por defecto.
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  // ¿El buscador está ya "pegado" arriba? (para tapar el hueco de encima)
  const marcaBuscadorRef = useRef(null);
  const [buscadorFijo, setBuscadorFijo] = useState(false);
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
    eans: [],
  });

  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    const marca = marcaBuscadorRef.current;
    if (!marca || typeof IntersectionObserver === "undefined") return undefined;
    const observador = new IntersectionObserver(([entrada]) => setBuscadorFijo(!entrada.isIntersecting));
    observador.observe(marca);
    return () => observador.disconnect();
  }, []);

  // Con la ficha abierta: Esc la cierra y la página de detrás no se mueve.
  useEffect(() => {
    if (!mostrarFormulario) return undefined;
    const alPulsarTecla = (e) => {
      if (e.key === "Escape") cancelarFormulario();
    };
    window.addEventListener("keydown", alPulsarTecla);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alPulsarTecla);
      document.body.style.overflow = overflowAnterior;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarFormulario]);

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
        departamentos ( cod, nombre ),
        ofertas ( id, texto, fecha_inicio, fecha_fin )
      `)
      .order("nombre", { ascending: true });

    // Departamentos ordenados por su código (Cod), igual que en la
    // pantalla Departamentos.
    const { data: departamentosData, error: departamentosError } = await supabase
      .from("departamentos")
      .select("id, cod, nombre")
      .order("cod", { ascending: true, nullsFirst: false })
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

    // Los EAN también se cargan aparte: si la columna aún no existe, los
    // artículos cargan igual (solo no se ven los códigos de barras).
    const eansPorArticulo = {};
    const { data: eansData, error: eansError } = await supabase.from("articulos").select("id, eans");
    if (eansError) {
      console.warn("Códigos de barras (EAN) no disponibles todavía:", eansError.message);
    } else {
      (eansData || []).forEach((fila) => {
        eansPorArticulo[String(fila.id)] = Array.isArray(fila.eans) ? fila.eans : [];
      });
    }
    setEansDisponibles(!eansError);

    setArticulos(
      (articulosData || []).map((articulo) => {
        const ubicacion = resultadoUbicaciones.porArticulo[String(articulo.id)] || null;
        return {
          ...articulo,
          ubicacion,
          ubicacion_id: ubicacion?.id ?? null,
          eans: eansPorArticulo[String(articulo.id)] || [],
        };
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
      eans: [],
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
      eans: Array.isArray(articulo.eans) ? articulo.eans : [],
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

    // Aviso si algún código de barras ya lo tiene otro artículo.
    if (eansDisponibles) {
      const repetidos = (form.eans || [])
        .map((ean) => {
          const otro = articulos.find(
            (articulo) => articulo.id !== editando?.id && (articulo.eans || []).includes(ean)
          );
          return otro ? `${ean} → ${otro.nombre}` : null;
        })
        .filter(Boolean);
      if (
        repetidos.length &&
        !window.confirm(
          `Estos códigos de barras ya los tiene otro artículo:\n\n${repetidos.join("\n")}\n\n¿Guardar de todas formas?`
        )
      ) {
        return;
      }
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

      // Igual con los códigos de barras (migracion_eans.sql).
      if (eansDisponibles) {
        datosArticulo.eans = [...new Set((form.eans || []).map((e) => String(e).trim()).filter(Boolean))];
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

  // Pone el mismo departamento (o lo quita) a todos los artículos marcados.
  async function asignarDepartamentoMasivo() {
    const ids = Array.from(seleccionados);
    if (!ids.length) return alert("Marca primero los artículos en el listado");
    if (!departamentoMasivo) return alert("Elige el departamento que quieres asignar");

    const quitar = departamentoMasivo === "__ninguno__";
    const departamento = quitar
      ? null
      : departamentos.find((d) => String(d.id) === String(departamentoMasivo)) || null;
    if (!quitar && !departamento) return alert("Departamento no encontrado");

    const textoDestino = quitar
      ? "QUITAR el departamento a"
      : `asignar el departamento ${etiquetaDepartamento(departamento)} a`;
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
          .update({ departamento_id: quitar ? null : departamento.id })
          .in("id", bloque);
        if (error) throw error;
      }

      const idsSet = new Set(ids);
      setArticulos((prev) =>
        prev.map((articulo) =>
          idsSet.has(articulo.id)
            ? {
                ...articulo,
                departamento_id: quitar ? null : departamento.id,
                departamentos: quitar ? null : { cod: departamento.cod, nombre: departamento.nombre },
              }
            : articulo
        )
      );
      setSeleccionados(new Set());
      setMensajeMasivo(
        quitar
          ? `✅ Departamento quitado a ${ids.length} artículo(s).`
          : `✅ ${ids.length} artículo(s) asignados al departamento ${etiquetaDepartamento(departamento)}.`
      );
    } catch (error) {
      console.error(error);
      alert(
        "Error asignando el departamento. Puede que solo se haya cambiado una parte; se recarga el listado para que veas cómo ha quedado."
      );
      await cargarDatos();
    } finally {
      setAsignandoMasivo(false);
    }
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
    const conPrecio = articulos.filter(tienePrecioRelleno).length;
    const novedades = articulos.filter((articulo) => articulo.novedad).length;
    const sinDepartamento = articulos.filter((articulo) => !articulo.departamento_id).length;
    const sinLojo = articulos.filter((articulo) => !String(articulo.codigo_lojo || "").trim()).length;

    return {
      total: articulos.length,
      activos,
      inactivos,
      ocultos,
      sinFoto,
      conOferta,
      conPrecio,
      novedades,
      sinDepartamento,
      sinLojo,
    };
  }, [articulos]);

  function cambiarFiltro(campo, valor) {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  }

  function limpiarFiltros() {
    setFiltros({ ...FILTROS_INICIALES, visibilidad: "todos" });
    setBusqueda("");
  }


  // Búsqueda libre: todas las palabras escritas tienen que aparecer
  // (en cualquier orden) en código, código Lojo, EAN, nombre, departamento o ubicación.
  const palabrasBusqueda = normalizar(busqueda).split(/\s+/).filter(Boolean);
  function coincideBusqueda(articulo) {
    if (!palabrasBusqueda.length) return true;
    const texto = normalizar(
      `${articulo.codigo} ${articulo.codigo_lojo || ""} ${(articulo.eans || []).join(" ")} ${articulo.nombre} ${
        articulo.departamentos?.nombre || ""
      } ${articulo.departamentos?.cod ?? ""} ${articulo.ubicacion?.codigo || ""} ${articulo.ubicacion?.nombre || ""}`
    );
    return palabrasBusqueda.every((palabra) => texto.includes(palabra));
  }

  const articulosFiltrados = articulos.filter((articulo) => {
    const tieneOferta = Array.isArray(articulo.ofertas) && articulo.ofertas.length > 0;
    const tienePrecio = tienePrecioRelleno(articulo);
    const tieneLojo = Boolean(String(articulo.codigo_lojo || "").trim());

    if (!coincideBusqueda(articulo)) return false;

    const { departamento, ubicacion, visibilidad, estado, novedad, foto, lojo, oferta, precio } = filtros;

    if (departamento === "__ninguno__" && articulo.departamento_id) return false;
    if (
      departamento !== "todos" &&
      departamento !== "__ninguno__" &&
      String(articulo.departamento_id || "") !== departamento
    )
      return false;

    if (ubicacion === "__ninguna__" && articulo.ubicacion_id) return false;
    if (
      ubicacion !== "todos" &&
      ubicacion !== "__ninguna__" &&
      String(articulo.ubicacion_id || "") !== ubicacion
    )
      return false;

    if (visibilidad === "visibles" && articulo.oculto) return false;
    if (visibilidad === "ocultos" && !articulo.oculto) return false;

    if (estado === "activos" && !articulo.activo) return false;
    if (estado === "inactivos" && articulo.activo) return false;

    if (novedad === "si" && !articulo.novedad) return false;
    if (novedad === "no" && articulo.novedad) return false;

    if (foto === "con" && !articulo.foto) return false;
    if (foto === "sin" && articulo.foto) return false;

    if (lojo === "con" && !tieneLojo) return false;
    if (lojo === "sin" && tieneLojo) return false;

    if (oferta === "con" && !tieneOferta) return false;
    if (oferta === "sin" && tieneOferta) return false;

    if (precio === "con" && !tienePrecio) return false;
    if (precio === "sin" && tienePrecio) return false;

    return true;
  });

  // Artículos que encajan con lo escrito en el buscador pero que no se ven
  // porque los quita algún filtro (por ejemplo "Solo visibles" o un
  // departamento elegido). Se avisa para que no parezca que no existen.
  const coincidenConBusqueda = palabrasBusqueda.length
    ? articulos.filter(coincideBusqueda).length
    : 0;
  const escondidosPorFiltros = palabrasBusqueda.length
    ? Math.max(0, coincidenConBusqueda - articulosFiltrados.length)
    : 0;

  // Accesos rápidos: un clic aplica el filtro; otro clic lo quita.
  const accesosRapidos = [
    { campo: "precio", valor: "sin", texto: "💶 Sin precio", total: resumen.total - resumen.conPrecio },
    { campo: "foto", valor: "sin", texto: "📷 Sin foto", total: resumen.sinFoto },
    { campo: "oferta", valor: "con", texto: "🏷️ Con oferta", total: resumen.conOferta },
    { campo: "novedad", valor: "si", texto: "⭐ Novedades", total: resumen.novedades },
    { campo: "departamento", valor: "__ninguno__", texto: "🗂️ Sin departamento", total: resumen.sinDepartamento },
    { campo: "lojo", valor: "sin", texto: "⚠️ Sin código Lojo", total: resumen.sinLojo },
    { campo: "visibilidad", valor: "ocultos", texto: "🙈 Ocultos", total: resumen.ocultos },
    { campo: "estado", valor: "inactivos", texto: "⛔ Inactivos", total: resumen.inactivos },
  ];

  const etiquetasFiltros = describirFiltros(filtros, departamentos, ubicaciones);
  const fotoActual = editando?.foto
    ? supabaseStorage.storage.from("productos").getPublicUrl(editando.foto).data.publicUrl
    : "";

  return (
    <div style={page}>
      <header style={hero}>
        <div>
          <h1 style={title}>Artículos</h1>
          <p style={subtitle}>
            {resumen.total} artículos · {resumen.activos} activos · {resumen.conPrecio} con precio
          </p>
        </div>

        <div style={botonesCabecera}>
          <button type="button" onClick={cargarDatos} style={refreshButton} title="Volver a cargar los artículos">
            ⟳ Actualizar
          </button>
          <ImportarEan articulos={articulos} eansDisponibles={eansDisponibles} onTerminado={cargarDatos} />
          <button onClick={nuevoArticulo} style={newButton}>
            + Nuevo artículo
          </button>
        </div>
      </header>

      {/* Buscador: se queda fijo arriba al bajar por la lista. */}
      <div ref={marcaBuscadorRef} style={{ height: 1, marginBottom: -13 }} />
      <section style={barraBusqueda(buscadorFijo)}>
        <div style={searchRow}>
          <div style={searchBox}>
            <span style={searchIcon}>🔎</span>
            <input
              type="text"
              placeholder="Buscar artículo: nombre, código, código Lojo, EAN, departamento…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={searchInput}
              autoFocus
            />
            {busqueda && (
              <button type="button" onClick={() => setBusqueda("")} style={botonBorrarBusqueda} title="Borrar búsqueda">
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMostrarFiltros((v) => !v)}
            style={botonFiltros(mostrarFiltros || etiquetasFiltros.length > 0)}
          >
            ⚙️ Filtros{etiquetasFiltros.length ? ` (${etiquetasFiltros.length})` : ""} {mostrarFiltros ? "▲" : "▼"}
          </button>

          <div style={resultCounter}>
            <strong style={{ fontSize: "20px" }}>{articulosFiltrados.length}</strong>
            <span> de {resumen.total}</span>
          </div>
        </div>

        <div style={filaAccesos}>
          {accesosRapidos.map((acceso) => {
            const activo = filtros[acceso.campo] === acceso.valor;
            return (
              <button
                key={acceso.campo + acceso.valor}
                type="button"
                style={chipAcceso(activo)}
                onClick={() =>
                  cambiarFiltro(
                    acceso.campo,
                    activo ? (acceso.campo === "visibilidad" ? "visibles" : "todos") : acceso.valor
                  )
                }
              >
                {acceso.texto} <span style={chipNumero(activo)}>{acceso.total}</span>
              </button>
            );
          })}
        </div>

        {etiquetasFiltros.length > 0 && (
          <div style={filaActivos}>
            <span style={textoFiltrosActivos}>Filtrando por:</span>
            {etiquetasFiltros.map((f) => (
              <span key={f.campo} style={chipActivo}>
                {f.texto}
                <button
                  type="button"
                  style={chipQuitar}
                  onClick={() => cambiarFiltro(f.campo, "todos")}
                  title="Quitar este filtro"
                >
                  ✕
                </button>
              </span>
            ))}
            <button type="button" onClick={limpiarFiltros} style={botonLimpiar}>
              Quitar todos
            </button>
          </div>
        )}

        {mostrarFiltros && (
          <div style={filtrosGrid}>
            <FiltroSelect
              etiqueta="Departamento"
              valor={filtros.departamento}
              onChange={(v) => cambiarFiltro("departamento", v)}
            >
              <option value="todos">Todos</option>
              {departamentos.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {etiquetaDepartamento(d)}
                </option>
              ))}
              <option value="__ninguno__">🗂️ Sin departamento</option>
            </FiltroSelect>

            <FiltroSelect
              etiqueta="Ubicación"
              valor={filtros.ubicacion}
              onChange={(v) => cambiarFiltro("ubicacion", v)}
              deshabilitado={!ubicacionesDisponibles}
            >
              <option value="todos">Todas</option>
              {ubicaciones.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.codigo} — {u.nombre}
                </option>
              ))}
              <option value="__ninguna__">📍 Sin ubicación</option>
            </FiltroSelect>

            <FiltroSelect
              etiqueta="Visibilidad"
              valor={filtros.visibilidad}
              onChange={(v) => cambiarFiltro("visibilidad", v)}
            >
              <option value="todos">Visibles y ocultos</option>
              <option value="visibles">Solo visibles</option>
              <option value="ocultos">Solo ocultos</option>
            </FiltroSelect>

            <FiltroSelect etiqueta="Estado" valor={filtros.estado} onChange={(v) => cambiarFiltro("estado", v)}>
              <option value="todos">Activos e inactivos</option>
              <option value="activos">Solo activos</option>
              <option value="inactivos">Solo inactivos</option>
            </FiltroSelect>

            <FiltroSelect etiqueta="💶 Precio" valor={filtros.precio} onChange={(v) => cambiarFiltro("precio", v)}>
              <option value="todos">Todos</option>
              <option value="con">Con precio</option>
              <option value="sin">Sin precio</option>
            </FiltroSelect>

            <FiltroSelect etiqueta="Foto" valor={filtros.foto} onChange={(v) => cambiarFiltro("foto", v)}>
              <option value="todos">Todos</option>
              <option value="con">Con foto</option>
              <option value="sin">Sin foto</option>
            </FiltroSelect>

            <FiltroSelect etiqueta="Oferta" valor={filtros.oferta} onChange={(v) => cambiarFiltro("oferta", v)}>
              <option value="todos">Todos</option>
              <option value="con">Con oferta</option>
              <option value="sin">Sin oferta</option>
            </FiltroSelect>

            <FiltroSelect etiqueta="⭐ Novedad" valor={filtros.novedad} onChange={(v) => cambiarFiltro("novedad", v)}>
              <option value="todos">Todos</option>
              <option value="si">Solo novedades</option>
              <option value="no">Sin novedad</option>
            </FiltroSelect>

            <FiltroSelect etiqueta="Código Lojo" valor={filtros.lojo} onChange={(v) => cambiarFiltro("lojo", v)}>
              <option value="todos">Todos</option>
              <option value="con">Con código Lojo</option>
              <option value="sin">⚠️ Sin código Lojo</option>
            </FiltroSelect>
          </div>
        )}

        {escondidosPorFiltros > 0 && (
          <div style={avisoFiltros}>
            ⚠️ Hay <strong>{escondidosPorFiltros}</strong> artículo{escondidosPorFiltros === 1 ? "" : "s"} más con
            “{busqueda.trim()}” que no se ve{escondidosPorFiltros === 1 ? "" : "n"} por los filtros.
            <button
              type="button"
              style={botonVerTodos}
              onClick={() => setFiltros({ ...FILTROS_INICIALES, visibilidad: "todos" })}
            >
              Verlos todos
            </button>
          </div>
        )}
      </section>

      <section style={tableShell}>
        {cargando ? (
          <div style={loadingBox}>Cargando artículos...</div>
        ) : articulosFiltrados.length === 0 ? (
          <div style={loadingBox}>No hay artículos con esta búsqueda o estos filtros.</div>
        ) : (
          <TablaArticulos
            seleccionable
            seleccionados={seleccionados}
            onCambiarSeleccion={(nuevos) => {
              setSeleccionados(nuevos);
              setMensajeMasivo("");
            }}
            articulos={articulosFiltrados}
            editandoId={editando?.id}
            onEditar={editarArticulo}
            onDesactivar={desactivarArticulo}
            onActivar={activarArticulo}
            onEliminar={eliminarArticulo}
          />
        )}
      </section>

      {/* Barra de acciones para los artículos marcados: solo aparece al marcar alguno. */}
      {(seleccionados.size > 0 || mensajeMasivo) && (
        <div style={barraMasiva}>
          <div style={filaMasivaTitulo}>
            <strong>
              ☑️ {seleccionados.size} artículo{seleccionados.size === 1 ? "" : "s"} marcado
              {seleccionados.size === 1 ? "" : "s"}
            </strong>
            {mensajeMasivo && <span style={mensajeOk}>{mensajeMasivo}</span>}
            <button type="button" style={botonDesmarcar} onClick={() => {
              setSeleccionados(new Set());
              setMensajeMasivo("");
            }}>
              {seleccionados.size ? "Desmarcar todo" : "Cerrar"}
            </button>
          </div>

          {seleccionados.size > 0 && (
            <div style={filaMasivaAcciones}>
              <div style={filaMasiva}>
                <select
                  value={departamentoMasivo}
                  onChange={(e) => setDepartamentoMasivo(e.target.value)}
                  style={selectMasivo}
                >
                  <option value="">🗂️ Departamento…</option>
                  {departamentos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {etiquetaDepartamento(d)}
                    </option>
                  ))}
                  <option value="__ninguno__">✖ Quitar departamento</option>
                </select>
                <button
                  type="button"
                  style={botonMasivo(!departamentoMasivo || asignandoMasivo)}
                  disabled={!departamentoMasivo || asignandoMasivo}
                  onClick={asignarDepartamentoMasivo}
                >
                  {asignandoMasivo ? "Asignando…" : "Asignar"}
                </button>
              </div>

              {ubicacionesDisponibles && (
                <div style={filaMasiva}>
                  <select
                    value={ubicacionMasiva}
                    onChange={(e) => setUbicacionMasiva(e.target.value)}
                    style={selectMasivo}
                  >
                    <option value="">📍 Ubicación…</option>
                    {ubicaciones.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.codigo} — {u.nombre}
                      </option>
                    ))}
                    <option value="__ninguna__">✖ Quitar ubicación</option>
                  </select>
                  <button
                    type="button"
                    style={botonMasivo(!ubicacionMasiva || asignandoMasivo)}
                    disabled={!ubicacionMasiva || asignandoMasivo}
                    onClick={asignarUbicacionMasiva}
                  >
                    {asignandoMasivo ? "Asignando…" : "Asignar"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Ficha del artículo: panel lateral, sin tener que subir por la página. */}
      {mostrarFormulario &&
        createPortal(
          <div style={fondoPanel} onClick={cancelarFormulario}>
            <aside style={panelLateral} onClick={(e) => e.stopPropagation()}>
              <div style={panelCabecera}>
                <div style={{ minWidth: 0 }}>
                  <h2 style={formTitle}>{editando ? "Editar artículo" : "Nuevo artículo"}</h2>
                  <p style={formSubtitle}>
                    {editando
                      ? `${editando.codigo_lojo ? `Lojo ${editando.codigo_lojo} · ` : ""}${editando.nombre}`
                      : "El código se rellena solo con el siguiente libre."}
                  </p>
                </div>
                <button type="button" onClick={cancelarFormulario} style={closeButton} title="Cerrar (Esc)">
                  ✕
                </button>
              </div>

              <FormArticulo
                form={form}
                departamentos={departamentos}
                ubicaciones={ubicaciones}
                ubicacionesDisponibles={ubicacionesDisponibles}
                eansDisponibles={eansDisponibles}
                preview={preview}
                fotoActual={fotoActual}
                onChange={cambiarCampo}
                onFotoChange={seleccionarFoto}
                onGuardar={guardarArticulo}
                onCancelar={cancelarFormulario}
                guardando={guardando}
              />
            </aside>
          </div>,
          document.body
        )}
    </div>
  );
}

// Etiquetas de los filtros aplicados, para enseñarlas como "chips".
function describirFiltros(filtros, departamentos, ubicaciones) {
  const textos = {
    visibilidad: { visibles: "Solo visibles", ocultos: "Solo ocultos" },
    estado: { activos: "Solo activos", inactivos: "Solo inactivos" },
    novedad: { si: "Novedades", no: "Sin novedad" },
    foto: { con: "Con foto", sin: "Sin foto" },
    lojo: { con: "Con código Lojo", sin: "Sin código Lojo" },
    oferta: { con: "Con oferta", sin: "Sin oferta" },
    precio: { con: "Con precio", sin: "Sin precio" },
  };
  return Object.entries(filtros)
    .filter(([, valor]) => valor !== "todos")
    .map(([campo, valor]) => {
      let texto = textos[campo]?.[valor] || valor;
      if (campo === "departamento") {
        texto =
          valor === "__ninguno__"
            ? "Sin departamento"
            : etiquetaDepartamento(departamentos.find((d) => String(d.id) === valor)) || "Departamento";
      }
      if (campo === "ubicacion") {
        const u = ubicaciones.find((x) => String(x.id) === valor);
        texto = valor === "__ninguna__" ? "Sin ubicación" : u ? `📍 ${u.codigo}` : "Ubicación";
      }
      return { campo, texto };
    });
}

// Un artículo "tiene precio" si el campo está relleno con un número.
// En blanco, vacío o con texto que no es número = "Sin precio".
function tienePrecioRelleno(articulo) {
  const precio = articulo?.precio;
  if (precio === null || precio === undefined) return false;
  if (typeof precio === "string" && !precio.trim()) return false;
  return Number.isFinite(Number(String(precio).replace(",", ".")));
}

function FiltroSelect({ etiqueta, valor, onChange, deshabilitado = false, children }) {
  const activo = valor !== "todos";
  return (
    <label style={filtroCampo}>
      <span style={filtroEtiqueta(activo)}>{etiqueta}</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        disabled={deshabilitado}
        style={filtroSelect(activo)}
      >
        {children}
      </select>
    </label>
  );
}

// "3 — CERVEZAS" (o solo el nombre si el departamento no tiene código).
function etiquetaDepartamento(departamento) {
  if (!departamento) return "";
  const cod = departamento.cod;
  return cod !== null && cod !== undefined && String(cod).trim() !== ""
    ? `${cod} — ${departamento.nombre}`
    : departamento.nombre;
}

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const FILTROS_INICIALES = {
  departamento: "todos",
  ubicacion: "todos",
  visibilidad: "visibles",
  estado: "todos",
  novedad: "todos",
  foto: "todos",
  lojo: "todos",
  oferta: "todos",
  precio: "todos",
};

const page = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  paddingBottom: "120px",
};

const hero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};

const title = {
  margin: 0,
  fontSize: "26px",
  fontWeight: 950,
  color: "#0f172a",
};

const subtitle = {
  margin: "2px 0 0",
  color: "#64748b",
  fontSize: "14px",
  fontWeight: 700,
};

const botonesCabecera = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  alignItems: "center",
};

const newButton = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  borderRadius: "14px",
  padding: "14px 20px",
  fontSize: "15px",
  fontWeight: "950",
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(22,163,74,0.25)",
  whiteSpace: "nowrap",
};

const refreshButton = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  borderRadius: "14px",
  padding: "13px 16px",
  fontSize: "14px",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

// Bloque del buscador: fijo arriba al hacer scroll.
const barraBusqueda = (fijo) => ({
  position: "sticky",
  top: 0,
  zIndex: 20,
  background: "#ffffff",
  border: "2px solid #c7d2fe",
  borderRadius: "18px",
  padding: "12px",
  // Ya pegado arriba: la primera sombra tapa el hueco de encima para que
  // las filas no se vean pasar por detrás.
  boxShadow: fijo
    ? "0 -24px 0 4px #ffffff, 0 10px 24px rgba(15,23,42,0.14)"
    : "0 6px 16px rgba(15,23,42,0.06)",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
});

const searchRow = {
  display: "flex",
  gap: "10px",
  alignItems: "stretch",
  flexWrap: "wrap",
};

const searchBox = {
  flex: "1 1 360px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  background: "#f8fafc",
  border: "2px solid #6366f1",
  borderRadius: "14px",
  padding: "0 12px",
  minWidth: 0,
};

const searchIcon = { fontSize: "20px" };

const searchInput = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  fontSize: "18px",
  fontWeight: 700,
  padding: "14px 0",
  color: "#0f172a",
};

const botonBorrarBusqueda = {
  border: "none",
  background: "#e2e8f0",
  color: "#334155",
  borderRadius: "999px",
  width: "30px",
  height: "30px",
  fontWeight: 900,
  cursor: "pointer",
  flex: "0 0 auto",
};

const botonFiltros = (activo) => ({
  border: activo ? "2px solid #4f46e5" : "2px solid #e2e8f0",
  background: activo ? "#eef2ff" : "#fff",
  color: activo ? "#3730a3" : "#334155",
  borderRadius: "14px",
  padding: "0 16px",
  minHeight: "52px",
  fontSize: "15px",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

const resultCounter = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  padding: "0 14px",
  borderRadius: "14px",
  background: "#f1f5f9",
  color: "#334155",
  fontSize: "14px",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

// Accesos rápidos en una sola fila (en pantallas estrechas se desliza de lado).
const filaAccesos = {
  display: "flex",
  gap: "8px",
  flexWrap: "nowrap",
  overflowX: "auto",
  paddingBottom: "2px",
  scrollbarWidth: "thin",
};

const chipAcceso = (activo) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  border: activo ? "2px solid #4f46e5" : "1px solid #e2e8f0",
  background: activo ? "#4f46e5" : "#f8fafc",
  color: activo ? "#fff" : "#334155",
  borderRadius: "999px",
  padding: "6px 12px",
  fontSize: "13px",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flex: "0 0 auto",
});

const chipNumero = (activo) => ({
  background: activo ? "rgba(255,255,255,0.25)" : "#e2e8f0",
  borderRadius: "999px",
  padding: "1px 8px",
  fontSize: "12px",
  fontWeight: 900,
});

const filaActivos = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
  alignItems: "center",
};

const textoFiltrosActivos = {
  fontSize: "13px",
  fontWeight: 800,
  color: "#64748b",
};

const chipActivo = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  background: "#eef2ff",
  color: "#3730a3",
  border: "1px solid #c7d2fe",
  borderRadius: "999px",
  padding: "4px 6px 4px 12px",
  fontSize: "13px",
  fontWeight: 800,
};

const chipQuitar = {
  border: "none",
  background: "#c7d2fe",
  color: "#3730a3",
  borderRadius: "999px",
  width: "20px",
  height: "20px",
  fontSize: "11px",
  fontWeight: 900,
  cursor: "pointer",
  padding: 0,
};

const botonLimpiar = {
  border: "none",
  background: "transparent",
  color: "#b91c1c",
  fontSize: "13px",
  fontWeight: 900,
  cursor: "pointer",
  textDecoration: "underline",
};

const filtrosGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: "10px",
  paddingTop: "10px",
  borderTop: "1px solid #e2e8f0",
};

const filtroCampo = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const filtroEtiqueta = (activo) => ({
  fontSize: "12px",
  fontWeight: 900,
  color: activo ? "#4f46e5" : "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
});

const filtroSelect = (activo) => ({
  border: activo ? "2px solid #4f46e5" : "1px solid #cbd5e1",
  background: activo ? "#eef2ff" : "#fff",
  borderRadius: "12px",
  padding: "9px 10px",
  fontSize: "14px",
  fontWeight: 700,
  color: "#0f172a",
});

const avisoFiltros = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#92400e",
  borderRadius: "12px",
  padding: "8px 12px",
  fontSize: "13px",
  fontWeight: 700,
};

const botonVerTodos = {
  border: "none",
  background: "#f59e0b",
  color: "#fff",
  borderRadius: "10px",
  padding: "6px 12px",
  fontWeight: 900,
  cursor: "pointer",
};

const tableShell = {
  minWidth: 0,
};

const loadingBox = {
  padding: "40px 20px",
  textAlign: "center",
  color: "#64748b",
  fontWeight: 800,
  background: "#f8fafc",
  borderRadius: "16px",
  border: "1px dashed #cbd5e1",
};

// Barra flotante abajo, solo cuando hay artículos marcados.
const barraMasiva = {
  position: "sticky",
  bottom: "10px",
  zIndex: 20,
  background: "#0f172a",
  color: "#fff",
  borderRadius: "18px",
  padding: "12px 14px",
  boxShadow: "0 16px 40px rgba(15,23,42,0.35)",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const filaMasivaTitulo = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};

const filaMasivaAcciones = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
};

const filaMasiva = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  flex: "1 1 280px",
};

const selectMasivo = {
  flex: 1,
  minWidth: 0,
  borderRadius: "12px",
  border: "none",
  padding: "10px",
  fontSize: "14px",
  fontWeight: 700,
};

const botonMasivo = (desactivado) => ({
  border: "none",
  borderRadius: "12px",
  padding: "10px 16px",
  background: desactivado ? "#475569" : "#22c55e",
  color: "#fff",
  fontWeight: 900,
  cursor: desactivado ? "not-allowed" : "pointer",
  whiteSpace: "nowrap",
});

const botonDesmarcar = {
  marginLeft: "auto",
  border: "1px solid #475569",
  background: "transparent",
  color: "#e2e8f0",
  borderRadius: "10px",
  padding: "6px 12px",
  fontWeight: 800,
  cursor: "pointer",
};

const mensajeOk = { fontWeight: 800, color: "#86efac" };

// Panel lateral de la ficha.
const fondoPanel = {
  position: "fixed",
  inset: 0,
  zIndex: 4000,
  background: "rgba(15,23,42,0.45)",
  display: "flex",
  justifyContent: "flex-end",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
};

const panelLateral = {
  width: "min(760px, 100%)",
  height: "100%",
  background: "#f8fafc",
  display: "flex",
  flexDirection: "column",
  boxShadow: "-20px 0 50px rgba(0,0,0,0.25)",
};

const panelCabecera = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "16px 20px",
  background: "#fff",
  borderBottom: "1px solid #e2e8f0",
  flex: "0 0 auto",
};

const formTitle = { margin: 0, fontSize: "20px", fontWeight: 950, color: "#0f172a" };

const formSubtitle = {
  margin: "2px 0 0",
  fontSize: "14px",
  fontWeight: 700,
  color: "#64748b",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const closeButton = {
  border: "none",
  background: "#f1f5f9",
  color: "#0f172a",
  borderRadius: "999px",
  width: "42px",
  height: "42px",
  fontSize: "18px",
  fontWeight: 900,
  cursor: "pointer",
  flex: "0 0 auto",
};
