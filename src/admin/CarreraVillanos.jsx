import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  contenedor,
  tituloSeccion,
  campo,
  input,
  fila,
  boton,
  avisoError,
  avisoOk,
  ayuda,
} from "./lojopolyEstilos";

// Villanos al azar (Melón Cabezón y Jubilado), amigos que los anulan
// (José Luis y Rafa) y % de caída en La Vieja (casilla 31).

const CASTIGOS_DEFECTO = [
  { casillas: 3, prob: 60 },
  { casillas: 6, prob: 30 },
  { casillas: 10, prob: 10 },
];
const NOMBRES_CASTIGO = ["Leve", "Medio", "Fuerte"];

function normalizarCastigos(lista) {
  const base = Array.isArray(lista) && lista.length ? lista : CASTIGOS_DEFECTO;
  return [0, 1, 2].map((i) => ({
    casillas: base[i]?.casillas ?? CASTIGOS_DEFECTO[i].casillas,
    prob: base[i]?.prob ?? CASTIGOS_DEFECTO[i].prob,
  }));
}

const num = (v) => Number(String(v).replace(",", ".")) || 0;
const pct = (v) => Math.min(100, Math.max(0, num(v)));

export default function CarreraVillanos({ edicion, onGuardado }) {
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const bloqueada = edicion.estado === "terminada";

  useEffect(() => {
    setForm({
      prob_villano: edicion.prob_villano ?? 15,
      prob_melon: edicion.prob_melon ?? 50,
      castigos_melon: normalizarCastigos(edicion.castigos_melon),
      castigos_jubilado: normalizarCastigos(edicion.castigos_jubilado),
      prob_anulacion: edicion.prob_anulacion ?? 40,
      prob_vieja: edicion.prob_vieja ?? 20,
    });
  }, [edicion]);

  if (!form) return null;

  const cambiar = (clave, valor) => setForm((a) => ({ ...a, [clave]: valor }));
  const cambiarCastigo = (villano, i, clave, valor) =>
    setForm((a) => {
      const lista = a[villano].map((c, j) => (j === i ? { ...c, [clave]: valor } : c));
      return { ...a, [villano]: lista };
    });

  const sumaMelon = form.castigos_melon.reduce((s, c) => s + num(c.prob), 0);
  const sumaJubilado = form.castigos_jubilado.reduce((s, c) => s + num(c.prob), 0);

  async function guardar() {
    setMensaje("");
    setError("");
    if (Math.round(sumaMelon) !== 100 || Math.round(sumaJubilado) !== 100) {
      setError("Los porcentajes de los 3 castigos de cada villano tienen que sumar 100 %.");
      return;
    }
    const limpiar = (lista) => lista.map((c) => ({ casillas: Math.max(1, Math.round(num(c.casillas))), prob: pct(c.prob) }));

    setGuardando(true);
    const { error: err } = await supabase
      .from("carrera_ediciones")
      .update({
        prob_villano: pct(form.prob_villano),
        prob_melon: pct(form.prob_melon),
        castigos_melon: limpiar(form.castigos_melon),
        castigos_jubilado: limpiar(form.castigos_jubilado),
        prob_anulacion: pct(form.prob_anulacion),
        prob_vieja: pct(form.prob_vieja),
        updated_at: new Date().toISOString(),
      })
      .eq("id", edicion.id);
    setGuardando(false);

    if (err) {
      setError(`No se ha podido guardar: ${err.message}`);
      return;
    }
    setMensaje("Guardado.");
    onGuardado?.();
  }

  // Resumen: de cada 100 tiradas que caen en casilla normal...
  const villanos = pct(form.prob_villano);
  const anulados = (villanos * pct(form.prob_anulacion)) / 100;
  const retrocesos = villanos - anulados;
  const redondeo = (v) => (Math.round(v * 10) / 10).toLocaleString("es-ES");

  return (
    <div style={contenedor}>
      <h4 style={tituloSeccion}>😈 Villanos al azar</h4>

      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}

      <p style={ayuda}>
        Los villanos no tienen casilla fija. Cada vez que un cliente cae en una casilla normal, el sistema decide si aparece
        uno por sorpresa. Nunca salen después de un premio, de La Vieja, de un palet, de una casilla Lojo ni de la meta.
        Cuando el villano hace retroceder al cliente, la ficha nunca se queda en una casilla especial (si cae en una, se
        coloca en la casilla normal de detrás).
      </p>

      <div style={fila}>
        <CampoPct id="lc-prob-villano" texto="% de que aparezca un villano en cada tirada" valor={form.prob_villano} bloqueada={bloqueada} onCambio={(v) => cambiar("prob_villano", v)} />
        <CampoPct id="lc-prob-melon" texto="De esas veces, % que sale el Melón Cabezón" valor={form.prob_melon} bloqueada={bloqueada} onCambio={(v) => cambiar("prob_melon", v)} />
        <div style={{ ...campo, justifyContent: "end" }}>
          <span>El Jubilado sale el resto</span>
          <div style={{ ...input, background: "#f3f4f6" }}>{redondeo(100 - pct(form.prob_melon))} %</div>
        </div>
      </div>

      <div style={fila}>
        <TablaCastigos
          titulo="🍈 El Melón Cabezón"
          castigos={form.castigos_melon}
          suma={sumaMelon}
          bloqueada={bloqueada}
          onCambio={(i, clave, valor) => cambiarCastigo("castigos_melon", i, clave, valor)}
        />
        <TablaCastigos
          titulo="👴 El Jubilado"
          castigos={form.castigos_jubilado}
          suma={sumaJubilado}
          bloqueada={bloqueada}
          onCambio={(i, clave, valor) => cambiarCastigo("castigos_jubilado", i, clave, valor)}
        />
      </div>

      <h4 style={{ ...tituloSeccion, marginTop: 6 }}>🦸 Amigos: José Luis y Rafa</h4>
      <div style={fila}>
        <CampoPct id="lc-prob-anulacion" texto="% de que un amigo anule al villano" valor={form.prob_anulacion} bloqueada={bloqueada} onCambio={(v) => cambiar("prob_anulacion", v)} />
        <div style={{ flex: 2, minWidth: 220, alignSelf: "end" }}>
          <p style={ayuda}>
            A más porcentaje, más veces aparecen José Luis o Rafa (uno de los dos al azar), apartan al villano y el cliente
            se queda donde estaba.
          </p>
        </div>
      </div>

      <h4 style={{ ...tituloSeccion, marginTop: 6 }}>👵 La Vieja (casilla 31)</h4>
      <div style={fila}>
        <CampoPct id="lc-prob-vieja" texto="% de caída en La Vieja" valor={form.prob_vieja} bloqueada={bloqueada} onCambio={(v) => cambiar("prob_vieja", v)} />
        <div style={{ flex: 2, minWidth: 220, alignSelf: "end" }}>
          <p style={ayuda}>
            Cuando el dado iba a llevar a un cliente a La Vieja, solo cae con este porcentaje; las demás veces el dado saca
            otro número. Quien cae vuelve a la casilla 1.
          </p>
        </div>
      </div>

      <div style={resumen}>
        De cada 100 tiradas que caen en una casilla normal: aparecen villanos unas <strong>{redondeo(villanos)}</strong> veces;
        José Luis o Rafa anulan unas <strong>{redondeo(anulados)}</strong> y el cliente retrocede unas{" "}
        <strong>{redondeo(retrocesos)}</strong>.
      </div>

      {!bloqueada && (
        <button type="button" style={boton} onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      )}
    </div>
  );
}

function CampoPct({ id, texto, valor, bloqueada, onCambio }) {
  return (
    <label style={campo}>
      <span>{texto}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input id={id} style={input} type="number" min={0} max={100} step="any" value={valor} disabled={bloqueada} onChange={(e) => onCambio(e.target.value)} />
        <strong>%</strong>
      </div>
    </label>
  );
}

function TablaCastigos({ titulo, castigos, suma, bloqueada, onCambio }) {
  const correcta = Math.round(suma) === 100;
  return (
    <div style={tarjetaVillano}>
      <strong style={{ fontSize: 15, color: "#111827" }}>{titulo}</strong>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ color: "#6b7280", textAlign: "left" }}>
            <th style={th}>Castigo</th>
            <th style={th}>Retrocede</th>
            <th style={th}>Probabilidad</th>
          </tr>
        </thead>
        <tbody>
          {castigos.map((c, i) => (
            <tr key={i}>
              <td style={td}>{NOMBRES_CASTIGO[i]}</td>
              <td style={td}>
                <input style={{ ...input, width: 70 }} type="number" min={1} max={62} value={c.casillas} disabled={bloqueada} onChange={(e) => onCambio(i, "casillas", e.target.value)} aria-label={`Casillas castigo ${NOMBRES_CASTIGO[i]}`} /> casillas
              </td>
              <td style={td}>
                <input style={{ ...input, width: 70 }} type="number" min={0} max={100} step="any" value={c.prob} disabled={bloqueada} onChange={(e) => onCambio(i, "prob", e.target.value)} aria-label={`Probabilidad castigo ${NOMBRES_CASTIGO[i]}`} /> %
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <span style={{ fontSize: 13, fontWeight: 700, color: correcta ? "#166534" : "#b91c1c" }}>
        Suma: {Math.round(suma * 10) / 10} % {correcta ? "✓" : "(tiene que ser 100 %)"}
      </span>
    </div>
  );
}

const tarjetaVillano = { flex: 1, minWidth: 280, display: "grid", gap: 8, padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fafafa" };
const th = { padding: "4px 6px", fontWeight: 700, fontSize: 13 };
const td = { padding: "4px 6px", whiteSpace: "nowrap" };
const resumen = { padding: "11px 13px", borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", fontSize: 14, lineHeight: 1.45 };
