import { useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { generarTablero, filaColumna, maximoDificilesSeguidas, TIPOS_ESPECIALES } from "../utils/lojopolyTablero";
import {
  urlFotoArticulo,
  contenedor,
  tituloSeccion,
  texto,
  boton,
  avisoError,
  avisoOk,
  avisoAtencion,
  ayuda,
} from "./lojopolyEstilos";

export default function LojoPolyTablero({ campana, grupos, onGuardado }) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const tablero = useMemo(
    () =>
      generarTablero({
        grupos,
        casillasSuerte: campana.casillas_suerte,
        casillasSuerteGrande: campana.casillas_suerte_grande,
        casillasCaja: campana.casillas_caja,
      }),
    [grupos, campana]
  );

  const casillasPorId = useMemo(() => {
    const mapa = new Map();
    grupos.forEach((g) => g.casillas.forEach((c) => mapa.set(c.id, { ...c, grupo: g })));
    return mapa;
  }, [grupos]);

  const seguidas = tablero.ok ? maximoDificilesSeguidas(tablero.celdas, (id) => casillasPorId.get(id)?.es_dificil) : 0;

  // ¿Lo que se ve coincide con lo guardado?
  const guardado = useMemo(() => {
    if (!tablero.ok || !campana.tablero_generado_at) return false;
    if (campana.tablero_lado !== tablero.lado) return false;
    return tablero.celdas
      .filter((c) => c.tipo === "propiedad")
      .every((c) => casillasPorId.get(c.casilla_id)?.posicion === c.posicion);
  }, [tablero, campana, casillasPorId]);

  const gruposIncompletos = grupos.filter((g) => g.casillas.length < 2);

  async function guardar() {
    setError("");
    setMensaje("");
    setGuardando(true);
    const { error: err } = await supabase.rpc("lojopoly_guardar_tablero", {
      p_campana_id: campana.id,
      p_lado: tablero.lado,
      p_celdas: tablero.celdas.map(({ posicion, tipo, casilla_id }) => ({ posicion, tipo, casilla_id })),
    });
    setGuardando(false);
    if (err) {
      setError(`No se ha podido guardar el tablero: ${err.message}`);
      return;
    }
    setMensaje("Tablero guardado. Así lo verán los clientes.");
    onGuardado?.();
  }

  if (!tablero.ok) {
    return (
      <div style={contenedor}>
        <h4 style={tituloSeccion}>Tablero</h4>
        <div style={avisoAtencion}>{tablero.error}</div>
      </div>
    );
  }

  const bloqueado = seguidas >= 6 || gruposIncompletos.length > 0;

  return (
    <div style={contenedor}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <h4 style={tituloSeccion}>Tablero</h4>
        <span style={estado(guardado)}>{guardado ? "Guardado" : "Cambios sin guardar"}</span>
      </div>

      <p style={ayuda}>
        El tablero se monta solo con tus grupos, en orden, y las casillas especiales repartidas entre ellos.
        Tiene {tablero.total} casillas ({tablero.lado} × {tablero.lado}). Las marcas de <strong>difícil</strong> solo
        aparecen aquí en el Admin; el cliente ve todas las casillas iguales.
      </p>

      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}
      {gruposIncompletos.length > 0 && (
        <div style={avisoAtencion}>
          Estos grupos tienen menos de 2 artículos: {gruposIncompletos.map((g) => g.nombre).join(", ")}.
        </div>
      )}
      {seguidas >= 6 && (
        <div style={avisoAtencion}>
          Hay {seguidas} casillas difíciles seguidas. El dado no podría avanzar desde alguna posición. Separa esos
          artículos en grupos distintos o añade casillas especiales.
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <div style={tableroGrid(tablero.lado)}>
          <div style={centro(tablero.lado)}>
            <span style={logoCentro}>
              Lojo<span style={{ color: "#ffcc2e" }}>Poly</span>
            </span>
            <span style={{ fontSize: 12, opacity: 0.85 }}>Vista del Admin</span>
          </div>

          {tablero.celdas.map((celda) => {
            const [fila, columna] = filaColumna(celda.posicion, tablero.lado);
            const posicionGrid = { gridRow: fila, gridColumn: columna };
            if (celda.tipo !== "propiedad") {
              const info = TIPOS_ESPECIALES[celda.tipo];
              return (
                <div key={celda.posicion} style={{ ...especial(celda.tipo), ...posicionGrid }} title={info.nombre}>
                  <span style={{ fontSize: "1.8em", fontWeight: 900, lineHeight: 1 }}>{info.icono}</span>
                  <span>{info.nombre}</span>
                </div>
              );
            }
            const casilla = casillasPorId.get(celda.casilla_id);
            const foto = urlFotoArticulo(casilla?.articulos?.foto);
            const nombre = casilla?.nombre_mostrar || casilla?.articulos?.nombre || "—";
            const quedan = casilla?.es_dificil ? Math.max(0, (casilla.stock_max ?? 0) - (casilla.emitidas ?? 0)) : null;
            return (
              <div key={celda.posicion} style={{ ...propiedad, ...posicionGrid }} title={`${casilla?.grupo?.nombre}: ${nombre}`}>
                <div style={{ height: "16%", background: casilla?.grupo?.color, flexShrink: 0 }} />
                <div style={fotoCelda}>
                  {foto ? <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ color: "#9ca3af" }}>Sin foto</span>}
                </div>
                <div style={nombreCelda}>{nombre}</div>
                {casilla?.es_dificil && (
                  <span style={marcaDificil} title={quedan === 0 ? "No puede salir" : `Puede salir ${quedan} veces más`}>
                    ★ {quedan}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {grupos.map((g) => (
          <span key={g.id} style={leyenda(g.color)}>
            <strong>{g.nombre}</strong> · {g.premio_texto || "sin premio"}
          </span>
        ))}
      </div>
      <p style={texto}>★ = casilla difícil, con las veces que todavía puede salir.</p>

      <button type="button" style={boton} onClick={guardar} disabled={guardando || bloqueado || guardado}>
        {guardando ? "Guardando..." : guardado ? "Tablero guardado" : "Guardar tablero"}
      </button>
    </div>
  );
}

const estado = (ok) => ({
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  background: ok ? "#dcfce7" : "#fef3c7",
  color: ok ? "#166534" : "#92400e",
});

const tableroGrid = (lado) => ({
  display: "grid",
  gridTemplateColumns: `1.3fr repeat(${lado - 2}, 1fr) 1.3fr`,
  gridTemplateRows: `1.3fr repeat(${lado - 2}, 1fr) 1.3fr`,
  gap: 3,
  padding: 6,
  aspectRatio: "1",
  width: "100%",
  minWidth: 560,
  maxWidth: 780,
  background: "#e9edf8",
  borderRadius: 14,
  border: "4px solid #f81a1e",
  boxShadow: "0 0 0 3px #0b1140",
  fontSize: 10,
});

const centro = (lado) => ({
  gridRow: `2 / ${lado}`,
  gridColumn: `2 / ${lado}`,
  borderRadius: 10,
  background: "linear-gradient(135deg, #0d27c4, #06127a)",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
});

const logoCentro = { fontSize: 34, fontWeight: 900, fontStyle: "italic", letterSpacing: "0.02em", transform: "rotate(-5deg)" };

const propiedad = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  background: "#fff",
  borderRadius: 5,
  overflow: "hidden",
  minWidth: 0,
};

const fotoCelda = { flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 2, fontSize: 9 };
const nombreCelda = { padding: "1px 2px 3px", textAlign: "center", fontWeight: 700, color: "#0b1140", lineHeight: 1.05, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" };
const marcaDificil = { position: "absolute", top: "18%", right: 2, padding: "1px 4px", borderRadius: 999, background: "#f59e0b", color: "#fff", fontWeight: 900, fontSize: 9 };

const especial = (tipo) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  borderRadius: 5,
  fontWeight: 800,
  textTransform: "uppercase",
  textAlign: "center",
  background: { salida: "#f81a1e", descanso: "#dff3e6", suerte: "#fff3c4", suerte_grande: "#ffcc2e", caja: "#e3e8ff" }[tipo],
  color: { salida: "#fff", descanso: "#1d6b3b", suerte: "#a16900", suerte_grande: "#0b1140", caja: "#0b22b8" }[tipo],
});

const leyenda = (color) => ({ padding: "5px 10px", borderRadius: 999, background: "#fff", border: `2px solid ${color}`, fontSize: 13, color: "#374151" });
