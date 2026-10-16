// Pedido por foto (app del cliente).
//
// El cliente pulsa el botón de la cámara, hace una foto a un artículo y
// aquí se busca en el catálogo el que más se parece (por la huella visual
// de las fotos) y leyendo el texto de la etiqueta para compararlo con los
// nombres del catálogo (ver utils/buscarPorFoto.js). Se le enseña el más parecido en
// grande y otros parecidos debajo; al tocar uno se abre su ficha y solo
// tiene que poner las unidades.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, X } from "lucide-react";
import { miniaturaFoto } from "../utils/huellaFoto";
import { buscarArticulosPorFoto } from "../utils/buscarPorFoto";

const RESULTADOS_A_MOSTRAR = 6;
// Por debajo de este parecido se avisa de que no está claro (se siguen
// enseñando las opciones). Ajustable tras probar con fotos reales.
const PARECIDO_BAJO = 0.3;

export default function BuscarPorFoto({
  archivo,
  productos,
  language = "es",
  onElegir,
  onRepetir,
  onCerrar,
}) {
  const zh = language === "zh";
  const txt = (es, chino) => (zh ? chino : es);

  const [fase, setFase] = useState("preparando"); // preparando | buscando | resultados | error
  const [descarga, setDescarga] = useState(null);
  const [miniatura, setMiniatura] = useState("");
  const [resultados, setResultados] = useState([]);
  const [mensajeError, setMensajeError] = useState("");

  useEffect(() => {
    let cancelado = false;

    async function buscar() {
      setFase("preparando");
      setResultados([]);
      setMensajeError("");
      try {
        miniaturaFoto(archivo).then((m) => !cancelado && setMiniatura(m)).catch(() => {});

        const { resultados: lista } = await buscarArticulosPorFoto(archivo, productos, {
          limite: RESULTADOS_A_MOSTRAR,
          onProgreso: (info) => {
            if (cancelado) return;
            setDescarga(info);
            if (info?.fase === "listo") setFase("buscando");
          },
        });
        if (cancelado) return;

        setResultados(lista);
        setFase("resultados");
      } catch (error) {
        console.error("Pedido por foto:", error);
        if (cancelado) return;
        setMensajeError(
          txt(
            "No se pudo buscar la foto. Revisa la conexión y vuelve a probar.",
            "无法搜索照片，请检查网络后重试。"
          )
        );
        setFase("error");
      }
    }

    if (archivo) buscar();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivo]);

  const mejor = resultados[0];
  const otros = resultados.slice(1);
  const pocoClaro = mejor && mejor.similitud < PARECIDO_BAJO && mejor.puntosTexto < 0.3;

  const contenido = (
    <div style={estilos.fondo} onClick={onCerrar}>
      <div style={estilos.panel} onClick={(e) => e.stopPropagation()}>
        <div style={estilos.cabecera}>
          <strong style={estilos.tituloCabecera}>
            <Camera size={18} strokeWidth={2.6} /> {txt("Pedir por foto", "拍照点单")}
          </strong>
          <button type="button" onClick={onCerrar} style={estilos.cerrar} aria-label={txt("Cerrar", "关闭")}>
            <X size={20} strokeWidth={2.8} />
          </button>
        </div>

        {(fase === "preparando" || fase === "buscando") && (
          <div style={estilos.esperando}>
            {miniatura && <img src={miniatura} alt="" style={estilos.miniaturaGrande} />}
            <div style={estilos.ruedita} className="lojo-foto-girando" />
            <div style={estilos.textoEspera}>
              {fase === "preparando" && descarga?.fase === "descargando"
                ? txt(
                    `Preparando la cámara (solo la primera vez)… ${descarga.porcentaje}%`,
                    `正在准备（仅第一次）… ${descarga.porcentaje}%`
                  )
                : txt("Buscando el artículo…", "正在查找商品…")}
            </div>
          </div>
        )}

        {fase === "error" && (
          <div style={estilos.esperando}>
            <div style={estilos.textoEspera}>{mensajeError}</div>
          </div>
        )}

        {fase === "resultados" && !mejor && (
          <div style={estilos.esperando}>
            {miniatura && <img src={miniatura} alt="" style={estilos.miniaturaGrande} />}
            <div style={estilos.textoEspera}>
              {txt("No he encontrado este artículo. Prueba con otra foto.", "没有找到该商品，请再拍一张。")}
            </div>
          </div>
        )}

        {fase === "resultados" && mejor && (
          <div style={estilos.cuerpo}>
            {pocoClaro && (
              <div style={estilos.aviso}>
                {txt(
                  "No lo veo muy claro. Si no está aquí, haz otra foto más de cerca.",
                  "不太确定。如果不在这里，请靠近再拍一张。"
                )}
              </div>
            )}

            <div style={estilos.comparar}>
              {miniatura && (
                <div style={estilos.columnaComparar}>
                  <img src={miniatura} alt="" style={estilos.fotoComparar} />
                  <span style={estilos.etiqueta}>{txt("Tu foto", "你的照片")}</span>
                </div>
              )}
              <div style={estilos.columnaComparar}>
                {mejor.producto.image ? (
                  <img src={mejor.producto.image} alt="" style={{ ...estilos.fotoComparar, ...estilos.fotoCatalogo }} />
                ) : (
                  <div style={{ ...estilos.fotoComparar, ...estilos.fotoCatalogo }} />
                )}
                <span style={estilos.etiqueta}>{txt("Catálogo", "目录")}</span>
              </div>
            </div>

            <div style={estilos.nombreMejor}>{mejor.producto.name}</div>
            {mejor.producto.offerText && <div style={estilos.oferta}>{mejor.producto.offerText}</div>}

            <button type="button" style={estilos.botonPedir} onClick={() => onElegir(mejor.producto.id)}>
              {txt("Sí, es este · Poner unidades", "是这个 · 填写数量")}
            </button>

            {otros.length > 0 && (
              <>
                <div style={estilos.otrosTitulo}>{txt("¿No es? Otros parecidos:", "不是？其他相似商品：")}</div>
                <div style={estilos.rejilla}>
                  {otros.map(({ producto }) => (
                    <button
                      key={producto.id}
                      type="button"
                      style={estilos.otro}
                      onClick={() => onElegir(producto.id)}
                    >
                      {producto.image ? (
                        <img src={producto.image} alt="" style={estilos.fotoOtro} />
                      ) : (
                        <div style={estilos.fotoOtro} />
                      )}
                      <span style={estilos.nombreOtro}>{producto.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {fase !== "preparando" && fase !== "buscando" && (
          <button type="button" style={estilos.botonRepetir} onClick={onRepetir}>
            <Camera size={17} strokeWidth={2.6} /> {txt("Hacer otra foto", "再拍一张")}
          </button>
        )}

        <style>{`
          @keyframes lojoFotoGira { to { transform: rotate(360deg); } }
          .lojo-foto-girando { animation: lojoFotoGira 0.9s linear infinite; }
        `}</style>
      </div>
    </div>
  );

  return createPortal(contenido, document.body);
}

const estilos = {
  fondo: {
    position: "fixed",
    inset: 0,
    zIndex: 9000,
    background: "rgba(15, 23, 42, 0.6)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  panel: {
    width: "100%",
    maxWidth: "520px",
    maxHeight: "92dvh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: "20px 20px 0 0",
    padding: "14px 16px calc(16px + env(safe-area-inset-bottom))",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  },
  cabecera: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  tituloCabecera: { display: "flex", alignItems: "center", gap: "6px", fontSize: "17px", color: "#111827" },
  cerrar: {
    border: "none",
    background: "#f1f5f9",
    borderRadius: "999px",
    width: "36px",
    height: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "#111827",
  },
  esperando: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "14px",
    padding: "18px 0",
  },
  miniaturaGrande: { width: "160px", height: "160px", objectFit: "cover", borderRadius: "14px" },
  ruedita: {
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    border: "4px solid #dcfce7",
    borderTopColor: "#16a34a",
  },
  textoEspera: { fontSize: "15px", fontWeight: 700, color: "#334155", textAlign: "center" },
  cuerpo: { display: "flex", flexDirection: "column", gap: "10px" },
  aviso: {
    background: "#fffbeb",
    border: "1px solid #fcd34d",
    color: "#92400e",
    borderRadius: "10px",
    padding: "8px 10px",
    fontSize: "13px",
    fontWeight: 700,
  },
  comparar: { display: "flex", gap: "10px", justifyContent: "center" },
  columnaComparar: { display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flex: 1, maxWidth: "200px" },
  fotoComparar: { width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: "14px", background: "#f1f5f9" },
  fotoCatalogo: { objectFit: "contain", background: "#fff", border: "3px solid #16a34a", boxSizing: "border-box" },
  etiqueta: { fontSize: "12px", color: "#64748b", fontWeight: 700 },
  nombreMejor: { fontSize: "18px", fontWeight: 900, color: "#111827", textAlign: "center", lineHeight: 1.2 },
  oferta: { fontSize: "13px", fontWeight: 800, color: "#dc2626", textAlign: "center" },
  botonPedir: {
    border: "none",
    borderRadius: "14px",
    background: "#16a34a",
    color: "#fff",
    fontWeight: 900,
    fontSize: "17px",
    padding: "15px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(22, 163, 74, 0.35)",
  },
  otrosTitulo: { fontSize: "14px", fontWeight: 800, color: "#334155", marginTop: "4px" },
  rejilla: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" },
  otro: {
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    background: "#fff",
    padding: "6px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    cursor: "pointer",
    textAlign: "left",
    minWidth: 0,
  },
  fotoOtro: { width: "100%", aspectRatio: "1 / 1", objectFit: "contain", borderRadius: "8px", background: "#f8fafc" },
  nombreOtro: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#111827",
    lineHeight: 1.2,
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  botonRepetir: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    background: "#fff",
    color: "#111827",
    fontWeight: 800,
    fontSize: "15px",
    padding: "12px",
    cursor: "pointer",
  },
};
