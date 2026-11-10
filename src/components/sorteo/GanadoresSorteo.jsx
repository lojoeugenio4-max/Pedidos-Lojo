// Ganadores del Sorteo, visibles para TODOS los clientes (hayan jugado o no).
//
//  - useGanadoresSorteo: últimas cuadrículas ya sorteadas con el nombre del
//    ganador (sale de obtener_cuadricula_sorteo, igual que en la TV grande).
//  - AvisoUltimoGanador: tarjeta en la pantalla principal del cliente
//    durante unos días después de cada sorteo ("Sorteo 5: ganador Fulano
//    con el 37"). El cliente la puede cerrar con la ✕.
//  - ListaGanadoresSorteo: lista "Ganadores de los sorteos" dentro de
//    "Mi Sorteo".
import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { formatearFechaSorteo } from "../../utils/sorteoDirecto";

const dos = (n) => String(n).padStart(2, "0");
const MAXIMO_GANADORES = 6;
// Cuánto tiempo se enseña el aviso del último ganador en la pantalla principal.
const DIAS_AVISO = 3;
const CLAVE_CERRADOS = "lojo_sorteo_ganador_cerrado";

function aMs(valor) {
  if (!valor) return null;
  const ms = Date.parse(valor);
  return Number.isFinite(ms) ? ms : null;
}

export function useGanadoresSorteo({ habilitado = true, revision = 0 } = {}) {
  const [ganadores, setGanadores] = useState([]);

  useEffect(() => {
    if (!habilitado) {
      setGanadores([]);
      return undefined;
    }
    let cancelado = false;

    (async () => {
      try {
        const { data: ediciones, error } = await supabase
          .from("sorteo_editions")
          .select("*")
          .eq("estado", "resuelta")
          .order("numero", { ascending: false })
          .limit(MAXIMO_GANADORES);
        if (error) throw error;

        const lista = await Promise.all(
          (ediciones || [])
            .filter((ed) => ed.numero_premiado != null)
            .map(async (ed) => {
              let ganadorNombre = "";
              try {
                const { data } = await supabase.rpc("obtener_cuadricula_sorteo", { p_edition_id: ed.id });
                const casilla = (data?.casillas || []).find((c) => Number(c.numero) === Number(ed.numero_premiado));
                ganadorNombre = casilla?.cliente_nombre || "";
              } catch (errorCuadricula) {
                console.error("No se pudo cargar el ganador del Sorteo:", errorCuadricula);
              }
              return {
                id: ed.id,
                nombre: `Sorteo ${ed.numero}`,
                numeroPremiado: Number(ed.numero_premiado),
                ganadorNombre,
                premioTexto: ed.premio_texto || "",
                sorteadoAt: aMs(ed.sorteo_inicio_at) || aMs(ed.resuelta_at),
              };
            })
        );
        if (!cancelado) setGanadores(lista);
      } catch (error) {
        console.error("No se pudieron cargar los ganadores del Sorteo:", error);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [habilitado, revision]);

  return ganadores;
}

function leerCerrados() {
  try {
    const valor = JSON.parse(window.localStorage.getItem(CLAVE_CERRADOS) || "[]");
    return Array.isArray(valor) ? valor.map(String) : [];
  } catch {
    return [];
  }
}

export function AvisoUltimoGanador({ ganadores = [], getAhora = () => Date.now() }) {
  const [cerrados, setCerrados] = useState(leerCerrados);

  const ultimo = ganadores[0];
  if (!ultimo || !ultimo.sorteadoAt) return null;
  if (getAhora() - ultimo.sorteadoAt > DIAS_AVISO * 24 * 60 * 60 * 1000) return null;
  if (cerrados.includes(String(ultimo.id))) return null;

  const cerrar = () => {
    const nuevos = [...cerrados, String(ultimo.id)].slice(-20);
    setCerrados(nuevos);
    try {
      window.localStorage.setItem(CLAVE_CERRADOS, JSON.stringify(nuevos));
    } catch {
      // Sin almacenamiento: se cierra solo hasta que se recargue la app.
    }
  };

  return (
    <div style={estilos.aviso}>
      <span style={estilos.avisoIcono}>🏆</span>
      <span style={estilos.avisoTexto}>
        <strong style={estilos.avisoTitulo}>
          {ultimo.nombre}: ¡ganador {ultimo.ganadorNombre || "ya conocido"}!
        </strong>
        <span style={estilos.avisoDetalle}>
          Número premiado: <strong>{dos(ultimo.numeroPremiado)}</strong>
          {ultimo.premioTexto ? ` · ${ultimo.premioTexto}` : ""}
        </span>
      </span>
      <button type="button" onClick={cerrar} style={estilos.avisoCerrar} aria-label="Cerrar aviso del ganador">
        ✕
      </button>
    </div>
  );
}

export function ListaGanadoresSorteo({ ganadores = [] }) {
  if (!ganadores.length) return null;
  return (
    <section style={estilos.lista}>
      <h3 style={estilos.listaTitulo}>🏆 Ganadores de los sorteos</h3>
      {ganadores.map((g) => (
        <div key={g.id} style={estilos.fila}>
          <span style={estilos.filaNumero}>{dos(g.numeroPremiado)}</span>
          <span style={estilos.filaTexto}>
            <strong style={estilos.filaNombre}>{g.ganadorNombre || "Ganador"}</strong>
            <span style={estilos.filaDetalle}>
              {g.nombre}
              {g.sorteadoAt ? ` · ${formatearFechaSorteo(g.sorteadoAt)}` : ""}
            </span>
          </span>
        </div>
      ))}
    </section>
  );
}

const estilos = {
  aviso: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 14,
    border: "2px solid #16a34a",
    background: "linear-gradient(135deg, #dcfce7, #bbf7d0)",
    color: "#14532d",
  },
  avisoIcono: { fontSize: 26, flexShrink: 0 },
  avisoTexto: { display: "grid", gap: 2, flex: 1, minWidth: 0 },
  avisoTitulo: { fontSize: 14, lineHeight: 1.25 },
  avisoDetalle: { fontSize: 12, lineHeight: 1.3, fontWeight: 600 },
  avisoCerrar: {
    flexShrink: 0,
    border: 0,
    borderRadius: 999,
    width: 30,
    height: 30,
    background: "rgba(20,83,45,.12)",
    color: "#14532d",
    fontWeight: 900,
    cursor: "pointer",
  },
  lista: {
    display: "grid",
    gap: 8,
    marginTop: 16,
    padding: "14px 14px 16px",
    borderRadius: 16,
    background: "#fefce8",
    border: "1px solid #fde68a",
  },
  listaTitulo: { margin: "0 0 4px", fontSize: 17, color: "#713f12" },
  fila: { display: "flex", alignItems: "center", gap: 12 },
  filaNumero: {
    minWidth: 46,
    textAlign: "center",
    padding: "6px 8px",
    borderRadius: 10,
    background: "#16a34a",
    color: "#fff",
    fontSize: 20,
    fontWeight: 900,
    fontVariantNumeric: "tabular-nums",
  },
  filaTexto: { display: "grid", gap: 1, minWidth: 0 },
  filaNombre: { fontSize: 15, color: "#111827" },
  filaDetalle: { fontSize: 12, color: "#6b7280", fontWeight: 600 },
};
