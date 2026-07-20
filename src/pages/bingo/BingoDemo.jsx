import { BingoCard } from "../../components/bingo/BingoCard";
import { generateBingoCard } from "../../services/promotions/bingoCard";

import logo from "../../assets/logo-lojo.jpg";

const demoCard = generateBingoCard();

export default function BingoDemo() {
  return (
    <div
      style={{
        padding: "40px",
        background: "#f2f4f8",
        minHeight: "100vh",
      }}
    >
      <BingoCard
        card={demoCard}
        logoSrc={logo}
      />
    </div>
  );
}