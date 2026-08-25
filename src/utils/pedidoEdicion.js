// Reglas de la ventana de modificación de un pedido ya enviado.
//
// Resumen del negocio (confirmado con el cliente):
// - Entre semana (lunes a viernes): lo recibido antes de las 7:00 se
//   prepara ESE MISMO día y NO es modificable. Lo recibido desde las
//   7:00 se prepara al día siguiente -> editable hasta las 4:00 AM del
//   día siguiente.
// - Sábado: lo recibido antes de las 13:00 se prepara ESE MISMO sábado y
//   NO es modificable. Lo recibido desde las 13:00 se prepara el LUNES
//   (el domingo no cuenta) -> editable hasta las 4:00 AM del lunes.
// - Domingo: no hay preparación propia; todo lo recibido el domingo se
//   prepara el lunes -> editable hasta las 4:00 AM del lunes.
// - Pedidos de madrugada (antes de las 4:00 AM): pertenecen todavía a la
//   ventana editable abierta la tarde/noche anterior, así que mantienen
//   el límite de esa ventana (aunque sean solo un par de horas).
//
// En resumen, SOLO son modificables los pedidos hechos dentro de estas
// dos franjas: de 7:00 a 4:00 AM (entre semana) y de 13:00 del sábado a
// 4:00 AM del lunes. Los pedidos hechos "de mañana muy temprano" (antes
// del corte) no se pueden modificar en ningún caso.

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
  // día). Se prepara hoy y NO se puede modificar.
  if (
    cutoffHoy !== null &&
    minutosActuales >= CUATRO_AM_MINUTOS &&
    minutosActuales < cutoffHoy
  ) {
    return {
      diaPreparacion: soloFecha(ahora),
      fechaLimiteEdicion: null,
      editable: false,
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
 * es `fechaLimiteEdicion`? Si es null (pedido "de mañana", no
 * modificable), siempre devuelve false.
 */
export function puedeEditarPedido(fechaLimiteEdicion, ahora = new Date()) {
  if (!fechaLimiteEdicion) return false;
  const limite =
    fechaLimiteEdicion instanceof Date ? fechaLimiteEdicion : new Date(fechaLimiteEdicion);
  if (Number.isNaN(limite.getTime())) return false;
  return ahora.getTime() < limite.getTime();
}

