import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  contenedor,
  tituloSeccion,
  campo,
  campoCheckbox,
  input,
  fila,
  boton,
  avisoError,
  avisoOk,
  ayuda,
} from "./lojopolyEstilos";

const VACIA = {
  nombre: "LojoPoly",
  activa: false,
  fecha_inicio: "",
  fecha_fin: "",
  dias_recogida: 15,
  variedad_minima: 10,
  max_tiradas_pedido: 3,
  max_tiradas_dia: 3,
  tirada_extra_salida: true,
  mensaje_cliente: "Tu pedido te da tiradas de LojoPoly. Pasa el QR en caja para tirar el dado.",
};

export default function LojoPolyConfiguracion({ campana, onGuardado }) {
  const [form, setForm] = useState(VACIA);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!campana) {
      setForm(VACIA);
      return;
    }
    setForm({
      nombre: campana.nombre || "LojoPoly",
      activa: Boolean(campana.activa),
      fecha_inicio: campana.fecha_inicio || "",
      fecha_fin: campana.fecha_fin || "",
      dias_recogida: campana.dias_recogida ?? 15,
      variedad_minima: campana.variedad_minima ?? 10,
      max_tiradas_pedido: campana.max_tiradas_pedido ?? 3,
      max_tiradas_dia: campana.max_tiradas_dia ?? 3,
      tirada_extra_salida: campana.tirada_extra_salida ?? true,
      mensaje_cliente: campana.mensaje_cliente || "",
    });
  }, [campana]);

  const cambiar = (clave, valor) => setForm((actual) => ({ ...actual, [clave]: valor }));

  async function guardar() {
    setMensaje("");
    setError("");

    if (form.fecha_inicio && form.fecha_fin && form.fecha_fin < form.fecha_inicio) {
      setError("La fecha de fin no puede ser anterior a la de inicio.");
      return;
    }
    if (form.activa && campana && !campana.tablero_generado_at) {
      setError("Antes de activar la campaña, guarda el tablero en la pestaña Tablero.");
      return;
    }

    setGuardando(true);
    const payload = {
      nombre: form.nombre.trim() || "LojoPoly",
      activa: form.activa,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      dias_recogida: Math.max(0, Number(form.dias_recogida) || 0),
      variedad_minima: Math.max(1, Number(form.variedad_minima) || 1),
      max_tiradas_pedido: Math.max(1, Number(form.max_tiradas_pedido) || 1),
      max_tiradas_dia: Math.max(1, Number(form.max_tiradas_dia) || 1),
      tirada_extra_salida: form.tirada_extra_salida,
      mensaje_cliente: form.mensaje_cliente || "",
      updated_at: new Date().toISOString(),
    };

    const respuesta = campana
      ? await supabase.from("lojopoly_campanas").update(payload).eq("id", campana.id)
      : await supabase.from("lojopoly_campanas").insert(payload);

    setGuardando(false);

    if (respuesta.error) {
      setError(`No se ha podido guardar: ${respuesta.error.message}`);
      return;
    }

    setMensaje(campana ? "Configuración guardada." : "Campaña creada. Ahora añade los grupos y sus artículos.");
    onGuardado?.();
  }

  return (
    <div style={contenedor}>
      <h4 style={tituloSeccion}>Configuración general</h4>

      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}

      <label style={campo}>
        <span>Nombre de la campaña</span>
        <input id="lp-nombre" style={input} value={form.nombre} onChange={(e) => cambiar("nombre", e.target.value)} />
      </label>

      <label style={campoCheckbox}>
        <input id="lp-activa" type="checkbox" checked={form.activa} onChange={(e) => cambiar("activa", e.target.checked)} />
        <span>LojoPoly activo</span>
      </label>

      <div style={fila}>
        <label style={campo}>
          <span>Fecha de inicio</span>
          <input id="lp-inicio" style={input} type="date" value={form.fecha_inicio} onChange={(e) => cambiar("fecha_inicio", e.target.value)} />
        </label>
        <label style={campo}>
          <span>Fecha de fin</span>
          <input id="lp-fin" style={input} type="date" value={form.fecha_fin} onChange={(e) => cambiar("fecha_fin", e.target.value)} />
        </label>
        <label style={campo}>
          <span>Días para recoger el premio tras el fin</span>
          <input id="lp-recogida" style={input} type="number" min={0} value={form.dias_recogida} onChange={(e) => cambiar("dias_recogida", e.target.value)} />
        </label>
      </div>

      <div style={fila}>
        <label style={campo}>
          <span>Cada cuántas cajas de artículos distintos se da 1 tirada</span>
          <input id="lp-variedad" style={input} type="number" min={1} value={form.variedad_minima} onChange={(e) => cambiar("variedad_minima", e.target.value)} />
        </label>
        <label style={campo}>
          <span>Máximo de tiradas por pedido</span>
          <input id="lp-max-pedido" style={input} type="number" min={1} value={form.max_tiradas_pedido} onChange={(e) => cambiar("max_tiradas_pedido", e.target.value)} />
        </label>
        <label style={campo}>
          <span>Máximo de tiradas por cliente y día</span>
          <input id="lp-max-dia" style={input} type="number" min={1} value={form.max_tiradas_dia} onChange={(e) => cambiar("max_tiradas_dia", e.target.value)} />
        </label>
      </div>

      <label style={campoCheckbox}>
        <input
          id="lp-salida"
          type="checkbox"
          checked={form.tirada_extra_salida}
          onChange={(e) => cambiar("tirada_extra_salida", e.target.checked)}
        />
        <span>Tirada extra cada vez que la ficha pasa por Salida</span>
      </label>

      <label style={campo}>
        <span>Mensaje al cliente cuando su pedido da tiradas</span>
        <textarea
          id="lp-mensaje"
          style={{ ...input, minHeight: 60 }}
          value={form.mensaje_cliente}
          onChange={(e) => cambiar("mensaje_cliente", e.target.value)}
        />
      </label>

      <p style={ayuda}>
        Las tiradas se dan al pasar el QR del pedido en caja, como en Bingo y Sorteo. Los premios caducan
        {` ${Number(form.dias_recogida) || 0} `}días después de la fecha de fin de la campaña.
      </p>

      <button type="button" style={boton} onClick={guardar} disabled={guardando}>
        {guardando ? "Guardando..." : campana ? "Guardar configuración" : "Crear campaña"}
      </button>
    </div>
  );
}
