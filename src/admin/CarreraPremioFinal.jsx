import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import LojoPolyArticuloPremio from "./LojoPolyArticuloPremio";
import { contenedor, tituloSeccion, campo, input, boton, avisoError, avisoOk, ayuda } from "./lojopolyEstilos";

// Premio final: se lo lleva el primer cliente que llega a la casilla 63
// con número exacto. En ese momento la edición termina.

export default function CarreraPremioFinal({ edicion, onGuardado }) {
  const [form, setForm] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const bloqueada = edicion.estado === "terminada";

  useEffect(() => {
    setForm({
      texto: edicion.premio_final_texto || "",
      articulo_id: edicion.premio_final_articulo_id || null,
      cantidad: edicion.premio_final_cantidad ?? 1,
      formato: edicion.premio_final_formato || "unidades",
    });
  }, [edicion]);

  const cambiar = (cambios) => setForm((a) => ({ ...a, ...cambios }));

  async function guardar() {
    setMensaje("");
    setError("");
    if (!String(form.texto || "").trim() && !form.articulo_id) {
      setError("Escribe el premio final o elige un artículo.");
      return;
    }
    setGuardando(true);
    const { error: err } = await supabase
      .from("carrera_ediciones")
      .update({
        premio_final_texto: String(form.texto || "").trim() || null,
        premio_final_articulo_id: form.articulo_id ? String(form.articulo_id) : null,
        premio_final_cantidad: Number(form.cantidad) > 0 ? Number(form.cantidad) : 1,
        premio_final_formato: form.formato === "cajas" ? "cajas" : "unidades",
        updated_at: new Date().toISOString(),
      })
      .eq("id", edicion.id);
    setGuardando(false);
    if (err) {
      setError(`No se ha podido guardar: ${err.message}`);
      return;
    }
    setMensaje("Premio final guardado.");
    onGuardado?.();
  }

  return (
    <div style={contenedor}>
      <h4 style={tituloSeccion}>🏆 Premio final</h4>
      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}

      <label style={campo}>
        <span>Premio (lo que verán los clientes en la TV y en el móvil)</span>
        <input id="lc-final-texto" style={input} placeholder="Ej.: Cheque de 300 € en compras en Cash Lojo" value={form.texto || ""} disabled={bloqueada} onChange={(e) => cambiar({ texto: e.target.value })} />
      </label>

      <LojoPolyArticuloPremio
        idBase="lc-final"
        articuloId={form.articulo_id}
        cantidad={form.cantidad}
        formato={form.formato}
        ocupado={bloqueada || guardando}
        onCambiar={cambiar}
      />

      <p style={ayuda}>
        El artículo es opcional: sirve para que el premio salga con su foto y para la valoración de regalos. Si el premio
        es un cheque o algo que no está en el catálogo, basta con escribirlo arriba.
      </p>

      <p style={ayuda}>
        Cuando un cliente llegue a la meta: la TV pasa a pantalla completa con su personaje en grande, fuegos artificiales,
        confeti y serpentina, fanfarria fuerte y la voz que anuncia «¡[nombre del cliente] ha ganado La Loca Carrera de
        Lojo!» con el premio. Todos los clientes lo ven en su móvil y la edición se cierra.
      </p>

      {!bloqueada && (
        <button type="button" style={boton} onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar premio final"}
        </button>
      )}
    </div>
  );
}
