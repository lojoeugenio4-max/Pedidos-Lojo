import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import LojoPolyConfiguracion from "./LojoPolyConfiguracion";
import LojoPolyGrupos from "./LojoPolyGrupos";
import LojoPolyEspeciales from "./LojoPolyEspeciales";
import LojoPolyTablero from "./LojoPolyTablero";
import LojoPolyPremios from "./LojoPolyPremios";

// Admin de LojoPoly. Carga la campaña (de momento una sola, la más antigua)
// con sus grupos y casillas, y la reparte entre las pestañas.

const PESTANAS = [
  { id: "configuracion", titulo: "Configuración" },
  { id: "grupos", titulo: "Grupos y artículos" },
  { id: "especiales", titulo: "Casillas especiales" },
  { id: "tablero", titulo: "Tablero" },
  { id: "premios", titulo: "Premios ganados" },
];

export default function LojoPoly() {
  const [pestana, setPestana] = useState("configuracion");
  const [campana, setCampana] = useState(null);
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setError("");

    const { data: camp, error: campError } = await supabase
      .from("lojopoly_campanas")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (campError) {
      setError(
        campError.message?.includes("lojopoly_campanas")
          ? "Falta aplicar la migración migracion_lojopoly_admin.sql en Supabase."
          : `No se ha podido cargar LojoPoly: ${campError.message}`
      );
      setCargando(false);
      return;
    }

    setCampana(camp || null);

    if (!camp) {
      setGrupos([]);
      setCargando(false);
      return;
    }

    const [{ data: gruposData, error: gruposError }, { data: casillasData, error: casillasError }] =
      await Promise.all([
        supabase.from("lojopoly_grupos").select("*").eq("campana_id", camp.id).order("orden", { ascending: true }),
        supabase
          .from("lojopoly_casillas")
          .select("*, articulos(id, codigo, nombre, foto)")
          .eq("campana_id", camp.id)
          .eq("tipo", "propiedad")
          .order("orden_en_grupo", { ascending: true }),
      ]);

    if (gruposError || casillasError) {
      setError(`No se han podido cargar los grupos: ${(gruposError || casillasError).message}`);
      setCargando(false);
      return;
    }

    setGrupos(
      (gruposData || []).map((grupo) => ({
        ...grupo,
        casillas: (casillasData || []).filter((c) => c.grupo_id === grupo.id),
      }))
    );
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div>
      <h3 style={titulo}>🎲 LojoPoly</h3>
      <p style={texto}>
        Tablero cuadrado con un dado. Cada grupo de color es un proveedor y cada casilla un artículo del catálogo.
        El cliente gana el premio del grupo cuando consigue todas sus casillas.
      </p>

      {error && <div style={avisoError}>{error}</div>}

      {campana?.activa && (
        <div style={avisoActiva}>
          La campaña está activa. Si cambias grupos o artículos, vuelve a guardar el tablero: las casillas que ya
          tienen los clientes se conservan.
        </div>
      )}

      <div style={barraPestanas} role="tablist">
        {PESTANAS.map((p) => {
          const deshabilitada = !campana && p.id !== "configuracion";
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pestana === p.id}
              disabled={deshabilitada}
              title={deshabilitada ? "Guarda primero la configuración" : undefined}
              onClick={() => setPestana(p.id)}
              style={botonPestana(pestana === p.id, deshabilitada)}
            >
              {p.titulo}
            </button>
          );
        })}
      </div>

      {cargando ? (
        <p style={texto}>Cargando LojoPoly...</p>
      ) : (
        <>
          {pestana === "configuracion" && <LojoPolyConfiguracion campana={campana} onGuardado={cargar} />}
          {pestana === "grupos" && campana && <LojoPolyGrupos campana={campana} grupos={grupos} onCambio={cargar} />}
          {pestana === "especiales" && campana && <LojoPolyEspeciales campana={campana} onCambio={cargar} />}
          {pestana === "tablero" && campana && <LojoPolyTablero campana={campana} grupos={grupos} onGuardado={cargar} />}
          {pestana === "premios" && campana && <LojoPolyPremios campana={campana} />}
        </>
      )}
    </div>
  );
}

const titulo = { margin: "0 0 8px", fontSize: "22px", color: "#111827" };
const texto = { margin: "0 0 12px", color: "#6b7280", fontSize: "15px" };
const avisoError = { margin: "0 0 14px", padding: "10px 12px", borderRadius: 10, background: "#fef2f2", color: "#991b1b", fontSize: 14, fontWeight: 700 };
const avisoActiva = { margin: "0 0 14px", padding: "11px 13px", borderRadius: "11px", background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: "13px", fontWeight: "700" };
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
