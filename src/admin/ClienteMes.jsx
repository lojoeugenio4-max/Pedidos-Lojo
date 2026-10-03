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
      setConfig({ ...CONFIG_VACIA, ...data, premio_texto: data.premio_texto || "", fecha_inicio: data.fecha_inicio || "" });
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
    setGuardando(true);
    setError("");
    setAviso("");
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_guardar_cliente_mes_config", {
        p_activo: Boolean(config.activo),
        p_solo_pruebas: Boolean(config.solo_pruebas),
        p_fecha_inicio: config.fecha_inicio || null,
        p_puntos_por_pedido: Number(config.puntos_por_pedido) || 5,
        p_min_art_cajas: Number(config.min_art_cajas) || 10,
        p_min_art_unidades: Number(config.min_art_unidades) || 10,
        p_min_uds_por_articulo: Number(config.min_uds_por_articulo) || 5,
        p_meta_puntos: Number(config.meta_puntos) || 100,
        p_premio_texto: config.premio_texto || "",
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

  const filas = Array.isArray(datos?.filas) ? datos.filas : [];
  const mesActual = primerDiaMes(0);
  const esMesPasado = mes < mesActual;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <h2 style={titulo}>🏆 Cliente del mes</h2>
        <p style={texto}>
          Carrera de puntos: cada pedido hecho por la App suma puntos <strong>al pasar su QR en caja</strong>, igual que el
          resto de juegos (solo 1 pedido por día y cliente). Cuenta si lleva un mínimo de artículos distintos en cajas{" "}
          <strong>o</strong> un mínimo de artículos distintos con unas unidades sueltas mínimas de cada uno. Gana quien más
          puntos tenga el último día del mes; si hay empate, gana quien llegó antes. Cada día 1 empieza una carrera nueva.
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
              <Campo etiqueta="Puntos por pedido" valor={config.puntos_por_pedido} onChange={(v) => cambiar("puntos_por_pedido", v)} />
              <Campo etiqueta="Meta (puntos del cofre)" valor={config.meta_puntos} onChange={(v) => cambiar("meta_puntos", v)} />
            </div>
            <div style={reglaBox}>
              <strong>1) Por cajas</strong>
              <div style={rejilla}>
                <Campo etiqueta="Artículos distintos (mín. 1 caja de cada uno)" valor={config.min_art_cajas} onChange={(v) => cambiar("min_art_cajas", v)} />
              </div>
              <strong style={{ marginTop: 10 }}>2) O por unidades sueltas</strong>
              <div style={rejilla}>
                <Campo etiqueta="Artículos distintos" valor={config.min_art_unidades} onChange={(v) => cambiar("min_art_unidades", v)} />
                <Campo etiqueta="Unidades mínimas de cada uno" valor={config.min_uds_por_articulo} onChange={(v) => cambiar("min_uds_por_articulo", v)} />
              </div>
              <p style={texto}>
                Con estos valores el pedido cuenta si lleva {config.min_art_cajas || 10} artículos distintos con al menos 1 caja
                cada uno, <strong>o</strong> {config.min_art_unidades || 10} artículos distintos con al menos{" "}
                {config.min_uds_por_articulo || 5} unidades de cada uno.
              </p>
            </div>
            <label style={{ ...campo, marginTop: 12 }}>
              <span>Premio para el ganador (se ve en la carrera)</span>
              <input
                style={{ ...input, width: "100%" }}
                type="text"
                placeholder="Ej: Cheque de 100 € para gastar en Cash Lojo"
                value={config.premio_texto}
                onChange={(e) => cambiar("premio_texto", e.target.value)}
              />
            </label>
            <p style={{ ...texto, marginTop: 8 }}>
              La meta es el final de la barra, donde está el cofre. Como referencia: con {config.puntos_por_pedido || 5} puntos
              por pedido, {config.meta_puntos || 100} puntos son {Math.ceil((Number(config.meta_puntos) || 100) / (Number(config.puntos_por_pedido) || 5))} días con pedido.
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
            🏆 Ganador de {nombreMes(mes)}: <strong>{filas[0].nombre}</strong> con {filas[0].puntos} puntos ({filas[0].pedidos}{" "}
            {filas[0].pedidos === 1 ? "día" : "días"} con pedido)
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
