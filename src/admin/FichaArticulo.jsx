export default function FichaArticulo() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <h1>📦 Ficha de Artículo</h1>

      <label>Código</label>
      <input type="text" placeholder="Ej: 123" style={inputStyle} />

      <label>Nombre</label>
      <input type="text" placeholder="Nombre del artículo" style={inputStyle} />

      <label>Departamento</label>
      <select style={inputStyle}>
        <option>Seleccionar departamento...</option>
      </select>

      <label>Precio</label>
      <input type="number" placeholder="Opcional" style={inputStyle} />

      <label>
        <input type="checkbox" defaultChecked /> Se puede pedir por unidades
      </label>

      <br /><br />

      <label>
        <input type="checkbox" defaultChecked /> Activo
      </label>

      <br /><br />

      <label>
        <input type="checkbox" /> Novedad
      </label>

      <br /><br />

      <label>Fecha inicio novedad</label>
      <input type="date" style={inputStyle} />

      <label>Fecha fin novedad</label>
      <input type="date" style={inputStyle} />

      <label>Foto</label>
      <input type="text" placeholder="Ej: 123.webp" style={inputStyle} />

      <button>Cambiar foto</button>

      <div style={previewBox}>
        Vista previa de la foto
      </div>

      <button>Vista previa</button>
      <button style={{ marginLeft: "10px" }}>Guardar</button>
      <button style={{ marginLeft: "10px" }}>Cancelar</button>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px",
  marginBottom: "12px",
  fontSize: "16px",
};

const previewBox = {
  width: "220px",
  height: "220px",
  marginTop: "20px",
  marginBottom: "20px",
  border: "1px solid #ccc",
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#777",
};
