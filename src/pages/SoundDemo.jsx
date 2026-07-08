
let audioContext = null;
let timers = [];

function ctx() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  audioContext.resume?.();
  return audioContext;
}

function stopAll() {
  timers.forEach(clearTimeout);
  timers = [];
}

function tone(frequency, duration, delay = 0, type = "sine", volume = 0.08, slideTo = null) {
  const timer = setTimeout(() => {
    const c = ctx();
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, c.currentTime);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + duration / 1000);
    }

    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, c.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration / 1000);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration / 1000 + 0.02);
  }, delay);

  timers.push(timer);
}

function noise(duration = 400, delay = 0, volume = 0.05) {
  const timer = setTimeout(() => {
    const c = ctx();
    const bufferSize = c.sampleRate * (duration / 1000);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = c.createBufferSource();
    const gain = c.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(c.destination);
    source.start();
  }, delay);

  timers.push(timer);
}

function bells(delayBase = 0) {
  [0, 160, 320, 520].forEach((delay, index) => {
    tone([784, 988, 1175, 1319][index], 210, delayBase + delay, "sine", 0.105);
  });
}

const groups = [
  {
    title: "🎰 GIRO",
    sounds: [
      {
        name: "Giro 1 · Casino clásico",
        desc: "Tic-tic rápido tipo ruleta física.",
        play() {
          stopAll();
          for (let i = 0; i < 54; i++) tone(420 + (i % 5) * 35, 34, i * 58, "square", 0.045);
        },
      },
      {
        name: "Giro 2 · Ruleta TV",
        desc: "Whoosh elegante + tics finales.",
        play() {
          stopAll();
          noise(1300, 0, 0.045);
          for (let i = 0; i < 28; i++) tone(650 - i * 8, 45, 1100 + i * 78, "triangle", 0.055);
        },
      },
      {
        name: "Giro 3 · Tragaperras",
        desc: "Rodillo mecánico más llamativo.",
        play() {
          stopAll();
          for (let i = 0; i < 42; i++) {
            tone(180 + (i % 7) * 45, 55, i * 68, "sawtooth", 0.04);
            if (i % 3 === 0) tone(90, 45, i * 68, "square", 0.025);
          }
        },
      },
    ],
  },
  {
    title: "🔔 PREMIO NORMAL",
    sounds: [
      {
        name: "Campana 1 · Ding ding ding",
        desc: "Limpio, claro y amable.",
        play() {
          stopAll();
          bells(0);
        },
      },
      {
        name: "Campana 2 · Caja registradora",
        desc: "Más comercial, tipo compra/premio.",
        play() {
          stopAll();
          tone(740, 90, 0, "square", 0.08);
          tone(980, 110, 120, "triangle", 0.1);
          tone(1320, 260, 260, "sine", 0.12);
          noise(260, 520, 0.03);
        },
      },
      {
        name: "Campana 3 · Monedas",
        desc: "Sensación casino suave.",
        play() {
          stopAll();
          for (let i = 0; i < 12; i++) tone(900 + Math.random() * 700, 90, i * 75, "triangle", 0.075);
        },
      },
    ],
  },
  {
    title: "🚨 PREMIO IMPORTANTE",
    sounds: [
      {
        name: "Sirena 1 · Casino corta",
        desc: "Llama la atención sin ser excesiva.",
        play() {
          stopAll();
          for (let i = 0; i < 8; i++) tone(i % 2 === 0 ? 880 : 520, 180, i * 190, "sawtooth", 0.09);
          bells(1600);
        },
      },
      {
        name: "Sirena 2 · Fanfarria",
        desc: "Más alegre y menos alarma.",
        play() {
          stopAll();
          [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, i === 6 ? 480 : 150, i * 150, "triangle", 0.11));
        },
      },
      {
        name: "Sirena 3 · Alerta premio",
        desc: "Más potente para premio superior.",
        play() {
          stopAll();
          for (let i = 0; i < 12; i++) tone(i % 2 === 0 ? 980 : 360, 150, i * 155, "square", 0.085);
        },
      },
    ],
  },
  {
    title: "💎 JACKPOT",
    sounds: [
      {
        name: "Jackpot 1 · Vegas",
        desc: "Sirena + campanas + monedas.",
        play() {
          stopAll();
          for (let i = 0; i < 10; i++) tone(i % 2 === 0 ? 1040 : 520, 160, i * 170, "sawtooth", 0.09);
          for (let i = 0; i < 22; i++) tone(800 + Math.random() * 900, 80, 1700 + i * 70, "triangle", 0.075);
          bells(3100);
        },
      },
      {
        name: "Jackpot 2 · Épico",
        desc: "Fanfarria larga y potente.",
        play() {
          stopAll();
          [392, 523, 659, 784, 1046, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, i > 6 ? 420 : 170, i * 170, "triangle", 0.115));
          bells(1700);
        },
      },
      {
        name: "Jackpot 3 · Máquina recreativa",
        desc: "Más arcade, más llamativo.",
        play() {
          stopAll();
          for (let i = 0; i < 18; i++) tone(440 + (i % 6) * 130, 95, i * 105, "square", 0.075);
          for (let i = 0; i < 16; i++) tone(1200 - (i % 4) * 120, 80, 1900 + i * 60, "triangle", 0.075);
        },
      },
    ],
  },
];

export default function SoundDemo() {
  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Selector de sonidos · Ruleta Lojo</h1>
          <p style={styles.subtitle}>Escucha las opciones y dime cuáles quieres usar.</p>
        </div>
        <button type="button" onClick={stopAll} style={styles.stopButton}>PARAR</button>
      </header>

      <section style={styles.grid}>
        {groups.map((group) => (
          <div key={group.title} style={styles.card}>
            <h2 style={styles.groupTitle}>{group.title}</h2>
            <div style={styles.soundList}>
              {group.sounds.map((sound, index) => (
                <button key={sound.name} type="button" onClick={sound.play} style={styles.soundButton}>
                  <span style={styles.soundNumber}>{index + 1}</span>
                  <span style={styles.soundText}>
                    <strong>{sound.name}</strong>
                    <small>{sound.desc}</small>
                  </span>
                  <span style={styles.play}>▶</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <footer style={styles.footer}>
        Respóndeme así: Giro 1, Campana 2, Sirena 1, Jackpot 3.
      </footer>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100dvh",
    background: "radial-gradient(circle at top, rgba(30,64,175,.55), transparent 35%), #020617",
    color: "#ffffff",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: "28px",
    boxSizing: "border-box",
  },
  header: {
    maxWidth: 1200,
    margin: "0 auto 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
  },
  title: {
    margin: 0,
    fontSize: "clamp(30px, 5vw, 58px)",
    fontWeight: 1000,
    letterSpacing: "-.04em",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#cbd5e1",
    fontSize: "18px",
  },
  stopButton: {
    border: "none",
    borderRadius: 999,
    padding: "16px 24px",
    background: "#ef4444",
    color: "#ffffff",
    fontWeight: 1000,
    cursor: "pointer",
  },
  grid: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 18,
  },
  card: {
    background: "rgba(15,23,42,.78)",
    border: "1px solid rgba(255,255,255,.13)",
    borderRadius: 24,
    padding: 18,
  },
  groupTitle: {
    margin: "0 0 14px",
    fontSize: 24,
  },
  soundList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  soundButton: {
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 18,
    background: "rgba(255,255,255,.08)",
    color: "#ffffff",
    padding: 14,
    display: "grid",
    gridTemplateColumns: "44px 1fr 36px",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
    textAlign: "left",
  },
  soundNumber: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "#facc15",
    color: "#111827",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 1000,
  },
  soundText: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  play: {
    fontSize: 24,
    color: "#22c55e",
  },
  footer: {
    maxWidth: 1200,
    margin: "24px auto 0",
    color: "#cbd5e1",
    fontSize: 16,
    textAlign: "center",
  },
};
