// Listados de ubicación (Inventario > Ubicaciones).
//
// En el Admin se crean las ubicaciones (Calle 1, Calle 2, Cámara 1,
// Tienda...). El trabajador elige una y va leyendo con la cámara los
// códigos de barras en el orden en que están colocados: cada artículo
// leído ocupa el siguiente puesto del listado. No se meten unidades.
//   - Se ven los últimos artículos leídos, para saber por dónde se va.
//   - "Insertar" permite meter artículos entre otros (si se pasó alguno).
//   - Un artículo puede estar en varios listados. Si se repite en el mismo,
//     se pregunta si se quiere añadir otra posición (y entonces sale dos veces).
//   - Al leer: ✓ verde grande 2 s si el código existe; ✗ roja y
//     "Código No Existe" si no.
// Son independientes de las Ubicaciones del Admin que ordenan los pedidos.
//
// Tablas: listados_ubicacion y listado_ubicacion_articulos
// (supabase/migracion_inventario.sql).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabaseClient";
import { normalizarEan, variantesCodigo } from "../utils/buscarPorEan";
import LectorCamara from "./LectorCamara";
import {
  CLAVE_QUIEN,
  ListaOpciones,
  buscarArticulosPorCodigo,
  buscarArticulosPorTexto,
  cargarTodo,
  formatoFecha,
  guardarLocal,
  leerLocal,
  urlFoto,
} from "./Inventario";

const REFRESCO_MS = 20000;

function sinTildes(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export default function ListadosUbicacion({ soloTrabajador = false }) {
  const [disponible, setDisponible] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [listados, setListados] = useState([]);
  const [actual, setActual] = useState(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [error, setError] = useState("");

  const cargarListados = useCallback(async () => {
    setCargando(true);
    let { data, error: errorCarga } = await supabase
      .from("listados_ubicacion")
      .select("id, nombre, creado_en, listado_ubicacion_articulos(count)")
      .order("nombre");
    if (errorCarga) {
      // Por si el recuento no está disponible: sin recuento.
      ({ data, error: errorCarga } = await supabase
        .from("listados_ubicacion")
        .select("id, nombre, creado_en")
        .order("nombre"));
    }
    setCargando(false);
    if (errorCarga) {
      console.warn("Listados de ubicación no disponibles:", errorCarga.message);
      setDisponible(false);
      return;
    }
    setDisponible(true);
    const lista = (data || [])
      .map((l) => ({ ...l, total: l.listado_ubicacion_articulos?.[0]?.count ?? null }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
    setListados(lista);
  }, []);

  useEffect(() => {
    cargarListados();
  }, [cargarListados]);

  async function crear() {
    const nombre = nombreNuevo.trim();
    if (!nombre) return setError("Escribe el nombre de la ubicación (p. ej. Calle 1).");
    if (listados.some((l) => sinTildes(l.nombre) === sinTildes(nombre))) return setError("Ya existe una ubicación con ese nombre.");
    setError("");
    const { error: errorCrear } = await supabase.from("listados_ubicacion").insert({ nombre });
    if (errorCrear) return setError(`No se pudo crear: ${errorCrear.message}`);
    setNombreNuevo("");
    cargarListados();
  }

  async function renombrar(listado) {
    const nombre = window.prompt("Nuevo nombre de la ubicación:", listado.nombre);
    if (!nombre || !nombre.trim() || nombre.trim() === listado.nombre) return;
    const { error: errorCambio } = await supabase
      .from("listados_ubicacion")
      .update({ nombre: nombre.trim() })
      .eq("id", listado.id);
    if (errorCambio) return window.alert(`No se pudo cambiar: ${errorCambio.message}`);
    cargarListados();
  }

  async function borrar(listado) {
    const respuesta = window.prompt(
      `Se borrará la ubicación "${listado.nombre}" con su listado de artículos. No se puede deshacer.\n\nEscribe BORRAR para confirmar:`
    );
    if (String(respuesta || "").trim().toUpperCase() !== "BORRAR") return;
    const { error: errorBorrar } = await supabase.from("listados_ubicacion").delete().eq("id", listado.id);
    if (errorBorrar) return window.alert(`No se pudo borrar: ${errorBorrar.message}`);
    cargarListados();
  }

  if (!disponible) {
    return (
      <div style={cajaAviso}>
        Para usar las ubicaciones, ejecuta antes <b>supabase/migracion_inventario.sql</b> en Supabase → SQL Editor.
      </div>
    );
  }

  if (actual) {
    return (
      <Listado
        listado={actual}
        soloTrabajador={soloTrabajador}
        onVolver={() => {
          setActual(null);
          cargarListados();
        }}
      />
    );
  }

  return (
    <div style={pagina}>
      <div>
        <h1 style={titulo}>📍 Ubicaciones</h1>
        <p style={subtitulo}>
          {soloTrabajador
            ? "Elige la ubicación que vas a ordenar y lee los artículos en el orden en que están colocados."
            : "Crea las ubicaciones (Calle 1, Cámara 1, Tienda…). Los trabajadores leen los artículos en el orden en que están colocados."}
        </p>
      </div>

      {!soloTrabajador && (
        <section style={tarjeta}>
          <h2 style={tituloSeccion}>Nueva ubicación</h2>
          <div style={fila}>
            <input
              type="text"
              value={nombreNuevo}
              onChange={(e) => {
                setNombreNuevo(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && crear()}
              placeholder="Calle 1, Cámara 1, Tienda…"
              style={{ ...campoTexto, flex: 1 }}
            />
            <button type="button" style={botonVerde} onClick={crear}>
              + Crear
            </button>
          </div>
          {error && <div style={cajaError}>{error}</div>}
        </section>
      )}

      <section style={tarjeta}>
        <h2 style={tituloSeccion}>{soloTrabajador ? "¿Qué vas a ordenar?" : "Ubicaciones"}</h2>
        {cargando ? (
          <div style={vacio}>Cargando…</div>
        ) : listados.length === 0 ? (
          <div style={vacio}>
            {soloTrabajador
              ? "Todavía no hay ubicaciones. Pide al encargado que las cree."
              : "Todavía no hay ninguna ubicación."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {listados.map((l) => (
              <div key={l.id} style={filaListado}>
                <button type="button" style={botonListado} onClick={() => setActual(l)}>
                  <span style={{ fontWeight: 950, fontSize: "17px" }}>📍 {l.nombre}</span>
                  {l.total !== null && (
                    <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 700 }}>
                      {l.total} artículo{l.total === 1 ? "" : "s"}
                    </span>
                  )}
                </button>
                {!soloTrabajador && (
                  <div style={{ display: "flex", gap: "6px", paddingRight: "8px" }}>
                    <button type="button" style={botonBlancoPeq} onClick={() => renombrar(l)} title="Cambiar nombre">
                      ✏️
                    </button>
                    <button type="button" style={botonRojoPeq} onClick={() => borrar(l)} title="Borrar">
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
// Un listado: leer artículos en orden
// ---------------------------------------------------------------------
function Listado({ listado, soloTrabajador, onVolver }) {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [quien, setQuien] = useState(() => leerLocal(CLAVE_QUIEN));
  // nada | camara | buscando | elegir | noEncontrado
  const [modo, setModo] = useState("nada");
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [codigoLeido, setCodigoLeido] = useState("");
  const [codigoAnterior, setCodigoAnterior] = useState("");
  const [opciones, setOpciones] = useState([]);
  const [textoManual, setTextoManual] = useState("");
  const [aviso, setAviso] = useState(null); // { texto, tipo: ok | aviso | error }
  const [error, setError] = useState("");
  // Insertar: null = al final · { despuesDe: id | null (al principio) }
  const [insercion, setInsercion] = useState(null);
  const [ultimoId, setUltimoId] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  // Artículo repetido pendiente de confirmar: { articulo, codigo, guardarCodigo, puesto }
  const [repetido, setRepetido] = useState(null);
  // Señal grande en pantalla: { tipo: "ok" | "error", id }
  const [destello, setDestello] = useState(null);
  const desdeCamaraRef = useRef(false);
  const finalRef = useRef(null);
  const filasRef = useRef(filas);
  filasRef.current = filas;

  useEffect(() => guardarLocal(CLAVE_QUIEN, quien), [quien]);

  const cargar = useCallback(async () => {
    try {
      const datos = await cargarTodo(() =>
        supabase
          .from("listado_ubicacion_articulos")
          .select("id, articulo_id, posicion, ean, leido_por, creado_en, articulos(codigo_lojo, nombre, foto)")
          .eq("listado_id", listado.id)
          .order("posicion", { ascending: true })
          .order("id", { ascending: true })
      );
      setFilas(datos);
      setError("");
    } catch (e) {
      setError(`No se pudo cargar: ${e.message}`);
    } finally {
      setCargando(false);
    }
  }, [listado.id]);

  useEffect(() => {
    cargar();
    const t = setInterval(() => {
      if (!camaraAbierta) cargar();
    }, REFRESCO_MS);
    return () => clearInterval(t);
  }, [cargar, camaraAbierta]);

  // Al entrar, ir al final de la lista ("por dónde vamos").
  useEffect(() => {
    if (!cargando && !insercion) finalRef.current?.scrollIntoView({ block: "end" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando]);

  // Posición numérica para un artículo nuevo, según dónde se inserta.
  function calcularPosicion() {
    const lista = filasRef.current;
    if (!lista.length) return 1;
    if (!insercion) return lista[lista.length - 1].posicion + 1;
    if (insercion.despuesDe === null) return lista[0].posicion - 1;
    const i = lista.findIndex((f) => f.id === insercion.despuesDe);
    if (i === -1) return lista[lista.length - 1].posicion + 1;
    const siguiente = lista[i + 1];
    return siguiente ? (lista[i].posicion + siguiente.posicion) / 2 : lista[i].posicion + 1;
  }

  function mostrarDestello(tipo) {
    setDestello({ tipo, id: Date.now() });
  }

  // Devuelve "ok", "repetido" (hay que preguntar) o "error".
  async function agregar(articulo, codigo = "", guardarCodigoEnArticulo = false, permitirRepetido = false) {
    const lista = filasRef.current;
    const yaEsta = lista.findIndex((f) => String(f.articulo_id) === String(articulo.id));
    if (yaEsta !== -1 && !permitirRepetido) {
      setRepetido({ articulo, codigo, guardarCodigo: guardarCodigoEnArticulo, puesto: yaEsta + 1 });
      setModo("repetido");
      return "repetido";
    }
    const posicion = calcularPosicion();
    const { data, error: errorGuardar } = await supabase
      .from("listado_ubicacion_articulos")
      .insert({
        listado_id: listado.id,
        articulo_id: articulo.id,
        posicion,
        ean: codigo || null,
        leido_por: quien.trim() || null,
      })
      .select("id, articulo_id, posicion, ean, leido_por, creado_en")
      .single();
    if (errorGuardar) {
      setAviso({
        tipo: "error",
        texto:
          errorGuardar.code === "23505"
            ? "Falta volver a ejecutar supabase/migracion_inventario.sql para poder repetir artículos."
            : `No se pudo guardar: ${errorGuardar.message}`,
      });
      return "error";
    }

    if (guardarCodigoEnArticulo && codigo) {
      const eans = [...new Set([...(articulo.eans || []), normalizarEan(codigo)])];
      const { error: errorEan } = await supabase.from("articulos").update({ eans }).eq("id", articulo.id);
      if (errorEan) console.warn("No se pudo guardar el EAN en el artículo:", errorEan.message);
    }

    const nueva = {
      ...data,
      articulos: { codigo_lojo: articulo.codigo_lojo, nombre: articulo.nombre, foto: articulo.foto },
    };
    const nuevaLista = [...lista, nueva].sort((a, b) => a.posicion - b.posicion || a.id - b.id);
    setFilas(nuevaLista);
    setUltimoId(nueva.id);
    const puesto = nuevaLista.findIndex((f) => f.id === nueva.id) + 1;
    setAviso({ tipo: "ok", texto: `✓ ${puesto}. ${articulo.nombre}${insercion ? " (insertado)" : ""}` });
    // Si se está insertando, el siguiente va detrás del que se acaba de meter.
    if (insercion) setInsercion({ despuesDe: nueva.id });
    mostrarDestello("ok");
    return "ok";
  }

  async function confirmarRepetido(si) {
    const pendiente = repetido;
    setRepetido(null);
    if (si && pendiente) {
      await agregar(pendiente.articulo, pendiente.codigo, pendiente.guardarCodigo, true);
    } else if (pendiente) {
      setAviso({ tipo: "aviso", texto: `No añadido: ${pendiente.articulo.nombre} (ya está en el puesto ${pendiente.puesto})` });
    }
    volverDespues();
  }

  async function alLeerCodigo(codigo) {
    desdeCamaraRef.current = true;
    setCodigoLeido(codigo);
    setModo("buscando");
    try {
      const encontrados = await buscarArticulosPorCodigo(codigo);
      if (encontrados.length === 1) {
        const resultado = await agregar(encontrados[0], codigo);
        if (resultado !== "repetido") {
          setCodigoAnterior(codigo);
          setModo("camara");
        }
      } else if (encontrados.length > 1) {
        setOpciones(encontrados);
        setModo("elegir");
      } else {
        // ✗ roja y, a continuación, el aviso "Código No Existe".
        mostrarDestello("error");
        setTextoManual("");
        setOpciones([]);
        setError("");
        setModo("pausa");
        setTimeout(() => setModo((m) => (m === "pausa" ? "noEncontrado" : m)), 1200);
      }
    } catch (e) {
      setAviso({ tipo: "error", texto: `No se pudo buscar: ${e.message}` });
      setCodigoAnterior(codigo);
      setModo("camara");
    }
  }

  async function elegirDeOpciones(articulo, conCodigo) {
    const yaTiene = variantesCodigo(codigoLeido).some((v) => (articulo.eans || []).includes(v));
    setOpciones([]);
    const resultado = await agregar(articulo, conCodigo ? codigoLeido : "", conCodigo && !yaTiene);
    if (resultado !== "repetido") volverDespues();
  }

  function volverDespues() {
    setCodigoAnterior(codigoLeido);
    setModo(desdeCamaraRef.current ? "camara" : "nada");
  }

  async function buscarManual() {
    const texto = textoManual.trim();
    if (!texto) return;
    setError("");
    try {
      const pareceCodigo = /^\d{6,}$/.test(normalizarEan(texto));
      let encontrados = pareceCodigo ? await buscarArticulosPorCodigo(texto) : [];
      if (!encontrados.length) encontrados = await buscarArticulosPorTexto(texto);
      setOpciones(encontrados);
      if (!encontrados.length) setError("No se ha encontrado ningún artículo.");
    } catch (e) {
      setError(`No se pudo buscar: ${e.message}`);
    }
  }

  function abrirCamara() {
    setCodigoAnterior("");
    setAviso(null);
    setOpciones([]);
    setCamaraAbierta(true);
    setModo("camara");
  }

  function cerrarCamara() {
    desdeCamaraRef.current = false;
    setCamaraAbierta(false);
    setModo("nada");
  }

  async function quitar(filaQuitar) {
    if (!window.confirm(`¿Quitar "${filaQuitar.articulos?.nombre}" de ${listado.nombre}?`)) return;
    const { error: errorBorrar } = await supabase.from("listado_ubicacion_articulos").delete().eq("id", filaQuitar.id);
    if (errorBorrar) return window.alert(`No se pudo quitar: ${errorBorrar.message}`);
    if (insercion?.despuesDe === filaQuitar.id) setInsercion(null);
    setFilas((lista) => lista.filter((f) => f.id !== filaQuitar.id));
  }

  // Búsqueda dentro del listado (para encontrar dónde insertar).
  const filasVisibles = useMemo(() => {
    const palabras = sinTildes(busqueda).split(/\s+/).filter(Boolean);
    const conPuesto = filas.map((f, i) => ({ ...f, puesto: i + 1 }));
    if (!palabras.length) return conPuesto;
    return conPuesto.filter((f) => {
      const texto = sinTildes(`${f.articulos?.codigo_lojo || ""} ${f.articulos?.nombre || ""} ${f.ean || ""}`);
      return palabras.every((p) => texto.includes(p));
    });
  }, [filas, busqueda]);

  const filaInsercion = insercion?.despuesDe ? filas.findIndex((f) => f.id === insercion.despuesDe) : -1;
  const textoInsercion = insercion
    ? insercion.despuesDe === null
      ? "Insertando AL PRINCIPIO"
      : `Insertando detrás del ${filaInsercion + 1}. ${filas[filaInsercion]?.articulos?.nombre || ""}`
    : "";

  function nombreArchivo() {
    return `${sinTildes(listado.nombre).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ubicacion"}.csv`;
  }

  function exportarCsv() {
    const celda = (v) => {
      const t = String(v ?? "");
      return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const lineas = [["Orden", "Cod. Art.", "Descr. Art.", "EAN"]];
    filas.forEach((f, i) => lineas.push([i + 1, f.articulos?.codigo_lojo || "", f.articulos?.nombre || "", f.ean || ""]));
    const texto = "﻿" + lineas.map((l) => l.map(celda).join(";")).join("\r\n") + "\r\n";
    const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreArchivo();
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // Hoja de RECUENTO en el orden de la ubicación:
  // Código Lojo · Nombre · Cantidad (raya corta para escribir a mano).
  function imprimir() {
    const esc = (t) =>
      String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(listado.nombre)} · Recuento</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        p { margin: 0 0 14px; color: #444; font-size: 13px; }
        table { width: auto; border-collapse: collapse; font-size: 13px; }
        th, td { padding: 9px 6px; text-align: left; vertical-align: bottom; border-bottom: 1px solid #ddd; }
        th { background: #eee; font-size: 12px; }
        td.cod { font-weight: bold; white-space: nowrap; padding-right: 14px; }
        td.nom { padding-right: 14px; }
        th.cant, td.cant { width: 75px; }
        .raya { display: inline-block; width: 65px; border-bottom: 1.5px solid #111; height: 16px; }
        tr { page-break-inside: avoid; }
        @media print { body { margin: 10mm; } }
      </style></head><body>
      <h1>📍 ${esc(listado.nombre)} · Hoja de recuento</h1>
      <p>Cash Lojo · ${filas.length} artículos · Impreso el ${esc(formatoFecha(new Date().toISOString(), true))}</p>
      <table>
        <thead><tr><th>Código Lojo</th><th>Nombre</th><th class="cant">Cantidad</th></tr></thead>
        <tbody>
      ${filas
        .map(
          (f) =>
            `<tr><td class="cod">${esc(f.articulos?.codigo_lojo)}</td><td class="nom">${esc(f.articulos?.nombre)}</td><td class="cant"><span class="raya"></span></td></tr>`
        )
        .join("")}
        </tbody>
      </table>
      <script>window.onload = function () { window.print(); };<\/script></body></html>`;
    const ventana = window.open("", "_blank");
    if (!ventana) return window.alert("El navegador ha bloqueado la ventana de impresión.");
    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
  }

  const ultimos = filas.slice(-3).map((f) => ({ ...f, puesto: filas.indexOf(f) + 1 }));

  return (
    <div style={pagina}>
      <div style={cabecera}>
        <button type="button" style={botonVolver} onClick={onVolver}>
          ← Ubicaciones
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ ...titulo, fontSize: "22px" }}>📍 {listado.nombre}</h1>
          <div style={subtitulo}>
            {filas.length} artículo{filas.length === 1 ? "" : "s"} en el listado
          </div>
        </div>
      </div>

      <section style={tarjeta}>
        <label style={campo}>
          <span style={etiqueta}>¿Quién lee?</span>
          <input type="text" value={quien} onChange={(e) => setQuien(e.target.value)} placeholder="Tu nombre" style={campoTexto} />
        </label>

        {insercion && (
          <div style={cajaInsercion}>
            <span>⤵ {textoInsercion}</span>
            <button type="button" style={botonBlancoPeq} onClick={() => setInsercion(null)}>
              Terminar
            </button>
          </div>
        )}

        <button type="button" style={botonEscanear} onClick={abrirCamara}>
          📷 {insercion ? "Escanear para insertar" : "Escanear artículos"}
        </button>

        <div style={fila}>
          <input
            type="text"
            value={modo === "noEncontrado" ? "" : textoManual}
            onChange={(e) => setTextoManual(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscarManual()}
            placeholder="O busca a mano: nombre o código Lojo"
            style={{ ...campoTexto, flex: 1 }}
          />
          <button type="button" style={botonAzul} onClick={buscarManual}>
            Buscar
          </button>
        </div>
        {modo === "nada" && opciones.length > 0 && (
          <ListaOpciones
            opciones={opciones}
            onElegir={async (a) => {
              desdeCamaraRef.current = false;
              setOpciones([]);
              setTextoManual("");
              await agregar(a);
            }}
          />
        )}
        {modo === "nada" && error && <div style={cajaError}>{error}</div>}
        {aviso && !camaraAbierta && <div style={estiloAviso(aviso.tipo)}>{aviso.texto}</div>}

        {!soloTrabajador && filas.length > 0 && (
          <div style={fila}>
            <button type="button" style={botonBlanco} onClick={exportarCsv}>
              ⬇️ Exportar CSV
            </button>
            <button type="button" style={botonBlanco} onClick={imprimir}>
              🖨️ Imprimir
            </button>
          </div>
        )}
      </section>

      <section style={tablaContenedor}>
        <div style={cabeceraLista}>
          <strong>Listado en orden</strong>
          {filas.length > 8 && (
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="🔎 Buscar en el listado"
              style={{ ...campoTexto, padding: "8px 10px", fontSize: "14px", flex: "1 1 160px" }}
            />
          )}
        </div>

        {cargando ? (
          <div style={vacio}>Cargando…</div>
        ) : filas.length === 0 ? (
          <div style={vacio}>Todavía no hay artículos. Pulsa “Escanear artículos” y lee el primero.</div>
        ) : (
          <>
            {!busqueda && (
              <button
                type="button"
                style={insercion?.despuesDe === null ? botonInsertarActivo : botonInsertarPrincipio}
                onClick={() => setInsercion({ despuesDe: null })}
              >
                ⤵ Insertar al principio
              </button>
            )}
            {filasVisibles.map((f) => {
              const marcadaInsercion = insercion?.despuesDe === f.id;
              const esUltimo = f.id === ultimoId;
              return (
                <div key={f.id}>
                  <div style={filaArticulo(esUltimo)}>
                    <span style={numeroPuesto}>{f.puesto}</span>
                    <div style={marcoFotoPeq}>
                      {f.articulos?.foto ? (
                        <img src={urlFoto(f.articulos.foto)} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      ) : (
                        <span style={{ opacity: 0.4 }}>📦</span>
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 900, fontSize: "14px", color: "#0f172a", lineHeight: 1.2 }}>
                        {f.articulos?.nombre || "(artículo borrado)"}
                      </div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>
                        Lojo {f.articulos?.codigo_lojo || "—"}
                        {f.leido_por ? ` · ${f.leido_por}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      style={marcadaInsercion ? botonInsertarFilaActivo : botonInsertarFila}
                      onClick={() => setInsercion(marcadaInsercion ? null : { despuesDe: f.id })}
                      title="Insertar artículos detrás de este"
                    >
                      ⤵
                    </button>
                    <button type="button" style={botonRojoPeq} onClick={() => quitar(f)} title="Quitar del listado">
                      🗑️
                    </button>
                  </div>
                  {marcadaInsercion && <div style={lineaInsercion}>⤵ Lo que leas ahora se mete aquí</div>}
                </div>
              );
            })}
            <div ref={finalRef} />
          </>
        )}
        {error && modo !== "nada" && <div style={cajaError}>{error}</div>}
      </section>

      {camaraAbierta && (
        <LectorCamara
          titulo={`📍 ${listado.nombre} · ${filas.length}`}
          aviso={aviso?.texto || ""}
          ignorarCodigo={codigoAnterior}
          activo={modo === "camara"}
          onLeido={alLeerCodigo}
          onCerrar={cerrarCamara}
        >
          {insercion && <div style={insercionCamara}>⤵ {textoInsercion}</div>}
          <div style={ultimosCamara}>
            <div style={{ fontSize: "12px", fontWeight: 800, opacity: 0.7, marginBottom: "4px" }}>
              {insercion ? "Últimos del listado" : "Últimos leídos"}
            </div>
            {ultimos.length === 0 ? (
              <div style={{ fontSize: "14px", opacity: 0.7 }}>Todavía ninguno</div>
            ) : (
              ultimos.map((f) => (
                <div key={f.id} style={{ fontSize: "14px", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.puesto}. {f.articulos?.nombre}
                </div>
              ))
            )}
          </div>
          <button type="button" style={botonPieCamara} onClick={cerrarCamara}>
            ✓ Terminar
          </button>
        </LectorCamara>
      )}

      <Destello destello={destello} />

      {["buscando", "elegir", "noEncontrado", "repetido"].includes(modo) &&
        createPortal(
          <div style={fondoModal}>
            <div style={ventanaModal}>
              {modo === "buscando" && <div style={vacio}>Buscando {codigoLeido}…</div>}

              {modo === "elegir" && (
                <>
                  <h3 style={tituloSeccion}>Hay varios artículos con el código {codigoLeido}. ¿Cuál es?</h3>
                  <ListaOpciones opciones={opciones} onElegir={(a) => elegirDeOpciones(a, true)} />
                  <button type="button" style={botonBlanco} onClick={volverDespues}>
                    Cancelar
                  </button>
                </>
              )}

              {modo === "repetido" && repetido && (
                <>
                  <div style={{ fontSize: "44px", textAlign: "center" }}>⚠️</div>
                  <h3 style={{ ...tituloSeccion, textAlign: "center", fontSize: "20px" }}>Artículo ya introducido</h3>
                  <div style={{ textAlign: "center", fontWeight: 900, color: "#0f172a" }}>{repetido.articulo.nombre}</div>
                  <div style={{ textAlign: "center", fontWeight: 700, color: "#64748b", fontSize: "14px" }}>
                    Ya está en el puesto {repetido.puesto} de {listado.nombre}.
                  </div>
                  <div style={{ textAlign: "center", fontWeight: 900, color: "#334155", fontSize: "16px" }}>
                    ¿Quieres añadir otra posición dentro de esta ubicación?
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button type="button" style={{ ...botonBlanco, flex: 1, padding: "16px", fontSize: "17px" }} onClick={() => confirmarRepetido(false)}>
                      No
                    </button>
                    <button type="button" style={{ ...botonVerde, flex: 1, padding: "16px", fontSize: "17px" }} onClick={() => confirmarRepetido(true)}>
                      Sí, añadir
                    </button>
                  </div>
                </>
              )}

              {modo === "noEncontrado" && (
                <>
                  <div style={{ fontSize: "44px", textAlign: "center", color: "#dc2626", fontWeight: 950, lineHeight: 1 }}>✗</div>
                  <h3 style={{ ...tituloSeccion, textAlign: "center", fontSize: "22px", color: "#dc2626" }}>Código No Existe</h3>
                  <div style={{ textAlign: "center", fontWeight: 800, color: "#64748b" }}>{codigoLeido}</div>
                  <p style={{ margin: 0, color: "#475569", fontWeight: 700, fontSize: "14px" }}>
                    Si sabes qué artículo es, búscalo por nombre o código Lojo: se le guarda este código para la próxima vez.
                  </p>
                  <div style={fila}>
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
                  {opciones.length > 0 && <ListaOpciones opciones={opciones} onElegir={(a) => elegirDeOpciones(a, true)} />}
                  <button type="button" style={botonBlanco} onClick={volverDespues}>
                    {desdeCamaraRef.current ? "Volver a la cámara" : "Cancelar"}
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

// Señal grande en el centro de la pantalla: ✓ verde (2 s) o ✗ roja (1,2 s).
function Destello({ destello }) {
  const [visible, setVisible] = useState(null);
  useEffect(() => {
    if (!destello) return undefined;
    setVisible(destello);
    const t = setTimeout(() => setVisible(null), destello.tipo === "ok" ? 2000 : 1200);
    return () => clearTimeout(t);
  }, [destello]);
  if (!visible) return null;
  const ok = visible.tipo === "ok";
  return createPortal(
    <div style={capaDestello}>
      <div key={visible.id} style={circuloDestello(ok)} className="lojo-destello">
        {ok ? "✓" : "✗"}
      </div>
      <style>{`
        @keyframes lojoDestello { 0% { transform: scale(0.4); opacity: 0; } 15% { transform: scale(1.08); opacity: 1; } 25% { transform: scale(1); } 85% { opacity: 1; } 100% { opacity: 0; } }
        .lojo-destello { animation: lojoDestello ${ok ? 2 : 1.2}s ease-out forwards; }
      `}</style>
    </div>,
    document.body
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
const fila = { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "stretch" };
const campo = { display: "flex", flexDirection: "column", gap: "5px" };
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
const botonEscanear = { ...botonVerde, fontSize: "20px", padding: "20px", boxShadow: "0 12px 24px rgba(22,163,74,0.25)" };
const botonVolver = { ...botonBlanco, padding: "10px 14px" };
const botonPeqBase = {
  borderRadius: "10px",
  padding: "6px 10px",
  fontSize: "14px",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const botonBlancoPeq = { ...botonPeqBase, background: "#fff", border: "1px solid #cbd5e1", color: "#334155" };
const botonRojoPeq = { ...botonPeqBase, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" };
const botonInsertarFila = { ...botonPeqBase, background: "#eef2ff", border: "1px solid #c7d2fe", color: "#3730a3", fontSize: "16px" };
const botonInsertarFilaActivo = { ...botonInsertarFila, background: "#4f46e5", color: "#fff", border: "1px solid #4f46e5" };
const botonInsertarPrincipio = {
  ...botonPeqBase,
  margin: "8px 10px",
  background: "#eef2ff",
  border: "1px dashed #a5b4fc",
  color: "#3730a3",
};
const botonInsertarActivo = { ...botonInsertarPrincipio, background: "#4f46e5", color: "#fff", border: "1px solid #4f46e5" };
const botonPieCamara = {
  ...botonBase,
  width: "100%",
  background: "rgba(255,255,255,0.16)",
  color: "#fff",
  padding: "14px",
};
const cabecera = { display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" };
const filaListado = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
};
const botonListado = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "2px",
  border: "none",
  background: "transparent",
  padding: "14px",
  cursor: "pointer",
  textAlign: "left",
  color: "#0f172a",
};
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
const estiloAviso = (tipo) => ({
  borderRadius: "12px",
  padding: "10px 12px",
  fontWeight: 800,
  fontSize: "14px",
  background: tipo === "ok" ? "#f0fdf4" : tipo === "aviso" ? "#fffbeb" : "#fef2f2",
  color: tipo === "ok" ? "#166534" : tipo === "aviso" ? "#92400e" : "#b91c1c",
});
const cajaInsercion = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  background: "#eef2ff",
  border: "2px solid #4f46e5",
  color: "#3730a3",
  borderRadius: "12px",
  padding: "10px 12px",
  fontWeight: 900,
  fontSize: "14px",
};
const tablaContenedor = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden" };
const cabeceraLista = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  padding: "10px 12px",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
  color: "#334155",
};
const filaArticulo = (resaltada) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 10px",
  borderBottom: "1px solid #f1f5f9",
  background: resaltada ? "#f0fdf4" : "#fff",
});
const numeroPuesto = {
  minWidth: "34px",
  textAlign: "center",
  fontWeight: 950,
  fontSize: "15px",
  color: "#4f46e5",
};
const marcoFotoPeq = {
  width: "40px",
  height: "40px",
  flex: "0 0 auto",
  borderRadius: "8px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};
const lineaInsercion = {
  background: "#4f46e5",
  color: "#fff",
  fontSize: "13px",
  fontWeight: 900,
  padding: "6px 12px",
};
const insercionCamara = {
  background: "#4f46e5",
  borderRadius: "10px",
  padding: "8px 10px",
  fontSize: "13px",
  fontWeight: 900,
  marginBottom: "8px",
};
const ultimosCamara = {
  background: "rgba(255,255,255,0.1)",
  borderRadius: "12px",
  padding: "8px 12px",
  marginBottom: "10px",
};
const capaDestello = {
  position: "fixed",
  inset: 0,
  zIndex: 9700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
};
const circuloDestello = (ok) => ({
  width: "180px",
  height: "180px",
  borderRadius: "999px",
  background: ok ? "rgba(22,163,74,0.95)" : "rgba(220,38,38,0.95)",
  color: "#fff",
  fontSize: "120px",
  fontWeight: 950,
  lineHeight: "180px",
  textAlign: "center",
  boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
  fontFamily: "Arial, sans-serif",
});
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
