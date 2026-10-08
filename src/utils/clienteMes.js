// CLIENTE DEL MES · carrera de puntos.
//
// Los puntos se calculan en el servidor (cliente_mes_clasificacion) a partir
// de los pedidos enviados por la App: 5 / 3 / 1 puntos por pedido según lo
// que lleve, y solo suma 1 pedido cada 12 horas. Gana quien más puntos
// tenga al terminar el mes.
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

// "Podrás volver a sumar a partir de las 12:27." (o "mañana a las 0:27.")
export function textoProximoClienteMes(proximoIso) {
  if (!proximoIso) return "Solo suma un pedido cada 12 horas.";
  const fecha = new Date(proximoIso);
  if (Number.isNaN(fecha.getTime()) || fecha.getTime() <= Date.now()) return "";
  const zona = { timeZone: "Europe/Madrid" };
  const hora = fecha.toLocaleTimeString("es-ES", { ...zona, hour: "2-digit", minute: "2-digit" });
  const dia = (d) => d.toLocaleDateString("en-CA", zona);
  const manana = new Date(Date.now() + 24 * 3600 * 1000);
  const cuando = dia(fecha) === dia(new Date()) ? "hoy" : dia(fecha) === dia(manana) ? "mañana" : "";
  return `Podrás volver a sumar ${cuando ? cuando + " " : ""}a partir de las ${hora}.`;
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

// Puntos que vale un pedido (misma regla que _cliente_mes_puntos_pedido en
// el servidor, que es quien decide de verdad al pasar el QR):
//  - nivel alto (5): N artículos distintos con 1+ caja, o M artículos con K+ uds
//  - nivel medio (3): lo mismo con los números del nivel medio
//  - base (1): cualquier otro pedido hecho por la App
export function puntosPedidoClienteMes(items, d) {
  if (!d?.visible || !d?.empezado || !Array.isArray(items)) return 0;
  const porArticulo = new Map();
  items.forEach((item) => {
    const clave = String(item?.product?.id ?? item?.product?.codigo_lojo ?? item?.product?.name ?? "");
    if (!clave) return;
    const actual = porArticulo.get(clave) || { cajas: 0, unidades: 0 };
    actual.cajas += Number(item.boxes || 0);
    actual.unidades += Number(item.units || 0);
    porArticulo.set(clave, actual);
  });
  const lista = [...porArticulo.values()].filter((a) => a.cajas > 0 || a.unidades > 0);
  if (!lista.length) return 0;
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
