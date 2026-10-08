// CLIENTE DEL MES · la carrera.
//
// Cada cliente es un carril: su nombre al principio, una barra que avanza
// con sus puntos, un carrito de la compra en la punta y, al final del
// carril (la meta), un cofre del tesoro. Al llegar a la meta el cofre se
// abre. Se usa en la TV grande, en el móvil del cliente y en el Admin.
import { useEffect, useState } from "react";
import { diasRestantesMes, nombreMes } from "../../utils/clienteMes";
import { sonidoMarchaAtras } from "../../utils/sonido8bits";

const CARRILES = [
  ["#ff3d7f", "#ff8a3d"],
  ["#00e5ff", "#2979ff"],
  ["#76ff03", "#00c853"],
  ["#ffea00", "#ff9100"],
  ["#d500f9", "#651fff"],
  ["#1de9b6", "#00b0ff"],
  ["#ff6e40", "#ff1744"],
  ["#c6ff00", "#64dd17"],
  ["#ea80fc", "#7c4dff"],
  ["#40c4ff", "#18ffff"],
];

const MEDALLAS = ["🥇", "🥈", "🥉"];

export default function CarreraClienteMes({ datos, variante = "movil", maxFilas = null, cargando = false, celebracion = null, broma = false }) {
  const [arrancado, setArrancado] = useState(false);
  // BROMA AL LÍDER (solo TV grande, se activa en Admin → Cliente del mes):
  // el que va 1º aparece en el puesto 10 con -50 puntos y su carrito va
  // marcha atrás. Solo cambia lo que se ve: sus puntos reales no se tocan.
  const bromaActiva = Boolean(broma) && variante === "tv";
  useEffect(() => {
    if (!bromaActiva) return undefined;
    const t = window.setTimeout(() => sonidoMarchaAtras(), 600);
    return () => window.clearTimeout(t);
  }, [bromaActiva]);

  // Primero se pinta todo en la salida y al instante siguiente arrancan los
  // carritos: así se ve la animación de la barra creciendo.
  useEffect(() => {
    const t = window.setTimeout(() => setArrancado(true), 120);
    return () => window.clearTimeout(t);
  }, []);

  if (!datos) {
    return (
      <div className={`cm-raiz cm-${variante}`}>
        <EstilosCarrera />
        <div className="cm-vacio">{cargando ? "Cargando la carrera..." : "La carrera no está disponible."}</div>
      </div>
    );
  }

  const meta = Math.max(1, Number(datos.meta_puntos) || 100);
  let todas = Array.isArray(datos.filas) ? datos.filas : [];
  if (bromaActiva) todas = aplicarBromaLider(todas);
  let filas = maxFilas ? todas.slice(0, maxFilas) : todas;
  // En el móvil, si el cliente está más abajo del corte, se añade su fila.
  const miFila = todas.find((f) => f.es_yo);
  const yoFuera = miFila && maxFilas && miFila.posicion > maxFilas;
  if (yoFuera) filas = [...filas, miFila];

  const mismoMes = String(datos.hoy || "").slice(0, 7) === String(datos.mes || "").slice(0, 7);
  const empezado = datos.empezado !== false;
  const quedan = mismoMes && empezado ? diasRestantesMes(datos.hoy) : null;
  const inicioTexto = fechaLarga(datos.fecha_inicio);
  const premios = Array.isArray(datos.premios) ? datos.premios.slice(0, 3) : [];
  const podioAnterior = Array.isArray(datos.podio_anterior) ? datos.podio_anterior : [];
  const mes = nombreMes(datos.mes);

  return (
    <div className={`cm-raiz cm-${variante}`}>
      <EstilosCarrera />
      <div className="cm-estrellas" aria-hidden="true" />

      <header className="cm-cabecera">
        <div className="cm-titulo-bloque">
          <div className="cm-kicker">CASH LOJO · RACE</div>
          <h2 className="cm-titulo">
            <span className="cm-copa">🏆</span> CLIENTE DEL MES
          </h2>
          <div className="cm-mes">{mes.toUpperCase()}</div>
        </div>
        {!empezado && (
          <div className="cm-contador cm-contador-inicio">
            <span className="cm-contador-txt">EMPIEZA</span>
            <span className="cm-contador-inicio-fecha">{inicioTexto || "PRONTO"}</span>
          </div>
        )}
        {quedan != null && (
          <div className="cm-contador">
            <span className="cm-contador-num">{quedan}</span>
            <span className="cm-contador-txt">{quedan === 1 ? "DÍA" : "DÍAS"}</span>
            <span className="cm-contador-sub">para el final</span>
          </div>
        )}
      </header>

      <div className="cm-info">
        <div className="cm-niveles">
          <div className="cm-nivel cm-nivel-alto">
            <span className="cm-nivel-pts">+{datos.puntos_alto}</span>
            <span className="cm-nivel-txt">
              {datos.min_art_cajas} artículos en cajas <em>o</em> {datos.min_art_unidades} artículos × {datos.min_uds_por_articulo} uds
            </span>
          </div>
          <div className="cm-nivel cm-nivel-medio">
            <span className="cm-nivel-pts">+{datos.puntos_medio}</span>
            <span className="cm-nivel-txt">
              {datos.medio_art_cajas} artículos en cajas <em>o</em> {datos.medio_art_unidades} artículos × {datos.medio_uds_por_articulo} uds
            </span>
          </div>
          <div className="cm-nivel cm-nivel-base">
            <span className="cm-nivel-pts">+{datos.puntos_base}</span>
            <span className="cm-nivel-txt">Por pedir con la App</span>
          </div>
        </div>

        {premios.some(Boolean) && (
          <div className="cm-podio-premios">
            {premios.map((premio, i) =>
              premio ? (
                <div key={i} className={`cm-premio-puesto cm-premio-puesto-${i + 1}`}>
                  <span className="cm-premio-medalla">{MEDALLAS[i]}</span>
                  <span className="cm-premio-puesto-txt">{premio}</span>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>


      <div className="cm-pista">
        {filas.length === 0 && (
          <div className="cm-vacio">
            {empezado
              ? `🏁 ¡La carrera de ${mes} acaba de empezar! El primer pedido por la App arranca el primer carrito.`
              : `🏁 La carrera empieza ${inicioTexto ? `el ${inicioTexto}` : "muy pronto"}. ¡Prepara tu carrito!`}
          </div>
        )}

        {filas.map((fila, indice) => {
          if (fila.broma) {
            return (
              <div key={`broma-${fila.nombre}`}>
                <div className="cm-fila cm-fila-broma" style={{ animationDelay: `${indice * 70}ms` }}>
                  <div className="cm-pos">
                    <span className="cm-pos-num">{fila.posicion}</span>
                  </div>
                  <div className="cm-carril">
                    <div className="cm-asfalto">
                      <div className="cm-relleno-atras" />
                      <div className="cm-nombre cm-nombre-broma">
                        <span className="cm-nombre-txt">{fila.nombre}</span>
                        <span className="cm-atras-txt">🔙 MARCHA ATRÁS</span>
                      </div>
                      <div className="cm-carro cm-carro-atras">
                        <span className="cm-puntos cm-puntos-broma">-50</span>
                        <Carrito color="#ff1744" />
                      </div>
                    </div>
                    <div className="cm-meta">
                      <Cofre abierto={false} />
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          const puntos = Number(fila.puntos) || 0;
          const pct = arrancado ? Math.min(1, puntos / meta) : 0;
          const [c1, c2] = CARRILES[(fila.posicion - 1) % CARRILES.length];
          const enMeta = puntos >= meta;
          const lider = fila.posicion === 1 && puntos > 0;
          const celebra = celebracion?.nombre && celebracion.nombre === fila.nombre;
          return (
            <div key={`${fila.posicion}-${fila.nombre}`}>
              {yoFuera && indice === filas.length - 1 && <div className="cm-separador">· · ·</div>}
              <div
                className={`cm-fila${fila.es_yo ? " cm-fila-yo" : ""}${lider ? " cm-fila-lider" : ""}${celebra ? " cm-fila-celebra" : ""}`}
                style={{ "--c1": c1, "--c2": c2, animationDelay: `${indice * 70}ms` }}
              >
                <div className="cm-pos">
                  {fila.posicion <= 3 ? (
                    <span className="cm-medalla">{MEDALLAS[fila.posicion - 1]}</span>
                  ) : (
                    <span className="cm-pos-num">{fila.posicion}</span>
                  )}
                </div>

                <div className="cm-carril">
                  <div className="cm-asfalto">
                    {fila.es_yo && <span className="cm-tu">TÚ</span>}
                    <div
                      className="cm-relleno"
                      style={{ width: `calc(var(--zona) + ${pct} * (100% - var(--zona) - var(--carro)) + var(--carro) * 0.5)` }}
                    />
                    <div className="cm-nombre">
                      <span className="cm-nombre-txt">{fila.nombre}</span>
                    </div>
                    <div
                      className={`cm-carro${pct > 0 ? " cm-carro-movido" : ""}`}
                      style={{ left: `calc(var(--zona) + ${pct} * (100% - var(--zona) - var(--carro)))` }}
                    >
                      {lider && <span className="cm-corona">👑</span>}
                      <span className="cm-puntos">{puntos}</span>
                      <Carrito color={c1} />
                    </div>
                  </div>
                  <div className="cm-meta">
                    <Cofre abierto={enMeta} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <footer className="cm-pie">
        Meta: {meta} puntos · Premio para el podio (1º, 2º y 3º) el último día del mes · Si hay empate, va delante quien llegó antes
        {podioAnterior.length > 0 && (
          <div className="cm-anterior">
            🏆 Podio de {nombreMes(datos.mes_anterior)}:{" "}
            {podioAnterior.map((f, i) => (
              <span key={i}>
                {i > 0 && " · "}
                {MEDALLAS[f.posicion - 1]} <strong>{f.nombre}</strong> ({f.puntos} pts)
              </span>
            ))}
          </div>
        )}
      </footer>
    </div>
  );
}

// Quita al líder de arriba, sube a los demás un puesto y lo mete en el
// puesto 10 (o el último, si hay menos) con -50 puntos.
function aplicarBromaLider(filas) {
  const lider = filas.find((f) => f.posicion === 1 && Number(f.puntos) > 0);
  if (!lider) return filas;
  const resto = filas.filter((f) => f !== lider);
  const hueco = Math.min(9, resto.length);
  resto.splice(hueco, 0, { ...lider, puntos: -50, broma: true, es_yo: false });
  return resto.map((f, i) => ({ ...f, posicion: i + 1 }));
}

const MESES_CORTOS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
// "2026-10-15" -> "15 OCT"
function fechaLarga(iso) {
  if (!iso) return "";
  const [, m, d] = String(iso).split("-").map(Number);
  return `${d} ${MESES_CORTOS[m - 1] || ""}`;
}

export function Carrito({ color }) {
  return (
    <svg className="cm-carrito" viewBox="0 0 64 50" aria-hidden="true">
      {/* cajas dentro */}
      <rect x="22" y="3" width="14" height="11" rx="1.5" fill="#c58b4e" stroke="#7a4a1d" strokeWidth="1.5" />
      <rect x="35" y="0" width="13" height="14" rx="1.5" fill="#e0a868" stroke="#7a4a1d" strokeWidth="1.5" />
      <rect x="47" y="5" width="9" height="9" rx="1.5" fill="#d99a57" stroke="#7a4a1d" strokeWidth="1.5" />
      {/* asa */}
      <path d="M2 8 H11 L19 33" fill="none" stroke="#e5e7eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {/* cesta */}
      <path d="M13 13 H61 L55 33 H19 Z" fill={color} stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M25 13 L27 33 M37 13 V33 M49 13 L47 33 M16 23 H58" stroke="rgba(255,255,255,.55)" strokeWidth="1.6" />
      <path d="M19 33 L21 38 H54" fill="none" stroke="#e5e7eb" strokeWidth="3" strokeLinecap="round" />
      {/* ruedas */}
      <g className="cm-rueda" style={{ transformOrigin: "25px 43px" }}>
        <circle cx="25" cy="43" r="6" fill="#111827" stroke="#e5e7eb" strokeWidth="2" />
        <path d="M25 38 V48 M20 43 H30" stroke="#9ca3af" strokeWidth="1.5" />
      </g>
      <g className="cm-rueda" style={{ transformOrigin: "50px 43px" }}>
        <circle cx="50" cy="43" r="6" fill="#111827" stroke="#e5e7eb" strokeWidth="2" />
        <path d="M50 38 V48 M45 43 H55" stroke="#9ca3af" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

export function Cofre({ abierto }) {
  return (
    <svg className={`cm-cofre${abierto ? " cm-cofre-abierto" : ""}`} viewBox="0 0 64 60" aria-hidden="true">
      <defs>
        <radialGradient id="cmGlow">
          <stop offset="0%" stopColor="#fff59d" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffca28" stopOpacity="0" />
        </radialGradient>
      </defs>
      {abierto && <circle className="cm-brillo" cx="32" cy="24" r="24" fill="url(#cmGlow)" />}
      {abierto && (
        <path d="M9 31 L12 6 H52 L55 31 Z" fill="#a0632c" stroke="#3e2210" strokeWidth="2.5" strokeLinejoin="round" />
      )}
      {/* cuerpo */}
      <rect x="7" y="30" width="50" height="26" rx="3" fill="#8d5524" stroke="#3e2210" strokeWidth="2.5" />
      <rect x="7" y="30" width="50" height="5" fill="#6d3f19" />
      <rect x="14" y="30" width="5" height="26" fill="#f6c343" stroke="#8a6212" strokeWidth="1" />
      <rect x="45" y="30" width="5" height="26" fill="#f6c343" stroke="#8a6212" strokeWidth="1" />
      {/* tapa */}
      {abierto ? (
        <g>
          <circle cx="20" cy="29" r="5" fill="#ffd54f" stroke="#b7791f" strokeWidth="1.3" />
          <circle cx="30" cy="27" r="5.5" fill="#ffe082" stroke="#b7791f" strokeWidth="1.3" />
          <circle cx="41" cy="28" r="5" fill="#ffd54f" stroke="#b7791f" strokeWidth="1.3" />
          <path d="M34 20 l1.5 3 3 .4 -2.2 2 .6 3 -2.9 -1.5 -2.9 1.5 .6 -3 -2.2 -2 3 -.4z" fill="#fff" className="cm-brillo" />
        </g>
      ) : (
        <path d="M7 31 V24 Q7 12 32 12 Q57 12 57 24 V31 Z" fill="#a0632c" stroke="#3e2210" strokeWidth="2.5" />
      )}
      {!abierto && (
        <>
          <path d="M14 30 V16 M50 30 V16" stroke="#f6c343" strokeWidth="5" />
          <rect x="27" y="26" width="10" height="12" rx="2" fill="#ffd54f" stroke="#8a6212" strokeWidth="1.5" />
          <circle cx="32" cy="31" r="1.8" fill="#3e2210" />
          <rect x="31.2" y="31" width="1.6" height="4" fill="#3e2210" />
        </>
      )}
    </svg>
  );
}

function EstilosCarrera() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rubik:wght@600;800;900&display=swap');

.cm-raiz{
  --alto:46px; --carro:calc(var(--alto) * 1.22); --meta:calc(var(--alto) * 1.05); --nombre:14px; --zona:150px;
  position:relative; overflow:hidden; color:#fff; font-family:'Rubik',system-ui,sans-serif;
  background:radial-gradient(ellipse at 50% -10%,#3b1d7a 0%,#160b38 45%,#090418 100%);
  border-radius:20px; padding:18px 16px 14px; box-sizing:border-box;
}
.cm-tv{ --alto:clamp(42px,5vh,72px); --nombre:clamp(16px,1.5vw,28px); --zona:clamp(200px,19vw,380px);
  border-radius:0; position:fixed; inset:0; overflow:hidden auto; padding:2.2vh 2.4vw; display:flex; flex-direction:column; }
.cm-admin{ --alto:44px; --zona:170px; }
.cm-estrellas{ position:absolute; inset:0; pointer-events:none; opacity:.55;
  background-image:radial-gradient(1.5px 1.5px at 10% 20%,#fff 50%,transparent 51%),radial-gradient(1px 1px at 30% 70%,#fff 50%,transparent 51%),
  radial-gradient(1.5px 1.5px at 55% 15%,#fff 50%,transparent 51%),radial-gradient(1px 1px at 75% 55%,#fff 50%,transparent 51%),
  radial-gradient(1.5px 1.5px at 90% 30%,#fff 50%,transparent 51%),radial-gradient(1px 1px at 45% 90%,#fff 50%,transparent 51%);
  animation:cmTitilar 4s ease-in-out infinite alternate; }
@keyframes cmTitilar{ from{opacity:.25} to{opacity:.7} }

.cm-cabecera{ position:relative; display:flex; justify-content:space-between; align-items:center; gap:12px; }
.cm-kicker{ font-family:'Press Start 2P',monospace; font-size:9px; letter-spacing:2px; color:#7cf9ff; opacity:.85; }
.cm-titulo{ margin:6px 0 4px; font-family:'Press Start 2P',monospace; font-size:18px; line-height:1.3; color:#ffe14d;
  text-shadow:3px 3px 0 #ff2d75, 6px 6px 0 rgba(0,0,0,.45); }
.cm-copa{ display:inline-block; animation:cmSaltito 1.6s ease-in-out infinite; }
@keyframes cmSaltito{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px) rotate(-6deg)} }
.cm-mes{ font-family:'Press Start 2P',monospace; font-size:11px; color:#fff; letter-spacing:3px; }
.cm-contador{ display:grid; justify-items:center; padding:8px 12px; border-radius:14px; background:rgba(0,0,0,.35);
  border:2px solid #7cf9ff; box-shadow:0 0 14px rgba(124,249,255,.45); min-width:70px; }
.cm-contador-num{ font-family:'Press Start 2P',monospace; font-size:22px; color:#7cf9ff; }
.cm-contador-txt{ font-family:'Press Start 2P',monospace; font-size:8px; margin-top:4px; }
.cm-contador-sub{ font-size:10px; opacity:.75; margin-top:2px; }

.cm-reglas{ position:relative; display:flex; flex-wrap:wrap; gap:6px; margin:12px 0 8px; }
.cm-chip{ font-size:11px; font-weight:800; padding:5px 9px; border-radius:999px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.2); }
.cm-chip-oro{ background:linear-gradient(90deg,#ffe14d,#ffb300); color:#3b1d00; border:0; }
.cm-info{ position:relative; display:grid; gap:10px; margin:12px 0 8px; }
.cm-tv .cm-info{ grid-template-columns:1.25fr 1fr; gap:1.4vw; margin:1.2vh 0 .4vh; align-items:stretch; }
.cm-niveles{ display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
.cm-nivel{ display:flex; align-items:center; gap:8px; padding:7px 9px; border-radius:12px; background:rgba(255,255,255,.08); border:2px solid rgba(255,255,255,.15); }
.cm-nivel-pts{ font-family:'Press Start 2P',monospace; font-size:14px; flex:none; }
.cm-nivel-txt{ font-size:11px; font-weight:800; line-height:1.25; }
.cm-nivel-txt em{ font-style:normal; color:#7cf9ff; }
.cm-nivel-alto{ border-color:#ffe14d; } .cm-nivel-alto .cm-nivel-pts{ color:#ffe14d; }
.cm-nivel-medio{ border-color:#7cf9ff; } .cm-nivel-medio .cm-nivel-pts{ color:#7cf9ff; }
.cm-nivel-base .cm-nivel-pts{ color:#c4b5fd; }
.cm-nivel-nota{ grid-column:1/-1; font-size:10.5px; opacity:.8; text-align:center; }
.cm-podio-premios{ display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
.cm-premio-puesto{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; padding:8px 6px; border-radius:12px; text-align:center;
  background:linear-gradient(180deg,rgba(255,225,77,.2),rgba(255,45,117,.12)); border:2px dashed rgba(255,225,77,.6); }
.cm-premio-puesto-1{ border-style:solid; border-color:#ffe14d; box-shadow:0 0 14px rgba(255,225,77,.35); }
.cm-premio-medalla{ font-size:24px; animation:cmSaltito 1.6s ease-in-out infinite; }
.cm-premio-puesto-2 .cm-premio-medalla{ animation-delay:.2s; } .cm-premio-puesto-3 .cm-premio-medalla{ animation-delay:.4s; }
.cm-premio-puesto-txt{ font-size:11.5px; font-weight:800; line-height:1.2; }
.cm-tv .cm-nivel{ padding:.8vh .7vw; } .cm-tv .cm-nivel-pts{ font-size:clamp(14px,1.4vw,26px); }
.cm-tv .cm-nivel-txt{ font-size:clamp(11px,.9vw,17px); } .cm-tv .cm-nivel-nota{ font-size:clamp(10px,.8vw,15px); }
.cm-tv .cm-premio-medalla{ font-size:clamp(22px,2.2vw,40px); } .cm-tv .cm-premio-puesto-txt{ font-size:clamp(12px,1vw,19px); }
@media (max-width:420px){ .cm-movil .cm-niveles{ grid-template-columns:1fr; } }
.cm-premio{ position:relative; display:flex; align-items:center; gap:10px; margin:6px 0 10px; padding:9px 12px; border-radius:12px;
  background:linear-gradient(90deg,rgba(255,225,77,.22),rgba(255,45,117,.18)); border:2px dashed #ffe14d; font-weight:800; font-size:14px; }
.cm-premio-icono{ font-size:22px; animation:cmSaltito 1.2s ease-in-out infinite; }
.cm-premio-label{ font-family:'Press Start 2P',monospace; font-size:9px; color:#ffe14d; margin-right:4px; }
.cm-pruebas{ position:relative; margin:4px 0 8px; padding:6px 10px; border-radius:8px; background:#ff2d75; font-size:12px; font-weight:800; text-align:center; }

.cm-pista{ position:relative; display:grid; gap:8px; margin-top:6px; }
.cm-tv .cm-pista{ flex:1; align-content:start; gap:1.1vh; margin-top:1.4vh; }
.cm-tv .cm-reglas{ margin:1vh 0 .6vh; }
.cm-tv .cm-premio{ margin:.4vh 0 .6vh; padding:.7vh 1vw; }
.cm-fila{ display:flex; align-items:center; gap:8px; animation:cmEntrar .5s ease-out both; }
@keyframes cmEntrar{ from{opacity:0; transform:translateX(-24px)} to{opacity:1; transform:none} }
.cm-pos{ width:34px; flex:none; display:grid; place-items:center; }
.cm-tv .cm-pos{ width:clamp(40px,3.6vw,70px); }
.cm-medalla{ font-size:26px; filter:drop-shadow(0 2px 3px rgba(0,0,0,.5)); }
.cm-tv .cm-medalla{ font-size:clamp(26px,2.6vw,48px); line-height:1; }
.cm-pos-num{ font-family:'Press Start 2P',monospace; font-size:13px; color:#c4b5fd; }
.cm-tv .cm-pos-num{ font-size:clamp(14px,1.4vw,26px); }

.cm-carril{ flex:1; min-width:0; display:flex; align-items:center; gap:4px; }
.cm-asfalto{ position:relative; flex:1; min-width:0; height:var(--alto); border-radius:12px;
  background:repeating-linear-gradient(90deg,rgba(255,255,255,.18) 0 16px,transparent 16px 34px) center/100% 2px no-repeat,#1f1846;
  border:2px solid rgba(255,255,255,.12); box-shadow:inset 0 3px 8px rgba(0,0,0,.5); }
.cm-asfalto::after{ content:""; position:absolute; right:0; top:0; bottom:0; width:10px; border-radius:0 10px 10px 0;
  background:repeating-conic-gradient(#fff 0 25%,#111 0 50%) 0 0/10px 10px; opacity:.8; }
.cm-relleno{ position:absolute; left:0; top:0; bottom:0; border-radius:10px;
  background:repeating-linear-gradient(115deg,rgba(255,255,255,.18) 0 10px,transparent 10px 22px),linear-gradient(90deg,var(--c2),var(--c1));
  background-size:44px 100%,100% 100%; box-shadow:0 0 14px var(--c1);
  transition:width 2.2s cubic-bezier(.22,.9,.3,1); animation:cmRayas 1s linear infinite; }
@keyframes cmRayas{ from{background-position:0 0,0 0} to{background-position:44px 0,0 0} }
.cm-nombre{ position:absolute; left:10px; top:0; bottom:0; width:calc(var(--zona) - 14px); display:flex; align-items:center; gap:6px;
  font-weight:900; font-size:var(--nombre); line-height:1.1; letter-spacing:.2px;
  text-shadow:0 2px 0 rgba(0,0,0,.7),0 0 6px rgba(0,0,0,.6); z-index:1; }
.cm-nombre-txt{ display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:normal; overflow-wrap:break-word; hyphens:auto; }
.cm-tv .cm-nombre-txt{ -webkit-line-clamp:1; display:block; white-space:nowrap; text-overflow:ellipsis; }
.cm-tu{ position:absolute; top:-9px; left:8px; z-index:4; padding:2px 6px; border-radius:6px; background:#ffe14d; color:#3b1d00; font-family:'Press Start 2P',monospace; font-size:8px; box-shadow:0 2px 0 #b7791f; }
.cm-carro{ position:absolute; bottom:-2px; width:var(--carro); z-index:2; transition:left 2.2s cubic-bezier(.22,.9,.3,1); }
.cm-carrito{ display:block; width:100%; height:auto; filter:drop-shadow(0 3px 2px rgba(0,0,0,.55)); }
.cm-carro-movido .cm-carrito{ animation:cmBote .45s ease-in-out infinite alternate; }
@keyframes cmBote{ from{transform:translateY(0)} to{transform:translateY(-2px) rotate(-1.5deg)} }
.cm-rueda{ animation:cmGirar .5s linear infinite; }
@keyframes cmGirar{ to{transform:rotate(360deg)} }
.cm-puntos{ position:absolute; top:-14px; right:-4px; z-index:3; font-family:'Press Start 2P',monospace; font-size:10px;
  padding:4px 5px; border-radius:6px; background:#fff; color:#160b38; box-shadow:0 2px 0 var(--c2); }
.cm-tv .cm-puntos{ font-size:clamp(10px,1vw,18px); top:clamp(-22px,-1.4vw,-14px); }
.cm-corona{ position:absolute; top:-20px; left:40%; font-size:18px; animation:cmSaltito 1s ease-in-out infinite; }
.cm-tv .cm-corona{ font-size:clamp(18px,2vw,34px); top:clamp(-34px,-2.2vw,-20px); }

.cm-meta{ width:var(--meta); flex:none; display:grid; place-items:center; }
.cm-cofre{ width:100%; height:auto; filter:drop-shadow(0 0 8px rgba(255,214,79,.55)); animation:cmLatido 2.4s ease-in-out infinite; }
.cm-cofre-abierto{ filter:drop-shadow(0 0 16px rgba(255,236,120,.95)); animation:cmLatido 1s ease-in-out infinite; }
@keyframes cmLatido{ 0%,100%{transform:scale(1)} 50%{transform:scale(1.07)} }
.cm-brillo{ animation:cmTitilar 1s ease-in-out infinite alternate; }

.cm-fila-yo .cm-asfalto{ border-color:#ffe14d; box-shadow:0 0 0 2px rgba(255,225,77,.35),inset 0 3px 8px rgba(0,0,0,.5); }
.cm-fila-lider .cm-asfalto{ border-color:rgba(255,225,77,.6); }
.cm-contador-inicio{ border-color:#ffe14d; box-shadow:0 0 14px rgba(255,225,77,.5); }
.cm-contador-inicio-fecha{ font-family:'Press Start 2P',monospace; font-size:14px; color:#ffe14d; margin-top:6px; white-space:nowrap; }
.cm-tv .cm-contador-inicio-fecha{ font-size:clamp(14px,1.8vw,34px); }
.cm-fila-celebra .cm-asfalto{ border-color:#fff; animation:cmDestello .6s ease-in-out 12 alternate; }
@keyframes cmDestello{ from{box-shadow:0 0 0 0 rgba(255,255,255,.0)} to{box-shadow:0 0 28px 6px var(--c1)} }
.cm-celebracion{ position:absolute; inset:0; z-index:20; pointer-events:none; display:grid; place-items:center; overflow:hidden;
  animation:cmFuera 9s ease forwards; }
@keyframes cmFuera{ 0%,85%{opacity:1} 100%{opacity:0} }
.cm-celebracion-caja{ text-align:center; padding:3vh 4vw; border-radius:24px; background:rgba(9,4,24,.88); border:4px solid #ffe14d;
  box-shadow:0 0 40px rgba(255,225,77,.6); animation:cmPop .7s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes cmPop{ from{transform:scale(.3); opacity:0} to{transform:scale(1); opacity:1} }
.cm-celebracion-puntos{ font-family:'Press Start 2P',monospace; font-size:clamp(40px,8vw,140px); color:#ffe14d; text-shadow:6px 6px 0 #ff2d75; }
.cm-celebracion-nombre{ font-weight:900; font-size:clamp(22px,3.4vw,64px); margin-top:2vh; }
.cm-celebracion-sub{ font-family:'Press Start 2P',monospace; font-size:clamp(10px,1.2vw,22px); color:#7cf9ff; margin-top:1.4vh; }
.cm-confeti{ position:absolute; top:-20px; width:12px; height:18px; border-radius:3px; animation:cmCae 3.2s linear infinite; }
@keyframes cmCae{ from{transform:translateY(-20px) rotate(0)} to{transform:translateY(110vh) rotate(720deg)} }
/* Broma al líder: barra roja hacia la izquierda y carrito marcha atrás */
.cm-fila-broma .cm-asfalto{ border-color:#ff1744; animation:cmAlarma 1s ease-in-out infinite alternate; }
@keyframes cmAlarma{ from{box-shadow:inset 0 3px 8px rgba(0,0,0,.5)} to{box-shadow:0 0 22px 2px rgba(255,23,68,.75),inset 0 3px 8px rgba(0,0,0,.5)} }
.cm-relleno-atras{ position:absolute; top:0; bottom:0; right:calc(100% - var(--zona)); width:var(--zona); border-radius:10px 0 0 10px;
  background:repeating-linear-gradient(65deg,rgba(0,0,0,.25) 0 10px,transparent 10px 22px),linear-gradient(270deg,#ff1744,#7f0000);
  background-size:44px 100%,100% 100%; box-shadow:0 0 16px #ff1744;
  animation:cmAtrasCrece 3s cubic-bezier(.3,.9,.3,1) both, cmRayasAtras 1s linear infinite; }
@keyframes cmAtrasCrece{ from{width:0} to{width:var(--zona)} }
@keyframes cmRayasAtras{ from{background-position:0 0,0 0} to{background-position:-44px 0,0 0} }
.cm-relleno-atras::before{ content:""; position:absolute; right:-3px; top:-4px; bottom:-4px; width:4px; background:#fff; border-radius:2px; }
.cm-nombre-broma{ left:calc(var(--zona) + 12px); width:auto; right:calc(var(--meta) * .2); gap:10px; }
.cm-atras-txt{ flex:none; font-family:'Press Start 2P',monospace; font-size:.55em; color:#ff8a80; animation:cmParpadeoAtras .6s steps(2) infinite; }
@keyframes cmParpadeoAtras{ 50%{opacity:.2} }
.cm-carro-atras{ left:0; animation:cmCarroAtras 3s cubic-bezier(.3,.9,.3,1) both; transition:none; }
@keyframes cmCarroAtras{ from{left:calc(var(--zona) - var(--carro))} to{left:0} }
.cm-carro-atras .cm-carrito{ animation:cmTambaleo .35s ease-in-out infinite alternate; }
@keyframes cmTambaleo{ from{transform:rotate(-4deg) translateX(2px)} to{transform:rotate(3deg) translateX(-2px)} }
.cm-carro-atras .cm-rueda{ animation-direction:reverse; }
.cm-puntos-broma{ font-size:1.35em !important; top:-1.1em !important; background:#ff1744; color:#fff; box-shadow:0 2px 0 #7f0000; animation:cmParpadeoAtras 1s steps(2) infinite; }

.cm-separador{ text-align:center; color:#c4b5fd; letter-spacing:6px; font-weight:900; margin:-2px 0 4px; }
.cm-vacio{ position:relative; padding:22px 14px; text-align:center; font-weight:800; font-size:15px; border-radius:14px; background:rgba(255,255,255,.06); border:2px dashed rgba(255,255,255,.2); }
.cm-tv .cm-vacio{ font-size:clamp(18px,2vw,34px); padding:6vh 3vw; }
.cm-pie{ position:relative; margin-top:12px; font-size:11px; opacity:.85; text-align:center; line-height:1.5; }
.cm-anterior{ margin-top:6px; font-size:12px; color:#ffe14d; opacity:1; }

.cm-tv .cm-kicker{ font-size:clamp(9px,.8vw,15px); }
.cm-tv .cm-titulo{ font-size:clamp(20px,2.6vw,48px); }
.cm-tv .cm-mes{ font-size:clamp(11px,1.2vw,22px); }
.cm-tv .cm-contador{ padding:1.2vh 1.4vw; }
.cm-tv .cm-contador-num{ font-size:clamp(22px,3vw,56px); }
.cm-tv .cm-contador-txt{ font-size:clamp(8px,.8vw,14px); }
.cm-tv .cm-contador-sub{ font-size:clamp(10px,.9vw,16px); }
.cm-tv .cm-chip{ font-size:clamp(11px,1.1vw,20px); padding:.6vh 1vw; }
.cm-tv .cm-premio{ font-size:clamp(14px,1.5vw,28px); }
.cm-tv .cm-premio-label{ font-size:clamp(9px,.9vw,16px); }
.cm-tv .cm-pie{ font-size:clamp(11px,1vw,18px); }
.cm-tv .cm-anterior{ font-size:clamp(12px,1.2vw,22px); }

@media (max-width:420px){
  .cm-movil{ --alto:42px; --nombre:12px; --zona:112px; padding:14px 10px 12px; }
  .cm-titulo{ font-size:15px; }
  .cm-pos{ width:28px; }
  .cm-medalla{ font-size:22px; }
}
@media (prefers-reduced-motion:reduce){
  .cm-relleno,.cm-carro{ transition:none; }
  .cm-rueda,.cm-carrito,.cm-cofre,.cm-copa,.cm-corona,.cm-estrellas,.cm-relleno,.cm-premio-icono{ animation:none !important; }
}
`}</style>
  );
}
