import { useCallback, useEffect, useState } from "react";
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
  avisoAtencion,
  ayuda,
} from "./lojopolyEstilos";
import { CASILLA_META } from "../utils/carreraTablero";

// 🏁 SPRINT FINAL: para terminar una edición cuanto antes y tener ganador.
// Lo aplica el servidor en cada tirada (carrera_tirar_qr, migración
// migracion_carrera_sprint_final.sql):
//  · el dado no saca menos del mínimo elegido;
//  · llegada directa: a 6 casillas o menos de la meta, entra a la primera;
//  · sin villanos (opcional): ninguna tirada acaba en un villano.
// Al guardar con el sprint activado se apaga el «Freno al líder».

const DADOS = [3, 4, 5, 6];

export default function CarreraSprint({ edicion, onGuardado }) {
  const [form, setForm] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const bloqueada = edicion.estado === "terminada";
  const faltaMigracion = edicion.sprint_activo === undefined;

  useEffect(() => {
    setForm({
      activo: Boolean(edicion.sprint_activo),
      dadoMinimo: edicion.sprint_dado_minimo ?? 4,
      metaDirecta: edicion.sprint_meta_directa ?? true,
      sinVillanos: edicion.sprint_sin_villanos ?? true,
      variedad: edicion.variedad_minima ?? 1,
      maxPedido: edicion.max_tiradas_pedido ?? 1,
      maxDia: edicion.max_tiradas_dia ?? 1,
    });
  }, [edicion]);

  const cargarJugadores = useCallback(async () => {
    const { data } = await supabase.rpc("admin_carrera_jugadores", { p_edicion: edicion.id });
    setJugadores([...(data || [])].sort((a, b) => Number(b.casilla || 1) - Number(a.casilla || 1)));
  }, [edicion.id]);

  useEffect(() => {
    cargarJugadores();
  }, [cargarJugadores]);

  if (!form) return null;

  const cambiar = (cambios) => {
    setMensaje("");
    setForm((a) => ({ ...a, ...cambios }));
  };
  const dadoMinimo = Math.min(6, Math.max(1, Math.round(Number(form.dadoMinimo) || 1)));

  // Tiradas que le faltan a cada uno para ganar, aproximadas.
  function tiradasParaGanar(casilla, conSprint) {
    const faltan = Math.max(0, CASILLA_META - (Number(casilla) || 1));
    if (faltan === 0) return 0;
    if (conSprint) {
      const media = (dadoMinimo + 6) / 2;
      const hastaZona = form.metaDirecta ? Math.max(0, faltan - 6) : faltan;
      return Math.ceil(hastaZona / media) + (form.metaDirecta ? 1 : 0);
    }
    // Sin sprint: media 3,5 por tirada y, al final, hace falta el número exacto (1 de cada 6).
    return Math.max(1, Math.ceil(Math.max(0, faltan - 6) / 3.5)) + 6;
  }

  async function guardar() {
    setMensaje("");
    setError("");
    setGuardando(true);
    const cambios = {
      sprint_activo: Boolean(form.activo),
      sprint_dado_minimo: dadoMinimo,
      sprint_meta_directa: Boolean(form.metaDirecta),
      sprint_sin_villanos: Boolean(form.sinVillanos),
      variedad_minima: Math.max(1, Math.round(Number(form.variedad) || 1)),
      max_tiradas_pedido: Math.max(1, Math.round(Number(form.maxPedido) || 1)),
      max_tiradas_dia: Math.max(1, Math.round(Number(form.maxDia) || 1)),
      updated_at: new Date().toISOString(),
    };
    if (form.activo) cambios.freno_activo = false; // el freno al líder retrasa al que va primero
    const { error: err } = await supabase.from("carrera_ediciones").update(cambios).eq("id", edicion.id);
    setGuardando(false);
    if (err) {
      setError(
        err.message?.includes("sprint")
          ? "Falta aplicar la migración migracion_carrera_sprint_final.sql en Supabase."
          : `No se ha podido guardar: ${err.message}`
      );
      return;
    }
    setMensaje(form.activo ? "🏁 Sprint final activado. Se aplica desde la próxima tirada." : "Guardado. Sprint final apagado.");
    onGuardado?.();
  }

  const lider = jugadores[0];
  const top = jugadores.slice(0, 5);

  return (
    <div style={contenedor}>
      <h4 style={tituloSeccion}>🏁 Sprint final: tener ganador cuanto antes</h4>
      {faltaMigracion && (
        <div style={avisoAtencion}>
          Falta aplicar en Supabase la migración <strong>migracion_carrera_sprint_final.sql</strong>. Sin ella no se puede guardar.
        </div>
      )}
      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}

      <p style={ayuda}>
        Para acabar esta edición rápido y empezar la siguiente. Con el sprint activado, en cada tirada se cumplen las reglas de abajo
        (la tirada se repite por dentro hasta que salen bien; en la TV y en el TPV se ve normal). Al guardar con el sprint activado se
        apaga el <strong>«Freno al líder»</strong>, que retrasa al que va primero.
      </p>

      <label style={{ ...campoCheckbox, fontSize: 16 }}>
        <input type="checkbox" checked={Boolean(form.activo)} disabled={bloqueada} onChange={(e) => cambiar({ activo: e.target.checked })} />
        <span>
          <strong>Sprint final activado</strong>
        </span>
      </label>

      <div style={campo}>
        <span>El dado nunca saca menos de… {dadoMinimo}</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {DADOS.map((n) => (
            <button key={n} type="button" disabled={bloqueada} onClick={() => cambiar({ dadoMinimo: n })} style={opcion(dadoMinimo === n)}>
              {n === 6 ? "Siempre 6" : `${n} a 6`}
            </button>
          ))}
        </div>
      </div>

      <label style={campoCheckbox}>
        <input type="checkbox" checked={Boolean(form.metaDirecta)} disabled={bloqueada} onChange={(e) => cambiar({ metaDirecta: e.target.checked })} />
        <span>
          <strong>Llegada directa:</strong> el que está a 6 casillas o menos de la meta entra a la primera (sin necesitar el número
          exacto ni rebotar)
        </span>
      </label>
      <label style={campoCheckbox}>
        <input type="checkbox" checked={Boolean(form.sinVillanos)} disabled={bloqueada} onChange={(e) => cambiar({ sinVillanos: e.target.checked })} />
        <span>
          <strong>Sin villanos:</strong> ninguna tirada acaba en un villano (nadie retrocede ni pierde la tirada)
        </span>
      </label>

      <h4 style={{ ...tituloSeccion, marginTop: 6 }}>🎲 Más tiradas por pedido</h4>
      <p style={{ ...ayuda, margin: 0 }}>Cuantas más tiradas se den, antes llega alguien a la meta. Son los mismos datos de «Configuración y tiradas».</p>
      <div style={fila}>
        <label style={campo}>
          <span>Cada cuántas cajas de artículos distintos se da 1 tirada</span>
          <input style={input} type="number" min={1} value={form.variedad} disabled={bloqueada} onChange={(e) => cambiar({ variedad: e.target.value })} />
        </label>
        <label style={campo}>
          <span>Máximo de tiradas por pedido</span>
          <input style={input} type="number" min={1} value={form.maxPedido} disabled={bloqueada} onChange={(e) => cambiar({ maxPedido: e.target.value })} />
        </label>
        <label style={campo}>
          <span>Máximo de tiradas por cliente y día</span>
          <input style={input} type="number" min={1} value={form.maxDia} disabled={bloqueada} onChange={(e) => cambiar({ maxDia: e.target.value })} />
        </label>
      </div>

      {!bloqueada && (
        <button type="button" style={{ ...boton, background: form.activo ? "#b91c1c" : undefined }} onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : form.activo ? "🏁 Guardar y activar el sprint" : "Guardar"}
        </button>
      )}

      {/* Cómo va la carrera */}
      {top.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          <strong style={{ fontSize: 15, color: "#111827" }}>
            Cómo va la carrera {lider ? `· el líder está en la casilla ${lider.casilla} de ${CASILLA_META}` : ""}
          </strong>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 14, width: "100%", minWidth: 520 }}>
              <thead>
                <tr>
                  <th style={th}>Puesto</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Casilla</th>
                  <th style={th}>Tiradas para ganar (aprox.)</th>
                </tr>
              </thead>
              <tbody>
                {top.map((j, i) => (
                  <tr key={j.cliente_id}>
                    <td style={td}>{i + 1}º</td>
                    <td style={td}>{j.cliente_nombre}</td>
                    <td style={td}>{j.casilla}</td>
                    <td style={td}>
                      <strong style={{ color: "#166534" }}>~{tiradasParaGanar(j.casilla, true)} con sprint</strong>
                      <span style={{ color: "#6b7280" }}> · ~{tiradasParaGanar(j.casilla, false)} sin sprint</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const opcion = (activo) => ({
  border: `1px solid ${activo ? "#b91c1c" : "#d1d5db"}`,
  background: activo ? "#fee2e2" : "#fff",
  color: activo ? "#991b1b" : "#374151",
  borderRadius: 999,
  padding: "6px 14px",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
});
const th = { textAlign: "left", padding: "8px", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700 };
const td = { padding: "8px", borderBottom: "1px solid #f3f4f6" };
