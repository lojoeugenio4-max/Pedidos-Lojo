// Accesos con contraseña (ver supabase/migracion_inventario.sql).
//
//  - AccesoAdmin: ya no pide contraseña (el Admin entra directo).
//  - AccesoInventario: enlace de los trabajadores (?admin&modo=inventario).
//    Piden la clave que el dueño define en Admin > Inventario.
//  - ClaveTrabajadores: tarjeta de Admin > Inventario para definir esa clave.
//
// Las contraseñas se guardan cifradas en Supabase; desde la app solo se
// puede comprobar si son correctas.
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const SESION_ADMIN = "lojo-admin-sesion";
const CLAVE_TRABAJADOR = "lojo-inventario-clave";

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Sesión del Admin (dura hasta cerrar el navegador) ----
export function haySesionAdmin() {
  try {
    return sessionStorage.getItem(SESION_ADMIN) === "1";
  } catch {
    return false;
  }
}

function abrirSesionAdmin() {
  try {
    sessionStorage.setItem(SESION_ADMIN, "1");
  } catch {
    // nada
  }
}

// ---- Clave recordada en el móvil del trabajador ----
export function leerClaveTrabajador() {
  try {
    return localStorage.getItem(CLAVE_TRABAJADOR) || "";
  } catch {
    return "";
  }
}

function guardarClaveTrabajador(clave) {
  try {
    localStorage.setItem(CLAVE_TRABAJADOR, clave);
  } catch {
    // nada
  }
}

export function olvidarClaveTrabajador() {
  try {
    localStorage.removeItem(CLAVE_TRABAJADOR);
  } catch {
    // nada
  }
}

// =====================================================================
// Admin de siempre: contraseña del dueño
// =====================================================================
export default function AccesoAdmin({ onEntrar }) {
  // El Admin ya NO pide contraseña: entra directo.
  useEffect(() => {
    abrirSesionAdmin();
    onEntrar?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// =====================================================================
// Enlace de los trabajadores: clave del inventario
// =====================================================================
export function AccesoInventario({ onEntrar }) {
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [comprobando, setComprobando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    const texto = clave.trim();
    if (!texto) return;
    setError("");
    setComprobando(true);
    const { data, error: errorRpc } = await supabase.rpc("inventario_comprobar_clave", { p_clave: texto });
    if (errorRpc) {
      setComprobando(false);
      return setError(`No se pudo comprobar: ${errorRpc.message}`);
    }
    if (data) {
      guardarClaveTrabajador(texto);
      onEntrar();
      return;
    }
    await esperar(800);
    setComprobando(false);
    setError("Clave incorrecta.");
  }

  return (
    <Pantalla titulo="Inventario" subtitulo="Cash Lojo">
      <form onSubmit={entrar} style={formulario}>
        <label style={campo}>
          <span style={etiqueta}>Clave</span>
          <input
            type="password"
            value={clave}
            onChange={(e) => {
              setClave(e.target.value);
              setError("");
            }}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            style={entrada}
          />
        </label>
        {error && <div style={cajaError}>{error}</div>}
        <button type="submit" style={botonEntrar} disabled={comprobando || !clave.trim()}>
          {comprobando ? "Comprobando…" : "Entrar"}
        </button>
      </form>
    </Pantalla>
  );
}

// Comprueba en silencio la clave recordada en el móvil (por si el dueño la
// ha cambiado). Devuelve true / false.
export async function claveTrabajadorSigueValida() {
  const clave = leerClaveTrabajador();
  if (!clave) return false;
  const { data, error } = await supabase.rpc("inventario_comprobar_clave", { p_clave: clave });
  if (error) return true; // sin conexión: no echar al trabajador
  return Boolean(data);
}

// =====================================================================
// Admin > Inventario: definir la clave de los trabajadores
// =====================================================================
export function ClaveTrabajadores() {
  const [configurada, setConfigurada] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [nueva, setNueva] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase.rpc("inventario_clave_configurada").then(({ data, error: errorRpc }) => {
      setConfigurada(errorRpc ? null : Boolean(data));
    });
  }, []);

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setMensaje("");
    if (nueva.trim().length < 3) return setError("La clave tiene que tener al menos 3 caracteres.");
    setGuardando(true);
    const { error: errorRpc } = await supabase.rpc("inventario_guardar_clave", { p_nueva: nueva.trim() });
    setGuardando(false);
    if (errorRpc) {
      return setError(
        /inventario_guardar_clave/.test(errorRpc.message)
          ? "Falta volver a ejecutar supabase/migracion_inventario.sql en Supabase."
          : `No se pudo guardar: ${errorRpc.message}`
      );
    }
    setMensaje(`✓ Clave de los trabajadores guardada: “${nueva.trim()}”. Apúntala para dársela.`);
    setConfigurada(true);
    setAbierto(false);
    setNueva("");
  }

  const enlace = `${window.location.origin}${window.location.pathname}?admin&modo=inventario`;

  return (
    <section style={tarjetaClave}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 950, color: "#0f172a" }}>🔑 Acceso de los trabajadores</h2>
          <div style={{ fontSize: "13px", fontWeight: 700, color: configurada ? "#166534" : "#b45309", marginTop: "2px" }}>
            {configurada === null
              ? "Falta ejecutar supabase/migracion_inventario.sql"
              : configurada
                ? "Clave definida"
                : "Todavía no hay clave: los trabajadores no pueden entrar"}
          </div>
        </div>
        {!abierto && configurada !== null && (
          <button type="button" style={botonPeq} onClick={() => setAbierto(true)}>
            {configurada ? "Cambiar clave" : "Definir clave"}
          </button>
        )}
      </div>

      <div style={cajaEnlace}>
        <div style={{ fontSize: "12px", fontWeight: 800, color: "#475569" }}>Enlace para el móvil de los trabajadores:</div>
        <div style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a", wordBreak: "break-all" }}>{enlace}</div>
        <button
          type="button"
          style={botonPeq}
          onClick={() => {
            navigator.clipboard?.writeText(enlace).then(
              () => setMensaje("✓ Enlace copiado. Pégalo en WhatsApp."),
              () => setMensaje("Copia el enlace a mano.")
            );
          }}
        >
          📋 Copiar enlace
        </button>
      </div>

      {abierto && (
        <form onSubmit={guardar} style={formulario}>
          <label style={campo}>
            <span style={etiqueta}>Nueva clave de los trabajadores</span>
            <input
              type="text"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              style={{ ...entrada, fontSize: "16px", padding: "11px" }}
              autoFocus
            />
          </label>
          {error && <div style={cajaError}>{error}</div>}
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" style={botonPeq} onClick={() => setAbierto(false)}>
              Cancelar
            </button>
            <button type="submit" style={{ ...botonEntrar, flex: 1, padding: "11px", fontSize: "15px" }} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar clave"}
            </button>
          </div>
        </form>
      )}
      {mensaje && <div style={cajaOk}>{mensaje}</div>}
    </section>
  );
}

function Pantalla({ titulo, subtitulo, children }) {
  return (
    <div style={fondo}>
      <div style={tarjeta}>
        <div style={logo}>L</div>
        <h1 style={tituloEstilo}>{titulo}</h1>
        <p style={subtituloEstilo}>{subtitulo}</p>
        {children}
      </div>
    </div>
  );
}

const fondo = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  background: "#f3f4f6",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  boxSizing: "border-box",
};
const tarjeta = {
  width: "100%",
  maxWidth: "360px",
  background: "#fff",
  borderRadius: "20px",
  padding: "24px 20px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  boxShadow: "0 20px 40px rgba(15,23,42,0.12)",
  boxSizing: "border-box",
};
const logo = {
  width: "52px",
  height: "52px",
  borderRadius: "14px",
  background: "#16a34a",
  color: "#fff",
  fontSize: "26px",
  fontWeight: 950,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  alignSelf: "center",
};
const tituloEstilo = { margin: 0, fontSize: "24px", fontWeight: 950, color: "#0f172a", textAlign: "center" };
const subtituloEstilo = { margin: "-6px 0 4px", fontSize: "14px", fontWeight: 700, color: "#64748b", textAlign: "center" };
const cargando = { textAlign: "center", color: "#64748b", fontWeight: 700 };
const formulario = { display: "flex", flexDirection: "column", gap: "12px" };
const campo = { display: "flex", flexDirection: "column", gap: "6px" };
const etiqueta = { fontSize: "13px", fontWeight: 900, color: "#475569" };
const entrada = {
  border: "2px solid #cbd5e1",
  borderRadius: "14px",
  padding: "14px",
  fontSize: "18px",
  fontWeight: 700,
  color: "#0f172a",
  width: "100%",
  boxSizing: "border-box",
};
const botonEntrar = {
  border: "none",
  borderRadius: "14px",
  padding: "15px",
  background: "#16a34a",
  color: "#fff",
  fontSize: "17px",
  fontWeight: 950,
  cursor: "pointer",
};
const botonPeq = {
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "9px 14px",
  background: "#fff",
  color: "#334155",
  fontSize: "14px",
  fontWeight: 800,
  cursor: "pointer",
  alignSelf: "flex-start",
};
const tarjetaClave = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "18px",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};
const cajaEnlace = {
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  borderRadius: "12px",
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};
const cajaError = { background: "#fef2f2", color: "#b91c1c", borderRadius: "12px", padding: "10px 12px", fontWeight: 800, fontSize: "14px" };
const cajaOk = { background: "#f0fdf4", color: "#166534", borderRadius: "12px", padding: "10px 12px", fontWeight: 800, fontSize: "14px" };
const cajaInfo = { background: "#eef2ff", color: "#3730a3", borderRadius: "12px", padding: "10px 12px", fontWeight: 700, fontSize: "13px" };
