// Reglas de la ventana de modificación de un pedido ya enviado.
//
// IMPORTANTE (actualizado): la ventana horaria de abajo YA NO decide si un
// pedido se puede modificar. Ahora un pedido sigue siendo modificable
// mientras el almacén no lo haya exportado a CSV desde el ADMIN > Pedidos
// recibidos (ver pedidoEstaExportado más abajo). calcularVentanaPedido()
// se conserva solo para calcular "diaPreparacion" (con qué día de
// preparación se guarda el pedido en pedidos_actuales / estadísticas),
// no para bloquear la edición.
import { supabase } from "../supabaseClient";

const CUATRO_AM_MINUTOS = 4 * 60;

function obtenerCutoffMinutos(diaSemana) {
  // diaSemana: 0 = domingo ... 6 = sábado
  if (diaSemana === 0) return null; // domingo: sin corte propio
  if (diaSemana === 6) return 13 * 60; // sábado 13:00
  return 7 * 60; // lunes-viernes 7:00
}

function soloFecha(fecha) {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function sumarDias(fecha, dias) {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

/**
 * Calcula, para un momento dado, cuándo se prepara el pedido y, si
 * corresponde, hasta cuándo se puede modificar. Los pedidos hechos antes
 * del corte del día (7:00 entre semana, 13:00 sábado) se preparan ese
 * mismo día y NO son modificables (fechaLimiteEdicion = null).
 *
 * @param {Date} ahora
 * @returns {{ diaPreparacion: Date, fechaLimiteEdicion: Date|null, editable: boolean }}
 */
export function calcularVentanaPedido(ahora = new Date()) {
  const diaSemana = ahora.getDay();
  const cutoffHoy = obtenerCutoffMinutos(diaSemana);
  const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();

  // Caso 1: dentro del horario "de mañana" (>=4:00 y antes del corte del
  // día). Se prepara hoy. Antes esto bloqueaba la edición por completo;
  // ahora ya no hay corte horario, así que sigue siendo editable (lo único
  // que decide si se puede seguir modificando es si el almacén ya lo
  // exportó o no, ver pedidoEstaExportado).
  if (
    cutoffHoy !== null &&
    minutosActuales >= CUATRO_AM_MINUTOS &&
    minutosActuales < cutoffHoy
  ) {
    return {
      diaPreparacion: soloFecha(ahora),
      fechaLimiteEdicion: null,
      editable: true,
    };
  }

  // Caso 2: dentro de la franja modificable (tarde/noche, o madrugada que
  // todavía pertenece a la franja abierta la tarde/noche anterior).
  let diaApertura = new Date(ahora);
  if (minutosActuales < CUATRO_AM_MINUTOS) {
    diaApertura = sumarDias(diaApertura, -1);
  }

  // El día de preparación es el siguiente día natural, saltando el domingo.
  let diaPreparacion = sumarDias(diaApertura, 1);
  if (diaPreparacion.getDay() === 0) {
    diaPreparacion = sumarDias(diaPreparacion, 1);
  }

  const fechaLimiteEdicion = soloFecha(diaPreparacion);
  fechaLimiteEdicion.setHours(4, 0, 0, 0);

  return {
    diaPreparacion: soloFecha(diaPreparacion),
    fechaLimiteEdicion,
    editable: true,
  };
}

/**
 * ¿Sigue dentro de plazo para modificar un pedido cuyo límite de edición
 * es `fechaLimiteEdicion`? Se conserva por compatibilidad, pero YA NO se
 * usa para decidir si un pedido es modificable (ver pedidoEstaExportado).
 * Si es null (pedido "de mañana", no modificable), siempre devuelve false.
 */
export function puedeEditarPedido(fechaLimiteEdicion, ahora = new Date()) {
  if (!fechaLimiteEdicion) return false;
  const limite =
    fechaLimiteEdicion instanceof Date ? fechaLimiteEdicion : new Date(fechaLimiteEdicion);
  if (Number.isNaN(limite.getTime())) return false;
  return ahora.getTime() < limite.getTime();
}

/**
 * Comprueba en Supabase si un pedido (identificado por su pedido_stats_id,
 * que es el mismo id que pedido_id en estadisticas_movimientos) ya fue
 * exportado desde el ADMIN > Pedidos recibidos. Ese es ahora el único
 * criterio para saber si un pedido sigue siendo modificable: mientras no
 * se haya exportado, el cliente puede seguir editándolo, sea la hora que
 * sea y aunque haya pasado a un día de preparación distinto.
 *
 * Sin id (pedidos antiguos guardados antes de tener pedidoStatsId) o ante
 * un fallo de red, se responde con cautela: sin id no hay forma de saber
 * si sigue vigente, así que se trata como exportado (ya no editable); un
 * fallo de red, en cambio, no debe bloquear al cliente, así que se trata
 * como no exportado (sigue editable).
 */
export async function pedidoEstaExportado(pedidoStatsId) {
  if (!pedidoStatsId) return true;
  try {
    const { data, error } = await supabase
      .from("pedidos_exportados")
      .select("pedido_id")
      .eq("pedido_id", pedidoStatsId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  } catch (error) {
    console.error("No se pudo comprobar si el pedido ya fue exportado:", error);
    return false;
  }
}

