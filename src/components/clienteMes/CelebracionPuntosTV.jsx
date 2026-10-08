// CLIENTE DEL MES · celebración a pantalla completa en la TV grande al
// pasar el QR de un pedido que suma puntos.
//
//  1. ENTRADA  (≈4 s): sirena de recreativa, el nombre del cliente cae de
//     golpe y semáforo de salida rojo · rojo · rojo · ¡VERDE!
//  2. CARRERA  (≈1,6 s por punto): un carrito gigante avanza casilla a
//     casilla; cada punto = un BOCINAZO, acelerón, temblor de pantalla,
//     "+1" que sale volando y moneda en el marcador.
//  3. FINAL    (≈7,5 s): total de puntos, puesto en la carrera, fuegos
//     artificiales, confeti y fanfarria. Después se desvanece y la TV
//     queda en la clasificación con la fila del cliente destacada.
import { useEffect, useMemo, useRef, useState } from "react";
import { Carrito, Cofre } from "./CarreraClienteMes";
import { CELEBRACION_CM, duracionCelebracionClienteMes, pasosCelebracionClienteMes } from "../../utils/clienteMes";
import {
  sonidoAcelerar,
  sonidoBocina,
  sonidoEntradaPuntos,
  sonidoFuegos,
  sonidoMoneda,
  sonidoSemaforo,
  sonidoVictoria,
} from "../../utils/sonido8bits";

const BOCINAS = ["¡PIIIII!", "¡MOC-MOC!", "¡PII-PIII!", "¡MEEEEC!"];
const MEDALLAS = { 1: "🥇", 2: "🥈", 3: "🥉" };
const COLORES = ["#ffe14d", "#ff3d7f", "#00e5ff", "#76ff03", "#d500f9", "#ff9100"];

export default function CelebracionPuntosTV({ celebracion, meta = 100, onFin }) {
  const pasos = useMemo(() => pasosCelebracionClienteMes(celebracion?.puntos), [celebracion?.puntos]);
  const puntos = pasos.reduce((s, p) => s + p, 0);
  const total = Number(celebracion?.total) || puntos;
  const inicio = Math.max(0, total - puntos);
  const metaPts = Math.max(1, Number(meta) || 100);
  const duracion = duracionCelebracionClienteMes(puntos);

  const [fase, setFase] = useState("intro"); // intro -> carrera -> final
  const [luces, setLuces] = useState(0); // 0..3 rojas, 4 = verde
  const [paso, setPaso] = useState(0); // casilla donde está el carrito
  const [contados, setContados] = useState(0); // pasos ya sumados al marcador
  const [moviendo, setMoviendo] = useState(false);
  const [temblor, setTemblor] = useState(0);
  const [saliendo, setSaliendo] = useState(false);
  const onFinRef = useRef(onFin);
  onFinRef.current = onFin;

  useEffect(() => {
    const t = [];
    const en = (ms, fn) => t.push(window.setTimeout(fn, ms));
    const { intro, paso: msPaso } = CELEBRACION_CM;

    en(60, sonidoEntradaPuntos);
    [1700, 2300, 2900].forEach((ms, i) =>
      en(ms, () => {
        setLuces(i + 1);
        sonidoSemaforo(false);
      })
    );
    en(3500, () => {
      setLuces(4);
      sonidoSemaforo(true);
    });
    en(intro, () => setFase("carrera"));

    pasos.forEach((_, i) => {
      const t0 = intro + 250 + i * msPaso;
      en(t0, () => {
        setPaso(i + 1);
        setMoviendo(true);
        setTemblor((n) => n + 1);
        sonidoBocina(i);
        sonidoAcelerar();
      });
      en(t0 + 800, () => {
        setMoviendo(false);
        setContados(i + 1);
        sonidoMoneda();
      });
    });

    const tFinal = intro + pasos.length * msPaso + 300;
    en(tFinal, () => {
      setFase("final");
      sonidoVictoria();
    });
    en(tFinal + 900, () => sonidoFuegos(6));
    en(tFinal + 4200, () => sonidoFuegos(4));
    en(duracion - 800, () => setSaliendo(true));
    en(duracion, () => onFinRef.current?.());
    return () => t.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebracion?.id]);

  const sumadoHasta = (n) => inicio + pasos.slice(0, n).reduce((s, p) => s + p, 0);
  const marcador = sumadoHasta(contados);
  const casillas = pasos.length + 2; // salida + 1 por paso + la que viene
  const pctMeta = Math.min(1, sumadoHasta(paso) / metaPts);
  const faltan = Math.max(0, metaPts - marcador);
  const nombre = celebracion?.nombre || "CLIENTE";
  const posicion = Number(celebracion?.posicion) || null;

  return (
    <div
      className={`cpt-raiz cpt-fase-${fase}${saliendo ? " cpt-saliendo" : ""}`}
      key={celebracion?.id}
    >
      <EstilosCelebracion />
      <div className="cpt-estrellas" aria-hidden="true" />
      <div className="cpt-rayos" aria-hidden="true" />
      <div className="cpt-scanlines" aria-hidden="true" />
      <div className="cpt-flash" aria-hidden="true" />

      <div className={`cpt-escena${temblor ? ` cpt-tiembla-${temblor % 2}` : ""}`}>
        {/* Cabecera: siempre visible */}
        <header className="cpt-cabecera">
          <div className="cpt-marquesina">★ CLIENTE DEL MES ★ PEDIDO POR LA APP ★</div>
          <div className="cpt-nombre" data-texto={nombre}>{nombre}</div>
        </header>

        {/* 1. ENTRADA: semáforo */}
        {fase === "intro" && (
          <div className="cpt-salida">
            <div className="cpt-suma-titulo">¡SUMA PUNTOS EN LA CARRERA!</div>
            <div className={`cpt-semaforo${luces ? " cpt-semaforo-visible" : ""}`}>
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={`cpt-luz${luces >= n && luces < 4 ? " cpt-luz-roja" : ""}${luces === 4 ? " cpt-luz-verde" : ""}`}
                />
              ))}
            </div>
            {luces === 4 && <div className="cpt-ya">¡YA!</div>}
          </div>
        )}

        {/* 2. CARRERA: casillas, carrito gigante, bocinazos */}
        {fase !== "intro" && (
          <div className={`cpt-carrera${fase === "final" ? " cpt-carrera-atenuada" : ""}`}>
            <div className="cpt-marcador">
              <span className="cpt-marcador-txt">PUNTOS</span>
              <span className="cpt-marcador-num" key={marcador}>{marcador}</span>
            </div>

            <div className="cpt-pista" style={{ "--casillas": casillas }}>
              {Array.from({ length: casillas }, (_, i) => {
                const ultima = i === casillas - 1;
                const alcanzada = i <= contados && i > 0;
                return (
                  <div
                    key={i}
                    className={`cpt-casilla${alcanzada ? " cpt-casilla-ok" : ""}${i === 0 ? " cpt-casilla-salida" : ""}${ultima ? " cpt-casilla-sig" : ""}`}
                  >
                    <span className="cpt-casilla-num">{ultima ? "🏁" : sumadoHasta(i)}</span>
                    {alcanzada && <span className="cpt-casilla-chispas" key={`ch-${i}`} />}
                  </div>
                );
              })}

              <div
                className={`cpt-carro${moviendo ? " cpt-carro-moviendo" : ""}`}
                style={{ left: `calc(${(paso + 0.5) / casillas} * 100%)` }}
              >
                {moviendo && (
                  <>
                    <span className="cpt-bocina" key={`b-${paso}`}>{BOCINAS[(paso - 1) % BOCINAS.length]}</span>
                    <span className="cpt-velocidad" aria-hidden="true" />
                    <span className="cpt-humo" aria-hidden="true">💨</span>
                  </>
                )}
                {paso > 0 && (
                  <span className="cpt-mas" key={`m-${paso}`}>+{pasos[paso - 1]}</span>
                )}
                <Carrito color="#ff3d7f" />
              </div>
            </div>

            <div className="cpt-meta">
              <div className="cpt-meta-barra">
                <div className="cpt-meta-relleno" style={{ width: `${pctMeta * 100}%` }} />
                <span className="cpt-meta-carro" style={{ left: `${pctMeta * 100}%` }}>🛒</span>
              </div>
              <div className="cpt-meta-cofre"><Cofre abierto={marcador >= metaPts} /></div>
              <div className="cpt-meta-txt">
                {faltan > 0 ? `Faltan ${faltan} puntos para el cofre` : "¡META ALCANZADA!"}
              </div>
            </div>
          </div>
        )}

        {/* 3. FINAL: resultado, puesto, fuegos artificiales */}
        {fase === "final" && (
          <div className="cpt-final">
            <div className="cpt-final-caja">
              <div className="cpt-final-mas">+{puntos}</div>
              <div className="cpt-final-palabra">{puntos === 1 ? "PUNTO" : "PUNTOS"}</div>
              <div className="cpt-final-total">
                TOTAL <strong>{total}</strong> PUNTOS
              </div>
              {posicion && (
                <div className={`cpt-final-puesto${posicion === 1 ? " cpt-final-lider" : ""}`}>
                  {posicion === 1 ? "👑 ¡VA LÍDER! 👑" : `${MEDALLAS[posicion] || "🏁"} VA ${posicion}º EN LA CARRERA`}
                </div>
              )}
              <div className="cpt-final-app">📱 ¡Pide por la App y sigue sumando!</div>
            </div>

            {Array.from({ length: 7 }, (_, f) => (
              <div
                key={`fw-${f}`}
                className="cpt-fuego"
                style={{
                  left: `${[12, 85, 30, 70, 50, 20, 80][f]}%`,
                  top: `${[22, 26, 12, 14, 8, 60, 62][f]}%`,
                  animationDelay: `${0.9 + f * 0.55}s`,
                }}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <span
                    key={i}
                    style={{
                      "--a": `${i * 15}deg`,
                      background: COLORES[(f + i) % COLORES.length],
                      animationDelay: `${0.9 + f * 0.55}s`,
                    }}
                  />
                ))}
              </div>
            ))}

            {Array.from({ length: 70 }, (_, i) => (
              <span
                key={`cf-${i}`}
                className="cpt-confeti"
                style={{
                  left: `${(i * 37) % 100}%`,
                  background: COLORES[i % COLORES.length],
                  animationDelay: `${(i % 10) * 0.18}s`,
                  animationDuration: `${2.6 + (i % 5) * 0.45}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EstilosCelebracion() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rubik:wght@800;900&display=swap');

.cpt-raiz{ position:fixed; inset:0; z-index:9000; overflow:hidden; color:#fff; font-family:'Rubik',system-ui,sans-serif;
  background:radial-gradient(ellipse at 50% 30%,#4a1f9a 0%,#1a0b45 45%,#07031a 100%);
  animation:cptEntra .35s ease-out both; }
.cpt-saliendo{ animation:cptSale .8s ease-in forwards; }
@keyframes cptEntra{ from{opacity:0} to{opacity:1} }
@keyframes cptSale{ to{opacity:0; transform:scale(1.04)} }

.cpt-estrellas{ position:absolute; inset:0; pointer-events:none; opacity:.6;
  background-image:radial-gradient(2px 2px at 8% 18%,#fff 50%,transparent 51%),radial-gradient(1.5px 1.5px at 28% 72%,#fff 50%,transparent 51%),
  radial-gradient(2px 2px at 52% 12%,#fff 50%,transparent 51%),radial-gradient(1.5px 1.5px at 74% 58%,#fff 50%,transparent 51%),
  radial-gradient(2px 2px at 91% 28%,#fff 50%,transparent 51%),radial-gradient(1.5px 1.5px at 43% 88%,#fff 50%,transparent 51%),
  radial-gradient(2px 2px at 64% 38%,#fff 50%,transparent 51%),radial-gradient(1.5px 1.5px at 16% 48%,#fff 50%,transparent 51%);
  animation:cptTitila 1.2s ease-in-out infinite alternate; }
@keyframes cptTitila{ from{opacity:.25} to{opacity:.8} }
.cpt-rayos{ position:absolute; left:50%; top:45%; width:260vmax; height:260vmax; margin:-130vmax 0 0 -130vmax; pointer-events:none; opacity:.22;
  background:repeating-conic-gradient(from 0deg,#ffe14d 0 6deg,transparent 6deg 18deg); animation:cptGira 14s linear infinite; }
.cpt-fase-final .cpt-rayos{ opacity:.35; animation-duration:7s; }
@keyframes cptGira{ to{transform:rotate(360deg)} }
.cpt-scanlines{ position:absolute; inset:0; pointer-events:none; z-index:50; opacity:.18;
  background:repeating-linear-gradient(0deg,rgba(0,0,0,.6) 0 2px,transparent 2px 4px); }
.cpt-flash{ position:absolute; inset:0; background:#fff; pointer-events:none; z-index:40; animation:cptFlash .6s ease-out both; }
@keyframes cptFlash{ from{opacity:.95} to{opacity:0} }

.cpt-escena{ position:relative; z-index:5; height:100%; display:flex; flex-direction:column; align-items:center; padding:3vh 3vw; box-sizing:border-box; }
.cpt-tiembla-0{ animation:cptTiembla0 .45s ease-out; } .cpt-tiembla-1{ animation:cptTiembla1 .45s ease-out; }
@keyframes cptTiembla0{ 0%,100%{transform:none} 15%{transform:translate(-14px,6px) rotate(-.6deg)} 35%{transform:translate(12px,-8px) rotate(.5deg)} 55%{transform:translate(-8px,4px)} 75%{transform:translate(5px,-2px)} }
@keyframes cptTiembla1{ 0%,100%{transform:none} 15%{transform:translate(14px,-6px) rotate(.6deg)} 35%{transform:translate(-12px,8px) rotate(-.5deg)} 55%{transform:translate(8px,-4px)} 75%{transform:translate(-5px,2px)} }

.cpt-cabecera{ text-align:center; width:100%; }
.cpt-marquesina{ font-family:'Press Start 2P',monospace; font-size:clamp(12px,1.5vw,28px); color:#7cf9ff; letter-spacing:.3em;
  text-shadow:0 0 12px #00e5ff; animation:cptParpadeo .5s steps(2) infinite; }
@keyframes cptParpadeo{ 50%{opacity:.35} }
.cpt-nombre{ margin-top:2vh; font-weight:900; font-size:clamp(34px,7vw,140px); line-height:1.02; color:#ffe14d; text-transform:uppercase;
  text-shadow:5px 5px 0 #ff2d75,10px 10px 0 rgba(0,0,0,.5),0 0 40px rgba(255,225,77,.6);
  animation:cptCae .8s cubic-bezier(.3,1.8,.5,1) .25s both; max-width:94vw; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cpt-raiz:not(.cpt-fase-intro) .cpt-nombre{ font-size:clamp(26px,4.6vw,90px); margin-top:1vh; animation:none; }
@keyframes cptCae{ 0%{transform:translateY(-60vh) scale(2); opacity:0} 70%{transform:translateY(2vh) scale(.95); opacity:1} 100%{transform:none} }

.cpt-salida{ flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4vh; }
.cpt-suma-titulo{ font-family:'Press Start 2P',monospace; font-size:clamp(16px,2.4vw,46px); color:#fff; text-shadow:4px 4px 0 #7c3aed;
  animation:cptZoom .6s cubic-bezier(.2,1.6,.4,1) .9s both; text-align:center; }
@keyframes cptZoom{ from{transform:scale(0); opacity:0} to{transform:scale(1); opacity:1} }
.cpt-semaforo{ display:flex; gap:3vw; padding:2.4vh 3vw; border-radius:3vh; background:#0b0b14; border:6px solid #3f3f46;
  box-shadow:0 0 0 6px #111,0 20px 40px rgba(0,0,0,.6); opacity:0; transform:translateY(20vh); transition:all .5s cubic-bezier(.2,1.4,.4,1); }
.cpt-semaforo-visible{ opacity:1; transform:none; }
.cpt-luz{ width:clamp(60px,9vw,170px); aspect-ratio:1; border-radius:50%; background:#2a0a0a; box-shadow:inset 0 -8px 16px rgba(0,0,0,.6); transition:all .15s; }
.cpt-luz-roja{ background:radial-gradient(circle at 35% 30%,#ffb3b3,#ff1744 45%,#a00 100%); box-shadow:0 0 50px 12px rgba(255,23,68,.8); }
.cpt-luz-verde{ background:radial-gradient(circle at 35% 30%,#d9ffd0,#00e676 45%,#007a33 100%); box-shadow:0 0 70px 18px rgba(0,230,118,.9); }
.cpt-ya{ font-family:'Press Start 2P',monospace; font-size:clamp(48px,10vw,200px); color:#00e676; text-shadow:8px 8px 0 #004d26,0 0 50px #00e676;
  animation:cptZoom .4s cubic-bezier(.2,1.8,.4,1) both; }

.cpt-carrera{ flex:1; width:100%; display:flex; flex-direction:column; justify-content:center; gap:4vh; transition:opacity .6s, filter .6s; }
.cpt-carrera-atenuada{ opacity:.25; filter:blur(3px); }
.cpt-marcador{ position:absolute; top:3vh; right:3vw; min-width:9vw; display:grid; justify-items:center; padding:1.4vh 1.6vw; border-radius:2vh;
  background:rgba(0,0,0,.55); border:4px solid #ffe14d; box-shadow:0 0 30px rgba(255,225,77,.6); }
.cpt-marcador-txt{ font-family:'Press Start 2P',monospace; font-size:clamp(10px,1vw,20px); color:#ffe14d; }
.cpt-marcador-num{ font-family:'Press Start 2P',monospace; font-size:clamp(30px,4vw,80px); margin-top:1vh; color:#fff; text-shadow:4px 4px 0 #ff2d75;
  animation:cptLatido .5s cubic-bezier(.2,1.8,.4,1) both; }
@keyframes cptLatido{ 0%{transform:scale(1.9); color:#ffe14d} 100%{transform:scale(1)} }

.cpt-pista{ position:relative; width:100%; display:grid; grid-template-columns:repeat(var(--casillas),1fr); gap:.8vw; margin-top:16vh;
  padding:1.6vh .8vw; border-radius:2vh; background:#1f1846; border:4px solid rgba(255,255,255,.2);
  box-shadow:inset 0 6px 16px rgba(0,0,0,.6),0 0 40px rgba(124,58,237,.5); }
.cpt-casilla{ position:relative; height:12vh; border-radius:1.4vh; display:grid; place-items:center; background:rgba(255,255,255,.06);
  border:3px dashed rgba(255,255,255,.25); transition:all .3s; }
.cpt-casilla-num{ font-family:'Press Start 2P',monospace; font-size:clamp(14px,2vw,40px); color:rgba(255,255,255,.55); }
.cpt-casilla-salida{ background:repeating-conic-gradient(#fff 0 25%,#222 0 50%) 0 0/2.4vh 2.4vh; border-style:solid; }
.cpt-casilla-salida .cpt-casilla-num{ background:#1f1846; padding:.6vh .6vw; border-radius:.8vh; color:#fff; }
.cpt-casilla-ok{ background:linear-gradient(180deg,#ffe14d,#ff9100); border:3px solid #fff; box-shadow:0 0 30px rgba(255,225,77,.9);
  animation:cptCasilla .5s cubic-bezier(.2,1.8,.4,1) both; }
.cpt-casilla-ok .cpt-casilla-num{ color:#3b1d00; }
@keyframes cptCasilla{ from{transform:scale(1.35)} to{transform:scale(1)} }
.cpt-casilla-sig{ border-color:#7cf9ff; animation:cptParpadeo .8s steps(2) infinite; }
.cpt-casilla-chispas{ position:absolute; inset:-20%; border-radius:50%; border:6px solid #fff; animation:cptOnda .7s ease-out forwards; pointer-events:none; }
@keyframes cptOnda{ from{transform:scale(.3); opacity:1} to{transform:scale(1.6); opacity:0} }

.cpt-carro{ position:absolute; bottom:calc(100% - 4vh); width:clamp(140px,17vw,340px); transform:translateX(-50%); z-index:6;
  transition:left .8s cubic-bezier(.3,1.35,.5,1); }
.cpt-carro .cm-carrito{ width:100%; height:auto; filter:drop-shadow(0 10px 6px rgba(0,0,0,.6)); }
.cpt-carro .cm-rueda{ animation:cptRueda .5s linear infinite; }
.cpt-carro-moviendo .cm-rueda{ animation-duration:.12s; }
@keyframes cptRueda{ to{transform:rotate(360deg)} }
.cpt-carro-moviendo .cm-carrito{ animation:cptSalto .8s ease-out; }
@keyframes cptSalto{ 0%{transform:none} 25%{transform:translateY(-5vh) rotate(-8deg)} 55%{transform:translateY(0) rotate(3deg)} 75%{transform:translateY(-1.5vh)} 100%{transform:none} }
.cpt-bocina{ position:absolute; left:55%; bottom:95%; white-space:nowrap; font-family:'Press Start 2P',monospace; font-size:clamp(16px,2.4vw,48px);
  color:#160b38; background:#fff; padding:1.4vh 1.2vw; border-radius:2vh; border:5px solid #ff2d75; box-shadow:6px 6px 0 #ff2d75;
  animation:cptBocina .9s cubic-bezier(.2,1.8,.4,1) both; }
.cpt-bocina::after{ content:""; position:absolute; left:14%; top:100%; border:14px solid transparent; border-top-color:#ff2d75; }
@keyframes cptBocina{ 0%{transform:scale(0) rotate(-15deg)} 25%{transform:scale(1.15) rotate(4deg)} 40%{transform:scale(1) rotate(-2deg)} 80%{opacity:1} 100%{opacity:0; transform:scale(1.05) translateY(-2vh)} }
.cpt-velocidad{ position:absolute; right:85%; top:20%; width:30vw; height:60%; pointer-events:none;
  background:repeating-linear-gradient(180deg,transparent 0 1.2vh,rgba(255,255,255,.85) 1.2vh 1.6vh);
  -webkit-mask:linear-gradient(90deg,transparent,#000); mask:linear-gradient(90deg,transparent,#000); animation:cptLineas .8s ease-out forwards; }
@keyframes cptLineas{ from{opacity:1; transform:scaleX(1.2)} to{opacity:0; transform:scaleX(.3); transform-origin:right} }
.cpt-humo{ position:absolute; right:88%; bottom:0; font-size:clamp(30px,4vw,80px); animation:cptHumo .8s ease-out forwards; }
@keyframes cptHumo{ from{opacity:1; transform:translateX(0) scale(.6)} to{opacity:0; transform:translateX(-8vw) scale(1.6)} }
.cpt-mas{ position:absolute; left:50%; top:-6vh; font-family:'Press Start 2P',monospace; font-size:clamp(30px,5vw,100px); color:#76ff03;
  text-shadow:5px 5px 0 #1b5e20,0 0 30px #76ff03; animation:cptMas 1.4s ease-out .5s both; pointer-events:none; }
@keyframes cptMas{ 0%{opacity:0; transform:translate(-50%,2vh) scale(.4)} 20%{opacity:1; transform:translate(-50%,-2vh) scale(1.3)} 70%{opacity:1} 100%{opacity:0; transform:translate(-50%,-14vh) scale(1)} }

.cpt-meta{ position:relative; display:grid; grid-template-columns:1fr auto; align-items:center; gap:1.4vw; width:80%; margin:0 auto; }
.cpt-meta-barra{ position:relative; height:3.4vh; border-radius:999px; background:#1f1846; border:3px solid rgba(255,255,255,.25); }
.cpt-meta-relleno{ position:absolute; inset:0 auto 0 0; border-radius:999px; background:linear-gradient(90deg,#ff8a3d,#ff3d7f); box-shadow:0 0 20px #ff3d7f;
  transition:width .8s cubic-bezier(.3,1.2,.5,1); }
.cpt-meta-carro{ position:absolute; top:50%; transform:translate(-50%,-55%); font-size:4.4vh; transition:left .8s cubic-bezier(.3,1.2,.5,1); }
.cpt-meta-cofre{ width:clamp(50px,6vw,120px); }
.cpt-meta-cofre .cm-cofre{ width:100%; height:auto; }
.cpt-meta-txt{ grid-column:1/-1; text-align:center; font-family:'Press Start 2P',monospace; font-size:clamp(11px,1.3vw,26px); color:#7cf9ff; }

.cpt-final{ position:absolute; inset:0; display:grid; place-items:center; z-index:20; pointer-events:none; padding-top:15vh; box-sizing:border-box; }
.cpt-final-caja{ text-align:center; padding:3vh 5vw; border-radius:4vh; background:rgba(9,4,24,.9); border:6px solid #ffe14d;
  box-shadow:0 0 0 6px #ff2d75,0 0 90px rgba(255,225,77,.8); animation:cptPop .9s cubic-bezier(.2,1.7,.4,1) both; }
@keyframes cptPop{ 0%{transform:scale(.1) rotate(-20deg); opacity:0} 100%{transform:none; opacity:1} }
.cpt-final-mas{ font-family:'Press Start 2P',monospace; font-size:clamp(60px,11vw,220px); line-height:1; color:#ffe14d;
  text-shadow:10px 10px 0 #ff2d75,0 0 60px rgba(255,225,77,.8); animation:cptRespira 1s ease-in-out infinite; }
@keyframes cptRespira{ 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
.cpt-final-palabra{ font-family:'Press Start 2P',monospace; font-size:clamp(20px,3.4vw,68px); color:#fff; margin-top:2vh; }
.cpt-final-total{ font-weight:900; font-size:clamp(22px,3vw,60px); margin-top:2vh; color:#7cf9ff; }
.cpt-final-total strong{ color:#fff; font-size:1.3em; }
.cpt-final-puesto{ display:inline-block; margin-top:2.4vh; padding:1.4vh 2vw; border-radius:2vh; font-weight:900; font-size:clamp(22px,3vw,60px);
  background:linear-gradient(90deg,#7c3aed,#ff2d75); box-shadow:0 0 30px rgba(255,45,117,.7); animation:cptZoom .6s cubic-bezier(.2,1.8,.4,1) .7s both; }
.cpt-final-lider{ background:linear-gradient(90deg,#ffb300,#ffe14d,#ffb300); color:#3b1d00; box-shadow:0 0 50px rgba(255,225,77,.95); }
.cpt-final-app{ margin-top:3vh; font-weight:800; font-size:clamp(14px,1.6vw,32px); opacity:.9; animation:cptZoom .5s ease-out 1.4s both; }

.cpt-fuego{ position:absolute; width:0; height:0; }
.cpt-fuego span{ position:absolute; left:0; top:0; width:1.8vh; height:1.8vh; border-radius:50%; opacity:0;
  box-shadow:0 0 12px currentColor; animation:cptChispa 1.6s ease-out infinite; }
@keyframes cptChispa{ 0%{opacity:1; transform:rotate(var(--a)) translateX(0) scale(1.4)} 70%{opacity:1} 100%{opacity:0; transform:rotate(var(--a)) translateX(32vh) translateY(6vh) scale(.4)} }
.cpt-confeti{ position:absolute; top:-4vh; width:1.4vh; height:2.2vh; border-radius:3px; animation:cptCaeConfeti linear infinite; }
@keyframes cptCaeConfeti{ from{transform:translateY(-4vh) rotate(0)} to{transform:translateY(110vh) rotate(900deg)} }

@media (prefers-reduced-motion:reduce){
  .cpt-rayos,.cpt-estrellas,.cpt-confeti,.cpt-fuego span{ animation:none !important; }
}
`}</style>
  );
}
