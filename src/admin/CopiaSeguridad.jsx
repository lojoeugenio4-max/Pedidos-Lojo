import { useState } from "react";

// Apartado "Copia de seguridad" dentro de Admin > Configuración.
//
// El navegador NO puede hacer la copia por sí mismo (no puede ejecutar
// pg_dump ni debe tener las claves secretas). Este botón solo abre el
// enlace "copialojo://", que en el ordenador de la tienda está asociado
// al lanzador instalado con "INSTALAR BOTON ADMIN.bat" del USB. Ese
// lanzador espera a que se conecte el USB, ejecuta la copia que hay en
// él y lo expulsa al terminar. Las claves solo viven en el USB.

const CLAVE_ULTIMO_USO = "copia_seguridad_ultimo_uso";
const DIAS_AVISO = 7;

function leerUltimoUso() {
  try {
    const valor = window.localStorage.getItem(CLAVE_ULTIMO_USO);
    const fecha = valor ? new Date(valor) : null;
    return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
  } catch {
    return null;
  }
}

function guardarUltimoUso(fecha) {
  try {
    window.localStorage.setItem(CLAVE_ULTIMO_USO, fecha.toISOString());
  } catch {
    // Sin almacenamiento disponible: no pasa nada, solo no se recuerda la fecha.
  }
}

function diasDesde(fecha) {
  if (!fecha) return null;
  return Math.floor((Date.now() - fecha.getTime()) / (24 * 60 * 60 * 1000));
}

export default function CopiaSeguridad() {
  const [ultimoUso, setUltimoUso] = useState(leerUltimoUso);
  const [pulsado, setPulsado] = useState(false);

  const esMovil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  const dias = diasDesde(ultimoUso);
  const tocaCopia = dias === null || dias >= DIAS_AVISO;

  function lanzarCopia() {
    // Un enlace temporal es la forma más fiable de abrir un protocolo propio
    // sin salir de la página del Admin.
    const enlace = document.createElement("a");
    enlace.href = "copialojo://copia";
    enlace.style.display = "none";
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);

    const ahora = new Date();
    guardarUltimoUso(ahora);
    setUltimoUso(ahora);
    setPulsado(true);
  }

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0 }}>💾 Copia de seguridad</h2>

      <p style={texto}>
        Guarda en el USB de copias <strong>todo</strong>: el código de GitHub, la base de
        datos completa de Supabase y todas las fotos. Al terminar, el USB se expulsa solo
        para que lo guardes desconectado.
      </p>

      {esMovil ? (
        <p style={{ ...aviso, background: "#fef3c7", color: "#92400e" }}>
          Este botón solo funciona en el ordenador de la tienda, donde está instalado el
          programa de copias. Desde el móvil no se puede hacer.
        </p>
      ) : (
        <>
          <ol style={pasos}>
            <li>Pulsa el botón verde.</li>
            <li>
              Se abre una ventana negra. Cuando lo pida, <strong>conecta el USB</strong> (lo
              detecta solo).
            </li>
            <li>Espera a que diga <strong>"LISTO. YA PUEDES QUITAR EL USB"</strong> y quítalo.</li>
          </ol>

          <button onClick={lanzarCopia} style={botonGrande}>
            💾 Hacer copia de seguridad
          </button>

          {pulsado && (
            <div style={{ ...aviso, background: "#eff6ff", color: "#1e3a8a" }}>
              <p style={{ margin: "0 0 6px" }}>
                <strong>Si el navegador pregunta "¿Abrir Copia de seguridad Cash Lojo?"</strong>,
                marca "Permitir siempre" y pulsa <strong>Abrir</strong>.
              </p>
              <p style={{ margin: 0 }}>
                Si no se abre ninguna ventana, falta instalar el botón en este ordenador:
                conecta el USB y haz doble clic en <strong>INSTALAR BOTON ADMIN.bat</strong>{" "}
                (dentro de la carpeta Copia-Lojo). Solo hay que hacerlo una vez.
              </p>
            </div>
          )}
        </>
      )}

      <p
        style={{
          ...aviso,
          background: tocaCopia ? "#fee2e2" : "#dcfce7",
          color: tocaCopia ? "#991b1b" : "#166534",
        }}
      >
        {ultimoUso
          ? `Último uso del botón en este ordenador: ${ultimoUso.toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}${dias > 0 ? ` (hace ${dias} ${dias === 1 ? "día" : "días"})` : " (hoy)"}.`
          : "Todavía no se ha usado el botón en este ordenador."}
        {tocaCopia && " Recomendado: una copia por semana."}
      </p>
    </div>
  );
}

const card = {
  padding: "22px",
  border: "2px solid #22c55e",
  borderRadius: "14px",
  background: "#fff",
  maxWidth: "700px",
  marginBottom: "20px",
};

const texto = {
  margin: "0 0 12px",
  lineHeight: 1.5,
};

const pasos = {
  margin: "0 0 16px",
  paddingLeft: "22px",
  lineHeight: 1.7,
};

const botonGrande = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  borderRadius: "12px",
  padding: "16px 26px",
  fontSize: "18px",
  fontWeight: "bold",
  cursor: "pointer",
};

const aviso = {
  marginTop: "14px",
  marginBottom: 0,
  padding: "12px 14px",
  borderRadius: "10px",
  fontSize: "14px",
  lineHeight: 1.5,
};
