import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const promocionInicial = {
  nombre: "Promoción ruleta principal",
  activa: true,
  variedad_minima: 15,
  mensaje_cliente: "Tu pedido participa en la ruleta promocional.",
};

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export default function RuletaArticulos() {
  const [promocion, setPromocion] = useState(null);

  const [departamentos, setDepartamentos] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [articulosSeleccionados, setArticulosSeleccionados] = useState([]);

  const [departamentoFiltro, setDepartamentoFiltro] = useState("TODOS");
  const [busqueda, setBusqueda] = useState("");

  const [cargando, setCargando] = useState(true);
  const [guardandoId, setGuardandoId] = useState(null);
  const [guardandoLote, setGuardandoLote] = useState(false);
  const [actualizandoId, setActualizandoId] = useState(null);
  const [eliminandoId, setEliminandoId] = useState(null);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  async function obtenerOCrearPromocion() {
    const { data, error } = await supabase
      .from("promociones_ruleta")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (data) return data;

    const { data: nueva, error: crearError } = await supabase
      .from("promociones_ruleta")
      .insert(promocionInicial)
      .select("*")
      .single();

    if (crearError) throw crearError;

    return nueva;
  }

  async function cargarDatos() {
    setCargando(true);
    setError("");
    setMensaje("");

    try {
      const promocionData = await obtenerOCrearPromocion();
      setPromocion(promocionData);

      const { data: departamentosData, error: departamentosError } = await supabase
        .from("departamentos")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      if (departamentosError) throw departamentosError;

      const { data: articulosData, error: articulosError } = await supabase
        .from("articulos")
        .select(`
          id,
          codigo,
          nombre,
          activo,
          permite_unidades,
          departamento_id,
          departamentos (
            id,
            nombre
          )
        `)
        .eq("activo", true)
        .order("nombre", { ascending: true });

      if (articulosError) throw articulosError;

      const { data: seleccionadosData, error: seleccionadosError } = await supabase
        .from("promociones_ruleta_articulos")
        .select("*")
        .eq("promocion_id", promocionData.id)
        .order("nombre_articulo", { ascending: true });

      if (seleccionadosError) throw seleccionadosError;

      setDepartamentos(departamentosData || []);
      setArticulos(articulosData || []);
      setArticulosSeleccionados(seleccionadosData || []);
    } catch (err) {
      console.error("Error cargando artículos de ruleta:", err);
      setError(`No se han podido cargar los artículos: ${err.message || "Error desconocido"}`);
    }

    setCargando(false);
  }

  const codigosSeleccionados = useMemo(() => {
    return new Set(
      articulosSeleccionados.map((item) =>
        String(item.codigo_articulo || "").trim()
      )
    );
  }, [articulosSeleccionados]);

  const articulosFiltrados = useMemo(() => {
    const texto = normalizar(busqueda);
    const palabras = texto.split(/\s+/).filter(Boolean);

    return articulos.filter((articulo) => {
      const coincideDepartamento =
        departamentoFiltro === "TODOS" ||
        String(articulo.departamento_id) === String(departamentoFiltro);

      const searchable = normalizar(
        `${articulo.codigo || ""} ${articulo.nombre || ""} ${
          articulo.departamentos?.nombre || ""
        }`
      );

      const coincideBusqueda =
        palabras.length === 0 ||
        palabras.every((palabra) => searchable.includes(palabra));

      return coincideDepartamento && coincideBusqueda;
    });
  }, [articulos, busqueda, departamentoFiltro]);

  const articulosFiltradosNoSeleccionados = useMemo(() => {
    return articulosFiltrados.filter((articulo) => {
      const codigo = String(articulo.codigo || "").trim();
      return codigo && !codigosSeleccionados.has(codigo);
    });
  }, [articulosFiltrados, codigosSeleccionados]);

  async function agregarArticulo(articulo) {
    if (!promocion) return;

    const codigo = String(articulo.codigo || "").trim();

    if (!codigo) {
      setError("Este artículo no tiene código.");
      return;
    }

    if (codigosSeleccionados.has(codigo)) {
      setMensaje("Ese artículo ya está en la promoción.");
      return;
    }

    setError("");
    setMensaje("");
    setGuardandoId(articulo.id);

    const { data, error } = await supabase
      .from("promociones_ruleta_articulos")
      .insert({
        promocion_id: promocion.id,
        articulo_id: articulo.id,
        codigo_articulo: codigo,
        nombre_articulo: articulo.nombre || "",
        cantidad_minima: 1,
      })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      setError("No se ha podido añadir el artículo.");
    } else {
      setArticulosSeleccionados((actual) =>
        [...actual, data].sort((a, b) =>
          String(a.nombre_articulo || "").localeCompare(
            String(b.nombre_articulo || ""),
            "es",
            { sensitivity: "base" }
          )
        )
      );
      setMensaje("Artículo añadido correctamente.");
    }

    setGuardandoId(null);
  }

  async function agregarArticulosFiltrados() {
    if (!promocion || guardandoLote) return;

    const articulosParaInsertar = articulosFiltradosNoSeleccionados.map((articulo) => ({
      promocion_id: promocion.id,
      articulo_id: articulo.id,
      codigo_articulo: String(articulo.codigo || "").trim(),
      nombre_articulo: articulo.nombre || "",
      cantidad_minima: 1,
    }));

    if (articulosParaInsertar.length === 0) {
      setMensaje("No hay artículos nuevos para añadir con estos filtros.");
      return;
    }

    const confirmar = window.confirm(
      `¿Añadir ${articulosParaInsertar.length} artículos filtrados a la promoción?`
    );

    if (!confirmar) return;

    setError("");
    setMensaje("");
    setGuardandoLote(true);

    const { data, error } = await supabase
      .from("promociones_ruleta_articulos")
      .insert(articulosParaInsertar)
      .select("*");

    if (error) {
      console.error(error);
      setError("No se han podido añadir todos los artículos filtrados.");
    } else {
      setArticulosSeleccionados((actual) =>
        [...actual, ...(data || [])].sort((a, b) =>
          String(a.nombre_articulo || "").localeCompare(
            String(b.nombre_articulo || ""),
            "es",
            { sensitivity: "base" }
          )
        )
      );

      setMensaje(`${data?.length || 0} artículos añadidos correctamente.`);
    }

    setGuardandoLote(false);
  }

  async function cambiarCantidadMinima(item, valor) {
    const cantidad = Number.parseInt(valor, 10);

    if (Number.isNaN(cantidad) || cantidad < 1) {
      setError("La cantidad mínima debe ser igual o mayor que 1.");
      return;
    }

    setError("");
    setMensaje("");
    setActualizandoId(item.id);

    const { error } = await supabase
      .from("promociones_ruleta_articulos")
      .update({
        cantidad_minima: cantidad,
      })
      .eq("id", item.id);

    if (error) {
      console.error(error);
      setError("No se ha podido actualizar la cantidad mínima.");
    } else {
      setArticulosSeleccionados((actual) =>
        actual.map((actualItem) =>
          actualItem.id === item.id
            ? {
                ...actualItem,
                cantidad_minima: cantidad,
              }
            : actualItem
        )
      );
      setMensaje("Cantidad mínima actualizada.");
    }

    setActualizandoId(null);
  }

  async function eliminarArticulo(item) {
    const confirmar = window.confirm(
      `¿Quitar "${item.nombre_articulo}" de la promoción?`
    );

    if (!confirmar) return;

    setError("");
    setMensaje("");
    setEliminandoId(item.id);

    const { error } = await supabase
      .from("promociones_ruleta_articulos")
      .delete()
      .eq("id", item.id);

    if (error) {
      console.error(error);
      setError("No se ha podido eliminar el artículo.");
    } else {
      setArticulosSeleccionados((actual) =>
        actual.filter((actualItem) => actualItem.id !== item.id)
      );
      setMensaje("Artículo eliminado.");
    }

    setEliminandoId(null);
  }

  if (cargando) {
    return <p style={texto}>Cargando artículos de promoción...</p>;
  }

  return (
    <div style={contenedor}>
      <h4 style={titulo}>📦 Artículos que cuentan para la ruleta</h4>

      <div style={resumen}>
        Lista configurada: <strong>{articulosSeleccionados.length}</strong>{" "}
        artículos · variedad mínima:{" "}
        <strong>{promocion?.variedad_minima || 0}</strong> referencias
      </div>

      {error && <div style={errorStyle}>{error}</div>}
      {mensaje && <div style={okStyle}>{mensaje}</div>}

      <section style={bloque}>
        <h5 style={subtitulo}>Añadir artículos a la promoción</h5>

        <div style={filtros}>
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
            Buscar artículo
            <input
              style={input}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código, nombre o departamento..."
            />
          </label>
        </div>

        <div style={accionesFiltro}>
          <div style={contadorFiltro}>
            {articulosFiltradosNoSeleccionados.length} artículos nuevos con estos filtros
          </div>

          <button
            type="button"
            style={{
              ...botonAgregarTodos,
              ...(articulosFiltradosNoSeleccionados.length === 0 || guardandoLote
                ? botonDeshabilitado
                : {}),
            }}
            disabled={articulosFiltradosNoSeleccionados.length === 0 || guardandoLote}
            onClick={agregarArticulosFiltrados}
          >
            {guardandoLote
              ? "Añadiendo..."
              : departamentoFiltro === "TODOS" && !busqueda.trim()
                ? "Añadir todos"
                : "Añadir todos los filtrados"}
          </button>
        </div>

        <div style={resultados}>
          {articulosFiltrados.length === 0 ? (
            <div style={vacio}>No hay artículos con esos filtros.</div>
          ) : (
            articulosFiltrados.slice(0, 160).map((articulo) => {
              const codigo = String(articulo.codigo || "").trim();
              const seleccionado = codigosSeleccionados.has(codigo);

              return (
                <article
                  key={articulo.id}
                  style={{
                    ...articuloCard,
                    ...(seleccionado ? articuloCardSeleccionado : {}),
                  }}
                >
                  <div style={articuloInfo}>
                    <strong style={articuloNombre}>
                      {articulo.codigo ? `${articulo.codigo} · ` : ""}
                      {articulo.nombre}
                    </strong>

                    <span style={departamentoTexto}>
                      {articulo.departamentos?.nombre || "Sin departamento"}
                    </span>
                  </div>

                  <button
                    type="button"
                    style={{
                      ...botonAgregar,
                      ...(seleccionado ? botonAgregado : {}),
                    }}
                    disabled={seleccionado || guardandoId === articulo.id || guardandoLote}
                    onClick={() => agregarArticulo(articulo)}
                  >
                    {seleccionado
                      ? "Añadido"
                      : guardandoId === articulo.id
                        ? "..."
                        : "+"}
                  </button>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section style={bloque}>
        <h5 style={subtitulo}>Artículos participantes</h5>

        {articulosSeleccionados.length === 0 ? (
          <div style={vacio}>
            Todavía no hay artículos configurados. Añade artículos desde el
            buscador superior.
          </div>
        ) : (
          <div style={tablaWrap}>
            <table style={tabla}>
              <thead>
                <tr>
                  <th style={th}>Artículo</th>
                  <th style={thCantidad}>Cantidad mínima</th>
                  <th style={thAcciones}>Eliminar</th>
                </tr>
              </thead>

              <tbody>
                {articulosSeleccionados.map((item) => (
                  <tr key={item.id}>
                    <td style={td}>
                      <strong>{item.nombre_articulo}</strong>

                      {item.codigo_articulo && (
                        <div style={codigoTexto}>
                          Código: {item.codigo_articulo}
                        </div>
                      )}
                    </td>

                    <td style={tdCantidad}>
                      <input
                        style={inputCantidad}
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={item.cantidad_minima || 1}
                        disabled={actualizandoId === item.id}
                        onBlur={(e) =>
                          cambiarCantidadMinima(item, e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    </td>

                    <td style={tdAcciones}>
                      <button
                        type="button"
                        style={botonEliminar}
                        disabled={eliminandoId === item.id}
                        onClick={() => eliminarArticulo(item)}
                      >
                        {eliminandoId === item.id ? "..." : "Eliminar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const contenedor = {
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  padding: "16px",
  background: "#ffffff",
  marginBottom: "16px",
};

const titulo = {
  margin: "0 0 14px",
  fontSize: "17px",
  color: "#111827",
};

const subtitulo = {
  margin: "0 0 12px",
  fontSize: "15px",
  color: "#111827",
};

const texto = {
  margin: "0 0 18px",
  color: "#6b7280",
  fontSize: "15px",
};

const resumen = {
  marginBottom: "12px",
  padding: "10px 12px",
  borderRadius: "12px",
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  color: "#111827",
  fontSize: "14px",
};

const bloque = {
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  padding: "14px",
  background: "#f9fafb",
  marginTop: "12px",
};

const filtros = {
  display: "grid",
  gridTemplateColumns: "minmax(190px, 260px) minmax(240px, 1fr)",
  gap: "12px",
  marginBottom: "12px",
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

const accionesFiltro = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  marginBottom: "12px",
  flexWrap: "wrap",
};

const contadorFiltro = {
  color: "#6b7280",
  fontSize: "13px",
  fontWeight: "700",
};

const botonAgregarTodos = {
  border: "none",
  borderRadius: "10px",
  background: "#2563eb",
  color: "#ffffff",
  padding: "10px 14px",
  fontSize: "13px",
  fontWeight: "900",
  cursor: "pointer",
};

const botonDeshabilitado = {
  opacity: 0.55,
  cursor: "not-allowed",
};

const resultados = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: "10px",
  maxHeight: "390px",
  overflowY: "auto",
  paddingRight: "4px",
};

const articuloCard = {
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  borderRadius: "12px",
  padding: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
};

const articuloCardSeleccionado = {
  borderColor: "#22c55e",
  background: "#f0fdf4",
};

const articuloInfo = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minWidth: 0,
};

const articuloNombre = {
  color: "#111827",
  fontSize: "13px",
  lineHeight: 1.25,
};

const departamentoTexto = {
  color: "#6b7280",
  fontSize: "12px",
};

const botonAgregar = {
  minWidth: "46px",
  height: "38px",
  border: "none",
  borderRadius: "10px",
  background: "#111827",
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: "900",
  cursor: "pointer",
};

const botonAgregado = {
  background: "#22c55e",
  fontSize: "12px",
};

const tablaWrap = {
  width: "100%",
  overflowX: "auto",
};

const tabla = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#ffffff",
  borderRadius: "12px",
  overflow: "hidden",
  fontSize: "14px",
};

const th = {
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  padding: "10px",
  color: "#374151",
  background: "#ffffff",
};

const thCantidad = {
  ...th,
  width: "170px",
  textAlign: "center",
};

const thAcciones = {
  ...th,
  width: "120px",
  textAlign: "center",
};

const td = {
  borderBottom: "1px solid #f3f4f6",
  padding: "10px",
  color: "#111827",
};

const tdCantidad = {
  ...td,
  textAlign: "center",
};

const tdAcciones = {
  ...td,
  textAlign: "center",
};

const codigoTexto = {
  marginTop: "4px",
  color: "#6b7280",
  fontSize: "12px",
};

const inputCantidad = {
  width: "90px",
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "9px",
  fontSize: "14px",
  textAlign: "center",
  fontWeight: "800",
};

const botonEliminar = {
  border: "none",
  background: "#dc2626",
  color: "#ffffff",
  borderRadius: "9px",
  padding: "8px 10px",
  fontSize: "13px",
  fontWeight: "800",
  cursor: "pointer",
};

const vacio = {
  padding: "14px",
  borderRadius: "12px",
  background: "#ffffff",
  border: "1px dashed #d1d5db",
  color: "#6b7280",
  fontSize: "14px",
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
