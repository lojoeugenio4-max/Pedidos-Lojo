import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function ReactivarCodigo() {
  const [codigo, setCodigo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [entitlement, setEntitlement] = useState(null);
  const [bolasInput, setBolasInput] = useState("3");
  const [reactivando, setReactivando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function buscar() {
    const codigoLimpio = codigo.trim();
    if (!codigoLimpio) return;

    setBuscando(true);
    setError("");
    setMensaje("");
    setEntitlement(null);

    try {
      const { data, error: buscarError } = await supabase.rpc("buscar_entitlement_por_codigo", {
        p_code: codigoLimpio,
      });

      if (buscarError) throw buscarError;
      const fila = Array.isArray(data) ? data[0] : data;
      if (!fila) {
        setError("No se ha encontrado ningún pedido con ese código.");
        return;
      }

      setEntitlement(fila);

      const matched = Number(fila.bingo_reference?.matched ?? 0);
      const required = Number(fila.bingo_reference?.required ?? 0);
      const bolasSugeridas = required > 0 ? Math.max(1, Math.floor(matched / required)) : "";
      setBolasInput(String(bolasSugeridas || fila.bingo_plays_total || 3));
    } catch (err) {
      console.error(err);
      setError(err?.message || "No se ha podido buscar el código.");
    } finally {
      setBuscando(false);
    }
  }

  async function reactivarBingo() {
    if (!entitlement) return;
    const bolas = Math.max(1, Number(bolasInput || 1));

    setReactivando(true);
    setError("");
    setMensaje("");

    try {
      const { error: updateError } = await supabase
        .from("game_entitlements")
        .update({
          bingo_eligible: true,
          bingo_plays_total: bolas,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entitlement.id);

      if (updateError) throw updateError;

      setEntitlement((actual) => (actual ? { ...actual, bingo_eligible: true, bingo_plays_total: bolas } : actual));
      setMensaje(`Bingo reactivado: ${bolas} ${bolas === 1 ? "bola" : "bolas"} disponibles para este código.`);
    } catch (err) {
      console.error(err);
      setError(err?.message || "No se ha podido reactivar el código.");
    } finally {
      setReactivando(false);
    }
  }

  return (
    <div style={contenedor}>
      <h4 style={titulo}>Reactivar código (bloqueo de "1 pedido de Bingo al día")</h4>
      <p style={texto}>
        Úsalo cuando un pedido se bloquea con "Bingo ya conseguido hoy con otro pedido" y compruebas que no
        es cierto. Busca el código (el mismo que sale en el mensaje de WhatsApp, ej. LJ-E5DF-ACFB) y reactívalo.
      </p>

      <div style={filaBusqueda}>
        <input
          style={input}
          placeholder="Código, ej. LJ-E5DF-ACFB"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscar()}
        />
        <button type="button" style={boton} onClick={buscar} disabled={buscando}>
          {buscando ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}

      {entitlement && (
        <div style={panel}>
          <div style={texto}>
            <strong>{entitlement.customer_name || "Cliente sin nombre"}</strong> · Pedido {entitlement.order_id}
          </div>
          <div style={texto}>
            Estado actual: Bingo {entitlement.bingo_eligible ? "concedido" : "bloqueado"}
            {entitlement.bingo_eligible ? ` (${entitlement.bingo_plays_total} bolas, ${entitlement.bingo_plays_used || 0} usadas)` : ""}
          </div>
          {entitlement.bingo_reference && (
            <div style={texto}>
              Variedad del pedido: {entitlement.bingo_reference.matched ?? "?"} de {entitlement.bingo_reference.required ?? "?"} artículos mínimos
            </div>
          )}

          {!entitlement.bingo_eligible && (
            <div style={filaBusqueda}>
              <label style={campo}>
                <span>Bolas a conceder</span>
                <input
                  style={{ ...input, width: 90 }}
                  type="number"
                  min={1}
                  value={bolasInput}
                  onChange={(e) => setBolasInput(e.target.value)}
                />
              </label>
              <button type="button" style={boton} onClick={reactivarBingo} disabled={reactivando}>
                {reactivando ? "Reactivando..." : "Reactivar Bingo para este código"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const contenedor = { display: "grid", gap: 12, border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, background: "#fff", marginBottom: 20 };
const titulo = { margin: 0, fontSize: 17, color: "#111827" };
const texto = { margin: 0, color: "#6b7280", fontSize: 13 };
const filaBusqueda = { display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" };
const campo = { display: "grid", gap: 6, fontSize: 13, color: "#374151", fontWeight: 600 };
const input = { padding: "9px 11px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 14, flex: 1, minWidth: 160 };
const boton = { border: 0, borderRadius: 10, padding: "10px 16px", background: "#059669", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" };
const panel = { display: "grid", gap: 6, padding: 12, borderRadius: 10, background: "#f9fafb", border: "1px solid #e5e7eb" };
const avisoError = { padding: "9px 12px", borderRadius: 9, background: "#fef2f2", color: "#991b1b", fontSize: 13, fontWeight: 700 };
const avisoOk = { padding: "9px 12px", borderRadius: 9, background: "#f0fdf4", color: "#166534", fontSize: 13, fontWeight: 700 };
