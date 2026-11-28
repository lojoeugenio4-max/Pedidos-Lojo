import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import CarreraConfiguracion from "./CarreraConfiguracion";
import CarreraVillanos from "./CarreraVillanos";
import CarreraCasillasPremio from "./CarreraCasillasPremio";
import CarreraPremioFinal from "./CarreraPremioFinal";
import CarreraPremioMitad from "./CarreraPremioMitad";
import CarreraComodin from "./CarreraComodin";
import CarreraFreno from "./CarreraFreno";
import CarreraFavoritos from "./CarreraFavoritos";
import CarreraSprint from "./CarreraSprint";
import CarreraClasificacion from "./CarreraClasificacion";
import { avisoAtencion, avisoOk, boton } from "./lojopolyEstilos";
import { esNavidad } from "../utils/carreraTablero";

// Admin de La Loca Carrera de Lojo. Trabaja siempre con la última edición:
// la abierta (en preparación o en juego) o, si la última ya terminó, esa
// misma para ver el ganador y abrir la siguiente.

const PESTANAS = [
  { id: "configuracion", titulo: "Configuración y tiradas" },
  { id: "villanos", titulo: "Villanos y amigos" },
  { id: "casillas", titulo: "Casillas de premio" },
  { id: "empujon", titulo: "⭐ Favoritos y premios" },
  { id: "mitad", titulo: "Premio de la mitad (32)" },
  { id: "comodin", titulo: "🃏 Comodín" },
  { id: "freno", titulo: "🐢 Freno al líder" },
  { id: "sprint", titulo: "🏁 Sprint final" },
  { id: "final", titulo: "Premio final" },
  { id: "clasificacion", titulo: "Clasificación y premios" },
];

// Tiradas que los clientes no usaron en la edición anterior (p. ej. Halloween):
// se pueden pasar a la nueva con su mismo QR (admin_carrera_traspasar_pendientes,
// migracion_carrera_traspasar_pendientes.sql). Solo sale si hay algo que pasar.
function TraspasoPendientes({ edicionId }) {
  const [info, setInfo] = useState(null);
  const [pasando, setPasando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const contar = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("admin_carrera_traspasar_pendientes", { p_aplicar: false });
    setInfo(err ? null : data);
  }, []);

  useEffect(() => {
    contar();
  }, [contar, edicionId]);

  async function pasar() {
    if (!window.confirm(`¿Pasar ${info.tiradas} tiradas de ${info.clientes} clientes a esta edición?`)) return;
    setError("");
    setMensaje("");
    setPasando(true);
    const { data, error: err } = await supabase.rpc("admin_carrera_traspasar_pendientes", { p_aplicar: true });
    setPasando(false);
    if (err || !data?.ok) {
      setError(`No se han podido pasar: ${err?.message || data?.mensaje || "error desconocido"}`);
      return;
    }
    setMensaje(`Hecho: ${data.tiradas} tiradas de ${data.clientes} clientes pasadas. Usan el mismo QR que ya tenían.`);
    contar();
  }

  if (mensaje) return <div style={{ ...avisoOk, marginBottom: 16 }}>{mensaje}</div>;
  if (!info?.ok || !info.tiradas) return null;
  return (
    <div style={{ ...avisoAtencion, display: "grid", gap: 10, marginBottom: 16 }}>
      <span>
        🎟️ De la edición {info.edicion_anterior} quedaron <strong>{info.tiradas} tiradas sin usar</strong> de{" "}
        <strong>{info.clientes} clientes</strong>. Puedes pasarlas a esta edición: cada cliente las jugará con el mismo QR que ya tiene.
      </span>
      {error && <div style={avisoError}>{error}</div>}
      <button type="button" style={boton} onClick={pasar} disabled={pasando}>
        {pasando ? "Pasando..." : `Pasar las ${info.tiradas} tiradas a la edición ${info.edicion_nueva}`}
      </button>
    </div>
  );
}

export const ESTADOS_CARRERA = {
  preparacion: { texto: "En preparación", color: "#92400e", fondo: "#fef3c7" },
  en_juego: { texto: "En juego", color: "#166534", fondo: "#dcfce7" },
  terminada: { texto: "Terminada", color: "#374151", fondo: "#e5e7eb" },
};

export default function Carrera() {
  const [pestana, setPestana] = useState("configuracion");
  const [edicion, setEdicion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [abriendo, setAbriendo] = useState(false);

  const cargar = useCallback(async () => {
    setError("");
    const { data, error: err } = await supabase
      .from("carrera_ediciones")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (err) {
      setError(
        err.message?.includes("carrera_ediciones")
          ? "Falta aplicar la migración migracion_loca_carrera.sql en Supabase."
          : `No se ha podido cargar La Loca Carrera: ${err.message}`
      );
      setCargando(false);
      return;
    }
    setEdicion(data || null);
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function abrirNuevaEdicion() {
    setAbriendo(true);
    setError("");
    const { error: err } = await supabase.rpc("admin_carrera_nueva_edicion");
    setAbriendo(false);
    if (err) {
      setError(`No se ha podido abrir la nueva edición: ${err.message}`);
      return;
    }
    setPestana("configuracion");
    cargar();
  }

  const estado = edicion ? ESTADOS_CARRERA[edicion.estado] : null;
  const terminada = edicion?.estado === "terminada";

  return (
    <div>
      <h3 style={titulo}>🏁 La Loca Carrera de Lojo</h3>
      <p style={texto}>
        Todos los clientes en el mismo tablero de 63 casillas con 1 dado. El primero que llega a la meta con número
        exacto gana el premio final y la edición termina.
      </p>

      <div style={cajaNavidad}>
        <span>
          🎄 <strong>Tablero de Navidad para probar</strong> · Se abre con clientes inventados y el botón «⚙ Pruebas»
          para simular villanos, héroes, premios y la pantalla de espera. No toca la carrera real: la TV grande abre la
          versión de la edición actual ({esNavidad(edicion) ? "🎄 Navidad" : "🎃 Halloween"}).
        </span>
        <button
          type="button"
          style={{ ...boton, background: "#b91c1c" }}
          onClick={() => window.open("/loca-carrera/tablero-navidad.html", "_blank", "noopener")}
        >
          Probar tablero de Navidad
        </button>
      </div>

      {error && <div style={avisoError}>{error}</div>}

      {edicion && (
        <div style={cabeceraEdicion}>
          <strong>Edición {edicion.numero}</strong>
          <span style={{ ...pastilla, color: esNavidad(edicion) ? "#065f46" : "#9a3412", background: esNavidad(edicion) ? "#d1fae5" : "#ffedd5" }}>
            {esNavidad(edicion) ? "🎄 Navidad" : "🎃 Halloween"}
          </span>
          <span style={{ ...pastilla, color: estado.color, background: estado.fondo }}>{estado.texto}</span>
          {edicion.solo_pruebas && <span style={{ ...pastilla, color: "#1e40af", background: "#dbeafe" }}>Solo clientes de pruebas</span>}
        </div>
      )}

      {terminada && (
        <div style={{ ...avisoAtencion, display: "grid", gap: 10, marginBottom: 16 }}>
          <span>
            🏆 Esta edición terminó{edicion.terminada_at ? ` el ${new Date(edicion.terminada_at).toLocaleString("es-ES")}` : ""}.
            Ganador: <strong>{edicion.ganador_nombre || "—"}</strong>. Ya no se dan ni se juegan tiradas.
          </span>
          <button type="button" style={boton} onClick={abrirNuevaEdicion} disabled={abriendo}>
            {abriendo ? "Abriendo..." : `Abrir la edición ${edicion.numero + 1} (con la misma configuración)`}
          </button>
        </div>
      )}

      {edicion && !terminada && <TraspasoPendientes edicionId={edicion.id} />}

      <div style={barraPestanas} role="tablist">
        {PESTANAS.map((p) => {
          const deshabilitada = !edicion && p.id !== "configuracion";
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pestana === p.id}
              disabled={deshabilitada}
              title={deshabilitada ? "Crea primero la carrera" : undefined}
              onClick={() => setPestana(p.id)}
              style={botonPestana(pestana === p.id, deshabilitada)}
            >
              {p.titulo}
            </button>
          );
        })}
      </div>

      {cargando ? (
        <p style={texto}>Cargando La Loca Carrera...</p>
      ) : (
        <>
          {pestana === "configuracion" && <CarreraConfiguracion edicion={edicion} onGuardado={cargar} />}
          {pestana === "villanos" && edicion && <CarreraVillanos edicion={edicion} onGuardado={cargar} />}
          {pestana === "casillas" && edicion && <CarreraCasillasPremio edicion={edicion} />}
          {pestana === "empujon" && edicion && <CarreraFavoritos edicion={edicion} onGuardado={cargar} />}
          {pestana === "mitad" && edicion && <CarreraPremioMitad edicion={edicion} onGuardado={cargar} />}
          {pestana === "comodin" && edicion && <CarreraComodin edicion={edicion} onGuardado={cargar} />}
          {pestana === "freno" && edicion && <CarreraFreno edicion={edicion} onGuardado={cargar} />}
          {pestana === "sprint" && edicion && <CarreraSprint edicion={edicion} onGuardado={cargar} />}
          {pestana === "final" && edicion && <CarreraPremioFinal edicion={edicion} onGuardado={cargar} />}
          {pestana === "clasificacion" && edicion && <CarreraClasificacion edicion={edicion} />}
        </>
      )}
    </div>
  );
}

const titulo = { margin: "0 0 8px", fontSize: "22px", color: "#111827" };
const texto = { margin: "0 0 12px", color: "#6b7280", fontSize: "15px" };
const cajaNavidad = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, margin: "0 0 14px", padding: "10px 12px", borderRadius: 10, background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", fontSize: 14 };
const avisoError = { margin: "0 0 14px", padding: "10px 12px", borderRadius: 10, background: "#fef2f2", color: "#991b1b", fontSize: 14, fontWeight: 700 };
const cabeceraEdicion = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, margin: "0 0 14px", fontSize: 15, color: "#111827" };
const pastilla = { padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800 };
const barraPestanas = { display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 16px" };
const botonPestana = (activa, deshabilitada) => ({
  border: activa ? "1px solid #1d4ed8" : "1px solid #d1d5db",
  background: activa ? "#1d4ed8" : "#fff",
  color: activa ? "#fff" : deshabilitada ? "#9ca3af" : "#374151",
  borderRadius: 999,
  padding: "8px 14px",
  fontSize: 14,
  fontWeight: 700,
  cursor: deshabilitada ? "not-allowed" : "pointer",
});
