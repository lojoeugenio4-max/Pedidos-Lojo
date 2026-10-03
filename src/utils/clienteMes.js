// CLIENTE DEL MES · carrera de puntos.
//
// Los puntos se calculan en el servidor (cliente_mes_clasificacion) a partir
// de los pedidos enviados por la App: X puntos por pedido, solo 1 pedido por
// día y solo si lleva el mínimo de cajas O de unidades sueltas. Gana quien
// más puntos tenga al terminar el mes.
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
