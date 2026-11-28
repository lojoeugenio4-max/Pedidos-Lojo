import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import LojoPolyArticuloPremio from "./LojoPolyArticuloPremio";
import {
  CASILLAS_PREMIO,
  CASILLA_MITAD,
  CASILLA_SALIDA,
  CASILLA_META,
  casillaLibreRepartida,
  normalizarVillanosCasillas,
  tipoCasillaFija,
  villanosDe,
} from "../utils/carreraTablero";
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
  ayuda,
} from "./lojopolyEstilos";

// Casillas de premio del tablero: las 5 de siempre (10, 20, 38, 47 y 56) y
// las que se añadan aquí (función admin_carrera_anadir_casilla_premio). Cada
// una tiene su premio, un número máximo de veces y una fecha desde la que se
// puede caer en ella. Agotada o sin activar, el dado nunca lleva a ella.
// Las añadidas se pueden quitar mientras no se haya dado ningún premio en ellas.

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
      <AnadirCasilla edicion={edicion} casillas={casillas} bloqueada={edicion.estado === "terminada"} onHecho={cargar} />
      {casillas.map((c) => (
        <TarjetaCasilla
          key={c.id}
          casilla={c}
          contador={contador[c.casilla]}
          edicionId={edicion.id}
          bloqueada={edicion.estado === "terminada"}
          onGuardado={cargar}
        />
      ))}
    </div>
  );
}

// Añadir una casilla de premio nueva (propone la casilla libre más repartida).
function AnadirCasilla({ edicion, casillas, bloqueada, onHecho }) {
  const usadas = casillas.map((c) => Number(c.casilla));
  const sugerida = casillaLibreRepartida(edicion, usadas);
  const [numero, setNumero] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const VILL = villanosDe(edicion);

  useEffect(() => setNumero(sugerida ? String(sugerida) : ""), [sugerida]);

  function problema(n) {
    if (!Number.isInteger(n)) return "Escribe el número de la casilla.";
    if (n <= CASILLA_SALIDA + 1 || n >= CASILLA_META) return `Tiene que estar entre la ${CASILLA_SALIDA + 2} y la ${CASILLA_META - 1}.`;
    if (n === CASILLA_MITAD) return `La ${CASILLA_MITAD} es la del premio de la mitad.`;
    if (usadas.includes(n)) return `La ${n} ya es casilla de premio.`;
    const fija = tipoCasillaFija(n, usadas);
    if (fija) return `La ${n} ya es casilla ${fija === "lojo" ? "Lojo" : fija === "palet" ? "Palet" : fija}.`;
    const villano = normalizarVillanosCasillas(edicion).find((p) => p.casilla === n);
    if (villano) return `En la ${n} está ${VILL[villano.villano]?.nombre || "un villano"}. Cámbialo antes en «Villanos y amigos».`;
    return null;
  }

  async function anadir() {
    setError("");
    setMensaje("");
    const n = Math.round(Number(numero));
    const p = problema(n);
    if (p) {
      setError(p);
      return;
    }
    setOcupado(true);
    const { error: err } = await supabase.rpc("admin_carrera_anadir_casilla_premio", { p_edicion: edicion.id, p_casilla: n });
    setOcupado(false);
    if (err) {
      setError(
        /function|does not exist|schema cache/i.test(err.message)
          ? "Falta aplicar en Supabase la migración migracion_carrera_casillas_premio_extra.sql."
          : `No se ha podido añadir: ${err.message}`
      );
      return;
    }
    setMensaje(`Casilla ${n} añadida. Ponle su premio abajo y guárdala.`);
    onHecho?.();
  }

  if (bloqueada) return null;
  return (
    <div style={{ ...tarjeta, background: "#ecfdf5", borderColor: "#a7f3d0" }}>
      <strong style={{ fontSize: 15 }}>➕ Añadir casilla de premio</strong>
      <span style={{ fontSize: 13, color: "#065f46" }}>
        Ahora hay {casillas.length} casillas de premio. Te propongo la casilla libre que queda más repartida por el tablero;
        puedes cambiarla. No puede estar encima de un villano, una casilla Lojo o Palet, ni en la {CASILLA_MITAD}.
      </span>
      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          id="lc-premio-nueva-casilla"
          style={{ ...input, width: 110 }}
          type="number"
          min={CASILLA_SALIDA + 2}
          max={CASILLA_META - 1}
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
        />
        <button type="button" style={boton} onClick={anadir} disabled={ocupado || !numero}>
          {ocupado ? "Añadiendo..." : "Añadir casilla"}
        </button>
      </div>
    </div>
  );
}

function TarjetaCasilla({ casilla, contador, edicionId, bloqueada, onGuardado }) {
  const [form, setForm] = useState(casilla);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setForm(casilla), [casilla]);

  const cambiar = (cambios) => setForm((a) => ({ ...a, ...cambios }));
  // Cada premio lleva su propio contador: dados_antes son los premios que se
  // dieron con premios anteriores de esta casilla (migración
  // migracion_carrera_premio_nuevo_contador.sql).
  const conContadorPropio = casilla.maximo_premio !== undefined;
  const dadosAntes = conContadorPropio ? Number(casilla.dados_antes || 0) : 0;
  const dados = Math.max(0, Number(contador?.dados || 0) - dadosAntes);
  const maximo = Math.max(
    0,
    Number(conContadorPropio ? form.maximo_premio ?? Number(form.maximo || 0) - dadosAntes : form.maximo) || 0
  );
  const [reiniciando, setReiniciando] = useState(false);
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
        ...(conContadorPropio ? { maximo_premio: maximo } : { maximo }),
        fecha_desde: form.fecha_desde || null,
      })
      .eq("id", casilla.id);
    setGuardando(false);
    if (err) {
      setError(`No se ha podido guardar: ${err.message}`);
      return;
    }
    setMensaje(
      conContadorPropio && String(form.articulo_id || "") !== String(casilla.articulo_id || "") && form.articulo_id
        ? "Guardado. Artículo nuevo: su contador empieza de cero."
        : "Guardado."
    );
    onGuardado?.();
  }

  const esExtra = !CASILLAS_PREMIO.includes(Number(casilla.casilla));
  const [quitando, setQuitando] = useState(false);
  async function quitar() {
    if (!window.confirm(`¿Quitar la casilla de premio ${casilla.casilla} del tablero?`)) return;
    setMensaje("");
    setError("");
    setQuitando(true);
    const { error: err } = await supabase.rpc("admin_carrera_quitar_casilla_premio", { p_edicion: edicionId, p_casilla: Number(casilla.casilla) });
    setQuitando(false);
    if (err) {
      setError(`No se ha podido quitar: ${err.message}`);
      return;
    }
    onGuardado?.();
  }

  async function empezarDeCero() {
    setMensaje("");
    setError("");
    setReiniciando(true);
    const { error: err } = await supabase.rpc("admin_carrera_reiniciar_contador_casilla", { p_id: String(casilla.id) });
    setReiniciando(false);
    if (err) {
      setError(`No se ha podido poner el contador a cero: ${err.message}`);
      return;
    }
    setMensaje("Contador a cero: este premio vuelve a estar disponible.");
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
        {dadosAntes > 0 && (
          <span style={{ fontSize: 12, color: "#6b7280" }}>(+{dadosAntes} dados antes con otros premios)</span>
        )}
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
          <span>Número máximo de veces (de este premio)</span>
          <input
            id={`lc-premio-${casilla.casilla}-maximo`}
            style={input}
            type="number"
            min={0}
            value={conContadorPropio ? form.maximo_premio ?? maximo : form.maximo}
            disabled={bloqueada}
            onChange={(e) => cambiar(conContadorPropio ? { maximo_premio: e.target.value } : { maximo: e.target.value })}
          />
        </label>
        <label style={campo}>
          <span>Se puede caer a partir del</span>
          <input id={`lc-premio-${casilla.casilla}-fecha`} style={input} type="date" value={form.fecha_desde || ""} disabled={bloqueada} onChange={(e) => cambiar({ fecha_desde: e.target.value })} />
        </label>
      </div>

      {!conContadorPropio && (
        <div style={avisoError}>
          Falta aplicar en Supabase la migración migracion_carrera_premio_nuevo_contador.sql: sin ella, al cambiar el artículo la
          casilla sigue contando los premios del anterior.
        </div>
      )}

      {!bloqueada && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" style={boton} onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : `Guardar casilla ${casilla.casilla}`}
          </button>
          {conContadorPropio && dados > 0 && (
            <button
              type="button"
              style={botonSecundario}
              onClick={empezarDeCero}
              disabled={reiniciando}
              title="Para cuando pones un premio nuevo cambiando solo el texto: el contador vuelve a 0"
            >
              {reiniciando ? "Poniendo a cero..." : "♻️ Empezar de cero con este premio"}
            </button>
          )}
          {esExtra && Number(contador?.dados || 0) === 0 && (
            <button type="button" style={botonPeligro} onClick={quitar} disabled={quitando}>
              {quitando ? "Quitando..." : "🗑️ Quitar esta casilla"}
            </button>
          )}
        </div>
      )}
      {conContadorPropio && dados >= maximo && maximo > 0 && !bloqueada && (
        <p style={{ ...ayuda, margin: 0 }}>
          ¿Has puesto un premio nuevo en esta casilla? Al cambiar el artículo el contador empieza de cero solo; si solo has cambiado
          el texto, pulsa «♻️ Empezar de cero con este premio».
        </p>
      )}
    </div>
  );
}

const tarjeta = { display: "grid", gap: 10, padding: 14, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fafafa" };
const numeroCasilla = { width: 34, height: 34, borderRadius: 999, background: "#f59e0b", color: "#fff", display: "grid", placeItems: "center", fontWeight: 900 };
