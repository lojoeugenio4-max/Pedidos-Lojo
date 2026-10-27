// Pedido por código de barras (app del cliente).
//
// Al pulsar el botón de la cámara se abre la cámara EN DIRECTO y el móvil
// lee el código de barras (EAN) él solito, sin mandar la foto a ningún
// sitio: en cuanto lo enfoca, se busca el artículo por su EAN y se abre su
// ficha para poner las unidades.
//   - Android (Chrome): lector nativo del móvil (BarcodeDetector), el más rápido.
//   - iPhone y el resto: librería ZXing (se carga solo al abrir el escáner).
// Si el artículo no tiene código o no se encuentra, el cliente puede pasar a
// la búsqueda por foto de siempre.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ScanBarcode, X } from "lucide-react";
import { buscarArticulosPorEan, normalizarEan } from "../utils/buscarPorEan";

const FORMATOS_NATIVOS = ["ean_13", "ean_8", "upc_a"];
// Cada cuánto mira el lector nativo un fotograma del vídeo.
const INTERVALO_NATIVO_MS = 120;

async function lectorNativoDisponible() {
  try {
    if (!("BarcodeDetector" in window)) return false;
    const soportados = await window.BarcodeDetector.getSupportedFormats();
    return soportados.includes("ean_13");
  } catch {
    return false;
  }
}

export default function EscanerEan({
  productos,
  language = "es",
  onElegir,
  onBuscarPorFoto,
  onCerrar,
}) {
  const zh = language === "zh";
  const txt = (es, chino) => (zh ? chino : es);

  const videoRef = useRef(null);
  const pararRef = useRef(() => {});
  const leidoRef = useRef(false);

  // escaneando | buscando | noEncontrado | varios | errorCamara | error
  const [fase, setFase] = useState("escaneando");
  const [eanLeido, setEanLeido] = useState("");
  const [varios, setVarios] = useState([]);
  const [intento, setIntento] = useState(0);

  // Arranca la cámara y el lector. Se vuelve a arrancar con "Escanear otro".
  useEffect(() => {
    let cancelado = false;
    leidoRef.current = false;

    async function alLeer(codigo) {
      if (leidoRef.current || cancelado) return;
      const ean = normalizarEan(codigo);
      if (ean.length !== 13 && ean.length !== 8) return;
      leidoRef.current = true;
      pararRef.current();
      try {
        navigator.vibrate?.(80);
      } catch {
        // nada
      }
      setEanLeido(ean);
      setFase("buscando");
      try {
        const encontrados = await buscarArticulosPorEan(ean, productos);
        if (cancelado) return;
        if (encontrados.length === 1) {
          onElegir(encontrados[0].id);
        } else if (encontrados.length > 1) {
          setVarios(encontrados);
          setFase("varios");
        } else {
          setFase("noEncontrado");
        }
      } catch (error) {
        console.error("Búsqueda por EAN:", error);
        if (!cancelado) setFase("error");
      }
    }

    async function arrancar() {
      setFase("escaneando");
      const video = videoRef.current;
      try {
        if (await lectorNativoDisponible()) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
          if (cancelado) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          video.srcObject = stream;
          await video.play().catch(() => {});
          const detector = new window.BarcodeDetector({ formats: FORMATOS_NATIVOS });
          let temporizador = null;
          const mirar = async () => {
            if (cancelado || leidoRef.current) return;
            try {
              if (video.readyState >= 2) {
                const codigos = await detector.detect(video);
                if (codigos?.length) return alLeer(codigos[0].rawValue);
              }
            } catch {
              // fotograma no válido, se sigue
            }
            temporizador = setTimeout(mirar, INTERVALO_NATIVO_MS);
          };
          mirar();
          pararRef.current = () => {
            clearTimeout(temporizador);
            stream.getTracks().forEach((t) => t.stop());
          };
          return;
        }

        // iPhone y navegadores sin lector nativo: ZXing.
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelado) return;
        const pistas = new Map();
        pistas.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]);
        pistas.set(DecodeHintType.TRY_HARDER, true);
        const lector = new BrowserMultiFormatReader(pistas, { delayBetweenScanAttempts: 100 });
        const controles = await lector.decodeFromConstraints(
          {
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          },
          video,
          (resultado) => {
            if (resultado) alLeer(resultado.getText());
          }
        );
        if (cancelado) {
          controles.stop();
          return;
        }
        pararRef.current = () => controles.stop();
      } catch (error) {
        console.error("No se pudo abrir la cámara:", error);
        if (!cancelado) setFase("errorCamara");
      }
    }

    arrancar();
    return () => {
      cancelado = true;
      pararRef.current();
      pararRef.current = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intento]);

  const escanearOtro = () => {
    setVarios([]);
    setEanLeido("");
    setIntento((n) => n + 1);
  };

  const pasarAFoto = () => {
    pararRef.current();
    onBuscarPorFoto();
  };

  const contenido = (
    <div style={estilos.fondo}>
      <div style={estilos.cabecera}>
        <strong style={estilos.titulo}>
          <ScanBarcode size={20} strokeWidth={2.6} /> {txt("Escanear código de barras", "扫描条形码")}
        </strong>
        <button type="button" onClick={onCerrar} style={estilos.cerrar} aria-label={txt("Cerrar", "关闭")}>
          <X size={22} strokeWidth={2.8} />
        </button>
      </div>

      <div style={estilos.zonaVideo}>
        <video ref={videoRef} style={estilos.video} playsInline muted autoPlay />
        {fase === "escaneando" && (
          <>
            <div style={estilos.marco}>
              <div style={estilos.linea} className="lojo-ean-linea" />
            </div>
            <div style={estilos.ayuda}>
              {txt("Apunta al código de barras del artículo", "将摄像头对准商品条形码")}
            </div>
          </>
        )}

        {fase !== "escaneando" && (
          <div style={estilos.capa}>
            <div style={estilos.tarjeta}>
              {fase === "buscando" && (
                <>
                  <div style={estilos.ruedita} className="lojo-ean-girando" />
                  <div style={estilos.textoTarjeta}>{txt("Buscando", "正在查找")} {eanLeido}…</div>
                </>
              )}

              {fase === "noEncontrado" && (
                <>
                  <div style={estilos.textoTarjeta}>
                    {txt("No tenemos este código en el catálogo:", "目录中没有这个条形码：")}
                  </div>
                  <div style={estilos.ean}>{eanLeido}</div>
                  <button type="button" style={estilos.botonVerde} onClick={pasarAFoto}>
                    <Camera size={18} strokeWidth={2.6} /> {txt("Buscar con una foto", "拍照查找")}
                  </button>
                  <button type="button" style={estilos.botonBlanco} onClick={escanearOtro}>
                    {txt("Escanear otro", "再扫一个")}
                  </button>
                </>
              )}

              {fase === "varios" && (
                <>
                  <div style={estilos.textoTarjeta}>{txt("¿Cuál de estos es?", "是哪一个？")}</div>
                  <div style={estilos.lista}>
                    {varios.map((producto) => (
                      <button
                        key={producto.id}
                        type="button"
                        style={estilos.opcion}
                        onClick={() => onElegir(producto.id)}
                      >
                        {producto.image ? (
                          <img src={producto.image} alt="" style={estilos.fotoOpcion} />
                        ) : (
                          <div style={estilos.fotoOpcion} />
                        )}
                        <span style={estilos.nombreOpcion}>{producto.name}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" style={estilos.botonBlanco} onClick={escanearOtro}>
                    {txt("Escanear otro", "再扫一个")}
                  </button>
                </>
              )}

              {fase === "error" && (
                <>
                  <div style={estilos.textoTarjeta}>
                    {txt("No se pudo buscar. Revisa la conexión.", "无法查找，请检查网络。")}
                  </div>
                  <button type="button" style={estilos.botonVerde} onClick={escanearOtro}>
                    {txt("Volver a probar", "重试")}
                  </button>
                </>
              )}

              {fase === "errorCamara" && (
                <>
                  <div style={estilos.textoTarjeta}>
                    {txt(
                      "No se pudo abrir la cámara. Revisa que la app tenga permiso para usarla.",
                      "无法打开摄像头，请检查相机权限。"
                    )}
                  </div>
                  <button type="button" style={estilos.botonVerde} onClick={escanearOtro}>
                    {txt("Volver a probar", "重试")}
                  </button>
                  <button type="button" style={estilos.botonBlanco} onClick={pasarAFoto}>
                    <Camera size={18} strokeWidth={2.6} /> {txt("Buscar con una foto", "拍照查找")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {fase === "escaneando" && (
        <div style={estilos.pie}>
          <button type="button" style={estilos.botonFoto} onClick={pasarAFoto}>
            <Camera size={18} strokeWidth={2.6} />{" "}
            {txt("¿No tiene código? Buscar con una foto", "没有条形码？拍照查找")}
          </button>
        </div>
      )}

      <style>{`
        @keyframes lojoEanLinea { 0%, 100% { top: 12%; } 50% { top: 85%; } }
        .lojo-ean-linea { animation: lojoEanLinea 1.6s ease-in-out infinite; }
        @keyframes lojoEanGira { to { transform: rotate(360deg); } }
        .lojo-ean-girando { animation: lojoEanGira 0.9s linear infinite; }
      `}</style>
    </div>
  );

  return createPortal(contenido, document.body);
}

const estilos = {
  fondo: {
    position: "fixed",
    inset: 0,
    zIndex: 9000,
    background: "#000",
    display: "flex",
    flexDirection: "column",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  },
  cabecera: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "calc(12px + env(safe-area-inset-top)) 16px 12px",
    color: "#fff",
  },
  titulo: { display: "flex", alignItems: "center", gap: "8px", fontSize: "17px" },
  cerrar: {
    border: "none",
    background: "rgba(255,255,255,0.18)",
    color: "#fff",
    borderRadius: "999px",
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  zonaVideo: { position: "relative", flex: 1, overflow: "hidden" },
  video: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
  marco: {
    position: "absolute",
    left: "50%",
    top: "45%",
    transform: "translate(-50%, -50%)",
    width: "min(82vw, 380px)",
    height: "min(42vw, 190px)",
    border: "3px solid #22c55e",
    borderRadius: "16px",
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
  },
  linea: {
    position: "absolute",
    left: "6%",
    right: "6%",
    height: "3px",
    background: "#ef4444",
    boxShadow: "0 0 10px #ef4444",
    borderRadius: "3px",
  },
  ayuda: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "calc(45% + min(21vw, 95px) + 18px)",
    textAlign: "center",
    color: "#fff",
    fontSize: "16px",
    fontWeight: 800,
    padding: "0 20px",
    textShadow: "0 1px 4px rgba(0,0,0,0.6)",
  },
  capa: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
  },
  tarjeta: {
    width: "100%",
    maxWidth: "420px",
    maxHeight: "100%",
    overflowY: "auto",
    background: "#fff",
    borderRadius: "18px",
    padding: "18px 16px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: "12px",
  },
  textoTarjeta: { fontSize: "16px", fontWeight: 800, color: "#1f2937", textAlign: "center" },
  ean: { fontSize: "20px", fontWeight: 900, letterSpacing: "1px", textAlign: "center", color: "#111827" },
  ruedita: {
    alignSelf: "center",
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    border: "4px solid #dcfce7",
    borderTopColor: "#16a34a",
  },
  lista: { display: "flex", flexDirection: "column", gap: "8px" },
  opcion: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    background: "#fff",
    padding: "8px",
    cursor: "pointer",
    textAlign: "left",
  },
  fotoOpcion: { width: "56px", height: "56px", objectFit: "contain", borderRadius: "8px", background: "#f8fafc", flex: "0 0 auto" },
  nombreOpcion: { fontSize: "14px", fontWeight: 800, color: "#111827" },
  botonVerde: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    border: "none",
    borderRadius: "14px",
    background: "#16a34a",
    color: "#fff",
    fontWeight: 900,
    fontSize: "16px",
    padding: "14px",
    cursor: "pointer",
  },
  botonBlanco: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    border: "1px solid #cbd5e1",
    borderRadius: "14px",
    background: "#fff",
    color: "#111827",
    fontWeight: 800,
    fontSize: "15px",
    padding: "12px",
    cursor: "pointer",
  },
  pie: { padding: "14px 16px calc(16px + env(safe-area-inset-bottom))" },
  botonFoto: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    border: "none",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.16)",
    color: "#fff",
    fontWeight: 800,
    fontSize: "15px",
    padding: "14px",
    cursor: "pointer",
  },
};
