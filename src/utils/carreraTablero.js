// LA LOCA CARRERA DE LOJO · datos comunes del tablero (63 casillas).
// Lo usan el Admin (Villanos y amigos) y la TV grande (CarreraTableroTV).
//
// Casillas fijas del tablero:
//   · 1 = Salida, 63 = Meta (hay que llegar con número exacto).
//   · 5 casillas de premio (se configuran en Admin → Casillas de premio).
//   · 6 casillas Lojo («De Lojo a Lojo y tiro mientras mi pedido recojo»).
//   · 2 casillas Palet («Compro un palet y tiro otra vez»).
//   · Villanos: cada uno sale 2 veces y cada posición tiene su % de caída
//     (Admin → Villanos y amigos). Se guardan en carrera_ediciones.villanos_casillas.

export const TOTAL_CASILLAS = 63;
export const CASILLA_SALIDA = 1;
export const CASILLA_META = 63;

export const CASILLAS_PREMIO = [10, 20, 38, 47, 56];
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

// Posiciones por defecto (2 por villano). Las primeras son las de siempre
// (24, 31 y 50) para que nada cambie para quien ya conoce el tablero.
export const POSICIONES_VILLANOS_DEFECTO = {
  melon: [24, 44],
  vieja: [31, 58],
  jubilado: [50, 17],
};

const PROB_DEFECTO = { melon: 30, vieja: 20, jubilado: 30 };
const PROB_COLUMNA = { melon: "prob_caida_melon", vieja: "prob_vieja", jubilado: "prob_caida_jubilado" };

// Devuelve siempre 6 posiciones [{ villano, casilla, prob }] (2 por villano,
// en el orden de ORDEN_VILLANOS). Si la edición es antigua y aún no tiene
// villanos_casillas, se montan con las casillas por defecto y el % que
// tenía cada villano.
export function normalizarVillanosCasillas(edicion) {
  const lista = Array.isArray(edicion?.villanos_casillas) ? edicion.villanos_casillas : [];
  const resultado = [];
  ORDEN_VILLANOS.forEach((villano) => {
    const suyas = lista.filter((v) => v?.villano === villano);
    const probAntigua = edicion?.[PROB_COLUMNA[villano]] ?? PROB_DEFECTO[villano];
    [0, 1].forEach((i) => {
      resultado.push({
        villano,
        casilla: Number(suyas[i]?.casilla) || POSICIONES_VILLANOS_DEFECTO[villano][i],
        prob: suyas[i]?.prob ?? probAntigua,
      });
    });
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
export function tipoCasillaFija(n) {
  if (n === CASILLA_SALIDA) return "salida";
  if (n === CASILLA_META) return "meta";
  if (CASILLAS_PREMIO.includes(n)) return "premio";
  if (CASILLAS_LOJO.includes(n)) return "lojo";
  if (CASILLAS_PALET.includes(n)) return "palet";
  return null;
}

// Mapa casilla → { tipo, villano? } con todo el tablero de una edición.
export function mapaTablero(edicion) {
  const mapa = {};
  for (let n = 1; n <= TOTAL_CASILLAS; n += 1) {
    const tipo = tipoCasillaFija(n);
    if (tipo) mapa[n] = { tipo };
  }
  normalizarVillanosCasillas(edicion).forEach((p) => {
    if (!mapa[p.casilla]) mapa[p.casilla] = { tipo: "villano", villano: p.villano, prob: p.prob };
  });
  return mapa;
}

// Parámetro de la URL del tablero (public/loca-carrera/tablero.html) con las
// casillas de los villanos: "24:melon:30,44:melon:15,...".
export function parametroVillanos(edicion) {
  return normalizarVillanosCasillas(edicion)
    .map((p) => `${p.casilla}:${p.villano}:${Number(p.prob) || 0}`)
    .join(",");
}
