import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { urlFotoArticulo, input, botonSecundario, botonIcono } from "./lojopolyEstilos";

// Artículo y cantidad que se entregan como regalo (premio de grupo o premio
// de casilla especial). Sirve para la valoración de regalos en el programa
// de gestión (Admin → 🎁 Regalos → Valoración).

let articulosPromesa = null;
function cargarArticulos() {
  if (!articulosPromesa) {
    articulosPromesa = supabase
      .from("articulos")
      .select("id, codigo, nombre, foto, activo")
      .order("nombre", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          articulosPromesa = null;
          throw error;
        }
        return data || [];
      });
  }
  return articulosPromesa;
}

const normalizar = (v) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export default function LojoPolyArticuloPremio({ idBase, articuloId, cantidad, ocupado, onCambiar }) {
  const [articulos, setArticulos] = useState([]);
  const [error, setError] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    let cancelado = false;
    cargarArticulos()
      .then((lista) => !cancelado && setArticulos(lista))
      .catch((err) => !cancelado && setError(err?.message || "No se han podido cargar los artículos."));
    return () => {
      cancelado = true;
    };
  }, []);

  const actual = useMemo(
    () => (articuloId ? articulos.find((a) => String(a.id) === String(articuloId)) : null),
    [articulos, articuloId]
  );

  const resultados = useMemo(() => {
    const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
    if (!palabras.length) return [];
    return articulos
      .filter((a) => a.activo !== false)
      .filter((a) => {
        const t = normalizar(`${a.nombre} ${a.codigo}`);
        return palabras.every((p) => t.includes(p));
      })
      .slice(0, 20);
  }, [articulos, busqueda]);

  const cant = Number(cantidad ?? 1);
  const foto = actual ? urlFotoArticulo(actual.foto) : null;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Artículo que se regala:</span>
        {articuloId ? (
          <span style={pastillaArticulo}>
            <span style={miniFoto}>{foto ? <img src={foto} alt="" style={fotoImg} /> : "🎁"}</span>
            <span>
              <strong>{actual?.nombre || "Artículo"}</strong>
              <span style={{ color: "#6b7280" }}> · Cód. {actual?.codigo || "—"}</span>
            </span>
          </span>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700, color: "#b45309" }}>⚠️ Sin artículo (no saldrá código en la valoración)</span>
        )}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>
          Cantidad
          <input
            id={`${idBase}-cantidad`}
            key={`c-${cant}`}
            type="number"
            min={0.01}
            step="any"
            style={{ ...input, width: 80 }}
            defaultValue={cant}
            disabled={ocupado}
            onBlur={(e) => {
              const valor = Number(e.target.value);
              if (valor > 0 && valor !== cant) onCambiar({ cantidad: valor });
            }}
          />
        </label>
        <button type="button" style={botonSecundario} disabled={ocupado} onClick={() => setBuscando((b) => !b)}>
          {articuloId ? "Cambiar artículo" : "Elegir artículo"}
        </button>
        {articuloId && (
          <button type="button" style={{ ...botonIcono, color: "#b91c1c" }} disabled={ocupado} onClick={() => onCambiar({ articulo_id: null })} aria-label="Quitar artículo" title="Quitar artículo">
            ✕
          </button>
        )}
      </div>

      {error && <span style={{ fontSize: 12, color: "#991b1b" }}>{error}</span>}

      {buscando && (
        <div style={{ display: "grid", gap: 6, padding: 10, borderRadius: 10, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
          <input
            id={`${idBase}-buscar`}
            style={input}
            autoFocus
            placeholder="Busca el artículo por nombre o código"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <div style={{ display: "grid", gap: 4, maxHeight: 260, overflowY: "auto" }}>
            {resultados.map((a) => (
              <button
                key={a.id}
                type="button"
                style={resultado}
                onClick={() => {
                  onCambiar({ articulo_id: a.id });
                  setBuscando(false);
                  setBusqueda("");
                }}
              >
                <strong style={{ color: "#111827" }}>{a.nombre}</strong>
                <span style={{ color: "#6b7280", fontSize: 12 }}> · Cód. {a.codigo || "—"}</span>
              </button>
            ))}
            {busqueda && resultados.length === 0 && <span style={{ fontSize: 13, color: "#6b7280" }}>No hay artículos que coincidan.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

const pastillaArticulo = { display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px 4px 4px", borderRadius: 999, background: "#eef2ff", fontSize: 13 };
const miniFoto = { width: 28, height: 28, borderRadius: 999, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", fontSize: 14 };
const fotoImg = { width: "100%", height: "100%", objectFit: "contain" };
const resultado = { textAlign: "left", padding: "7px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 14 };
