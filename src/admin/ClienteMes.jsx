// Admin · CLIENTE DEL MES (carrera de puntos).
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import CarreraClienteMes from "../components/clienteMes/CarreraClienteMes";
import { cargarClasificacionClienteMes, nombreMes } from "../utils/clienteMes";

function primerDiaMes(desplazamiento = 0) {
  const hoy = new Date();
  const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + desplazamiento, 1);
  const dos = (n) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-01`;
}

function fechaCorta(iso) {
  const [, m, d] = String(iso).split("-");
  return `${Number(d)}/${Number(m)}`;
}

const CONFIG_VACIA = {
  activo: false,
  solo_pruebas: true,
  fecha_inicio: "",
  puntos_por_pedido: 5,
  puntos_medio: 3,
  medio_art_cajas: 5,
  medio_art_unidades: 5,
  medio_uds_por_articulo: 5,
  puntos_base: 1,
  premio_2_texto: "",
  premio_3_texto: "",
  min_art_cajas: 10,
  min_art_unidades: 10,
  min_uds_por_articulo: 5,
  meta_puntos: 100,
  premio_texto: "",
};

export default function ClienteMes() {
  const [config, setConfig] = useState(CONFIG_VACIA);
  const [cargandoConfig, setCargandoConfig] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [mes, setMes] = useState(primerDiaMes(0));
  const [datos, setDatos] = useState(null);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [probandoCierre, setProbandoCierre] = useState(false);

  useEffect(() => {
    cargarConfig();
  }, []);

  useEffect(() => {
    cargarDatos(mes);
    const intervalo = window.setInterval(() => cargarDatos(mes, true), 30000);
    return () => window.clearInterval(intervalo);
  }, [mes]);

  async function cargarConfig() {
    setCargandoConfig(true);
    const { data, error: configError } = await supabase.from("cliente_mes_config").select("*").eq("id", 1).maybeSingle();
    if (configError) {
      console.error(configError);
      setError("No se ha podido cargar la configuración. ¿Has ejecutado migracion_cliente_del_mes.sql en Supabase?");
    } else if (data) {
      setConfig({
        ...CONFIG_VACIA,
        ...data,
        premio_texto: data.premio_texto || "",
        premio_2_texto: data.premio_2_texto || "",
        premio_3_texto: data.premio_3_texto || "",
        fecha_inicio: data.fecha_inicio || "",
      });
    }
    setCargandoConfig(false);
  }

  async function cargarDatos(mesIso, silencioso = false) {
    if (!silencioso) setCargandoDatos(true);
    try {
      setDatos(await cargarClasificacionClienteMes({ mes: mesIso }));
    } catch (err) {
      console.error(err);
      if (!silencioso) setError("No se ha podido cargar la clasificación.");
    } finally {
      if (!silencioso) setCargandoDatos(false);
    }
  }

  function cambiar(campo, valor) {
    setConfig((actual) => ({ ...actual, [campo]: valor }));
    setAviso("");
  }

  async function guardar() {
    if (config.activo && !config.fecha_inicio) {
      setError("Pon la fecha de comienzo: hasta esa fecha no se suma ningún punto.");
      return;
    }
    const n = (v, porDefecto) => (v === "" || v == null || Number.isNaN(Number(v)) ? porDefecto : Number(v));
    if (n(config.puntos_medio, 3) >= n(config.puntos_por_pedido, 5) || n(config.puntos_base, 1) >= n(config.puntos_medio, 3)) {
      setError("Los puntos tienen que ir de más a menos: nivel alto > nivel medio > base.");
      return;
    }
    setGuardando(true);
    setError("");
    setAviso("");
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_guardar_cliente_mes_config", {
        p_config: {
          activo: Boolean(config.activo),
          solo_pruebas: Boolean(config.solo_pruebas),
          fecha_inicio: config.fecha_inicio || "",
          puntos_alto: n(config.puntos_por_pedido, 5),
          min_art_cajas: n(config.min_art_cajas, 10),
          min_art_unidades: n(config.min_art_unidades, 10),
          min_uds_por_articulo: n(config.min_uds_por_articulo, 5),
          puntos_medio: n(config.puntos_medio, 3),
          medio_art_cajas: n(config.medio_art_cajas, 5),
          medio_art_unidades: n(config.medio_art_unidades, 5),
          medio_uds_por_articulo: n(config.medio_uds_por_articulo, 5),
          puntos_base: n(config.puntos_base, 1),
          meta_puntos: n(config.meta_puntos, 100),
          premio_1: config.premio_texto || "",
          premio_2: config.premio_2_texto || "",
          premio_3: config.premio_3_texto || "",
        },
      });
      if (rpcError) throw rpcError;
      if (!data?.ok) throw new Error("No se ha podido guardar.");
      setAviso("Guardado ✓");
      await cargarConfig();
      await cargarDatos(mes);
    } catch (err) {
      console.error(err);
      setError(err?.message || "No se ha podido guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrarPuntosPruebas() {
    if (!window.confirm("Se borrarán TODOS los puntos de los clientes de pruebas. Los clientes reales no se tocan. ¿Continuar?")) return;
    setBorrando(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_borrar_puntos_pruebas_cliente_mes");
      if (rpcError) throw rpcError;
      setAviso(`Borrados ${data?.borrados ?? 0} registros de pruebas ✓`);
      await cargarDatos(mes);
    } catch (err) {
      console.error(err);
      setError(err?.message || "No se han podido borrar los puntos de pruebas.");
    } finally {
      setBorrando(false);
    }
  }

  async function cierrePrueba() {
    setProbandoCierre(true);
    setError("");
    setAviso("");
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_cliente_mes_cierre_prueba");
      if (rpcError) throw rpcError;
      if (!data?.ok) throw new Error("Solo se puede probar con «Solo clientes de pruebas» marcado.");
      setAviso(
        data.premiados
          ? `Cierre de prueba hecho: ${data.premiados} premiado(s). Mira la TV y abre la app con un cliente de prueba del podio.`
          : "Cierre de prueba hecho, pero ningún cliente de prueba tiene puntos este mes."
      );
    } catch (err) {
      console.error(err);
      setError(err?.message || "No se ha podido hacer el cierre de prueba.");
    } finally {
      setProbandoCierre(false);
    }
  }

  async function deshacerCierresPrueba() {
    setProbandoCierre(true);
    setError("");
    try {
      const { error: rpcError } = await supabase.rpc("admin_cliente_mes_deshacer_pruebas");
      if (rpcError) throw rpcError;
      setAviso("Cierres de prueba deshechos ✓");
    } catch (err) {
      console.error(err);
      setError(err?.message || "No se han podido deshacer los cierres de prueba.");
    } finally {
      setProbandoCierre(false);
    }
  }

  const filas = Array.isArray(datos?.filas) ? datos.filas : [];
  const mesActual = primerDiaMes(0);
  const esMesPasado = mes < mesActual;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <h2 style={titulo}>🏆 Cliente del mes</h2>
        <p style={texto}>
          Carrera de puntos: cada pedido hecho por la App suma puntos <strong>al pasar su QR en caja</strong>, igual que el
          resto de juegos. Según el pedido vale los puntos del nivel alto, del nivel medio o, si no llega a ninguno, los de
          base por haber usado la App. Se puntúa <strong>una vez por cliente y día</strong>: si ese día pasa otro pedido que
          vale más, se queda el mejor. Premio para el podio (1º, 2º y 3º) el último día del mes; si hay empate, va delante
          quien llegó antes. Cada día 1 empieza una carrera nueva.
        </p>
      </div>

      {error && <div style={avisoError}>{error}</div>}

      <section style={caja}>
        <h3 style={subtitulo}>Configuración</h3>
        {cargandoConfig ? (
          <p style={texto}>Cargando...</p>
        ) : (
          <>
            <div style={filaChecks}>
              <label style={check}>
                <input type="checkbox" checked={Boolean(config.activo)} onChange={(e) => cambiar("activo", e.target.checked)} />
                <span>
                  <strong>Activado</strong> — los clientes ven «Cliente del mes» en Juegos
                </span>
              </label>
              <label style={check}>
                <input
                  type="checkbox"
                  checked={Boolean(config.solo_pruebas)}
                  onChange={(e) => cambiar("solo_pruebas", e.target.checked)}
                />
                <span>
                  <strong>Solo clientes de pruebas</strong> — solo los clientes marcados «de pruebas» lo ven y suman.
                  Al desmarcarlo sale al público y los de pruebas dejan de contar.
                </span>
              </label>
            </div>
            <div style={rejilla}>
              <label style={campo}>
                <span>Fecha de comienzo</span>
                <input
                  style={input}
                  type="date"
                  value={config.fecha_inicio || ""}
                  onChange={(e) => cambiar("fecha_inicio", e.target.value)}
                />
              </label>
              <Campo etiqueta="Meta (puntos del cofre)" valor={config.meta_puntos} onChange={(v) => cambiar("meta_puntos", v)} />
            </div>

            <Nivel
              titulo="🟡 Nivel alto"
              puntos={config.puntos_por_pedido}
              onPuntos={(v) => cambiar("puntos_por_pedido", v)}
              cajas={config.min_art_cajas}
              onCajas={(v) => cambiar("min_art_cajas", v)}
              articulos={config.min_art_unidades}
              onArticulos={(v) => cambiar("min_art_unidades", v)}
              uds={config.min_uds_por_articulo}
              onUds={(v) => cambiar("min_uds_por_articulo", v)}
            />
            <Nivel
              titulo="🔵 Nivel medio"
              puntos={config.puntos_medio}
              onPuntos={(v) => cambiar("puntos_medio", v)}
              cajas={config.medio_art_cajas}
              onCajas={(v) => cambiar("medio_art_cajas", v)}
              articulos={config.medio_art_unidades}
              onArticulos={(v) => cambiar("medio_art_unidades", v)}
              uds={config.medio_uds_por_articulo}
              onUds={(v) => cambiar("medio_uds_por_articulo", v)}
            />
            <div style={reglaBox}>
              <strong>⚪ Base — por usar la App</strong>
              <div style={rejilla}>
                <Campo etiqueta="Puntos (si no llega a ningún nivel)" valor={config.puntos_base} onChange={(v) => cambiar("puntos_base", v)} />
              </div>
            </div>

            <div style={reglaBox}>
              <strong>🏆 Premios del podio (se ven en la carrera)</strong>
              <div style={rejilla}>
                <CampoTexto etiqueta="🥇 1º puesto" valor={config.premio_texto} onChange={(v) => cambiar("premio_texto", v)} />
                <CampoTexto etiqueta="🥈 2º puesto" valor={config.premio_2_texto} onChange={(v) => cambiar("premio_2_texto", v)} />
                <CampoTexto etiqueta="🥉 3º puesto" valor={config.premio_3_texto} onChange={(v) => cambiar("premio_3_texto", v)} />
              </div>
            </div>
            <p style={{ ...texto, marginTop: 8 }}>
              La meta es el final de la barra, donde está el cofre. Como referencia: con {config.puntos_por_pedido || 5} puntos
              al día, {config.meta_puntos || 100} puntos son {Math.ceil((Number(config.meta_puntos) || 100) / (Number(config.puntos_por_pedido) || 5))} días con pedido del nivel alto.
              Los cambios de mínimos y de puntos se aplican a los QR que se pasen a partir de ahora.
            </p>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
              <button type="button" style={boton} onClick={guardar} disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar"}
              </button>
              {config.solo_pruebas && (
                <button type="button" style={botonSecundario} onClick={borrarPuntosPruebas} disabled={borrando}>
                  {borrando ? "Borrando..." : "🧹 Borrar puntos de pruebas"}
                </button>
              )}
              {aviso && <span style={{ color: "#166534", fontWeight: 800 }}>{aviso}</span>}
            </div>
            <div style={{ ...reglaBox, marginTop: 14 }}>
              <strong>🎁 Cierre del mes y cofres del podio</strong>
              <p style={texto}>
                El día 1 se cierra solo el mes anterior: la pantalla grande abre los cofres del 1º, 2º y 3º con su premio,
                y cada premiado ve su cofre en el móvil la primera vez que abre la app. Para repetir la ceremonia en la TV:
                «Pedidos recibidos» → 🎁 Cofres del podio.
              </p>
              {config.solo_pruebas && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" style={botonSecundario} onClick={cierrePrueba} disabled={probandoCierre}>
                    🧪 Probar cierre del mes con los clientes de prueba
                  </button>
                  <button type="button" style={botonSecundario} onClick={deshacerCierresPrueba} disabled={probandoCierre}>
                    Deshacer cierres de prueba
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <section style={caja}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h3 style={subtitulo}>Clasificación de {nombreMes(mes)}</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={botonSecundario} onClick={() => setMes(primerDiaMes(-1))} disabled={mes === primerDiaMes(-1)}>
              Mes anterior
            </button>
            <button type="button" style={botonSecundario} onClick={() => setMes(mesActual)} disabled={mes === mesActual}>
              Mes actual
            </button>
          </div>
        </div>
        {esMesPasado && filas[0] && (
          <div style={ganadorBox}>
            <strong>🏆 Podio de {nombreMes(mes)}</strong>
            {filas.slice(0, 3).map((f, i) => (
              <div key={i}>
                {["🥇", "🥈", "🥉"][i]} <strong>{f.nombre}</strong> — {f.puntos} puntos
                {(datos?.premios || [])[i] ? ` · Premio: ${datos.premios[i]}` : ""}
              </div>
            ))}
          </div>
        )}
        <p style={texto}>
          Para verla en la tienda: «Pedidos recibidos» → Pantalla grande → 🏆 Cliente del mes.
        </p>
        <CarreraClienteMes key={mes} datos={datos} variante="admin" cargando={cargandoDatos} />

        {filas.length > 0 && (
          <table style={tabla}>
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={th}>Cliente</th>
                <th style={th}>Puntos</th>
                <th style={th}>Días que han contado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={`${f.posicion}-${f.nombre}`}>
                  <td style={td}>{f.posicion}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{f.nombre}</td>
                  <td style={td}>{f.puntos}</td>
                  <td style={{ ...td, color: "#4b5563" }}>{(f.dias || []).map(fechaCorta).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Nivel({ titulo, puntos, onPuntos, cajas, onCajas, articulos, onArticulos, uds, onUds }) {
  return (
    <div style={reglaBox}>
      <strong>{titulo}</strong>
      <div style={rejilla}>
        <Campo etiqueta="Puntos de este nivel" valor={puntos} onChange={onPuntos} />
        <Campo etiqueta="Por cajas: artículos distintos (1 caja o más)" valor={cajas} onChange={onCajas} />
        <Campo etiqueta="O por unidades: artículos distintos" valor={articulos} onChange={onArticulos} />
        <Campo etiqueta="…con estas unidades o más de cada uno" valor={uds} onChange={onUds} />
      </div>
      <p style={texto}>
        Vale {puntos || "?"} puntos si lleva {cajas || "?"} artículos distintos con al menos 1 caja, <strong>o</strong>{" "}
        {articulos || "?"} artículos distintos con al menos {uds || "?"} unidades de cada uno.
      </p>
    </div>
  );
}

function CampoTexto({ etiqueta, valor, onChange }) {
  return (
    <label style={campo}>
      <span>{etiqueta}</span>
      <input style={input} type="text" placeholder="Ej: Cheque de 100 €" value={valor || ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Campo({ etiqueta, valor, onChange }) {
  return (
    <label style={campo}>
      <span>{etiqueta}</span>
      <input style={input} type="number" min="0" value={valor} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

const titulo = { margin: "0 0 6px", fontSize: 22, color: "#111827" };
const subtitulo = { margin: "0 0 12px", fontSize: 17, color: "#111827" };
const texto = { margin: 0, color: "#6b7280", fontSize: 13, lineHeight: 1.5 };
const caja = { display: "grid", gap: 12, padding: 18, borderRadius: 14, border: "1px solid #e5e7eb", background: "#fff" };
const filaChecks = { display: "grid", gap: 8, marginBottom: 12 };
const check = { display: "flex", gap: 10, alignItems: "center", fontSize: 14, color: "#374151", cursor: "pointer" };
const rejilla = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 };
const campo = { display: "grid", gap: 6, fontSize: 14, color: "#374151", fontWeight: 600 };
const input = { padding: "9px 11px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 14, width: "100%", boxSizing: "border-box" };
const boton = { border: 0, borderRadius: 10, padding: "11px 22px", background: "#059669", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" };
const botonSecundario = { border: "1px solid #d1d5db", borderRadius: 9, padding: "8px 14px", background: "#fff", color: "#111827", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const avisoError = { padding: "9px 12px", borderRadius: 9, background: "#fef2f2", color: "#991b1b", fontSize: 13, fontWeight: 700 };
const ganadorBox = { padding: "10px 14px", borderRadius: 10, background: "#fef9c3", border: "1px solid #eab308", fontSize: 14 };
const reglaBox = { display: "grid", gap: 8, marginTop: 12, padding: 14, borderRadius: 12, background: "#f9fafb", border: "1px solid #e5e7eb" };
const tabla = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #e5e7eb", color: "#374151" };
const td = { padding: "8px 10px", borderBottom: "1px solid #f3f4f6", verticalAlign: "top" };
