function shuffle(numbers) {
  const result = [...numbers];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));

    [result[index], result[randomIndex]] = [
      result[randomIndex],
      result[index],
    ];
  }

  return result;
}

export function createBingoDrum() {
  const numbers = Array.from(
    { length: 90 },
    (_, index) => index + 1
  );

  return {
    remainingNumbers: shuffle(numbers),
    drawnNumbers: [],
  };
}

export function drawBingoNumber(drum) {
  if (!drum?.remainingNumbers?.length) {
    return {
      drum,
      number: null,
      finished: true,
    };
  }

  const [number, ...remainingNumbers] =
    drum.remainingNumbers;

  return {
    number,
    finished: remainingNumbers.length === 0,
    drum: {
      remainingNumbers,
      drawnNumbers: [
        ...drum.drawnNumbers,
        number,
      ],
    },
  };
}