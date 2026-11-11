// Importar códigos de barras (EAN) desde el CSV del programa de gestión.
//
// Botón "Importar EAN" en Admin > Artículos:
//   1. Se elige el CSV exportado (columnas "Cod. Art." y "Cód. Barras").
//   2. Se cruza el "Cod. Art." con el Código Lojo de cada artículo
//      (sin espacios ni ceros a la izquierda) y se enseña un resumen.
//   3. Al confirmar se AÑADEN los códigos nuevos. Nunca se borra ninguno:
//      los que ya tiene el artículo se quedan como están.
// Se aceptan códigos de cualquier tamaño (EAN-13, EAN-8, cajas, GS1-128...).
import { useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const ACTUALIZACIONES_A_LA_VEZ = 8;

function normalizarCodigoLojo(valor) {
  const limpio = String(valor ?? "").trim();
  return limpio.replace(/^0+(?=.)/, "");
}

function limpiarCodigoBarras(valor) {
  return String(valor ?? "").replace(/\s/g, "");
}

// Lee el texto del archivo: UTF-8 y, si no lo es, el de Windows (tildes, ñ).
async function leerTexto(archivo) {
  const bytes = await archivo.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

// Separa una línea de CSV respetando las comillas.
function partirLinea(linea, separador) {
  const campos = [];
  let actual = "";
  let entreComillas = false;
  for (let i = 0; i < linea.length; i += 1) {
    const c = linea[i];
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (c === separador && !entreComillas) {
      campos.push(actual);
      actual = "";
    } else {
      actual += c;
    }
  }
  campos.push(actual);
  return campos;
}

function quitarTildes(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Devuelve las parejas { codigoLojo, codigoBarras } del CSV.
function leerCsv(texto) {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) throw new Error("El archivo está vacío.");

  const primera = lineas[0];
  const separador = [";", "\t", ","].reduce((mejor, sep) =>
    primera.split(sep).length > primera.split(mejor).length ? sep : mejor
  );

  const cabecera = partirLinea(primera, separador).map(quitarTildes);
  let colLojo = cabecera.findIndex((c) => /cod/.test(c) && /art/.test(c) && !/barra/.test(c));
  let colBarras = cabecera.findIndex((c) => /barra|ean/.test(c));
  let desde = 1;

  if (colLojo === -1 || colBarras === -1) {
    // Sin cabecera reconocible: mismo orden que el export del programa
    // (Grupo; Depart.; Cod. Art.; Descr. Art.; Cód. Barras; Uds.).
    colLojo = 2;
    colBarras = 4;
    desde = /\d/.test(partirLinea(primera, separador)[2] || "") ? 0 : 1;
  }

  const parejas = [];
  let notacionCientifica = 0;
  for (let i = desde; i < lineas.length; i += 1) {
    const campos = partirLinea(lineas[i], separador);
    const codigoLojo = normalizarCodigoLojo(campos[colLojo]);
    const codigoBarras = limpiarCodigoBarras(campos[colBarras]);
    if (!codigoLojo || !codigoBarras) continue;
    // Excel a veces estropea los códigos largos: "8,41267E+12".
    if (/e\+/i.test(codigoBarras)) {
      notacionCientifica += 1;
      continue;
    }
    if (!/\d/.test(codigoBarras)) continue;
    parejas.push({ codigoLojo, codigoBarras });
  }
  return { parejas, notacionCientifica };
}

// Compara el CSV con los artículos y prepara lo que hay que añadir.
function prepararImportacion(parejas, articulos) {
  const porCodigoLojo = new Map();
  articulos.forEach((articulo) => {
    const codigo = normalizarCodigoLojo(articulo.codigo_lojo);
    if (codigo) porCodigoLojo.set(codigo, articulo);
  });

  const nuevosPorArticulo = new Map();
  const sinArticulo = new Set();
  let yaEstaban = 0;

  parejas.forEach(({ codigoLojo, codigoBarras }) => {
    const articulo = porCodigoLojo.get(codigoLojo);
    if (!articulo) {
      sinArticulo.add(codigoLojo);
      return;
    }
    const actuales = articulo.eans || [];
    const nuevos = nuevosPorArticulo.get(articulo.id) || new Set();
    if (actuales.includes(codigoBarras) || nuevos.has(codigoBarras)) {
      if (actuales.includes(codigoBarras)) yaEstaban += 1;
      return;
    }
    nuevos.add(codigoBarras);
    nuevosPorArticulo.set(articulo.id, nuevos);
  });

  const cambios = [...nuevosPorArticulo.entries()].map(([id, nuevos]) => {
    const articulo = articulos.find((a) => a.id === id);
    return {
      id,
      nombre: articulo?.nombre || "",
      codigoLojo: articulo?.codigo_lojo || "",
      nuevos: [...nuevos],
      eans: [...new Set([...(articulo?.eans || []), ...nuevos])],
    };
  });

  return {
    cambios,
    totalNuevos: cambios.reduce((suma, c) => suma + c.nuevos.length, 0),
    yaEstaban,
    sinArticulo: [...sinArticulo].sort((a, b) => a.localeCompare(b, "es", { numeric: true })),
  };
}

export default function ImportarEan({ articulos, eansDisponibles, onTerminado }) {
  const inputRef = useRef(null);
  const [abierto, setAbierto] = useState(false);
  // elegir | revisar | guardando | hecho
  const [fase, setFase] = useState("elegir");
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [plan, setPlan] = useState(null);
  const [avisoExcel, setAvisoExcel] = useState(0);
  const [error, setError] = useState("");
  const [progreso, setProgreso] = useState(0);
  const [fallos, setFallos] = useState([]);

  function abrir() {
    setAbierto(true);
    setFase("elegir");
    setPlan(null);
    setError("");
    setFallos([]);
    setProgreso(0);
    setAvisoExcel(0);
    setNombreArchivo("");
  }

  function cerrar() {
    if (fase === "guardando") return;
    setAbierto(false);
  }

  async function alElegirArchivo(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    setError("");
    setNombreArchivo(archivo.name);
    try {
      const texto = await leerTexto(archivo);
      const { parejas, notacionCientifica } = leerCsv(texto);
      if (!parejas.length) {
        setError("No se ha encontrado ningún código de barras en el archivo.");
        return;
      }
      setAvisoExcel(notacionCientifica);
      setPlan(prepararImportacion(parejas, articulos));
      setFase("revisar");
    } catch (e) {
      setError(e.message || "No se pudo leer el archivo.");
    }
  }

  async function importar() {
    if (!plan?.cambios.length) return;
    setFase("guardando");
    setProgreso(0);
    const errores = [];
    let hechos = 0;
    const pendientes = [...plan.cambios];

    async function trabajador() {
      while (pendientes.length) {
        const cambio = pendientes.shift();
        const { error: errorUpdate } = await supabase
          .from("articulos")
          .update({ eans: cambio.eans })
          .eq("id", cambio.id);
        if (errorUpdate) errores.push(`${cambio.codigoLojo} ${cambio.nombre}: ${errorUpdate.message}`);
        hechos += 1;
        setProgreso(hechos);
      }
    }

    await Promise.all(Array.from({ length: ACTUALIZACIONES_A_LA_VEZ }, trabajador));
    setFallos(errores);
    setFase("hecho");
    onTerminado?.();
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        style={botonAbrir}
        disabled={!eansDisponibles}
        title={
          eansDisponibles
            ? "Añadir los códigos de barras nuevos desde el CSV del programa de gestión"
            : "Ejecuta antes supabase/migracion_eans.sql en Supabase"
        }
      >
        ▥ Importar EAN
      </button>

      <input ref={inputRef} type="file" accept=".csv,.txt,text/csv" onChange={alElegirArchivo} style={{ display: "none" }} />

      {abierto && (
        <div style={fondo} onClick={cerrar}>
          <div style={ventana} onClick={(e) => e.stopPropagation()}>
            <div style={cabecera}>
              <h2 style={titulo}>Importar códigos de barras (EAN)</h2>
              <button type="button" onClick={cerrar} style={botonCerrar} disabled={fase === "guardando"}>
                ✕
              </button>
            </div>

            {fase === "elegir" && (
              <>
                <p style={texto}>
                  Elige el CSV exportado del programa de gestión (con las columnas <b>Cod. Art.</b> y{" "}
                  <b>Cód. Barras</b>). Solo se añaden los códigos nuevos de los artículos cuyo{" "}
                  <b>Código Lojo</b> coincide. No se borra ningún código.
                </p>
                <button type="button" style={botonVerde} onClick={() => inputRef.current?.click()}>
                  Elegir archivo CSV
                </button>
                {error && <div style={cajaError}>{error}</div>}
              </>
            )}

            {fase === "revisar" && plan && (
              <>
                <div style={archivo}>📄 {nombreArchivo}</div>
                <div style={resumen}>
                  <Dato numero={plan.totalNuevos} texto="códigos nuevos" verde />
                  <Dato numero={plan.cambios.length} texto="artículos a actualizar" />
                  <Dato numero={plan.yaEstaban} texto="ya estaban guardados" />
                  <Dato numero={plan.sinArticulo.length} texto="códigos Lojo sin artículo" />
                </div>

                {avisoExcel > 0 && (
                  <div style={cajaAviso}>
                    ⚠️ {avisoExcel} códigos venían estropeados por Excel (tipo "8,41E+12") y no se han cogido.
                    Exporta el CSV directamente del programa, sin abrirlo y guardarlo con Excel.
                  </div>
                )}

                {plan.cambios.length > 0 && (
                  <details style={desplegable}>
                    <summary style={resumenDesplegable}>Ver artículos que se actualizan</summary>
                    <div style={lista}>
                      {plan.cambios.map((c) => (
                        <div key={c.id} style={filaLista}>
                          <b>{c.codigoLojo}</b> {c.nombre} → {c.nuevos.join(", ")}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {plan.sinArticulo.length > 0 && (
                  <details style={desplegable}>
                    <summary style={resumenDesplegable}>Ver códigos Lojo que no están en la app</summary>
                    <div style={lista}>{plan.sinArticulo.join(", ")}</div>
                  </details>
                )}

                <div style={botones}>
                  <button type="button" style={botonBlanco} onClick={() => inputRef.current?.click()}>
                    Elegir otro archivo
                  </button>
                  <button
                    type="button"
                    style={{ ...botonVerde, opacity: plan.totalNuevos ? 1 : 0.5 }}
                    onClick={importar}
                    disabled={!plan.totalNuevos}
                  >
                    {plan.totalNuevos ? `Añadir ${plan.totalNuevos} códigos` : "No hay códigos nuevos"}
                  </button>
                </div>
                {error && <div style={cajaError}>{error}</div>}
              </>
            )}

            {fase === "guardando" && plan && (
              <p style={texto}>
                Guardando… {progreso} de {plan.cambios.length} artículos
              </p>
            )}

            {fase === "hecho" && plan && (
              <>
                <div style={fallos.length ? cajaAviso : cajaOk}>
                  {fallos.length
                    ? `Terminado con ${fallos.length} errores. El resto se ha guardado.`
                    : `✓ Hecho: ${plan.totalNuevos} códigos nuevos en ${plan.cambios.length} artículos.`}
                </div>
                {fallos.length > 0 && <div style={lista}>{fallos.join("\n")}</div>}
                <div style={botones}>
                  <button type="button" style={botonVerde} onClick={cerrar}>
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Dato({ numero, texto: etiqueta, verde }) {
  return (
    <div style={{ ...dato, ...(verde ? datoVerde : null) }}>
      <div style={datoNumero}>{numero}</div>
      <div style={datoTexto}>{etiqueta}</div>
    </div>
  );
}

const botonAbrir = {
  background: "#4f46e5",
  color: "#fff",
  border: "none",
  borderRadius: "16px",
  padding: "15px 20px",
  fontSize: "15px",
  fontWeight: "950",
  cursor: "pointer",
  whiteSpace: "nowrap",
  boxShadow: "0 14px 26px rgba(79,70,229,0.25)",
};

const fondo = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.55)",
  zIndex: 5000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
};

const ventana = {
  width: "100%",
  maxWidth: "620px",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: "22px",
  padding: "22px",
  boxSizing: "border-box",
  boxShadow: "0 30px 60px rgba(0,0,0,0.25)",
};

const cabecera = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "12px" };
const titulo = { margin: 0, fontSize: "20px", fontWeight: 950, color: "#0f172a" };
const botonCerrar = {
  border: "none",
  background: "#f1f5f9",
  borderRadius: "999px",
  width: "38px",
  height: "38px",
  fontSize: "16px",
  fontWeight: 900,
  cursor: "pointer",
};
const texto = { fontSize: "15px", color: "#334155", lineHeight: 1.5 };
const archivo = { fontSize: "14px", fontWeight: 800, color: "#475569", marginBottom: "12px" };
const resumen = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px", marginBottom: "12px" };
const dato = { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "12px", textAlign: "center" };
const datoVerde = { background: "#f0fdf4", border: "1px solid #bbf7d0" };
const datoNumero = { fontSize: "24px", fontWeight: 950, color: "#0f172a" };
const datoTexto = { fontSize: "12px", fontWeight: 800, color: "#64748b" };
const desplegable = { border: "1px solid #e2e8f0", borderRadius: "12px", padding: "10px 12px", marginBottom: "10px" };
const resumenDesplegable = { cursor: "pointer", fontWeight: 900, fontSize: "14px", color: "#334155" };
const lista = {
  marginTop: "8px",
  maxHeight: "220px",
  overflowY: "auto",
  fontSize: "13px",
  color: "#475569",
  whiteSpace: "pre-wrap",
  lineHeight: 1.5,
};
const filaLista = { padding: "3px 0", borderBottom: "1px solid #f1f5f9" };
const botones = { display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap", marginTop: "14px" };
const botonVerde = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  borderRadius: "14px",
  padding: "13px 20px",
  fontSize: "15px",
  fontWeight: 950,
  cursor: "pointer",
};
const botonBlanco = {
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #cbd5e1",
  borderRadius: "14px",
  padding: "13px 18px",
  fontSize: "15px",
  fontWeight: 850,
  cursor: "pointer",
};
const cajaError = { marginTop: "12px", background: "#fef2f2", color: "#b91c1c", borderRadius: "12px", padding: "10px 12px", fontWeight: 800 };
const cajaAviso = { background: "#fffbeb", color: "#92400e", borderRadius: "12px", padding: "10px 12px", fontWeight: 800, marginBottom: "10px", fontSize: "14px" };
const cajaOk = { background: "#f0fdf4", color: "#166534", borderRadius: "12px", padding: "12px", fontWeight: 900 };
