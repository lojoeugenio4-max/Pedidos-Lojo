// Importar CSV del programa de gestión (Admin > Artículos > "Importar CSV").
//
// Se elige qué se importa:
//   - Códigos de barras (EAN): se AÑADEN los códigos nuevos a cada artículo.
//     Nunca se borra ninguno.
//   - Precios (PVP): se pone el precio del CSV en el campo "precio".
//
// En los dos casos solo se tocan los artículos cuyo Código Lojo coincide con
// el código del CSV (sin espacios ni ceros a la izquierda). Nunca se crean
// artículos nuevos. Antes de guardar se enseña un resumen para confirmar.
import { useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const ACTUALIZACIONES_A_LA_VEZ = 8;

const TIPOS = {
  ean: {
    titulo: "Códigos de barras (EAN)",
    icono: "▥",
    descripcion: "Añade los códigos de barras nuevos. No borra ninguno.",
    columnaValor: "Columna del código de barras",
    detectarValor: (c) => /barra|ean/.test(c),
  },
  precio: {
    titulo: "Precios (PVP)",
    icono: "💶",
    descripcion: "Pone el precio del CSV en el campo Precio del artículo.",
    columnaValor: "Columna del precio",
    detectarValor: (c) => /pvp|p\.v\.p|precio|tarifa|importe/.test(c),
  },
};

function normalizarCodigoLojo(valor) {
  return String(valor ?? "").trim().replace(/^0+(?=.)/, "");
}

function limpiarCodigoBarras(valor) {
  return String(valor ?? "").replace(/\s/g, "");
}

// "1.234,56 €" -> 1234.56 · "2,35" -> 2.35 · "2.35" -> 2.35 · "" -> null
function leerPrecio(valor) {
  let t = String(valor ?? "")
    .replace(/[€\s]/g, "")
    .replace(/ /g, "");
  if (!t) return null;
  const ultimaComa = t.lastIndexOf(",");
  const ultimoPunto = t.lastIndexOf(".");
  if (ultimaComa > -1 && ultimoPunto > -1) {
    // El último separador es el de los decimales; el otro, el de los miles.
    t = ultimaComa > ultimoPunto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (ultimaComa > -1) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if ((t.match(/\./g) || []).length > 1) {
    t = t.replace(/\./g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(t)) return NaN;
  return Math.round(Number(t) * 10000) / 10000;
}

function precioActual(articulo) {
  const p = articulo?.precio;
  if (p === null || p === undefined || (typeof p === "string" && !p.trim())) return null;
  const n = Number(String(p).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatoEuros(n) {
  return n === null || n === undefined
    ? "—"
    : `${Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} €`;
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

function sinTildes(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Lee el CSV: cabecera (si la hay) y filas.
function leerCsv(texto) {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) throw new Error("El archivo está vacío.");

  const primera = lineas[0];
  // Separador: el que más columnas da en la primera línea.
  const separador = [";", "\t", ","].reduce((mejor, sep) =>
    partirLinea(primera, sep).length > partirLinea(primera, mejor).length ? sep : mejor
  );
  const filas = lineas.map((l) => partirLinea(l, separador).map((c) => c.trim()));
  const columnas = Math.max(...filas.map((f) => f.length));

  // Hay cabecera si la primera fila tiene alguna celda con letras y ninguna
  // parece un código numérico largo.
  const tieneCabecera = filas[0].some((c) => /[a-zA-Z]/.test(c)) && !filas[0].some((c) => /^\d{6,}$/.test(c));
  const cabecera = Array.from({ length: columnas }, (_, i) =>
    tieneCabecera && filas[0][i] ? filas[0][i] : `Columna ${i + 1}`
  );
  const datos = tieneCabecera ? filas.slice(1) : filas;
  return { cabecera, datos };
}

function detectarColumnas(cabecera, tipo) {
  const normal = cabecera.map(sinTildes);
  let lojo = normal.findIndex((c) => /lojo/.test(c));
  if (lojo === -1) lojo = normal.findIndex((c) => /cod/.test(c) && /art/.test(c) && !/barra/.test(c));
  if (lojo === -1) lojo = normal.findIndex((c) => /^cod|codigo/.test(c) && !/barra|ean/.test(c));
  let valor = normal.findIndex((c, i) => i !== lojo && TIPOS[tipo].detectarValor(c));
  // Mismo orden que el export de EAN del programa (Cod. Art. 3ª, Cód. Barras 5ª).
  if (lojo === -1) lojo = Math.min(2, cabecera.length - 1);
  if (valor === -1) valor = tipo === "ean" && cabecera.length > 4 ? 4 : Math.min(lojo + 1, cabecera.length - 1);
  return { lojo, valor };
}

function mapaPorCodigoLojo(articulos) {
  const mapa = new Map();
  articulos.forEach((a) => {
    const codigo = normalizarCodigoLojo(a.codigo_lojo);
    if (codigo) mapa.set(codigo, a);
  });
  return mapa;
}

function ordenarCodigos(lista) {
  return [...lista].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

// ---- Plan de importación de códigos de barras ----
function planEan(datos, colLojo, colValor, articulos) {
  const porCodigo = mapaPorCodigoLojo(articulos);
  const nuevosPorArticulo = new Map();
  const sinArticulo = new Set();
  let yaEstaban = 0;
  let estropeados = 0;

  datos.forEach((fila) => {
    const codigoLojo = normalizarCodigoLojo(fila[colLojo]);
    const codigoBarras = limpiarCodigoBarras(fila[colValor]);
    if (!codigoLojo || !codigoBarras) return;
    if (/e\+/i.test(codigoBarras)) {
      estropeados += 1;
      return;
    }
    if (!/\d/.test(codigoBarras)) return;
    const articulo = porCodigo.get(codigoLojo);
    if (!articulo) {
      sinArticulo.add(codigoLojo);
      return;
    }
    const actuales = articulo.eans || [];
    const nuevos = nuevosPorArticulo.get(articulo.id) || new Set();
    if (actuales.includes(codigoBarras)) {
      yaEstaban += 1;
      return;
    }
    nuevos.add(codigoBarras);
    nuevosPorArticulo.set(articulo.id, nuevos);
  });

  const cambios = [...nuevosPorArticulo.entries()].map(([id, nuevos]) => {
    const a = articulos.find((x) => x.id === id);
    return {
      id,
      codigoLojo: a?.codigo_lojo || "",
      nombre: a?.nombre || "",
      detalle: [...nuevos].join(", "),
      datos: { eans: [...new Set([...(a?.eans || []), ...nuevos])] },
    };
  });

  return {
    cambios,
    cifras: [
      { numero: cambios.reduce((s, c) => s + c.datos.eans.length - (articulos.find((a) => a.id === c.id)?.eans || []).length, 0), texto: "códigos nuevos", verde: true },
      { numero: cambios.length, texto: "artículos a actualizar" },
      { numero: yaEstaban, texto: "ya estaban guardados" },
      { numero: sinArticulo.size, texto: "códigos Lojo sin artículo" },
    ],
    sinArticulo: ordenarCodigos(sinArticulo),
    avisos: estropeados
      ? [
          `${estropeados} códigos venían estropeados por Excel (tipo "8,41E+12") y no se han cogido. Exporta el CSV directamente del programa, sin abrirlo y guardarlo con Excel.`,
        ]
      : [],
  };
}

// ---- Plan de importación de precios ----
function planPrecio(datos, colLojo, colValor, articulos, cambiarExistentes, rellenarBlancos) {
  const porCodigo = mapaPorCodigoLojo(articulos);
  const precioPorArticulo = new Map();
  const sinArticulo = new Set();
  const noValidos = [];

  datos.forEach((fila) => {
    const codigoLojo = normalizarCodigoLojo(fila[colLojo]);
    if (!codigoLojo) return;
    const precio = leerPrecio(fila[colValor]);
    if (precio === null) return;
    if (Number.isNaN(precio) || precio < 0) {
      noValidos.push(`${codigoLojo}: "${fila[colValor]}"`);
      return;
    }
    const articulo = porCodigo.get(codigoLojo);
    if (!articulo) {
      sinArticulo.add(codigoLojo);
      return;
    }
    // Si el código sale varias veces en el CSV, vale la última línea.
    precioPorArticulo.set(articulo.id, precio);
  });

  let nuevos = 0;
  let cambian = 0;
  let iguales = 0;
  let conPrecioSinTocar = 0;
  let enBlancoSinTocar = 0;
  const cambios = [];

  precioPorArticulo.forEach((precio, id) => {
    const a = articulos.find((x) => x.id === id);
    const antes = precioActual(a);
    if (antes !== null && Math.abs(antes - precio) < 0.00005) {
      iguales += 1;
      return;
    }
    if (antes !== null && !cambiarExistentes) {
      conPrecioSinTocar += 1;
      return;
    }
    if (antes === null && !rellenarBlancos) {
      enBlancoSinTocar += 1;
      return;
    }
    if (antes === null) nuevos += 1;
    else cambian += 1;
    cambios.push({
      id,
      codigoLojo: a?.codigo_lojo || "",
      nombre: a?.nombre || "",
      detalle: `${formatoEuros(antes)} → ${formatoEuros(precio)}`,
      datos: { precio },
    });
  });

  const cifras = [
    { numero: cambian, texto: "cambian de precio", verde: cambian > 0 },
    { numero: nuevos, texto: "en blanco que reciben precio", verde: nuevos > 0 },
    { numero: iguales, texto: "ya tenían ese precio" },
    { numero: sinArticulo.size, texto: "códigos Lojo sin artículo" },
  ];
  if (conPrecioSinTocar) cifras.push({ numero: conPrecioSinTocar, texto: "con precio que no se tocan" });
  if (enBlancoSinTocar) cifras.push({ numero: enBlancoSinTocar, texto: "en blanco que no se tocan" });

  return {
    cambios,
    cifras,
    cambian,
    nuevos,
    sinArticulo: ordenarCodigos(sinArticulo),
    avisos: noValidos.length
      ? [`${noValidos.length} precios no se entienden y no se han cogido: ${noValidos.slice(0, 8).join(" · ")}${noValidos.length > 8 ? "…" : ""}`]
      : [],
  };
}

export default function ImportarCsv({ articulos, eansDisponibles, onTerminado }) {
  const inputRef = useRef(null);
  const [abierto, setAbierto] = useState(false);
  // tipo | elegir | revisar | guardando | hecho
  const [fase, setFase] = useState("tipo");
  const [tipo, setTipo] = useState(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [csv, setCsv] = useState(null);
  const [colLojo, setColLojo] = useState(0);
  const [colValor, setColValor] = useState(0);
  const [cambiarExistentes, setCambiarExistentes] = useState(true);
  const [rellenarBlancos, setRellenarBlancos] = useState(false);
  const [error, setError] = useState("");
  const [progreso, setProgreso] = useState(0);
  const [fallos, setFallos] = useState([]);
  const [hechos, setHechos] = useState(0);

  const plan = useMemo(() => {
    if (!csv || !tipo) return null;
    return tipo === "ean"
      ? planEan(csv.datos, colLojo, colValor, articulos)
      : planPrecio(csv.datos, colLojo, colValor, articulos, cambiarExistentes, rellenarBlancos);
  }, [csv, tipo, colLojo, colValor, articulos, cambiarExistentes, rellenarBlancos]);

  function abrir() {
    setAbierto(true);
    setFase("tipo");
    setTipo(null);
    setCsv(null);
    setError("");
    setFallos([]);
    setProgreso(0);
    setNombreArchivo("");
    setCambiarExistentes(true);
    setRellenarBlancos(false);
  }

  function cerrar() {
    if (fase === "guardando") return;
    setAbierto(false);
  }

  function elegirTipo(nuevoTipo) {
    setTipo(nuevoTipo);
    setCsv(null);
    setError("");
    setFase("elegir");
  }

  async function alElegirArchivo(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    setError("");
    setNombreArchivo(archivo.name);
    try {
      const leido = leerCsv(await leerTexto(archivo));
      if (!leido.datos.length) {
        setError("El archivo no tiene filas con datos.");
        return;
      }
      const columnas = detectarColumnas(leido.cabecera, tipo);
      setColLojo(columnas.lojo);
      setColValor(columnas.valor);
      setCsv(leido);
      setFase("revisar");
    } catch (e) {
      setError(e.message || "No se pudo leer el archivo.");
    }
  }

  async function importar() {
    if (!plan?.cambios.length) return;

    // Confirmación antes de guardar.
    const lineas =
      tipo === "precio"
        ? [
            plan.cambian ? `• Cambiar el precio de ${plan.cambian} artículos que ya tienen PRECIO` : null,
            plan.nuevos ? `• Añadir precio a ${plan.nuevos} artículos que están en BLANCO` : null,
          ].filter(Boolean)
        : [`• Añadir códigos de barras a ${plan.cambios.length} artículos`];
    if (!window.confirm(`Se va a:\n\n${lineas.join("\n")}\n\n¿Seguro que quieres continuar?`)) return;

    setFase("guardando");
    setProgreso(0);
    const errores = [];
    let contador = 0;
    const pendientes = [...plan.cambios];
    const total = pendientes.length;

    async function trabajador() {
      while (pendientes.length) {
        const cambio = pendientes.shift();
        const { error: errorUpdate } = await supabase.from("articulos").update(cambio.datos).eq("id", cambio.id);
        if (errorUpdate) errores.push(`${cambio.codigoLojo} ${cambio.nombre}: ${errorUpdate.message}`);
        contador += 1;
        setProgreso(contador);
      }
    }

    await Promise.all(Array.from({ length: ACTUALIZACIONES_A_LA_VEZ }, trabajador));
    setFallos(errores);
    setHechos(total - errores.length);
    setFase("hecho");
    onTerminado?.();
  }

  const ejemplo = (col) => {
    const valores = (csv?.datos || [])
      .map((f) => f[col])
      .filter((v) => v)
      .slice(0, 2);
    return valores.length ? ` (ej.: ${valores.join(", ")})` : "";
  };

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        style={botonAbrir}
        title="Importar códigos de barras o precios desde un CSV del programa de gestión"
      >
        📥 Importar CSV
      </button>

      <input ref={inputRef} type="file" accept=".csv,.txt,text/csv" onChange={alElegirArchivo} style={{ display: "none" }} />

      {abierto && (
        <div style={fondo} onClick={cerrar}>
          <div style={ventana} onClick={(e) => e.stopPropagation()}>
            <div style={cabeceraVentana}>
              <h2 style={titulo}>{tipo ? `Importar ${TIPOS[tipo].titulo}` : "Importar CSV"}</h2>
              <button type="button" onClick={cerrar} style={botonCerrar} disabled={fase === "guardando"}>
                ✕
              </button>
            </div>

            {fase === "tipo" && (
              <>
                <p style={texto}>¿Qué quieres importar? Solo se tocan los artículos cuyo <b>Código Lojo</b> coincide.</p>
                <div style={opcionesTipo}>
                  {Object.entries(TIPOS).map(([clave, t]) => {
                    const desactivado = clave === "ean" && !eansDisponibles;
                    return (
                      <button
                        key={clave}
                        type="button"
                        style={{ ...opcionTipo, opacity: desactivado ? 0.5 : 1 }}
                        onClick={() => elegirTipo(clave)}
                        disabled={desactivado}
                      >
                        <span style={opcionIcono}>{t.icono}</span>
                        <span style={opcionTitulo}>{t.titulo}</span>
                        <span style={opcionTexto}>
                          {desactivado ? "Ejecuta antes supabase/migracion_eans.sql en Supabase." : t.descripcion}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {fase === "elegir" && (
              <>
                <p style={texto}>
                  Elige el CSV exportado del programa de gestión. Tiene que tener una columna con el{" "}
                  <b>código del artículo (Código Lojo)</b> y otra con{" "}
                  <b>{tipo === "ean" ? "el código de barras" : "el precio"}</b>.
                </p>
                <div style={botones}>
                  <button type="button" style={botonBlanco} onClick={() => setFase("tipo")}>
                    ← Atrás
                  </button>
                  <button type="button" style={botonVerde} onClick={() => inputRef.current?.click()}>
                    Elegir archivo CSV
                  </button>
                </div>
                {error && <div style={cajaError}>{error}</div>}
              </>
            )}

            {fase === "revisar" && plan && csv && (
              <>
                <div style={archivo}>📄 {nombreArchivo} · {csv.datos.length} filas</div>

                <div style={columnasGrid}>
                  <label style={campo}>
                    <span style={etiqueta}>Columna del Código Lojo</span>
                    <select value={colLojo} onChange={(e) => setColLojo(Number(e.target.value))} style={selector}>
                      {csv.cabecera.map((nombre, i) => (
                        <option key={i} value={i}>
                          {nombre}
                        </option>
                      ))}
                    </select>
                    <span style={ejemploTexto}>{ejemplo(colLojo)}</span>
                  </label>
                  <label style={campo}>
                    <span style={etiqueta}>{TIPOS[tipo].columnaValor}</span>
                    <select value={colValor} onChange={(e) => setColValor(Number(e.target.value))} style={selector}>
                      {csv.cabecera.map((nombre, i) => (
                        <option key={i} value={i}>
                          {nombre}
                        </option>
                      ))}
                    </select>
                    <span style={ejemploTexto}>{ejemplo(colValor)}</span>
                  </label>
                </div>

                {tipo === "precio" && (
                  <div style={casillas}>
                    <label style={casilla}>
                      <input
                        type="checkbox"
                        checked={cambiarExistentes}
                        onChange={(e) => setCambiarExistentes(e.target.checked)}
                      />
                      Cambiar solo los artículos que ya tienen PRECIO
                    </label>
                    <label style={casilla}>
                      <input
                        type="checkbox"
                        checked={rellenarBlancos}
                        onChange={(e) => setRellenarBlancos(e.target.checked)}
                      />
                      Añadir precios a artículos en BLANCO
                    </label>
                  </div>
                )}

                <div style={resumen}>
                  {plan.cifras.map((c) => (
                    <div key={c.texto} style={{ ...dato, ...(c.verde ? datoVerde : null) }}>
                      <div style={datoNumero}>{c.numero}</div>
                      <div style={datoTexto}>{c.texto}</div>
                    </div>
                  ))}
                </div>

                {plan.avisos.map((aviso) => (
                  <div key={aviso} style={cajaAviso}>
                    ⚠️ {aviso}
                  </div>
                ))}

                {plan.cambios.length > 0 && (
                  <details style={desplegable}>
                    <summary style={resumenDesplegable}>Ver artículos que se actualizan</summary>
                    <div style={lista}>
                      {plan.cambios.map((c) => (
                        <div key={c.id} style={filaLista}>
                          <b>{c.codigoLojo}</b> {c.nombre}: {c.detalle}
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
                    style={{ ...botonVerde, opacity: plan.cambios.length ? 1 : 0.5 }}
                    onClick={importar}
                    disabled={!plan.cambios.length}
                  >
                    {plan.cambios.length ? `Actualizar ${plan.cambios.length} artículos` : "No hay nada que cambiar"}
                  </button>
                </div>
              </>
            )}

            {fase === "guardando" && plan && (
              <p style={texto}>
                Guardando… {progreso} de {plan.cambios.length} artículos
              </p>
            )}

            {fase === "hecho" && (
              <>
                <div style={fallos.length ? cajaAviso : cajaOk}>
                  {fallos.length
                    ? `Terminado con ${fallos.length} errores. Los otros ${hechos} artículos se han guardado.`
                    : `✓ Hecho: ${hechos} artículos actualizados.`}
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
  maxWidth: "660px",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: "22px",
  padding: "22px",
  boxSizing: "border-box",
  boxShadow: "0 30px 60px rgba(0,0,0,0.25)",
};

const cabeceraVentana = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "12px" };
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
  flex: "0 0 auto",
};
const texto = { fontSize: "15px", color: "#334155", lineHeight: 1.5 };
const opcionesTipo = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" };
const opcionTipo = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "6px",
  textAlign: "left",
  border: "2px solid #e2e8f0",
  borderRadius: "18px",
  background: "#f8fafc",
  padding: "16px",
  cursor: "pointer",
};
const opcionIcono = { fontSize: "26px" };
const opcionTitulo = { fontSize: "16px", fontWeight: 950, color: "#0f172a" };
const opcionTexto = { fontSize: "13px", fontWeight: 700, color: "#64748b" };
const archivo = { fontSize: "14px", fontWeight: 800, color: "#475569", marginBottom: "12px" };
const columnasGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "12px" };
const campo = { display: "flex", flexDirection: "column", gap: "4px" };
const etiqueta = { fontSize: "13px", fontWeight: 900, color: "#334155" };
const selector = {
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "10px 12px",
  fontSize: "14px",
  fontWeight: 700,
  background: "#fff",
};
const ejemploTexto = { fontSize: "12px", color: "#64748b", fontWeight: 700, minHeight: "16px" };
const casillas = { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" };
const casilla = { display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 800, color: "#334155", cursor: "pointer" };
const resumen = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "10px", marginBottom: "12px" };
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
