// CLIENTE DEL MES · REPOSTAJE EXTRA (TV grande, pantalla completa).
//
// Sale EN LUGAR de CelebracionPuntosTV cuando el pedido suma menos de 5
// puntos y el cliente va del 16º para abajo: el servidor le regala 5 puntos
// de "gasolina" (cliente_mes_canjear_qr devuelve repostaje = true).
//
//  1. RESULTADO  nombre + "+3 PUNTOS · VA 18º" con trombón triste.
//  2. RESERVA    alarma roja, aguja en la R, el carrito petardea y echa humo.
//  3. BOXES      entra el surtidor LOJO y se engancha la manguera.
//  4. CHORROS    un chorro por punto: gotas por la manguera, "glug", +1,
//                sube la aguja y el marcador.
//  5. ¡LLENO!    rugido del motor, llamas y el carrito sale disparado.
//  6. FINAL      +5 PUNTOS EXTRA DE GASOLINA, total, fuegos y confeti.
import { useEffect, useRef, useState } from "react";
import { REPOSTAJE_CM, duracionRepostajeClienteMes } from "../../utils/clienteMes";
import {
  repAlarma,
  repBoxes,
  repChorro,
  repClank,
  repEntrada,
  repFuegos,
  repGlug,
  repLleno,
  repMoneda,
  repPetardeo,
  repRugido,
  repSalida,
  repTrombon,
  repVictoria,
} from "../../utils/sonidoRepostaje";

const COLORES = ["#ffe14d", "#ff3d7f", "#00e5ff", "#76ff03", "#d500f9", "#ff9100"];
const GLUGS = ["¡GLUG!", "¡GLU-GLU!", "¡BLUP!", "¡GLUUUG!", "¡LLENANDO!"];
const RUTA_MANGUERA = "M372 330 C470 330 470 470 560 460 C610 455 625 420 648 392";

export default function RepostajeTV({ celebracion, onFin }) {
  const extra = Math.max(1, Math.min(10, Math.round(Number(celebracion?.puntos_extra) || 5)));
  const puntosPedido = Number(celebracion?.puntos) || 0;
  const totalFinal = Number(celebracion?.total) || 0;
  const totalAntes = celebracion?.total_antes != null ? Number(celebracion.total_antes) : Math.max(0, totalFinal - extra);
  const tenia = Math.max(0, totalAntes - puntosPedido);
  const posAntes = Number(celebracion?.posicion_antes) || null;
  const posFinal = Number(celebracion?.posicion) || null;
  const nombre = celebracion?.nombre || "CLIENTE";
  const duracion = duracionRepostajeClienteMes(extra);

  const [f, setF] = useState({}); // banderas de la escena
  const [rotulo, setRotulo] = useState(null); // { txt, clase, n }
  const [marcador, setMarcador] = useState(tenia);
  const [llenado, setLlenado] = useState(0); // chorros ya echados
  const [flotantes, setFlotantes] = useState([]);
  const [gotas, setGotas] = useState([]);
  const [temblor, setTemblor] = useState(0);
  const [flash, setFlash] = useState(1);
  const [bote, setBote] = useState(0);
  const onFinRef = useRef(onFin);
  onFinRef.current = onFin;

  useEffect(() => {
    const t = [];
    const en = (ms, fn) => t.push(window.setTimeout(fn, ms));
    const poner = (cambios) => setF((x) => ({ ...x, ...cambios }));
    const rot = (txt, clase) => setRotulo({ txt, clase, n: Date.now() });
    const echarGota = () => {
      const id = `${Date.now()}-${Math.random()}`;
      setGotas((g) => [...g, id]);
      window.setTimeout(() => setGotas((g) => g.filter((x) => x !== id)), 760);
    };
    const flotar = (clase, txt, x, y) => {
      const id = `${Date.now()}-${Math.random()}`;
      setFlotantes((l) => [...l, { id, clase, txt, x, y }]);
      window.setTimeout(() => setFlotantes((l) => l.filter((e) => e.id !== id)), 1300);
    };

    en(30, () => {
      repEntrada();
      poner({ cae: true });
    });
    en(REPOSTAJE_CM.resultado, () => {
      poner({ resultado: true });
      setMarcador(tenia + puntosPedido);
      repTrombon();
    });
    en(REPOSTAJE_CM.reserva, () => {
      poner({ reserva: true });
      rot("⚠ ¡DEPÓSITO EN RESERVA! ⚠", "rpt-rot-reserva");
      repAlarma();
      repPetardeo();
    });
    en(REPOSTAJE_CM.boxes, () => {
      poner({ reserva: false, resultado: false, surtidor: true });
      rot("¡PARADA EN BOXES!", "rpt-rot-boxes");
      repBoxes();
    });
    en(REPOSTAJE_CM.engancha, () => {
      poner({ enganchada: true });
      repClank();
      setTemblor((n) => n + 1);
    });
    en(REPOSTAJE_CM.engancha + 600, () => {
      poner({ repostando: true });
      rot("⛽ REPOSTAJE EXTRA DE REGALO ⛽", "rpt-rot-extra");
      repChorro(extra * (REPOSTAJE_CM.paso / 1000) + 0.2);
    });

    for (let i = 1; i <= extra; i += 1) {
      const t0 = REPOSTAJE_CM.chorros + (i - 1) * REPOSTAJE_CM.paso;
      en(t0, () => {
        echarGota();
        repGlug(i);
      });
      en(t0 + 120, echarGota);
      en(t0 + 240, echarGota);
      en(t0 + 450, () => {
        setLlenado(i);
        setMarcador(tenia + puntosPedido + i);
        setBote((n) => n + 1);
        repMoneda();
        flotar("rpt-mas", "+1", 44 + (i % 2) * 6, 40);
        flotar("rpt-glug", GLUGS[(i - 1) % GLUGS.length], 24, 33);
      });
    }

    const tLleno = REPOSTAJE_CM.chorros + extra * REPOSTAJE_CM.paso;
    en(tLleno, () => {
      poner({ repostando: false, lleno: true });
      rot("¡LLENO!", "rpt-rot-lleno");
      setFlash((n) => n + 1);
      repLleno();
    });
    en(tLleno + 700, () => poner({ enganchada: false, surtidor: false }));
    en(tLleno + 1200, () => {
      setRotulo(null);
      poner({ rugiendo: true });
      repRugido();
    });
    en(tLleno + 2800, () => {
      poner({ rugiendo: false, sale: true });
      setTemblor((n) => n + 1);
      setFlash((n) => n + 1);
      repSalida();
    });
    en(tLleno + 3500, () => {
      poner({ final: true });
      repVictoria();
    });
    en(tLleno + 4100, () => repFuegos(6));
    en(duracion - 800, () => poner({ saliendo: true }));
    en(duracion, () => onFinRef.current?.());
    return () => t.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebracion?.id]);

  const pct = 0.06 + 0.94 * (llenado / extra);
  const clases = [
    "rpt-raiz",
    f.reserva && "rpt-reserva",
    f.surtidor && "rpt-con-surtidor",
    f.enganchada && "rpt-enganchada",
    f.repostando && "rpt-repostando",
    f.lleno && "rpt-lleno",
    f.rugiendo && "rpt-rugiendo",
    f.sale && "rpt-sale",
    f.final && "rpt-final-on",
    f.saliendo && "rpt-saliendo",
  ]
    .filter(Boolean)
    .join(" ");
  const sube = posAntes && posFinal && posFinal < posAntes;

  return (
    <div className={clases} key={celebracion?.id}>
      <EstilosRepostaje />
      <div className="rpt-capa rpt-rayos" aria-hidden="true" />
      <div className="rpt-capa rpt-estrellas" aria-hidden="true" />
      <div className="rpt-capa rpt-alarma-luz" aria-hidden="true" />

      <div className={`rpt-escena${f.rugiendo ? " rpt-vibra" : temblor ? ` rpt-tiembla-${temblor % 2}` : ""}`}>
        <div className="rpt-gauge">
          <svg viewBox="0 0 200 118" aria-hidden="true">
            <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#2a2340" strokeWidth="18" />
            <path d="M20 100 A80 80 0 0 1 43.4 43.4" fill="none" stroke="#ff1744" strokeWidth="18" />
            <path d="M43.4 43.4 A80 80 0 0 1 156.6 43.4" fill="none" stroke="#ffe14d" strokeWidth="18" opacity=".55" />
            <path d="M156.6 43.4 A80 80 0 0 1 180 100" fill="none" stroke="#76ff03" strokeWidth="18" />
            <text x="14" y="117" fill="#ff8a80" fontFamily="'Press Start 2P', monospace" fontSize="14">R</text>
            <text x="174" y="117" fill="#76ff03" fontFamily="'Press Start 2P', monospace" fontSize="14">LL</text>
            <g className="rpt-aguja" style={f.reserva ? undefined : { transform: `rotate(${-80 + 160 * pct}deg)` }}>
              <path d="M100 100 L96 100 L100 30 L104 100 Z" fill="#ffffff" />
            </g>
            <circle cx="100" cy="100" r="9" fill="#ff2d75" stroke="#fff" strokeWidth="3" />
            <circle className="rpt-luz-reserva" cx="100" cy="66" r="7" fill="#ff1744" />
          </svg>
          <div className="rpt-gauge-txt">{f.reserva ? "¡RESERVA!" : f.lleno ? "¡LLENO!" : "GASOLINA"}</div>
        </div>

        <div className="rpt-marcador">
          <span>PUNTOS</span>
          <b key={marcador}>{marcador}</b>
        </div>

        <header className="rpt-cabecera">
          <div className="rpt-marquesina">★ CLIENTE DEL MES ★ PEDIDO POR LA APP ★</div>
          <div className={`rpt-nombre${f.cae ? " rpt-cae" : ""}`}>{nombre}</div>
        </header>

        {f.resultado && (
          <div className="rpt-resultado">
            <span className="rpt-res-pts">+{puntosPedido} {puntosPedido === 1 ? "PUNTO" : "PUNTOS"}</span>
            {posAntes && (
              <>
                <span>·</span>
                <span className="rpt-res-puesto">VA {posAntes}º</span>
              </>
            )}
          </div>
        )}
        {rotulo && (
          <div className={`rpt-rotulo ${rotulo.clase}`} key={rotulo.n}>
            {rotulo.txt}
          </div>
        )}

        {flotantes.map((e) => (
          <span key={e.id} className={e.clase} style={{ left: `${e.x}%`, top: `${e.y}%` }}>
            {e.txt}
          </span>
        ))}

        <svg className="rpt-boxes" viewBox="0 0 1600 560" aria-hidden="true">
          <defs>
            <linearGradient id="rptSurt" x1="0" x2="1">
              <stop offset="0" stopColor="#ff2d75" />
              <stop offset="1" stopColor="#c2185b" />
            </linearGradient>
            <linearGradient id="rptSuelo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2b1a66" />
              <stop offset="1" stopColor="#0c0624" />
            </linearGradient>
          </defs>
          <rect x="0" y="520" width="1600" height="40" fill="url(#rptSuelo)" />
          <rect x="0" y="518" width="1600" height="6" fill="#ffe14d" opacity=".8" />
          <g opacity=".5" fill="#fff">
            {[120, 320, 1000, 1200, 1400].map((x) => (
              <rect key={x} x={x} y="530" width="80" height="10" />
            ))}
          </g>

          {/* surtidor */}
          <g className="rpt-surtidor">
            <rect x="190" y="200" width="190" height="320" rx="18" fill="url(#rptSurt)" stroke="#fff" strokeWidth="6" />
            <rect x="175" y="180" width="220" height="40" rx="10" fill="#ffe14d" stroke="#fff" strokeWidth="5" />
            <text x="285" y="208" textAnchor="middle" fontFamily="'Press Start 2P', monospace" fontSize="18" fill="#160b38">LOJO</text>
            <rect x="212" y="238" width="146" height="92" rx="8" fill="#08131a" stroke="#7cf9ff" strokeWidth="4" />
            <text x="285" y="262" textAnchor="middle" fontFamily="'Press Start 2P', monospace" fontSize="12" fill="#7cf9ff">PUNTOS</text>
            <text x="285" y="314" textAnchor="middle" fontFamily="'Press Start 2P', monospace" fontSize="38" fill="#76ff03">
              {llenado}.0
            </text>
            <rect x="230" y="350" width="110" height="18" rx="9" fill="#160b38" opacity=".5" />
            <rect x="220" y="390" width="130" height="100" rx="10" fill="#c2185b" stroke="rgba(255,255,255,.4)" strokeWidth="3" />
            <text x="285" y="450" textAnchor="middle" fontSize="46">⛽</text>
            <rect x="372" y="300" width="22" height="60" rx="6" fill="#160b38" stroke="#fff" strokeWidth="3" />
            <path className="rpt-manguera" d={RUTA_MANGUERA} fill="none" stroke="#111827" strokeWidth="16" strokeLinecap="round" />
            <path className="rpt-chorro" d={RUTA_MANGUERA} fill="none" stroke="#ff9100" strokeWidth="6" strokeLinecap="round" strokeDasharray="14 22" />
            {gotas.map((id) => (
              <Gota key={id} />
            ))}
          </g>

          {/* carrito */}
          <g className="rpt-coche">
            <g className="rpt-estela">
              <rect x="200" y="300" width="360" height="10" rx="5" fill="#fff" opacity=".8" />
              <rect x="140" y="350" width="420" height="10" rx="5" fill="#fff" opacity=".6" />
              <rect x="240" y="420" width="320" height="10" rx="5" fill="#fff" opacity=".7" />
            </g>
            <circle className="rpt-humo" cx="560" cy="440" r="22" fill="#9ca3af" />
            <circle className="rpt-humo rpt-h2" cx="560" cy="450" r="18" fill="#6b7280" />
            <circle className="rpt-humo rpt-h3" cx="560" cy="430" r="26" fill="#9ca3af" />
            <g className="rpt-llamas">
              <path d="M570 420 L460 400 L520 430 L430 445 L520 455 L470 480 L570 465 Z" fill="#ff9100" />
              <path d="M570 428 L500 418 L535 440 L480 450 L540 458 L570 458 Z" fill="#ffe14d" />
            </g>
            <g transform="translate(560 270) scale(5)">
              <g className={`rpt-cuerpo${bote ? ` rpt-bote-${bote % 2}` : ""}`}>
                <rect x="22" y="3" width="14" height="11" rx="1.5" fill="#c58b4e" stroke="#7a4a1d" strokeWidth="1.5" />
                <rect x="35" y="0" width="13" height="14" rx="1.5" fill="#e0a868" stroke="#7a4a1d" strokeWidth="1.5" />
                <rect x="47" y="5" width="9" height="9" rx="1.5" fill="#d99a57" stroke="#7a4a1d" strokeWidth="1.5" />
                <path d="M2 8 H11 L19 33" fill="none" stroke="#e5e7eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13 13 H61 L55 33 H19 Z" fill="#ff3d7f" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
                <path d="M25 13 L27 33 M37 13 V33 M49 13 L47 33 M16 23 H58" stroke="rgba(255,255,255,.55)" strokeWidth="1.6" />
                <path d="M19 33 L21 38 H54" fill="none" stroke="#e5e7eb" strokeWidth="3" strokeLinecap="round" />
                <circle cx="17.6" cy="24.4" r="3" fill="#ffe14d" stroke="#160b38" strokeWidth="1.2" />
                <g className="rpt-rueda">
                  <circle cx="25" cy="43" r="6" fill="#111827" stroke="#e5e7eb" strokeWidth="2" />
                  <path d="M25 38 V48 M20 43 H30" stroke="#9ca3af" strokeWidth="1.5" />
                </g>
                <g className="rpt-rueda">
                  <circle cx="50" cy="43" r="6" fill="#111827" stroke="#e5e7eb" strokeWidth="2" />
                  <path d="M50 38 V48 M45 43 H55" stroke="#9ca3af" strokeWidth="1.5" />
                </g>
              </g>
            </g>
          </g>
        </svg>
      </div>

      {f.final && (
        <div className="rpt-final">
          <div className="rpt-final-caja">
            <div className="rpt-final-icono">⛽</div>
            <div className="rpt-final-mas">+{extra}</div>
            <div className="rpt-final-palabra">
              PUNTOS <em>EXTRA</em> DE GASOLINA
            </div>
            <div className="rpt-final-total">
              TOTAL <strong>{totalFinal}</strong> PUNTOS
            </div>
            {posFinal && (
              <div className="rpt-final-puesto">{sube ? `🚀 ¡SUBE DEL ${posAntes}º AL ${posFinal}º!` : `🏁 VA ${posFinal}º EN LA CARRERA`}</div>
            )}
            <div className="rpt-final-app">📱 ¡Pide por la App y vuelve a la carrera!</div>
          </div>
          {[[12, 22], [85, 26], [30, 12], [70, 14], [50, 8], [20, 62], [80, 62]].map(([x, y], k) => (
            <div key={`fw-${k}`} className="rpt-fuego" style={{ left: `${x}%`, top: `${y}%` }}>
              {Array.from({ length: 24 }, (_, i) => (
                <span
                  key={i}
                  style={{ "--a": `${i * 15}deg`, background: COLORES[(k + i) % COLORES.length], animationDelay: `${0.5 + k * 0.5}s` }}
                />
              ))}
            </div>
          ))}
          {Array.from({ length: 70 }, (_, i) => (
            <span
              key={`cf-${i}`}
              className="rpt-confeti"
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

      <div className="rpt-capa rpt-flash" key={`f-${flash}`} aria-hidden="true" />
      <div className="rpt-capa rpt-scan" aria-hidden="true" />
    </div>
  );
}

// Gota de gasolina que recorre la manguera (SMIL: se arranca a mano porque
// un <animateMotion> añadido tarde ya habría "terminado").
function Gota() {
  const ref = useRef(null);
  useEffect(() => {
    try {
      ref.current?.beginElement();
    } catch {
      // navegador sin SMIL: la gota no se mueve, nada más
    }
  }, []);
  return (
    <circle r="9" fill="#ff9100">
      <animateMotion ref={ref} dur="0.7s" begin="indefinite" fill="freeze" path={RUTA_MANGUERA} />
    </circle>
  );
}

function EstilosRepostaje() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rubik:wght@800;900&display=swap');

.rpt-raiz{ position:fixed; inset:0; z-index:9000; overflow:hidden; color:#fff; font-family:'Rubik',system-ui,sans-serif; container-type:size;
  background:radial-gradient(ellipse at 50% 30%,#4a1f9a 0%,#1a0b45 45%,#07031a 100%); animation:rptEntra .35s ease-out both; }
.rpt-saliendo{ animation:rptSale .8s ease-in forwards; }
@keyframes rptEntra{ from{opacity:0} to{opacity:1} }
@keyframes rptSale{ to{opacity:0; transform:scale(1.04)} }
.rpt-capa{ position:absolute; inset:0; pointer-events:none; }
.rpt-estrellas{ opacity:.55; animation:rptTitila 1.2s ease-in-out infinite alternate;
  background-image:radial-gradient(2px 2px at 8% 18%,#fff 50%,transparent 51%),radial-gradient(1.5px 1.5px at 28% 72%,#fff 50%,transparent 51%),
  radial-gradient(2px 2px at 52% 12%,#fff 50%,transparent 51%),radial-gradient(1.5px 1.5px at 74% 58%,#fff 50%,transparent 51%),
  radial-gradient(2px 2px at 91% 28%,#fff 50%,transparent 51%),radial-gradient(1.5px 1.5px at 43% 88%,#fff 50%,transparent 51%); }
@keyframes rptTitila{ from{opacity:.25} to{opacity:.8} }
.rpt-rayos{ inset:auto; left:50%; top:55%; width:260vmax; height:260vmax; margin:-130vmax 0 0 -130vmax; opacity:.12;
  background:repeating-conic-gradient(from 0deg,#ffe14d 0 6deg,transparent 6deg 18deg); animation:rptGira 14s linear infinite; }
.rpt-reserva .rpt-rayos{ background:repeating-conic-gradient(from 0deg,#ff1744 0 6deg,transparent 6deg 18deg); opacity:.18; }
.rpt-final-on .rpt-rayos{ opacity:.32; animation-duration:6s; }
@keyframes rptGira{ to{transform:rotate(360deg)} }
.rpt-scan{ z-index:50; opacity:.16; background:repeating-linear-gradient(0deg,rgba(0,0,0,.6) 0 2px,transparent 2px 4px); }
.rpt-alarma-luz{ z-index:4; opacity:0; background:radial-gradient(ellipse at center,transparent 40%,rgba(255,23,68,.55) 100%); }
.rpt-reserva .rpt-alarma-luz{ animation:rptSirena .5s steps(2) infinite; }
@keyframes rptSirena{ 0%{opacity:0} 50%{opacity:1} }
.rpt-flash{ z-index:40; background:#fff; animation:rptFlash .6s ease-out forwards; }
@keyframes rptFlash{ from{opacity:.95} to{opacity:0} }

.rpt-escena{ position:absolute; inset:0; z-index:5; }
.rpt-tiembla-0{ animation:rptTiembla0 .45s ease-out; } .rpt-tiembla-1{ animation:rptTiembla1 .45s ease-out; }
@keyframes rptTiembla0{ 0%,100%{transform:none} 15%{transform:translate(-1.2cqw,.5cqw) rotate(-.6deg)} 35%{transform:translate(1cqw,-.6cqw) rotate(.5deg)} 55%{transform:translate(-.6cqw,.3cqw)} 75%{transform:translate(.4cqw,-.2cqw)} }
@keyframes rptTiembla1{ 0%,100%{transform:none} 15%{transform:translate(1.2cqw,-.5cqw) rotate(.6deg)} 35%{transform:translate(-1cqw,.6cqw) rotate(-.5deg)} 55%{transform:translate(.6cqw,-.3cqw)} 75%{transform:translate(-.4cqw,.2cqw)} }
.rpt-vibra{ animation:rptVibra .09s linear infinite; }
@keyframes rptVibra{ 0%{transform:translate(.25cqw,0)} 50%{transform:translate(-.25cqw,.15cqw)} 100%{transform:translate(0,-.15cqw)} }

.rpt-cabecera{ position:absolute; top:2.4cqw; left:0; right:0; text-align:center; }
.rpt-marquesina{ font-family:'Press Start 2P',monospace; font-size:1.25cqw; color:#7cf9ff; letter-spacing:.3em; text-shadow:0 0 1cqw #00e5ff; animation:rptParpadeo .5s steps(2) infinite; }
@keyframes rptParpadeo{ 50%{opacity:.35} }
.rpt-nombre{ margin-top:1cqw; padding:0 18cqw; font-weight:900; font-size:5.4cqw; line-height:1; color:#ffe14d; text-transform:uppercase;
  text-shadow:.35cqw .35cqw 0 #ff2d75,.7cqw .7cqw 0 rgba(0,0,0,.5),0 0 3cqw rgba(255,225,77,.6); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rpt-cae{ animation:rptCae .8s cubic-bezier(.3,1.8,.5,1) both; }
@keyframes rptCae{ 0%{transform:translateY(-40cqw) scale(2); opacity:0} 70%{transform:translateY(1cqw) scale(.95); opacity:1} 100%{transform:none} }

.rpt-resultado{ position:absolute; left:50%; top:17cqw; transform:translateX(-50%); display:flex; gap:1.4cqw; align-items:center; white-space:nowrap;
  font-family:'Press Start 2P',monospace; font-size:1.7cqw; padding:1cqw 1.6cqw; border-radius:1cqw; background:rgba(0,0,0,.55); border:.3cqw solid #b9b0e0;
  animation:rptZoom .5s cubic-bezier(.2,1.6,.4,1) both; }
.rpt-res-pts{ color:#b9b0e0; } .rpt-res-puesto{ color:#ff8a80; }
@keyframes rptZoom{ from{transform:translateX(-50%) scale(0); opacity:0} to{transform:translateX(-50%) scale(1); opacity:1} }

.rpt-rotulo{ position:absolute; left:50%; top:23.5cqw; transform:translateX(-50%); font-family:'Press Start 2P',monospace; white-space:nowrap; text-align:center; z-index:8;
  animation:rptRotulo .5s cubic-bezier(.2,1.8,.4,1) both; }
@keyframes rptRotulo{ 0%{transform:translateX(-50%) scale(0) rotate(-8deg); opacity:0} 60%{transform:translateX(-50%) scale(1.12) rotate(2deg); opacity:1} 100%{transform:translateX(-50%) scale(1); opacity:1} }
.rpt-rot-reserva{ font-size:3.4cqw; color:#fff; background:#ff1744; padding:1cqw 2cqw; border:.4cqw solid #fff; box-shadow:.5cqw .5cqw 0 #6b0016,0 0 4cqw rgba(255,23,68,.9);
  animation:rptRotulo .5s cubic-bezier(.2,1.8,.4,1) both, rptParpadeo .4s steps(2) .5s infinite; }
.rpt-rot-boxes{ font-size:3.2cqw; color:#ffe14d; text-shadow:.35cqw .35cqw 0 #ff2d75,0 0 3cqw rgba(255,225,77,.7); }
.rpt-rot-extra{ font-size:2.3cqw; color:#76ff03; text-shadow:.3cqw .3cqw 0 #1b5e20,0 0 2.4cqw rgba(118,255,3,.7); }
.rpt-rot-lleno{ font-size:4.6cqw; color:#76ff03; text-shadow:.45cqw .45cqw 0 #1b5e20,0 0 4cqw rgba(118,255,3,.9); }

.rpt-gauge{ position:absolute; left:2.4cqw; top:2.2cqw; width:16cqw; padding:.8cqw .8cqw .6cqw; border-radius:1.2cqw; background:rgba(0,0,0,.6); border:.3cqw solid #3f3f46;
  box-shadow:0 0 0 .3cqw #111; text-align:center; z-index:7; }
.rpt-gauge svg{ width:100%; display:block; overflow:visible; }
.rpt-gauge-txt{ font-family:'Press Start 2P',monospace; font-size:.85cqw; color:#b9b0e0; margin-top:.3cqw; letter-spacing:.1em; }
.rpt-reserva .rpt-gauge{ border-color:#ff1744; box-shadow:0 0 0 .3cqw #111,0 0 2.5cqw rgba(255,23,68,.9); }
.rpt-reserva .rpt-gauge-txt{ color:#ff1744; animation:rptParpadeo .4s steps(2) infinite; }
.rpt-lleno .rpt-gauge{ border-color:#76ff03; box-shadow:0 0 0 .3cqw #111,0 0 2.5cqw rgba(118,255,3,.8); }
.rpt-lleno .rpt-gauge-txt{ color:#76ff03; }
.rpt-aguja{ transform-origin:100px 100px; transform:rotate(-80deg); transition:transform .7s cubic-bezier(.3,1.6,.5,1); }
.rpt-reserva .rpt-aguja{ animation:rptAguja .25s ease-in-out infinite alternate; }
@keyframes rptAguja{ from{transform:rotate(-84deg)} to{transform:rotate(-76deg)} }
.rpt-luz-reserva{ opacity:.25; } .rpt-reserva .rpt-luz-reserva{ opacity:1; animation:rptParpadeo .4s steps(2) infinite; }

.rpt-marcador{ position:absolute; top:2.2cqw; right:2.4cqw; min-width:11cqw; display:grid; justify-items:center; padding:1cqw 1.2cqw; border-radius:1.2cqw;
  background:rgba(0,0,0,.55); border:.3cqw solid #ffe14d; box-shadow:0 0 2cqw rgba(255,225,77,.5); z-index:7; }
.rpt-marcador span{ font-family:'Press Start 2P',monospace; font-size:.85cqw; color:#ffe14d; }
.rpt-marcador b{ font-family:'Press Start 2P',monospace; font-size:3.4cqw; margin-top:.6cqw; text-shadow:.3cqw .3cqw 0 #ff2d75; font-variant-numeric:tabular-nums;
  animation:rptLate .5s cubic-bezier(.2,1.8,.4,1); }
@keyframes rptLate{ 0%{transform:scale(1.9); color:#ffe14d} 100%{transform:scale(1)} }

.rpt-boxes{ position:absolute; left:0; right:0; bottom:0; width:100%; height:auto; max-height:62cqh; }
.rpt-surtidor{ transform:translateX(-700px); transition:transform .9s cubic-bezier(.2,1.4,.4,1); }
.rpt-con-surtidor .rpt-surtidor{ transform:none; }
.rpt-manguera{ stroke-dasharray:520; stroke-dashoffset:520; transition:stroke-dashoffset .5s ease-out; }
.rpt-enganchada .rpt-manguera{ stroke-dashoffset:0; }
.rpt-chorro{ opacity:0; }
.rpt-enganchada .rpt-chorro{ opacity:1; }
.rpt-repostando .rpt-chorro{ animation:rptChorro .35s linear infinite; }
@keyframes rptChorro{ to{stroke-dashoffset:-36} }
.rpt-coche{ transition:transform 1.1s cubic-bezier(.6,-0.3,.8,.4); }
.rpt-sale .rpt-coche{ transform:translateX(1400px); }
.rpt-cuerpo{ transform-box:fill-box; transform-origin:50% 100%; }
.rpt-reserva .rpt-cuerpo{ animation:rptPetardeo .5s steps(3) infinite; }
@keyframes rptPetardeo{ 0%{transform:translateY(0)} 33%{transform:translate(1px,-1.2px) rotate(-1deg)} 66%{transform:translate(-.6px,0) rotate(1deg)} }
.rpt-bote-0{ animation:rptBote0 .6s cubic-bezier(.2,1.8,.4,1); } .rpt-bote-1{ animation:rptBote1 .6s cubic-bezier(.2,1.8,.4,1); }
@keyframes rptBote0{ 0%{transform:scale(1)} 30%{transform:scale(1.08,.9)} 60%{transform:scale(.96,1.08) translateY(-3px)} 100%{transform:none} }
@keyframes rptBote1{ 0%{transform:scale(1)} 30%{transform:scale(1.08,.9)} 60%{transform:scale(.96,1.08) translateY(-3px)} 100%{transform:none} }
.rpt-rueda{ transform-box:fill-box; transform-origin:center; }
.rpt-rugiendo .rpt-rueda,.rpt-sale .rpt-rueda{ animation:rptRueda .1s linear infinite; }
@keyframes rptRueda{ to{transform:rotate(360deg)} }
.rpt-llamas{ opacity:0; }
.rpt-rugiendo .rpt-llamas,.rpt-sale .rpt-llamas{ opacity:1; }
.rpt-llamas path{ transform-box:fill-box; transform-origin:100% 50%; animation:rptLlama .08s linear infinite alternate; }
@keyframes rptLlama{ from{transform:scaleX(.7)} to{transform:scaleX(1.25)} }
.rpt-humo{ opacity:0; transform-box:fill-box; transform-origin:center; }
.rpt-reserva .rpt-humo{ animation:rptHumo 1.1s ease-out infinite; }
.rpt-reserva .rpt-h2{ animation-delay:.4s; } .rpt-reserva .rpt-h3{ animation-delay:.75s; }
@keyframes rptHumo{ 0%{opacity:.8; transform:translate(0,0) scale(.4)} 100%{opacity:0; transform:translate(-90px,-60px) scale(1.6)} }
.rpt-estela{ opacity:0; }
.rpt-sale .rpt-estela{ animation:rptEstela .9s ease-out forwards; }
@keyframes rptEstela{ 0%{opacity:1} 100%{opacity:0} }

.rpt-mas{ position:absolute; font-family:'Press Start 2P',monospace; font-size:3.6cqw; color:#76ff03; text-shadow:.35cqw .35cqw 0 #1b5e20,0 0 2cqw #76ff03; z-index:9;
  animation:rptMas 1.1s ease-out forwards; pointer-events:none; }
@keyframes rptMas{ 0%{transform:translateY(0) scale(.3); opacity:0} 25%{transform:translateY(-3cqw) scale(1.3); opacity:1} 100%{transform:translateY(-12cqw) scale(1); opacity:0} }
.rpt-glug{ position:absolute; font-family:'Press Start 2P',monospace; font-size:1.5cqw; color:#160b38; background:#fff; padding:.8cqw 1cqw; border-radius:1cqw;
  border:.35cqw solid #ff9100; box-shadow:.4cqw .4cqw 0 #ff9100; z-index:9; white-space:nowrap; animation:rptGlug .9s cubic-bezier(.2,1.8,.4,1) forwards; }
@keyframes rptGlug{ 0%{transform:scale(0) rotate(-15deg)} 25%{transform:scale(1.15) rotate(4deg)} 40%{transform:scale(1) rotate(-2deg)} 80%{opacity:1} 100%{opacity:0; transform:translateY(-2cqw)} }

.rpt-final{ position:absolute; inset:0; z-index:20; display:grid; place-items:center; pointer-events:none; }
.rpt-final-caja{ text-align:center; padding:2cqw 4cqw; border-radius:2cqw; background:rgba(7,3,26,.72); border:.45cqw solid #76ff03;
  box-shadow:0 0 0 .5cqw #0d2e00,0 0 6cqw rgba(118,255,3,.55); animation:rptCaja .7s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes rptCaja{ from{transform:scale(0)} to{transform:scale(1)} }
.rpt-final-icono{ font-size:5cqw; line-height:1; }
.rpt-final-mas{ font-family:'Press Start 2P',monospace; font-size:9cqw; color:#76ff03; text-shadow:.6cqw .6cqw 0 #1b5e20,0 0 4cqw #76ff03; line-height:1.1; margin-top:.6cqw; }
.rpt-final-palabra{ font-family:'Press Start 2P',monospace; font-size:2.2cqw; margin-top:.6cqw; letter-spacing:.06em; }
.rpt-final-palabra em{ font-style:normal; color:#ff9100; }
.rpt-final-total{ margin-top:1.6cqw; font-weight:900; font-size:2.6cqw; color:#ffe14d; }
.rpt-final-total strong{ font-size:3.6cqw; text-shadow:.25cqw .25cqw 0 #ff2d75; }
.rpt-final-puesto{ margin-top:.8cqw; font-family:'Press Start 2P',monospace; font-size:1.6cqw; color:#fff; }
.rpt-final-app{ margin-top:1cqw; font-weight:800; font-size:1.8cqw; color:#7cf9ff; }
.rpt-fuego{ position:absolute; width:0; height:0; }
.rpt-fuego span{ position:absolute; width:.7cqw; height:.7cqw; border-radius:50%; opacity:0; animation:rptChispa 1.3s ease-out forwards; }
@keyframes rptChispa{ 0%{opacity:1; transform:rotate(var(--a)) translateX(0)} 100%{opacity:0; transform:rotate(var(--a)) translateX(10cqw)} }
.rpt-confeti{ position:absolute; top:-3cqw; width:.9cqw; height:1.5cqw; opacity:0; animation:rptConfeti linear forwards; }
@keyframes rptConfeti{ 0%{opacity:1; transform:translateY(0) rotate(0)} 100%{opacity:1; transform:translateY(110cqh) rotate(720deg)} }
`}</style>
  );
}
