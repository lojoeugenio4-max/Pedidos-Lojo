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

// ⭐ FAVORITOS Y PREMIOS: lista de clientes favoritos y el premio que se lleva
// cada uno (una casilla de premio concreta o «cualquier premio»). Lo asegura
// el servidor en cada tirada (carrera_tirar_qr, migración
// migracion_carrera_favoritos_premios.sql):
//  · con su casilla a tiro, cae en ella;
//  · mientras tanto, no se pasa de su casilla ni cae en otro premio;
//  · cuando ya ha ganado su premio, no gana más premios de casilla.
// En la TV y en el TPV la tirada se ve normal.

const NIVELES = [50, 75, 100];
const hoyISO = () => new Date().toISOString().slice(0, 10);

function normalizar(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function leerAsignaciones(edicion) {
  if (Array.isArray(edicion.empujon_asignaciones) && edicion.empujon_asignaciones.length) {
    return edicion.empujon_asignaciones
      .filter((a) => a && a.token)
      .map((a) => ({ token: String(a.token), casilla: a.casilla == null || a.casilla === "" ? null : Number(a.casilla) }));
  }
  // Lista antigua del Empujón (solo clientes) → «cualquier premio».
  return (Array.isArray(edicion.empujon_clientes) ? edicion.empujon_clientes : []).map((t) => ({ token: String(t), casilla: null }));
}

export default function CarreraFavoritos({ edicion, onGuardado }) {
  const [form, setForm] = useState({ activo: false, prob: 100, distancia: 6, soloElegidos: true });
  const [asignaciones, setAsignaciones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [casillas, setCasillas] = useState([]);
  const [contador, setContador] = useState({});
  const [articulos, setArticulos] = useState({});
  const [ganados, setGanados] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [cambiosSinGuardar, setCambiosSinGuardar] = useState(false);
  const bloqueada = edicion.estado === "terminada";
  const faltaMigracion = edicion.empujon_asignaciones === undefined;

  useEffect(() => {
    setForm({
      activo: Boolean(edicion.empujon_activo),
      prob: edicion.empujon_prob ?? 100,
      distancia: edicion.empujon_distancia ?? 6,
      soloElegidos: edicion.empujon_solo_elegidos ?? true,
    });
    setAsignaciones(leerAsignaciones(edicion));
    setCambiosSinGuardar(false);
  }, [edicion]);

  const cargar = useCallback(async () => {
    const [cl, ju, ca, co, pr] = await Promise.all([
      supabase.from("clientes").select("id,token,nombre,codigo_lojo,estado").order("nombre", { ascending: true }),
      supabase.rpc("admin_carrera_jugadores", { p_edicion: edicion.id }),
      supabase.from("carrera_casillas_premio").select("*").eq("edicion_id", edicion.id).order("casilla", { ascending: true }),
      supabase.rpc("admin_carrera_premios_contador", { p_edicion: edicion.id }),
      supabase.rpc("admin_listar_premios_carrera", { p_edicion: edicion.id }),
    ]);
    if (cl.error) setError(`No se han podido cargar los clientes: ${cl.error.message}`);
    setClientes(cl.data || []);
    setJugadores(ju.data || []);
    const listaCasillas = ca.data || [];
    setCasillas(listaCasillas);
    setContador(Object.fromEntries((co.data || []).map((c) => [Number(c.casilla), Number(c.dados || 0)])));
    setGanados((pr.data || []).filter((p) => !["mitad", "final", "meta"].includes(String(p.tipo || ""))));
    const ids = [...new Set(listaCasillas.map((c) => c.articulo_id).filter(Boolean).map(String))];
    if (ids.length) {
      const { data: arts } = await supabase.from("articulos").select("id,nombre").in("id", ids);
      setArticulos(Object.fromEntries((arts || []).map((a) => [String(a.id), a.nombre])));
    }
    setCargando(false);
  }, [edicion.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const prob = Math.min(100, Math.max(0, Math.round(Number(form.prob) || 0)));
  const distancia = Math.min(6, Math.max(1, Math.round(Number(form.distancia) || 6)));
  const cambiar = (cambios) => {
    setMensaje("");
    setCambiosSinGuardar(true);
    setForm((a) => ({ ...a, ...cambios }));
  };

  // cliente_id de la carrera puede ser el id o el token del cliente.
  const clientePorClave = useMemo(() => {
    const m = new Map();
    clientes.forEach((c) => {
      if (c.token) m.set(String(c.token), c);
      if (c.id != null) m.set(String(c.id), c);
    });
    return m;
  }, [clientes]);
  const tokenDe = useCallback((clave) => clientePorClave.get(String(clave))?.token || String(clave), [clientePorClave]);

  const jugadorPorToken = useMemo(() => {
    const m = new Map();
    jugadores.forEach((j) => m.set(String(tokenDe(j.cliente_id)), j));
    return m;
  }, [jugadores, tokenDe]);

  const ganadoPorToken = useMemo(() => {
    const m = new Map();
    ganados.forEach((p) => {
      const t = String(tokenDe(p.cliente_id));
      if (!m.has(t)) m.set(t, p);
    });
    return m;
  }, [ganados, tokenDe]);

  // Info de cada casilla de premio: texto, si se puede dar hoy y cuántas quedan.
  const infoCasilla = useMemo(() => {
    const m = new Map();
    casillas.forEach((c) => {
      const art = c.articulo_id ? articulos[String(c.articulo_id)] : "";
      const textoArt = art ? `${c.cantidad || 1} ${c.formato === "cajas" ? "caja(s)" : "ud(s)."} de ${art}` : "";
      const texto = String(c.texto || "").trim() || textoArt || (c.articulo_id ? "Artículo" : "");
      const maximo = Number(c.maximo) || 0;
      const quedan = Math.max(0, maximo - (contador[Number(c.casilla)] || 0));
      let problema = "";
      if (!c.activa) problema = "desactivada";
      else if (!texto) problema = "sin premio puesto";
      else if (quedan <= 0) problema = "agotada";
      else if (c.fecha_desde && c.fecha_desde > hoyISO()) problema = `disponible desde el ${new Date(c.fecha_desde).toLocaleDateString("es-ES")}`;
      m.set(Number(c.casilla), { casilla: Number(c.casilla), texto, quedan, problema });
    });
    return m;
  }, [casillas, contador, articulos]);

  const asignadosPorCasilla = useMemo(() => {
    const m = {};
    asignaciones.forEach((a) => {
      if (a.casilla != null && !ganadoPorToken.has(a.token)) m[a.casilla] = (m[a.casilla] || 0) + 1;
    });
    return m;
  }, [asignaciones, ganadoPorToken]);

  const enLista = useMemo(() => new Set(asignaciones.map((a) => a.token)), [asignaciones]);

  const resultados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (q.length < 2) return [];
    return clientes
      .filter((c) => c.token && !enLista.has(String(c.token)))
      .filter((c) => normalizar(c.nombre).includes(q) || normalizar(c.codigo_lojo).includes(q))
      .slice(0, 8);
  }, [busqueda, clientes, enLista]);

  function anadir(token) {
    if (!token || enLista.has(String(token))) return;
    setMensaje("");
    setCambiosSinGuardar(true);
    setAsignaciones((l) => [...l, { token: String(token), casilla: null }]);
  }
  function quitar(token) {
    setMensaje("");
    setCambiosSinGuardar(true);
    setAsignaciones((l) => l.filter((a) => a.token !== token));
  }
  function asignarPremio(token, valor) {
    setMensaje("");
    setCambiosSinGuardar(true);
    setAsignaciones((l) => l.map((a) => (a.token === token ? { ...a, casilla: valor === "" ? null : Number(valor) } : a)));
  }

  function estadoDe(a) {
    const ganado = ganadoPorToken.get(a.token);
    if (ganado) return { icono: "🏆", texto: `Ya ha ganado su premio (casilla ${ganado.casilla ?? "?"})`, color: "#166534" };
    const j = jugadorPorToken.get(a.token);
    const pos = j ? Number(j.casilla) || 1 : 1;
    if (a.casilla == null) {
      const aTiro = [...infoCasilla.values()].find((c) => !c.problema && c.casilla > pos && c.casilla <= pos + distancia);
      if (aTiro) return { icono: "🎯", texto: `Tiene a tiro la casilla ${aTiro.casilla}`, color: "#166534" };
      return { icono: "🎲", texto: j ? "Esperando a tener un premio a tiro" : "Aún no ha tirado", color: "#6b7280" };
    }
    const c = infoCasilla.get(a.casilla);
    if (!c) return { icono: "⚠️", texto: "Esa casilla no existe en esta edición", color: "#b91c1c" };
    if (c.problema) return { icono: "⚠️", texto: `Su casilla está ${c.problema}: no se le puede dar`, color: "#b91c1c" };
    if (pos >= a.casilla) return { icono: "⚠️", texto: "Ya ha pasado su casilla: elige otra", color: "#b91c1c" };
    const faltan = a.casilla - pos;
    if (faltan <= distancia)
      return { icono: "🎯", texto: prob >= 100 ? "Lo tiene a tiro: lo gana en su próxima tirada" : "Lo tiene a tiro", color: "#166534" };
    return { icono: "⏳", texto: `Le faltan ${faltan} casillas (no se pasará)`, color: "#92400e" };
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
        empujon_asignaciones: asignaciones,
        empujon_clientes: asignaciones.map((a) => a.token),
        updated_at: new Date().toISOString(),
      })
      .eq("id", edicion.id);
    setGuardando(false);
    if (err) {
      setError(
        err.message?.includes("empujon")
          ? "Falta aplicar la migración migracion_carrera_favoritos_premios.sql en Supabase."
          : `No se ha podido guardar: ${err.message}`
      );
      return;
    }
    setCambiosSinGuardar(false);
    setMensaje("Favoritos y premios guardados. Se aplica desde la próxima tirada.");
    onGuardado?.();
  }

  if (cargando) return <p style={{ color: "#6b7280" }}>Cargando favoritos...</p>;

  const opcionesCasilla = [...infoCasilla.values()];
  const sobreasignadas = opcionesCasilla.filter((c) => (asignadosPorCasilla[c.casilla] || 0) > c.quedan);
  const jugadoresSinLista = [...jugadores]
    .filter((j) => !enLista.has(String(tokenDe(j.cliente_id))))
    .sort((a, b) => Number(b.casilla || 1) - Number(a.casilla || 1));

  return (
    <div style={contenedor}>
      <h4 style={tituloSeccion}>⭐ Clientes favoritos y su premio</h4>
      {faltaMigracion && (
        <div style={avisoAtencion}>
          Falta aplicar en Supabase la migración <strong>migracion_carrera_favoritos_premios.sql</strong>. Sin ella no se puede guardar.
        </div>
      )}
      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}

      <label style={campoCheckbox}>
        <input type="checkbox" checked={Boolean(form.activo)} disabled={bloqueada} onChange={(e) => cambiar({ activo: e.target.checked })} />
        <span>
          <strong>Activado</strong> (si está apagado, el dado juega normal para todos)
        </span>
      </label>
      <label style={campoCheckbox}>
        <input type="checkbox" checked={Boolean(form.soloElegidos)} disabled={bloqueada} onChange={(e) => cambiar({ soloElegidos: e.target.checked })} />
        <span>Solo los favoritos de la lista pueden caer en premios (los demás nunca caen)</span>
      </label>

      <p style={ayuda}>
        Cada favorito se lleva <strong>un</strong> premio: el que elijas en la lista. Mientras no lo tenga a tiro, el dado no le deja
        pasarse de su casilla ni caer en otro premio; cuando lo tiene a 1-{distancia} casillas, cae en él. Cuando ya lo ha ganado, no gana
        más premios de casilla. Se respetan el máximo de veces y la fecha de cada casilla. En la TV y en el TPV la tirada se ve normal.
      </p>

      {form.activo && asignaciones.length === 0 && form.soloElegidos && (
        <div style={avisoAtencion}>⚠️ La lista está vacía: así nadie puede caer en las casillas de premio.</div>
      )}
      {sobreasignadas.map((c) => (
        <div key={c.casilla} style={avisoAtencion}>
          ⚠️ La casilla {c.casilla} tiene {asignadosPorCasilla[c.casilla]} favoritos esperando y solo le quedan {c.quedan}. Sube su máximo
          en «Casillas de premio» o cambia el premio de alguno.
        </div>
      ))}

      {/* LISTA DE FAVORITOS */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 14, width: "100%", minWidth: 720 }}>
          <thead>
            <tr>
              <th style={th}>⭐ Cliente</th>
              <th style={th}>Casilla</th>
              <th style={th}>Premio que se lleva</th>
              <th style={th}>Estado</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {asignaciones.length === 0 && (
              <tr>
                <td style={{ ...td, color: "#6b7280" }} colSpan={5}>
                  Todavía no hay favoritos. Añádelos con el buscador o desde los jugadores del tablero.
                </td>
              </tr>
            )}
            {asignaciones.map((a) => {
              const c = clientePorClave.get(a.token);
              const j = jugadorPorToken.get(a.token);
              const est = estadoDe(a);
              const ganado = ganadoPorToken.has(a.token);
              return (
                <tr key={a.token}>
                  <td style={td}>
                    <strong>{c?.nombre || j?.cliente_nombre || "Cliente"}</strong>
                    {c?.codigo_lojo && <div style={{ fontSize: 12, color: "#6b7280" }}>Código {c.codigo_lojo}</div>}
                  </td>
                  <td style={td}>{j ? j.casilla : "—"}</td>
                  <td style={td}>
                    <select
                      aria-label={`Premio para ${c?.nombre || "cliente"}`}
                      style={{ ...input, minWidth: 240 }}
                      value={a.casilla == null ? "" : String(a.casilla)}
                      disabled={bloqueada || ganado}
                      onChange={(e) => asignarPremio(a.token, e.target.value)}
                    >
                      <option value="">🎲 Cualquier premio (el primero que tenga a tiro)</option>
                      {opcionesCasilla.map((op) => (
                        <option key={op.casilla} value={op.casilla}>
                          🎁 Casilla {op.casilla} · {op.texto || "sin premio"}
                          {op.problema ? ` (${op.problema})` : ` (quedan ${op.quedan})`}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ ...td, color: est.color, fontWeight: 700 }}>
                    {est.icono} {est.texto}
                  </td>
                  <td style={td}>
                    {!bloqueada && (
                      <button type="button" style={botonSecundario} onClick={() => quitar(a.token)}>
                        Quitar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!bloqueada && (
        <label style={campo}>
          <span>Añadir favorito</span>
          <input
            id="lc-fav-buscar"
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
                  {jugadorPorToken.get(String(c.token)) ? ` · casilla ${jugadorPorToken.get(String(c.token)).casilla}` : " · aún no ha tirado"}
                </div>
              </div>
              <button
                type="button"
                style={boton}
                onClick={() => {
                  anadir(c.token);
                  setBusqueda("");
                }}
              >
                ⭐ Añadir
              </button>
            </div>
          ))}
        </div>
      )}
      {busqueda.trim().length >= 2 && resultados.length === 0 && (
        <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>No hay clientes con ese nombre (o ya están en la lista).</p>
      )}

      {/* AJUSTES */}
      <div style={fila}>
        <div style={{ ...campo, flex: 1, minWidth: 260 }}>
          <span>Rapidez: probabilidad de caer en su premio cuando lo tiene a tiro: {prob} %</span>
          <input type="range" min={0} max={100} step={5} value={prob} disabled={bloqueada} onChange={(e) => cambiar({ prob: e.target.value })} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {NIVELES.map((n) => (
              <button key={n} type="button" disabled={bloqueada} onClick={() => cambiar({ prob: n })} style={nivel(prob === n)}>
                {n} %
              </button>
            ))}
          </div>
          <small style={{ color: "#6b7280" }}>
            Con menos del 100 % tarda alguna tirada más (queda más natural), pero tampoco se pasa de su casilla.
          </small>
        </div>
        <label style={{ ...campo, maxWidth: 260 }}>
          <span>«A tiro» es estar a… (casillas)</span>
          <select style={input} value={distancia} disabled={bloqueada} onChange={(e) => cambiar({ distancia: e.target.value })}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n === 6 ? "1 a 6 (cualquier tirada del dado)" : `1 a ${n}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!bloqueada && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" style={boton} onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar favoritos y premios"}
          </button>
          {cambiosSinGuardar && <span style={{ color: "#b45309", fontWeight: 700, fontSize: 13 }}>Hay cambios sin guardar</span>}
        </div>
      )}

      {/* JUGADORES DEL TABLERO QUE NO ESTÁN EN LA LISTA */}
      {!bloqueada && jugadoresSinLista.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          <strong style={{ fontSize: 15, color: "#111827" }}>Otros jugadores del tablero ({jugadoresSinLista.length})</strong>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 14, width: "100%" }}>
              <tbody>
                {jugadoresSinLista.map((j) => (
                  <tr key={j.cliente_id}>
                    <td style={td}>{j.cliente_nombre}</td>
                    <td style={td}>Casilla {j.casilla}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <button type="button" style={botonSecundario} onClick={() => anadir(tokenDe(j.cliente_id))}>
                        ⭐ Añadir a favoritos
                      </button>
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
const th = { textAlign: "left", padding: "8px", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 700 };
const td = { padding: "8px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle" };
