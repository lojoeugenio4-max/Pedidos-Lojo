import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  contenedor,
  tituloSeccion,
  campo,
  campoCheckbox,
  input,
  fila,
  boton,
  botonIcono,
  avisoError,
  avisoOk,
  ayuda,
  urlFotoArticulo,
} from "./lojopolyEstilos";

// COMODÍN: departamentos y/o artículos comodín. Si un pedido lleva al menos
// N cajas de artículos DISTINTOS de ellos, gana 1 tirada extra (aparte de
// los máximos por pedido y por día). En la TV, antes de esa tirada, sale
// José Luis o Rafa y dice la frase de aquí.

const FRASE_EJEMPLO = "Has comprado mucha charcutería… ¡te regalo una tirada extra!";

const normalizar = (v) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export default function CarreraComodin({ edicion, onGuardado }) {
  const [form, setForm] = useState(null);
  const [departamentos, setDepartamentos] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const bloqueada = edicion.estado === "terminada";

  useEffect(() => {
    supabase
      .from("departamentos")
      .select("id,nombre")
      .order("nombre", { ascending: true })
      .then(({ data }) => setDepartamentos(data || []));
    supabase
      .from("articulos")
      .select("id,codigo,nombre,foto,activo")
      .order("nombre", { ascending: true })
      .then(({ data }) => setArticulos(data || []));
  }, []);

  useEffect(() => {
    setForm({
      activo: Boolean(edicion.comodin_activo),
      cajas: edicion.comodin_cajas ?? 3,
      departamentos: new Set((edicion.comodin_departamentos || []).map(String)),
      articulos: (edicion.comodin_articulos || []).map(String),
      frase: edicion.comodin_frase || FRASE_EJEMPLO,
    });
  }, [edicion]);

  const resultados = useMemo(() => {
    const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
    if (!palabras.length || !form) return [];
    return articulos
      .filter((a) => a.activo !== false && !form.articulos.includes(String(a.id)))
      .filter((a) => palabras.every((p) => normalizar(`${a.nombre} ${a.codigo}`).includes(p)))
      .slice(0, 15);
  }, [articulos, busqueda, form]);

  if (!form) return null;

  const cambiar = (cambios) => setForm((a) => ({ ...a, ...cambios }));
  const alternarDepartamento = (id) =>
    setForm((a) => {
      const s = new Set(a.departamentos);
      const k = String(id);
      if (s.has(k)) s.delete(k);
      else s.add(k);
      return { ...a, departamentos: s };
    });
  const anadirArticulo = (id) => {
    cambiar({ articulos: [...form.articulos, String(id)] });
    setBusqueda("");
  };
  const quitarArticulo = (id) => cambiar({ articulos: form.articulos.filter((x) => x !== String(id)) });

  const cajas = Math.max(1, Math.round(Number(form.cajas) || 1));
  const nombresDeps = departamentos.filter((d) => form.departamentos.has(String(d.id))).map((d) => d.nombre);
  const articulosElegidos = form.articulos.map((id) => articulos.find((a) => String(a.id) === id) || { id, nombre: `Artículo ${id}` });

  async function guardar() {
    setMensaje("");
    setError("");
    if (form.activo && form.departamentos.size === 0 && form.articulos.length === 0) {
      setError("Elige al menos un departamento o un artículo comodín (o desmarca «Comodín activo»).");
      return;
    }
    if (form.activo && !String(form.frase || "").trim()) {
      setError("Escribe la frase que dirá José Luis o Rafa.");
      return;
    }
    setGuardando(true);
    const { error: err } = await supabase
      .from("carrera_ediciones")
      .update({
        comodin_activo: Boolean(form.activo),
        comodin_cajas: cajas,
        comodin_departamentos: [...form.departamentos],
        comodin_articulos: form.articulos,
        comodin_frase: String(form.frase || "").trim() || FRASE_EJEMPLO,
        updated_at: new Date().toISOString(),
      })
      .eq("id", edicion.id);
    setGuardando(false);
    if (err) {
      setError(
        err.message?.includes("comodin")
          ? "Falta aplicar la migración migracion_carrera_mitad_comodin.sql en Supabase."
          : `No se ha podido guardar: ${err.message}`
      );
      return;
    }
    setMensaje("Comodín guardado.");
    onGuardado?.();
  }

  return (
    <div style={contenedor}>
      <h4 style={tituloSeccion}>🃏 Tirada extra de comodín</h4>
      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}

      <label style={campoCheckbox}>
        <input type="checkbox" checked={form.activo} disabled={bloqueada} onChange={(e) => cambiar({ activo: e.target.checked })} />
        <span>Comodín activo</span>
      </label>

      <label style={{ ...campo, maxWidth: 360 }}>
        <span>Cajas de artículos distintos (de los comodín) para ganar la tirada extra</span>
        <input id="lc-comodin-cajas" style={input} type="number" min={1} value={form.cajas} disabled={bloqueada} onChange={(e) => cambiar({ cajas: e.target.value })} />
      </label>

      <div style={campo}>
        <span>Departamentos comodín</span>
        <div style={cajaLista}>
          {departamentos.length === 0 && <span style={{ color: "#6b7280", fontSize: 14 }}>No hay departamentos.</span>}
          {departamentos.map((d) => (
            <label key={d.id} style={opcion}>
              <input type="checkbox" checked={form.departamentos.has(String(d.id))} disabled={bloqueada} onChange={() => alternarDepartamento(d.id)} />
              {d.nombre}
            </label>
          ))}
        </div>
      </div>

      <div style={campo}>
        <span>Artículos comodín (además de los departamentos)</span>
        {articulosElegidos.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {articulosElegidos.map((a) => {
              const foto = urlFotoArticulo(a.foto);
              return (
                <span key={a.id} style={pastilla}>
                  {foto && <img src={foto} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />}
                  <span>{a.nombre}</span>
                  {!bloqueada && (
                    <button type="button" style={botonIcono} onClick={() => quitarArticulo(a.id)} aria-label={`Quitar ${a.nombre}`}>
                      ×
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}
        {!bloqueada && (
          <input
            id="lc-comodin-buscar"
            style={input}
            placeholder="Buscar artículo por nombre o código para añadirlo…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        )}
        {resultados.length > 0 && (
          <div style={listaResultados}>
            {resultados.map((a) => (
              <button key={a.id} type="button" style={resultado} onClick={() => anadirArticulo(a.id)}>
                <strong>{a.nombre}</strong> <span style={{ color: "#6b7280" }}>· Cód. {a.codigo || "—"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <label style={campo}>
        <span>Frase de José Luis o Rafa en la TV</span>
        <textarea id="lc-comodin-frase" style={{ ...input, minHeight: 56, fontFamily: "inherit" }} value={form.frase} disabled={bloqueada} onChange={(e) => cambiar({ frase: e.target.value })} />
      </label>

      <div style={fila}>
        <p style={{ ...ayuda, flex: 1 }}>
          Con lo elegido: un pedido con <strong>{cajas}</strong> {cajas === 1 ? "caja" : "cajas"} de artículos distintos de{" "}
          <strong>{[...nombresDeps, ...articulosElegidos.map((a) => a.nombre)].join(", ") || "—"}</strong> gana{" "}
          <strong>1 tirada extra</strong>. No cuenta para los máximos por pedido ni por día, pero sí cumple la regla de las
          12 horas. En la TV, antes de esa tirada sale José Luis o Rafa diciendo la frase. Escribe la frase según lo que
          hayas elegido (por ejemplo, «Has comprado mucha charcutería… ¡te regalo una tirada extra!»).
        </p>
      </div>

      {!bloqueada && (
        <button type="button" style={boton} onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar comodín"}
        </button>
      )}
    </div>
  );
}

const cajaLista = { display: "flex", flexWrap: "wrap", gap: "8px 18px", padding: 12, background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb", maxHeight: 220, overflowY: "auto" };
const opcion = { display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 500, color: "#374151" };
const pastilla = { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 6px 4px 10px", borderRadius: 999, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: 13, fontWeight: 700, color: "#7c2d12" };
const listaResultados = { display: "grid", gap: 4, maxHeight: 240, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 10, padding: 6, background: "#fff" };
const resultado = { textAlign: "left", border: 0, background: "#f9fafb", borderRadius: 8, padding: "8px 10px", fontSize: 14, cursor: "pointer" };
