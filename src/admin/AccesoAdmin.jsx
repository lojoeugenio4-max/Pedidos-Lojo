// Pantalla "Acceso" del Admin.
//   - Contraseña "coke" (trabajadores): solo se ve el Inventario.
//   - Contraseña del Admin completo: se ve todo. Se guarda CIFRADA en
//     Supabase (tabla admin_acceso, ver supabase/migracion_inventario.sql)
//     y la crea el dueño la primera vez que entra.
// "Recordar en este dispositivo" evita volver a escribirla en ese móvil u
// ordenador hasta que se pulse "Salir".
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabaseClient";

// Contraseña de los trabajadores (da igual mayúsculas o minúsculas).
const CLAVE_INVENTARIO = "coke";
const CLAVE_GUARDADA = "lojo-admin-acceso";

export function leerAcceso() {
  try {
    const valor = localStorage.getItem(CLAVE_GUARDADA) || sessionStorage.getItem(CLAVE_GUARDADA);
    return valor === "inventario" || valor === "completo" ? valor : null;
  } catch {
    return null;
  }
}

function guardarAcceso(rol, recordar) {
  try {
    if (recordar) localStorage.setItem(CLAVE_GUARDADA, rol);
    else sessionStorage.setItem(CLAVE_GUARDADA, rol);
  } catch {
    // nada
  }
}

export function borrarAcceso() {
  try {
    localStorage.removeItem(CLAVE_GUARDADA);
    sessionStorage.removeItem(CLAVE_GUARDADA);
  } catch {
    // nada
  }
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export default function AccesoAdmin({ onEntrar }) {
  const [clave, setClave] = useState("");
  const [recordar, setRecordar] = useState(true);
  const [error, setError] = useState("");
  const [comprobando, setComprobando] = useState(false);
  // null = comprobando · true/false = ¿hay contraseña del Admin completo?
  const [configurada, setConfigurada] = useState(null);
  const [faltaSql, setFaltaSql] = useState(false);
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");

  useEffect(() => {
    supabase.rpc("admin_clave_configurada").then(({ data, error: errorRpc }) => {
      if (errorRpc) {
        console.warn("Acceso al Admin:", errorRpc.message);
        setFaltaSql(true);
        setConfigurada(true);
        return;
      }
      setConfigurada(Boolean(data));
    });
  }, []);

  function entrar(rol) {
    guardarAcceso(rol, recordar);
    onEntrar(rol);
  }

  async function alEnviar(e) {
    e.preventDefault();
    const texto = clave.trim();
    if (!texto) return;
    setError("");

    if (texto.toLowerCase() === CLAVE_INVENTARIO) {
      entrar("inventario");
      return;
    }

    setComprobando(true);
    const { data, error: errorRpc } = await supabase.rpc("admin_comprobar_clave", { p_clave: texto });
    if (errorRpc) {
      setComprobando(false);
      setError(
        faltaSql
          ? "Falta ejecutar supabase/migracion_inventario.sql en Supabase."
          : `No se pudo comprobar: ${errorRpc.message}`
      );
      return;
    }
    if (data) {
      setComprobando(false);
      entrar("completo");
      return;
    }
    // Pequeña espera para que no se puedan probar contraseñas a lo loco.
    await esperar(800);
    setComprobando(false);
    setError("Contraseña incorrecta.");
  }

  async function crearClave(e) {
    e.preventDefault();
    setError("");
    if (nueva.length < 6) {
      setError("La contraseña del Admin tiene que tener al menos 6 caracteres.");
      return;
    }
    if (nueva.trim().toLowerCase() === CLAVE_INVENTARIO) {
      setError(`No puede ser "${CLAVE_INVENTARIO}": esa es la de los trabajadores.`);
      return;
    }
    if (nueva !== repetir) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setComprobando(true);
    const { data, error: errorRpc } = await supabase.rpc("admin_crear_clave", { p_clave: nueva });
    setComprobando(false);
    if (errorRpc) {
      setError(`No se pudo crear: ${errorRpc.message}`);
      return;
    }
    if (!data) {
      setError("Ya había una contraseña creada. Entra con ella.");
      setConfigurada(true);
      return;
    }
    entrar("completo");
  }

  return (
    <div style={fondo}>
      <div style={tarjeta}>
        <div style={logo}>L</div>
        <h1 style={titulo}>Acceso</h1>
        <p style={subtitulo}>Cash Lojo · Administración</p>

        {configurada === null ? (
          <div style={{ textAlign: "center", color: "#64748b", fontWeight: 700 }}>Cargando…</div>
        ) : configurada ? (
          <form onSubmit={alEnviar} style={formulario}>
            <label style={campo}>
              <span style={etiqueta}>Contraseña</span>
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
                autoComplete="current-password"
                style={entrada}
              />
            </label>
            <label style={casilla}>
              <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
              Recordar en este dispositivo
            </label>
            {error && <div style={cajaError}>{error}</div>}
            {faltaSql && (
              <div style={cajaAviso}>
                Falta ejecutar <b>supabase/migracion_inventario.sql</b> en Supabase → SQL Editor.
              </div>
            )}
            <button type="submit" style={botonEntrar} disabled={comprobando || !clave.trim()}>
              {comprobando ? "Comprobando…" : "Entrar"}
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={alEnviar} style={formulario}>
              <label style={campo}>
                <span style={etiqueta}>Contraseña de trabajadores</span>
                <input
                  type="password"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  style={entrada}
                />
              </label>
              <button type="submit" style={botonSecundario} disabled={!clave.trim()}>
                Entrar al Inventario
              </button>
            </form>

            <div style={separador} />

            <form onSubmit={crearClave} style={formulario}>
              <div style={cajaInfo}>
                <b>Primera vez:</b> crea la contraseña del <b>Admin completo</b>. Solo tú debes saberla. Se guarda
                cifrada y nadie podrá verla.
              </div>
              <label style={campo}>
                <span style={etiqueta}>Nueva contraseña (mínimo 6)</span>
                <input
                  type="password"
                  value={nueva}
                  onChange={(e) => setNueva(e.target.value)}
                  autoComplete="new-password"
                  style={entrada}
                />
              </label>
              <label style={campo}>
                <span style={etiqueta}>Repítela</span>
                <input
                  type="password"
                  value={repetir}
                  onChange={(e) => setRepetir(e.target.value)}
                  autoComplete="new-password"
                  style={entrada}
                />
              </label>
              <label style={casilla}>
                <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
                Recordar en este dispositivo
              </label>
              {error && <div style={cajaError}>{error}</div>}
              <button type="submit" style={botonEntrar} disabled={comprobando}>
                {comprobando ? "Guardando…" : "Crear contraseña y entrar"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// Ventana para cambiar la contraseña del Admin completo.
export function CambiarClaveAdmin({ onCerrar }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cambiar(e) {
    e.preventDefault();
    setError("");
    if (nueva.length < 6) return setError("La nueva contraseña tiene que tener al menos 6 caracteres.");
    if (nueva.trim().toLowerCase() === CLAVE_INVENTARIO)
      return setError(`No puede ser "${CLAVE_INVENTARIO}": esa es la de los trabajadores.`);
    if (nueva !== repetir) return setError("Las dos contraseñas nuevas no coinciden.");
    setGuardando(true);
    const { data, error: errorRpc } = await supabase.rpc("admin_cambiar_clave", { p_actual: actual, p_nueva: nueva });
    setGuardando(false);
    if (errorRpc) return setError(`No se pudo cambiar: ${errorRpc.message}`);
    if (!data) return setError("La contraseña actual no es correcta.");
    setMensaje("✓ Contraseña cambiada.");
    setActual("");
    setNueva("");
    setRepetir("");
  }

  return createPortal(
    <div style={{ ...fondo, position: "fixed", inset: 0, zIndex: 9000, background: "rgba(15,23,42,0.6)" }} onClick={onCerrar}>
      <form style={tarjeta} onClick={(e) => e.stopPropagation()} onSubmit={cambiar}>
        <h2 style={{ ...titulo, fontSize: "20px" }}>🔑 Cambiar contraseña del Admin</h2>
        <label style={campo}>
          <span style={etiqueta}>Contraseña actual</span>
          <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} style={entrada} autoFocus />
        </label>
        <label style={campo}>
          <span style={etiqueta}>Nueva contraseña (mínimo 6)</span>
          <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} style={entrada} autoComplete="new-password" />
        </label>
        <label style={campo}>
          <span style={etiqueta}>Repite la nueva</span>
          <input type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} style={entrada} autoComplete="new-password" />
        </label>
        {error && <div style={cajaError}>{error}</div>}
        {mensaje && <div style={cajaOk}>{mensaje}</div>}
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" style={botonSecundario} onClick={onCerrar}>
            Cerrar
          </button>
          <button type="submit" style={{ ...botonEntrar, flex: 1 }} disabled={guardando}>
            {guardando ? "Guardando…" : "Cambiar"}
          </button>
        </div>
        <p style={{ margin: 0, fontSize: "12px", color: "#64748b", fontWeight: 700 }}>
          La contraseña de los trabajadores (“{CLAVE_INVENTARIO}”) no cambia.
        </p>
      </form>
    </div>,
    document.body
  );
}

const fondo = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  background: "linear-gradient(160deg, #0f172a 0%, #1e293b 100%)",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  boxSizing: "border-box",
};
const tarjeta = {
  width: "100%",
  maxWidth: "380px",
  background: "#fff",
  borderRadius: "22px",
  padding: "26px 22px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
  boxSizing: "border-box",
};
const logo = {
  width: "56px",
  height: "56px",
  borderRadius: "16px",
  background: "#16a34a",
  color: "#fff",
  fontSize: "28px",
  fontWeight: 950,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  alignSelf: "center",
};
const titulo = { margin: 0, fontSize: "26px", fontWeight: 950, color: "#0f172a", textAlign: "center" };
const subtitulo = { margin: "-8px 0 0", fontSize: "14px", fontWeight: 700, color: "#64748b", textAlign: "center" };
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
const casilla = { display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 700, color: "#334155" };
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
const botonSecundario = {
  border: "1px solid #cbd5e1",
  borderRadius: "14px",
  padding: "13px",
  background: "#fff",
  color: "#334155",
  fontSize: "15px",
  fontWeight: 900,
  cursor: "pointer",
};
const separador = { height: "1px", background: "#e2e8f0", margin: "4px 0" };
const cajaError = { background: "#fef2f2", color: "#b91c1c", borderRadius: "12px", padding: "10px 12px", fontWeight: 800, fontSize: "14px" };
const cajaOk = { background: "#f0fdf4", color: "#166534", borderRadius: "12px", padding: "10px 12px", fontWeight: 800, fontSize: "14px" };
const cajaAviso = { background: "#fffbeb", color: "#92400e", borderRadius: "12px", padding: "10px 12px", fontWeight: 700, fontSize: "13px" };
const cajaInfo = { background: "#eef2ff", color: "#3730a3", borderRadius: "12px", padding: "10px 12px", fontWeight: 600, fontSize: "13px" };
