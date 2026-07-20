export function BingoCard({ card, logoSrc }) {
  if (!card?.rows) {
    return null;
  }

  return (
    <article className="bingo-card">
      <header className="bingo-card__header">
        {logoSrc && (
          <img
            className="bingo-card__logo"
            src={logoSrc}
            alt="Cash Lojo"
          />
        )}

        <div className="bingo-card__brand">
          <h2>
            <span>CASH</span> LOJO
          </h2>

          <p>BINGO</p>
        </div>
      </header>

      <div className="bingo-card__grid">
        {card.rows.map((row, rowIndex) =>
          row.map((cell, columnIndex) => (
            <div
              className={[
                "bingo-card__cell",
                !cell ? "bingo-card__cell--empty" : "",
                cell?.marked ? "bingo-card__cell--marked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={`${rowIndex}-${columnIndex}`}
            >
              {cell?.number ?? ""}
            </div>
          ))
        )}
      </div>

      <footer className="bingo-card__footer">
        Juega, disfruta y gana
      </footer>
    </article>
  );
}