// Generador del tablero de LojoPoly.
//
// A partir de los grupos (con sus artículos, en orden) y del número de casillas
// especiales configuradas, calcula el tablero cuadrado más pequeño en el que
// caben todas, y la posición de cada casilla alrededor del tablero.
//
// Posición 0 = Salida (esquina inferior derecha). Las posiciones avanzan en el
// sentido de la ficha: fila de abajo hacia la izquierda, columna izquierda hacia
// arriba, fila de arriba hacia la derecha y columna derecha hacia abajo.
//
// Lo usa el Admin para la vista previa y para guardar las posiciones en
// Supabase (lojopoly_guardar_tablero). El servidor solo lee las posiciones
// guardadas, nunca recalcula el tablero.

export const TIPOS_ESPECIALES = {
  salida: { nombre: "Salida", icono: "→" },
  descanso: { nombre: "Descanso", icono: "zZ" },
  suerte: { nombre: "Suerte", icono: "?" },
  suerte_grande: { nombre: "Suerte grande", icono: "★" },
  caja: { nombre: "Caja Lojo", icono: "L" },
};

export const LADO_MINIMO = 5;
export const LADO_MAXIMO = 11;

// Casillas del perímetro de un tablero de n x n.
export const casillasPerimetro = (lado) => 4 * (lado - 1);

// Fila y columna (1..lado) de una posición, para pintar el tablero con CSS grid.
export function filaColumna(posicion, lado) {
  const tramo = lado - 1;
  const i = posicion;
  if (i === 0) return [lado, lado];
  if (i < tramo) return [lado, lado - i];
  if (i === tramo) return [lado, 1];
  if (i < 2 * tramo) return [lado - (i - tramo), 1];
  if (i === 2 * tramo) return [1, 1];
  if (i < 3 * tramo) return [1, 1 + (i - 2 * tramo)];
  if (i === 3 * tramo) return [1, lado];
  return [1 + (i - 3 * tramo), lado];
}

// Intercala dos listas: a, b, a, b...
function intercalar(a, b) {
  const salida = [];
  const largo = Math.max(a.length, b.length);
  for (let i = 0; i < largo; i += 1) {
    if (i < a.length) salida.push(a[i]);
    if (i < b.length) salida.push(b[i]);
  }
  return salida;
}

/**
 * @param {Object} opciones
 * @param {Array<{id:string, orden:number, casillas:Array<{id:string, orden_en_grupo:number}>}>} opciones.grupos
 * @param {number} opciones.casillasSuerte
 * @param {number} opciones.casillasSuerteGrande
 * @param {number} opciones.casillasCaja
 * @returns {{ok:boolean, error?:string, lado?:number, total?:number, celdas?:Array<{posicion:number,tipo:string,casilla_id:string|null,grupo_id:string|null}>, relleno?:number}}
 */
export function generarTablero({
  grupos = [],
  casillasSuerte = 0,
  casillasSuerteGrande = 0,
  casillasCaja = 0,
}) {
  const gruposOrdenados = [...grupos].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

  const propiedades = [];
  gruposOrdenados.forEach((grupo) => {
    [...(grupo.casillas || [])]
      .sort((a, b) => (a.orden_en_grupo ?? 0) - (b.orden_en_grupo ?? 0))
      .forEach((casilla) => {
        propiedades.push({ tipo: "propiedad", casilla_id: casilla.id, grupo_id: grupo.id });
      });
  });

  if (propiedades.length === 0) {
    return { ok: false, error: "Añade al menos un grupo con artículos para generar el tablero." };
  }

  const nSuerte = Math.max(0, Number(casillasSuerte) || 0);
  const nGrande = Math.max(0, Number(casillasSuerteGrande) || 0);
  const nCaja = Math.max(0, Number(casillasCaja) || 0);

  // Salida + Descanso son fijas.
  const necesarias = 2 + propiedades.length + nSuerte + nGrande + nCaja;

  let lado = LADO_MINIMO;
  while (casillasPerimetro(lado) < necesarias && lado < LADO_MAXIMO) lado += 1;

  if (casillasPerimetro(lado) < necesarias) {
    return {
      ok: false,
      error: `Hay demasiadas casillas (${necesarias}). El tablero más grande admite ${casillasPerimetro(LADO_MAXIMO)}. Quita artículos o casillas especiales.`,
    };
  }

  const total = casillasPerimetro(lado);
  const huecosLibres = total - necesarias;

  // Casillas especiales. Los huecos que sobren se rellenan con Caja Lojo y Suerte alternadas.
  const suertes = Array.from({ length: nSuerte }, () => "suerte");
  const cajas = Array.from({ length: nCaja }, () => "caja");
  for (let i = 0; i < huecosLibres; i += 1) {
    if (i % 2 === 0) cajas.push("caja");
    else suertes.push("suerte");
  }

  const tramo = lado - 1;
  const esquinas = [tramo, 2 * tramo, 3 * tramo];

  // Esquinas: Suerte grande, Descanso (enfrente de Salida) y Caja Lojo.
  const especialesEsquina = new Map();
  const grandes = Array.from({ length: nGrande }, () => "suerte_grande");
  especialesEsquina.set(2 * tramo, "descanso");
  if (grandes.length) especialesEsquina.set(tramo, grandes.shift());
  else if (cajas.length) especialesEsquina.set(tramo, cajas.shift());
  else if (suertes.length) especialesEsquina.set(tramo, suertes.shift());
  if (cajas.length) especialesEsquina.set(3 * tramo, cajas.shift());
  else if (suertes.length) especialesEsquina.set(3 * tramo, suertes.shift());
  else if (grandes.length) especialesEsquina.set(3 * tramo, grandes.shift());

  // El resto de especiales, intercalados y repartidos a lo largo del tablero.
  const restoEspeciales = intercalar(intercalar(suertes, cajas), grandes);

  const posicionesNormales = [];
  for (let p = 1; p < total; p += 1) {
    if (!especialesEsquina.has(p)) posicionesNormales.push(p);
  }

  const posicionesEspeciales = new Map(especialesEsquina);
  const libresEnNormales = posicionesNormales.length;
  const cuantos = restoEspeciales.length;
  const usadas = new Set();
  for (let j = 0; j < cuantos; j += 1) {
    let indice = Math.floor(((j + 0.5) * libresEnNormales) / cuantos);
    while (usadas.has(indice)) indice = (indice + 1) % libresEnNormales;
    usadas.add(indice);
    posicionesEspeciales.set(posicionesNormales[indice], restoEspeciales[j]);
  }

  // Las esquinas que no tienen especial (tableros muy justos) las ocupan propiedades.
  const celdas = [{ posicion: 0, tipo: "salida", casilla_id: null, grupo_id: null }];
  let siguientePropiedad = 0;
  for (let p = 1; p < total; p += 1) {
    if (posicionesEspeciales.has(p)) {
      celdas.push({ posicion: p, tipo: posicionesEspeciales.get(p), casilla_id: null, grupo_id: null });
    } else {
      const propiedad = propiedades[siguientePropiedad];
      siguientePropiedad += 1;
      celdas.push({ posicion: p, ...propiedad });
    }
  }

  if (siguientePropiedad !== propiedades.length) {
    return { ok: false, error: "No se han podido colocar todas las casillas. Revisa la configuración." };
  }

  return { ok: true, lado, total, celdas, relleno: huecosLibres };
}

// Comprueba si hay muchas casillas difíciles seguidas. El dado nunca cae en una
// casilla difícil bloqueada; si hubiera 6 seguidas, una tirada podría quedarse
// sin ningún número válido.
export function maximoDificilesSeguidas(celdas, esDificil) {
  if (!celdas?.length) return 0;
  let maximo = 0;
  let actual = 0;
  const vuelta = [...celdas, ...celdas];
  vuelta.forEach((celda) => {
    if (celda.tipo === "propiedad" && esDificil(celda.casilla_id)) {
      actual += 1;
      maximo = Math.max(maximo, actual);
    } else {
      actual = 0;
    }
  });
  return Math.min(maximo, celdas.length);
}
