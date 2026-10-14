import { useEffect, useMemo, useRef, useState } from "react";
import { filaColumna } from "../../utils/lojopolyTablero";
import { sonidoLojoPoly, TIEMPOS_TIRADA } from "../../utils/lojopolySonido";
import { lanzarConfeti } from "../../utils/confetti";
import { supabaseStorage } from "../../supabaseStorageClient";

// Tablero de LojoPoly, con el dado 3D y la ficha.
//
// Se usa en tres sitios:
//   · variante "tv"    TV grande: tablero + panel lateral, con sonido.
//   · variante "tpv"   pantalla de caja: tablero compacto, sin sonido
//                      (la TV y el TPV están en el mismo ordenador).
//   · variante "movil" móvil del cliente: tablero sin dado, solo consulta.
//
// `tablero` es lo que devuelven lojopoly_tablero_qr / lojopoly_tablero_cliente.
// `tirada` es lo que devuelve lojopoly_tirar_qr, con un `token` nuevo por tirada:
// al cambiar el token se anima la tirada entera y al final se llama a onTerminado.

const ICONOS = {
  salida: { icono: "→", nombre: "Salida" },
  descanso: { icono: "zZ", nombre: "Descanso" },
  suerte: { icono: "?", nombre: "Suerte" },
  suerte_grande: { icono: "★", nombre: "Suerte grande" },
  caja: { icono: "L", nombre: "Caja Lojo" },
};

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const ORIENTACION = { 1: [0, 0], 6: [0, 180], 2: [0, -90], 5: [0, 90], 3: [-90, 0], 4: [90, 0] };

function urlFoto(foto) {
  if (!foto) return null;
  if (/^(https?:|data:)/.test(String(foto))) return foto;
  return supabaseStorage.storage.from("productos").getPublicUrl(foto).data.publicUrl;
}

function cargarFuentes() {
  if (typeof document === "undefined" || document.getElementById("lojopoly-fuentes")) return;
  const link = document.createElement("link");
  link.id = "lojopoly-fuentes";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Fredoka:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

const esperar = (ms) => new Promise((r) => window.setTimeout(r, ms));

export function LogoLojoPoly({ tamano = 40, cinta = true }) {
  const letras = (texto) => [...texto].map((c, i) => <span key={i}>{c}</span>);
  return (
    <div className="lp-logo" style={{ fontSize: tamano }} aria-label="LojoPoly">
      <div className="lp-plate">
        <span className="lp-w lp-w1">{letras("Lojo")}</span>
        <span className="lp-w lp-w2">{letras("Poly")}</span>
      </div>
      {cinta && <div className="lp-ribbon">Cash Lojo</div>}
    </div>
  );
}

export default function LojoPolyJuego({
  tablero,
  tirada = null,
  variante = "movil",
  sonido = false,
  clienteNombre = "",
  pendientes = null,
  onTerminado,
}) {
  const [mostrado, setMostrado] = useState(tablero);
  const [ficha, setFicha] = useState(tablero?.posicion ?? 0);
  const [mensaje, setMensaje] = useState("");
  const [fase, setFase] = useState("reposo"); // reposo | agitando | lanzando | moviendo | resultado
  const [dadoRot, setDadoRot] = useState([-20, 25]);
  const [destacada, setDestacada] = useState(null);
  const [celebracion, setCelebracion] = useState(null);
  // Móvil: casilla tocada por el cliente, para ver el artículo en grande.
  const [seleccion, setSeleccion] = useState(null);
  const tokenAnimado = useRef(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    cargarFuentes();
    return () => {
      montado.current = false;
    };
  }, []);

  // Tablero nuevo sin tirada (al abrir, o tras recargar): se pinta tal cual.
  useEffect(() => {
    if (fase !== "reposo") return;
    setMostrado(tablero);
    setFicha(tablero?.posicion ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablero]);

  useEffect(() => {
    if (!tirada?.token || tokenAnimado.current === tirada.token) return;
    tokenAnimado.current = tirada.token;
    animar(tirada);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tirada?.token]);

  const snd = sonido ? sonidoLojoPoly : null;

  async function animar(t) {
    const total = Number(t.total_casillas) || mostrado?.campana?.total || 24;
    const T = TIEMPOS_TIRADA;
    setCelebracion(null);
    setDestacada(null);
    setFicha(Number(t.desde) || 0);

    setFase("agitando");
    setMensaje("¡Agitando el dado!");
    snd?.agitar(T.agitar);
    await esperar(T.agitar);
    if (!montado.current) return;

    setFase("lanzando");
    setMensaje("¡Tirando!");
    girarDado(Number(t.dado));
    if (snd) {
      [[470, 1], [650, 0.75], [820, 0.55], [960, 0.4], [1120, 0.28]].forEach(([ms, p]) => window.setTimeout(() => snd.bote(p), ms));
    }
    await esperar(T.lanzar);
    if (!montado.current) return;
    snd?.resultado();
    setMensaje(`Ha sacado un ${t.dado}`);
    await esperar(T.pausa);

    setFase("moviendo");
    let pos = Number(t.desde) || 0;
    for (let k = 0; k < Number(t.dado); k += 1) {
      pos = (pos + 1) % total;
      if (pos === 0) snd?.salida();
      setFicha(pos);
      snd?.paso(k);
      await esperar(T.paso);
      if (!montado.current) return;
    }
    snd?.caer();

    setMostrado(t.tablero || mostrado);
    setDestacada(t.casilla?.id || null);
    setFase("resultado");
    setMensaje(textoResultado(t));

    if (t.resultado === "grupo_completado") {
      snd?.fanfarria();
      setCelebracion({ grupo: t.casilla?.grupo_nombre, color: t.casilla?.grupo_color, premio: t.premio?.texto || t.casilla?.grupo_premio });
      if (variante !== "tpv") lanzarConfeti({ duracionMs: 5000 });
    } else if (t.resultado === "nueva") snd?.nueva();
    else if (t.resultado === "repetida") snd?.repetida();
    else if (t.resultado === "premio_instantaneo") {
      if (t.tipo_casilla === "suerte_grande") snd?.nueva();
      else snd?.premioPequeno();
    }

    await esperar(T.resultado);
    if (!montado.current) return;
    setFase("reposo");
    onTerminado?.(t);
  }

  function girarDado(valor) {
    setDadoRot(([cx, cy]) => {
      const [bx, by] = ORIENTACION[valor] || [0, 0];
      const vueltasX = 2 + Math.floor(Math.random() * 2);
      const vueltasY = 2 + Math.floor(Math.random() * 2);
      const nx = Math.ceil((cx + 1) / 360) * 360 + 360 * vueltasX + bx;
      const ny = Math.ceil((cy + 1) / 360) * 360 + 360 * vueltasY + by;
      return [nx, ny];
    });
  }

  const lado = mostrado?.campana?.lado || 7;
  // Profundidad de la fila de casillas respecto al ancho de cada casilla:
  // cuanto mayor, más grandes las casillas y más pequeño el centro.
  const fondo = { movil: 1.3, tpv: 1.45, tv: 1.45 }[variante] || 1.4;
  const esMovil = variante === "movil";
  const tramo = lado - 1;
  const ladoDe = (p) => (p > 0 && p < tramo ? "abajo" : p > tramo && p < 2 * tramo ? "izq" : p > 2 * tramo && p < 3 * tramo ? "arriba" : p > 3 * tramo ? "der" : "esquina");
  const mias = useMemo(() => new Set(mostrado?.mias || []), [mostrado]);
  const grupos = mostrado?.grupos || [];
  const gruposPorId = useMemo(() => new Map(grupos.map((g) => [g.id, g])), [grupos]);
  const progreso = useMemo(
    () =>
      grupos.map((g) => {
        const casillas = (mostrado?.casillas || []).filter((c) => c.grupo_id === g.id);
        const tengo = casillas.filter((c) => mias.has(c.id)).length;
        return { ...g, casillas, tengo, completo: casillas.length > 0 && tengo === casillas.length };
      }),
    [grupos, mostrado, mias]
  );

  if (!mostrado?.casillas?.length) return null;

  const tableroJSX = (
    <div
      className={`lp-board lp-board-${variante}`}
      style={{
        "--lado": lado,
        gridTemplateColumns: `${fondo}fr repeat(${lado - 2}, 1fr) ${fondo}fr`,
        gridTemplateRows: `${fondo}fr repeat(${lado - 2}, 1fr) ${fondo}fr`,
      }}
    >
      {mostrado.casillas.map((c) => {
        const [fila, col] = filaColumna(c.posicion, lado);
        const estilo = { gridRow: fila, gridColumn: col };
        const conFicha = c.posicion === ficha;
        if (c.tipo !== "propiedad") {
          const info = ICONOS[c.tipo] || { icono: "", nombre: c.tipo };
          return (
            <div
              key={c.id}
              className={`lp-cell lp-esp lp-${c.tipo} lp-s-${ladoDe(c.posicion)} ${destacada === c.id ? "lp-hit" : ""}`}
              style={estilo}
              title={info.nombre}
            >
              <span className="lp-ico">{info.icono}</span>
              {(!esMovil || ladoDe(c.posicion) === "esquina") && <span className="lp-esp-nombre">{info.nombre}</span>}
              {conFicha && <span className="lp-ficha" key={`f-${ficha}`} />}
            </div>
          );
        }
        const grupo = gruposPorId.get(c.grupo_id);
        const foto = urlFoto(c.foto);
        const mia = mias.has(c.id);
        const clases = `lp-cell lp-prop lp-s-${ladoDe(c.posicion)} ${mia ? "lp-mia" : ""} ${destacada === c.id ? "lp-hit" : ""} ${seleccion === c.id ? "lp-sel" : ""}`;
        const contenido = (
          <>
            <div className="lp-band" />
            <div className="lp-foto">{foto ? <img src={foto} alt="" loading="lazy" /> : null}</div>
            {!esMovil && <div className="lp-nombre">{c.nombre}</div>}
            {mia && <span className="lp-check">✓</span>}
            {conFicha && <span className="lp-ficha" key={`f-${ficha}`} />}
          </>
        );
        // En el móvil la casilla solo lleva la foto; al tocarla se ve el artículo debajo.
        return esMovil ? (
          <button
            key={c.id}
            type="button"
            className={clases}
            style={{ ...estilo, "--gc": grupo?.color || "#888" }}
            onClick={() => setSeleccion(seleccion === c.id ? null : c.id)}
            aria-label={`${c.nombre}${mia ? ", ya la tienes" : ", te falta"}`}
          >
            {contenido}
          </button>
        ) : (
          <div key={c.id} className={clases} style={{ ...estilo, "--gc": grupo?.color || "#888" }} title={`${grupo?.nombre || ""}: ${c.nombre || ""}`}>
            {contenido}
          </div>
        );
      })}

      <div className="lp-center" style={{ gridRow: `2 / ${lado}`, gridColumn: `2 / ${lado}` }}>
        <LogoLojoPoly tamano={variante === "tv" ? 54 : variante === "tpv" ? 26 : 30} cinta={!esMovil && variante !== "tpv"} />
        {variante !== "movil" ? (
          <>
            <div className="lp-tray">
              <div className={`lp-toss ${fase === "agitando" ? "lp-shake" : ""} ${fase === "lanzando" ? "lp-go" : ""}`}>
                <div className="lp-cube" style={{ transform: `rotateX(${dadoRot[0]}deg) rotateY(${dadoRot[1]}deg)` }}>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div key={n} className={`lp-face lp-f${n}`}>
                      {Array.from({ length: 9 }, (_, i) => (
                        <i key={i} className={PIPS[n].includes(i) ? "lp-on" : ""} />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="lp-shadow" />
              </div>
            </div>
            <div className="lp-msg">{mensaje || (clienteNombre ? `Turno de ${clienteNombre}` : "Completa un grupo y gana su premio")}</div>
          </>
        ) : (
          <div className="lp-centro-movil">
            <strong>
              {(mostrado.mias || []).length}/{(mostrado.casillas || []).filter((x) => x.tipo === "propiedad").length}
            </strong>
            <span>casillas</span>
          </div>
        )}
      </div>

      {celebracion && (
        <div className="lp-cele" style={{ "--gc": celebracion.color || "#ffcc2e" }}>
          <div className="lp-cele-card">
            <div className="lp-cele-titulo">¡Grupo {celebracion.grupo} completado!</div>
            <div className="lp-cele-premio">{celebracion.premio || "Premio"}</div>
            <div className="lp-cele-sub">Recógelo en caja</div>
          </div>
        </div>
      )}
    </div>
  );

  const panelGrupos = (
    <div className="lp-grupos">
      {progreso.map((g) => (
        <div key={g.id} className={`lp-grupo ${g.completo ? "lp-grupo-ok" : ""}`} style={{ "--gc": g.color }}>
          <div className="lp-grupo-cab">
            <span>{g.nombre}</span>
            <span className="lp-grupo-cuenta">
              {g.tengo}/{g.casillas.length}
            </span>
          </div>
          <div className="lp-grupo-premio">{g.completo ? "¡Completado! " : ""}{g.premio_texto || ""}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className={`lp-root lp-root-${variante}`} lang="es">
      <style>{CSS}</style>
      {variante === "tv" ? (
        <div className="lp-tvlayout">
          <div className="lp-tv-tablero">{tableroJSX}</div>
          <aside className="lp-tv-panel">
            <LogoLojoPoly tamano={64} />
            {clienteNombre && <div className="lp-tv-cliente">{clienteNombre}</div>}
            {pendientes !== null && (
              <div className="lp-tv-tiradas">
                <span>Tiradas</span>
                <strong>{pendientes}</strong>
              </div>
            )}
            {panelGrupos}
          </aside>
        </div>
      ) : variante === "tpv" ? (
        tableroJSX
      ) : (
        <>
          {Number(mostrado.tiradas_pendientes) > 0 && (
            <div className="lp-aviso-tiradas">
              🎲 Tienes <strong>{mostrado.tiradas_pendientes} {Number(mostrado.tiradas_pendientes) === 1 ? "tirada" : "tiradas"}</strong> esperando: pasa el QR de tu pedido en caja.
            </div>
          )}
          {tableroJSX}
          <FichaCasilla casilla={(mostrado.casillas || []).find((x) => x.id === seleccion)} grupos={gruposPorId} mias={mias} />
          <h3 className="lp-h3">Tus grupos</h3>
          <div className="lp-gm-lista">
            {progreso.map((g) => (
              <div key={g.id} className={`lp-gm ${g.completo ? "lp-gm-ok" : ""}`} style={{ "--gc": g.color }}>
                <div className="lp-gm-cab">
                  <span>{g.nombre}</span>
                  <span className="lp-grupo-cuenta">
                    {g.tengo}/{g.casillas.length}
                  </span>
                </div>
                <div className="lp-gm-items">
                  {g.casillas.map((c) => {
                    const foto = urlFoto(c.foto);
                    const mia = mias.has(c.id);
                    return (
                      <div key={c.id} className={`lp-gm-item ${mia ? "lp-gm-mia" : ""}`}>
                        <span className="lp-gm-foto">{foto ? <img src={foto} alt="" loading="lazy" /> : null}</span>
                        <span className="lp-gm-nombre">{c.nombre}</span>
                        <span className="lp-gm-estado">{mia ? "✓" : ""}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="lp-gm-premio">
                  {g.completo ? "¡Completado! " : "Premio: "}
                  <strong>{g.premio_texto || "—"}</strong>
                </div>
              </div>
            ))}
          </div>
          {(mostrado.premios || []).length > 0 && (
            <>
              <h3 className="lp-h3">Tus premios</h3>
              <div className="lp-premios">
                {mostrado.premios.map((p) => (
                  <div key={p.id} className={`lp-premio lp-premio-${p.estado}`}>
                    <strong>{p.texto || "Premio"}</strong>
                    <span>
                      {p.tipo === "grupo" ? `Grupo ${p.grupo_nombre}` : "Premio instantáneo"} ·{" "}
                      {p.estado === "pendiente"
                        ? `Recógelo en caja${p.caduca_el ? ` antes del ${new Date(`${p.caduca_el}T12:00:00`).toLocaleDateString("es-ES")}` : ""}`
                        : p.estado === "entregado"
                          ? "Entregado"
                          : "Caducado"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="lp-nota">
            Por cada {mostrado.campana?.variedad_minima || 10} artículos distintos en cajas consigues una tirada. Las tiradas se
            juegan al pasar el QR de tu pedido en caja.
          </p>
        </>
      )}
    </div>
  );
}

function FichaCasilla({ casilla, grupos, mias }) {
  if (!casilla) {
    return <p className="lp-ficha-vacia">Toca una casilla del tablero para ver el artículo.</p>;
  }
  const grupo = grupos.get(casilla.grupo_id);
  const foto = urlFoto(casilla.foto);
  const mia = mias.has(casilla.id);
  return (
    <div className="lp-ficha-art" style={{ "--gc": grupo?.color || "#888" }}>
      <span className="lp-ficha-foto">{foto ? <img src={foto} alt="" /> : null}</span>
      <div className="lp-ficha-texto">
        <span className="lp-ficha-grupo">{grupo?.nombre}</span>
        <strong>{casilla.nombre}</strong>
        <span className={mia ? "lp-ficha-si" : "lp-ficha-no"}>{mia ? "✓ Ya es tuya" : "Te falta"}</span>
      </div>
    </div>
  );
}

function textoResultado(t) {
  const extra = t.paso_salida && t.tirada_extra ? " · ¡Pasa por Salida: tirada extra!" : "";
  switch (t.resultado) {
    case "nueva":
      return `¡Nueva casilla! ${t.casilla?.nombre || ""}${extra}`;
    case "repetida":
      return `${t.casilla?.nombre || "Casilla"}: repetida${extra}`;
    case "grupo_completado":
      return `¡Grupo ${t.casilla?.grupo_nombre || ""} completado!${extra}`;
    case "premio_instantaneo":
      return `${ICONOS[t.tipo_casilla]?.nombre || "Premio"}: ${t.premio?.texto || ""}${extra}`;
    case "sin_premio":
      return `${ICONOS[t.tipo_casilla]?.nombre || "Casilla"}: esta vez no hay premio${extra}`;
    case "descanso":
      return `Descanso${extra}`;
    default:
      return `Salida${extra}`;
  }
}

const CSS = `
.lp-root{--ink:#0b1140;--red:#f81a1e;--gold:#ffcc2e;--azul:#06127a;--azul2:#0b22b8;font-family:"Fredoka",system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink)}
.lp-root *{box-sizing:border-box}
.lp-logo{position:relative;display:inline-flex;flex-direction:column;align-items:center;transform:rotate(-4deg)}
.lp-plate{position:relative;display:flex;align-items:center;gap:.06em;padding:.12em .42em .2em;border-radius:.42em;background:linear-gradient(180deg,#ff3b3e,var(--red) 55%,#c80508);box-shadow:0 0 0 .07em #fff,0 0 0 .14em var(--ink),0 .16em 0 .14em var(--ink),0 .3em .5em rgba(0,0,0,.45)}
.lp-w{font-family:"Luckiest Guy","Arial Black",Impact,sans-serif;line-height:1;display:inline-flex}
.lp-w span{display:inline-block;paint-order:stroke fill;-webkit-text-stroke:.14em var(--ink);text-shadow:0 .05em 0 var(--ink),0 .09em 0 var(--ink)}
.lp-w1 span{color:#fff}.lp-w2 span{color:var(--gold)}
.lp-w span:nth-child(odd){transform:translateY(-.03em) rotate(-4deg)}
.lp-w span:nth-child(even){transform:translateY(.03em) rotate(3deg)}
.lp-ribbon{margin-top:.22em;font-weight:700;font-size:.2em;letter-spacing:.32em;text-transform:uppercase;color:var(--ink);background:var(--gold);padding:.25em .8em .25em 1.1em;border-radius:.3em;box-shadow:0 0 0 .12em var(--ink)}

.lp-board{position:relative;container-type:inline-size;display:grid;gap:2px;padding:4px;aspect-ratio:1;width:100%;background:#eef1fb;border-radius:12px;box-shadow:0 0 0 4px var(--ink),0 0 0 8px var(--red),0 0 0 10px var(--ink),0 22px 44px rgba(0,0,0,.45)}
.lp-cell{position:relative;background:#fff;color:var(--ink);border-radius:4px;overflow:hidden;display:flex;flex-direction:column;min-width:0;min-height:0;font-size:calc(100cqw / var(--lado) / 6.4);line-height:1.05;font-weight:600;text-align:center}
.lp-band{height:15%;min-height:4px;flex:none;background:var(--gc)}
.lp-prop:not(.lp-mia) .lp-band{filter:saturate(.25) brightness(1.15)}
.lp-foto{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:4%}
.lp-foto img{max-width:100%;max-height:100%;object-fit:contain}
.lp-prop:not(.lp-mia) .lp-foto img{filter:grayscale(1);opacity:.45}
.lp-nombre{padding:0 3% 4%;color:#8a90ad;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;hyphens:auto;overflow-wrap:break-word}

.lp-mia{box-shadow:inset 0 0 0 2px var(--gc)}
.lp-mia .lp-nombre{color:var(--ink)}
.lp-check{position:absolute;left:4%;top:18%;width:1.5em;height:1.5em;border-radius:50%;background:var(--gc);color:#fff;font-weight:700;display:grid;place-items:center;font-size:1em}
.lp-esp{justify-content:center;align-items:center;font-weight:700;text-transform:uppercase;letter-spacing:.03em;gap:2px}
.lp-ico{font-family:"Luckiest Guy","Arial Black",sans-serif;font-size:2.4em;line-height:1}
.lp-esp-nombre{padding:0 4%}
.lp-suerte{background:#fff3c4}.lp-suerte .lp-ico{color:#c98a00}
.lp-caja{background:#e3e8ff}.lp-caja .lp-ico{color:var(--azul2)}
.lp-salida{background:var(--red);color:#fff}
.lp-descanso{background:#dff3e6;color:#1d6b3b}
.lp-suerte_grande{background:var(--gold)}
.lp-hit{animation:lpHit .7s ease;z-index:4;box-shadow:0 0 0 3px var(--gold),0 0 18px var(--gold)}
@keyframes lpHit{0%,100%{transform:scale(1)}40%{transform:scale(1.15)}}
.lp-ficha{position:absolute;right:5%;bottom:22%;width:38%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff7a7c,var(--red) 55%,#8a0003);box-shadow:0 2px 4px rgba(0,0,0,.45),0 0 0 2px #fff;z-index:5;animation:lpHop .2s ease}
@keyframes lpHop{0%{transform:translateY(-60%) scale(1.15)}100%{transform:none}}

.lp-center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4cqw;border-radius:8px;padding:3cqw;color:#fff;text-align:center;overflow:hidden;background:repeating-conic-gradient(from 0deg at 50% 50%,rgba(255,255,255,.06) 0 8deg,transparent 8deg 18deg),linear-gradient(135deg,#0d27c4,var(--azul))}
.lp-msg{font-size:3.2cqw;font-weight:600;max-width:92%;line-height:1.25;min-height:2.6em}

.lp-tray{perspective:600px}
.lp-toss{--s:13cqw;width:var(--s);height:var(--s)}
.lp-toss.lp-shake{animation:lpShake .09s linear infinite}
.lp-toss.lp-go{animation:lpToss 1.25s cubic-bezier(.3,.6,.4,1)}
@keyframes lpShake{0%{transform:translate(-3px,1px) rotate(-6deg)}50%{transform:translate(3px,-2px) rotate(6deg)}100%{transform:translate(-3px,1px) rotate(-6deg)}}
@keyframes lpToss{0%{transform:translate(0,0)}18%{transform:translate(-14px,-70%)}38%{transform:translate(-6px,4%)}52%{transform:translate(4px,-28%)}66%{transform:translate(8px,2%)}78%{transform:translate(6px,-9%)}90%,100%{transform:translate(0,0)}}
.lp-cube{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform 1.25s cubic-bezier(.2,.75,.25,1)}
.lp-face{position:absolute;inset:0;background:linear-gradient(145deg,#fff,#e6e9f5);border-radius:18%;box-shadow:inset 0 0 0 2px rgba(11,17,64,.15);display:grid;grid-template:repeat(3,1fr)/repeat(3,1fr);padding:15%;backface-visibility:hidden}
.lp-face i{width:72%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 40% 35%,#3a4170,var(--ink));place-self:center;visibility:hidden}
.lp-face i.lp-on{visibility:visible}
.lp-f1 i.lp-on{background:radial-gradient(circle at 40% 35%,#ff6a6c,var(--red));width:85%}
.lp-f1{transform:translateZ(calc(var(--s)/2))}
.lp-f6{transform:rotateY(180deg) translateZ(calc(var(--s)/2))}
.lp-f2{transform:rotateY(90deg) translateZ(calc(var(--s)/2))}
.lp-f5{transform:rotateY(-90deg) translateZ(calc(var(--s)/2))}
.lp-f3{transform:rotateX(90deg) translateZ(calc(var(--s)/2))}
.lp-f4{transform:rotateX(-90deg) translateZ(calc(var(--s)/2))}
.lp-shadow{width:80%;height:8px;margin:6px auto 0;border-radius:50%;background:rgba(0,0,0,.35);filter:blur(3px)}

.lp-cele{position:absolute;inset:0;display:grid;place-items:center;background:rgba(3,8,60,.55);z-index:20;border-radius:12px;animation:lpFade .3s ease}
.lp-cele-card{background:var(--gold);color:var(--ink);border-radius:18px;padding:5cqw 6cqw;text-align:center;max-width:75%;box-shadow:0 0 0 4px var(--ink),0 0 0 9px var(--gc),0 0 0 11px var(--ink),0 20px 50px rgba(0,0,0,.5);animation:lpPop .5s cubic-bezier(.2,1.6,.4,1)}
.lp-cele-titulo{font-family:"Luckiest Guy","Arial Black",sans-serif;font-size:6cqw;line-height:1;color:#fff;paint-order:stroke fill;-webkit-text-stroke:.16em var(--ink)}
.lp-cele-premio{margin-top:2.5cqw;font-size:4cqw;font-weight:700}
.lp-cele-sub{margin-top:1cqw;font-size:3cqw;font-weight:600}
@keyframes lpPop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes lpFade{from{opacity:0}to{opacity:1}}

.lp-grupos{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
.lp-grupo{background:#fff;border-radius:10px;overflow:hidden;border:2px solid var(--gc)}
.lp-grupo-ok{box-shadow:0 0 0 3px var(--gold)}
.lp-grupo-cab{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--gc);color:#fff;font-family:"Luckiest Guy","Arial Black",sans-serif;letter-spacing:.03em;text-shadow:0 2px 0 rgba(0,0,0,.25)}
.lp-grupo-cuenta{font-family:"Fredoka",system-ui,sans-serif;font-weight:700;background:rgba(0,0,0,.25);padding:1px 8px;border-radius:99px;text-shadow:none;font-variant-numeric:tabular-nums}
.lp-grupo-premio{padding:6px 10px;font-size:13px;font-weight:600;color:#374151}
.lp-h3{font-family:"Luckiest Guy","Arial Black",sans-serif;font-weight:400;font-size:22px;letter-spacing:.02em;margin:18px 0 8px;color:var(--ink)}
.lp-premios{display:grid;gap:8px}
.lp-premio{display:grid;gap:2px;padding:10px 12px;border-radius:10px;background:#fff7d6;border:2px solid var(--gold);font-size:14px}
.lp-premio span{font-size:13px;color:#4b5563}
.lp-premio-entregado,.lp-premio-caducado{background:#f3f4f6;border-color:#e5e7eb}
.lp-nota{font-size:13px;color:#6b7280;margin:14px 0 0;line-height:1.4}

.lp-tvlayout{display:flex;gap:3vh;height:100vh;padding:3vh;background:repeating-conic-gradient(from 0deg at 50% 0%,rgba(255,255,255,.05) 0 6deg,transparent 6deg 14deg),radial-gradient(120% 70% at 50% 0%,var(--azul2),var(--azul) 70%);color:#fff;overflow:hidden}
.lp-tv-tablero{height:100%;aspect-ratio:1;flex:none;max-width:62vw;display:flex;align-items:center}
.lp-tv-panel{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:2.4vh;overflow:hidden}
.lp-tv-cliente{font-family:"Luckiest Guy","Arial Black",sans-serif;font-size:4.4vh;text-align:center;line-height:1.05;paint-order:stroke fill;-webkit-text-stroke:.12em var(--ink)}
.lp-tv-tiradas{display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:.8vh 3vh;font-size:1.8vh;letter-spacing:.12em;text-transform:uppercase;font-weight:600}
.lp-tv-tiradas strong{font-family:"Luckiest Guy","Arial Black",sans-serif;font-size:6vh;line-height:1;color:var(--gold);letter-spacing:0;paint-order:stroke fill;-webkit-text-stroke:.1em var(--ink)}
.lp-tvlayout .lp-grupos{width:100%;grid-template-columns:1fr 1fr;gap:1.2vh}
.lp-tvlayout .lp-grupo-cab{font-size:2.2vh;padding:.8vh 1.2vh}
.lp-tvlayout .lp-grupo-cuenta{font-size:1.8vh}
.lp-tvlayout .lp-grupo-premio{font-size:1.7vh;padding:.8vh 1.2vh}
.lp-root-tpv .lp-board{max-width:520px;margin:0 auto}

/* ---------- Móvil: tablero solo con fotos ---------- */
.lp-board-movil{gap:3px;padding:5px}
.lp-board-movil .lp-prop{padding:0;border:0;margin:0;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.lp-board-movil .lp-s-arriba{flex-direction:column-reverse}
.lp-board-movil .lp-s-izq{flex-direction:row-reverse}
.lp-board-movil .lp-s-der{flex-direction:row}
.lp-board-movil .lp-s-izq .lp-band,.lp-board-movil .lp-s-der .lp-band{height:auto;width:18%;min-width:5px}
.lp-board-movil .lp-band{height:18%;min-height:5px}
.lp-board-movil .lp-foto{padding:9%}
.lp-board-movil .lp-prop:not(.lp-mia){background:#f4f5fa}
.lp-board-movil .lp-prop:not(.lp-mia) .lp-foto img{opacity:.35}
.lp-board-movil .lp-mia{box-shadow:inset 0 0 0 2px var(--gc)}
.lp-board-movil .lp-check{left:auto;top:auto;right:6%;bottom:6%;width:15px;height:15px;font-size:10px;box-shadow:0 0 0 2px #fff}
.lp-board-movil .lp-s-izq .lp-check{right:24%}
.lp-board-movil .lp-s-arriba .lp-check{bottom:24%}
.lp-board-movil .lp-sel{outline:3px solid var(--gold);outline-offset:-1px;z-index:3}
.lp-board-movil .lp-prop:focus-visible{outline:3px solid var(--gold);outline-offset:-1px}
.lp-board-movil .lp-esp{gap:0}
.lp-board-movil .lp-ico{font-size:calc(100cqw / var(--lado) / 2.6)}
.lp-board-movil .lp-s-esquina .lp-ico{font-size:calc(100cqw / var(--lado) / 2.3)}
.lp-board-movil .lp-esp-nombre{font-size:calc(100cqw / var(--lado) / 6.2);line-height:1.05;margin-top:2px}
.lp-board-movil .lp-ficha{width:46%;right:auto;left:27%;bottom:auto;top:27%}
.lp-board-movil .lp-center{gap:3cqw}
.lp-centro-movil{display:flex;flex-direction:column;align-items:center;line-height:1}
.lp-centro-movil strong{font-family:"Luckiest Guy","Arial Black",sans-serif;font-weight:400;font-size:10cqw;color:var(--gold);paint-order:stroke fill;-webkit-text-stroke:.12em var(--ink)}
.lp-centro-movil span{font-size:3.6cqw;font-weight:600;letter-spacing:.14em;text-transform:uppercase;margin-top:1cqw}
.lp-aviso-tiradas{margin:0 0 12px;padding:10px 12px;border-radius:12px;background:#fff7d6;border:2px solid var(--gold);font-size:14px;color:var(--ink);line-height:1.35}
.lp-ficha-vacia{margin:14px 0 0;text-align:center;font-size:13px;color:#6b7280}
.lp-ficha-art{display:flex;align-items:center;gap:12px;margin-top:14px;padding:10px;border-radius:14px;background:#fff;border:2px solid var(--gc);box-shadow:0 6px 16px rgba(11,17,64,.08)}
.lp-ficha-foto{width:72px;height:72px;flex:none;border-radius:10px;background:#f4f5fa;display:flex;align-items:center;justify-content:center;padding:6px}
.lp-ficha-foto img{max-width:100%;max-height:100%;object-fit:contain}
.lp-ficha-texto{display:grid;gap:3px;min-width:0}
.lp-ficha-texto strong{font-size:16px;line-height:1.2;color:var(--ink)}
.lp-ficha-grupo{justify-self:start;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;background:var(--gc);padding:2px 8px;border-radius:99px}
.lp-ficha-si{font-size:13px;font-weight:700;color:#15803d}
.lp-ficha-no{font-size:13px;font-weight:600;color:#6b7280}
.lp-gm-lista{display:grid;gap:10px}
.lp-gm{background:#fff;border-radius:14px;overflow:hidden;border:2px solid var(--gc)}
.lp-gm-ok{box-shadow:0 0 0 3px var(--gold)}
.lp-gm-cab{display:flex;justify-content:space-between;align-items:center;padding:7px 12px;background:var(--gc);color:#fff;font-family:"Luckiest Guy","Arial Black",sans-serif;font-size:17px;letter-spacing:.03em;text-shadow:0 2px 0 rgba(0,0,0,.25)}
.lp-gm-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;padding:10px}
.lp-gm-item{display:flex;align-items:center;gap:8px;min-width:0}
.lp-gm-foto{width:44px;height:44px;flex:none;border-radius:8px;background:#f4f5fa;display:flex;align-items:center;justify-content:center;padding:4px}
.lp-gm-foto img{max-width:100%;max-height:100%;object-fit:contain}
.lp-gm-item:not(.lp-gm-mia) .lp-gm-foto img{opacity:.35}
.lp-gm-nombre{flex:1;min-width:0;font-size:13px;font-weight:600;line-height:1.2;color:#9ca3af}
.lp-gm-mia .lp-gm-nombre{color:var(--ink)}
.lp-gm-estado{width:18px;height:18px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;color:#fff}
.lp-gm-mia .lp-gm-estado{background:var(--gc)}
.lp-gm-item:not(.lp-gm-mia) .lp-gm-estado{border:2px dashed #d1d5db}
.lp-gm-premio{padding:8px 12px;border-top:1px dashed #e5e7eb;font-size:13px;color:#4b5563}
.lp-gm-premio strong{color:var(--ink)}
@media (prefers-reduced-motion:reduce){.lp-toss.lp-shake,.lp-toss.lp-go,.lp-hit,.lp-ficha,.lp-cele-card{animation:none}.lp-cube{transition:none}}
`;
