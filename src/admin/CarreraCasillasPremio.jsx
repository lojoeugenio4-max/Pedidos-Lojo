import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import LojoPolyArticuloPremio from "./LojoPolyArticuloPremio";
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

// Las 5 casillas de premio del tablero (10, 20, 38, 47 y 56). Cada una
// tiene su premio, un número máximo de veces y una fecha desde la que se
// puede caer en ella. Agotada o sin activar, el dado nunca lleva a ella.

export default function CarreraCasillasPremio({ edicion }) {
  const [casillas, setCasillas] = useState([]);
  const [contador, setContador] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setError("");
    const [{ data, error: err }, { data: cont }] = await Promise.all([
      supabase.from("carrera_casillas_premio").select("*").eq("edicion_id", edicion.id).order("casilla", { ascending: true }),
      supabase.rpc("admin_carrera_premios_contador", { p_edicion: edicion.id }),
    ]);
    if (err) setError(`No se han podido cargar las casillas: ${err.message}`);
    setCasillas(data || []);
    setContador(Object.fromEntries((cont || []).map((c) => [c.casilla, c])));
    setCargando(false);
  }, [edicion.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) return <p style={{ color: "#6b7280" }}>Cargando casillas de premio...</p>;

  return (
    <div style={contenedor}>
      <h4 style={tituloSeccion}>🎁 Casillas de premio</h4>
      {error && <div style={avisoError}>{error}</div>}
      <p style={ayuda}>
        Cuando se dan todas las veces de una casilla, o si aún no ha llegado su fecha, ningún cliente puede caer en ella:
        el dado saca otro número. Una casilla sin premio tampoco da nada. Los premios ganados aparecen en «Clasificación y
        premios» para marcarlos como entregados.
      </p>
      {casillas.map((c) => (
        <TarjetaCasilla
          key={c.id}
          casilla={c}
          contador={contador[c.casilla]}
          bloqueada={edicion.estado === "terminada"}
          onGuardado={cargar}
        />
      ))}
    </div>
  );
}

function TarjetaCasilla({ casilla, contador, bloqueada, onGuardado }) {
  const [form, setForm] = useState(casilla);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setForm(casilla), [casilla]);

  const cambiar = (cambios) => setForm((a) => ({ ...a, ...cambios }));
  const dados = Number(contador?.dados || 0);
  const maximo = Math.max(0, Number(form.maximo) || 0);
  const sinPremio = !String(form.texto || "").trim() && !form.articulo_id;
  const hoy = new Date().toISOString().slice(0, 10);

  let estado = { texto: "Disponible", color: "#166534", fondo: "#dcfce7" };
  if (sinPremio) estado = { texto: "Sin premio", color: "#6b7280", fondo: "#f3f4f6" };
  else if (!form.activa) estado = { texto: "Desactivada", color: "#6b7280", fondo: "#f3f4f6" };
  else if (dados >= maximo) estado = { texto: "Agotada", color: "#b91c1c", fondo: "#fee2e2" };
  else if (form.fecha_desde && form.fecha_desde > hoy)
    estado = { texto: `Desde el ${new Date(`${form.fecha_desde}T00:00:00`).toLocaleDateString("es-ES")}`, color: "#92400e", fondo: "#fef3c7" };

  async function guardar() {
    setMensaje("");
    setError("");
    setGuardando(true);
    const { error: err } = await supabase
      .from("carrera_casillas_premio")
      .update({
        activa: form.activa,
        texto: String(form.texto || "").trim() || null,
        articulo_id: form.articulo_id ? String(form.articulo_id) : null,
        cantidad: Number(form.cantidad) > 0 ? Number(form.cantidad) : 1,
        formato: form.formato === "cajas" ? "cajas" : "unidades",
        maximo,
        fecha_desde: form.fecha_desde || null,
      })
      .eq("id", casilla.id);
    setGuardando(false);
    if (err) {
      setError(`No se ha podido guardar: ${err.message}`);
      return;
    }
    setMensaje("Guardado.");
    onGuardado?.();
  }

  return (
    <div style={tarjeta}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={numeroCasilla}>{casilla.casilla}</span>
        <strong style={{ fontSize: 15 }}>Casilla {casilla.casilla}</strong>
        <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800, color: estado.color, background: estado.fondo }}>
          {estado.texto}
        </span>
        <span style={{ fontSize: 13, color: "#374151", fontWeight: 700 }}>
          Dados: {dados} de {maximo}
        </span>
      </div>

      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}

      <label style={campoCheckbox}>
        <input type="checkbox" checked={Boolean(form.activa)} disabled={bloqueada} onChange={(e) => cambiar({ activa: e.target.checked })} />
        <span>Casilla activa</span>
      </label>

      <label style={campo}>
        <span>Premio (lo que verá el cliente)</span>
        <input id={`lc-premio-${casilla.casilla}-texto`} style={input} placeholder="Ej.: 1 caja de Cruzcampo gratis" value={form.texto || ""} disabled={bloqueada} onChange={(e) => cambiar({ texto: e.target.value })} />
      </label>

      <LojoPolyArticuloPremio
        idBase={`lc-premio-${casilla.casilla}`}
        articuloId={form.articulo_id}
        cantidad={form.cantidad}
        formato={form.formato}
        ocupado={bloqueada || guardando}
        onCambiar={cambiar}
      />

      <div style={fila}>
        <label style={campo}>
          <span>Número máximo de veces</span>
          <input id={`lc-premio-${casilla.casilla}-maximo`} style={input} type="number" min={0} value={form.maximo} disabled={bloqueada} onChange={(e) => cambiar({ maximo: e.target.value })} />
        </label>
        <label style={campo}>
          <span>Se puede caer a partir del</span>
          <input id={`lc-premio-${casilla.casilla}-fecha`} style={input} type="date" value={form.fecha_desde || ""} disabled={bloqueada} onChange={(e) => cambiar({ fecha_desde: e.target.value })} />
        </label>
      </div>

      {!bloqueada && (
        <button type="button" style={boton} onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : `Guardar casilla ${casilla.casilla}`}
        </button>
      )}
    </div>
  );
}

const tarjeta = { display: "grid", gap: 10, padding: 14, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fafafa" };
const numeroCasilla = { width: 34, height: 34, borderRadius: 999, background: "#f59e0b", color: "#fff", display: "grid", placeItems: "center", fontWeight: 900 };
