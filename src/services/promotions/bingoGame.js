import {
  generateBingoCard,
  markNumber,
  hasLine,
  hasBingo,
} from "./bingoCard";

import {
  createBingoDrum,
  drawBingoNumber,
} from "./bingoDrum";

export function createBingoGame(customerId) {
  return {
    customerId,
    status: "active",
    card: generateBingoCard(),
    drum: createBingoDrum(),
    lineCompleted: false,
    bingoCompleted: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

export function playBingoTurn(game) {
  if (!game || game.status !== "active") {
    return {
      game,
      number: null,
      error: "game_not_active",
    };
  }

  const drawResult = drawBingoNumber(game.drum);

  if (drawResult.number === null) {
    return {
      game: {
        ...game,
        status: "finished",
      },
      number: null,
      error: "drum_empty",
    };
  }

  const updatedCard = markNumber(
    game.card,
    drawResult.number
  );

  const lineCompleted =
    game.lineCompleted || hasLine(updatedCard);

  const bingoCompleted = hasBingo(updatedCard);

  return {
    number: drawResult.number,

    game: {
      ...game,
      card: updatedCard,
      drum: drawResult.drum,
      lineCompleted,
      bingoCompleted,
      status: bingoCompleted ? "completed" : "active",
      completedAt: bingoCompleted
        ? new Date().toISOString()
        : null,
    },
  };
}