import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

// Lista negra del Sorteo (clientes que nunca salen premiados) y lista de
// ganadores anteriores (no vuelven a ganar si está activada la opción
// "sin repetir ganadores" en la configuración).
function dosDigitos(numero) {
  return String(numero ?? "").padStart(2, "0");
}

function fechaCorta(iso) {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (!Number.isFinite(fecha.getTime())) return "";
  return fecha.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function normalizar(textoBuscar) {
  return String(textoBuscar || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export default function SorteoExclusiones() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [listaNegra, setListaNegra] = useState([]);
  const [ganadores, setGanadores] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [ocupado, setOcupado] = useState(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setError("");
    const [{ data, error: rpcError }, { data: clientesData }] = await Promise.all([
      supabase.rpc("admin_sorteo_exclusiones"),
      supabase.from("clientes").select("token,nombre,codigo_lojo,estado").order("nombre", { ascending: true }),
    ]);
    if (rpcError) {
      console.error(rpcError);
      setError(
        "No se ha podido cargar la lista negra. ¿Has ejecutado en Supabase el archivo migracion_sorteo_lista_negra.sql?"
      );
    } else {
      setListaNegra(Array.isArray(data?.lista_negra) ? data.lista_negra : []);
      setGanadores(Array.isArray(data?.ganadores) ? data.ganadores : []);
    }
    setClientes(clientesData || []);
    setCargando(false);
  }

  const tokensListaNegra = useMemo(() => new Set(listaNegra.map((c) => c.token)), [listaNegra]);

  const resultados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (q.length < 2) return [];
    return clientes
      .filter((c) => c.token && !tokensListaNegra.has(String(c.token)))
      .filter((c) => normalizar(c.nombre).includes(q) || normalizar(c.codigo_lojo).includes(q))
      .slice(0, 8);
  }, [busqueda, clientes, tokensListaNegra]);

  async function cambiarListaNegra(token, enLista) {
    setOcupado(`ln:${token}`);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_sorteo_lista_negra", {
        p_token: String(token),
        p_en_lista: enLista,
      });
      if (rpcError) throw rpcError;
      if (!data?.ok) throw new Error("No se ha podido guardar.");
      if (enLista) setBusqueda("");
      await cargar();
    } catch (err) {
      console.error(err);
      alert(err?.message || "No se ha podido guardar.");
    } finally {
      setOcupado(null);
    }
  }

  async function cambiarPermitir(token, permitir) {
    setOcupado(`g:${token}`);
    try {
      const { error: rpcError } = await supabase.rpc("admin_sorteo_permitir_ganar", {
        p_token: String(token),
        p_permitir: permitir,
      });
      if (rpcError) throw rpcError;
      await cargar();
    } catch (err) {
      console.error(err);
      alert(err?.message || "No se ha podido guardar.");
    } finally {
      setOcupado(null);
    }
  }

  if (cargando) return <p style={texto}>Cargando lista negra...</p>;

  return (
    <div style={contenedor}>
      <h4 style={titulo}>🚫 Lista negra</h4>
      <p style={texto}>
        Los clientes de esta lista siguen recibiendo números (no notan nada), pero <strong>nunca salen como
        ganadores</strong> cuando el número sale al azar. Si fijas tú el número a mano, manda lo que fijes.
      </p>

      {error && <div style={avisoError}>{error}</div>}

      <label style={campo}>
        <span>Añadir cliente</span>
        <input
          style={input}
          type="search"
          placeholder="Escribe el nombre o el código Lojo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </label>
      {resultados.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {resultados.map((c) => (
            <div key={c.token} style={fila}>
              <div>
                <strong>{c.nombre || "Sin nombre"}</strong>
                <div style={texto}>
                  {c.codigo_lojo ? `Código ${c.codigo_lojo}` : "Sin código"}
                  {c.estado === "inactivo" ? " · inactivo" : ""}
                </div>
              </div>
              <button
                type="button"
                style={botonPeligro}
                onClick={() => cambiarListaNegra(c.token, true)}
                disabled={Boolean(ocupado)}
              >
                {ocupado === `ln:${c.token}` ? "Añadiendo..." : "Añadir a lista negra"}
              </button>
            </div>
          ))}
        </div>
      )}
      {busqueda.trim().length >= 2 && resultados.length === 0 && (
        <p style={texto}>No hay clientes con ese nombre (o ya están en la lista).</p>
      )}

      <div style={{ display: "grid", gap: 6 }}>
        {listaNegra.length === 0 && <p style={texto}>La lista negra está vacía.</p>}
        {listaNegra.map((c) => (
          <div key={c.token} style={filaNegra}>
            <div>
              <strong>{c.nombre || "Cliente"}</strong>
              <div style={texto}>
                {c.codigo_lojo ? `Código ${c.codigo_lojo} · ` : ""}En la lista desde el {fechaCorta(c.desde)}
              </div>
            </div>
            <button
              type="button"
              style={botonSecundario}
              onClick={() => cambiarListaNegra(c.token, false)}
              disabled={Boolean(ocupado)}
            >
              {ocupado === `ln:${c.token}` ? "Quitando..." : "Quitar"}
            </button>
          </div>
        ))}
      </div>

      <h4 style={{ ...titulo, marginTop: 10 }}>🏆 Ganadores anteriores</h4>
      <p style={texto}>
        Con la opción «Al azar, sin repetir ganadores» activada en la configuración, estos clientes no pueden volver
        a salir premiados. Si quieres que alguno vuelva a poder ganar, pulsa «Dejar que vuelva a ganar».
      </p>
      <div style={{ display: "grid", gap: 6 }}>
        {ganadores.length === 0 && <p style={texto}>Todavía no hay ganadores.</p>}
        {ganadores.map((g) => (
          <div key={g.token} style={g.puede_volver_a_ganar ? fila : filaGanador}>
            <div>
              <strong>{g.nombre || "Cliente"}</strong>
              {tokensListaNegra.has(g.token) && <span style={badgeNegra}>LISTA NEGRA</span>}
              <div style={texto}>
                {(g.sorteos || [])
                  .map((s) => `Sorteo ${s.edicion} (nº ${dosDigitos(s.numero)}, ${fechaCorta(s.fecha)})`)
                  .join(" · ")}
              </div>
              <div style={{ ...texto, fontWeight: 700, color: g.puede_volver_a_ganar ? "#166534" : "#92400e" }}>
                {g.puede_volver_a_ganar ? "Puede volver a ganar" : "No puede volver a ganar"}
              </div>
            </div>
            <button
              type="button"
              style={botonSecundario}
              onClick={() => cambiarPermitir(g.token, !g.puede_volver_a_ganar)}
              disabled={Boolean(ocupado)}
            >
              {ocupado === `g:${g.token}`
                ? "Guardando..."
                : g.puede_volver_a_ganar
                  ? "Impedir que vuelva a ganar"
                  : "Dejar que vuelva a ganar"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const contenedor = { display: "grid", gap: 12, border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, background: "#fff", marginBottom: 20 };
const titulo = { margin: 0, fontSize: 17, color: "#111827" };
const texto = { margin: 0, color: "#6b7280", fontSize: 13 };
const campo = { display: "grid", gap: 6, fontSize: 14, color: "#374151", fontWeight: 600 };
const input = { padding: "9px 11px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 14, maxWidth: 420 };
const fila = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "10px 12px", borderRadius: 10, background: "#f9fafb", border: "1px solid #e5e7eb" };
const filaNegra = { ...fila, background: "#fef2f2", border: "1px solid #fecaca" };
const filaGanador = { ...fila, background: "#fffbeb", border: "1px solid #fde68a" };
const botonSecundario = { border: "1px solid #d1d5db", borderRadius: 9, padding: "8px 14px", background: "#fff", color: "#111827", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const botonPeligro = { border: "1px solid #fecaca", borderRadius: 9, padding: "8px 14px", background: "#fef2f2", color: "#991b1b", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const badgeNegra = { marginLeft: 8, padding: "2px 8px", borderRadius: 999, background: "#991b1b", color: "#fff", fontSize: 11, fontWeight: 800 };
const avisoError = { padding: "9px 12px", borderRadius: 9, background: "#fef2f2", color: "#991b1b", fontSize: 13, fontWeight: 700 };
