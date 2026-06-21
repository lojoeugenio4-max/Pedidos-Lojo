export default function FormArticulo({
  form,
  departamentos,
  preview,
  onChange,
  onFotoChange,
  onGuardar,
  onCancelar,
}) {
  return (
    <div style={formBox}>
      <h2>Ficha de artículo</h2>

      <label>Código</label>
      <input
        type="number"
        value={form.codigo}
        onChange={(e) => onChange("codigo", e.target.value)}
        style={inputStyle}
      />

      <label>Nombre</label>
      <input
        type="text"
        value={form.nombre}
        onChange={(e) => onChange("nombre", e.target.value)}
        style={inputStyle}
      />

      <label>Departamento</label>
      <select
        value={form.departamento_id}
        onChange={(e) => onChange("departamento_id", e.target.value)}
        style={inputStyle}
      >
        <option value="">Seleccionar departamento...</option>
        {departamentos.map((dep) => (
          <option key={dep.id} value={dep.id}>
            {dep.nombre}
          </option>
        ))}
      </select>

      <label>Precio</label>
      <input
        type="number"
        value={form.precio}
        onChange={(e) => onChange("precio", e.target.value)}
        placeholder="Opcional"
        style={inputStyle}
      />

      <label>
        <input
          type="checkbox"
          checked={!!form.permite_unidades}
          onChange={(e) => onChange("permite_unidades", e.target.checked)}
        />{" "}
        Se puede pedir por unidades
      </label>

      <br /><br />

      <label>
        <input
          type="checkbox"
          checked={!!form.activo}
          onChange={(e) => onChange("activo", e.target.checked)}
        />{" "}
        Activo
      </label>

      <br /><br />

      <label>
        <input
          type="checkbox"
          checked={!!form.novedad}
          onChange={(e) => onChange("novedad", e.target.checked)}
        />{" "}
        Novedad
      </label>

      <br /><br />

      <label>
        <input
          type="checkbox"
          checked={!!form.oculto}
          onChange={(e) => onChange("oculto", e.target.checked)}
        />{" "}
        Oculto
      </label>

      <hr style={separator} />

      <h3>🏷️ Oferta del artículo</h3>

      <label>Texto de oferta</label>
      <textarea
        value={form.oferta_texto}
        onChange={(e) => onChange("oferta_texto", e.target.value)}
        placeholder="Ej: Comprando 10 cajas REGALO 1 caja"
        style={textareaStyle}
      />

      <label>Fecha inicio oferta</label>
      <input
        type="date"
        value={form.oferta_fecha_inicio}
        onChange={(e) => onChange("oferta_fecha_inicio", e.target.value)}
        style={inputStyle}
      />

      <label>Fecha fin oferta</label>
      <input
        type="date"
        value={form.oferta_fecha_fin}
        onChange={(e) => onChange("oferta_fecha_fin", e.target.value)}
        style={inputStyle}
      />

      <button
        type="button"
        onClick={() => {
          onChange("oferta_texto", "");
          onChange("oferta_fecha_inicio", "");
          onChange("oferta_fecha_fin", "");
        }}
        style={deleteOfferButton}
      >
        🗑️ Quitar oferta
      </button>

      <hr style={separator} />

      <label>Foto</label>
      <input type="file" accept="image/*" onChange={onFotoChange} />

      {preview && (
        <div style={{ marginTop: "15px" }}>
          <img src={preview} alt="Vista previa" style={previewImage} />
        </div>
      )}

      <br />

      <button onClick={onGuardar} style={saveButton}>Guardar</button>

      <button onClick={onCancelar} style={cancelButton}>
        Cancelar
      </button>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px",
  marginBottom: "12px",
  fontSize: "16px",
};

const textareaStyle = {
  width: "100%",
  padding: "10px",
  marginBottom: "12px",
  fontSize: "16px",
  minHeight: "80px",
};

const formBox = {
  padding: "20px",
  border: "1px solid #ddd",
  borderRadius: "10px",
  marginBottom: "25px",
  background: "#fafafa",
};

const previewImage = {
  width: "180px",
  height: "180px",
  objectFit: "contain",
  border: "1px solid #ddd",
  borderRadius: "8px",
  background: "#fff",
};

const separator = {
  margin: "22px 0",
  border: "none",
  borderTop: "1px solid #ddd",
};

const saveButton = {
  background: "#22c55e",
  color: "white",
  border: "none",
  padding: "10px 16px",
  borderRadius: "8px",
  fontWeight: "bold",
  cursor: "pointer",
};

const cancelButton = {
  marginLeft: "10px",
  background: "#e5e7eb",
  color: "#111827",
  border: "none",
  padding: "10px 16px",
  borderRadius: "8px",
  fontWeight: "bold",
  cursor: "pointer",
};

const deleteOfferButton = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  padding: "9px 14px",
  borderRadius: "8px",
  fontWeight: "bold",
  cursor: "pointer",
};
