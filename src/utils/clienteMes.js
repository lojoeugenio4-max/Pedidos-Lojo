// CLIENTE DEL MES · carrera de puntos.
//
// Los puntos se calculan en el servidor (cliente_mes_canjear_qr) al pasar el
// QR en caja (reglas de noviembre 2026):
//  - 5 / 3 / 1 puntos según lo que lleve el pedido, y como mínimo N
//    artículos distintos (si no, 0);
//  - un pedido puntuable por cada DÍA DE PREPARACIÓN (ya no 12 horas);
//  - TURBO según el puesto (×1,5 del 6º, ×2 del 16º);
//  - DEPÓSITO: cada 5 pedidos que suman, +5 de regalo (repostaje);
//  - CAJA SORPRESA para los de atrás (+2 a +10 al azar).
// Gana quien más puntos tenga al terminar el mes.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// "2026-10-01" -> "octubre"
export function nombreMes(isoFecha) {
  if (!isoFecha) return "";
  const mes = Number(String(isoFecha).slice(5, 7));
  return MESES[mes - 1] || "";
}

// Días que quedan del mes (contando hoy), a partir de "hoy" del servidor.
export function diasRestantesMes(hoyIso) {
  if (!hoyIso) return null;
  const [y, m, d] = String(hoyIso).split("-").map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  return ultimo - d + 1;
}

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// "2026-11-03" -> "el martes 3"
export function textoDiaPreparacion(isoFecha) {
  if (!isoFecha) return "";
  const [y, m, d] = String(isoFecha).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  const fecha = new Date(y, m - 1, d);
  return `el ${DIAS_SEMANA[fecha.getDay()]} ${d}`;
}

// Se conserva por compatibilidad: ya no hay espera de 12 horas, se suma
// un pedido por cada día de preparación.
export function textoProximoClienteMes() {
  return "Tu próximo pedido para otro día volverá a sumar.";
}

// 1.5 -> "1,5"; 2 -> "2"
export function textoMultiplicador(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return String(Math.round(v * 100) / 100).replace(".", ",");
}

export async function cargarClasificacionClienteMes({ token = null, mes = null } = {}) {
  const { data, error } = await supabase.rpc("cliente_mes_clasificacion", {
    p_token: token || null,
    p_mes: mes || null,
  });
  if (error) throw error;
  return data;
}

// modo cliente: pasar token. TV / Admin: sin token.
export function useClasificacionClienteMes({ token = null, habilitado = true, refrescoMs = 30000 } = {}) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const vivo = useRef(true);

  const recargar = useCallback(async () => {
    setCargando((c) => c || datos === null);
    try {
      const data = await cargarClasificacionClienteMes({ token });
      if (!vivo.current) return;
      setDatos(data);
      setError("");
    } catch (err) {
      console.error("No se pudo cargar la clasificación del Cliente del mes:", err);
      if (vivo.current) setError("No se ha podido cargar la clasificación.");
    } finally {
      if (vivo.current) setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    vivo.current = true;
    if (!habilitado) return () => { vivo.current = false; };
    recargar();
    const intervalo = refrescoMs ? window.setInterval(recargar, refrescoMs) : null;
    return () => {
      vivo.current = false;
      if (intervalo) window.clearInterval(intervalo);
    };
  }, [habilitado, recargar, refrescoMs]);

  return { datos, cargando, error, recargar };
}

// Artículos distintos del pedido con alguna caja o unidad.
function articulosPedido(items) {
  const porArticulo = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const clave = String(item?.product?.id ?? item?.product?.codigo_lojo ?? item?.product?.name ?? "");
    if (!clave) return;
    const actual = porArticulo.get(clave) || { cajas: 0, unidades: 0 };
    actual.cajas += Number(item.boxes || 0);
    actual.unidades += Number(item.units || 0);
    porArticulo.set(clave, actual);
  });
  return [...porArticulo.values()].filter((a) => a.cajas > 0 || a.unidades > 0);
}

// Cuántos artículos distintos le faltan al pedido para poder sumar (0 = ya llega).
export function faltanArticulosClienteMes(items, d) {
  if (!d?.visible || !Array.isArray(items)) return 0;
  const minimo = Math.max(1, Number(d.min_articulos_puntuar || 1));
  return Math.max(0, minimo - articulosPedido(items).length);
}

// Puntos que vale un pedido SIN turbo (misma regla que _cliente_mes_puntos_pedido
// en el servidor, que es quien decide de verdad al pasar el QR):
//  - menos del mínimo de artículos distintos: 0
//  - nivel alto (5): N artículos distintos con 1+ caja, o M artículos con K+ uds
//  - nivel medio (3): lo mismo con los números del nivel medio
//  - base (1): cualquier otro pedido hecho por la App
export function puntosPedidoClienteMes(items, d) {
  if (!d?.visible || !d?.empezado || !Array.isArray(items)) return 0;
  const lista = articulosPedido(items);
  if (!lista.length) return 0;
  if (lista.length < Math.max(1, Number(d.min_articulos_puntuar || 1))) return 0;
  const conCajas = lista.filter((a) => a.cajas >= 1).length;
  const conUds = (minimo) => lista.filter((a) => a.unidades >= Number(minimo || 1)).length;
  if (conCajas >= Number(d.min_art_cajas) || conUds(d.min_uds_por_articulo) >= Number(d.min_art_unidades)) {
    return Number(d.puntos_alto || 5);
  }
  if (conCajas >= Number(d.medio_art_cajas) || conUds(d.medio_uds_por_articulo) >= Number(d.medio_art_unidades)) {
    return Number(d.puntos_medio || 3);
  }
  return Number(d.puntos_base ?? 1);
}

// Turbo que tiene ahora el cliente (según su puesto). 1 = sin turbo.
export function turboClienteMes(d) {
  const t = Number(d?.yo?.turbo_mult);
  return Number.isFinite(t) && t > 1 ? t : 1;
}

// Puntos del pedido ya con el turbo actual del cliente (aproximado: el
// servidor mira el puesto en el momento de pasar el QR).
export function puntosConTurboClienteMes(items, d) {
  const base = puntosPedidoClienteMes(items, d);
  return base > 0 ? Math.ceil(base * turboClienteMes(d)) : 0;
}

// ---------------------------------------------------------------------
// Celebración en la TV al pasar el QR (CelebracionPuntosTV). El TPV usa la
// misma duración para esperar a que termine antes de seguir con los juegos.
// ---------------------------------------------------------------------
export const CELEBRACION_CM = { intro: 4200, paso: 1600, final: 7500 };

// Pasos que da el carrito: uno por punto (como mucho 10; si fueran más,
// cada paso vale varios puntos). Devuelve lo que suma cada paso.
export function pasosCelebracionClienteMes(puntos) {
  const total = Math.max(1, Math.round(Number(puntos) || 1));
  const n = Math.min(10, total);
  const base = Math.floor(total / n);
  const resto = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}

export function duracionCelebracionClienteMes(puntos) {
  return (
    CELEBRACION_CM.intro +
    pasosCelebracionClienteMes(puntos).length * CELEBRACION_CM.paso +
    CELEBRACION_CM.final
  );
}

// Broma al líder (BromaLiderTV): con «¡ES BROMA!» al final dura más.
export const BROMA_CM = { fin: 13400, revelacion: 18500, conRevelar: 27000, sinRevelar: 19500 };
export function duracionBromaLider(revelar) {
  return revelar ? BROMA_CM.conRevelar : BROMA_CM.sinRevelar;
}

// ---------------------------------------------------------------------
// REPOSTAJE (RepostajeTV) = DEPÓSITO DE CONSTANCIA LLENO: cada pedido que
// suma llena una rayita; al llenar las 5, el servidor regala +5 puntos
// (cliente_mes_canjear_qr devuelve repostaje = true). En la TV sale primero
// la celebración normal con los puntos del pedido, luego una señal de STOP
// con bocinas y sirenas y después el repostaje. El TPV espera lo que duran
// todas las partes.
// ---------------------------------------------------------------------
export const REPOSTAJE_CM = {
  stop: 4200, // señal de STOP con sirenas y bocinas (desde 0)
  reserva: 4400, // ¡DEPÓSITO EN RESERVA!
  boxes: 6700, // entra el surtidor
  engancha: 7800, // manguera puesta
  chorros: 8700, // primer chorro
  paso: 1100, // un chorro = 1 punto
  final: 9500, // desde el último chorro hasta el final
};

export function duracionRepostajeClienteMes(extra = 5) {
  const n = Math.max(1, Math.min(10, Math.round(Number(extra) || 5)));
  return REPOSTAJE_CM.chorros + n * REPOSTAJE_CM.paso + REPOSTAJE_CM.final;
}

// ---------------------------------------------------------------------
// CAJA SORPRESA (CajaSorpresaTV): cae una caja ❓, tiembla, se abre y una
// ruleta de números se para en los puntos de regalo.
// ---------------------------------------------------------------------
export const CAJA_CM = {
  cae: 500, // cae la caja
  tiembla: 2300, // redoble y temblor
  abre: 4300, // se abre
  para: 6600, // la ruleta de números se para
  total: 11500,
};

export function duracionCajaSorpresa() {
  return CAJA_CM.total;
}

// Duración de todo lo que sale en la TV al sumar puntos: la celebración
// normal y, si hay, el STOP + repostaje y la caja sorpresa.
export function duracionAnimacionPuntosClienteMes(resultado) {
  let ms = duracionCelebracionClienteMes(resultado?.puntos);
  if (resultado?.repostaje) ms += duracionRepostajeClienteMes(resultado.puntos_extra);
  if (resultado?.caja) ms += duracionCajaSorpresa();
  return ms;
}
