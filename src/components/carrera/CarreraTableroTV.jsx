// LA LOCA CARRERA DE LOJO · tablero en la TV grande.
//
// Se abre desde «Pedidos recibidos» → botón «🏁 Loca Carrera» y se queda en
// pantalla entre cliente y cliente, igual que el Bombo de Bingo o el Sorteo.
//
// El tablero es el diseñado (espiral, Halloween, Melón Cabezón, Jubilado,
// Lucas, José Luis y Rafa, palets, Lojo...) y está tal cual en
// public/loca-carrera/tablero.html. Aquí solo se abre a pantalla completa y se
// le pasan los datos reales:
//   · en la URL, las casillas de los villanos del Admin (2 por villano, cada
//     una con su %). Si se cambian en el Admin, el tablero se recarga solo.
//   · por mensaje, cada 15 s: clientes (Top 10 y fichas de los 5 primeros),
//     premios de las casillas (los agotados salen tachados) y premio final.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { parametroVillanos } from "../../utils/carreraTablero";

const REFRESCO_MS = 15000;
const RUTA_TABLERO = "/loca-carrera/tablero.html";

async function cargarDatosCarrera() {
  const { data: edicion, error } = await supabase
    .from("carrera_ediciones")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!edicion) return { edicion: null, jugadores: [], premios: {} };

  const [j, cas, cont] = await Promise.all([
    supabase.rpc("admin_carrera_jugadores", { p_edicion: edicion.id }),
    supabase.from("carrera_casillas_premio").select("*").eq("edicion_id", edicion.id),
    supabase.rpc("admin_carrera_premios_contador", { p_edicion: edicion.id }),
  ]);
  if (j.error) console.warn("Loca Carrera TV: no se pudieron cargar las fichas:", j.error);

  const jugadores = (j.data || [])
    .slice()
    .sort((a, b) => Number(a.puesto) - Number(b.puesto))
    .map((x, i) => ({
      id: x.cliente_id ?? `c${i}`,
      nombre: x.cliente_nombre || "Cliente",
      casilla: Number(x.casilla) || 1,
      puesto: Number(x.puesto) || i + 1,
    }));

  const dados = Object.fromEntries((cont.data || []).map((c) => [c.casilla, Number(c.dados) || 0]));
  const premios = {};
  (cas.data || []).forEach((c) => {
    const tienePremio = Boolean(String(c.texto || "").trim() || c.articulo_id);
    premios[c.casilla] = {
      nombre: String(c.texto || "").trim() || "Premio sorpresa",
      quedan: c.activa && tienePremio ? Math.max(0, Number(c.maximo || 0) - (dados[c.casilla] || 0)) : 0,
      desde: c.fecha_desde || null,
    };
  });

  return { edicion, jugadores, premios };
}

export default function CarreraTableroTV() {
  const iframeRef = useRef(null);
  const datosRef = useRef(null);
  const [villanos, setVillanos] = useState(null);
  const [aviso, setAviso] = useState("");

  const enviar = useCallback(() => {
    const d = datosRef.current;
    const ventana = iframeRef.current?.contentWindow;
    if (!d || !ventana) return;
    ventana.postMessage(
      {
        tipo: "lojo-carrera-datos",
        jugadores: d.jugadores,
        premios: d.premios,
        premioFinal: d.edicion?.premio_final_texto || "",
      },
      window.location.origin
    );
  }, []);

  useEffect(() => {
    let cancelado = false;
    async function refrescar() {
      try {
        const d = await cargarDatosCarrera();
        if (cancelado) return;
        datosRef.current = d;
        setAviso(d.edicion ? "" : "La Loca Carrera todavía no está creada en el Admin.");
        setVillanos(parametroVillanos(d.edicion));
        enviar();
      } catch (err) {
        console.warn("Loca Carrera TV:", err);
        if (!cancelado && !datosRef.current) setVillanos(parametroVillanos(null));
      }
    }
    refrescar();
    const intervalo = window.setInterval(refrescar, REFRESCO_MS);
    // El tablero avisa cuando ha terminado de cargar: se le mandan los datos ya.
    function alMensaje(e) {
      if (e.origin === window.location.origin && e.data?.tipo === "lojo-carrera-listo") enviar();
    }
    window.addEventListener("message", alMensaje);
    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
      window.removeEventListener("message", alMensaje);
    };
  }, [enviar]);

  return (
    <main style={estilos.pagina}>
      {villanos !== null && (
        <iframe
          ref={iframeRef}
          key={villanos}
          title="La Loca Carrera de Lojo"
          src={`${RUTA_TABLERO}?tv=1&v=${encodeURIComponent(villanos)}`}
          style={estilos.iframe}
          allow="autoplay"
          onLoad={enviar}
        />
      )}
      {aviso && <div style={estilos.aviso}>{aviso}</div>}
    </main>
  );
}

const estilos = {
  pagina: { position: "fixed", inset: 0, background: "#07020c", overflow: "hidden" },
  iframe: { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, display: "block" },
  aviso: {
    position: "absolute",
    left: "50%",
    bottom: "3vh",
    transform: "translateX(-50%)",
    padding: "1vh 2vw",
    borderRadius: 12,
    background: "rgba(0,0,0,.75)",
    color: "#fff",
    font: "700 2.4vh system-ui, sans-serif",
  },
};
