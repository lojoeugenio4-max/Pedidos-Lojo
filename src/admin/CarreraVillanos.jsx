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
import {
  VILLANOS,
  ORDEN_VILLANOS,
  CASILLA_SALIDA,
  CASILLA_META,
  normalizarVillanosCasillas,
  columnasAntiguasVillanos,
  tipoCasillaFija,
  MAX_CASILLAS_POR_VILLANO,
} from "../utils/carreraTablero";

// Los 3 villanos están en casillas fijas (el cliente ve dónde está el
// peligro) y cada uno sale VARIAS VECES en el tablero (5 por defecto): El
// Melón Cabezón, Lucas (el del kung fu) y El Jubilado. Cada casilla tiene su
// propio % de caída: cuando el dado iba a llevar a esa casilla, solo cae con
// ese porcentaje; las demás veces el dado saca otro número.
// José Luis y Rafa pueden anular a cualquiera de los tres.

const CASTIGOS_DEFECTO = [
  { casillas: 3, prob: 60 },
  { casillas: 6, prob: 30 },
  { casillas: 10, prob: 10 },
];
const NOMBRES_CASTIGO = ["Leve", "Medio", "Fuerte"];
const NOMBRE_TIPO = { salida: "la Salida", meta: "la Meta", premio: "una casilla de premio", lojo: "una casilla Lojo", palet: "una casilla Palet" };

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
      posiciones: normalizarVillanosCasillas(edicion),
      castigos_melon: normalizarCastigos(edicion.castigos_melon),
      castigos_jubilado: normalizarCastigos(edicion.castigos_jubilado),
      prob_anulacion: edicion.prob_anulacion ?? 40,
    });
  }, [edicion]);

  if (!form) return null;

  const cambiar = (clave, valor) => setForm((a) => ({ ...a, [clave]: valor }));
  const cambiarPosicion = (indice, clave, valor) =>
    setForm((a) => ({ ...a, posiciones: a.posiciones.map((p, i) => (i === indice ? { ...p, [clave]: valor } : p)) }));
  // Añade una casilla al villano: la primera libre (sin especial ni villano),
  // con el mismo % que su primera casilla.
  const anadirPosicion = (villano) =>
    setForm((a) => {
      const ocupadas = new Set(a.posiciones.map((p) => Math.round(num(p.casilla))));
      let libre = null;
      for (let n = CASILLA_SALIDA + 1; n < CASILLA_META && libre === null; n += 1) {
        if (!ocupadas.has(n) && !tipoCasillaFija(n) && n !== 32) libre = n;
      }
      const primera = a.posiciones.find((p) => p.villano === villano);
      const nueva = { villano, casilla: libre ?? "", prob: primera?.prob ?? 20 };
      const ultimo = a.posiciones.map((p) => p.villano).lastIndexOf(villano);
      const posiciones = [...a.posiciones];
      posiciones.splice(ultimo + 1, 0, nueva);
      return { ...a, posiciones };
    });
  const quitarPosicion = (indice) => setForm((a) => ({ ...a, posiciones: a.posiciones.filter((_, i) => i !== indice) }));
  const cambiarCastigo = (villano, i, clave, valor) =>
    setForm((a) => ({ ...a, [villano]: a[villano].map((c, j) => (j === i ? { ...c, [clave]: valor } : c)) }));

  const sumaMelon = form.castigos_melon.reduce((s, c) => s + num(c.prob), 0);
  const sumaJubilado = form.castigos_jubilado.reduce((s, c) => s + num(c.prob), 0);

  // Problema de cada posición (casilla repetida, fuera del tablero o encima
  // de otra casilla especial). null si está bien.
  function problemaPosicion(indice) {
    const n = Math.round(num(form.posiciones[indice].casilla));
    if (n <= CASILLA_SALIDA || n >= CASILLA_META) return `Tiene que estar entre la ${CASILLA_SALIDA + 1} y la ${CASILLA_META - 1}.`;
    if (n === 32) return "La 32 es la casilla del premio de la mitad.";
    const tipo = tipoCasillaFija(n);
    if (tipo) return `La ${n} ya es ${NOMBRE_TIPO[tipo]}.`;
    const repetida = form.posiciones.findIndex((p, i) => i !== indice && Math.round(num(p.casilla)) === n);
    if (repetida >= 0) return `La ${n} ya la tiene ${VILLANOS[form.posiciones[repetida].villano].nombre}.`;
    return null;
  }

  async function guardar() {
    setMensaje("");
    setError("");
    if (Math.round(sumaMelon) !== 100 || Math.round(sumaJubilado) !== 100) {
      setError("Los porcentajes de los 3 castigos de cada villano tienen que sumar 100 %.");
      return;
    }
    const problema = form.posiciones.map((_, i) => problemaPosicion(i)).find(Boolean);
    if (problema) {
      setError(`Revisa las casillas de los villanos: ${problema}`);
      return;
    }
    const limpiar = (lista) => lista.map((c) => ({ casillas: Math.max(1, Math.round(num(c.casillas))), prob: pct(c.prob) }));
    const posiciones = form.posiciones.map((p) => ({ villano: p.villano, casilla: Math.round(num(p.casilla)), prob: pct(p.prob) }));

    setGuardando(true);
    const { error: err } = await supabase
      .from("carrera_ediciones")
      .update({
        villanos_casillas: posiciones,
        ...columnasAntiguasVillanos(posiciones),
        castigos_melon: limpiar(form.castigos_melon),
        castigos_jubilado: limpiar(form.castigos_jubilado),
        prob_anulacion: pct(form.prob_anulacion),
        updated_at: new Date().toISOString(),
      })
      .eq("id", edicion.id);
    setGuardando(false);

    if (err) {
      setError(
        err.message?.includes("villanos_casillas")
          ? "Falta aplicar la migración migracion_carrera_villanos_dobles.sql en Supabase."
          : `No se ha podido guardar: ${err.message}`
      );
      return;
    }
    setMensaje("Guardado.");
    onGuardado?.();
  }

  const anula = pct(form.prob_anulacion);

  return (
    <div style={contenedor}>
      <h4 style={tituloSeccion}>😈 Villanos en casillas fijas (cada uno sale varias veces)</h4>

      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}

      <p style={ayuda}>
        Cada villano está dibujado en <strong>varias casillas</strong> del tablero (hasta {MAX_CASILLAS_POR_VILLANO}), así el
        cliente sabe dónde está el peligro. Con «＋ Añadir casilla» y «Quitar» decides cuántas tiene cada uno.
        Cada casilla tiene su propio <strong>% de caída</strong>: cuando el dado iba a llevar a un cliente a esa casilla,
        solo cae con ese porcentaje; las demás veces el dado saca otro número. Con un 30 %, de cada 10 veces que el dado
        «apunta» a esa casilla, cae unas 3. Al retroceder, la ficha nunca se queda en una casilla especial.
      </p>

      {ORDEN_VILLANOS.map((villano) => {
        const datos = VILLANOS[villano];
        const indices = form.posiciones.map((p, i) => (p.villano === villano ? i : -1)).filter((i) => i >= 0);
        const esLucas = villano === "vieja";
        const claveCastigos = villano === "melon" ? "castigos_melon" : "castigos_jubilado";
        return (
          <TarjetaVillano
            key={villano}
            titulo={`${datos.emoji} ${datos.nombre}`}
            color={datos.color}
            posiciones={indices.map((i) => ({ indice: i, ...form.posiciones[i], problema: problemaPosicion(i) }))}
            onPosicion={cambiarPosicion}
            onAnadir={() => anadirPosicion(villano)}
            onQuitar={quitarPosicion}
            castigos={esLucas ? null : form[claveCastigos]}
            suma={villano === "melon" ? sumaMelon : sumaJubilado}
            textoCastigo={esLucas ? "Vuelta a la salida (casilla 1), en todas sus casillas." : null}
            bloqueada={bloqueada}
            onCastigo={(i, clave, valor) => cambiarCastigo(claveCastigos, i, clave, valor)}
            anula={anula}
          />
        );
      })}

      <h4 style={{ ...tituloSeccion, marginTop: 6 }}>🦸 Amigos: José Luis y Rafa</h4>
      <div style={fila}>
        <CampoPct id="lc-prob-anulacion" texto="% de que un amigo anule al villano" valor={form.prob_anulacion} bloqueada={bloqueada} onCambio={(v) => cambiar("prob_anulacion", v)} />
        <div style={{ flex: 2, minWidth: 220, alignSelf: "end" }}>
          <p style={ayuda}>
            Vale para los 3 villanos y todas sus casillas. Cuando un cliente cae en un villano, con este porcentaje aparece
            José Luis o Rafa (uno de los dos al azar), lo aparta y el cliente se queda donde estaba.
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

function TarjetaVillano({ titulo, color, posiciones, onPosicion, onAnadir, onQuitar, castigos, suma, textoCastigo, bloqueada, onCastigo, anula }) {
  return (
    <div style={tarjetaVillano}>
      <strong style={{ fontSize: 16, color: "#111827" }}>{titulo}</strong>

      {posiciones.map((p, n) => {
        const caida = pct(p.prob);
        const castiga = (caida * (100 - anula)) / 100;
        return (
          <div key={p.indice} style={filaPosicion}>
            <span style={{ ...numeroCasilla, background: color }}>{Math.round(num(p.casilla)) || "?"}</span>
            <label style={{ ...campo, flex: "0 0 auto" }}>
              <span>Posición {n + 1}: casilla</span>
              <input
                id={`lc-villano-${p.villano}-${n}-casilla`}
                style={{ ...input, width: 90, boxSizing: "border-box" }}
                type="number"
                min={CASILLA_SALIDA + 1}
                max={CASILLA_META - 1}
                value={p.casilla}
                disabled={bloqueada}
                onChange={(e) => onPosicion(p.indice, "casilla", e.target.value)}
              />
            </label>
            <div style={{ flex: "0 0 auto" }}>
              <CampoPct
                ancho={90}
                id={`lc-villano-${p.villano}-${n}-prob`}
                texto="% de caída"
                valor={p.prob}
                bloqueada={bloqueada}
                onCambio={(v) => onPosicion(p.indice, "prob", v)}
              />
            </div>
            <div style={{ flex: 1, minWidth: 220, alignSelf: "end" }}>
              {p.problema ? (
                <p style={{ ...resumen, background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}>⚠️ {p.problema}</p>
              ) : (
                <p style={resumen}>
                  De cada 100 veces que el dado apunta a la casilla {Math.round(num(p.casilla))}: cae unas{" "}
                  <strong>{redondeo(caida)}</strong>, y castiga de verdad unas <strong>{redondeo(castiga)}</strong>.
                </p>
              )}
            </div>
            {!bloqueada && posiciones.length > 1 && (
              <button type="button" style={{ ...botonQuitar, alignSelf: "center" }} onClick={() => onQuitar(p.indice)} aria-label={`Quitar la casilla ${p.casilla}`}>
                Quitar
              </button>
            )}
          </div>
        );
      })}
      {!bloqueada && posiciones.length < MAX_CASILLAS_POR_VILLANO && (
        <button type="button" style={botonAnadir} onClick={onAnadir}>
          ＋ Añadir casilla
        </button>
      )}

      {textoCastigo ? (
        <p style={{ margin: 0, fontSize: 14, color: "#374151" }}>
          <strong>Castigo:</strong> {textoCastigo}
        </p>
      ) : (
        <>
          <span style={{ fontSize: 13, color: "#6b7280" }}>Castigos (iguales en todas sus casillas):</span>
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

function CampoPct({ id, texto, valor, bloqueada, onCambio, ancho }) {
  return (
    <label style={campo}>
      <span>{texto}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input id={id} style={ancho ? { ...input, width: ancho, boxSizing: "border-box" } : input} type="number" min={0} max={100} step="any" value={valor} disabled={bloqueada} onChange={(e) => onCambio(e.target.value)} />
        <strong>%</strong>
      </div>
    </label>
  );
}

const tarjetaVillano = { display: "grid", gap: 10, padding: 14, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fafafa" };
const filaPosicion = { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, padding: "8px 0", borderTop: "1px dashed #e5e7eb" };
const numeroCasilla = { width: 38, height: 38, borderRadius: 999, color: "#fff", display: "grid", placeItems: "center", fontWeight: 900, alignSelf: "center" };
const th = { padding: "4px 6px", fontWeight: 700, fontSize: 13 };
const td = { padding: "4px 6px", whiteSpace: "nowrap" };
const resumen = { margin: 0, padding: "10px 12px", borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", fontSize: 13, lineHeight: 1.4 };
const botonAnadir = { justifySelf: "start", border: "1px dashed #9ca3af", borderRadius: 9, padding: "7px 12px", background: "#fff", color: "#374151", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const botonQuitar = { border: "1px solid #fecaca", borderRadius: 9, padding: "6px 10px", background: "#fff", color: "#b91c1c", fontWeight: 700, fontSize: 13, cursor: "pointer" };
