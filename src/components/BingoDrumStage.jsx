// Bombo de Bingo "de verdad" (el diseño original de src/pages/bingo/BingoShow.jsx),
// convertido en componente reutilizable para poder pintarlo A LA VEZ en el TPV
// y en la pantalla del Televisor -- igual que StoreWheel hace con la Ruleta.
//
// Este componente NO habla con Supabase ni sabe nada de códigos QR: solo
// recibe por props cuándo tiene que animar la extracción de una bola
// (pendingTrigger) y el historial de bolas ya cantadas (numbers). Quien lo
// use (StorePage o DisplayPage) decide cuándo disparar el sorteo y qué hacer
// cuando termina (onRevealComplete).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import logoLojo from "../assets/logo-lojo.jpg";

export const MIX_SECONDS = 5.2;
export const STOP_SECONDS = 2.4;
export const EXTRACTION_SECONDS = 1.35;
export const LANDING_PAUSE_SECONDS = 0.45;
export const BALL_COUNT = 90;
export const REVEAL_AT_MS =
  (MIX_SECONDS + STOP_SECONDS + EXTRACTION_SECONDS + LANDING_PAUSE_SECONDS) * 1000;
export const TOTAL_DRAW_MS = REVEAL_AT_MS + 3900;

let bingoAudioContext = null;

function obtenerAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!bingoAudioContext) {
    bingoAudioContext = new AudioContextClass();
  }
  // Un AudioContext creado EN el instante de un gesto del usuario (el clic
  // en "GIRAR BOMBO") arranca activo sin más. Pero los sonidos que suenan
  // varios segundos después (la bola cayendo, el "reveal") antes creaban
  // CADA UNO su propio AudioContext nuevo, ya fuera del gesto original, y
  // los navegadores los dejan "pausados" para siempre si no se reanudan a
  // mano — por eso no se oía nada salvo el primer sonido. Reutilizar
  // siempre el mismo contexto y pedir resume() en cada uso lo evita.
  bingoAudioContext.resume?.().catch(() => {});
  return bingoAudioContext;
}

function audioCue(kind) {
  try {
    const ctx = obtenerAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);

    if (kind === "motor") {
      // Ronroneo grave de fondo: da sensación de que el bombo gira.
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(36, t);
      osc.frequency.exponentialRampToValueAtTime(92, t + 1.1);
      osc.frequency.setValueAtTime(92, t + 3.7);
      osc.frequency.exponentialRampToValueAtTime(44, t + 4.8);
      filter.type = "lowpass";
      filter.frequency.value = 240;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.13, t + 0.18);
      gain.gain.setValueAtTime(0.13, t + 4.25);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 5.05);
      osc.connect(filter).connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 5.1);
    } else if (kind === "drop") {
      // Bola golpeando contra cristal: un "tink" agudo y brillante al
      // primer contacto, seguido de un tañido de cristal que se apaga
      // poco a poco (dos armónicos ligeramente desafinados para que
      // suene a vidrio y no a metal).
      const impactoSize = Math.floor(ctx.sampleRate * 0.02);
      const impactoBuffer = ctx.createBuffer(1, impactoSize, ctx.sampleRate);
      const impactoData = impactoBuffer.getChannelData(0);
      for (let s = 0; s < impactoSize; s += 1) impactoData[s] = (Math.random() * 2 - 1) * (1 - s / impactoSize);
      const impacto = ctx.createBufferSource();
      impacto.buffer = impactoBuffer;
      const impactoFiltro = ctx.createBiquadFilter();
      impactoFiltro.type = "highpass";
      impactoFiltro.frequency.value = 3200;
      const impactoGain = ctx.createGain();
      impactoGain.gain.setValueAtTime(0.001, t);
      impactoGain.gain.exponentialRampToValueAtTime(0.3, t + 0.003);
      impactoGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      impacto.connect(impactoFiltro).connect(impactoGain).connect(master);
      impacto.start(t);

      [2400, 3620].forEach((frequency, index) => {
        const tañido = ctx.createOscillator();
        const tañidoGain = ctx.createGain();
        tañido.type = "sine";
        tañido.frequency.setValueAtTime(frequency, t);
        tañido.frequency.exponentialRampToValueAtTime(frequency * 0.92, t + 0.5);
        tañidoGain.gain.setValueAtTime(0.001, t);
        tañidoGain.gain.exponentialRampToValueAtTime(index === 0 ? 0.15 : 0.09, t + 0.012);
        tañidoGain.gain.exponentialRampToValueAtTime(0.001, t + (index === 0 ? 0.55 : 0.4));
        tañido.connect(tañidoGain).connect(master);
        tañido.start(t);
        tañido.stop(t + 0.6);
      });

      // Golpe grave de fondo (la bola llegando a la bandeja), más discreto
      // que antes para dejar protagonismo al cristal.
      const thud = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thud.type = "sine";
      thud.frequency.setValueAtTime(180, t);
      thud.frequency.exponentialRampToValueAtTime(70, t + 0.18);
      thudGain.gain.setValueAtTime(0.001, t);
      thudGain.gain.exponentialRampToValueAtTime(0.14, t + 0.012);
      thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      thud.connect(thudGain).connect(master);
      thud.start(t);
      thud.stop(t + 0.22);
    } else if (kind === "applause") {
      // Aplausos sintetizados: muchas "palmadas" de ruido blanco filtrado,
      // repartidas de forma aleatoria a lo largo de un par de segundos.
      const totalPalmadas = 46;
      for (let i = 0; i < totalPalmadas; i += 1) {
        const at = t + Math.random() * 2.1;
        const bufferSize = Math.floor(ctx.sampleRate * 0.045);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let s = 0; s < bufferSize; s += 1) data[s] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 1600 + Math.random() * 900;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, at);
        gain.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.05, at + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.045);
        noise.connect(filter).connect(gain).connect(master);
        noise.start(at);
      }
    } else {
      [392, 523.25, 659.25, 783.99].forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const at = t + index * 0.09;
        osc.type = index % 2 ? "triangle" : "sine";
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.001, at);
        gain.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.7);
        osc.connect(gain).connect(master);
        osc.start(at);
        osc.stop(at + 0.75);
      });
    }
    // El contexto es compartido y se reutiliza en cada sonido: ya no se
    // cierra aquí (cerrarlo lo dejaría inservible para el siguiente sonido).
  } catch (error) {
    console.warn("Audio no disponible", error);
  }
}

function decirEnVoz(texto, { rate = 0.95, pitch = 1 } = {}) {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = "es-ES";
    utter.rate = rate;
    utter.pitch = pitch;
    window.speechSynthesis.speak(utter);
  } catch (error) {
    console.warn("Voz no disponible", error);
  }
}

function cantarNumero(numero) {
  if (!Number.isFinite(numero)) return;
  decirEnVoz(`Número ${numero}`);
}

function celebrarPremio(nombrePremio) {
  audioCue("applause");
  window.setTimeout(() => {
    decirEnVoz(`¡Premio conseguido! ${nombrePremio}`, { rate: 0.92, pitch: 1.08 });
  }, 380);
}

function seeded(seed) {
  let value = seed % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function DrumCanvas({ moving, phase, excludedNumber }) {
  const canvasRef = useRef(null);
  const movingRef = useRef(moving);
  const phaseRef = useRef(phase);
  const phaseStartedAtRef = useRef(performance.now());
  const excludedNumberRef = useRef(excludedNumber);

  useEffect(() => { movingRef.current = moving; }, [moving]);
  useEffect(() => { phaseRef.current = phase; phaseStartedAtRef.current = performance.now(); }, [phase]);
  useEffect(() => { excludedNumberRef.current = excludedNumber; }, [excludedNumber]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const random = seeded(20260718);
    const balls = Array.from({ length: BALL_COUNT }, (_, index) => ({
      number: index + 1,
      x: (random() - 0.5) * 0.92,
      y: (random() - 0.5) * 0.82,
      vx: (random() - 0.5) * 0.005,
      vy: (random() - 0.5) * 0.005,
      radius: 0.027 + random() * 0.008,
      hue: 44,
      chaosA: random() * Math.PI * 2,
      chaosB: random() * Math.PI * 2,
      chaosRate: 0.72 + random() * 1.65,
      kickBias: random() * 2 - 1,
      liftBias: 0.65 + random() * 0.9,
      nextKickAt: random() * 380,
      kickX: 0,
      kickY: 0,
    }));
    let raf = 0;
    let last = performance.now();
    let rotation = 0;

    function fit() {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(canvas);

    function ellipsePath(cx, cy, rx, ry) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    }

    function metallicStroke(width, alpha = 1) {
      const gradient = ctx.createLinearGradient(0, 0, canvas.clientWidth, 0);
      gradient.addColorStop(0, `rgba(72,39,4,${alpha})`);
      gradient.addColorStop(0.18, `rgba(255,232,142,${alpha})`);
      gradient.addColorStop(0.42, `rgba(151,90,11,${alpha})`);
      gradient.addColorStop(0.68, `rgba(255,245,180,${alpha})`);
      gradient.addColorStop(1, `rgba(76,41,5,${alpha})`);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = width;
    }

    function draw(now) {
      const dt = Math.min((now - last) / 16.667, 2);
      last = now;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const cx = width * 0.5;
      const cy = height * 0.42;
      const radius = Math.min(width * 0.41, height * 0.39);
      const rx = radius;
      const ry = radius * 0.9;
      const currentPhase = phaseRef.current;
      const phaseElapsed = Math.max(0, (now - phaseStartedAtRef.current) / 1000);
      const stoppingProgress = currentPhase === "stopping" ? Math.min(1, phaseElapsed / STOP_SECONDS) : 0;
      const spinStrength = ["starting", "spinning"].includes(currentPhase)
        ? 1
        : currentPhase === "stopping"
          ? Math.pow(1 - stoppingProgress, 2.35)
          : 0;
      const speed = 0.004 + 0.052 * spinStrength;
      rotation += speed * dt;
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.globalAlpha = 0.75;
      const halo = ctx.createRadialGradient(cx, cy, radius * 0.25, cx, cy, radius * 1.2);
      halo.addColorStop(0, "rgba(255,220,102,.27)");
      halo.addColorStop(0.55, "rgba(42,106,182,.12)");
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ellipsePath(cx, cy, radius * 1.22, radius * 1.12);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ellipsePath(cx, cy, rx * 0.92, ry * 0.92);
      ctx.clip();
      const glass = ctx.createRadialGradient(cx - rx * 0.25, cy - ry * 0.3, radius * 0.05, cx, cy, radius);
      glass.addColorStop(0, "rgba(170,224,255,.23)");
      glass.addColorStop(0.35, "rgba(26,73,125,.22)");
      glass.addColorStop(0.82, "rgba(3,17,39,.63)");
      glass.addColorStop(1, "rgba(0,4,12,.9)");
      ctx.fillStyle = glass;
      ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

      balls.forEach((ball, index) => {
        if (ball.number === excludedNumberRef.current && ["extracting", "landed", "reveal"].includes(phaseRef.current)) return;
        if (spinStrength > 0.001) {
          const time = now * 0.001;
          const edge = Math.min(1, Math.max(0, (Math.abs(ball.x) - 0.28) / 0.58));
          const floor = Math.min(1, Math.max(0, (ball.y - 0.12) / 0.58));

          if (now >= ball.nextKickAt) {
            const angle = random() * Math.PI * 2;
            const force = (0.0014 + random() * 0.0028) * spinStrength;
            ball.kickX = Math.cos(angle) * force;
            ball.kickY = Math.sin(angle) * force - random() * 0.00135 * spinStrength;
            ball.nextKickAt = now + 75 + random() * 390;
          }

          ball.vx += (
            Math.sin(time * (2.1 + ball.chaosRate) + ball.chaosA) * 0.00034 +
            Math.sin(time * (5.7 + ball.liftBias) + ball.chaosB) * 0.00017 +
            ball.kickX
          ) * spinStrength * dt;
          ball.vy += (
            Math.cos(time * (2.6 + ball.liftBias) + ball.chaosB) * 0.00031 +
            Math.sin(time * (6.3 + ball.chaosRate) + ball.chaosA) * 0.00016 +
            ball.kickY
          ) * spinStrength * dt;

          if (edge > 0.08) {
            const liftPulse = Math.max(0, Math.sin(time * (4.2 + ball.chaosRate) + ball.chaosA));
            ball.vy -= edge * liftPulse * (0.0007 + ball.liftBias * 0.00028) * spinStrength * dt;
            ball.vx += (ball.x > 0 ? -1 : 1) * edge * (0.00008 + random() * 0.00012) * spinStrength * dt;
          }

          if (floor > 0.12 && Math.sin(time * 7.4 + ball.chaosB) > 0.62) {
            ball.vy -= floor * (0.00055 + random() * 0.0005) * spinStrength * dt;
            ball.vx += (random() - 0.5) * 0.00075 * spinStrength * dt;
          }

          ball.kickX *= 0.72;
          ball.kickY *= 0.72;
        }

        const gravity = 0.00018 + (1 - spinStrength) * 0.00105;
        ball.vy += gravity * dt;
        const damping = Math.pow(0.994 - (1 - spinStrength) * 0.018, dt);
        ball.vx *= damping;
        ball.vy *= damping;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        const boundary = Math.sqrt((ball.x / 0.94) ** 2 + (ball.y / 0.84) ** 2);
        if (boundary > 1 - ball.radius) {
          const nx = ball.x / (0.94 * 0.94);
          const ny = ball.y / (0.84 * 0.84);
          const mag = Math.hypot(nx, ny) || 1;
          const ux = nx / mag;
          const uy = ny / mag;
          const dot = ball.vx * ux + ball.vy * uy;
          ball.vx -= 1.86 * dot * ux;
          ball.vy -= 1.86 * dot * uy;
          ball.x *= 0.985;
          ball.y *= 0.985;
        }

        for (let otherIndex = 0; otherIndex < index; otherIndex += 1) {
          const other = balls[otherIndex];
          if (other.number === excludedNumberRef.current && ["extracting", "landed", "reveal"].includes(phaseRef.current)) continue;
          const dx = ball.x - other.x;
          const dy = ball.y - other.y;
          const distance = Math.hypot(dx, dy) || 0.0001;
          const minDistance = (ball.radius + other.radius) * 1.02;
          if (distance < minDistance) {
            const nx = dx / distance;
            const ny = dy / distance;
            const overlap = minDistance - distance;
            ball.x += nx * overlap * 0.52;
            ball.y += ny * overlap * 0.52;
            other.x -= nx * overlap * 0.48;
            other.y -= ny * overlap * 0.48;
            const relative = (ball.vx - other.vx) * nx + (ball.vy - other.vy) * ny;
            if (relative < 0) {
              const impulse = -relative * 0.88;
              ball.vx += nx * impulse;
              ball.vy += ny * impulse;
              other.vx -= nx * impulse;
              other.vy -= ny * impulse;
            }
          }
        }

        const perspective = 0.82 + (ball.y + 1) * 0.1;
        const x = cx + ball.x * rx * 0.82;
        const y = cy + ball.y * ry * 0.8;
        const r = radius * ball.radius * perspective;
        const shadow = ctx.createRadialGradient(x + r * 0.3, y + r * 0.45, 0, x, y, r * 1.5);
        shadow.addColorStop(0, "rgba(0,0,0,.22)");
        shadow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = shadow;
        ctx.beginPath();
        ctx.arc(x + r * 0.35, y + r * 0.45, r * 1.45, 0, Math.PI * 2);
        ctx.fill();

        const fill = ctx.createRadialGradient(x - r * 0.34, y - r * 0.38, r * 0.05, x, y, r);
        fill.addColorStop(0, "#fffef2");
        fill.addColorStop(0.16, `hsl(${ball.hue} 92% 82%)`);
        fill.addColorStop(0.63, `hsl(${ball.hue} 78% 56%)`);
        fill.addColorStop(1, `hsl(${ball.hue} 68% 24%)`);
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.48)";
        ctx.lineWidth = Math.max(0.7, r * 0.08);
        ctx.stroke();
        if (r > 8) {
          ctx.fillStyle = "rgba(255,255,238,.93)";
          ctx.beginPath();
          ctx.arc(x, y, r * 0.48, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#172544";
          ctx.font = `900 ${Math.max(6, r * 0.48)}px Georgia`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(ball.number), x, y + 0.5);
        }
      });
      ctx.restore();

      ctx.save();
      metallicStroke(Math.max(8, radius * 0.045));
      ellipsePath(cx, cy, rx * 0.96, ry * 0.96);
      ctx.stroke();
      metallicStroke(Math.max(2.4, radius * 0.012), 0.96);
      for (let i = 0; i < 18; i += 1) {
        const angle = rotation + (i / 18) * Math.PI * 2;
        const depth = Math.cos(angle);
        const y = cy + Math.sin(angle) * ry * 0.9;
        const widthFactor = Math.sqrt(Math.max(0.02, 1 - ((y - cy) / (ry * 0.94)) ** 2));
        ctx.globalAlpha = 0.42 + (depth + 1) * 0.27;
        ctx.beginPath();
        ctx.ellipse(cx, y, rx * 0.94 * widthFactor, Math.max(2, ry * 0.024), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = Math.max(1.5, radius * 0.007);
      for (let i = 0; i < 7; i += 1) {
        const x = cx - rx * 0.72 + i * (rx * 1.44 / 6);
        const factor = Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
        ctx.beginPath();
        ctx.ellipse(x, cy, Math.max(2, rx * 0.028), ry * 0.93 * factor, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      const shaft = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
      shaft.addColorStop(0, "#482800");
      shaft.addColorStop(0.18, "#ffe8a0");
      shaft.addColorStop(0.48, "#85500c");
      shaft.addColorStop(0.78, "#fff3bd");
      shaft.addColorStop(1, "#4b2900");
      ctx.fillStyle = shaft;
      ctx.fillRect(cx - rx * 1.08, cy - radius * 0.035, rx * 2.16, radius * 0.07);
      const hub = ctx.createRadialGradient(cx - radius * 0.08, cy - radius * 0.08, 2, cx, cy, radius * 0.19);
      hub.addColorStop(0, "#fff5ba");
      hub.addColorStop(0.42, "#d99d22");
      hub.addColorStop(1, "#5b3104");
      ctx.fillStyle = hub;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff0a4";
      ctx.lineWidth = radius * 0.018;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,.25)";
      ctx.lineWidth = radius * 0.035;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.82, Math.PI * 1.08, Math.PI * 1.43);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,244,183,.18)";
      ctx.lineWidth = radius * 0.014;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.88, -0.45, 0.3);
      ctx.stroke();
      ctx.restore();

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
    };
  }, []);

  return <canvas className={`pro-drum-canvas phase-${phase}`} ref={canvasRef} aria-label="Bombo profesional de Bingo" />;
}

function StageParticles({ active }) {
  return <div className={`pro-confetti ${active ? "is-active" : ""}`} aria-hidden="true">{Array.from({ length: 48 }, (_, i) => <i key={i} style={{ "--i": i }} />)}</div>;
}

function PremiosColumna({ premios }) {
  const activos = (premios || []).filter((premio) => premio?.active);
  if (!activos.length) return null;
  return (
    <aside className="pro-prizes-col" aria-label="Premios del Bingo">
      {activos.map((premio, index) => (
        <div className={`pro-prize-card ${premio.special ? "pro-prize-card--special" : ""}`} key={index}>
          {premio.special && <span className="pro-prize-card__badge">ESPECIAL</span>}
          <div className="pro-prize-card__media">
            {premio.image ? <img src={premio.image} alt={premio.name || ""} /> : <span>🎁</span>}
          </div>
          <div className="pro-prize-card__copy">
            <small>{premio.label}</small>
            <strong>{premio.name || "Premio configurado"}</strong>
            {premio.message && <p>{premio.message}</p>}
          </div>
        </div>
      ))}
    </aside>
  );
}

export default function BingoDrumStage({
  numbers = [],
  pendingTrigger = null,
  onRevealComplete,
  mostrarControles = true,
  drawing = false,
  drawMessage = "",
  onGirar,
  error = "",
  premios = null,
  customerName = "",
  bolasRestantes = null,
  premioGanado = null,
  drawFinished = false,
  onExit,
  exitLabel = "SALIR",
  subtitle = "LOJO PRESENTA",
  onToggleFullscreen,
}) {
  const [phase, setPhase] = useState("idle");
  const [pendingNumber, setPendingNumber] = useState(null);
  const [localNumbers, setLocalNumbers] = useState(numbers);
  const timers = useRef([]);
  const lastTriggerToken = useRef(null);

  useEffect(() => { setLocalNumbers(numbers); }, [numbers]);

  const schedule = useCallback((fn, delay) => {
    const timer = window.setTimeout(fn, delay);
    timers.current.push(timer);
    return timer;
  }, []);

  const revealNumber = useCallback((number) => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setPendingNumber(number);
    setPhase("starting");
    audioCue("motor");
    schedule(() => setPhase("spinning"), 560);
    schedule(() => setPhase("stopping"), MIX_SECONDS * 1000);
    schedule(() => setPhase("extracting"), (MIX_SECONDS + STOP_SECONDS) * 1000);
    schedule(() => {
      setPhase("landed");
      audioCue("drop");
    }, (MIX_SECONDS + STOP_SECONDS + EXTRACTION_SECONDS) * 1000);
    schedule(() => {
      setLocalNumbers((current) => (current.includes(number) ? current : [...current, number]));
      setPhase("reveal");
      audioCue("reveal");
      window.setTimeout(() => cantarNumero(number), 260);
      onRevealComplete?.(number);
      schedule(() => setPhase("idle"), 3900);
    }, (MIX_SECONDS + STOP_SECONDS + EXTRACTION_SECONDS + LANDING_PAUSE_SECONDS) * 1000);
  }, [schedule, onRevealComplete]);

  useEffect(() => {
    if (!pendingTrigger?.token || pendingTrigger.token === lastTriggerToken.current) return;
    lastTriggerToken.current = pendingTrigger.token;
    revealNumber(pendingTrigger.number);
  }, [pendingTrigger, revealNumber]);

  const [premioVisible, setPremioVisible] = useState(null);
  const ultimoPremioCelebradoRef = useRef(null);
  useEffect(() => {
    if (!premioGanado?.nombre) return;
    const clave = premioGanado.key || premioGanado.nombre;
    if (ultimoPremioCelebradoRef.current === clave) return;
    ultimoPremioCelebradoRef.current = clave;
    celebrarPremio(premioGanado.nombre);
    setPremioVisible(premioGanado.nombre);
    const oculto = window.setTimeout(() => setPremioVisible(null), 6000);
    return () => window.clearTimeout(oculto);
  }, [premioGanado]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const lastNumber = localNumbers.at(-1) || null;
  const displayNumber = phase === "reveal" ? pendingNumber : lastNumber;
  const recent = useMemo(() => localNumbers.slice(-13).reverse(), [localNumbers]);
  const moving = ["starting", "spinning", "stopping"].includes(phase);
  const extracting = ["extracting", "landed"].includes(phase);

  return (
    <main className={`pro-stage pro-stage--${phase}`}>
      <style>{styles}</style>
      <div className="pro-stage__ceiling" aria-hidden="true"><i/><i/><i/><i/><i/></div>
      <div className="pro-stage__floor" aria-hidden="true" />
      <StageParticles active={phase === "reveal"} />
      {premioVisible && (
        <div className="pro-premio-banner" role="status">
          <strong>{premioVisible}</strong>
        </div>
      )}

      <header className="pro-header">
        <div className="pro-logo"><span><img src={logoLojo} alt="Lojo" /></span><div><small>{subtitle}</small><h1>Bingo Cash Lojo</h1></div></div>
        <div className="pro-header__right">
          {customerName && <span className="pro-customer-name">{customerName}</span>}
          {Number.isFinite(bolasRestantes) && (
            <span className="pro-remaining-badge">
              {bolasRestantes > 0 ? `${bolasRestantes} ${bolasRestantes === 1 ? "tirada" : "tiradas"} restantes` : "Última tirada"}
            </span>
          )}
          <span className="pro-live"><i/> EN DIRECTO</span>
          {onToggleFullscreen && (
            <button type="button" onClick={onToggleFullscreen}>⛶ <b>Pantalla completa</b></button>
          )}
        </div>
      </header>

      <section className={`pro-content ${premios?.length ? "has-prizes" : ""}`}>
        <PremiosColumna premios={premios} />
        <div className="pro-machine">
          <div className="pro-machine__backlight" />
          <div className="pro-frame">
            <div className="pro-frame__axle-support" aria-hidden="true" />
            <div className="pro-frame__post pro-frame__post--left"><span/><b/></div>
            <div className="pro-frame__post pro-frame__post--right"><span/><b/></div>
            <div className="pro-frame__bearing pro-frame__bearing--left" />
            <div className="pro-frame__bearing pro-frame__bearing--right" />
            <DrumCanvas moving={moving} phase={phase} excludedNumber={pendingNumber} />
            <div className={`pro-chute ${extracting ? `is-active is-${phase}` : ""}`}>
              <div className="pro-chute__mouth"><i /></div>
              <div className="pro-chute__drop-tube"><i /></div>
              <div className="pro-chute__funnel" />
              <div className="pro-chute__tray"><span /></div>
              {extracting && <i className="pro-chute__moving-ball">{pendingNumber}</i>}
            </div>
            <div className="pro-frame__base"><div><small>BINGO</small><strong>CASH LOJO</strong><small>LOJO</small></div></div>
          </div>
        </div>

        <aside className="pro-presentation">
          <div className={`pro-ball ${moving ? "is-mixing" : ""} ${phase === "reveal" ? "is-revealed" : ""} ${extracting || phase === "stopping" ? "is-hidden" : ""}`}>
            <div className="pro-ball__glow" />
            <div className="pro-ball__face"><span>{moving ? "?" : displayNumber || "–"}</span><small>NÚMERO</small></div>
          </div>
          {mostrarControles && (
            <div className="pro-draw-control">
              {!drawFinished ? (
                <button type="button" onClick={onGirar} disabled={drawing || phase !== "idle"}>
                  {drawing || phase !== "idle" ? "BOMBO EN MARCHA…" : "GIRAR BOMBO"}
                </button>
              ) : (
                <button type="button" className="pro-exit-button" onClick={onExit}>
                  {exitLabel}
                </button>
              )}
              <span>{drawMessage || "Pulsa para extraer la bola. Se verá a la vez en la pantalla grande."}</span>
            </div>
          )}
          <div className="pro-counter"><div><strong>{localNumbers.length}</strong><span>Bolas cantadas</span></div><div className="pro-counter__track"><i style={{ width: `${(localNumbers.length / BALL_COUNT) * 100}%` }}/></div><div><strong>{BALL_COUNT - localNumbers.length}</strong><span>Por salir</span></div></div>
          {error && <p className="pro-error">{error}</p>}
        </aside>
      </section>

      <footer className="pro-history">
        <div className="pro-history__label"><small>HISTORIAL DEL SORTEO</small><strong>Últimas bolas cantadas</strong></div>
        <div className="pro-history__balls">{recent.length ? recent.map((number, index) => <b className={index === 0 ? "is-last" : ""} key={`${number}-${index}`}>{number}</b>) : <em>Esperando la primera extracción…</em>}</div>
        <div className="pro-edition"><small>EDICIÓN</small><strong>ACTIVA</strong></div>
      </footer>
    </main>
  );
}

const styles = `
*{box-sizing:border-box}html,body,#root{min-height:100%;margin:0;background:#020611}.pro-stage{--lojo-blue:#071a96;--lojo-red:#f1121b;--gold:#e4b44a;--pale:#fff0b0;position:relative;min-height:100%;overflow:hidden;padding:2vh 2.2vw;color:#fff;background:radial-gradient(ellipse at 50% 8%,#1737b8 0,#071a78 27%,#061340 55%,#020611 100%);font-family:Inter,ui-sans-serif,system-ui,sans-serif}.pro-stage:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#0008,transparent 16% 84%,#0008),repeating-linear-gradient(90deg,transparent 0 119px,#ffffff05 120px),linear-gradient(#ffffff05 1px,transparent 1px);background-size:auto,auto,100% 84px;pointer-events:none}.pro-stage__ceiling{position:absolute;inset:0 0 auto;height:65vh;overflow:hidden;pointer-events:none}.pro-stage__ceiling i{position:absolute;top:-18%;width:11%;height:95%;transform-origin:top;background:linear-gradient(to bottom,#fff7cb38,transparent 72%);filter:blur(8px);opacity:.45}.pro-stage__ceiling i:nth-child(1){left:4%;transform:rotate(-23deg)}.pro-stage__ceiling i:nth-child(2){left:25%;transform:rotate(-10deg)}.pro-stage__ceiling i:nth-child(3){left:47%;transform:rotate(1deg)}.pro-stage__ceiling i:nth-child(4){right:25%;transform:rotate(11deg)}.pro-stage__ceiling i:nth-child(5){right:4%;transform:rotate(24deg)}.pro-stage__floor{position:absolute;left:-10%;right:-10%;bottom:-34%;height:64%;border-radius:50%;background:radial-gradient(ellipse,#315f8b55 0,#071527 48%,#01040b 70%);box-shadow:inset 0 35px 100px #6cb9ff12}.pro-header{position:relative;z-index:20;display:flex;align-items:center;justify-content:space-between;height:9vh;min-height:72px;border-bottom:3px solid #ef172777}.pro-logo{display:flex;align-items:center;gap:15px}.pro-logo>span{width:clamp(58px,4.8vw,88px);aspect-ratio:1;display:grid;place-items:center;overflow:hidden;border:3px solid #fff;border-radius:16px;outline:4px solid #ef1727;outline-offset:3px;background:#fff;box-shadow:0 0 30px #ef172766}.pro-logo>span img{width:100%;height:100%;object-fit:cover}.pro-logo small,.pro-edition small{display:block;color:#ff4a53;font-size:clamp(8px,.7vw,12px);font-weight:900;letter-spacing:.32em}.pro-logo h1{margin:3px 0 0;color:#fff;font:900 clamp(25px,2.55vw,52px)/1 Georgia;text-shadow:0 3px #071a78,0 0 28px #ef172788}.pro-header__right{display:flex;align-items:center;gap:22px}.pro-customer-name{color:#fff;font-size:clamp(13px,1.1vw,20px);font-weight:900;letter-spacing:.02em;padding:6px 14px;border-radius:999px;background:#ffffff14;border:1px solid #ffffff33}.pro-remaining-badge{color:#132b51;font-size:clamp(11px,.95vw,16px);font-weight:950;padding:6px 14px;border-radius:999px;background:linear-gradient(135deg,#fff0a2,#e4b44a);box-shadow:0 4px 12px #0006;white-space:nowrap}.pro-header button{padding:10px 16px;border:1px solid #ffffff66;border-radius:999px;color:#fff;background:linear-gradient(135deg,#071a96,#ef1727);backdrop-filter:blur(12px);font-weight:900;cursor:pointer}.pro-live{display:flex;align-items:center;gap:8px;color:#ffd6d6;font-size:11px;font-weight:950;letter-spacing:.13em}.pro-live i{width:10px;aspect-ratio:1;border-radius:50%;background:#fa2636;box-shadow:0 0 14px #fa2636;animation:live 1s infinite}.pro-premio-banner{position:absolute;z-index:80;left:50%;top:14%;transform:translateX(-50%);padding:18px 44px;border-radius:20px;border:3px solid #fff0a2;background:linear-gradient(135deg,#ef1727,#a50916 55%,#071a96);box-shadow:0 20px 60px #000c,0 0 60px #ffd45f88;animation:premioPop .5s cubic-bezier(.17,.89,.28,1.35)}.pro-premio-banner strong{color:#fff;font:950 clamp(24px,3.2vw,54px)/1 Georgia;text-shadow:0 3px #00000066;letter-spacing:.03em;white-space:nowrap}@keyframes premioPop{0%{transform:translateX(-50%) scale(.6);opacity:0}60%{transform:translateX(-50%) scale(1.08);opacity:1}100%{transform:translateX(-50%) scale(1);opacity:1}}.pro-content{position:relative;z-index:5;display:grid;grid-template-columns:minmax(580px,1.2fr) minmax(350px,.8fr);align-items:center;gap:3vw;min-height:73vh}.pro-content.has-prizes{grid-template-columns:minmax(230px,.62fr) minmax(500px,1.15fr) minmax(320px,.78fr)}.pro-content>*{min-width:0}.pro-prizes-col{position:relative;z-index:20;display:flex;flex-direction:column;gap:1.4vh;align-self:stretch;justify-content:center}.pro-prize-card{position:relative;display:flex;align-items:center;gap:14px;padding:12px 14px;border:2px solid #e4b44a77;border-radius:16px;background:linear-gradient(135deg,#0b1f5c,#071238);box-shadow:0 10px 22px #0009}.pro-prize-card--special{border-color:#ffd34e;background:linear-gradient(135deg,#6a168f,#a82572 55%,#d76a19)}.pro-prize-card__badge{position:absolute;top:-10px;left:12px;padding:2px 10px;border-radius:999px;background:#ffd34e;color:#4f164f;font-size:9px;font-weight:950;letter-spacing:.14em}.pro-prize-card__media{flex:none;width:clamp(46px,4.4vw,72px);aspect-ratio:1;display:grid;place-items:center;border-radius:12px;overflow:hidden;background:#fff}.pro-prize-card__media img{width:100%;height:100%;object-fit:contain}.pro-prize-card__copy{min-width:0;display:flex;flex-direction:column;gap:3px}.pro-prize-card__copy small{color:#eaca69;font-size:clamp(8px,.68vw,11px);font-weight:950;letter-spacing:.14em;text-transform:uppercase}.pro-prize-card__copy strong{color:#fff;font-size:clamp(13px,1.15vw,19px);line-height:1.15;overflow-wrap:anywhere}.pro-prize-card__copy p{margin:4px 0 0;color:#d9e5f7;font-size:clamp(11px,.9vw,14px);line-height:1.3;overflow-wrap:anywhere}.pro-machine{position:relative;width:min(100%,850px);max-width:100%;height:min(70vh,760px);margin:auto;filter:drop-shadow(0 28px 27px #000d)}.pro-machine__backlight{position:absolute;inset:3% 4% 12%;border-radius:50%;background:radial-gradient(circle,#ef17272f 0 24%,#244cff35 50%,transparent 72%);filter:blur(18px);animation:breathe 2.2s ease-in-out infinite alternate}.pro-frame{position:absolute;inset:0}.pro-frame__axle-support{position:absolute;z-index:4;left:9%;right:9%;top:40.6%;height:4.8%;border:5px ridge #b77b18;border-radius:999px;background:linear-gradient(#ffe9a0,#a66b12 42%,#4b2902);box-shadow:0 7px 12px #0009,inset 0 2px #fff4be}.pro-frame__axle-support:before,.pro-frame__axle-support:after{content:"";position:absolute;top:50%;width:11%;height:240%;transform:translateY(-50%);border:5px ridge #b77b18;border-radius:18px;background:linear-gradient(90deg,#4c2900,#d39b36 36%,#fff0a6 53%,#754707)}.pro-frame__axle-support:before{left:-4%}.pro-frame__axle-support:after{right:-4%}.pro-drum-canvas{position:absolute;z-index:5;left:12%;top:5%;width:76%;height:73%;display:block}.pro-frame__post{position:absolute;z-index:3;top:34%;width:10%;height:49%;border:5px ridge #c18b25;border-radius:18px 18px 5px 5px;background:linear-gradient(90deg,#4c2900,#c28a28 20%,#fff0a6 42%,#9a6410 70%,#3b1f00);box-shadow:inset 0 0 17px #fff2a53d}.pro-frame__post:before{content:"";position:absolute;inset:7% 29%;border-radius:8px;background:linear-gradient(#3d2100,#f0c65c,#432500);opacity:.8}.pro-frame__post--left{left:4%}.pro-frame__post--right{right:4%}.pro-frame__post span{position:absolute;left:-22%;right:-22%;bottom:-4%;height:14%;border:5px ridge #bb8320;border-radius:50% 50% 8px 8px;background:linear-gradient(#f5d46f,#875008)}.pro-frame__post b{position:absolute;left:50%;top:30%;width:42%;height:23%;transform:translateX(-50%);border-radius:6px;background:linear-gradient(90deg,#2a1600,#f3d878,#523000)}.pro-frame__bearing{position:absolute;z-index:8;top:38%;width:13%;aspect-ratio:1;border:8px ridge #b77b18;border-radius:50%;background:radial-gradient(circle,#fff4bb 0 12%,#5d3505 14% 28%,#e5b842 31% 55%,#613506 68%);box-shadow:0 7px 14px #0008}.pro-frame__bearing--left{left:6%}.pro-frame__bearing--right{right:6%}.pro-frame__base{position:absolute;z-index:8;left:7%;right:7%;bottom:0;height:18%;border:7px ridge #b67b1c;border-radius:44% 44% 12px 12px;background:linear-gradient(#f3d46f 0,#b27717 35%,#724006 65%,#341b00);box-shadow:inset 0 4px #fff0a1,0 18px 25px #000c}.pro-frame__base:before,.pro-frame__base:after{content:"";position:absolute;bottom:-12%;width:14%;height:24%;border-radius:5px;background:linear-gradient(90deg,#482500,#d7a53c,#4b2700)}.pro-frame__base:before{left:13%}.pro-frame__base:after{right:13%}.pro-frame__base>div{position:absolute;left:27%;right:27%;top:16%;bottom:18%;display:flex;flex-direction:column;align-items:center;justify-content:center;border:4px double #f9df89;border-radius:8px;color:#fff5d3;background:linear-gradient(135deg,#071a96,#04105c 58%,#ef1727);box-shadow:inset 0 0 18px #54a1e72b}.pro-frame__base strong{font:900 clamp(15px,1.8vw,32px) Georgia;letter-spacing:.14em}.pro-frame__base small{color:#fff;font-size:clamp(6px,.55vw,10px);font-weight:950;letter-spacing:.3em}.pro-chute{position:absolute;z-index:12;right:1.5%;top:43%;width:29%;height:43%;pointer-events:none}.pro-chute__mouth{position:absolute;z-index:8;left:4%;top:0;width:34%;height:22%;border:7px ridge #a96e11;border-radius:18px 18px 42% 42%;background:linear-gradient(90deg,#4c2800,#f7dd85 42%,#8b5207);box-shadow:0 8px 15px #0009}.pro-chute__mouth:after{content:"";position:absolute;left:24%;right:24%;bottom:-17%;height:31%;border-radius:0 0 18px 18px;background:linear-gradient(90deg,#573000,#e7bc55,#673600);box-shadow:0 5px 8px #0008}.pro-chute__mouth i{position:absolute;left:18%;right:18%;bottom:8%;height:24%;border-radius:50%;background:#06111f;box-shadow:inset 0 4px 8px #000}.pro-chute__drop-tube{position:absolute;z-index:6;left:13%;top:18%;width:17%;height:43%;border-left:6px solid #bb8326;border-right:6px solid #704307;border-radius:0 0 18px 18px;background:linear-gradient(90deg,rgba(205,236,255,.58),rgba(62,108,145,.2) 48%,rgba(220,243,255,.48));box-shadow:inset 6px 0 12px rgba(255,255,255,.2),inset -7px 0 12px rgba(0,10,25,.5),0 6px 14px #0007;overflow:hidden}.pro-chute__drop-tube:after{content:"";position:absolute;left:18%;top:0;width:18%;height:100%;background:linear-gradient(rgba(255,255,255,.55),rgba(255,255,255,.06));filter:blur(1px)}.pro-chute__drop-tube i{position:absolute;left:50%;top:8%;width:3px;height:78%;transform:translateX(-50%);background:linear-gradient(#fff8,transparent)}.pro-chute__funnel{position:absolute;z-index:7;left:4%;top:56%;width:36%;height:16%;clip-path:polygon(8% 0,92% 0,68% 100%,32% 100%);background:linear-gradient(90deg,#6f4207,#f0cf72 44%,#744307);filter:drop-shadow(0 7px 7px #0008)}.pro-chute__tray{position:absolute;z-index:10;left:0;top:68%;width:49%;height:27%;border:7px ridge #aa7115;border-radius:14px 14px 46% 46%;background:linear-gradient(145deg,#ffe99b,#a86d13 48%,#4d2a03);box-shadow:inset 0 8px 11px #fff4b055,0 12px 18px #0009}.pro-chute__tray:after{content:"";position:absolute;left:10%;right:10%;top:15%;bottom:12%;border-radius:10px 10px 50% 50%;background:radial-gradient(ellipse at 50% 15%,#203d58,#06101f 72%);box-shadow:inset 0 5px 10px #000}.pro-chute__tray span{position:absolute;z-index:3;left:17%;right:17%;bottom:-15%;height:25%;border-radius:5px;background:linear-gradient(90deg,#4a2800,#d9aa40,#4a2800)}.pro-chute__moving-ball{position:absolute;z-index:20;left:21.5%;top:10%;width:10.5%;aspect-ratio:1;display:grid;place-items:center;border:2px solid #fff6cf;border-radius:50%;color:#172544;background:radial-gradient(circle at 30% 25%,#fffef2 0 14%,#ffe9a0 48%,#d89b20 76%,#704006);box-shadow:0 7px 14px #0009;font:900 clamp(11px,1vw,18px) Georgia;animation:extraction-drop 1.35s cubic-bezier(.36,.05,.22,1) forwards}.pro-chute.is-landed .pro-chute__moving-ball{animation:none;left:24.5%;top:79%;width:14%;transform:translate(-50%,-50%) rotate(720deg);opacity:1}
.pro-presentation{display:flex;flex-direction:column;align-items:center;gap:1.7vh;text-align:center}.pro-ball{position:relative;width:min(26vw,370px);aspect-ratio:1;display:grid;place-items:center;transition:.35s}.pro-ball__glow{position:absolute;inset:-20%;border-radius:50%;background:radial-gradient(circle,#ffd96255,transparent 67%);filter:blur(10px);animation:breathe 1.7s ease-in-out infinite alternate}.pro-ball__face{position:absolute;inset:2%;display:grid;place-items:center;border:clamp(10px,1vw,16px) double #fff0a2;border-radius:50%;outline:5px solid #7b4707;background:radial-gradient(circle at 31% 24%,#fff 0 12%,#fff8d1 31%,#e4ad34 66%,#7d4304 100%);box-shadow:inset -32px -34px 38px #5e260522,0 27px 52px #000d,0 0 75px #f1cd5d55}.pro-ball__face:before{content:"";position:absolute;inset:7%;border:2px solid #fffbe4;border-radius:50%;box-shadow:inset 0 0 20px #78440244}.pro-ball__face span{position:relative;z-index:2;color:#ef1727;font:950 clamp(105px,13.3vw,228px)/1 Georgia;text-shadow:0 3px #fff,0 7px 8px #6314072f}.pro-ball__face small{position:absolute;z-index:2;bottom:15%;color:#071a96;font-size:clamp(8px,.75vw,13px);font-weight:950;letter-spacing:.32em}.pro-ball.is-mixing{transform:scale(.87);filter:saturate(.55) brightness(.62);animation:mixball .38s ease-in-out infinite alternate}.pro-ball.is-revealed{animation:revealball .9s cubic-bezier(.17,.89,.28,1.35)}.pro-ball.is-hidden{visibility:hidden}.pro-counter{width:min(100%,490px);max-width:100%;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:15px}.pro-counter>div:not(.pro-counter__track){display:flex;flex-direction:column}.pro-counter strong{font-size:clamp(24px,2.6vw,45px);line-height:1}.pro-counter span{color:#b8cbe8;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.12em}.pro-counter__track{height:8px;border:1px solid #edcc6877;border-radius:999px;background:#0008;overflow:hidden}.pro-counter__track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#071a96,#ef1727);box-shadow:0 0 14px #ef1727}.pro-draw-control{position:relative;z-index:60;pointer-events:auto;width:min(100%,490px);max-width:100%;display:flex;flex-direction:column;align-items:center;gap:9px}.pro-draw-control button{position:relative;z-index:61;pointer-events:auto;touch-action:manipulation;min-width:250px;padding:16px 28px;border:3px solid #fff0a2;border-radius:16px;color:#fff;background:linear-gradient(135deg,#ef1727,#a50916);box-shadow:0 10px 28px #0008,0 0 24px #ef172755;font-size:22px;font-weight:950;letter-spacing:.06em;cursor:pointer}.pro-draw-control button:disabled{opacity:.62;cursor:wait}.pro-draw-control .pro-exit-button{background:linear-gradient(135deg,#159947,#087233);border-color:#dfffe9;box-shadow:0 10px 28px #0008,0 0 24px #20d76a55}.pro-draw-control span{max-width:430px;color:#d9e5f7;font-size:13px;font-weight:800}.pro-error{color:#ffc6c6;font-weight:850}.pro-history{position:relative;z-index:20;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:1.6vw;height:11vh;min-height:82px;border-top:3px solid #ef172777}.pro-history__label{display:flex;flex-direction:column}.pro-history__label small{color:#eaca69;font-size:9px;font-weight:950;letter-spacing:.27em}.pro-history__label strong{font-size:clamp(13px,1vw,18px)}.pro-history__balls{display:flex;align-items:center;gap:clamp(5px,.65vw,11px);overflow:hidden}.pro-history__balls b{flex:0 0 auto;width:clamp(40px,3.7vw,64px);aspect-ratio:1;display:grid;place-items:center;border:3px solid #be8c25;border-radius:50%;color:#132b51;background:radial-gradient(circle at 31% 23%,#fff,#ffea9e 66%,#b16b0b);box-shadow:0 6px 13px #000a;font:900 clamp(18px,1.7vw,30px) Georgia}.pro-history__balls b.is-last{color:#132b51;border-color:#ffdb76;background:radial-gradient(circle at 31% 23%,#fff,#ffea9e 66%,#b16b0b);transform:scale(1.12);box-shadow:0 0 26px #ffd45f}.pro-history__balls em{color:#b7c8e4}.pro-edition{text-align:right}.pro-edition strong{display:block;color:#fff0b2;font:900 20px Georgia}.pro-confetti{position:absolute;z-index:50;inset:0;pointer-events:none;overflow:hidden}.pro-confetti i{position:absolute;left:50%;top:42%;width:7px;height:15px;background:#ffe47a;opacity:0}.pro-confetti i:nth-child(3n){border-radius:50%;background:#64c9ff}.pro-confetti i:nth-child(4n){background:#ef4d59}.pro-confetti.is-active i{animation:confetti 1.5s ease-out forwards;animation-delay:calc(var(--i)*.012s)}.pro-stage--reveal{animation:flash .75s ease}.pro-stage--center{display:grid;place-items:center}.pro-loading,.pro-empty{position:relative;z-index:3;padding:34px 45px;border:2px solid #dcb653;border-radius:20px;background:#07162ddd;box-shadow:0 25px 70px #000b;text-align:center;font-size:26px}.pro-loading{display:flex;align-items:center;gap:17px}.pro-loading span{width:32px;aspect-ratio:1;border:4px solid #efd16a44;border-top-color:#efd16a;border-radius:50%;animation:spin 1s linear infinite}.pro-empty{display:flex;flex-direction:column;gap:9px}.pro-empty span{color:#c1d0e6;font-size:16px}
.pro-presentation{display:flex;flex-direction:column;align-items:center;gap:1.7vh;text-align:center}
@keyframes live{50%{opacity:.2}}@keyframes breathe{to{transform:scale(1.06);opacity:.62}}@keyframes fastpulse{50%{opacity:.25}}@keyframes extraction-drop{0%{left:21.5%;top:10%;transform:translate(-50%,-50%) rotate(0) scale(.88)}18%{left:21.5%;top:25%;transform:translate(-50%,-50%) rotate(120deg) scale(1)}55%{left:21.5%;top:55%;transform:translate(-50%,-50%) rotate(420deg) scale(1.04)}73%{left:24.5%;top:75%;transform:translate(-50%,-50%) rotate(590deg) scale(1.08)}84%{left:24.5%;top:69%;transform:translate(-50%,-50%) rotate(650deg) scale(1.02)}92%{left:24.5%;top:80%;transform:translate(-50%,-50%) rotate(700deg) scale(1)}100%{left:24.5%;top:79%;width:14%;transform:translate(-50%,-50%) rotate(720deg) scale(1)}}@keyframes mixball{to{transform:scale(.82) rotate(1deg)}}@keyframes revealball{0%{transform:translateX(-45vw) scale(.15) rotate(-760deg)}100%{transform:none}}@keyframes flash{35%{filter:brightness(1.45)}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes confetti{0%{opacity:1;transform:translate(0,0) rotate(0)}100%{opacity:0;transform:translate(calc((var(--i) - 24)*3.4vw),calc(-28vh + (var(--i)%9)*7vh)) rotate(760deg)}}
@media(max-width:980px){.pro-stage{padding:14px}.pro-header{height:auto;min-height:72px;flex-wrap:wrap;gap:8px;padding-bottom:8px}.pro-header__right{flex-wrap:wrap;gap:8px}.pro-header__right b{display:none}.pro-customer-name,.pro-remaining-badge{font-size:12px;padding:5px 11px}.pro-content,.pro-content.has-prizes{grid-template-columns:1fr;min-height:76vh}.pro-prizes-col{display:none}.pro-machine{width:min(91vw,690px);height:min(58vh,610px);transform:translateX(-9%)}.pro-presentation{position:absolute;z-index:20;right:1%;top:22%}.pro-ball{width:min(34vw,260px)}.pro-ball__face span{font-size:clamp(74px,18vw,150px)}.pro-counter{display:none}.pro-history{grid-template-columns:auto 1fr}.pro-edition{display:none}.pro-history__balls b:nth-child(n+9){display:none}}`;
