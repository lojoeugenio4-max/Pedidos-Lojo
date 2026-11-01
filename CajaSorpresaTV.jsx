// CLIENTE DEL MES · CAJA SORPRESA a pantalla completa en la TV grande.
// Sale (al azar) a los clientes que van atrás, después de la celebración
// normal y, si lo hay, del repostaje.
//
//  1. CAE      una caja ❓ gigante cae del cielo y rebota (golpe).
//  2. TIEMBLA  redoble: la caja tiembla cada vez más y echa chispas.
//  3. SE ABRE  ¡PLOF! salta la tapa y sale disparada una ruleta de números.
//  4. SE PARA  la ruleta frena y se para en los puntos de regalo:
//              "+7 PUNTOS SORPRESA", total, puesto, fuegos y confeti.
import { useEffect, useRef, useState } from "react";
import { CAJA_CM } from "../../utils/clienteMes";
import {
  sonidoAbrirCofre,
  sonidoEntradaPuntos,
  sonidoFuegos,
  sonidoGolpe,
  sonidoMoneda,
  sonidoTemblor,
  sonidoVictoria,
} from "../../utils/sonido8bits";

const COLORES = ["#ffe14d", "#ff3d7f", "#00e5ff", "#76ff03", "#d500f9", "#ff9100"];
const MEDALLAS = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function CajaSorpresaTV({ celebracion, onFin }) {
  const extra = Math.max(1, Math.round(Number(celebracion?.caja_extra) || 1));
  const totalFinal = Number(celebracion?.total) || 0;
  const posicion = Number(celebracion?.posicion) || null;
  const nombre = celebracion?.nombre || "CLIENTE";

  const [fase, setFase] = useState("cae"); // cae -> tiembla -> abre -> final
  const [numero, setNumero] = useState(0);
  const [saliendo, setSaliendo] = useState(false);
  const onFinRef = useRef(onFin);
  onFinRef.current = onFin;

  useEffect(() => {
    const t = [];
    const en = (ms, fn) => t.push(window.setTimeout(fn, ms));

    en(60, sonidoEntradaPuntos);
    en(CAJA_CM.cae + 700, () => sonidoGolpe());
    en(CAJA_CM.cae + 1150, () => sonidoGolpe());
    en(CAJA_CM.tiembla, () => {
      setFase("tiembla");
      sonidoTemblor(1.8);
    });
    en(CAJA_CM.abre, () => {
      setFase("abre");
      sonidoAbrirCofre(1);
    });

    // Ruleta de números: cada vez más lenta hasta pararse en "extra".
    const ruleta = CAJA_CM.para - CAJA_CM.abre - 200;
    const pasos = 18;
    let acumulado = 0;
    for (let i = 0; i < pasos; i += 1) {
      acumulado += (ruleta / pasos) * (0.35 + (1.3 * i) / pasos);
      const valor = i === pasos - 1 ? extra : ((i * 7 + 3) % 10) + 1;
      en(CAJA_CM.abre + 200 + Math.min(acumulado, ruleta), () => {
        setNumero(valor);
        sonidoMoneda();
      });
    }

    en(CAJA_CM.para, () => {
      setNumero(extra);
      setFase("final");
      sonidoVictoria();
    });
    en(CAJA_CM.para + 700, () => sonidoFuegos(6));
    en(CAJA_CM.para + 3000, () => sonidoFuegos(4));
    en(CAJA_CM.total - 800, () => setSaliendo(true));
    en(CAJA_CM.total, () => onFinRef.current?.());
    return () => t.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebracion?.id]);

  return (
    <div className={`csp-raiz csp-fase-${fase}${saliendo ? " csp-saliendo" : ""}`}>
      <EstilosCaja />
      <div className="csp-rayos" aria-hidden="true" />
      <div className="csp-scanlines" aria-hidden="true" />
      <div className="csp-flash" aria-hidden="true" key={fase} />

      <header className="csp-cabecera">
        <div className="csp-marquesina">★ CLIENTE DEL MES ★ CAJA SORPRESA ★</div>
        <div className="csp-nombre">{nombre}</div>
      </header>

      <div className="csp-escena">
        {fase !== "final" && (
          <div className="csp-titulo">{fase === "abre" ? "¡¿CUÁNTOS PUNTOS?!" : "¡HA SALIDO UNA CAJA SORPRESA!"}</div>
        )}

        <div className="csp-caja-zona">
          <div className="csp-caja">
            <div className="csp-tapa">❓</div>
            <div className="csp-cuerpo">
              <span>?</span>
            </div>
            {fase === "tiembla" &&
              Array.from({ length: 10 }, (_, i) => (
                <span key={i} className="csp-chispa" style={{ "--a": `${i * 36}deg`, animationDelay: `${(i % 5) * 0.12}s` }} />
              ))}
          </div>

          {(fase === "abre" || fase === "final") && (
            <div className={`csp-numero${fase === "final" ? " csp-numero-fijo" : ""}`} key={fase === "final" ? "fijo" : numero}>
              +{numero}
            </div>
          )}
        </div>

        {fase === "final" && (
          <div className="csp-final">
            <div className="csp-final-palabra">{extra === 1 ? "PUNTO SORPRESA" : "PUNTOS SORPRESA"}</div>
            {totalFinal > 0 && (
              <div className="csp-final-total">
                TOTAL <strong>{totalFinal}</strong> PUNTOS
              </div>
            )}
            {posicion && (
              <div className={`csp-final-puesto${posicion === 1 ? " csp-final-lider" : ""}`}>
                {posicion === 1 ? "👑 ¡VA LÍDER! 👑" : `${MEDALLAS[posicion] || "🏁"} VA ${posicion}º EN LA CARRERA`}
              </div>
            )}
            <div className="csp-final-app">📱 ¡Pide por la App y a por la próxima caja!</div>
          </div>
        )}
      </div>

      {fase === "final" && (
        <>
          {Array.from({ length: 6 }, (_, f) => (
            <div
              key={`fw-${f}`}
              className="csp-fuego"
              style={{ left: `${[12, 86, 28, 72, 50, 18][f]}%`, top: `${[24, 22, 10, 12, 6, 62][f]}%` }}
            >
              {Array.from({ length: 22 }, (_, i) => (
                <span
                  key={i}
                  style={{ "--a": `${i * 16.4}deg`, background: COLORES[(f + i) % COLORES.length], animationDelay: `${0.6 + f * 0.5}s` }}
                />
              ))}
            </div>
          ))}
          {Array.from({ length: 60 }, (_, i) => (
            <span
              key={`cf-${i}`}
              className="csp-confeti"
              style={{
                left: `${(i * 41) % 100}%`,
                background: COLORES[i % COLORES.length],
                animationDelay: `${(i % 10) * 0.16}s`,
                animationDuration: `${2.4 + (i % 5) * 0.4}s`,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

function EstilosCaja() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rubik:wght@800;900&display=swap');

.csp-raiz{ position:fixed; inset:0; z-index:9000; overflow:hidden; color:#fff; font-family:'Rubik',system-ui,sans-serif;
  background:radial-gradient(ellipse at 50% 45%,#0f5d4a 0%,#06302a 45%,#020f0d 100%); animation:cspEntra .35s ease-out both;
  display:flex; flex-direction:column; align-items:center; padding:3vh 3vw; box-sizing:border-box; }
.csp-saliendo{ animation:cspSale .8s ease-in forwards; }
@keyframes cspEntra{ from{opacity:0} to{opacity:1} }
@keyframes cspSale{ to{opacity:0; transform:scale(1.04)} }
.csp-rayos{ position:absolute; left:50%; top:55%; width:260vmax; height:260vmax; margin:-130vmax 0 0 -130vmax; pointer-events:none; opacity:.2;
  background:repeating-conic-gradient(from 0deg,#76ff03 0 6deg,transparent 6deg 18deg); animation:cspGira 12s linear infinite; }
.csp-fase-final .csp-rayos{ opacity:.35; animation-duration:5s; background:repeating-conic-gradient(from 0deg,#ffe14d 0 6deg,transparent 6deg 18deg); }
@keyframes cspGira{ to{transform:rotate(360deg)} }
.csp-scanlines{ position:absolute; inset:0; pointer-events:none; z-index:50; opacity:.16;
  background:repeating-linear-gradient(0deg,rgba(0,0,0,.6) 0 2px,transparent 2px 4px); }
.csp-flash{ position:absolute; inset:0; background:#fff; pointer-events:none; z-index:40; animation:cspFlash .5s ease-out both; }
@keyframes cspFlash{ from{opacity:.85} to{opacity:0} }

.csp-cabecera{ position:relative; z-index:5; text-align:center; width:100%; }
.csp-marquesina{ font-family:'Press Start 2P',monospace; font-size:clamp(12px,1.5vw,28px); color:#b2ff59; letter-spacing:.3em;
  text-shadow:0 0 12px #76ff03; animation:cspParpadeo .5s steps(2) infinite; }
@keyframes cspParpadeo{ 50%{opacity:.35} }
.csp-nombre{ margin-top:1.4vh; font-weight:900; font-size:clamp(28px,5vw,100px); line-height:1.02; color:#ffe14d; text-transform:uppercase;
  text-shadow:5px 5px 0 #ff2d75,10px 10px 0 rgba(0,0,0,.5); max-width:94vw; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.csp-escena{ position:relative; z-index:5; flex:1; width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3vh; }
.csp-titulo{ font-family:'Press Start 2P',monospace; font-size:clamp(16px,2.4vw,46px); text-align:center; text-shadow:4px 4px 0 #00695c;
  animation:cspZoom .5s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes cspZoom{ from{transform:scale(0); opacity:0} to{transform:scale(1); opacity:1} }

.csp-caja-zona{ position:relative; display:grid; place-items:center; width:min(46vh,40vw); aspect-ratio:1; }
.csp-fase-final .csp-escena{ gap:2vh; justify-content:flex-start; padding-top:2vh; }
.csp-fase-final .csp-caja-zona{ width:min(28vh,26vw); transition:width .5s; }
.csp-fase-final .csp-numero{ font-size:min(18vh,16vw); }
.csp-caja{ position:relative; width:100%; height:100%; animation:cspCae 1.4s cubic-bezier(.3,1.6,.5,1) both; }
@keyframes cspCae{ 0%{transform:translateY(-90vh) rotate(-20deg)} 50%{transform:translateY(0) rotate(4deg)} 65%{transform:translateY(-8vh) rotate(-2deg)} 80%{transform:none} 90%{transform:translateY(-2vh)} 100%{transform:none} }
.csp-cuerpo{ position:absolute; inset:22% 4% 0 4%; border-radius:3vh; display:grid; place-items:center;
  background:linear-gradient(180deg,#ffd54f,#ff9100); border:1vh solid #fff3c4; box-shadow:inset 0 -3vh 0 rgba(0,0,0,.18),0 3vh 5vh rgba(0,0,0,.55),0 0 8vh rgba(255,213,79,.6); }
.csp-cuerpo span{ font-family:'Press Start 2P',monospace; font-size:min(20vh,17vw); color:#fff; text-shadow:1vh 1vh 0 #c43e00; }
.csp-tapa{ position:absolute; left:0; right:0; top:4%; height:24%; border-radius:2.4vh; display:grid; place-items:center; z-index:2;
  font-size:min(8vh,7vw); background:linear-gradient(180deg,#ffe082,#ffb300); border:1vh solid #fff3c4; box-shadow:0 1.4vh 0 rgba(0,0,0,.2); }
.csp-fase-tiembla .csp-caja{ animation:cspTiembla .12s linear infinite; }
@keyframes cspTiembla{ 0%{transform:translate(-1.2vh,0) rotate(-3deg)} 50%{transform:translate(1.2vh,-.6vh) rotate(3deg)} 100%{transform:translate(-1.2vh,0) rotate(-3deg)} }
.csp-fase-abre .csp-tapa,.csp-fase-final .csp-tapa{ animation:cspTapa .9s cubic-bezier(.2,1.3,.4,1) forwards; }
@keyframes cspTapa{ to{transform:translate(32vw,-60vh) rotate(260deg); opacity:0} }
.csp-fase-abre .csp-cuerpo span,.csp-fase-final .csp-cuerpo span{ opacity:0; transition:opacity .2s; }
.csp-fase-final .csp-caja{ opacity:.35; filter:blur(2px); transition:all .6s; }
.csp-chispa{ position:absolute; left:50%; top:50%; width:2.4vh; height:2.4vh; border-radius:50%; background:#fff; box-shadow:0 0 2vh #ffe14d;
  animation:cspChispaCaja .7s ease-out infinite; }
@keyframes cspChispaCaja{ from{transform:rotate(var(--a)) translateX(18vh); opacity:1} to{transform:rotate(var(--a)) translateX(34vh) scale(.3); opacity:0} }

.csp-numero{ position:absolute; z-index:6; font-family:'Press Start 2P',monospace; font-size:min(24vh,20vw); line-height:1; color:#76ff03;
  text-shadow:1.2vh 1.2vh 0 #1b5e20,0 0 6vh #76ff03; animation:cspNumero .25s ease-out both; }
@keyframes cspNumero{ from{transform:translateY(4vh) scale(.7); opacity:.4} to{transform:none; opacity:1} }
.csp-numero-fijo{ color:#ffe14d; text-shadow:1.2vh 1.2vh 0 #ff2d75,0 0 8vh rgba(255,225,77,.9); animation:cspPum .8s cubic-bezier(.2,1.8,.4,1) both, cspRespira 1s ease-in-out .8s infinite; }
@keyframes cspPum{ 0%{transform:scale(2.4)} 100%{transform:scale(1)} }
@keyframes cspRespira{ 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }

.csp-final{ text-align:center; padding:2.4vh 4vw; border-radius:3vh; background:rgba(2,15,13,.85); border:5px solid #ffe14d;
  box-shadow:0 0 0 5px #ff2d75,0 0 70px rgba(255,225,77,.7); animation:cspZoom .7s cubic-bezier(.2,1.7,.4,1) .2s both; }
.csp-final-palabra{ font-family:'Press Start 2P',monospace; font-size:clamp(18px,3vw,58px); }
.csp-final-total{ font-weight:900; font-size:clamp(20px,2.8vw,56px); margin-top:1.6vh; color:#b2ff59; }
.csp-final-total strong{ color:#fff; font-size:1.3em; }
.csp-final-puesto{ display:inline-block; margin-top:1.8vh; padding:1.2vh 2vw; border-radius:2vh; font-weight:900; font-size:clamp(20px,2.8vw,56px);
  background:linear-gradient(90deg,#00897b,#ff2d75); animation:cspZoom .6s cubic-bezier(.2,1.8,.4,1) .7s both; }
.csp-final-lider{ background:linear-gradient(90deg,#ffb300,#ffe14d,#ffb300); color:#3b1d00; }
.csp-final-app{ margin-top:1.6vh; font-weight:800; font-size:clamp(14px,1.6vw,32px); opacity:.9; }

.csp-fuego{ position:absolute; width:0; height:0; z-index:4; }
.csp-fuego span{ position:absolute; left:0; top:0; width:1.8vh; height:1.8vh; border-radius:50%; opacity:0; animation:cspFuego 1.6s ease-out infinite; }
@keyframes cspFuego{ 0%{opacity:1; transform:rotate(var(--a)) translateX(0) scale(1.4)} 70%{opacity:1} 100%{opacity:0; transform:rotate(var(--a)) translateX(30vh) translateY(6vh) scale(.4)} }
.csp-confeti{ position:absolute; top:-4vh; width:1.4vh; height:2.2vh; border-radius:3px; z-index:4; animation:cspConfeti linear infinite; }
@keyframes cspConfeti{ from{transform:translateY(-4vh) rotate(0)} to{transform:translateY(110vh) rotate(900deg)} }

@media (prefers-reduced-motion:reduce){
  .csp-rayos,.csp-confeti,.csp-fuego span,.csp-chispa{ animation:none !important; }
}
`}</style>
  );
}
