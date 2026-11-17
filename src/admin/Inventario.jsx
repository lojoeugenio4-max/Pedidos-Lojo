// Inventario (Admin > Inventario). Solo para el personal de Cash Lojo.
//
// 1. Se crea un inventario (p. ej. "Inventario noviembre 2026").
// 2. CONTAR: con la cámara del móvil se lee el código de barras, sale el
//    artículo y se escriben las UNIDADES. Al guardar, vuelve solo a la
//    cámara para el siguiente. Si el mismo artículo está en otra ubicación,
//    se vuelve a leer y se SUMA. Pueden contar varias personas a la vez.
//    Busca en TODOS los artículos (también desactivados u ocultos).
// 3. RESUMEN: total por artículo, con el detalle de cada lectura (se puede
//    corregir o borrar), artículos sin contar, exportar a CSV e imprimir.
//
// Tablas: inventarios e inventario_lineas (supabase/migracion_inventario.sql).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabaseClient";
import { supabaseStorage } from "../supabaseStorageClient";
import { normalizarEan, variantesCodigo } from "../utils/buscarPorEan";
import LectorCamara from "./LectorCamara";
import { ClaveTrabajadores } from "./AccesoAdmin";

const TAMANO_PAGINA = 1000;
const REFRESCO_RESUMEN_MS = 15000;
const CLAVE_QUIEN = "lojo-inventario-quien";
const CLAVE_UBICACION = "lojo-inventario-ubicacion";

function leerLocal(clave) {
  try {
    return localStorage.getItem(clave) || "";
  } catch {
    return "";
  }
}

function guardarLocal(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // nada
  }
}

function urlFoto(foto) {
  if (!foto) return "";
  if (/^https?:\/\//.test(foto)) return foto;
  return supabaseStorage.storage.from("productos").getPublicUrl(foto).data.publicUrl;
}

function formatoFecha(iso, conHora = false) {
  if (!iso) return "";
  const fecha = new Date(iso);
  return conHora
    ? fecha.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// 1234567 -> "1.234.567" (con punto de miles también en números de 4 cifras).
function formatoUnidades(n) {
  const numero = Math.trunc(Number(n || 0));
  const signo = numero < 0 ? "-" : "";
  return signo + String(Math.abs(numero)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Lo que se escribe en la casilla de cantidad: solo cifras, con puntos de miles.
function formatearEntrada(texto) {
  const cifras = String(texto || "").replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 9);
  return cifras ? formatoUnidades(Number(cifras)) : "";
}

function leerEntrada(texto) {
  const cifras = String(texto || "").replace(/\D/g, "");
  return cifras ? Number(cifras) : NaN;
}

function sinTildes(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Carga todas las filas de una consulta, de 1000 en 1000.
async function cargarTodo(crearConsulta) {
  const filas = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await crearConsulta().range(desde, desde + TAMANO_PAGINA - 1);
    if (error) throw error;
    filas.push(...(data || []));
    if (!data || data.length < TAMANO_PAGINA) break;
  }
  return filas;
}

const CAMPOS_ARTICULO = "id, codigo, codigo_lojo, nombre, foto, activo, oculto, eans";

async function buscarArticulosPorCodigo(codigo) {
  const variantes = variantesCodigo(codigo);
  if (!variantes.length) return [];
  const { data, error } = await supabase.from("articulos").select(CAMPOS_ARTICULO).overlaps("eans", variantes);
  if (error) throw error;
  return data || [];
}

async function buscarArticulosPorTexto(texto) {
  const limpio = String(texto || "").trim();
  if (!limpio) return [];
  // Código Lojo exacto primero.
  const { data: porLojo, error: errorLojo } = await supabase
    .from("articulos")
    .select(CAMPOS_ARTICULO)
    .eq("codigo_lojo", limpio)
    .limit(5);
  if (errorLojo) throw errorLojo;
  const palabras = limpio.split(/\s+/).filter(Boolean).slice(0, 4);
  let consulta = supabase.from("articulos").select(CAMPOS_ARTICULO);
  palabras.forEach((p) => {
    consulta = consulta.ilike("nombre", `%${p.replace(/[%_,()]/g, "")}%`);
  });
  const { data: porNombre, error } = await consulta.order("nombre").limit(30);
  if (error) throw error;
  const vistos = new Set();
  return [...(porLojo || []), ...(porNombre || [])].filter((a) => {
    if (vistos.has(a.id)) return false;
    vistos.add(a.id);
    return true;
  });
}

// soloTrabajador: enlace de los trabajadores (?admin&modo=inventario). Pueden contar y
// ver el resumen, pero no crear, cerrar ni borrar inventarios.
export default function Inventario({ soloTrabajador = false }) {
  const [disponible, setDisponible] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [inventarios, setInventarios] = useState([]);
  const [actual, setActual] = useState(null);
  const [pestana, setPestana] = useState("contar");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [error, setError] = useState("");

  const cargarInventarios = useCallback(async () => {
    setCargando(true);
    const { data, error: errorCarga } = await supabase
      .from("inventarios")
      .select("id, nombre, estado, creado_en, cerrado_en")
      .order("creado_en", { ascending: false });
    setCargando(false);
    if (errorCarga) {
      console.warn("Inventario no disponible:", errorCarga.message);
      setDisponible(false);
      return;
    }
    setDisponible(true);
    setInventarios(data || []);
    setActual((anterior) => (anterior ? (data || []).find((i) => i.id === anterior.id) || null : null));
  }, []);

  useEffect(() => {
    cargarInventarios();
  }, [cargarInventarios]);

  async function crearInventario() {
    const nombre =
      nombreNuevo.trim() ||
      `Inventario ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}`;
    setError("");
    const { data, error: errorCrear } = await supabase
      .from("inventarios")
      .insert({ nombre })
      .select("id, nombre, estado, creado_en, cerrado_en")
      .single();
    if (errorCrear) {
      setError(`No se pudo crear el inventario: ${errorCrear.message}`);
      return;
    }
    setNombreNuevo("");
    await cargarInventarios();
    setActual(data);
    setPestana("contar");
  }

  async function cambiarEstado(inventario, estado) {
    if (
      estado === "cerrado" &&
      !window.confirm(`¿Cerrar "${inventario.nombre}"? Ya no se podrá contar (se puede volver a abrir).`)
    )
      return;
    const { error: errorEstado } = await supabase
      .from("inventarios")
      .update({ estado, cerrado_en: estado === "cerrado" ? new Date().toISOString() : null })
      .eq("id", inventario.id);
    if (errorEstado) {
      window.alert(`No se pudo cambiar: ${errorEstado.message}`);
      return;
    }
    cargarInventarios();
  }

  async function borrarInventario(inventario) {
    const respuesta = window.prompt(
      `Se borrará "${inventario.nombre}" con TODO lo contado. No se puede deshacer.\n\nEscribe BORRAR para confirmar:`
    );
    if (String(respuesta || "").trim().toUpperCase() !== "BORRAR") return;
    const { error: errorBorrar } = await supabase.from("inventarios").delete().eq("id", inventario.id);
    if (errorBorrar) {
      window.alert(`No se pudo borrar: ${errorBorrar.message}`);
      return;
    }
    if (actual?.id === inventario.id) setActual(null);
    cargarInventarios();
  }

  if (!disponible) {
    return (
      <div style={pagina}>
        <h1 style={titulo}>📋 Inventario</h1>
        <div style={cajaAviso}>
          Para usar el inventario, ejecuta antes <b>supabase/migracion_inventario.sql</b> en Supabase → SQL Editor y
          vuelve a entrar.
        </div>
      </div>
    );
  }

  if (actual) {
    return (
      <div style={pagina}>
        <div style={cabeceraDetalle}>
          <button type="button" style={botonVolver} onClick={() => setActual(null)}>
            ← Inventarios
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ ...titulo, fontSize: "22px" }}>{actual.nombre}</h1>
            <div style={subtitulo}>
              Creado el {formatoFecha(actual.creado_en)} ·{" "}
              {actual.estado === "abierto" ? (
                <span style={etiquetaAbierto}>Abierto</span>
              ) : (
                <span style={etiquetaCerrado}>Cerrado</span>
              )}
            </div>
          </div>
        </div>

        <div style={pestanas}>
          <button type="button" style={botonPestana(pestana === "contar")} onClick={() => setPestana("contar")}>
            📷 Contar
          </button>
          <button type="button" style={botonPestana(pestana === "resumen")} onClick={() => setPestana("resumen")}>
            📊 Resumen
          </button>
        </div>

        {pestana === "contar" ? (
          actual.estado === "abierto" ? (
            <Contar inventario={actual} />
          ) : (
            <div style={cajaAviso}>
              Este inventario está cerrado. Para seguir contando, ábrelo de nuevo desde la lista de inventarios.
            </div>
          )
        ) : (
          <Resumen inventario={actual} />
        )}
      </div>
    );
  }

  return (
    <div style={pagina}>
      <div>
        <h1 style={titulo}>📋 Inventario</h1>
        <p style={subtitulo}>
          Lee los códigos de barras con la cámara del móvil y escribe las unidades. Solo para el personal de Cash Lojo.
        </p>
      </div>

      {!soloTrabajador && <ClaveTrabajadores />}

      {!soloTrabajador && (
      <section style={tarjeta}>
        <h2 style={tituloSeccion}>Nuevo inventario</h2>
        <div style={filaFormulario}>
          <input
            type="text"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && crearInventario()}
            placeholder={`Inventario ${new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" })}`}
            style={{ ...campoTexto, flex: 1 }}
          />
          <button type="button" style={botonVerde} onClick={crearInventario}>
            + Crear
          </button>
        </div>
        {error && <div style={cajaError}>{error}</div>}
      </section>
      )}

      <section style={tarjeta}>
        <h2 style={tituloSeccion}>{soloTrabajador ? "Elige el inventario" : "Inventarios"}</h2>
        {cargando ? (
          <div style={vacio}>Cargando…</div>
        ) : (soloTrabajador ? inventarios.filter((i) => i.estado === "abierto") : inventarios).length === 0 ? (
          <div style={vacio}>
            {soloTrabajador
              ? "No hay ningún inventario abierto. Pide al encargado que lo cree."
              : "Todavía no hay ningún inventario."}
          </div>
        ) : (
          <div style={listaInventarios}>
            {(soloTrabajador ? inventarios.filter((i) => i.estado === "abierto") : inventarios).map((inv) => (
              <div key={inv.id} style={filaInventario}>
                <button
                  type="button"
                  style={botonAbrirInventario}
                  onClick={() => {
                    setActual(inv);
                    setPestana(inv.estado === "abierto" ? "contar" : "resumen");
                  }}
                >
                  <span style={{ fontWeight: 950, fontSize: "16px" }}>{inv.nombre}</span>
                  <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 700 }}>
                    {formatoFecha(inv.creado_en)} ·{" "}
                    {inv.estado === "abierto" ? (
                      <span style={etiquetaAbierto}>Abierto</span>
                    ) : (
                      <span style={etiquetaCerrado}>Cerrado {formatoFecha(inv.cerrado_en)}</span>
                    )}
                  </span>
                </button>
                {!soloTrabajador && (
                <div style={accionesInventario}>
                  {inv.estado === "abierto" ? (
                    <button type="button" style={botonBlancoPeq} onClick={() => cambiarEstado(inv, "cerrado")}>
                      🔒 Cerrar
                    </button>
                  ) : (
                    <button type="button" style={botonBlancoPeq} onClick={() => cambiarEstado(inv, "abierto")}>
                      🔓 Abrir
                    </button>
                  )}
                  <button type="button" style={botonRojoPeq} onClick={() => borrarInventario(inv)} title="Borrar">
                    🗑️
                  </button>
                </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------
// CONTAR
// ---------------------------------------------------------------------
function Contar({ inventario }) {
  const [quien, setQuien] = useState(() => leerLocal(CLAVE_QUIEN));
  const [ubicacion, setUbicacion] = useState(() => leerLocal(CLAVE_UBICACION));
  const [ubicaciones, setUbicaciones] = useState([]);
  // nada | camara | buscando | cantidad | elegir | noEncontrado
  const [modo, setModo] = useState("nada");
  // La cámara se queda encendida mientras se escribe la cantidad.
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  // sumar | restar (para corregir un error)
  const [operacion, setOperacion] = useState("sumar");
  const [codigoLeido, setCodigoLeido] = useState("");
  const [articulo, setArticulo] = useState(null);
  const [opciones, setOpciones] = useState([]);
  const [yaContado, setYaContado] = useState({ total: 0, detalle: [] });
  const [cantidad, setCantidad] = useState("");
  const [guardarCodigo, setGuardarCodigo] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ultimas, setUltimas] = useState([]);
  const [textoManual, setTextoManual] = useState("");
  const [error, setError] = useState("");
  const desdeCamaraRef = useRef(false);
  // Último código contado o cancelado: al volver a la cámara se ignora un
  // momento, para que no vuelva a abrir el mismo artículo.
  const [codigoAnterior, setCodigoAnterior] = useState("");

  useEffect(() => {
    supabase
      .from("ubicaciones")
      .select("id, codigo, nombre")
      .then(({ data }) => {
        const lista = (data || []).slice().sort((a, b) =>
          String(a.codigo).localeCompare(String(b.codigo), "es", { numeric: true })
        );
        setUbicaciones(lista);
      });
  }, []);

  useEffect(() => guardarLocal(CLAVE_QUIEN, quien), [quien]);
  useEffect(() => guardarLocal(CLAVE_UBICACION, ubicacion), [ubicacion]);

  async function cargarYaContado(articuloId) {
    const { data } = await supabase
      .from("inventario_lineas")
      .select("cantidad, ubicacion")
      .eq("inventario_id", inventario.id)
      .eq("articulo_id", articuloId);
    const porUbicacion = new Map();
    let total = 0;
    (data || []).forEach((l) => {
      total += l.cantidad;
      const clave = l.ubicacion || "Sin ubicación";
      porUbicacion.set(clave, (porUbicacion.get(clave) || 0) + l.cantidad);
    });
    setYaContado({ total, detalle: [...porUbicacion.entries()] });
  }

  async function elegirArticulo(art, codigoPendiente = "") {
    setArticulo(art);
    setOpciones([]);
    setCantidad("");
    setOperacion("sumar");
    setError("");
    const tieneCodigo = codigoPendiente && variantesCodigo(codigoPendiente).some((v) => (art.eans || []).includes(v));
    setGuardarCodigo(Boolean(codigoPendiente) && !tieneCodigo);
    setYaContado({ total: 0, detalle: [] });
    setModo("cantidad");
    cargarYaContado(art.id);
  }

  async function alLeerCodigo(codigo) {
    desdeCamaraRef.current = true;
    setCodigoLeido(codigo);
    setError("");
    setModo("buscando");
    try {
      const encontrados = await buscarArticulosPorCodigo(codigo);
      if (encontrados.length === 1) {
        elegirArticulo(encontrados[0]);
      } else if (encontrados.length > 1) {
        setOpciones(encontrados);
        setModo("elegir");
      } else {
        setTextoManual("");
        setOpciones([]);
        setModo("noEncontrado");
      }
    } catch (e) {
      setError(`No se pudo buscar: ${e.message}`);
      setModo("nada");
    }
  }

  async function buscarManual() {
    const texto = textoManual.trim();
    if (!texto) return;
    setError("");
    try {
      // Si parece un código de barras, se busca primero como tal.
      const pareceCodigo = /^\d{6,}$/.test(normalizarEan(texto));
      let encontrados = pareceCodigo ? await buscarArticulosPorCodigo(texto) : [];
      if (modo !== "noEncontrado") setCodigoLeido(pareceCodigo && encontrados.length ? normalizarEan(texto) : "");
      if (!encontrados.length) encontrados = await buscarArticulosPorTexto(texto);
      if (encontrados.length === 1 && modo !== "noEncontrado") {
        desdeCamaraRef.current = false;
        elegirArticulo(encontrados[0]);
      } else {
        setOpciones(encontrados);
        if (!encontrados.length) setError("No se ha encontrado ningún artículo.");
      }
    } catch (e) {
      setError(`No se pudo buscar: ${e.message}`);
    }
  }

  function abrirCamara() {
    setCodigoAnterior("");
    setError("");
    setOpciones([]);
    setCamaraAbierta(true);
    setModo("camara");
  }

  function cerrarCamara() {
    desdeCamaraRef.current = false;
    setCamaraAbierta(false);
    setModo("nada");
  }

  function cancelar() {
    setCodigoAnterior(codigoLeido);
    setArticulo(null);
    setOpciones([]);
    // Si veníamos de la cámara, se vuelve a la cámara.
    setModo(desdeCamaraRef.current ? "camara" : "nada");
  }

  function pulsarTecla(tecla) {
    setError("");
    if (tecla === "C") return setCantidad("");
    if (tecla === "⌫") return setCantidad((actual) => formatearEntrada(String(actual).replace(/\D/g, "").slice(0, -1)));
    setCantidad((actual) => formatearEntrada(`${actual}${tecla}`));
  }

  // En el ordenador también se puede escribir con el teclado normal.
  useEffect(() => {
    if (modo !== "cantidad") return undefined;
    const alPulsar = (e) => {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        pulsarTecla(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        pulsarTecla("⌫");
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!guardando && cantidad) guardarCantidad();
      } else if (e.key === "Escape") {
        cancelar();
      } else if (e.key === "-" && yaContado.total > 0) {
        setOperacion((o) => (o === "restar" ? "sumar" : "restar"));
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  });

  async function guardarCantidad() {
    const unidades = leerEntrada(cantidad);
    if (!Number.isInteger(unidades) || unidades <= 0) {
      setError("Escribe las unidades.");
      return;
    }
    if (operacion === "restar" && unidades > yaContado.total) {
      setError(`No se pueden restar ${formatoUnidades(unidades)}: solo hay ${formatoUnidades(yaContado.total)} uds contadas.`);
      return;
    }
    const movimiento = operacion === "restar" ? -unidades : unidades;
    setGuardando(true);
    setError("");
    const { error: errorGuardar } = await supabase.from("inventario_lineas").insert({
      inventario_id: inventario.id,
      articulo_id: articulo.id,
      cantidad: movimiento,
      ubicacion: ubicacion || null,
      ean: codigoLeido || null,
      contado_por: quien.trim() || null,
    });
    if (errorGuardar) {
      setGuardando(false);
      setError(`No se pudo guardar: ${errorGuardar.message}`);
      return;
    }

    // Guardar en el artículo el código leído que no tenía.
    if (guardarCodigo && codigoLeido) {
      const eans = [...new Set([...(articulo.eans || []), normalizarEan(codigoLeido)])];
      const { error: errorEan } = await supabase.from("articulos").update({ eans }).eq("id", articulo.id);
      if (errorEan) console.warn("No se pudo guardar el EAN en el artículo:", errorEan.message);
    }

    const total = yaContado.total + movimiento;
    const texto = `${movimiento < 0 ? "➖" : "✓"} ${movimiento < 0 ? "" : "+"}${formatoUnidades(movimiento)} uds · ${articulo.nombre} (total ${formatoUnidades(total)})`;
    setAviso(texto);
    setUltimas((lista) =>
      [{ id: Date.now(), texto, ubicacion, hora: new Date().toISOString() }, ...lista].slice(0, 15)
    );
    setGuardando(false);
    setCodigoAnterior(codigoLeido);
    setArticulo(null);
    setCodigoLeido("");
    setModo(desdeCamaraRef.current ? "camara" : "nada");
  }

  return (
    <>
      <section style={tarjeta}>
        <div style={gridDos}>
          <label style={campo}>
            <span style={etiqueta}>¿Quién cuenta?</span>
            <input
              type="text"
              value={quien}
              onChange={(e) => setQuien(e.target.value)}
              placeholder="Tu nombre"
              style={campoTexto}
            />
          </label>
          <label style={campo}>
            <span style={etiqueta}>Ubicación que estás contando</span>
            <select value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} style={campoTexto}>
              <option value="">Sin ubicación</option>
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.codigo}>
                  {u.codigo} — {u.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button type="button" style={botonEscanear} onClick={abrirCamara}>
          📷 Escanear artículo
        </button>

        <div style={filaFormulario}>
          <input
            type="text"
            value={modo === "noEncontrado" ? "" : textoManual}
            onChange={(e) => setTextoManual(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscarManual()}
            placeholder="O escribe código de barras, código Lojo o nombre"
            style={{ ...campoTexto, flex: 1 }}
          />
          <button type="button" style={botonAzul} onClick={buscarManual}>
            Buscar
          </button>
        </div>

        {error && modo === "nada" && <div style={cajaError}>{error}</div>}

        {modo === "nada" && opciones.length > 0 && (
          <ListaOpciones opciones={opciones} onElegir={(a) => elegirArticulo(a)} />
        )}
      </section>

      <section style={tarjeta}>
        <h2 style={tituloSeccion}>Últimas lecturas (este móvil)</h2>
        {ultimas.length === 0 ? (
          <div style={vacio}>Todavía no has contado nada. El total de todos está en “Resumen”.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {ultimas.map((u) => (
              <div key={u.id} style={filaUltima}>
                <span>{u.texto}</span>
                <span style={{ color: "#64748b", fontSize: "12px", whiteSpace: "nowrap" }}>
                  {u.ubicacion ? `📍 ${u.ubicacion} · ` : ""}
                  {new Date(u.hora).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {camaraAbierta && (
        <LectorCamara
          titulo={`Inventario${ubicacion ? ` · 📍 ${ubicacion}` : ""}`}
          aviso={aviso}
          ignorarCodigo={codigoAnterior}
          activo={modo === "camara"}
          onLeido={alLeerCodigo}
          onCerrar={cerrarCamara}
        >
          <button type="button" style={botonPieCamara} onClick={cerrarCamara}>
            ⌨️ No tiene código: buscar a mano
          </button>
        </LectorCamara>
      )}

      {["buscando", "cantidad", "elegir", "noEncontrado"].includes(modo) &&
        createPortal(
          <div style={fondoModal}>
            <div style={ventanaModal}>
              {modo === "buscando" && <div style={vacio}>Buscando {codigoLeido}…</div>}

              {modo === "elegir" && (
                <>
                  <h3 style={tituloSeccion}>Hay varios artículos con el código {codigoLeido}. ¿Cuál es?</h3>
                  <ListaOpciones opciones={opciones} onElegir={(a) => elegirArticulo(a)} />
                  <button type="button" style={botonBlanco} onClick={cancelar}>
                    Cancelar
                  </button>
                </>
              )}

              {modo === "noEncontrado" && (
                <>
                  <h3 style={tituloSeccion}>Ningún artículo tiene el código {codigoLeido}</h3>
                  <p style={{ margin: 0, color: "#475569", fontWeight: 700, fontSize: "14px" }}>
                    Búscalo por nombre o código Lojo. Al elegirlo se le guarda este código para la próxima vez.
                  </p>
                  <div style={filaFormulario}>
                    <input
                      type="text"
                      value={textoManual}
                      onChange={(e) => setTextoManual(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && buscarManual()}
                      placeholder="Nombre o código Lojo"
                      style={{ ...campoTexto, flex: 1 }}
                      autoFocus
                    />
                    <button type="button" style={botonAzul} onClick={buscarManual}>
                      Buscar
                    </button>
                  </div>
                  {error && <div style={cajaError}>{error}</div>}
                  {opciones.length > 0 && (
                    <ListaOpciones opciones={opciones} onElegir={(a) => elegirArticulo(a, codigoLeido)} />
                  )}
                  <button type="button" style={botonBlanco} onClick={cancelar}>
                    {desdeCamaraRef.current ? "Volver a la cámara" : "Cancelar"}
                  </button>
                </>
              )}

              {modo === "cantidad" && articulo && (
                <>
                  <div style={fichaArticulo}>
                    <div style={marcoFoto}>
                      {articulo.foto ? (
                        <img src={urlFoto(articulo.foto)} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      ) : (
                        <span style={{ fontSize: "28px", opacity: 0.5 }}>📦</span>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "18px", fontWeight: 950, color: "#0f172a", lineHeight: 1.2 }}>
                        {articulo.nombre}
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#64748b", marginTop: "4px" }}>
                        Lojo {articulo.codigo_lojo || "—"}
                        {codigoLeido ? ` · ${codigoLeido}` : ""}
                      </div>
                      {(articulo.activo === false || articulo.oculto) && (
                        <div style={{ fontSize: "12px", fontWeight: 800, color: "#b45309", marginTop: "4px" }}>
                          {articulo.activo === false ? "Desactivado" : "Oculto"} en la app de clientes
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={cajaYaContado}>
                    {yaContado.total !== 0 || yaContado.detalle.length ? (
                      <>
                        Ya contado: <b>{formatoUnidades(yaContado.total)} uds</b>
                        <div style={{ fontSize: "12px", marginTop: "2px" }}>
                          {yaContado.detalle.map(([u, c]) => `${u}: ${formatoUnidades(c)}`).join(" · ")}
                        </div>
                      </>
                    ) : (
                      "Todavía no se ha contado en este inventario."
                    )}
                  </div>


                  <div style={campo}>
                    <span style={filaEtiquetaCantidad}>
                      <span style={etiqueta}>
                        {operacion === "restar" ? "Unidades a RESTAR" : "Unidades"} {ubicacion ? `en 📍 ${ubicacion}` : ""}
                        {operacion === "sumar" && yaContado.total > 0 ? " (se suman)" : ""}
                      </span>
                      {/* Por defecto se suma. "Restar" pone el número en negativo y en rojo. */}
                      {yaContado.total > 0 && (
                        <button
                          type="button"
                          style={botonRestar(operacion === "restar")}
                          onClick={(e) => {
                            e.preventDefault();
                            setOperacion((o) => (o === "restar" ? "sumar" : "restar"));
                            setError("");
                          }}
                        >
                          ➖ Restar
                        </button>
                      )}
                    </span>
                    {/* Pantalla de la cantidad + teclado numérico propio: se escribe
                        directamente, sin tocar ninguna casilla ni abrir el teclado del móvil. */}
                    <div
                      style={{
                        ...campoCantidad,
                        ...(operacion === "restar" ? { border: "2px solid #dc2626", color: "#dc2626", background: "#fef2f2" } : null),
                        ...(cantidad ? null : { color: "#cbd5e1" }),
                      }}
                      aria-live="polite"
                    >
                      {cantidad ? (operacion === "restar" ? `-${cantidad}` : cantidad) : "0"}
                    </div>
                  </div>

                  <div style={tecladoNumerico}>
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((tecla) => (
                      <button
                        key={tecla}
                        type="button"
                        style={tecla === "C" || tecla === "⌫" ? teclaEspecial : tecla === "0" ? teclaCero : teclaNumero}
                        onClick={() => pulsarTecla(tecla)}
                      >
                        {tecla}
                      </button>
                    ))}
                  </div>

                  {codigoLeido && guardarCodigo !== null && !variantesCodigo(codigoLeido).some((v) => (articulo.eans || []).includes(v)) && (
                    <label style={casilla}>
                      <input
                        type="checkbox"
                        checked={guardarCodigo}
                        onChange={(e) => setGuardarCodigo(e.target.checked)}
                      />
                      Guardar el código {codigoLeido} en este artículo
                    </label>
                  )}

                  {error && <div style={cajaError}>{error}</div>}

                  <div style={filaBotonesModal}>
                    <button type="button" style={botonBlanco} onClick={cancelar}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      style={{
                        ...botonVerde,
                        ...(operacion === "restar" ? { background: "#dc2626" } : null),
                        flex: 1,
                        opacity: cantidad === "" || guardando ? 0.6 : 1,
                      }}
                      onClick={guardarCantidad}
                      disabled={cantidad === "" || guardando}
                    >
                      {guardando ? "Guardando…" : operacion === "restar" ? "Restar" : "Guardar"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function ListaOpciones({ opciones, onElegir }) {
  return (
    <div style={listaOpciones}>
      {opciones.map((a) => (
        <button key={a.id} type="button" style={opcion} onClick={() => onElegir(a)}>
          <div style={{ ...marcoFoto, width: "48px", height: "48px" }}>
            {a.foto ? (
              <img src={urlFoto(a.foto)} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <span style={{ opacity: 0.5 }}>📦</span>
            )}
          </div>
          <div style={{ minWidth: 0, textAlign: "left" }}>
            <div style={{ fontWeight: 900, color: "#0f172a" }}>{a.nombre}</div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>
              Lojo {a.codigo_lojo || "—"}
              {a.activo === false ? " · Desactivado" : a.oculto ? " · Oculto" : ""}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// RESUMEN
// ---------------------------------------------------------------------
function Resumen({ inventario }) {
  const [lineas, setLineas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(null);
  const [verSinContar, setVerSinContar] = useState(false);
  const [sinContar, setSinContar] = useState(null);
  const [actualizado, setActualizado] = useState(null);
  const editandoRef = useRef(false);

  const cargar = useCallback(async () => {
    try {
      const filas = await cargarTodo(() =>
        supabase
          .from("inventario_lineas")
          .select("id, articulo_id, cantidad, ubicacion, ean, contado_por, creado_en, articulos(codigo_lojo, nombre)")
          .eq("inventario_id", inventario.id)
          .order("id", { ascending: true })
      );
      setLineas(filas);
      setError("");
      setActualizado(new Date());
    } catch (e) {
      setError(`No se pudo cargar: ${e.message}`);
    } finally {
      setCargando(false);
    }
  }, [inventario.id]);

  useEffect(() => {
    cargar();
    // Se actualiza solo, para ver lo que cuentan los demás.
    const t = setInterval(() => {
      if (!editandoRef.current) cargar();
    }, REFRESCO_RESUMEN_MS);
    return () => clearInterval(t);
  }, [cargar]);

  const articulos = useMemo(() => {
    const mapa = new Map();
    lineas.forEach((l) => {
      const clave = l.articulo_id;
      if (!mapa.has(clave)) {
        mapa.set(clave, {
          articuloId: clave,
          codigoLojo: l.articulos?.codigo_lojo || "",
          nombre: l.articulos?.nombre || "(artículo borrado)",
          total: 0,
          porUbicacion: new Map(),
          lineas: [],
        });
      }
      const a = mapa.get(clave);
      a.total += l.cantidad;
      const u = l.ubicacion || "Sin ubicación";
      a.porUbicacion.set(u, (a.porUbicacion.get(u) || 0) + l.cantidad);
      a.lineas.push(l);
    });
    return [...mapa.values()].sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));
  }, [lineas]);

  const filtrados = useMemo(() => {
    const palabras = sinTildes(busqueda).split(/\s+/).filter(Boolean);
    if (!palabras.length) return articulos;
    return articulos.filter((a) => {
      const texto = sinTildes(`${a.codigoLojo} ${a.nombre}`);
      return palabras.every((p) => texto.includes(p));
    });
  }, [articulos, busqueda]);

  const totalUnidades = articulos.reduce((s, a) => s + a.total, 0);

  async function cargarSinContar() {
    setVerSinContar(true);
    if (sinContar) return;
    try {
      const todos = await cargarTodo(() =>
        supabase.from("articulos").select("id, codigo_lojo, nombre").eq("activo", true).order("nombre")
      );
      setSinContar(todos);
    } catch (e) {
      setError(`No se pudo cargar los artículos: ${e.message}`);
    }
  }

  const listaSinContar = useMemo(() => {
    if (!sinContar) return [];
    const contados = new Set(articulos.map((a) => String(a.articuloId)));
    const palabras = sinTildes(busqueda).split(/\s+/).filter(Boolean);
    return sinContar.filter((a) => {
      if (contados.has(String(a.id))) return false;
      if (!palabras.length) return true;
      const texto = sinTildes(`${a.codigo_lojo || ""} ${a.nombre}`);
      return palabras.every((p) => texto.includes(p));
    });
  }, [sinContar, articulos, busqueda]);

  async function cambiarLinea(linea, nuevaCantidad) {
    const unidades = Number(String(nuevaCantidad).replace(/\./g, ""));
    if (!Number.isInteger(unidades) || unidades === 0) {
      window.alert("Escribe un número entero de unidades (para quitar la lectura, bórrala con 🗑️).");
      return false;
    }
    const { error: errorCambio } = await supabase
      .from("inventario_lineas")
      .update({ cantidad: unidades })
      .eq("id", linea.id);
    if (errorCambio) {
      window.alert(`No se pudo cambiar: ${errorCambio.message}`);
      return false;
    }
    await cargar();
    return true;
  }

  async function borrarLinea(linea) {
    if (!window.confirm(`¿Borrar esta lectura de ${linea.cantidad} uds?`)) return;
    const { error: errorBorrar } = await supabase.from("inventario_lineas").delete().eq("id", linea.id);
    if (errorBorrar) {
      window.alert(`No se pudo borrar: ${errorBorrar.message}`);
      return;
    }
    cargar();
  }

  function nombreArchivo(ext) {
    const base = sinTildes(inventario.nombre).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "inventario";
    return `${base}.${ext}`;
  }

  function exportarCsv() {
    const celda = (v) => {
      const t = String(v ?? "");
      return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const filas = [["Cod. Art.", "Descr. Art.", "Cantidad"]];
    articulos.forEach((a) => filas.push([a.codigoLojo, a.nombre, a.total]));
    const texto = "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n") + "\r\n";
    const blob = new Blob([texto], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreArchivo("csv");
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function imprimir() {
    const esc = (t) =>
      String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const filasHtml = articulos
      .map(
        (a) => `<tr>
          <td>${esc(a.codigoLojo)}</td>
          <td>${esc(a.nombre)}</td>
          <td class="ub">${esc([...a.porUbicacion.entries()].map(([u, c]) => `${u}: ${formatoUnidades(c)}`).join(" · "))}</td>
          <td class="num">${formatoUnidades(a.total)}</td>
        </tr>`
      )
      .join("");
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(inventario.nombre)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        p { margin: 0 0 14px; color: #444; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border-bottom: 1px solid #ccc; padding: 5px 6px; text-align: left; vertical-align: top; }
        th { background: #eee; }
        td.num, th.num { text-align: right; font-weight: bold; white-space: nowrap; }
        td.ub { color: #555; font-size: 11px; }
        tfoot td { font-weight: bold; border-top: 2px solid #111; }
        @media print { body { margin: 10mm; } }
      </style></head><body>
      <h1>${esc(inventario.nombre)}</h1>
      <p>Cash Lojo · Impreso el ${esc(formatoFecha(new Date().toISOString(), true))} · ${articulos.length} artículos · ${formatoUnidades(totalUnidades)} unidades</p>
      <table>
        <thead><tr><th>Cód. Lojo</th><th>Artículo</th><th>Ubicaciones</th><th class="num">Unidades</th></tr></thead>
        <tbody>${filasHtml}</tbody>
        <tfoot><tr><td colspan="3">TOTAL</td><td class="num">${formatoUnidades(totalUnidades)}</td></tr></tfoot>
      </table>
      <script>window.onload = function () { window.print(); };<\/script>
      </body></html>`;
    const ventana = window.open("", "_blank");
    if (!ventana) {
      window.alert("El navegador ha bloqueado la ventana de impresión. Permite las ventanas emergentes para esta página.");
      return;
    }
    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
  }

  return (
    <>
      <section style={tarjeta}>
        <div style={cifras}>
          <Cifra numero={articulos.length} texto="artículos contados" />
          <Cifra numero={formatoUnidades(totalUnidades)} texto="unidades" />
          <Cifra numero={lineas.length} texto="lecturas" />
        </div>
        <div style={filaFormulario}>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="🔎 Buscar en el inventario: nombre o código Lojo"
            style={{ ...campoTexto, flex: "1 1 240px" }}
          />
          <button type="button" style={botonBlanco} onClick={cargar}>
            ⟳ Actualizar
          </button>
          <button type="button" style={botonAzul} onClick={exportarCsv} disabled={!articulos.length}>
            ⬇️ Exportar CSV
          </button>
          <button type="button" style={botonAzul} onClick={imprimir} disabled={!articulos.length}>
            🖨️ Imprimir
          </button>
        </div>
        <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 700 }}>
          Se actualiza solo cada 15 segundos
          {actualizado ? ` · última vez ${actualizado.toLocaleTimeString("es-ES")}` : ""}
        </div>
        {error && <div style={cajaError}>{error}</div>}
      </section>

      <div style={pestanas}>
        <button type="button" style={botonPestana(!verSinContar)} onClick={() => setVerSinContar(false)}>
          ✅ Contados ({articulos.length})
        </button>
        <button type="button" style={botonPestana(verSinContar)} onClick={cargarSinContar}>
          ⚠️ Sin contar{sinContar ? ` (${listaSinContar.length})` : ""}
        </button>
      </div>

      {!verSinContar ? (
        <section style={tablaContenedor}>
          {cargando ? (
            <div style={vacio}>Cargando…</div>
          ) : filtrados.length === 0 ? (
            <div style={vacio}>{articulos.length ? "Nada con esa búsqueda." : "Todavía no se ha contado nada."}</div>
          ) : (
            <table style={tabla}>
              <thead>
                <tr>
                  <th style={{ ...th, width: "80px" }}>Lojo</th>
                  <th style={th}>Artículo · ubicaciones</th>
                  <th style={{ ...th, textAlign: "right", width: "90px" }}>Uds.</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((a) => (
                  <FilaResumen
                    key={a.articuloId}
                    articulo={a}
                    abierto={abierto === a.articuloId}
                    onAbrir={() => setAbierto(abierto === a.articuloId ? null : a.articuloId)}
                    onCambiar={cambiarLinea}
                    onBorrar={borrarLinea}
                    editandoRef={editandoRef}
                  />
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : (
        <section style={tablaContenedor}>
          {!sinContar ? (
            <div style={vacio}>Cargando artículos…</div>
          ) : listaSinContar.length === 0 ? (
            <div style={vacio}>Todos los artículos activos están contados. 🎉</div>
          ) : (
            <table style={tabla}>
              <thead>
                <tr>
                  <th style={th}>Cód. Lojo</th>
                  <th style={th}>Artículo activo sin contar</th>
                </tr>
              </thead>
              <tbody>
                {listaSinContar.slice(0, 500).map((a) => (
                  <tr key={a.id}>
                    <td style={td}>{a.codigo_lojo || "—"}</td>
                    <td style={td}>{a.nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {listaSinContar.length > 500 && (
            <div style={vacio}>…y {listaSinContar.length - 500} más. Usa el buscador para encontrar uno.</div>
          )}
        </section>
      )}
    </>
  );
}

function FilaResumen({ articulo, abierto, onAbrir, onCambiar, onBorrar, editandoRef }) {
  const [editando, setEditando] = useState(null);
  const [valor, setValor] = useState("");

  return (
    <>
      <tr style={{ cursor: "pointer", background: abierto ? "#eef2ff" : "#fff" }} onClick={onAbrir}>
        <td style={td}>{articulo.codigoLojo || "—"}</td>
        <td style={td}>
          <div style={{ fontWeight: 800 }}>
            {abierto ? "▾ " : "▸ "}
            {articulo.nombre}
          </div>
          <div style={{ fontSize: "12px", color: "#475569", fontWeight: 700, marginTop: "2px" }}>
            📍 {[...articulo.porUbicacion.entries()].map(([u, c]) => `${u}: ${formatoUnidades(c)}`).join(" · ")}
          </div>
        </td>
        <td style={{ ...td, textAlign: "right", fontWeight: 950, fontSize: "16px" }}>{formatoUnidades(articulo.total)}</td>
      </tr>
      {abierto &&
        articulo.lineas.map((l) => (
          <tr key={l.id} style={{ background: "#f8fafc" }}>
            <td style={{ ...td, fontSize: "12px", color: "#64748b" }} colSpan={2}>
              <b style={{ color: "#334155" }}>{l.ubicacion ? `📍 ${l.ubicacion}` : "Sin ubicación"}</b>
              {" · "}
              {formatoFecha(l.creado_en, true)}
              {l.contado_por ? ` · ${l.contado_por}` : ""}
              {l.ean ? ` · ${l.ean}` : ""}
            </td>
            <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
              {editando === l.id ? (
                <span style={{ display: "inline-flex", gap: "4px" }}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    style={{ ...campoTexto, width: "80px", padding: "6px 8px" }}
                    autoFocus
                  />
                  <button
                    type="button"
                    style={botonVerdePeq}
                    onClick={async () => {
                      if (await onCambiar(l, valor)) {
                        setEditando(null);
                        editandoRef.current = false;
                      }
                    }}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    style={botonBlancoPeq}
                    onClick={() => {
                      setEditando(null);
                      editandoRef.current = false;
                    }}
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <span style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                  <b style={{ color: l.cantidad < 0 ? "#dc2626" : undefined }}>{formatoUnidades(l.cantidad)}</b>
                  <button
                    type="button"
                    style={botonBlancoPeq}
                    onClick={() => {
                      setEditando(l.id);
                      setValor(String(l.cantidad));
                      editandoRef.current = true;
                    }}
                    title="Corregir"
                  >
                    ✏️
                  </button>
                  <button type="button" style={botonRojoPeq} onClick={() => onBorrar(l)} title="Borrar lectura">
                    🗑️
                  </button>
                </span>
              )}
            </td>
          </tr>
        ))}
    </>
  );
}

function Cifra({ numero, texto }) {
  return (
    <div style={cifra}>
      <div style={{ fontSize: "24px", fontWeight: 950, color: "#0f172a" }}>{numero}</div>
      <div style={{ fontSize: "12px", fontWeight: 800, color: "#64748b" }}>{texto}</div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------
const pagina = { display: "flex", flexDirection: "column", gap: "14px", paddingBottom: "40px" };
const titulo = { margin: 0, fontSize: "26px", fontWeight: 950, color: "#0f172a" };
const subtitulo = { margin: "4px 0 0", fontSize: "14px", fontWeight: 700, color: "#64748b" };
const tarjeta = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "18px",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};
const tituloSeccion = { margin: 0, fontSize: "17px", fontWeight: 950, color: "#0f172a" };
const filaFormulario = { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "stretch" };
const gridDos = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" };
const campo = { display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 };
const etiqueta = { fontSize: "13px", fontWeight: 900, color: "#475569" };
const campoTexto = {
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "12px",
  fontSize: "16px",
  fontWeight: 600,
  background: "#fff",
  color: "#0f172a",
  minWidth: 0,
};
const campoCantidad = {
  ...campoTexto,
  fontSize: "34px",
  fontWeight: 950,
  textAlign: "center",
  padding: "8px 14px",
  border: "2px solid #4f46e5",
  outline: "none",
  minHeight: "58px",
  boxSizing: "border-box",
};
const botonBase = {
  border: "none",
  borderRadius: "14px",
  padding: "12px 18px",
  fontSize: "15px",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const botonVerde = { ...botonBase, background: "#16a34a", color: "#fff" };
const botonAzul = { ...botonBase, background: "#4f46e5", color: "#fff" };
const botonBlanco = { ...botonBase, background: "#fff", color: "#334155", border: "1px solid #cbd5e1" };
const botonEscanear = {
  ...botonBase,
  background: "#16a34a",
  color: "#fff",
  fontSize: "20px",
  padding: "20px",
  boxShadow: "0 12px 24px rgba(22,163,74,0.25)",
};
const botonPeqBase = {
  borderRadius: "10px",
  padding: "6px 10px",
  fontSize: "13px",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const botonBlancoPeq = { ...botonPeqBase, background: "#fff", border: "1px solid #cbd5e1", color: "#334155" };
const botonRojoPeq = { ...botonPeqBase, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" };
const botonVerdePeq = { ...botonPeqBase, background: "#16a34a", border: "none", color: "#fff" };
const botonVolver = { ...botonBlanco, padding: "10px 14px" };
const botonPieCamara = {
  ...botonBase,
  width: "100%",
  background: "rgba(255,255,255,0.16)",
  color: "#fff",
  padding: "14px",
};
const cabeceraDetalle = { display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" };
const pestanas = { display: "flex", gap: "8px", flexWrap: "wrap" };
const botonPestana = (activa) => ({
  ...botonBase,
  flex: "1 1 140px",
  background: activa ? "#4f46e5" : "#fff",
  color: activa ? "#fff" : "#334155",
  border: activa ? "none" : "1px solid #cbd5e1",
});
const etiquetaAbierto = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: "999px",
  padding: "2px 8px",
  fontSize: "12px",
  fontWeight: 900,
};
const etiquetaCerrado = { ...etiquetaAbierto, background: "#e2e8f0", color: "#334155" };
const listaInventarios = { display: "flex", flexDirection: "column", gap: "8px" };
const filaInventario = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "8px 8px 8px 0",
  flexWrap: "wrap",
};
const botonAbrirInventario = {
  flex: "1 1 220px",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "4px",
  border: "none",
  background: "transparent",
  padding: "6px 12px",
  cursor: "pointer",
  textAlign: "left",
  color: "#0f172a",
};
const accionesInventario = { display: "flex", gap: "6px", paddingLeft: "12px" };
const vacio = { padding: "18px", textAlign: "center", color: "#64748b", fontWeight: 700 };
const cajaAviso = {
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#92400e",
  borderRadius: "14px",
  padding: "14px",
  fontWeight: 700,
};
const cajaError = { background: "#fef2f2", color: "#b91c1c", borderRadius: "12px", padding: "10px 12px", fontWeight: 800 };
const filaUltima = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  fontSize: "14px",
  fontWeight: 700,
  color: "#166534",
  background: "#f0fdf4",
  borderRadius: "10px",
  padding: "8px 10px",
};
const fondoModal = {
  position: "fixed",
  inset: 0,
  zIndex: 9500,
  background: "rgba(15,23,42,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
};
const ventanaModal = {
  width: "100%",
  maxWidth: "460px",
  maxHeight: "94vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: "20px",
  padding: "18px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  boxSizing: "border-box",
};
const fichaArticulo = { display: "flex", gap: "12px", alignItems: "center" };
const marcoFoto = {
  width: "84px",
  height: "84px",
  flex: "0 0 auto",
  borderRadius: "12px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};
const cajaYaContado = {
  background: "#eef2ff",
  color: "#3730a3",
  borderRadius: "12px",
  padding: "10px 12px",
  fontSize: "14px",
  fontWeight: 700,
};
const casilla = { display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 800, color: "#334155" };
const filaBotonesModal = { display: "flex", gap: "8px" };
const tecladoNumerico = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" };
const teclaBase = {
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  height: "56px",
  fontSize: "26px",
  fontWeight: 900,
  cursor: "pointer",
  touchAction: "manipulation",
  userSelect: "none",
  WebkitTapHighlightColor: "transparent",
};
const teclaNumero = { ...teclaBase, background: "#f8fafc", color: "#0f172a" };
const teclaCero = teclaNumero;
const teclaEspecial = { ...teclaBase, background: "#e2e8f0", color: "#334155", fontSize: "22px" };
const filaEtiquetaCantidad = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" };
const botonRestar = (activo) => ({
  border: activo ? "2px solid #dc2626" : "1px solid #fecaca",
  background: activo ? "#dc2626" : "#fff",
  color: activo ? "#fff" : "#dc2626",
  borderRadius: "10px",
  padding: "6px 12px",
  fontSize: "14px",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
});
const listaOpciones = { display: "flex", flexDirection: "column", gap: "6px", maxHeight: "50vh", overflowY: "auto" };
const opcion = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  background: "#fff",
  padding: "8px",
  cursor: "pointer",
};
const cifras = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "8px" };
const cifra = { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "10px", textAlign: "center" };
const tablaContenedor = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", overflowX: "auto" };
const tabla = { width: "100%", borderCollapse: "collapse" };
const th = {
  textAlign: "left",
  padding: "10px",
  fontSize: "12px",
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
};
const td = { padding: "9px 10px", borderBottom: "1px solid #f1f5f9", fontSize: "14px", color: "#0f172a", verticalAlign: "middle" };
