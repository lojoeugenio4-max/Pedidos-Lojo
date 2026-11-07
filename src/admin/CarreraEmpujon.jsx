import { useCallback, useEffect, useMemo, useState } from "react";
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
  avisoError,
  avisoOk,
  avisoAtencion,
  ayuda,
} from "./lojopolyEstilos";

// EMPUJÓN A PREMIO: el Admin elige qué clientes pueden caer en las casillas
// de premio y la probabilidad de que, si tienen un premio cerca (a 1-6
// casillas), su ficha caiga en él en la siguiente tirada. Lo decide el
// servidor (carrera_tirar_qr, migración migracion_carrera_empujon_premio.sql):
// en la TV y en el TPV la tirada se ve normal.

const NIVELES = [25, 50, 75, 100];

function normalizar(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export default function CarreraEmpujon({ edicion, onGuardado }) {
  const [form, setForm] = useState({ activo: false, prob: 50, distancia: 6, soloElegidos: true });
  const [elegidos, setElegidos] = useState([]); // tokens de clientes
  const [clientes, setClientes] = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [casillas, setCasillas] = useState([]);
  const [contador, setContador] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const bloqueada = edicion.estado === "terminada";
  const faltaMigracion = edicion.empujon_activo === undefined;

  useEffect(() => {
    setForm({
      activo: Boolean(edicion.empujon_activo),
      prob: edicion.empujon_prob ?? 50,
      distancia: edicion.empujon_distancia ?? 6,
      soloElegidos: edicion.empujon_solo_elegidos ?? true,
    });
    setElegidos(Array.isArray(edicion.empujon_clientes) ? edicion.empujon_clientes.map(String) : []);
  }, [edicion]);

  const cargar = useCallback(async () => {
    const [cl, ju, ca, co] = await Promise.all([
      supabase.from("clientes").select("id,token,nombre,codigo_lojo,estado").order("nombre", { ascending: true }),
      supabase.rpc("admin_carrera_jugadores", { p_edicion: edicion.id }),
      supabase.from("carrera_casillas_premio").select("*").eq("edicion_id", edicion.id).order("casilla", { ascending: true }),
      supabase.rpc("admin_carrera_premios_contador", { p_edicion: edicion.id }),
    ]);
    if (cl.error) setError(`No se han podido cargar los clientes: ${cl.error.message}`);
    setClientes(cl.data || []);
    setJugadores(ju.data || []);
    setCasillas(ca.data || []);
    setContador(Object.fromEntries((co.data || []).map((c) => [c.casilla, Number(c.dados || 0)])));
    setCargando(false);
  }, [edicion.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiar = (cambios) => setForm((a) => ({ ...a, ...cambios }));
  const prob = Math.min(100, Math.max(0, Math.round(Number(form.prob) || 0)));
  const distancia = Math.min(6, Math.max(1, Math.round(Number(form.distancia) || 6)));
  const setElegidosSet = useMemo(() => new Set(elegidos), [elegidos]);

  // cliente_id de la carrera puede ser el id o el token del cliente.
  const clientePorClave = useMemo(() => {
    const m = new Map();
    clientes.forEach((c) => {
      if (c.token) m.set(String(c.token), c);
      if (c.id != null) m.set(String(c.id), c);
    });
    return m;
  }, [clientes]);

  const tokenDeJugador = (j) => clientePorClave.get(String(j.cliente_id))?.token || null;

  // Casillas de premio en las que se puede caer hoy.
  const hoy = new Date().toISOString().slice(0, 10);
  const premiosDisponibles = casillas.filter((c) => {
    const tienePremio = String(c.texto || "").trim() || c.articulo_id;
    const maximo = Number(c.maximo) || 0;
    return c.activa && tienePremio && maximo > (contador[c.casilla] || 0) && (!c.fecha_desde || c.fecha_desde <= hoy);
  });

  function premioCerca(casilla) {
    const desde = Number(casilla) || 1;
    return premiosDisponibles.find((p) => p.casilla > desde && p.casilla <= desde + distancia) || null;
  }

  const resultados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (q.length < 2) return [];
    return clientes
      .filter((c) => c.token && !setElegidosSet.has(String(c.token)))
      .filter((c) => normalizar(c.nombre).includes(q) || normalizar(c.codigo_lojo).includes(q))
      .slice(0, 8);
  }, [busqueda, clientes, setElegidosSet]);

  function alternar(token, si) {
    if (!token) return;
    setMensaje("");
    setElegidos((lista) => (si ? [...new Set([...lista, String(token)])] : lista.filter((t) => t !== String(token))));
  }

  function marcarTodosLosJugadores(si) {
    const tokens = jugadores.map(tokenDeJugador).filter(Boolean).map(String);
    setMensaje("");
    setElegidos((lista) => (si ? [...new Set([...lista, ...tokens])] : lista.filter((t) => !tokens.includes(t))));
  }

  async function guardar() {
    setMensaje("");
    setError("");
    setGuardando(true);
    const { error: err } = await supabase
      .from("carrera_ediciones")
      .update({
        empujon_activo: Boolean(form.activo),
        empujon_prob: prob,
        empujon_distancia: distancia,
        empujon_solo_elegidos: Boolean(form.soloElegidos),
        empujon_clientes: elegidos,
        updated_at: new Date().toISOString(),
      })
      .eq("id", edicion.id);
    setGuardando(false);
    if (err) {
      setError(
        err.message?.includes("empujon")
          ? "Falta aplicar la migración migracion_carrera_empujon_premio.sql en Supabase."
          : `No se ha podido guardar: ${err.message}`
      );
      return;
    }
    setMensaje("Empujón a premio guardado. Se aplica desde la próxima tirada.");
    onGuardado?.();
  }

  if (cargando) return <p style={{ color: "#6b7280" }}>Cargando empujón a premio...</p>;

  const elegidosInfo = elegidos.map((t) => {
    const c = clientePorClave.get(t);
    const j = jugadores.find((x) => tokenDeJugador(x) === t);
    return { token: t, nombre: c?.nombre || "Cliente", codigo: c?.codigo_lojo, jugador: j };
  });
  const jugadoresOrdenados = [...jugadores].sort((a, b) => Number(b.casilla || 1) - Number(a.casilla || 1));

  return (
    <div style={contenedor}>
      <h4 style={tituloSeccion}>🎯 Empujón a premio</h4>
      {faltaMigracion && (
        <div style={avisoAtencion}>
          Falta aplicar en Supabase la migración <strong>migracion_carrera_empujon_premio.sql</strong>. Sin ella no se
          puede guardar.
        </div>
      )}
      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}

      <label style={campoCheckbox}>
        <input type="checkbox" checked={Boolean(form.activo)} disabled={bloqueada} onChange={(e) => cambiar({ activo: e.target.checked })} />
        <span>Empujón activo</span>
      </label>

      <div style={fila}>
        <div style={{ ...campo, flex: 1, minWidth: 260 }}>
          <span>Probabilidad de que caiga en el premio: {prob} %</span>
          <input id="lc-empujon-prob" type="range" min={0} max={100} step={5} value={prob} disabled={bloqueada} onChange={(e) => cambiar({ prob: e.target.value })} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {NIVELES.map((n) => (
              <button key={n} type="button" disabled={bloqueada} onClick={() => cambiar({ prob: n })} style={nivel(prob === n)}>
                {n} %
              </button>
            ))}
          </div>
        </div>

        <label style={{ ...campo, maxWidth: 260 }}>
          <span>«Cerca de un premio» es estar a… (casillas)</span>
          <select id="lc-empujon-distancia" style={input} value={distancia} disabled={bloqueada} onChange={(e) => cambiar({ distancia: e.target.value })}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n === 6 ? "1 a 6 (cualquier tirada del dado)" : `1 a ${n}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label style={campoCheckbox}>
        <input type="checkbox" checked={Boolean(form.soloElegidos)} disabled={bloqueada} onChange={(e) => cambiar({ soloElegidos: e.target.checked })} />
        <span>Solo los clientes elegidos pueden caer en premios (los demás nunca caen)</span>
      </label>

      <p style={ayuda}>
        Cuando un cliente elegido tira y tiene una casilla de premio <strong>disponible</strong> a {distancia === 1 ? "1 casilla" : `1-${distancia} casillas`},
        su ficha cae en ella con un <strong>{prob} %</strong> de probabilidad (y si no toca, aún puede caer por suerte).
        {form.soloElegidos
          ? " A los clientes no elegidos el dado nunca les deja en una casilla de premio."
          : " Los clientes no elegidos juegan normal: pueden caer en premios por suerte."}{" "}
        Se respetan el máximo de veces y la fecha de cada casilla. En la TV y en el TPV la tirada se ve normal.
      </p>

      {form.activo && form.soloElegidos && elegidos.length === 0 && (
        <div style={avisoAtencion}>⚠️ No hay ningún cliente elegido: así nadie puede caer en las casillas de premio.</div>
      )}
      {form.activo && premiosDisponibles.length === 0 && (
        <div style={avisoAtencion}>
          ⚠️ Ahora mismo no hay ninguna casilla de premio disponible (revisa en «Casillas de premio» que estén activas, con
          premio, con veces libres y con la fecha ya pasada).
        </div>
      )}

      {/* Clientes elegidos */}
      <div style={{ display: "grid", gap: 8 }}>
        <strong style={{ fontSize: 15, color: "#111827" }}>Clientes que pueden caer en premio ({elegidos.length})</strong>
        {elegidosInfo.length === 0 && <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>Todavía no has elegido ninguno.</p>}
        {elegidosInfo.map((c) => {
          const cerca = c.jugador ? premioCerca(c.jugador.casilla) : null;
          return (
            <div key={c.token} style={filaCliente}>
              <div>
                <strong>{c.nombre}</strong>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  {c.codigo ? `Código ${c.codigo} · ` : ""}
                  {c.jugador ? `Casilla ${c.jugador.casilla}` : "Aún no ha tirado"}
                  {cerca && (
                    <span style={{ color: "#166534", fontWeight: 800 }}> · 🎁 Premio cerca: casilla {cerca.casilla}</span>
                  )}
                </div>
              </div>
              {!bloqueada && (
                <button type="button" style={botonSecundario} onClick={() => alternar(c.token, false)}>
                  Quitar
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!bloqueada && (
        <label style={campo}>
          <span>Añadir cliente</span>
          <input
            id="lc-empujon-buscar"
            style={{ ...input, maxWidth: 420 }}
            type="search"
            placeholder="Escribe el nombre o el código Lojo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
      )}
      {resultados.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {resultados.map((c) => (
            <div key={c.token} style={filaCliente}>
              <div>
                <strong>{c.nombre || "Sin nombre"}</strong>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  {c.codigo_lojo ? `Código ${c.codigo_lojo}` : "Sin código"}
                  {c.estado === "inactivo" ? " · inactivo" : ""}
                </div>
              </div>
              <button
                type="button"
                style={boton}
                onClick={() => {
                  alternar(c.token, true);
                  setBusqueda("");
                }}
              >
                Añadir
              </button>
            </div>
          ))}
        </div>
      )}
      {busqueda.trim().length >= 2 && resultados.length === 0 && (
        <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>No hay clientes con ese nombre (o ya están elegidos).</p>
      )}

      {/* Jugadores del tablero */}
      {jugadoresOrdenados.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 15, color: "#111827" }}>Jugadores en el tablero ({jugadoresOrdenados.length})</strong>
            {!bloqueada && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={botonSecundario} onClick={() => marcarTodosLosJugadores(true)}>
                  Marcar todos
                </button>
                <button type="button" style={botonSecundario} onClick={() => marcarTodosLosJugadores(false)}>
                  Desmarcar todos
                </button>
              </div>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 14, width: "100%" }}>
              <thead>
                <tr>
                  <th style={th}>Puede caer</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Casilla</th>
                  <th style={th}>Premio cerca</th>
                </tr>
              </thead>
              <tbody>
                {jugadoresOrdenados.map((j) => {
                  const token = tokenDeJugador(j);
                  const cerca = premioCerca(j.casilla);
                  return (
                    <tr key={j.cliente_id}>
                      <td style={td}>
                        <input
                          type="checkbox"
                          aria-label={`Puede caer en premio: ${j.cliente_nombre}`}
                          checked={Boolean(token && setElegidosSet.has(String(token)))}
                          disabled={bloqueada || !token}
                          onChange={(e) => alternar(token, e.target.checked)}
                        />
                      </td>
                      <td style={td}>{j.cliente_nombre}</td>
                      <td style={td}>{j.casilla}</td>
                      <td style={{ ...td, color: cerca ? "#166534" : "#9ca3af", fontWeight: cerca ? 800 : 400 }}>
                        {cerca ? `🎁 Casilla ${cerca.casilla}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!bloqueada && (
        <button type="button" style={boton} onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar empujón a premio"}
        </button>
      )}
    </div>
  );
}

const nivel = (activo) => ({
  border: `1px solid ${activo ? "#059669" : "#d1d5db"}`,
  background: activo ? "#d1fae5" : "#fff",
  color: activo ? "#065f46" : "#374151",
  borderRadius: 999,
  padding: "5px 12px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
});
const filaCliente = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  padding: "10px 12px",
  borderRadius: 10,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
};
const th = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700 };
const td = { padding: "6px 8px", borderBottom: "1px solid #f3f4f6" };
