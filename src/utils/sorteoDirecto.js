// Lógica común del SORTEO EN DIRECTO (TV grande + móvil del cliente).
//
// Cómo funciona (resumen):
//  1. En el Admin se programa fecha y hora de cada cuadrícula
//     (sorteo_editions.sorteo_programado_at).
//  2. Al llegar esa hora, la primera pantalla abierta (TV o móvil de un
//     participante) llama a iniciar_sorteo_edition. El SERVIDOR elige el
//     número al azar y guarda el instante de arranque (sorteo_inicio_at).
//     Si dos pantallas lo llaman a la vez, ganan las mismas cifras: solo
//     hay un sorteo.
//  3. Cada pantalla dibuja la animación en función de
//     (hora del servidor − sorteo_inicio_at), así que todas van sincronizadas
//     aunque tengan el reloj mal o se abran a mitad.
//  4. Pasada la animación se llama a finalizar_sorteo_edition, que guarda el
//     ganador en la cuadrícula y deja el aviso pendiente al cliente
//     (resolver_sorteo_edition, que ya existía).
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

// ---- Guion de la animación (milisegundos desde el arranque) ------------
// Las dos ruedas giran a la vez; primero se para la de UNIDADES y después
// la de DECENAS. Si se cambia algo aquí, el mínimo de 15 s de
// finalizar_sorteo_edition (en la migración SQL) debe seguir siendo menor
// que SORTEO_FIN_MS.
export const SORTEO_T_UNIDADES_MS = 7500; // se para la rueda de unidades
export const SORTEO_T_DECENAS_MS = 14000; // se para la rueda de decenas
export const SORTEO_T_REVELAR_MS = 15500; // se anuncia número y ganador
export const SORTEO_FIN_MS = 16000; // a partir de aquí se guarda el resultado
// Cuánto tiempo se mantiene en pantalla desde el arranque (incluye el
// resultado a la vista durante ~22 s).
export const SORTEO_VISTA_MS = SORTEO_FIN_MS + 22000;

const REFRESCO_LENTO_MS = 20000;
const REFRESCO_RAPIDO_MS = 2000;
// Se refresca rápido cuando falta menos de esto para un sorteo (o ya empezó).
const VENTANA_RAPIDA_MS = 90000;

export function formatearFechaSorteo(ms) {
  if (!ms) return "";
  const fecha = new Date(ms);
  const dia = fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const hora = fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return `${dia} a las ${hora}`;
}

function aMs(valor) {
  if (!valor) return null;
  const ms = Date.parse(valor);
  return Number.isFinite(ms) ? ms : null;
}

// Convierte una fila de sorteo_editions (TV) o del RPC sorteo_avisos_cliente
// (móvil) a un formato único.
function normalizarEdicion(fila) {
  const numero = fila.numero ?? fila.edition_numero;
  const id = fila.edition_id ?? fila.id;
  return {
    id,
    numero,
    nombre: `Sorteo ${numero}`,
    estado: fila.estado,
    programadoAt: aMs(fila.sorteo_programado_at),
    inicioAt: aMs(fila.sorteo_inicio_at),
    unidades: fila.digito_unidades ?? null,
    decenas: fila.digito_decenas ?? null,
    numeroPremiado: fila.numero_premiado ?? null,
    premioTexto: fila.premio_texto || "",
    misNumeros: Array.isArray(fila.mis_numeros) ? fila.mis_numeros : [],
  };
}

// modo "tv": mira TODAS las cuadrículas (pantalla grande).
// modo "cliente": solo las cuadrículas donde el cliente (token) tiene números.
//
// Devuelve:
//   directo   -> cuadrícula que se está sorteando ahora mismo (o null)
//   proximas  -> cuadrículas con fecha de sorteo todavía por llegar
//   getAhora  -> hora del servidor en ms (estable, para animar)
//   cerrar(id)-> deja de mostrar ese sorteo en esta pantalla
//
// El estado solo cambia cuando algo cambia de verdad (no hay un "tic" cada
// segundo que vuelva a pintar todo el componente que lo usa).
//
// onResuelta(edicion) se llama una vez cuando una cuadrícula que estaba en
// juego pasa a "resuelta" mientras esta pantalla está abierta (sirve para que
// el móvil vuelva a comprobar si hay premio pendiente).
export function useSorteoDirecto({ modo = "cliente", token = "", habilitado = true, onResuelta = null } = {}) {
  const [directo, setDirecto] = useState(null);
  const [proximas, setProximas] = useState([]);

  const edicionesRef = useRef([]);
  const offsetRef = useRef(0);
  const descartadasRef = useRef(new Set());
  const intentosRef = useRef(new Map()); // "iniciar:ID" / "finalizar:ID" -> último intento (ms)
  const cargandoRef = useRef(false);
  const cargarRef = useRef(() => {});
  const estadosPrevios = useRef(new Map());
  const onResueltaRef = useRef(onResuelta);
  onResueltaRef.current = onResuelta;

  const getAhora = useCallback(() => Date.now() + offsetRef.current, []);

  const recalcular = useCallback(() => {
    const ahora = Date.now() + offsetRef.current;

    const activo = edicionesRef.current.find(
      (ed) =>
        ed.inicioAt &&
        ed.unidades != null &&
        ed.decenas != null &&
        ahora >= ed.inicioAt - 1000 &&
        ahora < ed.inicioAt + SORTEO_VISTA_MS &&
        !descartadasRef.current.has(ed.id)
    );

    setDirecto((previo) => {
      if (!activo) return previo ? null : previo;
      if (previo && previo.id === activo.id && previo.inicioAt === activo.inicioAt) {
        // Mismos datos: se conserva el objeto para no repintar. Solo se
        // refresca si ha aparecido el resultado final.
        return previo.numeroPremiado === activo.numeroPremiado && previo.estado === activo.estado
          ? previo
          : activo;
      }
      return activo;
    });

    const futuras = edicionesRef.current
      .filter((ed) => ed.programadoAt && !ed.inicioAt && ed.estado !== "resuelta")
      .sort((a, b) => a.programadoAt - b.programadoAt);
    setProximas((previo) => {
      const clave = (lista) => lista.map((e) => `${e.id}:${e.programadoAt}:${e.misNumeros.join(",")}`).join("|");
      return clave(previo) === clave(futuras) ? previo : futuras;
    });
  }, []);

  const cargar = useCallback(async () => {
    if (cargandoRef.current) return;
    cargandoRef.current = true;
    try {
      const t0 = Date.now();
      let filas = [];
      let ahoraServidor = null;

      if (modo === "cliente") {
        if (!token) {
          edicionesRef.current = [];
          recalcular();
          return;
        }
        const { data, error } = await supabase.rpc("sorteo_avisos_cliente", { p_token: token });
        if (error) throw error;
        ahoraServidor = aMs(data?.ahora);
        filas = Array.isArray(data?.ediciones) ? data.ediciones : [];
      } else {
        const desde = new Date(Date.now() - 120000).toISOString();
        const [{ data, error }, { data: ahora }] = await Promise.all([
          supabase
            .from("sorteo_editions")
            .select("*")
            .or(`estado.neq.resuelta,sorteo_inicio_at.gt.${desde}`),
          supabase.rpc("sorteo_ahora"),
        ]);
        if (error) throw error;
        ahoraServidor = aMs(ahora);
        filas = data || [];
      }

      if (ahoraServidor) {
        // Se compensa la mitad del tiempo de ida y vuelta de la consulta.
        offsetRef.current = ahoraServidor - (t0 + Date.now()) / 2;
      }
      edicionesRef.current = filas.map(normalizarEdicion);

      edicionesRef.current.forEach((ed) => {
        const previo = estadosPrevios.current.get(ed.id);
        if (previo && previo !== "resuelta" && ed.estado === "resuelta") onResueltaRef.current?.(ed);
        estadosPrevios.current.set(ed.id, ed.estado);
      });

      recalcular();
    } catch (error) {
      console.error("No se pudo consultar el Sorteo en directo:", error);
    } finally {
      cargandoRef.current = false;
    }
  }, [modo, token, recalcular]);

  cargarRef.current = cargar;

  // Llamadas al servidor con freno: como máximo una cada ~2 s por cuadrícula.
  const intentar = useCallback(async (clave, funcion, parametros) => {
    const ultimo = intentosRef.current.get(clave) || 0;
    if (Date.now() - ultimo < 2000) return;
    intentosRef.current.set(clave, Date.now());
    try {
      const { data, error } = await supabase.rpc(funcion, parametros);
      if (error) throw error;
      if (data?.ok) cargarRef.current();
      else if (data?.motivo === "sin_numeros") intentosRef.current.set(clave, Date.now() + 60000);
    } catch (error) {
      console.error(`No se pudo llamar a ${funcion}:`, error);
    }
  }, []);

  // Carga inicial + refresco periódico (rápido cuando hay un sorteo cerca).
  useEffect(() => {
    if (!habilitado) {
      edicionesRef.current = [];
      setDirecto(null);
      setProximas([]);
      return undefined;
    }

    let parado = false;
    let temporizador = null;

    const bucle = async () => {
      await cargarRef.current();
      if (parado) return;
      const ahora = Date.now() + offsetRef.current;
      const cerca = edicionesRef.current.some(
        (ed) =>
          (ed.programadoAt && !ed.inicioAt && ed.programadoAt - ahora < VENTANA_RAPIDA_MS) ||
          (ed.inicioAt && ahora < ed.inicioAt + SORTEO_VISTA_MS)
      );
      temporizador = window.setTimeout(bucle, cerca ? REFRESCO_RAPIDO_MS : REFRESCO_LENTO_MS);
    };
    bucle();

    const alVolver = () => {
      if (document.visibilityState === "visible") cargarRef.current();
    };
    document.addEventListener("visibilitychange", alVolver);

    // Tiempo real: cualquier cambio en las cuadrículas refresca al instante.
    const canal = supabase
      .channel(`sorteo-directo-${modo}-${token || "tv"}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sorteo_editions" }, () => {
        cargarRef.current();
      })
      .subscribe();

    return () => {
      parado = true;
      if (temporizador) window.clearTimeout(temporizador);
      document.removeEventListener("visibilitychange", alVolver);
      supabase.removeChannel(canal);
    };
  }, [habilitado, modo, token]);

  // Reloj de 1 s: dispara el arranque a la hora, cierra el sorteo al
  // terminar la animación y decide qué se ve. No provoca repintados si
  // nada cambia.
  useEffect(() => {
    if (!habilitado) return undefined;

    const tic = window.setInterval(() => {
      const ahora = Date.now() + offsetRef.current;

      edicionesRef.current.forEach((ed) => {
        if (ed.estado === "resuelta" && !ed.inicioAt) return;

        if (!ed.inicioAt && ed.programadoAt && ed.programadoAt <= ahora) {
          intentar(`iniciar:${ed.id}`, "iniciar_sorteo_edition", { p_edition_id: String(ed.id) });
        }

        if (ed.inicioAt && ed.estado !== "resuelta" && ahora >= ed.inicioAt + SORTEO_FIN_MS + 500) {
          intentar(`finalizar:${ed.id}`, "finalizar_sorteo_edition", { p_edition_id: String(ed.id) });
        }
      });

      recalcular();
    }, 1000);

    return () => window.clearInterval(tic);
  }, [habilitado, intentar, recalcular]);

  const cerrar = useCallback(
    (id) => {
      descartadasRef.current.add(id);
      recalcular();
    },
    [recalcular]
  );

  return { directo, proximas, getAhora, cerrar, recargar: () => cargarRef.current() };
}
