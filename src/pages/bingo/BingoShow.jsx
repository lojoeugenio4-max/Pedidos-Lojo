// Pantalla del bombo accesible por QR/código (usada hoy por el panel de
// "Cliente de pruebas" del admin, y disponible como enlace directo).
//
// Antes este archivo tenía su propia copia completa del bombo (canvas,
// animación, CSS, sonidos...), duplicada respecto a BingoDrumStage.jsx (el
// que usan de verdad el TPV y la pantalla TV). Cualquier arreglo o mejora
// (como los sonidos) había que hacerlo dos veces y era fácil que se
// desincronizaran. Ahora este archivo SOLO se encarga de lo que le es
// propio (leer el código de la URL, hablar con Supabase, decidir cuándo
// tirar del bombo) y delega todo el dibujado a BingoDrumStage.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import BingoDrumStage from "../../components/BingoDrumStage";
import { calcularPremiosConseguidos } from "../../utils/bingoWinLogic";

const BINGO_CONTROL_CHANNEL = "lojo-bingo-control";
const DEMO_SEQUENCE = [72, 11, 38, 86, 24, 51, 3, 68, 33, 79, 15, 47];
const BALL_COUNT = 90;

function sendBingoControlEvent(payload) {
  const message = { ...payload, createdAt: Date.now() };
  try { localStorage.setItem(BINGO_CONTROL_CHANNEL, JSON.stringify(message)); } catch {}
  try {
    const channel = new BroadcastChannel(BINGO_CONTROL_CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch {}
}

const centeredStyle = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "radial-gradient(ellipse at 50% 8%,#1737b8 0,#071a78 27%,#061340 55%,#020611 100%)",
  color: "#fff",
  fontFamily: "Georgia, serif",
  textAlign: "center",
  padding: 24,
};

export default function BingoShow() {
  const params = new URLSearchParams(window.location.search);
  const demoMode = params.get("demo") === "1";
  const qrCode = String(params.get("code") || "").trim().toUpperCase();

  const [promotion, setPromotion] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [pendingTrigger, setPendingTrigger] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [drawMessage, setDrawMessage] = useState("");
  const [drawFinished, setDrawFinished] = useState(false);
  const [premiosTV, setPremiosTV] = useState([]);
  const [customerToken, setCustomerToken] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [esPruebas, setEsPruebas] = useState(false);
  const [bolasRestantes, setBolasRestantes] = useState(0);
  const [premioGanado, setPremioGanado] = useState(null);
  const reservationRef = useRef(null);
  const premiosYaCelebradosRef = useRef(new Set());

  const loadPromotion = useCallback(async () => {
    setLoading(true);
    if (demoMode) {
      setPromotion({ id: "demo", edition_id: "demo-edition", nombre: "Bingo Cash Lojo" });
      setNumbers([5, 17, 29, 44, 63]);
      setLoading(false);
      return;
    }
    setError("");
    const today = new Date().toISOString().slice(0, 10);
    const { data, error: promotionError } = await supabase
      .from("promociones_bingo")
      .select("*")
      .eq("activa", true)
      .or(`fecha_inicio.is.null,fecha_inicio.lte.${today}`)
      .or(`fecha_fin.is.null,fecha_fin.gte.${today}`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (promotionError) {
      setError("No se ha podido cargar el Bingo activo.");
      setLoading(false);
      return;
    }
    setPromotion(data || null);
    if (!data?.edition_id) {
      setNumbers([]);
      setLoading(false);
      return;
    }
    let token = "";
    if (qrCode) {
      const { data: rawValidate } = await supabase.rpc("validate_game_qr", { p_code: qrCode });
      const validated = Array.isArray(rawValidate) ? rawValidate[0] : rawValidate;
      token = String(validated?.customer_token || "").trim();
      setEsPruebas(Boolean(validated?.es_pruebas));
      setBolasRestantes(Number(validated?.bingo_remaining || 0));
      setCustomerName(String(validated?.customer_name || "").trim());
    }
    setCustomerToken(token);
    if (!token) {
      setNumbers([]);
      setLoading(false);
      return;
    }
    const { data: draws, error: drawsError } = await supabase
      .from("bingo_draws")
      .select("number,drawn_at")
      .eq("edition_id", data.edition_id)
      .eq("customer_token", token)
      .order("drawn_at", { ascending: true });
    if (drawsError) setError("No se han podido cargar las bolas cantadas.");
    setNumbers((draws || []).map((draw) => Number(draw.number)));
    setLoading(false);
  }, [demoMode, qrCode]);

  useEffect(() => { loadPromotion(); }, [loadPromotion]);

  useEffect(() => {
    let activo = true;
    async function cargarPremiosTV() {
      if (!promotion || demoMode) { if (activo) setPremiosTV([]); return; }
      const prizeIds = [
        promotion.premio_linea_articulo_id,
        promotion.premio_linea_especial_articulo_id,
        promotion.premio_bingo_articulo_id,
        promotion.premio_especial_articulo_id,
      ].filter(Boolean);
      let articulosPorId = new Map();
      if (prizeIds.length) {
        const { data: articulos } = await supabase.from("articulos").select("id,nombre,foto").in("id", prizeIds);
        articulosPorId = new Map((articulos || []).map((a) => [String(a.id), a]));
      }
      if (!activo) return;
      const fotoUrl = (foto) => {
        if (!foto) return "";
        const value = String(foto).trim();
        if (!value) return "";
        return value.startsWith("http") ? value : `https://bohlxagrtpjvqrgkonlo.supabase.co/storage/v1/object/public/productos/${value.replace(/^\/+/, "")}`;
      };
      const construir = (tipo, label, special = false) => {
        const articulo = articulosPorId.get(String(promotion[`premio_${tipo}_articulo_id`] || ""));
        return {
          active: Boolean(promotion[`premio_${tipo}_activo`]),
          name: promotion[`premio_${tipo}_nombre`] || articulo?.nombre || "",
          message: promotion[`premio_${tipo}_mensaje`] || "",
          image: fotoUrl(articulo?.foto),
          label,
          special,
        };
      };
      setPremiosTV([
        construir("linea", "Premio por línea"),
        construir("linea_especial", `Línea en ${promotion.premio_linea_especial_max_bolas || 0} bolas`, true),
        construir("bingo", "Premio por Bingo"),
        construir("especial", `Bingo en ${promotion.premio_especial_max_bolas || 0} bolas`, true),
      ]);
    }
    cargarPremiosTV();
    return () => { activo = false; };
  }, [promotion, demoMode]);

  useEffect(() => {
    if (!demoMode || !promotion) return undefined;
    let index = 0;
    const first = window.setTimeout(() => {
      setPendingTrigger({ number: DEMO_SEQUENCE[index++], token: Date.now() });
    }, 1600);
    const interval = window.setInterval(() => {
      setPendingTrigger({ number: DEMO_SEQUENCE[index % DEMO_SEQUENCE.length], token: Date.now() });
      index += 1;
    }, 10600);
    return () => { window.clearTimeout(first); window.clearInterval(interval); };
  }, [demoMode, promotion]);

  useEffect(() => {
    if (demoMode || !promotion?.edition_id || !customerToken) return undefined;
    const channel = supabase
      .channel(`bingo-show-${promotion.edition_id}-${customerToken}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "bingo_draws",
        filter: `customer_token=eq.${customerToken}`,
      }, (payload) => {
        if (String(payload.new?.edition_id || "") !== String(promotion.edition_id)) return;
        const number = Number(payload.new?.number);
        if (!number) return;
        setPendingTrigger({ number, token: Date.now() });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [demoMode, promotion?.edition_id, customerToken]);

  async function comprobarPremiosBingo() {
    if (!customerToken) return;
    try {
      const { data: raw, error: estadoError } = await supabase.rpc("obtener_estado_carton_bingo", {
        p_customer_token: customerToken,
      });
      const estadoCarton = Array.isArray(raw) ? raw[0] : raw;
      if (estadoError || !estadoCarton?.ok) return;

      const premios = calcularPremiosConseguidos(
        estadoCarton.card,
        estadoCarton.drawn_numbers,
        estadoCarton.promo
      );
      const promo = estadoCarton.promo || {};

      const definiciones = [
        { clave: "linea", conseguido: premios.linea, etiqueta: "¡LÍNEA!", nombre: promo.premio_linea_nombre },
        { clave: "lineaEspecial", conseguido: premios.lineaEspecial, etiqueta: "¡LÍNEA ESPECIAL!", nombre: promo.premio_linea_especial_nombre },
        { clave: "bingo", conseguido: premios.bingo, etiqueta: "¡BINGO!", nombre: promo.premio_bingo_nombre },
        { clave: "bingoEspecial", conseguido: premios.bingoEspecial, etiqueta: "¡BINGO ESPECIAL!", nombre: promo.premio_especial_nombre },
      ];

      definiciones.forEach(({ clave, conseguido, etiqueta, nombre }) => {
        const claveUnica = `${customerToken}:${clave}`;
        if (!conseguido || premiosYaCelebradosRef.current.has(claveUnica)) return;
        premiosYaCelebradosRef.current.add(claveUnica);
        const texto = nombre ? `${etiqueta} ${nombre}` : etiqueta;
        setPremioGanado({ nombre: texto, key: `${claveUnica}-${Date.now()}` });
      });
    } catch (comprobarError) {
      console.error("No se pudo comprobar los premios de Bingo:", comprobarError);
    }
  }

  async function drawFromQr() {
    if (!qrCode || drawing) return;

    setDrawing(true);
    setDrawFinished(false);
    setError("");
    setDrawMessage("Reservando una bola del bombo…");

    try {
      const { data: raw, error: reserveError } = await supabase.rpc("reserve_game_bingo_ball_by_code", {
        p_code: qrCode,
      });
      const reservation = Array.isArray(raw) ? raw[0] : raw;

      if (reserveError || !reservation?.ok) {
        throw new Error(reservation?.message || reserveError?.message || "No se pudo reservar la bola.");
      }

      const ballNumber = Number(reservation.ball_number);
      const reservationToken = String(reservation.reservation_token || "");
      if (!Number.isInteger(ballNumber) || ballNumber < 1 || ballNumber > BALL_COUNT || !reservationToken) {
        throw new Error("Supabase no devolvió una reserva válida.");
      }

      reservationRef.current = { ballNumber, reservationToken };
      setPendingTrigger({ number: ballNumber, token: Date.now() });
      setDrawMessage("El bombo está mezclando las bolas…");
    } catch (drawFailure) {
      setDrawing(false);
      setDrawMessage("");
      setError(drawFailure?.message || "No se pudo iniciar la extracción.");
    }
  }

  // BingoDrumStage llama a esto solo, en el momento exacto en que termina
  // de revelar la bola (ya no hace falta calcular nosotros los tiempos).
  async function onRevealComplete(ballNumber) {
    if (demoMode) return;
    const pendiente = reservationRef.current;
    if (!pendiente || pendiente.ballNumber !== ballNumber) return;

    setDrawMessage(`Publicando la bola ${ballNumber}…`);
    try {
      const { data: finalRaw, error: finalizeError } = await supabase.rpc("finalize_game_bingo_ball_by_code", {
        p_code: qrCode,
        p_reservation_token: pendiente.reservationToken,
      });
      const result = Array.isArray(finalRaw) ? finalRaw[0] : finalRaw;
      if (finalizeError || !result?.ok) {
        throw new Error(result?.message || finalizeError?.message || "No se pudo publicar la bola.");
      }

      const restantes = Number(result.bingo_remaining || 0);
      setDrawing(false);
      setDrawMessage("");
      setBolasRestantes(restantes);
      // El botón se mantiene activo mientras al cliente le queden bolas
      // por sacar de su pedido, no solo para el cliente de pruebas.
      setDrawFinished(!esPruebas && restantes <= 0);
      comprobarPremiosBingo();

      sendBingoControlEvent({
        type: "bingo-complete",
        code: qrCode,
        ball_number: ballNumber,
        bingo_remaining: restantes,
      });
      try {
        window.opener?.postMessage({
          type: "bingo-complete",
          code: qrCode,
          ball_number: ballNumber,
          bingo_remaining: restantes,
        }, window.location.origin);
      } catch {}
    } catch (finalizeFailure) {
      setDrawing(false);
      setDrawMessage("");
      setError(finalizeFailure?.message || "No se pudo publicar la bola.");
    }
  }

  function exitBingo() {
    try {
      window.opener?.focus?.();
      window.close();
    } catch {}

    // Los navegadores solo permiten cerrar automáticamente ventanas abiertas
    // por JavaScript. Si esta pantalla se abrió directamente, regresamos a caja.
    window.setTimeout(() => {
      if (!window.closed) window.location.assign(`${window.location.origin}/?store=1`);
    }, 120);
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (fullscreenError) { console.warn(fullscreenError); }
  }

  if (loading) {
    return <div style={centeredStyle}><div><span style={{ fontSize: 24 }}>Preparando el sorteo…</span></div></div>;
  }
  if (!promotion) {
    return (
      <div style={centeredStyle}>
        <div>
          <strong style={{ fontSize: 26, display: "block" }}>No hay un Bingo activo</strong>
          <span style={{ fontSize: 15, color: "#c1d0e6" }}>La pantalla se activará durante la promoción.</span>
        </div>
      </div>
    );
  }

  const mensajeIdle = bolasRestantes > 0
    ? `Quedan ${bolasRestantes} ${bolasRestantes === 1 ? "tirada" : "tiradas"}. Pulsa GIRAR BOMBO.`
    : "Pulsa GIRAR BOMBO para extraer la bola. Se verá a la vez en la pantalla grande.";

  return (
    <BingoDrumStage
      numbers={numbers}
      pendingTrigger={pendingTrigger}
      onRevealComplete={onRevealComplete}
      mostrarControles={Boolean(qrCode) && !demoMode}
      drawing={drawing}
      drawMessage={drawMessage || mensajeIdle}
      onGirar={drawFromQr}
      error={error}
      premios={premiosTV}
      customerName={customerName}
      bolasRestantes={bolasRestantes}
      premioGanado={premioGanado}
      drawFinished={drawFinished}
      onExit={exitBingo}
      exitLabel="SALIR DEL BINGO"
      subtitle={demoMode ? "DEMOSTRACIÓN" : "LOJO PRESENTA"}
      onToggleFullscreen={toggleFullscreen}
    />
  );
}
