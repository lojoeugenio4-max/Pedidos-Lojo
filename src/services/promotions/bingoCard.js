const COLUMN_RANGES = [
  [1, 9],
  [10, 19],
  [20, 29],
  [30, 39],
  [40, 49],
  [50, 59],
  [60, 69],
  [70, 79],
  [80, 90],
];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [
      result[randomIndex],
      result[index],
    ];
  }

  return result;
}

function range(start, end) {
  return Array.from(
    { length: end - start + 1 },
    (_, index) => start + index
  );
}

/**
 * Genera las posiciones ocupadas de un cartón:
 * - 3 filas
 * - 9 columnas
 * - 5 números por fila
 * - 15 números en total
 * - al menos 1 número por columna
 */
function generateOccupiedPositions() {
  const matrix = Array.from({ length: 3 }, () => Array(9).fill(false));

  // Garantizamos una casilla ocupada en cada columna.
  for (let column = 0; column < 9; column += 1) {
    const row = Math.floor(Math.random() * 3);
    matrix[row][column] = true;
  }

  const rowCounts = matrix.map(
    (row) => row.filter(Boolean).length
  );

  // Añadimos casillas hasta que cada fila tenga exactamente 5.
  while (rowCounts.some((count) => count < 5)) {
    const availableRows = rowCounts
      .map((count, row) => ({ count, row }))
      .filter(({ count }) => count < 5)
      .map(({ row }) => row);

    const row = randomItem(availableRows);

    const availableColumns = matrix[row]
      .map((occupied, column) => ({ occupied, column }))
      .filter(({ occupied }) => !occupied)
      .map(({ column }) => column);

    if (availableColumns.length === 0) {
      continue;
    }

    const column = randomItem(availableColumns);
    matrix[row][column] = true;
    rowCounts[row] += 1;
  }

  return matrix;
}

/**
 * Genera un cartón clásico de Bingo de 90 bolas.
 */
export function generateBingoCard() {
  const occupiedPositions = generateOccupiedPositions();

  const rows = Array.from({ length: 3 }, () =>
    Array.from({ length: 9 }, () => null)
  );

  for (let column = 0; column < 9; column += 1) {
    const occupiedRows = occupiedPositions
      .map((row, rowIndex) => ({
        occupied: row[column],
        rowIndex,
      }))
      .filter(({ occupied }) => occupied)
      .map(({ rowIndex }) => rowIndex);

    const [start, end] = COLUMN_RANGES[column];

    const selectedNumbers = shuffle(range(start, end))
      .slice(0, occupiedRows.length)
      .sort((a, b) => a - b);

    occupiedRows
      .sort((a, b) => a - b)
      .forEach((rowIndex, numberIndex) => {
        rows[rowIndex][column] = {
          number: selectedNumbers[numberIndex],
          marked: false,
        };
      });
  }

  return {
    id: crypto.randomUUID(),
    status: "active",
    rows,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}
export function markNumber(card, number) {
  let marked = false;

  const rows = card.rows.map((row) =>
    row.map((cell) => {
      if (!cell) return null;

      if (cell.number === number) {
        marked = true;

        return {
          ...cell,
          marked: true,
        };
      }

      return cell;
    })
  );

  return {
    ...card,
    rows,
    marked,
  };
}
export function hasLine(card) {
  return card.rows.some((row) => {
    const cells = row.filter(Boolean);

    return (
      cells.length > 0 &&
      cells.every((cell) => cell.marked)
    );
  });
}
export function hasBingo(card) {
  const cells = card.rows
    .flat()
    .filter(Boolean);

  return (
    cells.length === 15 &&
    cells.every((cell) => cell.marked)
  );
}