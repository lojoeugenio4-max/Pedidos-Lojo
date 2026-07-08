import { useMemo, useState } from "react";

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function obtenerDepartamentoId(articulo) {
  return articulo.departamento_id ?? articulo.departamentos?.id ?? "";
}

function obtenerDepartamentoNombre(articulo) {
  return articulo.departamento_nombre || articulo.departamentos?.nombre || "";
}

export default function RuletaFormulario({
  formulario,
  articulosPremio,
  cambiarCampo,
  guardarPremio,
  guardando,
  error,
  mensaje,
  idEditando,
  cancelarEdicion,
}) {
  const [busquedaArticulo, setBusquedaArticulo] = useState("");
  const [departamentoFiltro, setDepartamentoFiltro] = useState("TODOS");

  const departamentos = useMemo(() => {
    const mapa = new Map();

    articulosPremio.forEach((articulo) => {
      const id = obtenerDepartamentoId(articulo);
      const nombre = obtenerDepartamentoNombre(articulo);

      if (id && nombre && !mapa.has(String(id))) {
        mapa.set(String(id), {
          id: String(id),
          nombre,
        });
      }
    });

    return Array.from(mapa.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
    );
  }, [articulosPremio]);

  const articuloSeleccionado = useMemo(
    () =>
      articulosPremio.find(
        (articulo) => String(articulo.id) === String(formulario.articulo_id)
      ),
    [articulosPremio, formulario.articulo_id]
  );

  const articulosFiltrados = useMemo(() => {
    const texto = normalizar(busquedaArticulo);
    const palabras = texto.split(/\s+/).filter(Boolean);

    return articulosPremio
      .filter((articulo) => {
        const departamentoId = obtenerDepartamentoId(articulo);
        const departamentoNombre = obtenerDepartamentoNombre(articulo);

        const coincideDepartamento =
          departamentoFiltro === "TODOS" ||
          String(departamentoId) === String(departamentoFiltro);

        const searchable = normalizar(
          `${articulo.codigo || ""} ${articulo.nombre || ""} ${departamentoNombre}`
        );

        const coincideBusqueda =
          palabras.length === 0 ||
          palabras.every((palabra) => searchable.includes(palabra));

        return coincideDepartamento && coincideBusqueda;
      })
      .slice(0, 120);
  }, [articulosPremio, busquedaArticulo, departamentoFiltro]);

  function seleccionarArticulo(articulo) {
    cambiarCampo("articulo_id", String(articulo.id));
    setBusquedaArticulo("");
  }

  function limpiarSeleccion() {
    cambiarCampo("articulo_id", "");
  }

  return (
    <form style={formularioStyle} onSubmit={guardarPremio}>
      <h4 style={bloqueTitulo}>
        {idEditando ? "✏️ Editar premio" : "➕ Nuevo premio"}
      </h4>

      <div style={buscadorBox}>
        <div style={filtrosPremio}>
          <label style={label}>
            Departamento
            <select
              style={input}
              value={departamentoFiltro}
              onChange={(e) => setDepartamentoFiltro(e.target.value)}
            >
              <option value="TODOS">Todos los departamentos</option>

              {departamentos.map((departamento) => (
                <option key={departamento.id} value={departamento.id}>
                  {departamento.nombre}
                </option>
              ))}
            </select>
          </label>

          <label style={labelGrande}>
            Buscar artículo que se entrega como premio
            <input
              style={inputBusqueda}
              type="text"
              value={busquedaArticulo}
              onChange={(e) => setBusquedaArticulo(e.target.value)}
              placeholder="Buscar por código, nombre o departamento..."
              autoComplete="off"
            />
          </label>
        </div>

        {articuloSeleccionado && (
          <div style={seleccionActual}>
            <div style={seleccionImagenBox}>
              {articuloSeleccionado.foto_url ? (
                <img
                  src={articuloSeleccionado.foto_url}
                  alt=""
                  style={seleccionImagen}
                />
              ) : (
                <span style={sinFoto}>Sin foto</span>
              )}
            </div>

            <div style={seleccionTexto}>
              <span style={seleccionLabel}>Artículo seleccionado</span>
              <strong>
                {articuloSeleccionado.codigo
                  ? `${articuloSeleccionado.codigo} · `
                  : ""}
                {articuloSeleccionado.nombre}
              </strong>
              {obtenerDepartamentoNombre(articuloSeleccionado) && (
                <small>{obtenerDepartamentoNombre(articuloSeleccionado)}</small>
              )}
            </div>

            <button type="button" style={quitarArticulo} onClick={limpiarSeleccion}>
              Quitar
            </button>
          </div>
        )}

        <div style={resultadosResumen}>
          Mostrando <strong>{articulosFiltrados.length}</strong> artículos
        </div>

        <div style={resultadosBox}>
          {articulosFiltrados.length === 0 ? (
            <div style={sinResultados}>No hay artículos con esa búsqueda.</div>
          ) : (
            articulosFiltrados.map((articulo) => {
              const seleccionado =
                String(articulo.id) === String(formulario.articulo_id);
              const departamentoNombre = obtenerDepartamentoNombre(articulo);

              return (
                <button
                  key={articulo.id}
                  type="button"
                  onClick={() => seleccionarArticulo(articulo)}
                  style={{
                    ...resultadoArticulo,
                    ...(seleccionado ? resultadoArticuloActivo : {}),
                  }}
                >
                  <div style={resultadoImagenBox}>
                    {articulo.foto_url ? (
                      <img src={articulo.foto_url} alt="" style={resultadoImagen} />
                    ) : (
                      <span style={sinFotoMini}>Sin foto</span>
                    )}
                  </div>

                  <div style={resultadoTexto}>
                    <strong>
                      {articulo.codigo ? `${articulo.codigo} · ` : ""}
                      {articulo.nombre}
                    </strong>

                    {departamentoNombre && <small>{departamentoNombre}</small>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div style={gridFormulario}>
        <label style={label}>
          Nombre que verá el cliente
          <input
            style={input}
            type="text"
            value={formulario.nombre}
            onChange={(e) => cambiarCampo("nombre", e.target.value)}
            placeholder="Ej: Coca-Cola 2L"
          />
        </label>

        <label style={label}>
          Celebración
          <select
            style={input}
            value={formulario.tipo_sonido || "campana"}
            onChange={(e) => cambiarCampo("tipo_sonido", e.target.value)}
          >
            <option value="campana">Campana</option>
            <option value="sirena">Sirena</option>
            <option value="jackpot">Jackpot</option>
          </select>
        </label>

        <label style={label}>
          Color
          <input
            style={inputColor}
            type="color"
            value={formulario.color}
            onChange={(e) => cambiarCampo("color", e.target.value)}
          />
        </label>

        <label style={label}>
          Probabilidad
          <input
            style={input}
            type="number"
            min="0"
            step="0.01"
            value={formulario.probabilidad}
            onChange={(e) => cambiarCampo("probabilidad", e.target.value)}
            placeholder="Ej: 25"
          />
        </label>

        <label style={label}>
          Stock
          <input
            style={input}
            type="number"
            min="0"
            step="1"
            value={formulario.stock}
            onChange={(e) => cambiarCampo("stock", e.target.value)}
            placeholder="Vacío = ilimitado"
          />
        </label>

        <label style={label}>
          Orden
          <input
            style={input}
            type="number"
            min="0"
            step="1"
            value={formulario.orden}
            onChange={(e) => cambiarCampo("orden", e.target.value)}
            placeholder="Auto"
          />
        </label>

        <label style={checkLabel}>
          <input
            type="checkbox"
            checked={formulario.activo}
            onChange={(e) => cambiarCampo("activo", e.target.checked)}
          />
          Activo
        </label>
      </div>

      {error && <div style={errorStyle}>{error}</div>}
      {mensaje && <div style={okStyle}>{mensaje}</div>}

      <div style={botones}>
        <button type="submit" style={botonPrincipal} disabled={guardando}>
          {guardando
            ? "Guardando..."
            : idEditando
              ? "Actualizar premio"
              : "Guardar premio"}
        </button>

        {idEditando && (
          <button
            type="button"
            style={botonSecundario}
            onClick={cancelarEdicion}
            disabled={guardando}
          >
            Cancelar edición
          </button>
        )}
      </div>
    </form>
  );
}

const formularioStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  padding: "16px",
  background: "#f9fafb",
  marginBottom: "16px",
};

const bloqueTitulo = {
  margin: "0 0 14px",
  fontSize: "17px",
  color: "#111827",
};

const buscadorBox = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  padding: "14px",
  marginBottom: "14px",
};

const filtrosPremio = {
  display: "grid",
  gridTemplateColumns: "minmax(190px, 260px) minmax(240px, 1fr)",
  gap: "12px",
  marginBottom: "12px",
};

const gridFormulario = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
  marginBottom: "14px",
};

const label = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "13px",
  fontWeight: "700",
  color: "#374151",
};

const labelGrande = {
  ...label,
};

const input = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "10px",
  fontSize: "14px",
  background: "#ffffff",
};

const inputBusqueda = {
  ...input,
  fontSize: "16px",
  padding: "13px 14px",
  border: "2px solid #2563eb",
};

const inputColor = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  height: "39px",
  padding: "4px",
  background: "#ffffff",
};

const resultadosResumen = {
  margin: "0 0 10px",
  color: "#6b7280",
  fontSize: "13px",
};

const resultadosBox = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: "10px",
  maxHeight: "360px",
  overflowY: "auto",
  paddingRight: "4px",
};

const resultadoArticulo = {
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  borderRadius: "12px",
  padding: "9px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  textAlign: "left",
  cursor: "pointer",
};

const resultadoArticuloActivo = {
  borderColor: "#2563eb",
  background: "#eff6ff",
  boxShadow: "0 0 0 2px rgba(37,99,235,.12)",
};

const resultadoImagenBox = {
  width: "54px",
  height: "54px",
  borderRadius: "10px",
  background: "#f3f4f6",
  border: "1px solid #e5e7eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  overflow: "hidden",
};

const resultadoImagen = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
};

const resultadoTexto = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  color: "#111827",
  fontSize: "13px",
  minWidth: 0,
};

const sinFotoMini = {
  color: "#6b7280",
  fontSize: "10px",
  fontWeight: "800",
};

const seleccionActual = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  border: "2px solid #22c55e",
  background: "#f0fdf4",
  borderRadius: "14px",
  padding: "10px",
  marginBottom: "12px",
};

const seleccionImagenBox = {
  width: "70px",
  height: "70px",
  borderRadius: "12px",
  background: "#ffffff",
  border: "1px solid #bbf7d0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  flexShrink: 0,
};

const seleccionImagen = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
};

const seleccionTexto = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  color: "#111827",
  flex: 1,
};

const seleccionLabel = {
  color: "#15803d",
  fontSize: "12px",
  fontWeight: "900",
};

const sinFoto = {
  color: "#6b7280",
  fontSize: "11px",
  fontWeight: "800",
};

const quitarArticulo = {
  border: "none",
  borderRadius: "10px",
  padding: "9px 12px",
  background: "#dc2626",
  color: "#ffffff",
  fontWeight: "800",
  cursor: "pointer",
};

const sinResultados = {
  padding: "16px",
  borderRadius: "12px",
  background: "#f3f4f6",
  color: "#6b7280",
  fontWeight: "700",
  gridColumn: "1 / -1",
};

const checkLabel = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "13px",
  fontWeight: "700",
  color: "#374151",
  paddingTop: "24px",
};

const botones = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const botonPrincipal = {
  border: "none",
  background: "#111827",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "10px 14px",
  fontSize: "14px",
  cursor: "pointer",
};

const botonSecundario = {
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#374151",
  borderRadius: "10px",
  padding: "10px 14px",
  fontSize: "14px",
  cursor: "pointer",
};

const errorStyle = {
  marginBottom: "10px",
  color: "#b91c1c",
  fontSize: "14px",
  fontWeight: "700",
};

const okStyle = {
  marginBottom: "10px",
  color: "#15803d",
  fontSize: "14px",
  fontWeight: "700",
};
