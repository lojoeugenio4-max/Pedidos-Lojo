// Confeti y serpentinas para celebrar un premio grande (línea, línea
// especial, bingo o bingo especial). Sin librerías externas: crea su
// propio <canvas> a pantalla completa por encima de todo, lanza la
// animación durante unos segundos y se destruye solo al terminar.
//
// Pensado para llamarse igual desde el TPV, la TV grande (ambos pintan
// BingoDrumStage) y desde el móvil del cliente (BingoCard), así que no
// depende de nada de React ni de ningún estado compartido.

const COLORES = ["#facc15", "#f97316", "#ef4444", "#22c55e", "#38bdf8", "#a855f7", "#ffffff"];

export function lanzarConfeti({ duracionMs = 4000 } = {}) {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "999999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  const dpr = window.devicePixelRatio || 1;

  function medidas() {
    return { w: window.innerWidth, h: window.innerHeight };
  }

  function resize() {
    const { w, h } = medidas();
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  // Confeti: cuadraditos de colores que caen girando.
  const confeti = Array.from({ length: 150 }, () => {
    const { w } = medidas();
    return {
      x: Math.random() * w,
      y: -20 - Math.random() * w,
      tam: 6 + Math.random() * 9,
      velY: 2.2 + Math.random() * 3.2,
      velX: -1.6 + Math.random() * 3.2,
      giro: Math.random() * 360,
      velGiro: -9 + Math.random() * 18,
      color: COLORES[Math.floor(Math.random() * COLORES.length)],
    };
  });

  // Serpentinas: tiras largas onduladas, más lentas y vistosas.
  const serpentinas = Array.from({ length: 16 }, () => {
    const { w } = medidas();
    return {
      x: Math.random() * w,
      y: -60 - Math.random() * 260,
      largo: 70 + Math.random() * 70,
      velY: 1.6 + Math.random() * 2.2,
      fase: Math.random() * Math.PI * 2,
      velFase: 0.05 + Math.random() * 0.06,
      color: COLORES[Math.floor(Math.random() * COLORES.length)],
    };
  });

  const inicio = performance.now();
  let raf = null;
  let detenido = false;

  function terminar() {
    if (detenido) return;
    detenido = true;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    canvas.remove();
  }

  function frame(ahora) {
    if (detenido) return;
    const { w, h } = medidas();
    const transcurrido = ahora - inicio;
    ctx.clearRect(0, 0, w, h);

    confeti.forEach((p) => {
      p.y += p.velY;
      p.x += p.velX;
      p.giro += p.velGiro;
      if (p.y > h + 20) {
        p.y = -20;
        p.x = Math.random() * w;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.giro * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.tam / 2, -p.tam / 2, p.tam, p.tam * 0.6);
      ctx.restore();
    });

    serpentinas.forEach((s) => {
      s.y += s.velY;
      s.fase += s.velFase;
      if (s.y > h + s.largo) {
        s.y = -60;
        s.x = Math.random() * w;
      }
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i <= s.largo; i += 6) {
        const ondulacion = Math.sin(s.fase + i * 0.2) * 14;
        if (i === 0) ctx.moveTo(s.x + ondulacion, s.y + i);
        else ctx.lineTo(s.x + ondulacion, s.y + i);
      }
      ctx.stroke();
      ctx.restore();
    });

    if (transcurrido < duracionMs) {
      raf = requestAnimationFrame(frame);
    } else {
      terminar();
    }
  }

  raf = requestAnimationFrame(frame);

  // Por si la pantalla se desmonta o cambia de vista a media celebración
  // (p. ej. el cajero pulsa "Volver a escanear"), no queremos un canvas
  // fantasma pintando para siempre por encima de todo.
  return terminar;
}
