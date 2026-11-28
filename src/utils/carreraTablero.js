// LA LOCA CARRERA DE LOJO · datos comunes del tablero (63 casillas).
// Lo usan el Admin (Villanos y amigos) y la TV grande (CarreraTableroTV).
//
// Casillas fijas del tablero:
//   · 1 = Salida, 63 = Meta (hay que llegar con número exacto).
//   · Casillas de premio: las 5 de siempre (10, 20, 38, 47 y 56) y las que se
//     añadan en Admin → Casillas de premio (tabla carrera_casillas_premio).
//   · 6 casillas Lojo («De Lojo a Lojo y tiro mientras mi pedido recojo»).
//   · 2 casillas Palet («Compro un palet y tiro otra vez»).
//   · Villanos: cada uno sale varias veces (5 por defecto) y cada casilla tiene su % de caída
//     (Admin → Villanos y amigos). Se guardan en carrera_ediciones.villanos_casillas.

export const TOTAL_CASILLAS = 63;
export const CASILLA_SALIDA = 1;
export const CASILLA_META = 63;

// Las 5 casillas de premio de siempre: se crean solas en cada edición y no se
// pueden quitar. Las demás se añaden en el Admin (Casillas de premio).
export const CASILLAS_PREMIO = [10, 20, 38, 47, 56];
export const CASILLA_MITAD = 32;
export const CASILLAS_LOJO = [9, 18, 27, 36, 45, 54];
export const CASILLAS_PALET = [6, 12];

// Clave interna (no cambiar: la usa la base de datos) → datos para pintar.
// «vieja» es Lucas, el del kung fu (antes La Vieja): manda a la Salida.
export const VILLANOS = {
  melon: { nombre: "El Melón Cabezón", corto: "Melón", emoji: "🍈", halloween: "🧙", color: "#16a34a" },
  vieja: { nombre: "Lucas", corto: "Lucas", emoji: "🥋", halloween: "💀", color: "#7c3aed" },
  jubilado: { nombre: "El Jubilado", corto: "Jubilado", emoji: "👴", halloween: "🧛", color: "#b91c1c" },
};
export const ORDEN_VILLANOS = ["melon", "vieja", "jubilado"];

// ---------- Versión del tablero: Halloween o Navidad ----------
// Cada edición lleva su versión (carrera_ediciones.tema). El juego es el mismo
// (mismas claves internas de villanos); solo cambian el tablero de la TV, los
// vídeos y los nombres. En Navidad, «vieja» es Loco Lon y quita casillas
// (castigos_vieja) en vez de mandar a la Salida.
export const TEMAS_CARRERA = {
  halloween: { nombre: "Halloween", emoji: "🎃", ruta: "/loca-carrera/tablero.html" },
  navidad: { nombre: "Navidad", emoji: "🎄", ruta: "/loca-carrera/tablero-navidad.html" },
};
export const esNavidad = (edicion) => edicion?.tema === "navidad";
export const rutaTablero = (edicion) => (esNavidad(edicion) ? TEMAS_CARRERA.navidad : TEMAS_CARRERA.halloween).ruta;

export const VILLANOS_NAVIDAD = {
  melon: { nombre: "El Ogro", corto: "Ogro", emoji: "👹", color: "#16a34a" },
  vieja: { nombre: "Loco Lon", corto: "Loco Lon", emoji: "🎩", color: "#7c3aed" },
  jubilado: { nombre: "El Tacaño", corto: "Tacaño", emoji: "🕰️", color: "#b91c1c" },
};
export const villanosDe = (edicion) => (esNavidad(edicion) ? VILLANOS_NAVIDAD : VILLANOS);
export const HEROES_NAVIDAD = "Papá Noel, Jose Luis y Rafa, Valentín, el Mijita y Elías";

// Posiciones por defecto (5 por villano), repartidas por todo el tablero y
// con más al principio para que haya emoción desde la primera tirada.
export const POSICIONES_VILLANOS_DEFECTO = {
  melon: [4, 14, 24, 35, 44],
  vieja: [8, 22, 31, 41, 58],
  jubilado: [11, 17, 29, 50, 61],
};
export const MAX_CASILLAS_POR_VILLANO = 8;

const PROB_DEFECTO = { melon: 30, vieja: 20, jubilado: 30 };
const PROB_COLUMNA = { melon: "prob_caida_melon", vieja: "prob_vieja", jubilado: "prob_caida_jubilado" };

// Devuelve las posiciones [{ villano, casilla, prob }] en el orden de
// ORDEN_VILLANOS (las que tenga guardadas cada villano). Si un villano no tiene
// ninguna, se usan las de por defecto con el % que tenía ese villano.
export function normalizarVillanosCasillas(edicion) {
  const lista = Array.isArray(edicion?.villanos_casillas) ? edicion.villanos_casillas : [];
  const resultado = [];
  ORDEN_VILLANOS.forEach((villano) => {
    const suyas = lista.filter((v) => v?.villano === villano && Number(v.casilla) > 0);
    const probAntigua = edicion?.[PROB_COLUMNA[villano]] ?? PROB_DEFECTO[villano];
    if (suyas.length) {
      suyas.forEach((v) => resultado.push({ villano, casilla: Number(v.casilla), prob: v.prob ?? probAntigua }));
    } else {
      POSICIONES_VILLANOS_DEFECTO[villano].forEach((casilla) => resultado.push({ villano, casilla, prob: probAntigua }));
    }
  });
  return resultado;
}

// Columnas antiguas (un % por villano): se rellenan con el % de su primera
// posición para que nada que siga leyéndolas se quede sin valor.
export function columnasAntiguasVillanos(posiciones) {
  const primera = (villano) => posiciones.find((p) => p.villano === villano)?.prob ?? PROB_DEFECTO[villano];
  return {
    prob_caida_melon: primera("melon"),
    prob_vieja: primera("vieja"),
    prob_caida_jubilado: primera("jubilado"),
  };
}

// Qué hay en cada casilla (sin contar villanos, que dependen de la edición).
// `premios` = casillas de premio de la edición (por defecto, las 5 de siempre).
export function tipoCasillaFija(n, premios = CASILLAS_PREMIO) {
  if (n === CASILLA_SALIDA) return "salida";
  if (n === CASILLA_META) return "meta";
  if (premios.includes(n) || CASILLAS_PREMIO.includes(n)) return "premio";
  if (CASILLAS_LOJO.includes(n)) return "lojo";
  if (CASILLAS_PALET.includes(n)) return "palet";
  return null;
}

// Mapa casilla → { tipo, villano? } con todo el tablero de una edición.
export function mapaTablero(edicion, premios = CASILLAS_PREMIO) {
  const mapa = {};
  for (let n = 1; n <= TOTAL_CASILLAS; n += 1) {
    const tipo = tipoCasillaFija(n, premios);
    if (tipo) mapa[n] = { tipo };
  }
  normalizarVillanosCasillas(edicion).forEach((p) => {
    if (!mapa[p.casilla]) mapa[p.casilla] = { tipo: "villano", villano: p.villano, prob: p.prob };
  });
  return mapa;
}

// Casilla libre que más lejos queda de todo lo demás (para repartir bien las
// casillas nuevas de premio). null si no queda ninguna libre.
export function casillaLibreRepartida(edicion, premios = CASILLAS_PREMIO) {
  const ocupada = new Set([CASILLA_MITAD, ...normalizarVillanosCasillas(edicion).map((p) => p.casilla)]);
  for (let n = 1; n <= TOTAL_CASILLAS; n += 1) if (tipoCasillaFija(n, premios)) ocupada.add(n);
  let mejor = null;
  let distanciaMejor = -1;
  for (let n = CASILLA_SALIDA + 2; n < CASILLA_META - 1; n += 1) {
    if (ocupada.has(n)) continue;
    let d = 99;
    premios.forEach((p) => { d = Math.min(d, Math.abs(p - n)); });
    if (d > distanciaMejor) { distanciaMejor = d; mejor = n; }
  }
  return mejor;
}

// Parámetro de la URL del tablero con las casillas de premio: "10,15,20,...".
export function parametroPremios(premios) {
  return [...new Set(premios.map(Number).filter((n) => n > CASILLA_SALIDA && n < CASILLA_META))]
    .sort((a, b) => a - b)
    .join(",");
}

// Parámetro de la URL del tablero (public/loca-carrera/tablero.html) con las
// casillas de los villanos: "24:melon:30,44:melon:15,...".
export function parametroVillanos(edicion) {
  return normalizarVillanosCasillas(edicion)
    .map((p) => `${p.casilla}:${p.villano}:${Number(p.prob) || 0}`)
    .join(",");
}
