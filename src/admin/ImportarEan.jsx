// Importar CSV del programa de gestión (Admin > Artículos > "Importar CSV").
//
// Un único CSV con Código Lojo, código de barras (EAN) y PVP:
//   - Códigos de barras: se AÑADEN los códigos nuevos a cada artículo.
//     Nunca se borra ninguno. Si un artículo tiene varios EAN, sale en varias
//     filas y se añaden todos.
//   - Precio (PVP): se pone en el campo "precio" (vale la última fila con precio).
//
// Solo se tocan los artículos cuyo Código Lojo coincide con el código del CSV
// (sin espacios ni ceros a la izquierda). Nunca se crean artículos nuevos.
// Antes de guardar se enseña un resumen para confirmar.
import { useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const ACTUALIZACIONES_A_LA_VEZ = 8;

function normalizarCodigoLojo(valor) {
  return String(valor ?? "").trim().replace(/^0+(?=.)/, "");
}

function limpiarCodigoBarras(valor) {
  return String(valor ?? "").replace(/\s/g, "");
}

// Precios con IVA incluido, siempre redondeados a 2 decimales:
// "1.234,56 €" -> 1234.56 · "2,35" -> 2.35 · "0,59565" -> 0.6 · "" -> null
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
  return Math.round((Number(t) + Number.EPSILON) * 100) / 100;
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

function detectarColumnas(cabecera, datos) {
  const normal = cabecera.map(sinTildes);
  let lojo = normal.findIndex((c) => /lojo/.test(c));
  if (lojo === -1) lojo = normal.findIndex((c) => /cod/.test(c) && /art/.test(c) && !/barra|ean/.test(c));
  if (lojo === -1) lojo = normal.findIndex((c) => /^cod|codigo/.test(c) && !/barra|ean/.test(c));

  let ean = normal.findIndex((c, i) => i !== lojo && /barra|ean/.test(c));
  let pvp = normal.findIndex((c, i) => i !== lojo && i !== ean && /pvp|p\.v\.p|precio|tarifa|importe/.test(c));

  // Sin cabecera: mismo orden que el export del programa (Cod. Art. 3ª, Cód. Barras 5ª).
  if (lojo === -1) lojo = Math.min(2, cabecera.length - 1);
  if (ean === -1) {
    // La columna con más valores tipo código de barras (8 a 14 cifras).
    ean = mejorColumna(cabecera.length, datos, [lojo], (v) => /^\d{8,14}$/.test(limpiarCodigoBarras(v)));
  }
  if (pvp === -1) {
    // La columna con más valores tipo precio ("2,35", "12.50").
    pvp = mejorColumna(cabecera.length, datos, [lojo, ean], (v) => /^\d{1,6}[.,]\d{1,4}\s*€?$/.test(String(v).trim()));
  }
  return { lojo, ean, pvp };
}

// Devuelve el índice de la columna donde más filas cumplen la condición, o -1.
function mejorColumna(numColumnas, datos, excluir, cumple) {
  const muestra = datos.slice(0, 200);
  let mejor = -1;
  let mejorCuenta = 0;
  for (let i = 0; i < numColumnas; i += 1) {
    if (excluir.includes(i)) continue;
    const cuenta = muestra.filter((f) => f[i] && cumple(f[i])).length;
    if (cuenta > mejorCuenta) {
      mejor = i;
      mejorCuenta = cuenta;
    }
  }
  return mejorCuenta >= Math.max(1, muestra.length * 0.3) ? mejor : -1;
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

// ---- Plan de importación: códigos de barras + precios desde el mismo CSV ----
// Cada fila: Código Lojo, código de barras y PVP. Si un artículo tiene varios
// códigos de barras sale en varias filas: se AÑADEN todos (nunca se borra
// ninguno) y para el precio vale la última fila que lo traiga.
function planImportacion(datos, cols, articulos, opciones) {
  const { lojo: colLojo, ean: colEan, pvp: colPvp } = cols;
  const { cambiarExistentes, rellenarBlancos } = opciones;
  const porCodigo = mapaPorCodigoLojo(articulos);
  const porId = new Map(articulos.map((a) => [a.id, a]));

  const eansNuevosPorArticulo = new Map();
  const precioPorArticulo = new Map();
  const sinArticulo = new Set();
  const preciosNoValidos = [];
  let eansYaEstaban = 0;
  let eansEstropeados = 0;

  datos.forEach((fila) => {
    const codigoLojo = normalizarCodigoLojo(fila[colLojo]);
    if (!codigoLojo) return;
    const articulo = porCodigo.get(codigoLojo);

    // Código de barras
    if (colEan > -1) {
      const codigoBarras = limpiarCodigoBarras(fila[colEan]);
      if (codigoBarras && /e\+/i.test(codigoBarras)) {
        eansEstropeados += 1;
      } else if (codigoBarras && /\d/.test(codigoBarras)) {
        if (!articulo) sinArticulo.add(codigoLojo);
        else if ((articulo.eans || []).includes(codigoBarras)) eansYaEstaban += 1;
        else {
          const nuevos = eansNuevosPorArticulo.get(articulo.id) || new Set();
          nuevos.add(codigoBarras);
          eansNuevosPorArticulo.set(articulo.id, nuevos);
        }
      }
    }

    // Precio
    if (colPvp > -1) {
      const precio = leerPrecio(fila[colPvp]);
      if (precio !== null) {
        if (Number.isNaN(precio) || precio < 0) {
          preciosNoValidos.push(`${codigoLojo}: "${fila[colPvp]}"`);
        } else if (!articulo) {
          sinArticulo.add(codigoLojo);
        } else {
          precioPorArticulo.set(articulo.id, precio);
        }
      }
    }
  });

  // Decidir qué precios se cambian.
  let preciosCambian = 0;
  let preciosNuevos = 0;
  let preciosIguales = 0;
  let conPrecioSinTocar = 0;
  let enBlancoSinTocar = 0;
  const precioFinal = new Map(); // id -> { antes, precio }

  precioPorArticulo.forEach((precio, id) => {
    const antes = precioActual(porId.get(id));
    if (antes !== null && Math.abs(antes - precio) < 0.005) {
      preciosIguales += 1;
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
    if (antes === null) preciosNuevos += 1;
    else preciosCambian += 1;
    precioFinal.set(id, { antes, precio });
  });

  // Juntar en un solo cambio por artículo.
  const ids = new Set([...eansNuevosPorArticulo.keys(), ...precioFinal.keys()]);
  let eansNuevosTotal = 0;
  const cambios = [...ids].map((id) => {
    const a = porId.get(id);
    const datosCambio = {};
    const detalle = [];
    const nuevos = eansNuevosPorArticulo.get(id);
    if (nuevos?.size) {
      datosCambio.eans = [...new Set([...(a?.eans || []), ...nuevos])];
      eansNuevosTotal += nuevos.size;
      detalle.push(`▥ + ${[...nuevos].join(", ")}`);
    }
    const p = precioFinal.get(id);
    if (p) {
      datosCambio.precio = p.precio;
      detalle.push(`💶 ${formatoEuros(p.antes)} → ${formatoEuros(p.precio)}`);
    }
    return {
      id,
      codigoLojo: a?.codigo_lojo || "",
      nombre: a?.nombre || "",
      detalle: detalle.join(" · "),
      datos: datosCambio,
    };
  });
  cambios.sort((x, y) => String(x.codigoLojo).localeCompare(String(y.codigoLojo), "es", { numeric: true }));

  const cifras = [{ numero: cambios.length, texto: "artículos a actualizar", verde: cambios.length > 0 }];
  if (colEan > -1) {
    cifras.push({ numero: eansNuevosTotal, texto: "códigos de barras nuevos", verde: eansNuevosTotal > 0 });
    cifras.push({ numero: eansYaEstaban, texto: "códigos ya guardados" });
  }
  if (colPvp > -1) {
    cifras.push({ numero: preciosCambian, texto: "cambian de precio", verde: preciosCambian > 0 });
    cifras.push({ numero: preciosNuevos, texto: "en blanco que reciben precio", verde: preciosNuevos > 0 });
    cifras.push({ numero: preciosIguales, texto: "ya tenían ese precio" });
    if (conPrecioSinTocar) cifras.push({ numero: conPrecioSinTocar, texto: "con precio que no se tocan" });
    if (enBlancoSinTocar) cifras.push({ numero: enBlancoSinTocar, texto: "en blanco que no se tocan" });
  }
  cifras.push({ numero: sinArticulo.size, texto: "códigos Lojo sin artículo" });

  const avisos = [];
  if (eansEstropeados) {
    avisos.push(
      `${eansEstropeados} códigos de barras venían estropeados por Excel (tipo "8,41E+12") y no se han cogido. Exporta el CSV directamente del programa, sin abrirlo y guardarlo con Excel.`
    );
  }
  if (preciosNoValidos.length) {
    avisos.push(
      `${preciosNoValidos.length} precios no se entienden y no se han cogido: ${preciosNoValidos.slice(0, 8).join(" · ")}${preciosNoValidos.length > 8 ? "…" : ""}`
    );
  }

  return {
    cambios,
    cifras,
    eansNuevosTotal,
    articulosConEans: eansNuevosPorArticulo.size,
    preciosCambian,
    preciosNuevos,
    sinArticulo: ordenarCodigos(sinArticulo),
    avisos,
  };
}

export default function ImportarCsv({ articulos, eansDisponibles, onTerminado }) {
  const inputRef = useRef(null);
  const [abierto, setAbierto] = useState(false);
  // elegir | revisar | guardando | hecho
  const [fase, setFase] = useState("elegir");
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [csv, setCsv] = useState(null);
  const [colLojo, setColLojo] = useState(0);
  const [colEan, setColEan] = useState(-1);
  const [colPvp, setColPvp] = useState(-1);
  const [cambiarExistentes, setCambiarExistentes] = useState(true);
  const [rellenarBlancos, setRellenarBlancos] = useState(false);
  const [error, setError] = useState("");
  const [progreso, setProgreso] = useState(0);
  const [fallos, setFallos] = useState([]);
  const [hechos, setHechos] = useState(0);

  // Si la columna eans no existe aún en Supabase, no se importan códigos de barras.
  const colEanEfectiva = eansDisponibles ? colEan : -1;

  const plan = useMemo(() => {
    if (!csv) return null;
    return planImportacion(
      csv.datos,
      { lojo: colLojo, ean: colEanEfectiva, pvp: colPvp },
      articulos,
      { cambiarExistentes, rellenarBlancos }
    );
  }, [csv, colLojo, colEanEfectiva, colPvp, articulos, cambiarExistentes, rellenarBlancos]);

  function abrir() {
    setAbierto(true);
    setFase("elegir");
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
      const columnas = detectarColumnas(leido.cabecera, leido.datos);
      setColLojo(columnas.lojo);
      setColEan(columnas.ean);
      setColPvp(columnas.pvp);
      setCsv(leido);
      setFase("revisar");
    } catch (e) {
      setError(e.message || "No se pudo leer el archivo.");
      setFase("elegir");
    }
  }

  async function importar() {
    if (!plan?.cambios.length) return;

    // Confirmación antes de guardar.
    const lineas = [
      plan.eansNuevosTotal
        ? `• Añadir ${plan.eansNuevosTotal} códigos de barras nuevos a ${plan.articulosConEans} artículos`
        : null,
      plan.preciosCambian ? `• Cambiar el precio de ${plan.preciosCambian} artículos que ya tienen PRECIO` : null,
      plan.preciosNuevos ? `• Añadir precio a ${plan.preciosNuevos} artículos que están en BLANCO` : null,
    ].filter(Boolean);
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
    if (col < 0) return "";
    const valores = (csv?.datos || [])
      .map((f) => f[col])
      .filter((v) => v)
      .slice(0, 2);
    return valores.length ? ` (ej.: ${valores.join(", ")})` : "";
  };

  const selectorColumna = (valor, alCambiar, permitirNinguna) => (
    <select value={valor} onChange={(e) => alCambiar(Number(e.target.value))} style={selector}>
      {permitirNinguna && <option value={-1}>— No importar —</option>}
      {csv.cabecera.map((nombre, i) => (
        <option key={i} value={i}>
          {nombre}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        style={botonAbrir}
        title="Importar códigos de barras y precios desde el CSV del programa de gestión"
      >
        📥 Importar CSV
      </button>

      <input ref={inputRef} type="file" accept=".csv,.txt,text/csv" onChange={alElegirArchivo} style={{ display: "none" }} />

      {abierto && (
        <div style={fondo} onClick={cerrar}>
          <div style={ventana} onClick={(e) => e.stopPropagation()}>
            <div style={cabeceraVentana}>
              <h2 style={titulo}>Importar CSV de artículos</h2>
              <button type="button" onClick={cerrar} style={botonCerrar} disabled={fase === "guardando"}>
                ✕
              </button>
            </div>

            {fase === "elegir" && (
              <>
                <p style={texto}>
                  Elige el CSV exportado del programa de gestión con el <b>Código Lojo</b>, el <b>código de barras (EAN)</b>{" "}
                  y el <b>PVP</b>. Se añaden los códigos de barras nuevos (nunca se borra ninguno) y se actualiza el precio.
                  Solo se tocan los artículos cuyo Código Lojo coincide; nunca se crean artículos nuevos.
                </p>
                {!eansDisponibles && (
                  <div style={cajaAviso}>
                    ⚠️ Los códigos de barras no se importarán hasta ejecutar supabase/migracion_eans.sql en Supabase. Los
                    precios sí.
                  </div>
                )}
                <div style={botones}>
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
                    {selectorColumna(colLojo, setColLojo, false)}
                    <span style={ejemploTexto}>{ejemplo(colLojo)}</span>
                  </label>
                  <label style={campo}>
                    <span style={etiqueta}>Columna del código de barras</span>
                    {eansDisponibles ? (
                      selectorColumna(colEan, setColEan, true)
                    ) : (
                      <span style={ejemploTexto}>No disponible (falta migracion_eans.sql)</span>
                    )}
                    <span style={ejemploTexto}>{ejemplo(colEanEfectiva)}</span>
                  </label>
                  <label style={campo}>
                    <span style={etiqueta}>Columna del PVP</span>
                    {selectorColumna(colPvp, setColPvp, true)}
                    <span style={ejemploTexto}>{ejemplo(colPvp)}</span>
                  </label>
                </div>

                {colPvp > -1 && (
                  <div style={casillas}>
                    <label style={casilla}>
                      <input
                        type="checkbox"
                        checked={cambiarExistentes}
                        onChange={(e) => setCambiarExistentes(e.target.checked)}
                      />
                      Cambiar el precio de los artículos que ya tienen PRECIO
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
                {error && <div style={cajaError}>{error}</div>}
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
  maxWidth: "720px",
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
const archivo = { fontSize: "14px", fontWeight: 800, color: "#475569", marginBottom: "12px" };
const columnasGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "12px", marginBottom: "12px" };
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
