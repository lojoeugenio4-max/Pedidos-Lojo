import React, { useEffect, useState } from "react";
import BingoCard from "../../components/bingo/BingoCard";
import { supabase } from "../../supabaseClient";

const DEFAULT_CODE = "LJ8G37N6";

export default function BingoDemo() {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadBingoFromCode() {
      setLoading(true);
      setErrorMessage("");

      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code") || DEFAULT_CODE;

      const { data: participation, error: participationError } = await supabase
        .from("promotion_participations")
        .select(
          "id, code, customer_phone, customer_name, status, bingo_game_id, bingo_plays_total, bingo_plays_used"
        )
        .eq("code", code)
        .maybeSingle();

      if (participationError) {
        console.error("Error cargando la participación:", participationError);
        setErrorMessage("No se ha podido cargar la participación.");
        setLoading(false);
        return;
      }

      if (!participation) {
        setErrorMessage("No existe ninguna participación con ese código.");
        setLoading(false);
        return;
      }

      if (!participation.bingo_game_id) {
        setErrorMessage("Esta participación no tiene un Bingo asociado.");
        setLoading(false);
        return;
      }

      const { data: bingoGame, error: bingoError } = await supabase
        .from("bingo_games")
        .select(
          "id, customer_phone, status, card, drawn_numbers, line_completed, bingo_completed"
        )
        .eq("id", participation.bingo_game_id)
        .maybeSingle();

      if (bingoError) {
        console.error("Error cargando el Bingo:", bingoError);
        setErrorMessage("No se ha podido cargar el Bingo.");
        setLoading(false);
        return;
      }

      if (!bingoGame) {
        setErrorMessage("No existe el Bingo asociado a esta participación.");
        setLoading(false);
        return;
      }

      setGame({
        ...bingoGame,
        customer_name: participation.customer_name,
        participation_code: participation.code,
      });
      setLoading(false);
    }

    loadBingoFromCode();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        background: "#eef2f8",
        padding: "32px 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 920,
          margin: "0 auto",
        }}
      >
        <header style={{ marginBottom: 24, textAlign: "center" }}>
          <h1
            style={{
              margin: 0,
              color: "#111a8f",
              fontSize: "clamp(28px, 5vw, 46px)",
            }}
          >
            Bingo Cash Lojo
          </h1>

          <p style={{ margin: "8px 0 0", color: "#4b5563", fontSize: 16 }}>
            Código: {game?.participation_code || DEFAULT_CODE}
          </p>
        </header>

        {loading && (
          <div
            style={{
              padding: 30,
              borderRadius: 18,
              background: "#ffffff",
              textAlign: "center",
              fontWeight: 700,
              color: "#111a8f",
            }}
          >
            Cargando Bingo...
          </div>
        )}

        {!loading && errorMessage && (
          <div
            style={{
              padding: 30,
              border: "2px solid #ff2020",
              borderRadius: 18,
              background: "#ffffff",
              textAlign: "center",
              fontWeight: 700,
              color: "#b00020",
            }}
          >
            {errorMessage}
          </div>
        )}

        {!loading && game && (
          <>
            <BingoCard
              card={game.card}
              drawnNumbers={game.drawn_numbers}
              customerName={
                game.customer_name || game.customer_phone || "Cliente"
              }
            />

            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 14,
                background: "#ffffff",
                textAlign: "center",
                color: "#374151",
                fontWeight: 700,
              }}
            >
              Estado: {game.status}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
