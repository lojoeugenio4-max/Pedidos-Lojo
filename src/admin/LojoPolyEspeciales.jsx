import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  contenedor,
  tituloSeccion,
  texto,
  campo,
  campoCheckbox,
  input,
  fila,
  boton,
  botonSecundario,
  botonIcono,
  avisoError,
  avisoOk,
  avisoAtencion,
  ayuda,
} from "./lojopolyEstilos";
import LojoPolyArticuloPremio from "./LojoPolyArticuloPremio";

const TIPOS = [
  {
    id: "suerte",
    titulo: "Suerte",
    icono: "?",
    campo: "casillas_suerte",
    descripcion: "Premio instantáneo pequeño.",
    ejemplo: "Ej.: 1 caja de agua gratis",
  },
  {
    id: "suerte_grande",
    titulo: "Suerte grande",
    icono: "★",
    campo: "casillas_suerte_grande",
    descripcion: "Premio instantáneo mayor. Suele haber una sola casilla, en una esquina.",
    ejemplo: "Ej.: Cheque de 20 € en Cash Lojo",
  },
  {
    id: "caja",
    titulo: "Caja Lojo",
    icono: "L",
    campo: "casillas_caja",
    descripcion: "Sorpresa. Por ejemplo, un número extra para el Sorteo o una bola de Bingo.",
    ejemplo: "Ej.: 1 número extra para el Sorteo",
  },
];

export default function LojoPolyEspeciales({ campana, onCambio }) {
  const [premios, setPremios] = useState([]);
  const [cantidades, setCantidades] = useState({});
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    setCantidades({
      casillas_suerte: campana.casillas_suerte ?? 4,
      casillas_suerte_grande: campana.casillas_suerte_grande ?? 1,
      casillas_caja: campana.casillas_caja ?? 3,
    });
  }, [campana]);

  async function cargarPremios() {
    const { data, error: err } = await supabase
      .from("lojopoly_premios_instantaneos")
      .select("*")
      .eq("campana_id", campana.id)
      .order("created_at", { ascending: true });
    if (err) setError(`No se han podido cargar los premios: ${err.message}`);
    else setPremios(data || []);
  }

  useEffect(() => {
    cargarPremios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campana.id]);

  async function ejecutar(accion, textoOk) {
    setError("");
    setMensaje("");
    setOcupado(true);
    try {
      const { error: err } = await accion();
      if (err) throw err;
      if (textoOk) setMensaje(textoOk);
      await cargarPremios();
    } catch (err) {
      setError(err?.message || "No se ha podido guardar.");
    } finally {
      setOcupado(false);
    }
  }

  async function guardarCantidades() {
    setError("");
    setMensaje("");
    setOcupado(true);
    const payload = Object.fromEntries(Object.entries(cantidades).map(([k, v]) => [k, Math.max(0, Number(v) || 0)]));
    const { error: err } = await supabase
      .from("lojopoly_campanas")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", campana.id);
    setOcupado(false);
    if (err) {
      setError(`No se ha podido guardar: ${err.message}`);
      return;
    }
    setMensaje("Cantidades guardadas. Revisa el tablero y guárdalo para aplicarlas.");
    onCambio?.();
  }

  const anadirPremio = (tipo) =>
    ejecutar(
      () => supabase.from("lojopoly_premios_instantaneos").insert({ campana_id: campana.id, tipo, texto: "Nuevo premio", peso: 1 }),
      "Premio añadido. Escribe qué es y su stock."
    );

  const actualizarPremio = (id, cambios) => ejecutar(() => supabase.from("lojopoly_premios_instantaneos").update(cambios).eq("id", id));
  const borrarPremio = (id) => ejecutar(() => supabase.from("lojopoly_premios_instantaneos").delete().eq("id", id), "Premio eliminado.");

  return (
    <div style={contenedor}>
      <h4 style={tituloSeccion}>Casillas especiales y premios instantáneos</h4>

      <p style={ayuda}>
        Además de los artículos, el tablero lleva siempre <strong>Salida</strong> y <strong>Descanso</strong>. Aquí eliges
        cuántas casillas de cada tipo especial hay y qué premios dan. Si al cliente le toca un premio sin stock, la
        casilla no da nada. Si sobran huecos en el tablero, se rellenan con Suerte y Caja Lojo.
      </p>

      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}

      <div style={fila}>
        {TIPOS.map((t) => (
          <label key={t.id} style={campo}>
            <span>Casillas de {t.titulo}</span>
            <input
              id={`lp-cant-${t.id}`}
              style={input}
              type="number"
              min={0}
              value={cantidades[t.campo] ?? 0}
              onChange={(e) => setCantidades((c) => ({ ...c, [t.campo]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <button type="button" style={boton} onClick={guardarCantidades} disabled={ocupado}>
        Guardar cantidades
      </button>

      {TIPOS.map((t) => {
        const lista = premios.filter((p) => p.tipo === t.id);
        const pesoTotal = lista.filter((p) => p.activo).reduce((s, p) => s + (p.peso || 1), 0);
        return (
          <section key={t.id} style={{ display: "grid", gap: 10, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={icono(t.id)}>{t.icono}</span>
              <div>
                <strong style={{ color: "#111827" }}>{t.titulo}</strong>
                <p style={texto}>{t.descripcion}</p>
              </div>
            </div>

            {lista.length === 0 && (cantidades[t.campo] ?? 0) > 0 && (
              <div style={avisoAtencion}>Hay casillas de {t.titulo} pero ningún premio: no darán nada.</div>
            )}

            {lista.map((p) => (
              <FilaPremio
                key={p.id}
                premio={p}
                ejemplo={t.ejemplo}
                probabilidad={p.activo && pesoTotal ? Math.round(((p.peso || 1) / pesoTotal) * 100) : 0}
                ocupado={ocupado}
                onActualizar={(cambios) => actualizarPremio(p.id, cambios)}
                onBorrar={() => borrarPremio(p.id)}
              />
            ))}

            <button type="button" style={{ ...botonSecundario, justifySelf: "start" }} onClick={() => anadirPremio(t.id)} disabled={ocupado}>
              + Añadir premio de {t.titulo}
            </button>
          </section>
        );
      })}
    </div>
  );
}

function FilaPremio({ premio, ejemplo, probabilidad, ocupado, onActualizar, onBorrar }) {
  const agotado = premio.stock_max !== null && premio.emitidos >= premio.stock_max;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", background: agotado ? "#f9fafb" : "#fff" }}>
      <label style={{ ...campo, flex: 3, minWidth: 200 }}>
        <span style={{ fontWeight: 500, fontSize: 13 }}>Premio</span>
        <input
          id={`lp-premio-texto-${premio.id}`}
          key={`t-${premio.texto}`}
          style={input}
          placeholder={ejemplo}
          defaultValue={premio.texto}
          onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== premio.texto && onActualizar({ texto: e.target.value.trim() })}
        />
      </label>
      <label style={{ ...campo, minWidth: 110 }}>
        <span style={{ fontWeight: 500, fontSize: 13 }}>Stock (vacío = sin límite)</span>
        <input
          id={`lp-premio-stock-${premio.id}`}
          key={`s-${premio.stock_max}`}
          style={input}
          type="number"
          min={premio.emitidos}
          defaultValue={premio.stock_max ?? ""}
          onBlur={(e) => {
            const valor = e.target.value === "" ? null : Math.max(premio.emitidos, Number(e.target.value) || 0);
            if (valor !== premio.stock_max) onActualizar({ stock_max: valor });
          }}
        />
      </label>
      <label style={{ ...campo, minWidth: 90 }}>
        <span style={{ fontWeight: 500, fontSize: 13 }}>Peso</span>
        <input
          id={`lp-premio-peso-${premio.id}`}
          key={`w-${premio.peso}`}
          style={input}
          type="number"
          min={1}
          defaultValue={premio.peso}
          onBlur={(e) => {
            const valor = Math.max(1, Number(e.target.value) || 1);
            if (valor !== premio.peso) onActualizar({ peso: valor });
          }}
        />
      </label>
      <div style={{ display: "grid", gap: 2, fontSize: 12, color: "#4b5563", minWidth: 120 }}>
        <span>Probabilidad: <strong>{probabilidad} %</strong></span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          Dados: <strong>{premio.emitidos}</strong>
          {premio.stock_max !== null && ` de ${premio.stock_max}`}
          {agotado && <strong style={{ color: "#b91c1c" }}> · agotado</strong>}
        </span>
      </div>
      <label style={{ ...campoCheckbox, fontSize: 13 }}>
        <input id={`lp-premio-activo-${premio.id}`} type="checkbox" checked={premio.activo} disabled={ocupado} onChange={(e) => onActualizar({ activo: e.target.checked })} />
        Activo
      </label>
      <button type="button" style={{ ...botonIcono, color: "#b91c1c" }} onClick={onBorrar} disabled={ocupado || premio.emitidos > 0} title={premio.emitidos > 0 ? "Ya se ha dado: desactívalo en vez de borrarlo" : "Eliminar"} aria-label="Eliminar premio">
        ✕
      </button>
      <div style={{ flexBasis: "100%" }}>
        <LojoPolyArticuloPremio
          idBase={`lp-premio-regalo-${premio.id}`}
          articuloId={premio.articulo_id}
          cantidad={premio.cantidad}
          formato={premio.formato}
          ocupado={ocupado}
          onCambiar={onActualizar}
        />
      </div>
    </div>
  );
}

const icono = (tipo) => ({
  width: 36,
  height: 36,
  borderRadius: 9,
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  fontSize: 18,
  background: tipo === "suerte" ? "#fff3c4" : tipo === "suerte_grande" ? "#ffcc2e" : "#e3e8ff",
  color: tipo === "caja" ? "#0b22b8" : "#7a5200",
});
