import { useState } from "react";
import { supabase } from "../supabaseClient";

function normalizarRespuestaRpc(raw) {
  return Array.isArray(raw) ? raw[0] : raw;
}

export default function BingoPruebas() {
  const [nombreCliente, setNombreCliente] = useState("PRUEBAS");
  const [cliente, setCliente] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function buscarCliente() {
    setError(""); setMensaje(""); setResultado(null); setCliente(null);
    const nombre = nombreCliente.trim();
    if (!nombre) { setError("Escribe el nombre del cliente de pruebas."); return; }

    setBuscando(true);
    const { data, error: buscarError } = await supabase
      .from("clientes")
      .select("*")
      .ilike("nombre", nombre)
      .limit(1)
      .maybeSingle();
    setBuscando(false);

    if (buscarError) { setError("No se pudo buscar el cliente."); return; }
    if (!data) {
      setError(`No existe ningún cliente llamado "${nombre}". Créalo primero en la pestaña Clientes (estado activo) y vuelve aquí.`);
      return;
    }
    if (!data.token) { setError("Ese cliente no tiene un enlace/token generado."); return; }
    if (String(data.estado || "").toLowerCase() !== "activo") { setError("Ese cliente existe pero no está activo."); return; }

    setCliente(data);
    setMensaje(`Cliente de pruebas encontrado: ${data.nombre}.`);
  }

  async function generarPedidoPrueba() {
    if (!cliente?.token) return;
    setError(""); setMensaje(""); setResultado(null);
    setGenerando(true);

    try {
      const { data: promo, error: promoError } = await supabase
        .from("promociones_bingo")
        .select("*")
        .eq("activa", true)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (promoError || !promo) throw new Error("No hay ninguna promoción de Bingo activa.");

      const { data: reglas, error: reglasError } = await supabase
        .from("promociones_bingo_articulos")
        .select("articulo_id,cantidad_minima,articulos(permite_unidades)")
        .eq("promocion_id", promo.id)
        .limit(Math.max(1, Number(promo.variedad_minima || 1)));
      if (reglasError || !reglas?.length) throw new Error("La promoción no tiene artículos configurados para el Bingo.");

      const items = reglas.map((regla) => {
        const cantidad = Math.max(1, Number(regla.cantidad_minima || 1));
        const permiteUnidades = Boolean(regla.articulos?.permite_unidades);
        return {
          articulo_id: regla.articulo_id,
          cajas: permiteUnidades ? 0 : cantidad,
          unidades: permiteUnidades ? cantidad : 0,
        };
      });

      const orderId = `PRUEBA-${Date.now()}`;

      const { data: rawRegistro, error: registroError } = await supabase.rpc("registrar_pedido_bingo", {
        p_token: cliente.token,
        p_order_id: orderId,
        p_items: items,
      });
      if (registroError) throw registroError;
      const registro = normalizarRespuestaRpc(rawRegistro);
      if (!registro?.qualified) throw new Error(registro?.reason || "El pedido de prueba no cumplió las condiciones del Bingo.");

      const bolasPorPedido = Math.max(1, Number(promo.bolas_por_pedido || 1));
      const { data: rawEntitlement, error: entitlementError } = await supabase.rpc("create_or_update_game_entitlement", {
        p_order_id: orderId,
        p_customer_token: cliente.token,
        p_customer_name: cliente.nombre,
        p_bingo_eligible: true,
        p_bingo_reference: registro,
        p_bingo_plays_total: bolasPorPedido,
      });
      if (entitlementError) throw entitlementError;
      const entitlement = normalizarRespuestaRpc(rawEntitlement);
      if (!entitlement?.code) throw new Error("No se ha recibido un código de participación válido.");

      setResultado({
        code: entitlement.code,
        bolas: bolasPorPedido,
        enlaceCliente: `${window.location.origin}/cliente/${cliente.token}`,
        enlaceBombo: `${window.location.origin}/?bingoDisplay=1&code=${encodeURIComponent(entitlement.code)}`,
      });
      setMensaje(`Pedido de prueba registrado (${bolasPorPedido} bola/s disponibles).`);
    } catch (err) {
      console.error(err);
      setError(err?.message || "No se pudo generar el pedido de prueba.");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div style={contenedor}>
      <h4 style={titulo}>🧪 Cliente de pruebas</h4>
      <p style={texto}>
        Simula un pedido real que cumple el Bingo para un cliente de pruebas, sin tener que hacer pedidos de verdad.
        Usa bolas reales del bombo en vivo, así que ten cuidado de no confundir a los clientes reales mientras pruebas.
      </p>
      <div style={fila}>
        <label style={label}>
          Nombre del cliente de pruebas
          <input style={input} value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} />
        </label>
        <button type="button" style={boton} onClick={buscarCliente} disabled={buscando}>
          {buscando ? "Buscando..." : "Buscar cliente"}
        </button>
      </div>
      {cliente && (
        <button type="button" style={{ ...boton, ...botonPrincipal }} onClick={generarPedidoPrueba} disabled={generando}>
          {generando ? "Generando..." : "Generar pedido de prueba"}
        </button>
      )}
      {error && <div style={errorStyle}>{error}</div>}
      {mensaje && <div style={okStyle}>{mensaje}</div>}
      {resultado && (
        <div style={resultadoBox}>
          <div><strong>Código:</strong> {resultado.code} ({resultado.bolas} bola/s)</div>
          <div><strong>Cartón del cliente:</strong> <a href={resultado.enlaceCliente} target="_blank" rel="noreferrer">{resultado.enlaceCliente}</a></div>
          <div><strong>Bombo (para tirar la/s bola/s):</strong> <a href={resultado.enlaceBombo} target="_blank" rel="noreferrer">{resultado.enlaceBombo}</a></div>
        </div>
      )}
    </div>
  );
}

const contenedor = { border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, background: "#fff", marginBottom: 16 };
const titulo = { margin: "0 0 8px", fontSize: 17, color: "#111827" };
const texto = { margin: "0 0 14px", color: "#6b7280", fontSize: 14 };
const fila = { display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 12, flexWrap: "wrap" };
const label = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700, color: "#374151" };
const input = { border: "1px solid #d1d5db", borderRadius: 10, padding: 10, fontSize: 14, minWidth: 220 };
const boton = { border: 0, background: "#111827", color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: 14, cursor: "pointer" };
const botonPrincipal = { background: "#2563eb", marginBottom: 12 };
const errorStyle = { marginBottom: 10, color: "#b91c1c", fontWeight: 700 };
const okStyle = { marginBottom: 10, color: "#15803d", fontWeight: 700 };
const resultadoBox = { display: "flex", flexDirection: "column", gap: 6, padding: 12, borderRadius: 10, background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 13, wordBreak: "break-all" };
