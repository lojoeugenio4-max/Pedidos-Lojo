import { supabaseStorage } from "../supabaseStorageClient";

// Estilos y utilidades compartidas por las pantallas de LojoPoly en el Admin.
// Mismo aspecto que Sorteo y Bingo.

export function urlFotoArticulo(foto) {
  if (!foto) return null;
  if (String(foto).startsWith("http")) return foto;
  return supabaseStorage.storage.from("productos").getPublicUrl(foto).data.publicUrl;
}

// Colores de grupo sugeridos (se puede elegir cualquier otro).
export const COLORES_GRUPO = ["#e3262e", "#f07d00", "#c9a000", "#1f9d55", "#14a3b8", "#1f5fd6", "#6d3fc0", "#8a1f4f", "#d6338a", "#5b4636"];

export const contenedor = { display: "grid", gap: 14, border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, background: "#fff", marginBottom: 20 };
export const tituloSeccion = { margin: 0, fontSize: 17, color: "#111827" };
export const texto = { margin: 0, color: "#6b7280", fontSize: 14 };
export const campo = { display: "grid", gap: 6, fontSize: 14, color: "#374151", fontWeight: 600, flex: 1, minWidth: 0 };
export const campoCheckbox = { display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#374151" };
export const input = { padding: "9px 11px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 14, width: "100%" };
export const fila = { display: "flex", flexWrap: "wrap", gap: 16 };
export const boton = { border: 0, borderRadius: 10, padding: "11px 18px", background: "#059669", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", justifySelf: "start" };
export const botonSecundario = { border: "1px solid #d1d5db", borderRadius: 9, padding: "7px 12px", background: "#fff", color: "#374151", fontWeight: 700, fontSize: 13, cursor: "pointer" };
export const botonPeligro = { ...botonSecundario, color: "#b91c1c", borderColor: "#fecaca" };
export const botonIcono = { ...botonSecundario, padding: "5px 9px", lineHeight: 1 };
export const avisoError = { padding: "9px 12px", borderRadius: 9, background: "#fef2f2", color: "#991b1b", fontSize: 13, fontWeight: 700 };
export const avisoOk = { padding: "9px 12px", borderRadius: 9, background: "#f0fdf4", color: "#166534", fontSize: 13, fontWeight: 700 };
export const avisoAtencion = { padding: "10px 12px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: 13, fontWeight: 700, lineHeight: 1.35 };
export const ayuda = { margin: 0, padding: "10px 12px", borderRadius: 10, background: "#f9fafb", border: "1px solid #e5e7eb", color: "#4b5563", fontSize: 13, lineHeight: 1.4 };
export const etiquetaDificil = { display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" };
