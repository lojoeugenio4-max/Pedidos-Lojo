import { useMemo, useRef, useState } from "react";
import RuletaCanvas from "./RuletaCanvas";
import {
  calcularIndicePremio,
  calcularRotacionDestino,
  elegirPremio,
} from "./RuletaHelpers";

export default function RuletaVisual({ premios = [], onPremioGanado }) {
  const premiosActivos = useMemo(
    () => premios.filter((p) => p.activo !== false),
    [premios]
  );

  const [rotacion, setRotacion] = useState(0);
  const [girando, setGirando] = useState(false);
  const [tick, setTick] = useState(0);

  const rotacionRef = useRef(0);
  const ultimoSectorRef = useRef(null);
  const frameRef = useRef(null);

  function girar() {
    if (girando || !premiosActivos.length) return;

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }

    const premio = elegirPremio(premiosActivos);
    const indiceGanador = calcularIndicePremio(premiosActivos, premio);

    const destino =
      calcularRotacionDestino({
        rotacionActual: rotacionRef.current,
        indiceGanador,
        totalPremios: premiosActivos.length,
      }) + 360 * 22;

    const inicio = rotacionRef.current;
    const distanciaTotal = destino - inicio;

    let rotacionActual = inicio;
    let velocidad = 42; // fuerza inicial
    let ultimaVez = performance.now();

    const zonaFinal = 900; // últimos grados donde frena muy lento
    const velocidadMinima = 0.035;

    setGirando(true);

    function animar(ahora) {
      const delta = Math.min((ahora - ultimaVez) / 16.67, 2);
      ultimaVez = ahora;

      const restante = destino - rotacionActual;

      if (restante <= 0.4 && velocidad <= velocidadMinima * 3) {
        rotacionActual = destino;
        rotacionRef.current = destino;
        setRotacion(destino);
        setGirando(false);

        setTimeout(() => {
          onPremioGanado?.(premio);
        }, 900);

        return;
      }

      if (restante < zonaFinal) {
        // Frenada larga y dramática al final
        const factorFinal = Math.max(restante / zonaFinal, 0.015);
        velocidad = Math.max(velocidad * 0.985, velocidadMinima);
        velocidad = Math.min(velocidad, 9 * factorFinal + velocidadMinima);
      } else {
        // Freno progresivo normal
        velocidad *= 0.992;
      }

      rotacionActual += velocidad * delta;

      if (rotacionActual > destino) {
        rotacionActual = destino;
      }

      rotacionRef.current = rotacionActual;
      setRotacion(rotacionActual);

      const gradosSector = 360 / premiosActivos.length;
      const sectorActual = Math.floor(
        (((rotacionActual % 360) + 360) % 360) / gradosSector
      );

      if (sectorActual !== ultimoSectorRef.current) {
        ultimoSectorRef.current = sectorActual;
        setTick((v) => v + 1);
      }

      frameRef.current = requestAnimationFrame(animar);
    }

    frameRef.current = requestAnimationFrame(animar);
  }

  return (
    <div style={contenedor}>
      <RuletaCanvas
        premios={premiosActivos}
        rotacion={rotacion}
        girando={girando}
        tick={tick}
      />

      <button style={boton} onClick={girar} disabled={girando}>
        {girando ? "GIRANDO..." : "GIRAR RULETA"}
      </button>
    </div>
  );
}

const contenedor = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 24,
};

const boton = {
  border: 0,
  borderRadius: 14,
  background: "#f59e0b",
  color: "#fff",
  fontSize: 22,
  fontWeight: 900,
  padding: "16px 28px",
  cursor: "pointer",
};
