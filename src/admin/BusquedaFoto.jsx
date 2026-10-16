// Admin → Búsqueda por foto.
//
// Prepara la "huella visual" de la foto de cada artículo para que los
// clientes puedan pedir haciendo una foto con el móvil. Hay que pulsar
// "Preparar pendientes" la primera vez y cada vez que se añadan artículos
// nuevos o se cambien fotos (la pantalla avisa de cuántos faltan).
//
// También permite probar: se sube una foto y se ve qué artículos
// encontraría la app del cliente.
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { supabaseStorage } from "../supabaseStorageClient";
import {
  VERSION_HUELLA,
  calcularHuella,
  miniaturaFoto,
  prepararModeloHuella,
} from "../utils/huellaFoto";
import { buscarArticulosPorFoto } from "../utils/buscarPorFoto";

const TAMANO_PAGINA = 1000;
const GUARDAR_CADA = 20;

function urlFoto(foto) {
  if (!foto) return "";
  if (String(foto).startsWith("http")) return foto;
  const { data } = supabaseStorage.storage.from("productos").getPublicUrl(foto);
  return data.publicUrl;
}

async function leerTodo(tabla, columnas, ordenarPor) {
  const filas = [];
  let desde = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from(tabla)
      .select(columnas)
      .order(ordenarPor, { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1);
    if (error) throw error;
    filas.push(...(data || []));
    if (!data || data.length < TAMANO_PAGINA) break;
    desde += TAMANO_PAGINA;
  }
  return filas;
}

export default function BusquedaFoto() {
  const [articulos, setArticulos] = useState([]);
  const [huellas, setHuellas] = useState(new Map());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [trabajando, setTrabajando] = useState(false);
  const [progreso, setProgreso] = useState({ hechos: 0, total: 0, actual: "" });
  const [descargaModelo, setDescargaModelo] = useState(null);
  const [fallos, setFallos] = useState([]);
  const pararRef = useRef(false);

  const [prueba, setPrueba] = useState(null); // { miniatura, resultados, buscando, error }
  const inputPruebaRef = useRef(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    setError("");
    try {
      const [listaArticulos, listaHuellas] = await Promise.all([
        leerTodo("articulos", "id, codigo_lojo, nombre, foto, activo, oculto", "id"),
        leerTodo("articulos_huella_foto", "articulo_id, foto, version", "articulo_id"),
      ]);
      setArticulos(listaArticulos);
      setHuellas(new Map(listaHuellas.map((h) => [String(h.articulo_id), h])));
    } catch (e) {
      console.error(e);
      setError(
        "No se pudo cargar. Comprueba que se ha ejecutado migracion_busqueda_foto.sql en Supabase."
      );
    }
    setCargando(false);
  }

  // Estado de cada artículo activo con foto.
  const resumen = useMemo(() => {
    const conFoto = articulos.filter((a) => a.activo !== false && a.foto);
    const pendientes = conFoto.filter((a) => {
      const h = huellas.get(String(a.id));
      return !h || h.version !== VERSION_HUELLA || h.foto !== a.foto;
    });
    const sinFoto = articulos.filter((a) => a.activo !== false && !a.foto).length;
    return { conFoto, pendientes, sinFoto, listos: conFoto.length - pendientes.length };
  }, [articulos, huellas]);

  async function guardarLote(lote) {
    if (!lote.length) return;
    const { error: errorGuardar } = await supabase
      .from("articulos_huella_foto")
      .upsert(lote, { onConflict: "articulo_id" });
    if (errorGuardar) throw errorGuardar;
  }

  async function preparar(lista) {
    if (!lista.length || trabajando) return;
    pararRef.current = false;
    setTrabajando(true);
    setFallos([]);
    setProgreso({ hechos: 0, total: lista.length, actual: "Cargando el reconocimiento de fotos…" });

    try {
      await prepararModeloHuella((info) => setDescargaModelo(info));
    } catch (e) {
      console.error(e);
      setError("No se pudo descargar el modelo de reconocimiento. Revisa la conexión a internet.");
      setTrabajando(false);
      return;
    }
    setDescargaModelo(null);

    const nuevosFallos = [];
    const nuevasHuellas = new Map(huellas);
    let lote = [];

    for (let i = 0; i < lista.length; i += 1) {
      if (pararRef.current) break;
      const articulo = lista[i];
      setProgreso({ hechos: i, total: lista.length, actual: articulo.nombre });

      try {
        const huella = await calcularHuella(urlFoto(articulo.foto));
        const fila = {
          articulo_id: String(articulo.id),
          foto: articulo.foto,
          version: VERSION_HUELLA,
          huella: JSON.stringify(huella),
          actualizado_en: new Date().toISOString(),
        };
        lote.push(fila);
        nuevasHuellas.set(fila.articulo_id, { articulo_id: fila.articulo_id, foto: fila.foto, version: fila.version });
      } catch (e) {
        console.warn("Foto no procesada", articulo, e);
        nuevosFallos.push(articulo);
      }

      if (lote.length >= GUARDAR_CADA) {
        try {
          await guardarLote(lote);
        } catch (e) {
          console.error(e);
          setError("Error al guardar en Supabase: " + (e.message || e));
          pararRef.current = true;
        }
        lote = [];
        setHuellas(new Map(nuevasHuellas));
      }
    }

    try {
      await guardarLote(lote);
    } catch (e) {
      console.error(e);
      setError("Error al guardar en Supabase: " + (e.message || e));
    }

    setHuellas(new Map(nuevasHuellas));
    setFallos(nuevosFallos);
    setProgreso((p) => ({ ...p, hechos: p.total, actual: "" }));
    setTrabajando(false);
  }

  async function probarFoto(archivo) {
    if (!archivo) return;
    setPrueba({ miniatura: null, resultados: [], buscando: true, error: "" });
    try {
      const miniatura = await miniaturaFoto(archivo);
      setPrueba((p) => ({ ...p, miniatura }));
      const visibles = articulos.filter((a) => a.activo !== false && !a.oculto);
      const { resultados: lista, palabrasLeidas } = await buscarArticulosPorFoto(archivo, visibles, {
        limite: 8,
        onProgreso: (info) => setDescargaModelo(info?.fase === "listo" ? null : info),
      });
      setDescargaModelo(null);
      const resultados = lista.map((r) => ({
        ...r.producto,
        similitud: r.similitud,
        puntosTexto: r.puntosTexto,
      }));
      setPrueba({ miniatura, resultados, palabrasLeidas, buscando: false, error: "" });
    } catch (e) {
      console.error(e);
      setPrueba((p) => ({ ...p, buscando: false, error: "No se pudo buscar: " + (e.message || e) }));
    }
  }

  const porcentaje = progreso.total ? Math.round((progreso.hechos / progreso.total) * 100) : 0;

  return (
    <div style={estilos.pagina}>
      <h2 style={estilos.titulo}>📷 Búsqueda por foto</h2>
      <p style={estilos.texto}>
        Los clientes pueden hacer una foto a un artículo con el móvil y la app busca en el catálogo
        el que más se parece. Para eso cada foto del catálogo necesita su <b>huella</b>: pulsa{" "}
        <b>Preparar pendientes</b> la primera vez y siempre que añadas artículos o cambies fotos.
        Se hace en este ordenador; puede tardar unos minutos y no hay que cerrar la pantalla.
      </p>

      {error && <div style={estilos.error}>{error}</div>}

      {cargando ? (
        <p style={estilos.texto}>Cargando…</p>
      ) : (
        <>
          <div style={estilos.tarjetas}>
            <div style={estilos.tarjeta}>
              <span style={estilos.numero}>{resumen.listos}</span>
              <span>listos</span>
            </div>
            <div style={{ ...estilos.tarjeta, ...(resumen.pendientes.length ? estilos.tarjetaAviso : {}) }}>
              <span style={estilos.numero}>{resumen.pendientes.length}</span>
              <span>pendientes</span>
            </div>
            <div style={estilos.tarjeta}>
              <span style={estilos.numero}>{resumen.sinFoto}</span>
              <span>sin foto (no se pueden reconocer)</span>
            </div>
          </div>

          <div style={estilos.botones}>
            {!trabajando ? (
              <>
                <button
                  type="button"
                  style={estilos.botonPrincipal}
                  disabled={!resumen.pendientes.length}
                  onClick={() => preparar(resumen.pendientes)}
                >
                  Preparar pendientes ({resumen.pendientes.length})
                </button>
                <button
                  type="button"
                  style={estilos.botonSecundario}
                  disabled={!resumen.conFoto.length}
                  onClick={() => {
                    if (window.confirm(`¿Volver a preparar las ${resumen.conFoto.length} fotos?`)) {
                      preparar(resumen.conFoto);
                    }
                  }}
                >
                  Rehacer todas
                </button>
              </>
            ) : (
              <button
                type="button"
                style={estilos.botonParar}
                onClick={() => {
                  pararRef.current = true;
                }}
              >
                Parar
              </button>
            )}
          </div>

          {descargaModelo?.fase === "descargando" && (
            <p style={estilos.texto}>
              Descargando el reconocimiento de fotos (solo la primera vez)… {descargaModelo.porcentaje}%
            </p>
          )}

          {(trabajando || progreso.total > 0) && (
            <div style={estilos.progresoCaja}>
              <div style={estilos.barra}>
                <div style={{ ...estilos.barraRelleno, width: `${porcentaje}%` }} />
              </div>
              <div style={estilos.textoPequeno}>
                {progreso.hechos} de {progreso.total}
                {progreso.actual ? ` · ${progreso.actual}` : trabajando ? "" : " · terminado"}
              </div>
            </div>
          )}

          {fallos.length > 0 && (
            <div style={estilos.error}>
              No se pudieron leer {fallos.length} fotos (puede que el archivo no exista en Storage):
              <ul style={{ margin: "6px 0 0", paddingLeft: "18px" }}>
                {fallos.slice(0, 30).map((a) => (
                  <li key={a.id}>
                    {a.codigo_lojo ? `${a.codigo_lojo} · ` : ""}
                    {a.nombre} ({a.foto})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <hr style={estilos.separador} />

          <h3 style={estilos.subtitulo}>Probar</h3>
          <p style={estilos.texto}>
            Sube una foto (o hazla con el móvil) y verás los artículos que le saldrían al cliente, en el
            mismo orden. Debajo de cada uno: cuánto se parece la foto y cuánto coincide el texto de la
            etiqueta con su nombre.
          </p>
          <input
            ref={inputPruebaRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => {
              probarFoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            style={estilos.botonSecundario}
            disabled={trabajando || !resumen.listos}
            onClick={() => inputPruebaRef.current?.click()}
          >
            Elegir foto de prueba
          </button>

          {prueba && (
            <div style={estilos.prueba}>
              {prueba.miniatura && <img src={prueba.miniatura} alt="Foto de prueba" style={estilos.fotoPrueba} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                {prueba.buscando && <p style={estilos.texto}>Buscando…</p>}
                {prueba.error && <div style={estilos.error}>{prueba.error}</div>}
                {!prueba.buscando && !prueba.error && (
                  <p style={{ ...estilos.texto, marginBottom: "8px" }}>
                    <b>Texto leído en la etiqueta:</b>{" "}
                    {prueba.palabrasLeidas?.length ? prueba.palabrasLeidas.join(" · ") : "(no se ha leído nada claro)"}
                  </p>
                )}
                {!prueba.buscando && !prueba.error && !prueba.resultados.length && (
                  <p style={estilos.texto}>No se encontró nada.</p>
                )}
                <div style={estilos.rejilla}>
                  {prueba.resultados.map((r, i) => (
                    <div key={r.id} style={{ ...estilos.resultado, ...(i === 0 ? estilos.resultadoPrimero : {}) }}>
                      <img src={urlFoto(r.foto)} alt="" style={estilos.fotoResultado} />
                      <div style={estilos.nombreResultado}>{r.nombre}</div>
                      <div style={estilos.textoPequeno}>
                        Foto {Math.round(r.similitud * 100)}% · Texto {Math.round((r.puntosTexto || 0) * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const estilos = {
  pagina: { display: "flex", flexDirection: "column", gap: "12px", color: "#111827" },
  titulo: { margin: 0, fontSize: "22px" },
  subtitulo: { margin: 0, fontSize: "18px" },
  texto: { margin: 0, color: "#4b5563", fontSize: "14px", lineHeight: 1.45 },
  textoPequeno: { color: "#6b7280", fontSize: "12px" },
  error: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "13px",
  },
  tarjetas: { display: "flex", flexWrap: "wrap", gap: "10px" },
  tarjeta: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: "130px",
    padding: "12px 14px",
    borderRadius: "12px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    fontSize: "13px",
    color: "#4b5563",
  },
  tarjetaAviso: { background: "#fffbeb", borderColor: "#fcd34d" },
  numero: { fontSize: "26px", fontWeight: 900, color: "#111827" },
  botones: { display: "flex", flexWrap: "wrap", gap: "10px" },
  botonPrincipal: {
    padding: "11px 18px",
    borderRadius: "10px",
    border: "none",
    background: "#16a34a",
    color: "#fff",
    fontWeight: 800,
    fontSize: "14px",
    cursor: "pointer",
  },
  botonSecundario: {
    padding: "11px 18px",
    borderRadius: "10px",
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111827",
    fontWeight: 700,
    fontSize: "14px",
    cursor: "pointer",
    alignSelf: "flex-start",
  },
  botonParar: {
    padding: "11px 18px",
    borderRadius: "10px",
    border: "none",
    background: "#dc2626",
    color: "#fff",
    fontWeight: 800,
    fontSize: "14px",
    cursor: "pointer",
  },
  progresoCaja: { display: "flex", flexDirection: "column", gap: "6px", maxWidth: "520px" },
  barra: { height: "10px", borderRadius: "999px", background: "#e5e7eb", overflow: "hidden" },
  barraRelleno: { height: "100%", background: "#16a34a", transition: "width 0.2s" },
  separador: { border: "none", borderTop: "1px solid #e5e7eb", margin: "8px 0" },
  prueba: { display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-start" },
  fotoPrueba: { width: "160px", borderRadius: "12px", border: "1px solid #e5e7eb" },
  rejilla: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: "10px",
  },
  resultado: {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "8px",
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  resultadoPrimero: { borderColor: "#16a34a", boxShadow: "0 0 0 2px rgba(22,163,74,0.25)" },
  fotoResultado: { width: "100%", aspectRatio: "1 / 1", objectFit: "contain", background: "#f9fafb", borderRadius: "8px" },
  nombreResultado: { fontSize: "12px", fontWeight: 700, lineHeight: 1.25 },
};
