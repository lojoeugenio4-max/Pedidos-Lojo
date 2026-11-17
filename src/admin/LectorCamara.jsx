// Lector de códigos de barras con la cámara del móvil, para el Admin
// (Inventario). Abre la cámara en directo y, en cuanto lee un código
// válido, para la cámara y llama a onLeido(codigo).
//   - Android (Chrome): lector nativo del móvil (BarcodeDetector).
//   - iPhone y el resto: librería ZXing (se carga al abrir el lector).
// Solo se dan por buenas las lecturas válidas (dígito de control correcto,
// o el mismo código leído dos veces seguidas en los formatos sin control),
// para no quedarse con lecturas falsas.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { digitoControlValido, normalizarEan } from "../utils/buscarPorEan";

const FORMATOS_NATIVOS = ["ean_13", "ean_8", "upc_a", "upc_e", "itf", "code_128", "code_39"];
const FORMATOS_CON_CONTROL = ["ean_13", "ean_8", "upc_a", "itf"];
const LONGITUD_MINIMA = 4;
const MS_CONFIRMAR_LECTURA = 1500;
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

// ignorarCodigo: al abrir, ese código se ignora unos segundos (es el
// artículo que se acaba de contar y que suele seguir delante de la cámara).
const MS_IGNORAR_AL_ABRIR = 2500;

export default function LectorCamara({
  titulo = "Leer código de barras",
  aviso = "",
  ignorarCodigo = "",
  onLeido,
  onCerrar,
  children,
}) {
  const videoRef = useRef(null);
  const pararRef = useRef(() => {});
  const leidoRef = useRef(false);
  const onLeidoRef = useRef(onLeido);
  onLeidoRef.current = onLeido;
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;
    leidoRef.current = false;
    let candidato = { codigo: "", momento: 0 };
    const abiertoEn = Date.now();
    const codigoIgnorado = normalizarEan(ignorarCodigo);

    function lecturaValida(codigo, formato) {
      if (codigo.length < LONGITUD_MINIMA) return false;
      if (FORMATOS_CON_CONTROL.includes(formato)) {
        if (formato === "itf" && codigo.length !== 14) return false;
        return digitoControlValido(codigo);
      }
      const ahora = Date.now();
      if (candidato.codigo === codigo && ahora - candidato.momento < MS_CONFIRMAR_LECTURA) return true;
      candidato = { codigo, momento: ahora };
      return false;
    }

    function alLeer(texto, formato = "") {
      if (leidoRef.current || cancelado) return;
      const codigo = normalizarEan(texto);
      if (codigoIgnorado && codigo === codigoIgnorado && Date.now() - abiertoEn < MS_IGNORAR_AL_ABRIR) return;
      if (!lecturaValida(codigo, String(formato || "").toLowerCase())) return;
      leidoRef.current = true;
      pararRef.current();
      try {
        navigator.vibrate?.(80);
      } catch {
        // nada
      }
      onLeidoRef.current?.(codigo);
    }

    async function arrancar() {
      setError("");
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
          const soportados = await window.BarcodeDetector.getSupportedFormats();
          const detector = new window.BarcodeDetector({
            formats: FORMATOS_NATIVOS.filter((f) => soportados.includes(f)),
          });
          let temporizador = null;
          const mirar = async () => {
            if (cancelado || leidoRef.current) return;
            try {
              if (video.readyState >= 2) {
                const codigos = await detector.detect(video);
                for (const leido of codigos || []) {
                  alLeer(leido.rawValue, leido.format);
                  if (leidoRef.current) return;
                }
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

        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelado) return;
        const pistas = new Map();
        pistas.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.ITF,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
        ]);
        pistas.set(DecodeHintType.TRY_HARDER, true);
        const lector = new BrowserMultiFormatReader(pistas, { delayBetweenScanAttempts: 100 });
        const controles = await lector.decodeFromConstraints(
          {
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          },
          video,
          (resultado) => {
            if (resultado) alLeer(resultado.getText(), BarcodeFormat[resultado.getBarcodeFormat()]);
          }
        );
        if (cancelado) {
          controles.stop();
          return;
        }
        pararRef.current = () => controles.stop();
      } catch (e) {
        console.error("No se pudo abrir la cámara:", e);
        if (!cancelado) setError("No se pudo abrir la cámara. Revisa que el navegador tenga permiso para usarla.");
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

  return createPortal(
    <div style={fondo}>
      <div style={cabecera}>
        <strong style={{ fontSize: "17px" }}>{titulo}</strong>
        <button type="button" onClick={onCerrar} style={botonCerrar} aria-label="Cerrar">
          ✕
        </button>
      </div>

      <div style={zonaVideo}>
        <video ref={videoRef} style={video} playsInline muted autoPlay />
        {!error && (
          <>
            <div style={marco}>
              <div style={linea} className="lojo-lector-linea" />
            </div>
            <div style={ayuda}>Apunta al código de barras</div>
          </>
        )}
        {aviso && !error && <div style={avisoEstilo}>{aviso}</div>}
        {error && (
          <div style={capa}>
            <div style={tarjeta}>
              <div style={{ fontWeight: 800, textAlign: "center" }}>{error}</div>
              <button type="button" style={botonVerde} onClick={() => setIntento((n) => n + 1)}>
                Volver a probar
              </button>
            </div>
          </div>
        )}
      </div>

      {children && <div style={pie}>{children}</div>}

      <style>{`
        @keyframes lojoLectorLinea { 0%, 100% { top: 12%; } 50% { top: 85%; } }
        .lojo-lector-linea { animation: lojoLectorLinea 1.6s ease-in-out infinite; }
      `}</style>
    </div>,
    document.body
  );
}

const fondo = {
  position: "fixed",
  inset: 0,
  zIndex: 9000,
  background: "#000",
  display: "flex",
  flexDirection: "column",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  color: "#fff",
};
const cabecera = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "calc(12px + env(safe-area-inset-top)) 16px 12px",
};
const botonCerrar = {
  border: "none",
  background: "rgba(255,255,255,0.18)",
  color: "#fff",
  borderRadius: "999px",
  width: "42px",
  height: "42px",
  fontSize: "18px",
  fontWeight: 900,
  cursor: "pointer",
};
const zonaVideo = { position: "relative", flex: 1, overflow: "hidden" };
const video = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };
const marco = {
  position: "absolute",
  left: "50%",
  top: "45%",
  transform: "translate(-50%, -50%)",
  width: "min(82vw, 380px)",
  height: "min(42vw, 190px)",
  border: "3px solid #22c55e",
  borderRadius: "16px",
  boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
};
const linea = {
  position: "absolute",
  left: "6%",
  right: "6%",
  height: "3px",
  background: "#ef4444",
  boxShadow: "0 0 10px #ef4444",
  borderRadius: "3px",
};
const ayuda = {
  position: "absolute",
  left: 0,
  right: 0,
  top: "calc(45% + min(21vw, 95px) + 18px)",
  textAlign: "center",
  fontSize: "16px",
  fontWeight: 800,
  textShadow: "0 1px 4px rgba(0,0,0,0.6)",
};
const avisoEstilo = {
  position: "absolute",
  top: "12px",
  left: "12px",
  right: "12px",
  background: "rgba(22,163,74,0.95)",
  borderRadius: "12px",
  padding: "10px 12px",
  fontSize: "14px",
  fontWeight: 800,
  textAlign: "center",
};
const capa = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
};
const tarjeta = {
  background: "#fff",
  color: "#111827",
  borderRadius: "18px",
  padding: "18px 16px",
  width: "100%",
  maxWidth: "400px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};
const botonVerde = {
  border: "none",
  borderRadius: "14px",
  background: "#16a34a",
  color: "#fff",
  fontWeight: 900,
  fontSize: "16px",
  padding: "14px",
  cursor: "pointer",
};
const pie = { padding: "12px 16px calc(14px + env(safe-area-inset-bottom))" };
