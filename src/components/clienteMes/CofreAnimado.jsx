// Cofre del tesoro que tiembla, se abre y deja salir el premio.
// Lo usan la ceremonia del podio (TV) y el aviso de premio del móvil.
// El tamaño lo marca el contenedor (ancho) y el tamaño de letra del premio
// el `font-size` que se le pase en `style`.
const MEDALLA_TEXTO = { 1: "1º PREMIO", 2: "2º PREMIO", 3: "3º PREMIO" };

export default function CofreAnimado({ abierto = false, tiembla = false, premio = "", puesto = 1, style, onClick, etiqueta }) {
  return (
    <div
      className={`cofre-anim${abierto ? " cofre-anim-abierto" : ""}${tiembla && !abierto ? " cofre-anim-tiembla" : ""}`}
      style={style}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={etiqueta}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <EstilosCofre />
      <div className="cofre-anim-rayo" />
      <svg viewBox="0 0 64 60" aria-hidden="true">
        <g className="cofre-anim-tapa">
          <path d="M7 31 V24 Q7 12 32 12 Q57 12 57 24 V31 Z" fill="#a0632c" stroke="#3e2210" strokeWidth="2.5" />
          <path d="M14 30 V16 M50 30 V16" stroke="#f6c343" strokeWidth="5" />
        </g>
        <rect x="7" y="30" width="50" height="26" rx="3" fill="#8d5524" stroke="#3e2210" strokeWidth="2.5" />
        <rect x="7" y="30" width="50" height="5" fill="#6d3f19" />
        <rect x="14" y="30" width="5" height="26" fill="#f6c343" stroke="#8a6212" strokeWidth="1" />
        <rect x="45" y="30" width="5" height="26" fill="#f6c343" stroke="#8a6212" strokeWidth="1" />
        <rect x="27" y="27" width="10" height="11" rx="2" fill="#ffd54f" stroke="#8a6212" strokeWidth="1.5" />
        <circle cx="32" cy="31.5" r="1.8" fill="#3e2210" />
        <rect x="31.2" y="31.5" width="1.6" height="4" fill="#3e2210" />
      </svg>
      {premio && (
        <div className="cofre-anim-regalo">
          <span className="cofre-anim-regalo-titulo">{MEDALLA_TEXTO[puesto] || "PREMIO"}</span>
          <span className="cofre-anim-regalo-premio">{premio}</span>
        </div>
      )}
    </div>
  );
}

function EstilosCofre() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rubik:wght@700;800;900&display=swap');
.cofre-anim{ position:relative; width:100%; }
.cofre-anim svg{ display:block; width:100%; height:auto; overflow:visible; position:relative; z-index:1; }
.cofre-anim-tapa{ transform-box:fill-box; transform-origin:50% 100%; transition:transform .55s cubic-bezier(.3,1.6,.5,1); }
.cofre-anim-abierto .cofre-anim-tapa{ transform:translateY(-8%) scaleY(-.55); }
.cofre-anim-tiembla{ animation:cofreAnimTemblor .12s linear infinite; }
@keyframes cofreAnimTemblor{ 0%{transform:rotate(0)} 25%{transform:rotate(-3deg)} 75%{transform:rotate(3deg)} 100%{transform:rotate(0)} }
.cofre-anim-rayo{ position:absolute; left:50%; bottom:45%; width:240%; aspect-ratio:1; transform:translate(-50%,50%) scale(0); border-radius:50%; pointer-events:none; z-index:0;
  background:conic-gradient(from 0deg,rgba(255,236,120,0),rgba(255,236,120,.55) 8%,rgba(255,236,120,0) 16%,rgba(255,236,120,.55) 25%,rgba(255,236,120,0) 33%,rgba(255,236,120,.55) 42%,rgba(255,236,120,0) 50%,rgba(255,236,120,.55) 58%,rgba(255,236,120,0) 66%,rgba(255,236,120,.55) 75%,rgba(255,236,120,0) 83%,rgba(255,236,120,.55) 92%,rgba(255,236,120,0));
  -webkit-mask:radial-gradient(circle,#000 20%,transparent 68%); mask:radial-gradient(circle,#000 20%,transparent 68%); transition:transform .6s ease-out; }
.cofre-anim-abierto .cofre-anim-rayo{ transform:translate(-50%,50%) scale(1); animation:cofreAnimGirar 6s linear infinite; }
@keyframes cofreAnimGirar{ to{ transform:translate(-50%,50%) scale(1) rotate(360deg); } }
.cofre-anim-regalo{ position:absolute; left:50%; bottom:40%; z-index:3; transform:translate(-50%,40%) scale(.2); opacity:0; white-space:nowrap; text-align:center;
  transition:transform .9s cubic-bezier(.2,1.4,.4,1) .15s, opacity .4s .15s;
  background:linear-gradient(180deg,#fffdf0,#fff3c4); color:#2a1600; border:.15em solid #ffb300; border-radius:.5em; padding:.45em .7em; box-shadow:0 0 1.2em rgba(255,225,77,.9); }
.cofre-anim-abierto .cofre-anim-regalo{ opacity:1; transform:translate(-50%,-150%) scale(1); }
.cofre-anim-regalo-titulo{ display:block; font-family:'Press Start 2P',monospace; font-size:.45em; color:#b45309; margin-bottom:.35em; }
.cofre-anim-regalo-premio{ display:block; font-family:'Rubik',system-ui,sans-serif; font-weight:900; font-size:1em; }
@media (prefers-reduced-motion:reduce){
  .cofre-anim-tiembla,.cofre-anim-abierto .cofre-anim-rayo{ animation:none; }
}
`}</style>
  );
}
