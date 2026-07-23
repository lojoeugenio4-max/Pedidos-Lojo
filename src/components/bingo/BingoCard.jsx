import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, Gift, UserRound, Volume2, VolumeX } from "lucide-react";
import logoBingo from "../../assets/logo-bingo.png";
import { normalizarFilas, normalizarNumeros, tieneBingo, tieneLinea } from "../../utils/bingoWinLogic";

let bingoAudioContext = null;

function obtenerAudioContext() {
  if (typeof window === "undefined") return null;
  if (!bingoAudioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    bingoAudioContext = new AudioContextClass();
  }
  return bingoAudioContext;
}

function reproducirTono(frequency, delay = 0, duration = 0.16, volume = 0.09) {
  const context = obtenerAudioContext();
  if (!context) return;

  const startAt = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
}

function reproducirCelebracion(tipo = "numero") {
  const context = obtenerAudioContext();
  if (!context) return;
  context.resume?.().catch(() => {});

  const secuencias = {
    numero: [659, 784, 988],
    linea: [523, 659, 784, 1047],
    bingo: [523, 659, 784, 1047, 1319, 1568],
  };

  (secuencias[tipo] || secuencias.numero).forEach((frequency, index) => {
    reproducirTono(frequency, index * 0.12, tipo === "bingo" ? 0.24 : 0.18, tipo === "bingo" ? 0.12 : 0.09);
  });
}

function PrizePanel({ title, prize, won, special = false }) {
  const active = Boolean(prize?.active);
  const name = active ? prize?.name?.trim() || "Premio configurado" : "Sin premio activo";
  const message = active
    ? prize?.message?.trim() || "Consulta las condiciones del sorteo."
    : "El establecimiento todavía no ha activado este premio.";

  return (
    <section className={`cl-prize ${special ? "cl-prize--special" : ""} ${won ? "cl-prize--won" : ""}`}>
      {special && <div className="cl-prize__badge">★ PREMIO ESPECIAL ★</div>}
      <div className="cl-prize__title">{title}</div>
      <div className="cl-prize__body">
        <div className="cl-prize__media">
          {active && prize?.image ? (
            <img src={prize.image} alt={name} />
          ) : (
            <div className="cl-prize__placeholder"><Gift size={52} /><span>PREMIO</span></div>
          )}
        </div>
        <div className="cl-prize__copy">
          <strong>{name}</strong>
          <p>{message}</p>
          {won && <div className="cl-prize__won"><CheckCircle2 size={18} /> CONSEGUIDO</div>}
        </div>
      </div>
    </section>
  );
}

export default function BingoCard({
  card = [],
  drawnNumbers = [],
  customerName = "",
  linePrize = null,
  lineSpecialPrize = null,
  bingoPrize = null,
  specialPrize = null,
  endDate = "",
}) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [highlightedNumbers, setHighlightedNumbers] = useState([]);
  const [liveMessage, setLiveMessage] = useState("");
  const previousDrawnRef = useRef(null);
  const previousLineRef = useRef(false);
  const previousBingoRef = useRef(false);
  const celebrationTimeoutRef = useRef(null);
  const rows = useMemo(() => normalizarFilas(card), [card]);
  const markedNumbers = useMemo(() => normalizarNumeros(drawnNumbers), [drawnNumbers]);
  const lineCompleted = useMemo(() => tieneLinea(rows, markedNumbers), [rows, markedNumbers]);
  const bingoCompleted = useMemo(() => tieneBingo(rows, markedNumbers), [rows, markedNumbers]);
  const markedCount = rows.flat().filter((value) => Number.isFinite(Number(value)) && markedNumbers.has(Number(value))).length;
  const drawnCount = Array.isArray(drawnNumbers) ? new Set(drawnNumbers.map(Number).filter(Number.isFinite)).size : 0;
  const specialWon = Boolean(bingoCompleted && specialPrize?.active && specialPrize?.maxBalls > 0 && drawnCount <= specialPrize.maxBalls);
  const lineSpecialWon = Boolean(lineCompleted && lineSpecialPrize?.active && lineSpecialPrize?.maxBalls > 0 && drawnCount <= lineSpecialPrize.maxBalls);
  const formattedEndDate = endDate ? new Date(`${endDate}T12:00:00`).toLocaleDateString("es-ES") : "Sin fecha límite";

  useEffect(() => {
    const currentDrawn = normalizarNumeros(drawnNumbers);

    // La primera carga representa el estado ya conocido del cartón y no debe
    // disparar celebraciones antiguas. A partir de ahí solo reaccionamos a bolas nuevas.
    if (previousDrawnRef.current === null) {
      previousDrawnRef.current = currentDrawn;
      previousLineRef.current = lineCompleted;
      previousBingoRef.current = bingoCompleted;
      return;
    }

    const newNumbers = [...currentDrawn].filter(
      (number) => !previousDrawnRef.current.has(number)
    );
    previousDrawnRef.current = currentDrawn;

    const cardNumbers = new Set(
      rows.flat().map(Number).filter(Number.isFinite)
    );
    const matches = newNumbers.filter((number) => cardNumbers.has(number));

    if (matches.length) {
      const achievedBingo = bingoCompleted && !previousBingoRef.current;
      const achievedLine = lineCompleted && !previousLineRef.current;
      const celebrationType = achievedBingo ? "bingo" : achievedLine ? "linea" : "numero";

      setHighlightedNumbers(matches);
      setLiveMessage(
        achievedBingo
          ? "¡BINGO! Has completado tu cartón"
          : achievedLine
            ? "¡LÍNEA! Has completado una línea"
            : matches.length === 1
              ? `¡La bola ${matches[0]} está en tu cartón!`
              : `¡${matches.length} bolas nuevas están en tu cartón!`
      );

      if (soundEnabled) reproducirCelebracion(celebrationType);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(achievedBingo ? [180, 90, 180, 90, 320] : [120, 70, 180]);
      }

      window.clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = window.setTimeout(() => {
        setHighlightedNumbers([]);
        setLiveMessage("");
      }, achievedBingo ? 6500 : 4200);
    }

    previousLineRef.current = lineCompleted;
    previousBingoRef.current = bingoCompleted;
  }, [drawnNumbers, rows, lineCompleted, bingoCompleted, soundEnabled]);

  useEffect(() => () => {
    window.clearTimeout(celebrationTimeoutRef.current);
  }, []);

  function toggleSound() {
    setSoundEnabled((enabled) => {
      const next = !enabled;
      if (next) {
        obtenerAudioContext()?.resume?.().catch(() => {});
        reproducirTono(784, 0, 0.12, 0.07);
      }
      return next;
    });
  }

  return (
    <section className={`cl-bingo ${liveMessage ? "cl-bingo--celebrating" : ""}`} aria-label="Cartón de Bingo Cash Lojo">
      <style>{styles}</style>

      {liveMessage && (
        <div className="cl-live-celebration" role="status" aria-live="assertive">
          <div className="cl-live-celebration__sparkles" aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
          </div>
          <strong>{liveMessage}</strong>
          <span>Tu cartón se ha actualizado en tiempo real</span>
        </div>
      )}

      <header className="cl-bingo__header">
        <div className="cl-brand">
          <div className="cl-brand__logo"><img src={logoBingo} alt="Cash Lojo" /></div>
          <div className="cl-brand__words">
            <div className="cl-brand__name"><span>CASH</span><b>LOJO</b></div>
            <div className="cl-brand__ribbon">BINGO</div>
          </div>
        </div>
      </header>

      <main className="cl-bingo__main">
        <section className="cl-card-area">
          <div className="cl-card-grid">
            {rows.length ? rows.map((row, rowIndex) => (
              <div className="cl-card-row" key={rowIndex}>
                {row.map((value, columnIndex) => {
                  const number = Number(value);
                  const filled = value !== null && value !== undefined && value !== "" && Number.isFinite(number);
                  const marked = filled && markedNumbers.has(number);
                  const justMatched = marked && highlightedNumbers.includes(number);
                  return (
                    <div className={`cl-card-cell ${marked ? "cl-card-cell--marked" : ""} ${justMatched ? "cl-card-cell--new" : ""}`} key={`${rowIndex}-${columnIndex}`}>
                      {filled ? number : ""}
                    </div>
                  );
                })}
              </div>
            )) : <div className="cl-card-empty">No hay ningún cartón disponible.</div>}
          </div>

          <div className="cl-card-actions">
            <div className="cl-card-status"><CheckCircle2 size={23} /> CARTÓN ÚNICO</div>
            <div className={`cl-check ${bingoCompleted ? "cl-check--won" : ""}`}>
              {bingoCompleted ? "¡BINGO!" : lineCompleted ? "¡LÍNEA!" : `${markedCount} NÚMEROS MARCADOS`}
            </div>
            <button type="button" className="cl-sound" onClick={toggleSound} aria-label={soundEnabled ? "Desactivar sonido" : "Activar sonido"}>
              {soundEnabled ? <Volume2 size={27} /> : <VolumeX size={27} />}
            </button>
          </div>
        </section>

        <aside className="cl-prizes" aria-label="Premios del Bingo">
          <PrizePanel title="PREMIO POR LÍNEA" prize={linePrize} won={lineCompleted} />
          {lineSpecialPrize?.active && <PrizePanel special title={`LÍNEA EN ${lineSpecialPrize.maxBalls} BOLAS O MENOS`} prize={lineSpecialPrize} won={lineSpecialWon} />}
          <PrizePanel title="PREMIO POR BINGO" prize={bingoPrize} won={bingoCompleted} />
          {specialPrize?.active && <PrizePanel special title={`BINGO EN ${specialPrize.maxBalls} BOLAS O MENOS`} prize={specialPrize} won={specialWon} />}
        </aside>
      </main>

      <footer className="cl-bingo__footer">
        <div><UserRound /><span><small>JUGADOR:</small><strong>{customerName || "Cliente Cash Lojo"}</strong></span></div>
        <div><Clock3 /><span><small>FECHA LÍMITE:</small><strong>{formattedEndDate}</strong></span></div>
        <div><CheckCircle2 /><span><small>BOLAS CANTADAS:</small><strong>{drawnCount}</strong></span></div>
        <div><Gift /><span><small>PREMIOS:</small><strong>{[linePrize?.active, lineSpecialPrize?.active, bingoPrize?.active, specialPrize?.active].filter(Boolean).length} activos</strong></span></div>
      </footer>
    </section>
  );
}

const styles = `
.cl-bingo, .cl-bingo * { box-sizing: border-box; }
.cl-bingo { position:relative; width:100%; min-width:0; overflow:hidden; border:4px solid #f02620; border-radius:30px; padding:14px; color:#fff; background:radial-gradient(circle at 45% 20%,#0b428d 0,#082d68 30%,#061d4c 72%,#051637 100%); box-shadow:0 20px 55px rgba(0,20,65,.35); font-family:Arial,Helvetica,sans-serif; }

.cl-bingo--celebrating { animation:cl-bingo-glow .75s ease-in-out 3; }
.cl-live-celebration { position:fixed; z-index:10050; left:50%; top:max(18px,env(safe-area-inset-top)); width:min(92vw,520px); transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:5px; overflow:hidden; padding:18px 24px; border:3px solid #fff2a6; border-radius:20px; color:#fff; background:linear-gradient(135deg,#d90f10,#f13b25 55%,#ba0710); box-shadow:0 18px 48px rgba(0,0,0,.45),0 0 0 7px rgba(255,220,82,.22); text-align:center; animation:cl-live-enter .45s cubic-bezier(.2,1.5,.5,1); }
.cl-live-celebration strong { position:relative; z-index:2; font-size:clamp(20px,5vw,30px); line-height:1.1; text-shadow:0 2px 5px rgba(0,0,0,.3); }
.cl-live-celebration span { position:relative; z-index:2; color:#fff9d8; font-weight:800; }
.cl-live-celebration__sparkles { position:absolute; inset:0; pointer-events:none; }
.cl-live-celebration__sparkles i { position:absolute; left:50%; top:50%; width:8px; height:18px; border-radius:4px; background:#ffe56a; transform-origin:0 0; animation:cl-spark 1.25s ease-out infinite; }
.cl-live-celebration__sparkles i:nth-child(3n+2){background:#fff}.cl-live-celebration__sparkles i:nth-child(3n){background:#65e6ff}
.cl-live-celebration__sparkles i:nth-child(1){transform:rotate(0deg) translateY(-18px);animation-delay:0.00s}
.cl-live-celebration__sparkles i:nth-child(2){transform:rotate(20deg) translateY(-18px);animation-delay:0.07s}
.cl-live-celebration__sparkles i:nth-child(3){transform:rotate(40deg) translateY(-18px);animation-delay:0.14s}
.cl-live-celebration__sparkles i:nth-child(4){transform:rotate(60deg) translateY(-18px);animation-delay:0.21s}
.cl-live-celebration__sparkles i:nth-child(5){transform:rotate(80deg) translateY(-18px);animation-delay:0.28s}
.cl-live-celebration__sparkles i:nth-child(6){transform:rotate(100deg) translateY(-18px);animation-delay:0.35s}
.cl-live-celebration__sparkles i:nth-child(7){transform:rotate(120deg) translateY(-18px);animation-delay:0.00s}
.cl-live-celebration__sparkles i:nth-child(8){transform:rotate(140deg) translateY(-18px);animation-delay:0.07s}
.cl-live-celebration__sparkles i:nth-child(9){transform:rotate(160deg) translateY(-18px);animation-delay:0.14s}
.cl-live-celebration__sparkles i:nth-child(10){transform:rotate(180deg) translateY(-18px);animation-delay:0.21s}
.cl-live-celebration__sparkles i:nth-child(11){transform:rotate(200deg) translateY(-18px);animation-delay:0.28s}
.cl-live-celebration__sparkles i:nth-child(12){transform:rotate(220deg) translateY(-18px);animation-delay:0.35s}
.cl-live-celebration__sparkles i:nth-child(13){transform:rotate(240deg) translateY(-18px);animation-delay:0.00s}
.cl-live-celebration__sparkles i:nth-child(14){transform:rotate(260deg) translateY(-18px);animation-delay:0.07s}
.cl-live-celebration__sparkles i:nth-child(15){transform:rotate(280deg) translateY(-18px);animation-delay:0.14s}
.cl-live-celebration__sparkles i:nth-child(16){transform:rotate(300deg) translateY(-18px);animation-delay:0.21s}
.cl-live-celebration__sparkles i:nth-child(17){transform:rotate(320deg) translateY(-18px);animation-delay:0.28s}
.cl-live-celebration__sparkles i:nth-child(18){transform:rotate(340deg) translateY(-18px);animation-delay:0.35s}

.cl-card-cell--new { position:relative; z-index:3; animation:cl-number-hit 1s cubic-bezier(.2,1.6,.4,1) 3; }
.cl-card-cell--new::after { content:"✓"; position:absolute; right:5px; top:5px; width:28px; height:28px; display:grid; place-items:center; border-radius:50%; color:#a50d12; background:#fff4a8; font-size:17px; box-shadow:0 3px 10px rgba(0,0,0,.25); }
@keyframes cl-live-enter { from { opacity:0; transform:translate(-50%,-30px) scale(.8) } to { opacity:1; transform:translate(-50%,0) scale(1) } }
@keyframes cl-spark { 0% { opacity:1; transform:rotate(var(--r,0deg)) translateY(-8px) scale(1) } 100% { opacity:0; margin-left:160px; transform:rotate(var(--r,0deg)) translateY(-70px) scale(.3) } }
@keyframes cl-number-hit { 0% { transform:scale(.78) rotate(-4deg); filter:brightness(1.9) } 45% { transform:scale(1.16) rotate(3deg); box-shadow:inset 0 0 0 7px #fff,0 0 30px 12px rgba(255,224,70,.9) } 100% { transform:scale(1); } }
@keyframes cl-bingo-glow { 50% { box-shadow:0 0 0 8px rgba(255,222,74,.55),0 20px 70px rgba(255,209,36,.55) } }

.cl-bingo__header { min-height:154px; display:flex; align-items:center; justify-content:flex-start; gap:24px; padding:4px 18px 12px; }
.cl-brand { display:flex; align-items:center; gap:24px; min-width:0; }
.cl-brand__logo { width:126px; height:134px; padding:5px; flex:none; overflow:hidden; border:4px solid #fff; border-radius:7px; background:#09235a; }
.cl-brand__logo img { width:100%; height:100%; display:block; object-fit:cover; object-position:center; }
.cl-brand__words { width:min(500px,40vw); min-width:300px; }
.cl-brand__name { white-space:nowrap; font-size:clamp(42px,5.6vw,78px); font-weight:950; font-style:italic; letter-spacing:-4px; line-height:.9; text-shadow:0 2px 1px rgba(0,0,0,.16); }
.cl-brand__name span { color:#fffdf4; } .cl-brand__name b { color:#e91817; margin-left:16px; }
.cl-brand__ribbon { width:100%; margin-top:17px; padding:5px 50px 6px; color:#fff; background:linear-gradient(100deg,#e71919,#ec281b 68%,transparent 69%); clip-path:polygon(9% 0,100% 0,88% 100%,0 100%); text-align:center; font-size:clamp(28px,3vw,43px); font-weight:950; font-style:italic; letter-spacing:10px; line-height:1; }
.cl-bingo__main { display:grid; grid-template-columns:minmax(0,1.42fr) minmax(390px,1fr); gap:12px; padding:10px 0 12px; border-top:1px solid rgba(31,150,232,.55); border-bottom:1px solid rgba(31,150,232,.35); }
.cl-card-area { min-width:0; display:flex; flex-direction:column; gap:16px; padding:0 2px 0 0; }
.cl-card-grid { overflow:hidden; border:5px solid #fff1cd; border-radius:27px; background:#fff9e9; box-shadow:inset 0 0 0 2px #0b3677; }
.cl-card-row { display:grid; grid-template-columns:repeat(9,minmax(0,1fr)); }
.cl-card-cell { min-height:clamp(84px,10.7vw,154px); display:flex; align-items:center; justify-content:center; border-right:2px solid #123b78; border-bottom:2px solid #123b78; color:#050505; background:linear-gradient(120deg,#fffdf6,#fff8e7); font-size:clamp(31px,4.7vw,67px); font-weight:950; line-height:1; transition:.2s ease; }
.cl-card-row:last-child .cl-card-cell { border-bottom:0; } .cl-card-cell:last-child { border-right:0; }
.cl-card-cell--marked { color:#fff; background:radial-gradient(circle,#f24135,#d90f10); box-shadow:inset 0 0 0 6px rgba(255,255,255,.72); text-shadow:0 2px 2px rgba(0,0,0,.25); }
.cl-card-empty { min-height:360px; display:grid; place-items:center; color:#173b75; font-size:20px; font-weight:900; }
.cl-card-actions { display:grid; grid-template-columns:minmax(170px,240px) minmax(220px,1fr) 88px; gap:38px; align-items:center; padding:0 12px 4px; }
.cl-card-status,.cl-check,.cl-sound { height:76px; display:flex; align-items:center; justify-content:center; border:2px solid #f5deb0; border-radius:18px; font-weight:900; }
.cl-card-status { gap:10px; color:#fff; background:linear-gradient(#ef2d25,#d70e12); font-size:18px; }
.cl-check { color:#fff; background:linear-gradient(#708095,#526274); font-size:22px; text-align:center; }
.cl-check--won { background:linear-gradient(#f2261f,#c9070b); }
.cl-sound { width:88px; padding:0; color:#fff; background:#082d6a; cursor:pointer; }
.cl-prizes { min-width:0; display:grid; grid-template-rows:repeat(auto-fit,minmax(160px,1fr)); gap:13px; }
.cl-prize { min-height:250px; display:flex; flex-direction:column; overflow:hidden; border:3px solid #f5dca8; border-radius:25px; padding:10px; background:linear-gradient(#103f83,#092c68); }
.cl-prize__title { padding:2px 8px 12px; text-align:center; font-size:clamp(19px,2.1vw,31px); font-weight:950; }
.cl-prize__body { flex:1; min-height:0; display:grid; grid-template-columns:minmax(170px,40%) 1fr; align-items:center; gap:18px; overflow:hidden; padding:14px 18px; border-radius:20px; color:#090909; background:linear-gradient(120deg,#fffdf5,#fff7e5); }
.cl-prize__media { height:100%; min-height:168px; display:grid; place-items:center; }
.cl-prize__media img { width:100%; height:100%; max-height:205px; display:block; object-fit:contain; }
.cl-prize__placeholder { width:100%; height:100%; min-height:160px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; border-radius:15px; color:#758096; background:#eee8dc; font-weight:900; }
.cl-prize__copy { min-width:0; } .cl-prize__copy strong { display:block; font-size:clamp(20px,2.25vw,34px); line-height:1.1; text-transform:uppercase; overflow-wrap:anywhere; }
.cl-prize__copy p { margin:24px 0 0; font-size:clamp(15px,1.65vw,23px); line-height:1.4; }
.cl-prize__won { width:max-content; max-width:100%; margin-top:15px; display:flex; align-items:center; gap:7px; padding:7px 10px; border-radius:999px; color:#fff; background:#d41016; font-size:13px; font-weight:950; }
.cl-prize--won { box-shadow:0 0 0 4px rgba(255,226,111,.38),0 0 28px rgba(255,221,85,.4); }
.cl-prize--special { position:relative; border:4px solid #ffd34e; background:linear-gradient(145deg,#6a168f 0%,#a82572 42%,#d76a19 100%); box-shadow:0 0 0 3px rgba(255,211,78,.2),0 12px 30px rgba(0,0,0,.3),inset 0 0 24px rgba(255,255,255,.12); }
.cl-prize--special::before { content:""; position:absolute; inset:0; pointer-events:none; background:radial-gradient(circle at 10% 15%,rgba(255,255,255,.34) 0 2px,transparent 3px),radial-gradient(circle at 87% 28%,rgba(255,226,113,.5) 0 3px,transparent 4px),radial-gradient(circle at 72% 82%,rgba(255,255,255,.28) 0 2px,transparent 3px); background-size:48px 48px,66px 66px,58px 58px; }
.cl-prize--special .cl-prize__title { position:relative; color:#fff8c5; text-shadow:0 2px 4px rgba(0,0,0,.45); font-size:clamp(21px,2.25vw,33px); letter-spacing:.4px; }
.cl-prize--special .cl-prize__body { position:relative; min-height:max-content; overflow:visible; align-items:start; border:3px solid #ffd34e; background:linear-gradient(130deg,#fffdf0,#fff0b8); box-shadow:inset 0 0 22px rgba(255,190,30,.18); }
.cl-prize--special .cl-prize__copy strong { color:#75136f; }
.cl-prize__badge { position:relative; z-index:1; width:max-content; max-width:calc(100% - 20px); margin:-2px auto 5px; padding:6px 16px; border:2px solid #fff0a4; border-radius:999px; color:#4f164f; background:linear-gradient(#ffe987,#ffc62d); box-shadow:0 4px 12px rgba(0,0,0,.3); font-size:13px; font-weight:950; letter-spacing:1.6px; text-align:center; }

.cl-bingo__footer { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:8px; padding:16px 18px 2px; border:1px solid rgba(255,244,217,.7); border-radius:18px; background:rgba(2,23,63,.45); }
.cl-bingo__footer > div { min-width:0; display:flex; align-items:center; justify-content:center; gap:15px; } .cl-bingo__footer svg { width:41px; height:41px; flex:none; }
.cl-bingo__footer span { min-width:0; display:flex; flex-direction:column; } .cl-bingo__footer small { font-size:13px; font-weight:900; } .cl-bingo__footer strong { margin-top:4px; overflow:hidden; font-size:18px; font-weight:500; text-overflow:ellipsis; white-space:nowrap; }
@media(max-width:1100px){ .cl-bingo__header{min-height:120px}.cl-brand__logo{width:92px;height:98px}.cl-brand__words{min-width:250px}.cl-bingo__main{grid-template-columns:minmax(0,1.2fr) minmax(330px,1fr)}.cl-prize__body{grid-template-columns:130px 1fr}.cl-card-actions{gap:14px}.cl-bingo__footer strong{font-size:15px} }
@media(max-width:820px){ .cl-bingo{padding:9px;border-radius:20px}.cl-bingo__header{justify-content:center;padding:4px 5px 12px}.cl-bingo__main{grid-template-columns:1fr}.cl-card-cell{min-height:64px}.cl-card-actions{grid-template-columns:1fr 1fr 62px;padding:0;gap:8px}.cl-card-status,.cl-check,.cl-sound{height:58px;border-radius:13px}.cl-sound{width:62px}.cl-prizes{grid-template-columns:1fr 1fr;grid-template-rows:auto}.cl-prize{min-height:260px}.cl-prize__body{grid-template-columns:110px 1fr;padding:10px}.cl-bingo__footer{grid-template-columns:1fr 1fr}.cl-brand__name{letter-spacing:-2px}.cl-brand__ribbon{letter-spacing:6px} }
@media(max-width:560px){ .cl-brand{gap:10px}.cl-brand__logo{width:66px;height:72px;border-width:2px}.cl-brand__words{width:auto;min-width:205px}.cl-brand__name{font-size:34px}.cl-brand__name b{margin-left:7px}.cl-brand__ribbon{margin-top:9px;padding:4px 24px;font-size:22px;letter-spacing:4px}.cl-card-cell{min-height:44px;font-size:22px;border-width:1px}.cl-card-grid{border-width:3px;border-radius:17px}.cl-card-actions{grid-template-columns:1fr 58px}.cl-card-status{display:none}.cl-check{font-size:14px}.cl-prizes{grid-template-columns:1fr}.cl-prize{min-height:230px}.cl-prize__title{font-size:20px}.cl-prize__body{grid-template-columns:105px 1fr}.cl-prize__copy strong{font-size:18px}.cl-prize__copy p{margin-top:10px;font-size:14px}.cl-prize--special{min-height:0;height:auto;overflow:visible;padding-bottom:12px}.cl-prize--special .cl-prize__title{font-size:19px;line-height:1.18;padding:4px 8px 10px}.cl-prize--special .cl-prize__body{min-height:0;height:auto;grid-template-columns:96px minmax(0,1fr);align-items:start;overflow:visible;padding:12px 10px 16px}.cl-prize--special .cl-prize__media{height:auto;min-height:150px}.cl-prize--special .cl-prize__media img{height:150px;max-height:none}.cl-prize--special .cl-prize__copy{padding-bottom:4px}.cl-prize--special .cl-prize__copy strong{font-size:18px;line-height:1.15}.cl-prize--special .cl-prize__copy p{margin:10px 0 0;font-size:14px;line-height:1.35;overflow-wrap:anywhere;white-space:normal}.cl-bingo__footer{grid-template-columns:1fr;padding:12px}.cl-bingo__footer>div{justify-content:flex-start}.cl-bingo__footer svg{width:28px;height:28px} }
`;
