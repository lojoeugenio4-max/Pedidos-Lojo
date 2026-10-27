import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import LojoPolyArticuloPremio from "./LojoPolyArticuloPremio";
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

// PREMIO DE LA MITAD: cada cliente que pasa de la casilla 32 (mitad del
// tablero) se lleva este premio, una sola vez por edición. Con «máximo de
// veces» se puede limitar cuántos se dan en total (0 = sin límite).

export default function CarreraPremioMitad({ edicion, onGuardado }) {
  const [form, setForm] = useState({});
  const [dados, setDados] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const bloqueada = edicion.estado === "terminada";

  useEffect(() => {
    setForm({
      activo: Boolean(edicion.premio_mitad_activo),
      texto: edicion.premio_mitad_texto || "",
      articulo_id: edicion.premio_mitad_articulo_id || null,
      cantidad: edicion.premio_mitad_cantidad ?? 1,
      formato: edicion.premio_mitad_formato || "unidades",
      maximo: edicion.premio_mitad_maximo ?? 0,
    });
    supabase
      .from("carrera_premios")
      .select("id", { count: "exact", head: true })
      .eq("edicion_id", edicion.id)
      .eq("tipo", "mitad")
      .then(({ count }) => setDados(count || 0));
  }, [edicion]);

  const cambiar = (cambios) => setForm((a) => ({ ...a, ...cambios }));

  async function guardar() {
    setMensaje("");
    setError("");
    if (form.activo && !String(form.texto || "").trim() && !form.articulo_id) {
      setError("Escribe el premio o elige un artículo (o desmarca «Premio activo»).");
      return;
    }
    setGuardando(true);
    const { error: err } = await supabase
      .from("carrera_ediciones")
      .update({
        premio_mitad_activo: Boolean(form.activo),
        premio_mitad_texto: String(form.texto || "").trim() || null,
        premio_mitad_articulo_id: form.articulo_id ? String(form.articulo_id) : null,
        premio_mitad_cantidad: Number(form.cantidad) > 0 ? Number(form.cantidad) : 1,
        premio_mitad_formato: form.formato === "cajas" ? "cajas" : "unidades",
        premio_mitad_maximo: Math.max(0, Math.round(Number(form.maximo) || 0)),
        updated_at: new Date().toISOString(),
      })
      .eq("id", edicion.id);
    setGuardando(false);
    if (err) {
      setError(
        err.message?.includes("premio_mitad")
          ? "Falta aplicar la migración migracion_carrera_mitad_comodin.sql en Supabase."
          : `No se ha podido guardar: ${err.message}`
      );
      return;
    }
    setMensaje("Premio de la mitad guardado.");
    onGuardado?.();
  }

  const maximo = Math.max(0, Math.round(Number(form.maximo) || 0));

  return (
    <div style={contenedor}>
      <h4 style={tituloSeccion}>🚩 Premio de la mitad (casilla 32)</h4>
      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}

      <label style={campoCheckbox}>
        <input type="checkbox" checked={Boolean(form.activo)} disabled={bloqueada} onChange={(e) => cambiar({ activo: e.target.checked })} />
        <span>Premio activo</span>
      </label>

      <label style={campo}>
        <span>Premio (lo que verán los clientes en la TV)</span>
        <input id="lc-mitad-texto" style={input} placeholder="Ej.: 1 caja de Cruzcampo" value={form.texto || ""} disabled={bloqueada} onChange={(e) => cambiar({ texto: e.target.value })} />
      </label>

      <LojoPolyArticuloPremio
        idBase="lc-mitad"
        articuloId={form.articulo_id}
        cantidad={form.cantidad}
        formato={form.formato}
        ocupado={bloqueada || guardando}
        onCambiar={cambiar}
      />

      <div style={fila}>
        <label style={{ ...campo, maxWidth: 260 }}>
          <span>Número máximo de premios (0 = sin límite)</span>
          <input id="lc-mitad-maximo" style={input} type="number" min={0} value={form.maximo ?? 0} disabled={bloqueada} onChange={(e) => cambiar({ maximo: e.target.value })} />
        </label>
        <div style={{ flex: 2, minWidth: 220, alignSelf: "end", fontSize: 14, color: "#374151", fontWeight: 700 }}>
          Dados en esta edición: {dados}
          {maximo > 0 ? ` de ${maximo}` : ""}
        </div>
      </div>

      <p style={ayuda}>
        Cada cliente que <strong>pase de la casilla 32</strong> se lleva este premio <strong>una sola vez</strong> por
        edición. En la TV la casilla 32 sale con una bandera, un aro dorado y la cinta «MITAD», y al pasarla hay fuegos
        artificiales, confeti, fanfarria y la tarjeta «¡PREMIO DE LA MITAD!» con el premio (y su foto si eliges el artículo).
        Si se pone un máximo de premios y ya se han dado todos, los demás clientes pasan sin premio. Los premios ganados
        salen en «Clasificación y premios» para marcarlos como entregados.
      </p>

      {!bloqueada && (
        <button type="button" style={boton} onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar premio de la mitad"}
        </button>
      )}
    </div>
  );
}
