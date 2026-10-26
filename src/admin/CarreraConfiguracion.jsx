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
  botonSecundario,
  botonPeligro,
  avisoError,
  avisoOk,
  avisoAtencion,
  ayuda,
} from "./lojopolyEstilos";

// Configuración general y tiradas de La Loca Carrera. Las tiradas se dan
// igual que los números del Sorteo: por cada X cajas de artículos distintos
// del pedido, con máximo por pedido y por cliente y día, contando todos los
// artículos o solo los de ciertos departamentos.

const VACIA = {
  nombre: "La Loca Carrera de Lojo",
  solo_pruebas: true,
  fecha_inicio: "",
  modo: "todos",
  variedad_minima: 10,
  max_tiradas_pedido: 3,
  max_tiradas_dia: 5,
  mensaje_cliente: "Tu pedido te da tiradas en La Loca Carrera de Lojo. Pasa el QR en caja para tirar el dado.",
};

export default function CarreraConfiguracion({ edicion, onGuardado }) {
  const [form, setForm] = useState(VACIA);
  const [departamentos, setDepartamentos] = useState([]);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const bloqueada = edicion?.estado === "terminada";

  useEffect(() => {
    supabase
      .from("departamentos")
      .select("id,nombre")
      .order("nombre", { ascending: true })
      .then(({ data }) => setDepartamentos(data || []));
  }, []);

  useEffect(() => {
    if (!edicion) {
      setForm(VACIA);
      setSeleccionados(new Set());
      return;
    }
    setForm({
      nombre: edicion.nombre || VACIA.nombre,
      solo_pruebas: edicion.solo_pruebas ?? true,
      fecha_inicio: edicion.fecha_inicio || "",
      modo: edicion.modo || "todos",
      variedad_minima: edicion.variedad_minima ?? 10,
      max_tiradas_pedido: edicion.max_tiradas_pedido ?? 3,
      max_tiradas_dia: edicion.max_tiradas_dia ?? 5,
      mensaje_cliente: edicion.mensaje_cliente || "",
    });
    supabase
      .from("carrera_ediciones_departamentos")
      .select("departamento_id")
      .eq("edicion_id", edicion.id)
      .then(({ data }) => setSeleccionados(new Set((data || []).map((d) => String(d.departamento_id)))));
  }, [edicion]);

  const cambiar = (clave, valor) => setForm((actual) => ({ ...actual, [clave]: valor }));

  function alternarDepartamento(id) {
    setSeleccionados((actual) => {
      const siguiente = new Set(actual);
      const clave = String(id);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  }

  async function guardar(extra = {}) {
    setMensaje("");
    setError("");

    if (form.modo === "departamentos" && seleccionados.size === 0) {
      setError("Marca al menos un departamento o elige «Cualquier artículo del pedido».");
      return false;
    }

    setGuardando(true);
    const payload = {
      nombre: form.nombre.trim() || VACIA.nombre,
      solo_pruebas: form.solo_pruebas,
      fecha_inicio: form.fecha_inicio || null,
      modo: form.modo,
      variedad_minima: Math.max(1, Number(form.variedad_minima) || 1),
      max_tiradas_pedido: Math.max(1, Number(form.max_tiradas_pedido) || 1),
      max_tiradas_dia: Math.max(1, Number(form.max_tiradas_dia) || 1),
      mensaje_cliente: form.mensaje_cliente || "",
      updated_at: new Date().toISOString(),
      ...extra,
    };

    try {
      let edicionId = edicion?.id;
      if (edicionId) {
        const { error: err } = await supabase.from("carrera_ediciones").update(payload).eq("id", edicionId);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.from("carrera_ediciones").insert(payload).select("id").single();
        if (err) throw err;
        edicionId = data.id;
      }

      const { error: delErr } = await supabase.from("carrera_ediciones_departamentos").delete().eq("edicion_id", edicionId);
      if (delErr) throw delErr;
      if (seleccionados.size > 0) {
        const filas = [...seleccionados].map((departamento_id) => ({ edicion_id: edicionId, departamento_id }));
        const { error: insErr } = await supabase.from("carrera_ediciones_departamentos").insert(filas);
        if (insErr) throw insErr;
      }

      setMensaje(edicion ? "Configuración guardada." : "Carrera creada. Ahora configura villanos, premios y el premio final.");
      onGuardado?.();
      return true;
    } catch (err) {
      setError(`No se ha podido guardar: ${err.message}`);
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function empezar() {
    if (!edicion.premio_final_texto && !edicion.premio_final_articulo_id) {
      setError("Antes de empezar, define el premio final en la pestaña «Premio final».");
      return;
    }
    const ok = await guardar({ estado: "en_juego" });
    if (ok) setMensaje("¡La carrera está en juego! Los pedidos ya dan tiradas.");
  }

  async function pausar() {
    const ok = await guardar({ estado: "preparacion" });
    if (ok) setMensaje("Carrera pausada: mientras tanto los pedidos no dan tiradas y en caja no se puede tirar.");
  }

  async function vaciarTablero() {
    const seguro = window.confirm(
      "Se borrarán todas las fichas, tiradas, premios ganados y tiradas pendientes de esta edición. " +
        "Úsalo para empezar de cero después de las pruebas. ¿Seguro?"
    );
    if (!seguro) return;
    setError("");
    const { error: err } = await supabase.rpc("admin_carrera_vaciar_tablero", { p_edicion: edicion.id });
    if (err) setError(`No se ha podido vaciar el tablero: ${err.message}`);
    else setMensaje("Tablero vacío: todos los clientes vuelven a la Salida.");
  }

  const ejemplo = Math.max(1, Number(form.variedad_minima) || 1);

  return (
    <div style={contenedor}>
      <h4 style={tituloSeccion}>{edicion ? "Configuración general" : "Crear La Loca Carrera"}</h4>

      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}

      <label style={campo}>
        <span>Nombre</span>
        <input id="lc-nombre" style={input} value={form.nombre} disabled={bloqueada} onChange={(e) => cambiar("nombre", e.target.value)} />
      </label>

      <label style={campoCheckbox}>
        <input id="lc-pruebas" type="checkbox" checked={form.solo_pruebas} disabled={bloqueada} onChange={(e) => cambiar("solo_pruebas", e.target.checked)} />
        <span>Solo clientes de pruebas</span>
      </label>
      <p style={ayuda}>
        Con esta casilla marcada solo juegan los clientes de pruebas y el resto no ve nada. Al desmarcarla juegan todos
        los clientes <strong>menos</strong> los de pruebas, para que no ocupen sitio en el tablero real. Antes de pasar a
        real, pulsa «Vaciar tablero» para borrar las fichas de las pruebas.
      </p>

      <label style={{ ...campo, maxWidth: 260 }}>
        <span>Fecha a partir de la cual se dan tiradas (opcional)</span>
        <input id="lc-inicio" style={input} type="date" value={form.fecha_inicio} disabled={bloqueada} onChange={(e) => cambiar("fecha_inicio", e.target.value)} />
      </label>

      <h4 style={{ ...tituloSeccion, marginTop: 6 }}>🎲 Tiradas que gana el cliente</h4>

      <div style={fila}>
        <label style={campo}>
          <span>Cada cuántas cajas de artículos distintos se da 1 tirada</span>
          <input id="lc-variedad" style={input} type="number" min={1} value={form.variedad_minima} disabled={bloqueada} onChange={(e) => cambiar("variedad_minima", e.target.value)} />
        </label>
        <label style={campo}>
          <span>Máximo de tiradas por pedido</span>
          <input id="lc-max-pedido" style={input} type="number" min={1} value={form.max_tiradas_pedido} disabled={bloqueada} onChange={(e) => cambiar("max_tiradas_pedido", e.target.value)} />
        </label>
        <label style={campo}>
          <span>Máximo de tiradas por cliente y día</span>
          <input id="lc-max-dia" style={input} type="number" min={1} value={form.max_tiradas_dia} disabled={bloqueada} onChange={(e) => cambiar("max_tiradas_dia", e.target.value)} />
        </label>
      </div>

      <p style={ayuda}>
        Igual que el Sorteo: solo cuentan las cajas, nunca las unidades sueltas. Ejemplo: con {ejemplo} cajas de artículos
        distintos el cliente gana 1 tirada; con {ejemplo * 2}, 2 tiradas. Nunca más del máximo por pedido ni del máximo
        diario, aunque haga varios pedidos el mismo día. Además, igual que en Cliente del mes, solo da tiradas{" "}
        <strong>un pedido por cliente cada 12 horas</strong>: si ya consiguió tiradas con otro pedido hace menos de 12
        horas, el nuevo no da. Las tiradas de palet y de Lojo («tiro otra vez») son aparte y no cuentan para estos
        máximos.
      </p>

      <div style={campo}>
        <span>Artículos que cuentan</span>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <label style={radio}>
            <input type="radio" name="lc-modo" checked={form.modo === "todos"} disabled={bloqueada} onChange={() => cambiar("modo", "todos")} />
            Cualquier artículo del pedido
          </label>
          <label style={radio}>
            <input type="radio" name="lc-modo" checked={form.modo === "departamentos"} disabled={bloqueada} onChange={() => cambiar("modo", "departamentos")} />
            Solo artículos de ciertos departamentos
          </label>
        </div>
      </div>

      {form.modo === "departamentos" && (
        <div style={cajaDepartamentos}>
          {departamentos.length === 0 && <span style={{ color: "#6b7280", fontSize: 14 }}>No hay departamentos creados.</span>}
          {departamentos.map((dep) => (
            <label key={dep.id} style={radio}>
              <input type="checkbox" checked={seleccionados.has(String(dep.id))} disabled={bloqueada} onChange={() => alternarDepartamento(dep.id)} />
              {dep.nombre}
            </label>
          ))}
        </div>
      )}

      <label style={campo}>
        <span>Mensaje al cliente cuando su pedido da tiradas</span>
        <textarea id="lc-mensaje" style={{ ...input, minHeight: 60 }} value={form.mensaje_cliente} disabled={bloqueada} onChange={(e) => cambiar("mensaje_cliente", e.target.value)} />
      </label>

      {!bloqueada && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" style={boton} onClick={() => guardar()} disabled={guardando}>
            {guardando ? "Guardando..." : edicion ? "Guardar configuración" : "Crear la carrera"}
          </button>
          {edicion?.estado === "preparacion" && (
            <button type="button" style={{ ...boton, background: "#1d4ed8" }} onClick={empezar} disabled={guardando}>
              🏁 Empezar la carrera
            </button>
          )}
          {edicion?.estado === "en_juego" && (
            <button type="button" style={botonSecundario} onClick={pausar} disabled={guardando}>
              ⏸ Pausar la carrera
            </button>
          )}
          {edicion && (
            <button type="button" style={botonPeligro} onClick={vaciarTablero} disabled={guardando}>
              Vaciar tablero
            </button>
          )}
        </div>
      )}

      {edicion?.estado === "en_juego" && (
        <div style={avisoAtencion}>
          La carrera está en juego. Los cambios en tiradas se aplican a los pedidos nuevos; las tiradas ya ganadas se
          mantienen.
        </div>
      )}
    </div>
  );
}

const radio = { display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 500, color: "#374151" };
const cajaDepartamentos = { display: "flex", flexWrap: "wrap", gap: "8px 18px", padding: 12, background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb" };
