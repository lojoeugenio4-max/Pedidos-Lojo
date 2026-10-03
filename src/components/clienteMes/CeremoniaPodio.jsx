// Ceremonia del podio de CLIENTE DEL MES en la pantalla grande.
// "¡Fin de la carrera!" -> podio con tres cofres -> se abren 3º, 2º y 1º
// con sonido de 8 bits -> se queda un rato a la vista -> onFin().
import { useEffect, useRef, useState } from "react";
import CofreAnimado from "./CofreAnimado";
import { nombreMes } from "../../utils/clienteMes";
import { sonidoAbrirCofre, sonidoFinCarrera, sonidoTemblor, sonidoVictoria } from "../../utils/sonido8bits";

const DURACION_TOTAL_MS = 24000;

export default function CeremoniaPodio({ cierre, onFin }) {
  const [fase, setFase] = useState("banner"); // banner -> podio
  const [tiembla, setTiembla] = useState(false);
  const [abiertos, setAbiertos] = useState({});
  const onFinRef = useRef(onFin);
  onFinRef.current = onFin;

  const podio = Array.isArray(cierre?.podio) ? cierre.podio : [];
  const porPuesto = Object.fromEntries(podio.map((p) => [p.posicion, p]));

  useEffect(() => {
    const t = [];
    const despues = (ms, fn) => t.push(window.setTimeout(fn, ms));
    despues(300, sonidoFinCarrera);
    despues(2200, () => setFase("podio"));
    despues(3200, () => {
      setTiembla(true);
      sonidoTemblor(0.95);
    });
    const orden = [3, 2, 1].filter((p) => porPuesto[p]);
    orden.forEach((puesto, i) => {
      despues(4200 + i * 1500, () => {
        setAbiertos((a) => ({ ...a, [puesto]: true }));
        sonidoAbrirCofre(puesto === 1 ? 5 : puesto === 2 ? 0 : -5);
      });
    });
    if (porPuesto[1]) despues(4200 + (orden.length - 1) * 1500 + 900, sonidoVictoria);
    despues(DURACION_TOTAL_MS, () => onFinRef.current?.());
    return () => t.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cierre?.mes, cierre?.cerrado_at]);

  const hayPrimero = Boolean(abiertos[1]);

  return (
    <div className="cp-raiz">
      <EstilosCeremonia />
      <div className="cp-estrellas" />
      <div className={`cp-titulo${fase === "podio" ? " cp-titulo-arriba" : ""}`}>
        CLIENTE DEL MES · {nombreMes(cierre?.mes).toUpperCase()}
      </div>
      {fase === "podio" && <div className="cp-sub">¡ENHORABUENA AL PODIO!</div>}

      <div className={`cp-banner${fase === "banner" ? " cp-banner-visible" : ""}`}>🏁 ¡FIN DE LA CARRERA!</div>

      <div className={`cp-podio${fase === "podio" ? " cp-podio-visible" : ""}`}>
        {[2, 1, 3].map((puesto) => {
          const p = porPuesto[puesto];
          return (
            <div key={puesto} className={`cp-puesto cp-puesto-${puesto}`}>
              {p ? (
                <>
                  <div className="cp-cofre">
                    <CofreAnimado
                      abierto={Boolean(abiertos[puesto])}
                      tiembla={tiembla}
                      premio={p.premio || ""}
                      puesto={puesto}
                      style={{ fontSize: puesto === 1 ? "2.1vw" : "1.7vw" }}
                    />
                  </div>
                  <div className="cp-quien">{p.nombre}</div>
                  <div className="cp-pts">{p.puntos} PTS</div>
                </>
              ) : (
                <div className="cp-vacio">—</div>
              )}
              <div className="cp-peana">{puesto}</div>
            </div>
          );
        })}
      </div>

      {hayPrimero && (
        <div className="cp-confeti">
          {Array.from({ length: 44 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                background: ["#ffe14d", "#ff2d75", "#7cf9ff", "#76ff03", "#d500f9"][i % 5],
                animationDelay: `${((i % 9) * 0.17).toFixed(2)}s`,
                animationDuration: `${(2.6 + (i % 5) * 0.35).toFixed(2)}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EstilosCeremonia() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rubik:wght@700;800;900&display=swap');
.cp-raiz{ position:fixed; inset:0; z-index:50; overflow:hidden; color:#fff; font-family:'Rubik',system-ui,sans-serif;
  background:radial-gradient(ellipse at 50% -10%,#3b1d7a 0%,#160b38 45%,#090418 100%); }
.cp-estrellas{ position:absolute; inset:0; opacity:.5; pointer-events:none;
  background-image:radial-gradient(1.5px 1.5px at 10% 20%,#fff 50%,transparent 51%),radial-gradient(1px 1px at 30% 70%,#fff 50%,transparent 51%),radial-gradient(1.5px 1.5px at 55% 15%,#fff 50%,transparent 51%),radial-gradient(1px 1px at 75% 55%,#fff 50%,transparent 51%),radial-gradient(1.5px 1.5px at 90% 30%,#fff 50%,transparent 51%); }
.cp-titulo{ position:absolute; top:6vh; left:0; right:0; text-align:center; font-family:'Press Start 2P',monospace; font-size:2.8vw; color:#ffe14d; text-shadow:.35vw .35vw 0 #ff2d75; transition:transform .5s; }
.cp-titulo-arriba{ transform:translateY(-2vh); }
.cp-sub{ position:absolute; top:13vh; left:0; right:0; text-align:center; font-family:'Press Start 2P',monospace; font-size:1.2vw; letter-spacing:.3vw; color:#7cf9ff; }
.cp-banner{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%) scale(.4); opacity:0; font-family:'Press Start 2P',monospace; font-size:3.4vw; color:#fff;
  background:#ff2d75; padding:3vh 3vw; border-radius:1.2vw; box-shadow:0 0 0 .5vw #ffe14d,0 0 4vw rgba(255,45,117,.7); white-space:nowrap; transition:all .5s cubic-bezier(.2,1.6,.4,1); }
.cp-banner-visible{ opacity:1; transform:translate(-50%,-50%) scale(1); }
.cp-podio{ position:absolute; left:0; right:0; bottom:0; height:74vh; display:grid; grid-template-columns:repeat(3,1fr); align-items:end; padding:0 9vw; gap:3vw;
  opacity:0; transform:translateY(8%); transition:opacity .7s, transform .7s; }
.cp-podio-visible{ opacity:1; transform:none; }
.cp-puesto{ display:flex; flex-direction:column; align-items:center; }
.cp-cofre{ width:11vw; }
.cp-puesto-1 .cp-cofre{ width:13.5vw; }
.cp-quien{ font-weight:900; font-size:1.9vw; margin-top:1vh; text-align:center; text-shadow:0 .2vw 0 rgba(0,0,0,.6); }
.cp-pts{ font-family:'Press Start 2P',monospace; font-size:1vw; color:#7cf9ff; margin:1vh 0 2vh; }
.cp-vacio{ font-size:3vw; opacity:.4; margin-bottom:2vh; }
.cp-peana{ width:100%; border-radius:1vw 1vw 0 0; display:grid; place-items:start center; padding-top:2vh; font-family:'Press Start 2P',monospace; color:#090418; font-size:3vw;
  background:linear-gradient(180deg,var(--p1),var(--p2)); box-shadow:inset 0 .4vw 0 rgba(255,255,255,.45); }
.cp-puesto-1 .cp-peana{ height:24vh; --p1:#ffe14d; --p2:#e09b00; }
.cp-puesto-2 .cp-peana{ height:16vh; --p1:#e7ecf5; --p2:#8b97ad; }
.cp-puesto-3 .cp-peana{ height:11vh; --p1:#ffb37a; --p2:#b5602a; }
.cp-confeti{ position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:5; }
.cp-confeti i{ position:absolute; top:-4%; width:.7vw; aspect-ratio:2/3; border-radius:2px; animation:cpCaer 3.4s linear infinite; }
@keyframes cpCaer{ from{transform:translateY(0) rotate(0)} to{transform:translateY(110vh) rotate(720deg)} }
@media (prefers-reduced-motion:reduce){ .cp-confeti i{ animation:none; } }
`}</style>
  );
}
