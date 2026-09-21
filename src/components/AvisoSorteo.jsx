// Aviso en la app del cliente: "tu cuadrícula se sortea el jueves a las
// 20:30", con cuenta atrás cuando falta menos de una hora. Se muestra a los
// clientes que tienen números en una cuadrícula con fecha de sorteo.
//
// Tiene su propio reloj interno a propósito: así el segundero solo repinta
// este avisito y no toda la pantalla de pedidos.
import { useEffect, useState } from "react";
import { formatearFechaSorteo } from "../../utils/sorteoDirecto";

const UNA_HORA_MS = 60 * 60 * 1000;

function cuentaAtras(faltanMs) {
  if (faltanMs <= 0) return "Empezando…";
  const totalSeg = Math.floor(faltanMs / 1000);
  const horas = Math.floor(totalSeg / 3600);
  const minutos = Math.floor((totalSeg % 3600) / 60);
  const segundos = totalSeg % 60;
  const dos = (n) => String(n).padStart(2, "0");
  return horas > 0 ? `${horas}:${dos(minutos)}:${dos(segundos)}` : `${dos(minutos)}:${dos(segundos)}`;
}

export default function AvisoSorteo({ proximas = [], getAhora, onAbrir = null }) {
  const [, setTic] = useState(0);

  const hayCuentaAtras = proximas.some((ed) => ed.programadoAt - getAhora() < UNA_HORA_MS);
  useEffect(() => {
    if (!proximas.length) return undefined;
    const intervalo = window.setInterval(() => setTic((n) => n + 1), hayCuentaAtras ? 1000 : 30000);
    return () => window.clearInterval(intervalo);
  }, [proximas.length, hayCuentaAtras]);

  if (!proximas.length) return null;
  const ahora = getAhora();

  return (
    <div style={estilos.lista}>
      {proximas.map((ed) => {
        const faltan = ed.programadoAt - ahora;
        const Contenedor = onAbrir ? "button" : "div";
        return (
          <Contenedor
            key={ed.id}
            type={onAbrir ? "button" : undefined}
            onClick={onAbrir || undefined}
            style={{ ...estilos.tarjeta, cursor: onAbrir ? "pointer" : "default" }}
          >
            <span style={estilos.icono}>🎟️</span>
            <span style={estilos.texto}>
              <strong style={estilos.titulo}>
                {ed.nombre}: sorteo el {formatearFechaSorteo(ed.programadoAt)}
              </strong>
              <span style={estilos.detalle}>
                {ed.misNumeros.length > 0
                  ? `Tus números: ${ed.misNumeros.map((n) => String(n).padStart(2, "0")).join(" · ")}. `
                  : ""}
                Abre esta app a esa hora y verás el sorteo en directo.
              </span>
            </span>
            {faltan < UNA_HORA_MS && <span style={estilos.cuenta}>{cuentaAtras(faltan)}</span>}
          </Contenedor>
        );
      })}
    </div>
  );
}

const estilos = {
  lista: { display: "grid", gap: 8, width: "100%" },
  tarjeta: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    boxSizing: "border-box",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 14,
    border: "2px solid #eab308",
    background: "linear-gradient(135deg, #fef9c3, #fde68a)",
    color: "#713f12",
    font: "inherit",
  },
  icono: { fontSize: 26, flexShrink: 0 },
  texto: { display: "grid", gap: 2, flex: 1, minWidth: 0 },
  titulo: { fontSize: 14, lineHeight: 1.25 },
  detalle: { fontSize: 12, lineHeight: 1.3, fontWeight: 600 },
  cuenta: {
    flexShrink: 0,
    padding: "5px 10px",
    borderRadius: 999,
    background: "#7f1d1d",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 14,
    fontVariantNumeric: "tabular-nums",
  },
};
