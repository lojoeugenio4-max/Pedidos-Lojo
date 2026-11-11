import { useState } from "react";

export default function FormArticulo({
  form,
  departamentos,
  ubicaciones = [],
  ubicacionesDisponibles = true,
  eansDisponibles = false,
  preview,
  // URL de la foto que ya tiene el artículo (al editar).
  fotoActual = "",
  onChange,
  onFotoChange,
  onGuardar,
  onCancelar,
  guardando = false,
}) {
  const eans = Array.isArray(form.eans) ? form.eans : [];
  const [eanSeleccionado, setEanSeleccionado] = useState("");
  const [eanNuevo, setEanNuevo] = useState("");
  const [errorEan, setErrorEan] = useState("");
  const eanActivo = eans.includes(eanSeleccionado) ? eanSeleccionado : eans[0] || "";

  function anadirEan() {
    const limpio = eanNuevo.replace(/\s/g, "");
    if (!limpio) {
      setErrorEan("Escribe el código de barras.");
      return;
    }
    if (eans.includes(limpio)) {
      setErrorEan("Este EAN ya está en el artículo.");
      return;
    }
    onChange("eans", [...eans, limpio]);
    setEanSeleccionado(limpio);
    setEanNuevo("");
    setErrorEan("");
  }

  function quitarEan() {
    if (!eanActivo) return;
    onChange("eans", eans.filter((e) => e !== eanActivo));
    setEanSeleccionado("");
  }

  const fotoVista = preview || fotoActual || "";
  const etiquetaDepartamento = (d) =>
    d.cod !== null && d.cod !== undefined && String(d.cod).trim() !== "" ? `${d.cod} — ${d.nombre}` : d.nombre;

  return (
    <div style={formContainer}>
      <div style={zonaScroll}>
        {/* 1. Datos principales */}
        <section style={sectionCard}>
          <h3 style={sectionTitle}>📋 Datos del artículo</h3>

          <label style={field}>
            <span style={label}>Nombre</span>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => onChange("nombre", e.target.value)}
              style={{ ...input, fontSize: "17px", fontWeight: 800 }}
              placeholder="Nombre del artículo"
            />
          </label>

          <div style={gridThree}>
            <label style={field}>
              <span style={label}>Código Lojo *</span>
              <input
                type="text"
                value={form.codigo_lojo}
                onChange={(e) => onChange("codigo_lojo", e.target.value)}
                placeholder="Obligatorio"
                required
                style={input}
              />
            </label>

            <label style={field}>
              <span style={label}>Precio (€)</span>
              <input
                type="number"
                step="0.01"
                value={form.precio}
                onChange={(e) => onChange("precio", e.target.value)}
                style={input}
                placeholder="Sin precio"
              />
            </label>

            <label style={field}>
              <span style={label}>Código (app)</span>
              <input
                type="number"
                value={form.codigo}
                onChange={(e) => onChange("codigo", e.target.value)}
                style={input}
              />
            </label>
          </div>

          <div style={gridTwo}>
            <label style={field}>
              <span style={label}>Departamento{form.oculto ? " (no hace falta si está oculto)" : ""}</span>
              <select
                value={form.departamento_id}
                onChange={(e) => onChange("departamento_id", e.target.value)}
                style={input}
                disabled={form.oculto}
              >
                <option value="">Seleccionar departamento</option>
                {departamentos.map((departamento) => (
                  <option key={departamento.id} value={departamento.id}>
                    {etiquetaDepartamento(departamento)}
                  </option>
                ))}
              </select>
            </label>

            <label style={field}>
              <span style={label}>Ubicación</span>
              <select
                value={form.ubicacion_id}
                onChange={(e) => onChange("ubicacion_id", e.target.value)}
                style={input}
                disabled={!ubicacionesDisponibles}
              >
                <option value="">{ubicacionesDisponibles ? "Sin ubicación" : "Ubicaciones no disponibles"}</option>
                {ubicaciones.map((ubicacion) => (
                  <option key={ubicacion.id} value={ubicacion.id}>
                    {ubicacion.codigo} — {ubicacion.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* 2. Estado */}
        <section style={sectionCard}>
          <h3 style={sectionTitle}>⚙️ Estado</h3>
          <div style={checksBox}>
            <Interruptor
              texto="Activo"
              ayuda="Se puede pedir"
              marcado={form.activo}
              onChange={(v) => onChange("activo", v)}
            />
            <Interruptor
              texto="Oculto"
              ayuda="No sale en el catálogo"
              marcado={form.oculto}
              onChange={(v) => onChange("oculto", v)}
            />
            <Interruptor
              texto="Novedad"
              ayuda="Sale como novedad"
              marcado={form.novedad}
              onChange={(v) => onChange("novedad", v)}
            />
            <Interruptor
              texto="Permite unidades"
              ayuda="Se puede pedir suelto"
              marcado={form.permite_unidades}
              onChange={(v) => onChange("permite_unidades", v)}
            />
          </div>
        </section>

        {/* 3. Foto */}
        <section style={sectionCard}>
          <h3 style={sectionTitle}>🖼️ Foto</h3>
          <div style={filaFoto}>
            <div style={marcoFoto}>
              {fotoVista ? (
                <img src={fotoVista} alt="Foto del artículo" style={previewImage} />
              ) : (
                <span style={{ fontSize: "30px", opacity: 0.5 }}>📷</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
              <span style={textoFoto}>
                {preview
                  ? "Foto nueva elegida. Se guardará al pulsar Guardar."
                  : fotoActual
                    ? "Foto actual del artículo."
                    : "Este artículo no tiene foto."}
              </span>
              <label style={fileButton}>
                {fotoVista ? "Cambiar foto" : "Elegir foto"}
                <input type="file" accept="image/*" onChange={onFotoChange} style={hiddenFile} />
              </label>
              <span style={ayudaFoto}>JPG, PNG o WebP. Mejor cuadrada.</span>
            </div>
          </div>
        </section>

        {/* 4. Códigos de barras */}
        <section style={sectionCard}>
          <h3 style={sectionTitle}>▥ Códigos de barras (EAN)</h3>

          {!eansDisponibles ? (
            <div style={helpBox}>
              ℹ️ Para usar los códigos de barras, ejecuta antes supabase/migracion_eans.sql en Supabase.
            </div>
          ) : (
            <div style={gridTwo}>
              <label style={field}>
                <span style={label}>
                  {eans.length === 0
                    ? "Sin códigos EAN"
                    : `${eans.length} ${eans.length === 1 ? "código EAN" : "códigos EAN"}`}
                </span>
                <div style={filaEan}>
                  <select
                    value={eanActivo}
                    onChange={(e) => setEanSeleccionado(e.target.value)}
                    style={{ ...input, flex: 1, minWidth: 0 }}
                    disabled={eans.length === 0}
                  >
                    {eans.length === 0 && <option value="">— Ninguno —</option>}
                    {eans.map((ean) => (
                      <option key={ean} value={ean}>
                        {ean}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={quitarEan}
                    style={botonQuitarEan}
                    disabled={!eanActivo}
                    title="Quitar el EAN seleccionado"
                  >
                    🗑
                  </button>
                </div>
              </label>

              <label style={field}>
                <span style={label}>Añadir EAN</span>
                <div style={filaEan}>
                  <input
                    type="text"
                    value={eanNuevo}
                    onChange={(e) => {
                      setEanNuevo(e.target.value);
                      setErrorEan("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        anadirEan();
                      }
                    }}
                    placeholder="Código de barras"
                    maxLength={60}
                    style={{ ...input, flex: 1, minWidth: 0 }}
                  />
                  <button type="button" onClick={anadirEan} style={botonAnadirEan}>
                    ＋
                  </button>
                </div>
                {errorEan && <span style={textoErrorEan}>{errorEan}</span>}
              </label>
            </div>
          )}
        </section>

        {/* 5. Oferta */}
        <section style={sectionCard}>
          <h3 style={sectionTitle}>🏷️ Oferta <span style={opcional}>(opcional)</span></h3>
          <label style={field}>
            <span style={label}>Texto de la oferta</span>
            <input
              type="text"
              value={form.oferta_texto}
              onChange={(e) => onChange("oferta_texto", e.target.value)}
              placeholder="Ej: Comprando 10 cajas REGALO 1 caja"
              style={input}
            />
          </label>
          <div style={gridTwo}>
            <label style={field}>
              <span style={label}>Desde</span>
              <input
                type="date"
                value={form.oferta_fecha_inicio}
                onChange={(e) => onChange("oferta_fecha_inicio", e.target.value)}
                style={input}
              />
            </label>
            <label style={field}>
              <span style={label}>Hasta</span>
              <input
                type="date"
                value={form.oferta_fecha_fin}
                onChange={(e) => onChange("oferta_fecha_fin", e.target.value)}
                style={input}
              />
            </label>
          </div>
        </section>
      </div>

      {/* Botones siempre visibles abajo */}
      <div style={actionsBar}>
        <button type="button" onClick={onCancelar} style={cancelButton}>
          Cancelar
        </button>
        <button type="button" onClick={onGuardar} style={saveButton} disabled={guardando}>
          💾 {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}

function Interruptor({ texto, ayuda, marcado, onChange }) {
  return (
    <label style={interruptor(marcado)}>
      <input type="checkbox" checked={marcado} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18 }} />
      <span>
        <span style={{ display: "block", fontWeight: 900 }}>{texto}</span>
        <span style={{ display: "block", fontSize: "12px", fontWeight: 700, opacity: 0.75 }}>{ayuda}</span>
      </span>
    </label>
  );
}

const formContainer = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
};

const zonaScroll = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  padding: "16px 20px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const sectionCard = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const sectionTitle = { margin: 0, fontSize: "16px", fontWeight: 950, color: "#0f172a" };
const opcional = { fontSize: "13px", fontWeight: 700, color: "#94a3b8" };

const gridTwo = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" };
const gridThree = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" };

const field = { display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 };
const label = { fontSize: "13px", fontWeight: 900, color: "#475569" };

const input = {
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "11px 12px",
  fontSize: "15px",
  fontWeight: 600,
  background: "#fff",
  color: "#0f172a",
  boxSizing: "border-box",
  width: "100%",
};

const checksBox = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px" };

const interruptor = (marcado) => ({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  border: marcado ? "2px solid #4f46e5" : "1px solid #e2e8f0",
  background: marcado ? "#eef2ff" : "#f8fafc",
  color: marcado ? "#312e81" : "#334155",
  borderRadius: "12px",
  padding: "10px 12px",
  cursor: "pointer",
  fontSize: "14px",
});

const filaFoto = { display: "flex", gap: "14px", alignItems: "center" };

const marcoFoto = {
  width: "110px",
  height: "110px",
  flex: "0 0 auto",
  borderRadius: "14px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const previewImage = { width: "100%", height: "100%", objectFit: "contain" };
const textoFoto = { fontSize: "14px", fontWeight: 800, color: "#334155" };
const ayudaFoto = { fontSize: "12px", fontWeight: 700, color: "#94a3b8" };

const fileButton = {
  alignSelf: "flex-start",
  background: "#4f46e5",
  color: "#fff",
  borderRadius: "12px",
  padding: "10px 16px",
  fontSize: "14px",
  fontWeight: 900,
  cursor: "pointer",
};

const hiddenFile = { display: "none" };

const helpBox = {
  background: "#f5f3ff",
  color: "#5b21b6",
  borderRadius: "12px",
  padding: "10px 12px",
  fontSize: "13px",
  fontWeight: 700,
};

const actionsBar = {
  flex: "0 0 auto",
  display: "flex",
  gap: "10px",
  justifyContent: "flex-end",
  padding: "12px 20px calc(12px + env(safe-area-inset-bottom))",
  background: "#fff",
  borderTop: "1px solid #e2e8f0",
};

const saveButton = {
  border: "none",
  borderRadius: "14px",
  padding: "14px 28px",
  background: "#16a34a",
  color: "#fff",
  fontSize: "16px",
  fontWeight: 950,
  cursor: "pointer",
};

const cancelButton = {
  border: "1px solid #cbd5e1",
  borderRadius: "14px",
  padding: "14px 20px",
  background: "#fff",
  color: "#334155",
  fontSize: "15px",
  fontWeight: 850,
  cursor: "pointer",
};

const filaEan = { display: "flex", gap: "8px", alignItems: "stretch" };

const botonAnadirEan = {
  border: "none",
  borderRadius: "12px",
  padding: "0 16px",
  background: "#4f46e5",
  color: "#ffffff",
  fontSize: "18px",
  fontWeight: "950",
  cursor: "pointer",
};

const botonQuitarEan = {
  border: "1px solid #fecaca",
  borderRadius: "12px",
  padding: "0 14px",
  background: "#fef2f2",
  color: "#b91c1c",
  fontSize: "16px",
  cursor: "pointer",
};

const textoErrorEan = { color: "#b91c1c", fontSize: "13px", fontWeight: "800" };
