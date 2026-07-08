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
  const [vistaFiltro, setVistaFiltro] = useState("TODOS");

  const [cargando, setCargando] = useState(true);
  const [guardandoId, setGuardandoId] = useState(null);
  const [guardandoLote, setGuardandoLote] = useState(false);
  const [actualizandoId, setActualizandoId] = useState(null);
  const [actualizandoVentaId, setActualizandoVentaId] = useState(null);
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

  const seleccionadosPorCodigo = useMemo(() => {
    const mapa = new Map();

    articulosSeleccionados.forEach((item) => {
      const codigo = String(item.codigo_articulo || "").trim();
      if (codigo) mapa.set(codigo, item);
    });

    return mapa;
  }, [articulosSeleccionados]);

  const articulosFiltrados = useMemo(() => {
    const texto = normalizar(busqueda);
    const palabras = texto.split(/\s+/).filter(Boolean);

    return articulos.filter((articulo) => {
      const codigo = String(articulo.codigo || "").trim();
      const seleccionado = seleccionadosPorCodigo.has(codigo);

      const coincideDepartamento =
        departamentoFiltro === "TODOS" ||
        String(articulo.departamento_id) === String(departamentoFiltro);

      const coincideVista =
        vistaFiltro === "TODOS" ||
        (vistaFiltro === "EN_RULETA" && seleccionado) ||
        (vistaFiltro === "FUERA_RULETA" && !seleccionado);

      const searchable = normalizar(
        `${articulo.codigo || ""} ${articulo.nombre || ""} ${
          articulo.departamentos?.nombre || ""
        }`
      );

      const coincideBusqueda =
        palabras.length === 0 ||
        palabras.every((palabra) => searchable.includes(palabra));

      return coincideDepartamento && coincideVista && coincideBusqueda;
    });
  }, [articulos, busqueda, departamentoFiltro, seleccionadosPorCodigo, vistaFiltro]);

  const articulosFiltradosNoSeleccionados = useMemo(() => {
    return articulosFiltrados.filter((articulo) => {
      const codigo = String(articulo.codigo || "").trim();
      return codigo && !seleccionadosPorCodigo.has(codigo);
    });
  }, [articulosFiltrados, seleccionadosPorCodigo]);

  async function agregarArticulo(articulo, cantidadInicial = 1) {
    if (!promocion) return null;

    const codigo = String(articulo.codigo || "").trim();

    if (!codigo) {
      setError("Este artículo no tiene código.");
      return null;
    }

    if (seleccionadosPorCodigo.has(codigo)) {
      setMensaje("Ese artículo ya está en la promoción.");
      return seleccionadosPorCodigo.get(codigo);
    }

    setError("");
    setMensaje("");
    setGuardandoId(articulo.id);

    const cantidad = Math.max(1, Number.parseInt(cantidadInicial, 10) || 1);

    const { data, error } = await supabase
      .from("promociones_ruleta_articulos")
      .insert({
        promocion_id: promocion.id,
        articulo_id: articulo.id,
        codigo_articulo: codigo,
        nombre_articulo: articulo.nombre || "",
        cantidad_minima: cantidad,
      })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      setError("No se ha podido añadir el artículo.");
      setGuardandoId(null);
      return null;
    }

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
    setGuardandoId(null);
    return data;
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

  async function cambiarEstadoRuleta(articulo, seleccionadoActual) {
    const codigo = String(articulo.codigo || "").trim();
    const item = seleccionadosPorCodigo.get(codigo);

    if (seleccionadoActual && item) {
      await eliminarArticulo(item, false);
      return;
    }

    await agregarArticulo(articulo);
  }

  async function cambiarPermiteUnidades(articulo, permiteUnidades) {
    setError("");
    setMensaje("");
    setActualizandoVentaId(articulo.id);

    const { error } = await supabase
      .from("articulos")
      .update({ permite_unidades: permiteUnidades })
      .eq("id", articulo.id);

    if (error) {
      console.error(error);
      setError("No se ha podido actualizar si el artículo permite unidades.");
    } else {
      setArticulos((actual) =>
        actual.map((item) =>
          item.id === articulo.id
            ? {
                ...item,
                permite_unidades: permiteUnidades,
              }
            : item
        )
      );
      setMensaje(
        permiteUnidades
          ? "Artículo configurado para Cajas o Unidades."
          : "Artículo configurado para Cajas."
      );
    }

    setActualizandoVentaId(null);
  }

  async function eliminarArticulo(item, pedirConfirmacion = true) {
    if (pedirConfirmacion) {
      const confirmar = window.confirm(
        `¿Quitar "${item.nombre_articulo}" de la promoción?`
      );

      if (!confirmar) return;
    }

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
        <h5 style={subtitulo}>Gestionar artículos de la promoción</h5>

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

          <label style={label}>
            Ver
            <select
              style={input}
              value={vistaFiltro}
              onChange={(e) => setVistaFiltro(e.target.value)}
            >
              <option value="TODOS">Todos</option>
              <option value="EN_RULETA">Solo en ruleta</option>
              <option value="FUERA_RULETA">Solo fuera de ruleta</option>
            </select>
          </label>
        </div>

        <div style={accionesFiltro}>
          <div style={contadorFiltro}>
            {articulosFiltrados.length} artículos visibles · {articulosFiltradosNoSeleccionados.length} sin añadir
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

        <div style={tablaWrap}>
          <table style={tabla}>
            <thead>
              <tr>
                <th style={th}>Artículo</th>
                <th style={thDepartamento}>Departamento</th>
                <th style={thVenta}>Cajas/Unidades</th>
                <th style={thRuleta}>En ruleta</th>
                <th style={thCantidad}>Cantidad mínima</th>
              </tr>
            </thead>

            <tbody>
              {articulosFiltrados.length === 0 ? (
                <tr>
                  <td style={tdVacio} colSpan="5">
                    No hay artículos con esos filtros.
                  </td>
                </tr>
              ) : (
                articulosFiltrados.slice(0, 220).map((articulo) => {
                  const codigo = String(articulo.codigo || "").trim();
                  const itemSeleccionado = seleccionadosPorCodigo.get(codigo);
                  const seleccionado = Boolean(itemSeleccionado);
                  const guardandoEste =
                    guardandoId === articulo.id ||
                    eliminandoId === itemSeleccionado?.id ||
                    guardandoLote;

                  return (
                    <tr
                      key={articulo.id}
                      style={seleccionado ? filaSeleccionada : undefined}
                    >
                      <td style={td}>
                        <strong>{articulo.nombre}</strong>

                        {articulo.codigo && (
                          <div style={codigoTexto}>Código: {articulo.codigo}</div>
                        )}
                      </td>

                      <td style={tdDepartamento}>
                        {articulo.departamentos?.nombre || "Sin departamento"}
                      </td>

                      <td style={tdCentro}>
                        <select
                          style={{
                            ...selectVenta,
                            ...(articulo.permite_unidades ? selectVentaUnidades : {}),
                          }}
                          value={articulo.permite_unidades ? "CAJAS_UNIDADES" : "CAJAS"}
                          disabled={actualizandoVentaId === articulo.id}
                          onChange={(e) =>
                            cambiarPermiteUnidades(
                              articulo,
                              e.target.value === "CAJAS_UNIDADES"
                            )
                          }
                        >
                          <option value="CAJAS">Cajas</option>
                          <option value="CAJAS_UNIDADES">Cajas o Unidades</option>
                        </select>
                      </td>

                      <td style={tdCentro}>
                        <label style={switchLabel}>
                          <input
                            type="checkbox"
                            checked={seleccionado}
                            disabled={guardandoEste}
                            onChange={() => cambiarEstadoRuleta(articulo, seleccionado)}
                          />
                          <span>{seleccionado ? "Sí" : "No"}</span>
                        </label>
                      </td>

                      <td style={tdCantidad}>
                        <input
                          style={{
                            ...inputCantidad,
                            ...(!seleccionado ? inputCantidadDeshabilitado : {}),
                          }}
                          type="number"
                          min="1"
                          step="1"
                          value={itemSeleccionado?.cantidad_minima || 1}
                          disabled={!seleccionado || actualizandoId === itemSeleccionado?.id}
                          onChange={(e) => {
                            const valor = Number.parseInt(e.target.value, 10) || 1;
                            setArticulosSeleccionados((actual) =>
                              actual.map((actualItem) =>
                                actualItem.id === itemSeleccionado?.id
                                  ? { ...actualItem, cantidad_minima: valor }
                                  : actualItem
                              )
                            );
                          }}
                          onBlur={(e) =>
                            itemSeleccionado && cambiarCantidadMinima(itemSeleccionado, e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.currentTarget.blur();
                            }
                          }}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {articulosFiltrados.length > 220 && (
          <div style={avisoLimite}>
            Mostrando los primeros 220 resultados. Usa el buscador o el departamento para afinar más.
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
  gridTemplateColumns: "minmax(190px, 260px) minmax(240px, 1fr) minmax(160px, 200px)",
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

const tablaWrap = {
  width: "100%",
  overflowX: "auto",
  maxHeight: "560px",
  overflowY: "auto",
  borderRadius: "12px",
  border: "1px solid #e5e7eb",
  background: "#ffffff",
};

const tabla = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#ffffff",
  fontSize: "14px",
};

const th = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  padding: "10px",
  color: "#374151",
  background: "#ffffff",
};

const thDepartamento = {
  ...th,
  width: "180px",
};

const thVenta = {
  ...th,
  width: "170px",
  textAlign: "center",
};

const thRuleta = {
  ...th,
  width: "110px",
  textAlign: "center",
};

const thCantidad = {
  ...th,
  width: "150px",
  textAlign: "center",
};

const td = {
  borderBottom: "1px solid #f3f4f6",
  padding: "10px",
  color: "#111827",
  verticalAlign: "middle",
};

const tdDepartamento = {
  ...td,
  color: "#6b7280",
  fontSize: "13px",
};

const tdCentro = {
  ...td,
  textAlign: "center",
};

const tdCantidad = {
  ...td,
  textAlign: "center",
};

const tdVacio = {
  ...td,
  padding: "18px",
  color: "#6b7280",
  textAlign: "center",
};

const filaSeleccionada = {
  background: "#f0fdf4",
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
  background: "#ffffff",
};

const inputCantidadDeshabilitado = {
  opacity: 0.45,
  background: "#f3f4f6",
};

const selectVenta = {
  width: "165px",
  maxWidth: "100%",
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "9px 10px",
  fontSize: "13px",
  fontWeight: "800",
  color: "#111827",
  background: "#ffffff",
  cursor: "pointer",
};

const selectVentaUnidades = {
  borderColor: "#22c55e",
  background: "#f0fdf4",
};

const checkboxLabel = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  fontSize: "13px",
  fontWeight: "800",
  color: "#374151",
  cursor: "pointer",
};

const switchLabel = {
  ...checkboxLabel,
  color: "#111827",
};

const avisoLimite = {
  marginTop: "10px",
  color: "#6b7280",
  fontSize: "13px",
  fontWeight: "700",
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
