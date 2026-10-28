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

// FRENO AL LÍDER: en cada tirada se mira cuántas casillas le saca el cliente
// a la MEDIA de los demás jugadores (los que ya han tirado). Si pasa de la
// ventaja de aquí, el freno empieza suave y llega a tope al doble de esa
// ventaja. Lo decide el servidor (carrera_tirar_qr); este cálculo es el mismo
// para enseñar en el Admin a quién está frenando ahora mismo.

const NIVELES = [
  { valor: 30, texto: "Suave" },
  { valor: 60, texto: "Normal" },
  { valor: 80, texto: "Fuerte" },
  { valor: 100, texto: "Máximo" },
];

export function fuerzaFreno(ventaja, umbral, intensidad) {
  const u = Math.max(1, Number(umbral) || 1);
  if (ventaja <= u) return 0;
  const i = Math.min(100, Math.max(0, Number(intensidad) || 0)) / 100;
  return Math.min(1, 0.3 + (0.7 * (ventaja - u)) / u) * i;
}

export default function CarreraFreno({ edicion, onGuardado }) {
  const [form, setForm] = useState({ activo: true, ventaja: 6, intensidad: 80 });
  const [jugadores, setJugadores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const bloqueada = edicion.estado === "terminada";

  useEffect(() => {
    setForm({
      activo: edicion.freno_activo ?? true,
      ventaja: edicion.freno_ventaja ?? 6,
      intensidad: edicion.freno_intensidad ?? 80,
    });
    supabase
      .rpc("admin_carrera_jugadores", { p_edicion: edicion.id })
      .then(({ data }) => setJugadores(data || []));
  }, [edicion]);

  const cambiar = (cambios) => setForm((a) => ({ ...a, ...cambios }));
  const ventaja = Math.max(1, Math.round(Number(form.ventaja) || 1));
  const intensidad = Math.min(100, Math.max(0, Math.round(Number(form.intensidad) || 0)));

  async function guardar() {
    setMensaje("");
    setError("");
    setGuardando(true);
    const { error: err } = await supabase
      .from("carrera_ediciones")
      .update({
        freno_activo: Boolean(form.activo),
        freno_ventaja: ventaja,
        freno_intensidad: intensidad,
        updated_at: new Date().toISOString(),
      })
      .eq("id", edicion.id);
    setGuardando(false);
    if (err) {
      setError(
        err.message?.includes("freno")
          ? "Falta aplicar la migración migracion_carrera_freno_lider.sql en Supabase."
          : `No se ha podido guardar: ${err.message}`
      );
      return;
    }
    setMensaje("Freno al líder guardado.");
    onGuardado?.();
  }

  // Ahora mismo: a quién frenaría en su próxima tirada.
  const conTiradas = jugadores.filter((j) => Number(j.tiradas_hechas) > 0);
  const estado = conTiradas
    .map((j) => {
      const otros = conTiradas.filter((o) => o.cliente_id !== j.cliente_id);
      if (!otros.length) return null;
      const media = otros.reduce((s, o) => s + Number(o.casilla || 1), 0) / otros.length;
      const v = Math.max(0, Number(j.casilla || 1) - media);
      return { ...j, media, ventajaReal: v, freno: form.activo ? fuerzaFreno(v, ventaja, intensidad) : 0 };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.casilla) - Number(a.casilla))
    .slice(0, 8);

  return (
    <div style={contenedor}>
      <h4 style={tituloSeccion}>🐢 Freno al líder</h4>
      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}

      <label style={campoCheckbox}>
        <input type="checkbox" checked={Boolean(form.activo)} disabled={bloqueada} onChange={(e) => cambiar({ activo: e.target.checked })} />
        <span>Freno activo</span>
      </label>

      <div style={fila}>
        <label style={{ ...campo, maxWidth: 300 }}>
          <span>Empieza a frenar cuando saca a la media de los demás más de… (casillas)</span>
          <input id="lc-freno-ventaja" style={input} type="number" min={1} max={40} value={form.ventaja} disabled={bloqueada} onChange={(e) => cambiar({ ventaja: e.target.value })} />
        </label>

        <div style={{ ...campo, flex: 1, minWidth: 280 }}>
          <span>Intensidad del freno: {intensidad} %</span>
          <input id="lc-freno-intensidad" type="range" min={0} max={100} step={5} value={intensidad} disabled={bloqueada} onChange={(e) => cambiar({ intensidad: e.target.value })} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {NIVELES.map((n) => (
              <button
                key={n.valor}
                type="button"
                disabled={bloqueada}
                onClick={() => cambiar({ intensidad: n.valor })}
                style={nivel(intensidad === n.valor)}
              >
                {n.texto}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p style={ayuda}>
        En cada tirada se mira cuántas casillas le saca el cliente a la <strong>media de los demás</strong> jugadores. Si
        le saca más de <strong>{ventaja}</strong>, al que va escapado: le salen <strong>más 1, 2 y 3</strong> en el dado,
        le cuesta más caer en <strong>Palets y Lojo</strong> (que avanzan y dan otra tirada), los{" "}
        <strong>villanos le pillan más</strong> y <strong>José Luis y Rafa le salvan menos</strong>. El freno empieza
        suave y llega a tope cuando le saca <strong>{ventaja * 2}</strong> casillas. A los que van detrás no les cambia
        nada. En la TV no se nota: el dado sale normal.
      </p>

      {estado.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          <strong style={{ fontSize: 14, color: "#374151" }}>Ahora mismo (próxima tirada de cada uno)</strong>
          <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={th}>Cliente</th>
                <th style={th}>Casilla</th>
                <th style={th}>Ventaja sobre la media</th>
                <th style={th}>Freno</th>
              </tr>
            </thead>
            <tbody>
              {estado.map((j) => (
                <tr key={j.cliente_id}>
                  <td style={td}>{j.cliente_nombre}</td>
                  <td style={td}>{j.casilla}</td>
                  <td style={td}>{j.ventajaReal > 0 ? `+${j.ventajaReal.toFixed(1)}` : "—"}</td>
                  <td style={{ ...td, fontWeight: 800, color: j.freno > 0 ? "#b91c1c" : "#6b7280" }}>
                    {j.freno > 0 ? `🐢 ${Math.round(j.freno * 100)} %` : "Sin freno"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!bloqueada && (
        <button type="button" style={boton} onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar freno al líder"}
        </button>
      )}
    </div>
  );
}

const nivel = (activo) => ({
  border: `1px solid ${activo ? "#7c3aed" : "#d1d5db"}`,
  background: activo ? "#ede9fe" : "#fff",
  color: activo ? "#5b21b6" : "#374151",
  borderRadius: 999,
  padding: "5px 12px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
});
const th = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700 };
const td = { padding: "6px 8px", borderBottom: "1px solid #f3f4f6" };
