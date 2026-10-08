// CLIENTE DEL MES · BROMA AL LÍDER en la TV grande.
//
// Con la broma activada (Admin → Cliente del mes), cuando el cliente que va
// 1º pasa su QR, en lugar de la celebración normal sale esto:
//   0 s    entrada normal (sirena, nombre, semáforo… ¡YA!)
//   4,3 s  bocinazo: parece que va a sumar
//   5,6 s  ¡CRRRRK! marcha atrás «¿DÓNDE VAS, MELÓN?», pitido de camión
//   6,2 s  retrocede de sus puntos a 0 (la barra se encoge)
//   10,2 s cruza el 0: todo rojo, la barra crece hacia la izquierda
//   13,4 s se para en −50: golpe, trombón triste, «VA 10º»
//   18,5 s (si se revela) «¡ES BROMA!»: vuelve a sus puntos reales + los
//          de este pedido, confeti y fanfarria.
// Solo es lo que enseña la TV: los puntos reales ya están sumados.
import { useEffect, useRef, useState } from "react";
import { Carrito } from "./CarreraClienteMes";
import { BROMA_CM, duracionBromaLider } from "../../utils/clienteMes";
import {
  sonidoAcelerar,
  sonidoAlarma,
  sonidoBajada,
  sonidoBocina,
  sonidoEntradaPuntos,
  sonidoGolpe,
  sonidoMoneda,
  sonidoPitidoAtras,
  sonidoRascada,
  sonidoRisa,
  sonidoSemaforo,
  sonidoTrombonTriste,
  sonidoVictoria,
} from "../../utils/sonido8bits";

const MIN = -62;
const MAX = 100;
const COLORES = ["#ffe14d", "#ff3d7f", "#00e5ff", "#76ff03", "#d500f9", "#ff9100"];
const x = (v) => ((v - MIN) / (MAX - MIN)) * 100;

export default function BromaLiderTV({ celebracion, revelar = true, onFin }) {
  const puntosPedido = Math.max(0, Number(celebracion?.puntos) || 0);
  const total = Number(celebracion?.total) || puntosPedido;
  const real = Math.max(0, total - puntosPedido);
  const nombre = celebracion?.nombre || "CLIENTE";
  const posicion = Number(celebracion?.posicion) || null;

  const [fase, setFase] = useState("intro"); // intro -> carrera
  const [luces, setLuces] = useState(0); // 0..3 rojas, 4 verde
  const [valor, setValor] = useState(real);
  const [rojo, setRojo] = useState(false);
  const [marcha, setMarcha] = useState(false);
  const [cartel, setCartel] = useState(null); // { texto, verde }
  const [boca, setBoca] = useState(null); // { texto, rojo, id }
  const [rapido, setRapido] = useState(false);
  const [caja, setCaja] = useState(null); // "menos50" | "real"
  const [confeti, setConfeti] = useState(false);
  const [flash, setFlash] = useState(0);
  const [temblor, setTemblor] = useState(0);
  const [saliendo, setSaliendo] = useState(false);
  const onFinRef = useRef(onFin);
  onFinRef.current = onFin;

  useEffect(() => {
    const timers = [];
    let raf = 0;
    const en = (ms, fn) => timers.push(window.setTimeout(fn, ms));
    const destello = (esRojo = false) => setFlash((n) => (esRojo ? -(Math.abs(n) + 1) : Math.abs(n) + 1));
    const temblar = () => setTemblor((n) => n + 1);
    const bocadillo = (texto, esRojo = false) => {
      const id = Date.now() + Math.random();
      setBoca({ texto, rojo: esRojo, id });
      timers.push(window.setTimeout(() => setBoca((b) => (b?.id === id ? null : b)), 1500));
    };
    const animar = (desde, hasta, ms, alPaso) => {
      window.cancelAnimationFrame(raf);
      const ini = performance.now();
      const paso = (ahora) => {
        const p = Math.min(1, (ahora - ini) / ms);
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const v = desde + (hasta - desde) * e;
        setValor(v);
        if (alPaso) alPaso(v);
        if (p < 1) raf = window.requestAnimationFrame(paso);
      };
      raf = window.requestAnimationFrame(paso);
    };

    // 1. Entrada normal
    destello();
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
    en(4200, () => setFase("carrera"));

    // 2. Parece que va a sumar
    en(4300, () => {
      sonidoBocina(0);
      sonidoAcelerar();
      setRapido(true);
      bocadillo("¡PIIIII!");
      temblar();
      animar(real, real + 2, 600);
    });

    // 3. ¡Marcha atrás!
    en(5600, () => {
      sonidoRascada();
      destello(true);
      temblar();
      setMarcha(true);
      setCartel({ texto: "¿DÓNDE VAS, MELÓN?" });
      bocadillo("¡CRRRRK!", true);
    });
    for (let ms = 6200; ms < BROMA_CM.fin; ms += 650) en(ms, sonidoPitidoAtras);
    en(6200, () => {
      let ultimo = Math.ceil((real + 2) / 5) * 5;
      animar(real + 2, 0, 4000, (v) => {
        const m = Math.floor(v / 5) * 5;
        if (m < ultimo) {
          ultimo = m;
          sonidoBajada(60 + m / 5);
        }
      });
    });

    // 4. Cruza el 0: todo en rojo
    en(10200, () => {
      sonidoAlarma();
      destello(true);
      setRojo(true);
      setCartel({ texto: "¡PUNTOS NEGATIVOS!" });
      let ultimo = 0;
      animar(0, -50, 3200, (v) => {
        const m = Math.ceil(v / 5) * 5;
        if (m < ultimo) {
          ultimo = m;
          sonidoBajada(58 + m / 10);
        }
      });
    });

    // 5. Se para en −50
    en(BROMA_CM.fin, () => {
      sonidoGolpe();
      temblar();
      setRapido(false);
      setCaja("menos50");
    });
    en(BROMA_CM.fin + 700, sonidoTrombonTriste);

    // 6. ¡Es broma!
    if (revelar) {
      en(BROMA_CM.revelacion, () => {
        setRojo(false);
        destello();
        sonidoRisa();
        setCaja(null);
        setMarcha(false);
        setCartel({ texto: "😄 ¡ES BROMA!", verde: true });
        setRapido(true);
        bocadillo("¡ZOOOM!");
        sonidoAcelerar();
        sonidoBocina(1);
        animar(-50, total, 1600);
        setConfeti(true);
      });
      en(BROMA_CM.revelacion + 1800, () => {
        sonidoMoneda();
        sonidoVictoria();
        setRapido(false);
        setCartel(null);
        setCaja("real");
      });
    }

    const duracion = duracionBromaLider(revelar);
    en(duracion - 800, () => setSaliendo(true));
    en(duracion, () => onFinRef.current?.());
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebracion?.id]);

  const cero = x(0);
  const barra =
    valor >= 0
      ? { className: "bl-barra bl-barra-pos", left: `${cero}%`, width: `${x(valor) - cero}%` }
      : { className: "bl-barra bl-barra-neg", left: `${x(valor)}%`, width: `${cero - x(valor)}%` };

  return (
    <div className={`bl-raiz${rojo ? " bl-rojo" : ""}${saliendo ? " bl-saliendo" : ""}`}>
      <EstilosBroma />
      <div className="bl-rayos" aria-hidden="true" />
      <div className={`bl-flash${flash < 0 ? " bl-flash-rojo" : ""}`} key={`f${flash}`} aria-hidden="true" />
      <div className="bl-scan" aria-hidden="true" />

      <div className={`bl-escena${temblor ? ` bl-tiembla-${temblor % 2}` : ""}`}>
        <div className="bl-marquesina">★ CLIENTE DEL MES ★ PEDIDO POR LA APP ★</div>
        <div className={`bl-nombre${fase === "intro" ? " bl-nombre-cae" : " bl-nombre-peque"}`}>{nombre}</div>

        {fase === "intro" && (
          <>
            <div className="bl-semaforo">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={`bl-luz${luces >= n && luces < 4 ? " bl-luz-r" : ""}${luces === 4 ? " bl-luz-v" : ""}`}
                />
              ))}
            </div>
            {luces === 4 && <div className="bl-ya">¡YA!</div>}
          </>
        )}

        {fase === "carrera" && (
          <>
            <div className={`bl-marcador${valor < 0 ? " bl-marcador-neg" : ""}`}>
              <b>PUNTOS</b>
              <span>{Math.round(valor)}</span>
            </div>
            {marcha && <div className="bl-marcha">R</div>}
            {cartel && (
              <div className={`bl-cartel${cartel.verde ? " bl-cartel-verde" : ""}`} key={cartel.texto}>
                {cartel.texto}
              </div>
            )}
            <div className="bl-carrera">
              <div className="bl-pista">
                <div className={barra.className} style={{ left: barra.left, width: barra.width }} />
                <div className="bl-cero" style={{ left: `${cero}%` }}>
                  <i>SALIDA 0</i>
                </div>
                <span className="bl-marca" style={{ left: `${x(-50)}%` }}>-50</span>
                <span className="bl-marca" style={{ left: `${x(50)}%` }}>50</span>
                <span className="bl-marca" style={{ left: `${x(100)}%` }}>META</span>
              </div>
              <div className="bl-bandera">🏁</div>
              <div
                className={`bl-carro${marcha ? " bl-carro-atras" : ""}${rapido ? " bl-carro-rapido" : ""}`}
                style={{ left: `${x(valor)}%` }}
              >
                <Carrito color="#ff3d7f" />
                {boca && (
                  <span key={boca.id}>
                    <span className={`bl-bocadillo${boca.rojo ? " bl-bocadillo-rojo" : ""}`}>{boca.texto}</span>
                    <span className="bl-humo">💨</span>
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {caja === "menos50" && (
          <div className="bl-final">
            <div className="bl-caja">
              <div className="bl-grande">−50</div>
              <div className="bl-linea">PUNTOS</div>
              <div className="bl-etiqueta">🔙 VA 10º EN LA CARRERA</div>
              <div className="bl-sub">{nombre.toUpperCase()}</div>
            </div>
          </div>
        )}
        {caja === "real" && (
          <div className="bl-final">
            <div className="bl-caja bl-caja-oro">
              <div className="bl-grande">+{puntosPedido}</div>
              <div className="bl-linea">TOTAL {total} PUNTOS</div>
              <div className="bl-etiqueta">
                {posicion === 1 ? "👑 ¡SIGUE LÍDER! 👑" : posicion ? `VA ${posicion}º EN LA CARRERA` : "¡A SEGUIR SUMANDO!"}
              </div>
              <div className="bl-sub">😄 ¡ERA BROMA! · {nombre.toUpperCase()}</div>
            </div>
          </div>
        )}
        {confeti &&
          Array.from({ length: 60 }, (_, i) => (
            <span
              key={i}
              className="bl-confeti"
              style={{
                left: `${(i * 37) % 100}%`,
                background: COLORES[i % COLORES.length],
                animationDelay: `${(i % 10) * 0.15}s`,
                animationDuration: `${2.4 + (i % 5) * 0.4}s`,
              }}
            />
          ))}
      </div>
    </div>
  );
}

function EstilosBroma() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rubik:wght@800;900&display=swap');
.bl-raiz{ position:fixed; inset:0; z-index:9000; overflow:hidden; color:#fff; font-family:'Rubik',system-ui,sans-serif;
  background:radial-gradient(ellipse at 50% 30%,#4a1f9a 0%,#1a0b45 45%,#07031a 100%); animation:blEntra .35s ease-out both; }
.bl-rojo{ background:radial-gradient(ellipse at 50% 40%,#7a0a1e 0%,#2a0614 50%,#0b0208 100%); }
.bl-saliendo{ animation:blSale .8s ease-in forwards; }
@keyframes blEntra{ from{opacity:0} to{opacity:1} }
@keyframes blSale{ to{opacity:0; transform:scale(1.04)} }
.bl-rayos{ position:absolute; left:50%; top:45%; width:260vmax; height:260vmax; margin:-130vmax 0 0 -130vmax; opacity:.18; pointer-events:none;
  background:repeating-conic-gradient(#ffe14d 0 6deg,transparent 6deg 18deg); animation:blGira 14s linear infinite; }
.bl-rojo .bl-rayos{ background:repeating-conic-gradient(#ff1744 0 6deg,transparent 6deg 18deg); animation-direction:reverse; animation-duration:5s; opacity:.25; }
@keyframes blGira{ to{transform:rotate(360deg)} }
.bl-scan{ position:absolute; inset:0; z-index:40; pointer-events:none; opacity:.16; background:repeating-linear-gradient(0deg,rgba(0,0,0,.55) 0 2px,transparent 2px 4px); }
.bl-flash{ position:absolute; inset:0; z-index:39; pointer-events:none; background:#fff; animation:blFlash .6s ease-out both; }
.bl-flash-rojo{ background:#ff1744; }
@keyframes blFlash{ from{opacity:.9} to{opacity:0} }

.bl-escena{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; padding:2.4vw 3vw; box-sizing:border-box; }
.bl-tiembla-0{ animation:blTiembla0 .5s ease-out; } .bl-tiembla-1{ animation:blTiembla1 .5s ease-out; }
@keyframes blTiembla0{ 0%,100%{transform:none} 15%{transform:translate(-1.2vw,.5vw) rotate(-.8deg)} 35%{transform:translate(1vw,-.6vw) rotate(.6deg)} 55%{transform:translate(-.6vw,.3vw)} 75%{transform:translate(.4vw,-.2vw)} }
@keyframes blTiembla1{ 0%,100%{transform:none} 15%{transform:translate(1.2vw,-.5vw) rotate(.8deg)} 35%{transform:translate(-1vw,.6vw) rotate(-.6deg)} 55%{transform:translate(.6vw,-.3vw)} 75%{transform:translate(-.4vw,.2vw)} }

.bl-marquesina{ font-family:'Press Start 2P',monospace; font-size:1.3vw; letter-spacing:.3em; color:#7cf9ff; text-shadow:0 0 10px #00e5ff; animation:blParpa .5s steps(2) infinite; }
@keyframes blParpa{ 50%{opacity:.35} }
.bl-nombre{ font-weight:900; font-size:6.2vw; line-height:1.05; color:#ffe14d; text-transform:uppercase; white-space:nowrap; margin-top:1.2vw;
  max-width:94vw; overflow:hidden; text-overflow:ellipsis; text-shadow:.4vw .4vw 0 #ff2d75,.8vw .8vw 0 rgba(0,0,0,.5); }
.bl-nombre-cae{ animation:blCae .8s cubic-bezier(.3,1.8,.5,1) .25s both; }
.bl-nombre-peque{ font-size:3.8vw; margin-top:.6vw; max-width:62vw; }
@keyframes blCae{ 0%{transform:translateY(-40vw) scale(2); opacity:0} 70%{transform:translateY(1vw) scale(.95); opacity:1} 100%{transform:none} }

.bl-semaforo{ display:flex; gap:2.6vw; padding:1.8vw 2.6vw; border-radius:2vw; background:#0b0b14; border:.5vw solid #3f3f46; margin-top:4vw; }
.bl-luz{ width:8vw; aspect-ratio:1; border-radius:50%; background:#2a0a0a; transition:all .12s; }
.bl-luz-r{ background:radial-gradient(circle at 35% 30%,#ffb3b3,#ff1744 45%,#a00 100%); box-shadow:0 0 4vw 1vw rgba(255,23,68,.8); }
.bl-luz-v{ background:radial-gradient(circle at 35% 30%,#d9ffd0,#00e676 45%,#007a33 100%); box-shadow:0 0 5vw 1.4vw rgba(0,230,118,.9); }
.bl-ya{ font-family:'Press Start 2P',monospace; font-size:7vw; color:#00e676; text-shadow:.6vw .6vw 0 #004d26; margin-top:2vw; animation:blZoom .4s cubic-bezier(.2,1.8,.4,1) both; }
@keyframes blZoom{ from{transform:scale(0); opacity:0} to{transform:none; opacity:1} }

.bl-marcador{ position:absolute; top:2.2vw; right:3vw; padding:1vw 1.4vw; min-width:10vw; display:grid; justify-items:center; border-radius:1.4vw;
  background:rgba(0,0,0,.55); border:.35vw solid #ffe14d; box-shadow:0 0 2.4vw rgba(255,225,77,.5); }
.bl-marcador b{ font-family:'Press Start 2P',monospace; font-weight:400; font-size:.95vw; color:#ffe14d; }
.bl-marcador span{ font-family:'Press Start 2P',monospace; font-size:4.4vw; margin-top:.8vw; color:#fff; text-shadow:.35vw .35vw 0 #ff2d75; font-variant-numeric:tabular-nums; }
.bl-marcador-neg{ border-color:#ff1744; box-shadow:0 0 3vw rgba(255,23,68,.9); }
.bl-marcador-neg span{ color:#ff8a80; text-shadow:.35vw .35vw 0 #7f0000; }
.bl-marcha{ position:absolute; top:2.2vw; left:3vw; width:7.5vw; aspect-ratio:1; border-radius:1.2vw; display:grid; place-items:center;
  font-family:'Press Start 2P',monospace; font-size:4vw; color:#fff; background:#7f0000; border:.35vw solid #ff1744; box-shadow:0 0 3vw rgba(255,23,68,.9); animation:blParpa .5s steps(2) infinite; }
.bl-cartel{ position:absolute; left:0; right:0; margin:0 auto; width:max-content; max-width:90%; box-sizing:border-box; text-align:center; top:13.5vw;
  font-family:'Press Start 2P',monospace; font-size:2.6vw; line-height:1.5; color:#fff; padding:1vw 1.6vw; border-radius:1.2vw;
  background:#7f0000; border:.4vw solid #ff1744; box-shadow:0 0 3vw rgba(255,23,68,.8); animation:blZoom .4s cubic-bezier(.2,1.8,.4,1) both; z-index:8; }
.bl-cartel-verde{ background:#1b5e20; border-color:#00e676; box-shadow:0 0 3vw rgba(0,230,118,.8); }

.bl-carrera{ position:absolute; left:3vw; right:3vw; top:23vw; height:20vw; }
.bl-pista{ position:absolute; left:0; right:0; bottom:3vw; height:7vw; border-radius:1.2vw; background:#1f1846; border:.3vw solid rgba(255,255,255,.18);
  box-shadow:inset 0 .5vw 1.2vw rgba(0,0,0,.6); }
.bl-pista::after{ content:""; position:absolute; right:0; top:0; bottom:0; width:1.2vw; border-radius:0 1vw 1vw 0; background:repeating-conic-gradient(#fff 0 25%,#111 0 50%) 0 0/1.2vw 1.2vw; }
.bl-cero{ position:absolute; top:-1.2vw; bottom:-1.2vw; width:.4vw; background:#fff; box-shadow:0 0 1vw #fff; z-index:3; }
.bl-cero i{ position:absolute; top:100%; left:50%; transform:translateX(-50%); margin-top:.5vw; font-style:normal; font-family:'Press Start 2P',monospace; font-size:1vw; white-space:nowrap; }
.bl-marca{ position:absolute; bottom:-2.2vw; transform:translateX(-50%); font-family:'Press Start 2P',monospace; font-size:.9vw; color:#a99cd6; }
.bl-barra{ position:absolute; top:0; bottom:0; border-radius:1vw; z-index:1; }
.bl-barra-pos{ background:repeating-linear-gradient(115deg,rgba(255,255,255,.18) 0 1vw,transparent 1vw 2.2vw),linear-gradient(90deg,#ff8a3d,#ff3d7f); box-shadow:0 0 1.4vw #ff3d7f; }
.bl-barra-neg{ background:repeating-linear-gradient(65deg,rgba(0,0,0,.28) 0 1vw,transparent 1vw 2.2vw),linear-gradient(270deg,#ff1744,#7f0000); box-shadow:0 0 1.8vw #ff1744; }
.bl-bandera{ position:absolute; right:-1vw; bottom:2.6vw; font-size:5vw; }
.bl-carro{ position:absolute; bottom:4.6vw; width:13vw; transform:translateX(-50%); z-index:5; }
.bl-carro .cm-carrito{ display:block; width:100%; height:auto; filter:drop-shadow(0 .8vw .5vw rgba(0,0,0,.6)); }
.bl-carro .cm-rueda{ animation:blRueda .35s linear infinite; }
.bl-carro-rapido .cm-rueda{ animation-duration:.1s; }
.bl-carro-atras .cm-rueda{ animation-direction:reverse; }
.bl-carro-atras .cm-carrito{ animation:blTamb .3s ease-in-out infinite alternate; }
@keyframes blRueda{ to{transform:rotate(360deg)} }
@keyframes blTamb{ from{transform:rotate(-4deg) translateX(.3vw)} to{transform:rotate(3deg) translateX(-.3vw)} }
.bl-bocadillo{ position:absolute; bottom:100%; left:45%; white-space:nowrap; font-family:'Press Start 2P',monospace; font-size:1.7vw; color:#160b38; background:#fff;
  padding:1vw 1.1vw; border-radius:1.2vw; border:.4vw solid #ff2d75; box-shadow:.4vw .4vw 0 #ff2d75; animation:blPop .9s cubic-bezier(.2,1.8,.4,1) both; }
.bl-bocadillo-rojo{ border-color:#ff1744; box-shadow:.4vw .4vw 0 #ff1744; }
@keyframes blPop{ 0%{transform:scale(0) rotate(-14deg)} 30%{transform:scale(1.12) rotate(3deg)} 45%{transform:none} }
.bl-humo{ position:absolute; left:92%; bottom:0; font-size:3.4vw; animation:blHumo .8s ease-out forwards; }
@keyframes blHumo{ from{opacity:1; transform:scale(.6)} to{opacity:0; transform:translateX(6vw) scale(1.6)} }

.bl-final{ position:absolute; inset:0; display:grid; place-items:center; padding-top:9vw; box-sizing:border-box; z-index:20; }
.bl-caja{ text-align:center; padding:2.4vw 4vw; border-radius:2.4vw; background:rgba(9,4,24,.92); border:.5vw solid #ff1744;
  box-shadow:0 0 0 .5vw #7f0000,0 0 6vw rgba(255,23,68,.8); animation:blCaja .8s cubic-bezier(.2,1.7,.4,1) both; }
.bl-caja-oro{ border-color:#ffe14d; box-shadow:0 0 0 .5vw #ff2d75,0 0 7vw rgba(255,225,77,.8); }
@keyframes blCaja{ 0%{transform:scale(.1) rotate(-18deg); opacity:0} 100%{transform:none; opacity:1} }
.bl-grande{ font-family:'Press Start 2P',monospace; font-size:9vw; line-height:1; color:#ff8a80; text-shadow:.7vw .7vw 0 #7f0000; }
.bl-caja-oro .bl-grande{ color:#ffe14d; text-shadow:.7vw .7vw 0 #ff2d75; }
.bl-linea{ font-weight:900; font-size:2.8vw; margin-top:1.4vw; }
.bl-etiqueta{ display:inline-block; margin-top:1.4vw; padding:.9vw 1.6vw; border-radius:1.2vw; font-weight:900; font-size:2.4vw; background:linear-gradient(90deg,#7f0000,#ff1744); }
.bl-caja-oro .bl-etiqueta{ background:linear-gradient(90deg,#ffb300,#ffe14d,#ffb300); color:#3b1d00; }
.bl-sub{ margin-top:1.4vw; font-weight:800; font-size:1.5vw; color:#a99cd6; }
.bl-confeti{ position:absolute; top:-3vw; width:1vw; height:1.6vw; border-radius:2px; animation:blCaeC linear infinite; z-index:30; }
@keyframes blCaeC{ from{transform:translateY(-3vw) rotate(0)} to{transform:translateY(110vh) rotate(900deg)} }
@media (prefers-reduced-motion:reduce){ .bl-rayos,.bl-confeti,.bl-marquesina{ animation:none !important; } }
`}</style>
  );
}
