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

// Los 3 villanos están en casillas fijas (el cliente ve dónde está el
// peligro): El Melón Cabezón (24), La Vieja (31) y El Jubilado (50).
// Cada uno tiene su % de caída: cuando el dado iba a llevar a esa casilla,
// solo cae con ese porcentaje; las demás veces el dado saca otro número.
// José Luis y Rafa pueden anular a cualquiera de los tres.

export const CASILLAS_VILLANOS = { melon: 24, vieja: 31, jubilado: 50 };

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
const redondeo = (v) => (Math.round(v * 10) / 10).toLocaleString("es-ES");

export default function CarreraVillanos({ edicion, onGuardado }) {
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const bloqueada = edicion.estado === "terminada";

  useEffect(() => {
    setForm({
      prob_caida_melon: edicion.prob_caida_melon ?? 30,
      prob_caida_jubilado: edicion.prob_caida_jubilado ?? 30,
      prob_vieja: edicion.prob_vieja ?? 20,
      castigos_melon: normalizarCastigos(edicion.castigos_melon),
      castigos_jubilado: normalizarCastigos(edicion.castigos_jubilado),
      prob_anulacion: edicion.prob_anulacion ?? 40,
    });
  }, [edicion]);

  if (!form) return null;

  const cambiar = (clave, valor) => setForm((a) => ({ ...a, [clave]: valor }));
  const cambiarCastigo = (villano, i, clave, valor) =>
    setForm((a) => ({ ...a, [villano]: a[villano].map((c, j) => (j === i ? { ...c, [clave]: valor } : c)) }));

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
        prob_caida_melon: pct(form.prob_caida_melon),
        prob_caida_jubilado: pct(form.prob_caida_jubilado),
        prob_vieja: pct(form.prob_vieja),
        castigos_melon: limpiar(form.castigos_melon),
        castigos_jubilado: limpiar(form.castigos_jubilado),
        prob_anulacion: pct(form.prob_anulacion),
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

  const anula = pct(form.prob_anulacion);

  return (
    <div style={contenedor}>
      <h4 style={tituloSeccion}>😈 Villanos en casillas fijas</h4>

      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}

      <p style={ayuda}>
        Los 3 villanos están dibujados en su casilla, así el cliente sabe dónde está el peligro. El <strong>% de caída</strong>{" "}
        decide cuántas veces atrapan: cuando el dado iba a llevar a un cliente a la casilla de un villano, solo cae con ese
        porcentaje; las demás veces el dado saca otro número. Con un 30 %, de cada 10 veces que el dado «apunta» al
        villano, cae unas 3. Al retroceder, la ficha nunca se queda en una casilla especial.
      </p>

      <TarjetaVillano
        titulo="🍈 El Melón Cabezón"
        casilla={CASILLAS_VILLANOS.melon}
        probCaida={form.prob_caida_melon}
        onProbCaida={(v) => cambiar("prob_caida_melon", v)}
        castigos={form.castigos_melon}
        suma={sumaMelon}
        bloqueada={bloqueada}
        onCastigo={(i, clave, valor) => cambiarCastigo("castigos_melon", i, clave, valor)}
        anula={anula}
      />

      <TarjetaVillano
        titulo="👵 La Vieja"
        casilla={CASILLAS_VILLANOS.vieja}
        probCaida={form.prob_vieja}
        onProbCaida={(v) => cambiar("prob_vieja", v)}
        textoCastigo="Vuelta a la salida (casilla 1)."
        bloqueada={bloqueada}
        anula={anula}
      />

      <TarjetaVillano
        titulo="👴 El Jubilado"
        casilla={CASILLAS_VILLANOS.jubilado}
        probCaida={form.prob_caida_jubilado}
        onProbCaida={(v) => cambiar("prob_caida_jubilado", v)}
        castigos={form.castigos_jubilado}
        suma={sumaJubilado}
        bloqueada={bloqueada}
        onCastigo={(i, clave, valor) => cambiarCastigo("castigos_jubilado", i, clave, valor)}
        anula={anula}
      />

      <h4 style={{ ...tituloSeccion, marginTop: 6 }}>🦸 Amigos: José Luis y Rafa</h4>
      <div style={fila}>
        <CampoPct id="lc-prob-anulacion" texto="% de que un amigo anule al villano" valor={form.prob_anulacion} bloqueada={bloqueada} onCambio={(v) => cambiar("prob_anulacion", v)} />
        <div style={{ flex: 2, minWidth: 220, alignSelf: "end" }}>
          <p style={ayuda}>
            Vale para los 3 villanos. Cuando un cliente cae en un villano, con este porcentaje aparece José Luis o Rafa
            (uno de los dos al azar), lo aparta y el cliente se queda donde estaba.
          </p>
        </div>
      </div>

      {!bloqueada && (
        <button type="button" style={boton} onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      )}
    </div>
  );
}

function TarjetaVillano({ titulo, casilla, probCaida, onProbCaida, castigos, suma, textoCastigo, bloqueada, onCastigo, anula }) {
  const caida = pct(probCaida);
  const castiga = (caida * (100 - anula)) / 100;
  return (
    <div style={tarjetaVillano}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={numeroCasilla}>{casilla}</span>
        <strong style={{ fontSize: 15, color: "#111827" }}>{titulo}</strong>
        <span style={{ fontSize: 13, color: "#6b7280" }}>Casilla {casilla}</span>
      </div>

      <div style={fila}>
        <CampoPct id={`lc-caida-${casilla}`} texto="% de caída en su casilla" valor={probCaida} bloqueada={bloqueada} onCambio={onProbCaida} />
        <div style={{ flex: 2, minWidth: 220, alignSelf: "end" }}>
          <p style={resumen}>
            De cada 100 veces que el dado apunta a esta casilla: cae unas <strong>{redondeo(caida)}</strong>, y de ellas
            castiga de verdad unas <strong>{redondeo(castiga)}</strong> (las demás las anulan José Luis o Rafa).
          </p>
        </div>
      </div>

      {textoCastigo ? (
        <p style={{ margin: 0, fontSize: 14, color: "#374151" }}>
          <strong>Castigo:</strong> {textoCastigo}
        </p>
      ) : (
        <>
          <table style={{ width: "100%", maxWidth: 480, borderCollapse: "collapse", fontSize: 14 }}>
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
                    <input style={{ ...input, width: 70 }} type="number" min={1} max={62} value={c.casillas} disabled={bloqueada} onChange={(e) => onCastigo(i, "casillas", e.target.value)} aria-label={`Casillas castigo ${NOMBRES_CASTIGO[i]}`} /> casillas
                  </td>
                  <td style={td}>
                    <input style={{ ...input, width: 70 }} type="number" min={0} max={100} step="any" value={c.prob} disabled={bloqueada} onChange={(e) => onCastigo(i, "prob", e.target.value)} aria-label={`Probabilidad castigo ${NOMBRES_CASTIGO[i]}`} /> %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <span style={{ fontSize: 13, fontWeight: 700, color: Math.round(suma) === 100 ? "#166534" : "#b91c1c" }}>
            Suma: {Math.round(suma * 10) / 10} % {Math.round(suma) === 100 ? "✓" : "(tiene que ser 100 %)"}
          </span>
        </>
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

const tarjetaVillano = { display: "grid", gap: 10, padding: 14, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fafafa" };
const numeroCasilla = { width: 34, height: 34, borderRadius: 999, background: "#b91c1c", color: "#fff", display: "grid", placeItems: "center", fontWeight: 900 };
const th = { padding: "4px 6px", fontWeight: 700, fontSize: 13 };
const td = { padding: "4px 6px", whiteSpace: "nowrap" };
const resumen = { margin: 0, padding: "10px 12px", borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", fontSize: 13, lineHeight: 1.4 };
