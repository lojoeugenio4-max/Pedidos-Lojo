// Lógica de detección de línea y bingo, compartida entre el cartón del
// cliente (BingoCard.jsx) y el TPV (StorePage.jsx, para saber si hay que
// celebrar un premio nada más salir la bola). Vive aquí para que las dos
// partes calculen exactamente lo mismo y no se puedan desincronizar.

export function normalizarNumeros(numbers) {
  return new Set(Array.isArray(numbers) ? numbers.map(Number).filter(Number.isFinite) : []);
}

export function normalizarFilas(card) {
  if (!Array.isArray(card)) return [];
  return card.slice(0, 3).map((row) => {
    const fila = Array.isArray(row) ? row.slice(0, 9) : [];
    return [...fila, ...Array(Math.max(0, 9 - fila.length)).fill(null)].slice(0, 9);
  });
}

export function tieneLinea(rows, markedNumbers) {
  return rows.some((row) => {
    const nums = row.map(Number).filter(Number.isFinite);
    return nums.length > 0 && nums.every((number) => markedNumbers.has(number));
  });
}

export function tieneBingo(rows, markedNumbers) {
  const nums = rows.flat().map(Number).filter(Number.isFinite);
  return nums.length > 0 && nums.every((number) => markedNumbers.has(number));
}

// Calcula qué premios están conseguidos ahora mismo para un cartón y un
// histórico de bolas dados. promo debe traer los campos
// premio_*_activo / premio_*_max_bolas tal como están en promociones_bingo.
export function calcularPremiosConseguidos(card, drawnNumbers, promo) {
  const rows = normalizarFilas(card);
  const marked = normalizarNumeros(drawnNumbers);
  const drawnCount = marked.size;

  const lineCompleted = tieneLinea(rows, marked);
  const bingoCompleted = tieneBingo(rows, marked);

  const lineSpecialActivo = Boolean(promo?.premio_linea_especial_activo);
  const lineSpecialMax = Number(promo?.premio_linea_especial_max_bolas) || 0;
  const specialActivo = Boolean(promo?.premio_especial_activo);
  const specialMax = Number(promo?.premio_especial_max_bolas) || 0;

  return {
    linea: lineCompleted,
    lineaEspecial: Boolean(
      lineCompleted && lineSpecialActivo && lineSpecialMax > 0 && drawnCount <= lineSpecialMax
    ),
    bingo: bingoCompleted,
    bingoEspecial: Boolean(
      bingoCompleted && specialActivo && specialMax > 0 && drawnCount <= specialMax
    ),
  };
}
