import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const configuracionVacia = {
  id: null,
  nombre: "Sorteo promocional",
  activa: false,
  modo: "todos",
  variedad_minima: 10,
  mensaje_cliente: "Tu pedido cumple las condiciones para participar en el Sorteo.",
  fecha_inicio: "",
  fecha_fin: "",
};

export default function SorteoConfiguracion() {
  const [configuracion, setConfiguracion] = useState(configuracionVacia);
  const [departamentos, setDepartamentos] = useState([]);
  const [departamentosSeleccionados, setDepartamentosSeleccionados] = useState(new Set());
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setCargando(true);
    setError("");

    const [{ data: promo, error: promoError }, { data: deps, error: depsError }] = await Promise.all([
      supabase.from("promociones_sorteo").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle(),
      supabase.from("departamentos").select("id,nombre").order("nombre", { ascending: true }),
    ]);

    if (promoError || depsError) {
      setError("No se ha podido cargar la configuración del Sorteo.");
      setCargando(false);
      return;
    }

    setDepartamentos(deps || []);

    if (promo) {
      setConfiguracion({
        id: promo.id,
        nombre: promo.nombre || "",
        activa: Boolean(promo.activa),
        modo: promo.modo || "todos",
        variedad_minima: promo.variedad_minima ?? 10,
        mensaje_cliente: promo.mensaje_cliente || "",
        fecha_inicio: promo.fecha_inicio || "",
        fecha_fin: promo.fecha_fin || "",
      });

      const { data: depsPromo, error: depsPromoError } = await supabase
        .from("promociones_sorteo_departamentos")
        .select("departamento_id")
        .eq("promocion_id", promo.id);

      if (!depsPromoError) {
        setDepartamentosSeleccionados(new Set((depsPromo || []).map((d) => d.departamento_id)));
      }
    }

    setCargando(false);
  }

  function cambiarCampo(campo, valor) {
    setConfiguracion((actual) => ({ ...actual, [campo]: valor }));
  }

  function alternarDepartamento(id) {
    setDepartamentosSeleccionados((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  async function guardar() {
    setGuardando(true);
    setMensaje("");
    setError("");

    try {
      const payload = {
        nombre: configuracion.nombre.trim() || "Sorteo promocional",
        activa: configuracion.activa,
        modo: configuracion.modo,
        variedad_minima: Math.max(1, Number(configuracion.variedad_minima || 10)),
        mensaje_cliente: configuracion.mensaje_cliente || "",
        fecha_inicio: configuracion.fecha_inicio || null,
        fecha_fin: configuracion.fecha_fin || null,
      };

      let promocionId = configuracion.id;

      if (promocionId) {
        const { error: updateError } = await supabase
          .from("promociones_sorteo")
          .update(payload)
          .eq("id", promocionId);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from("promociones_sorteo")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        promocionId = data.id;
        setConfiguracion((actual) => ({ ...actual, id: promocionId }));
      }

      // Sincroniza departamentos seleccionados (solo relevante en modo "departamentos")
      const { error: deleteError } = await supabase
        .from("promociones_sorteo_departamentos")
        .delete()
        .eq("promocion_id", promocionId);
      if (deleteError) throw deleteError;

      if (departamentosSeleccionados.size > 0) {
        const filas = [...departamentosSeleccionados].map((departamento_id) => ({
          promocion_id: promocionId,
          departamento_id,
        }));
        const { error: insertDepsError } = await supabase
          .from("promociones_sorteo_departamentos")
          .insert(filas);
        if (insertDepsError) throw insertDepsError;
      }

      setMensaje("Configuración guardada correctamente.");
    } catch (err) {
      console.error(err);
      setError(err?.message || "No se ha podido guardar la configuración.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <p style={texto}>Cargando configuración del Sorteo...</p>;

  return (
    <div style={contenedor}>
      <h4 style={titulo}>Configuración general</h4>

      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}

      <label style={campo}>
        <span>Nombre interno</span>
        <input style={input} value={configuracion.nombre} onChange={(e) => cambiarCampo("nombre", e.target.value)} />
      </label>

      <label style={campoCheckbox}>
        <input type="checkbox" checked={configuracion.activa} onChange={(e) => cambiarCampo("activa", e.target.checked)} />
        <span>Sorteo activo</span>
      </label>

      <label style={campo}>
        <span>Cada cuántos artículos distintos se asigna un número</span>
        <input
          style={input}
          type="number"
          min={1}
          value={configuracion.variedad_minima}
          onChange={(e) => cambiarCampo("variedad_minima", e.target.value)}
        />
      </label>

      <div style={campo}>
        <span>Artículos que cuentan</span>
        <div style={{ display: "flex", gap: 16 }}>
          <label style={campoRadio}>
            <input
              type="radio"
              name="modo-sorteo"
              checked={configuracion.modo === "todos"}
              onChange={() => cambiarCampo("modo", "todos")}
            />
            Cualquier artículo del pedido
          </label>
          <label style={campoRadio}>
            <input
              type="radio"
              name="modo-sorteo"
              checked={configuracion.modo === "departamentos"}
              onChange={() => cambiarCampo("modo", "departamentos")}
            />
            Solo artículos de ciertos departamentos
          </label>
        </div>
      </div>

      {configuracion.modo === "departamentos" && (
        <div style={departamentosBox}>
          {departamentos.length === 0 && <span style={texto}>No hay departamentos creados.</span>}
          {departamentos.map((dep) => (
            <label key={dep.id} style={campoRadio}>
              <input
                type="checkbox"
                checked={departamentosSeleccionados.has(dep.id)}
                onChange={() => alternarDepartamento(dep.id)}
              />
              {dep.nombre}
            </label>
          ))}
        </div>
      )}

      <label style={campo}>
        <span>Mensaje al cliente cuando cumple</span>
        <textarea
          style={{ ...input, minHeight: 60 }}
          value={configuracion.mensaje_cliente}
          onChange={(e) => cambiarCampo("mensaje_cliente", e.target.value)}
        />
      </label>

      <div style={{ display: "flex", gap: 12 }}>
        <label style={campo}>
          <span>Fecha inicio (opcional)</span>
          <input style={input} type="date" value={configuracion.fecha_inicio} onChange={(e) => cambiarCampo("fecha_inicio", e.target.value)} />
        </label>
        <label style={campo}>
          <span>Fecha fin (opcional)</span>
          <input style={input} type="date" value={configuracion.fecha_fin} onChange={(e) => cambiarCampo("fecha_fin", e.target.value)} />
        </label>
      </div>

      <button type="button" style={boton} onClick={guardar} disabled={guardando}>
        {guardando ? "Guardando..." : "Guardar configuración"}
      </button>
    </div>
  );
}

const contenedor = { display: "grid", gap: 14, border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, background: "#fff", marginBottom: 20 };
const titulo = { margin: 0, fontSize: 17, color: "#111827" };
const texto = { margin: 0, color: "#6b7280", fontSize: 14 };
const campo = { display: "grid", gap: 6, fontSize: 14, color: "#374151", fontWeight: 600, flex: 1 };
const campoCheckbox = { display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#374151" };
const campoRadio = { display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 500, color: "#374151" };
const input = { padding: "9px 11px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 14 };
const departamentosBox = { display: "flex", flexWrap: "wrap", gap: "8px 18px", padding: 12, background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb" };
const boton = { border: 0, borderRadius: 10, padding: "11px 18px", background: "#059669", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", justifySelf: "start" };
const avisoError = { padding: "9px 12px", borderRadius: 9, background: "#fef2f2", color: "#991b1b", fontSize: 13, fontWeight: 700 };
const avisoOk = { padding: "9px 12px", borderRadius: 9, background: "#f0fdf4", color: "#166534", fontSize: 13, fontWeight: 700 };
