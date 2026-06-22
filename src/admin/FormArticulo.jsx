export default function FormArticulo({
  form,
  departamentos,
  preview,
  onChange,
  onFotoChange,
  onGuardar,
  onCancelar,
  guardando = false,
}) {
  return (
    <div style={formContainer}>
      <section style={sectionCard}>
        <div style={sectionHeader}>
          <div style={sectionIcon}>🖼️</div>

          <div>
            <h3 style={sectionTitle}>Imagen del artículo</h3>
            <p style={sectionSubtitle}>
              Sube o cambia la foto del artículo. Formatos recomendados: JPG, PNG o WebP.
            </p>
          </div>
        </div>

        <div style={photoGrid}>
          <div style={previewCard}>
            {preview ? (
              <img src={preview} alt="Vista previa" style={previewImage} />
            ) : (
              <div style={emptyPreview}>
                <div style={emptyPreviewIcon}>📷</div>
                <div style={emptyPreviewTitle}>Sin imagen nueva</div>
                <div style={emptyPreviewText}>
                  Al seleccionar una foto aparecerá aquí.
                </div>
              </div>
            )}

            <div style={previewBadge}>Vista previa</div>
          </div>

          <div style={uploadPanel}>
            <div style={uploadBox}>
              <div style={uploadIcon}>☁️</div>
              <div style={uploadTitle}>Selecciona una imagen</div>
              <div style={uploadText}>JPG, PNG o WebP</div>

              <label style={fileButton}>
                Elegir foto
                <input
                  type="file"
                  accept="image/*"
                  onChange={onFotoChange}
                  style={hiddenFile}
                />
              </label>
            </div>

            <div style={helpBox}>
              ℹ️ Se recomienda usar imágenes cuadradas para mejor visualización.
            </div>
          </div>
        </div>
      </section>

      <section style={sectionCard}>
        <div style={sectionHeader}>
          <div style={sectionIcon}>📋</div>

          <div>
            <h3 style={sectionTitle}>Información del artículo</h3>
            <p style={sectionSubtitle}>
              Datos principales del producto dentro del catálogo.
            </p>
          </div>
        </div>

        <div style={gridTwo}>
          <label style={field}>
            <span style={label}>Código</span>
            <input
              type="number"
              value={form.codigo}
              onChange={(e) => onChange("codigo", e.target.value)}
              style={input}
            />
          </label>

          <label style={field}>
            <span style={label}>Nombre</span>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => onChange("nombre", e.target.value)}
              style={input}
            />
          </label>
        </div>

        <div style={gridThree}>
          <label style={field}>
            <span style={label}>Departamento</span>
            <select
              value={form.departamento_id}
              onChange={(e) => onChange("departamento_id", e.target.value)}
              style={input}
              disabled={form.oculto}
            >
              <option value="">Seleccionar departamento</option>
              {departamentos.map((departamento) => (
                <option key={departamento.id} value={departamento.id}>
                  {departamento.nombre}
                </option>
              ))}
            </select>
          </label>

          <label style={field}>
            <span style={label}>Precio (€)</span>
            <input
              type="number"
              step="0.01"
              value={form.precio}
              onChange={(e) => onChange("precio", e.target.value)}
              style={input}
            />
          </label>

          <div style={checksBox}>
            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={form.permite_unidades}
                onChange={(e) => onChange("permite_unidades", e.target.checked)}
              />
              Permite unidades
            </label>

            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => onChange("activo", e.target.checked)}
              />
              Activo
            </label>

            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={form.novedad}
                onChange={(e) => onChange("novedad", e.target.checked)}
              />
              Novedad
            </label>

            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={form.oculto}
                onChange={(e) => onChange("oculto", e.target.checked)}
              />
              Oculto
            </label>
          </div>
        </div>
      </section>

      <section style={sectionCard}>
        <div style={sectionHeader}>
          <div style={sectionIcon}>🏷️</div>

          <div>
            <h3 style={sectionTitle}>Oferta del artículo</h3>
            <p style={sectionSubtitle}>
              Opcional. Puedes dejar estos campos vacíos si el producto no tiene oferta.
            </p>
          </div>
        </div>

        <label style={field}>
          <span style={label}>Texto de oferta</span>
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
            <span style={label}>Fecha inicio</span>
            <input
              type="date"
              value={form.oferta_fecha_inicio}
              onChange={(e) => onChange("oferta_fecha_inicio", e.target.value)}
              style={input}
            />
          </label>

          <label style={field}>
            <span style={label}>Fecha fin</span>
            <input
              type="date"
              value={form.oferta_fecha_fin}
              onChange={(e) => onChange("oferta_fecha_fin", e.target.value)}
              style={input}
            />
          </label>
        </div>
      </section>

      <div style={actionsBar}>
        <button type="button" onClick={onGuardar} style={saveButton} disabled={guardando}>
          💾 {guardando ? "Guardando..." : "Guardar"}
        </button>

        <button type="button" onClick={onCancelar} style={cancelButton}>
          ✕ Cancelar
        </button>
      </div>
    </div>
  );
}

const formContainer = {
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const sectionCard = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "22px",
  padding: "22px",
  boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
};

const sectionHeader = {
  display: "flex",
  alignItems: "center",
  gap: "13px",
  marginBottom: "18px",
};

const sectionIcon = {
  width: "42px",
  height: "42px",
  borderRadius: "13px",
  background: "#eef2ff",
  color: "#4f46e5",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "20px",
  flex: "0 0 auto",
};

const sectionTitle = {
  margin: 0,
  color: "#111827",
  fontSize: "20px",
  fontWeight: "950",
};

const sectionSubtitle = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "14px",
};

const photoGrid = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 360px) 1fr",
  gap: "26px",
  alignItems: "stretch",
};

const previewCard = {
  minHeight: "260px",
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "14px",
  boxSizing: "border-box",
};

const previewImage = {
  maxWidth: "100%",
  maxHeight: "210px",
  objectFit: "contain",
  borderRadius: "14px",
  background: "#ffffff",
};

const emptyPreview = {
  minHeight: "170px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  color: "#94a3b8",
  textAlign: "center",
};

const emptyPreviewIcon = {
  fontSize: "34px",
  marginBottom: "8px",
};

const emptyPreviewTitle = {
  fontWeight: "950",
  color: "#64748b",
};

const emptyPreviewText = {
  marginTop: "5px",
  fontSize: "13px",
};

const previewBadge = {
  background: "#eef2ff",
  color: "#4f46e5",
  borderRadius: "999px",
  padding: "9px 18px",
  fontSize: "13px",
  fontWeight: "950",
};

const uploadPanel = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "14px",
  minWidth: 0,
};

const uploadBox = {
  minHeight: "210px",
  border: "2px dashed #818cf8",
  borderRadius: "18px",
  background: "#fbfdff",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "24px",
  boxSizing: "border-box",
};

const uploadIcon = {
  fontSize: "38px",
  marginBottom: "10px",
};

const uploadTitle = {
  color: "#111827",
  fontSize: "18px",
  fontWeight: "950",
};

const uploadText = {
  marginTop: "6px",
  color: "#64748b",
  fontSize: "14px",
};

const fileButton = {
  marginTop: "16px",
  background: "#4f46e5",
  color: "#ffffff",
  borderRadius: "999px",
  padding: "12px 20px",
  fontSize: "14px",
  fontWeight: "950",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const hiddenFile = {
  display: "none",
};

const helpBox = {
  background: "#f5f3ff",
  color: "#6d5bd0",
  borderRadius: "14px",
  padding: "12px 14px",
  fontSize: "13px",
  fontWeight: "850",
};

const gridTwo = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "18px",
};

const gridThree = {
  display: "grid",
  gridTemplateColumns: "1.4fr 0.9fr 1fr",
  gap: "18px",
  alignItems: "end",
};

const field = {
  display: "flex",
  flexDirection: "column",
  gap: "7px",
  minWidth: 0,
};

const label = {
  color: "#334155",
  fontSize: "13px",
  fontWeight: "900",
};

const input = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "13px 14px",
  fontSize: "15px",
  color: "#111827",
  background: "#ffffff",
  outline: "none",
};

const checksBox = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "13px",
};

const checkLabel = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "#334155",
  fontSize: "13px",
  fontWeight: "850",
};

const actionsBar = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  paddingTop: "4px",
};

const saveButton = {
  border: "none",
  borderRadius: "14px",
  padding: "13px 22px",
  background: "#22c55e",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "950",
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(34,197,94,0.24)",
};

const cancelButton = {
  border: "none",
  borderRadius: "14px",
  padding: "13px 20px",
  background: "#e5e7eb",
  color: "#111827",
  fontSize: "15px",
  fontWeight: "950",
  cursor: "pointer",
};

