import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

import RuletaConfiguracion from "./RuletaConfiguracion";
import RuletaArticulos from "./RuletaArticulos";
import RuletaFormulario from "./RuletaFormulario";
import RuletaTabla from "./RuletaTabla";

const PRODUCTOS_PUBLIC_URL =
  "https://bohlxagrtpjvqrgkonlo.supabase.co/storage/v1/object/public/productos";

function getPublicPhotoUrl(fileName) {
  if (!fileName) return "";
  if (String(fileName).startsWith("http")) return fileName;
  return `${PRODUCTOS_PUBLIC_URL}/${fileName}`;
}

const premioVacio = {
  nombre: "",
  articulo_id: "",
  imagen_url: "",
  color: "#f59e0b",
  probabilidad: "",
  stock: "",
  tipo_sonido: "campana",
  activo: true,
  orden: "",
};

export default function Ruleta() {
  const [premios, setPremios] = useState([]);
  const [articulosPremio, setArticulosPremio] = useState([]);
  const [formulario, setFormulario] = useState(premioVacio);
  const [idEditando, setIdEditando] = useState(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarPremios();
    cargarArticulosPremio();
  }, []);

  async function obtenerPromocionPrincipal() {
    const { data, error } = await supabase
      .from("promociones_ruleta")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function cargarArticulosPremio() {
    const { data, error } = await supabase
      .from("articulos")
      .select(`
        id,
        codigo,
        nombre,
        foto,
        activo,
        departamentos (
          nombre
        )
      `)
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error cargando artículos para premio:", error);
      setArticulosPremio([]);
      return;
    }

    setArticulosPremio(
      (data || []).map((articulo) => ({
        ...articulo,
        foto_url: getPublicPhotoUrl(articulo.foto),
        departamento_nombre: articulo.departamentos?.nombre || "",
      }))
    );
  }

  async function cargarPremios() {
    setCargando(true);
    setError("");

    const { data, error } = await supabase
      .from("promociones_ruleta_premios")
      .select("*")
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setError("No se han podido cargar los premios.");
      setPremios([]);
    } else {
      setPremios(data || []);
    }

    setCargando(false);
  }

  function cambiarCampo(campo, valor) {
    if (campo === "articulo_id") {
      const articuloSeleccionado = articulosPremio.find(
        (articulo) => String(articulo.id) === String(valor)
      );

      setFormulario((actual) => ({
        ...actual,
        articulo_id: valor,
        nombre: articuloSeleccionado?.nombre || actual.nombre,
        imagen_url: articuloSeleccionado?.foto_url || "",
      }));

      return;
    }

    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  }

  function cancelarEdicion() {
    setIdEditando(null);
    setFormulario(premioVacio);
    setError("");
    setMensaje("");
  }

  async function guardarPremio(evento) {
    evento.preventDefault();

    setError("");
    setMensaje("");

    const articuloId = formulario.articulo_id ? Number(formulario.articulo_id) : null;
    const nombre = formulario.nombre.trim();
    const imagen_url = String(formulario.imagen_url || "").trim();
    const probabilidad = Number(formulario.probabilidad);
    const tipo_sonido = formulario.tipo_sonido || "campana";

    const stock =
      formulario.stock === ""
        ? null
        : Number.parseInt(formulario.stock, 10);

    const orden =
      formulario.orden === ""
        ? premios.length + 1
        : Number.parseInt(formulario.orden, 10);

    if (!articuloId) {
      setError("Selecciona el artículo que se entregará como premio.");
      return;
    }

    if (!nombre) {
      setError("El nombre del premio es obligatorio.");
      return;
    }

    if (Number.isNaN(probabilidad) || probabilidad < 0) {
      setError("La probabilidad debe ser un número igual o mayor que 0.");
      return;
    }

    if (formulario.stock !== "" && (Number.isNaN(stock) || stock < 0)) {
      setError("El stock debe estar vacío o ser un número igual o mayor que 0.");
      return;
    }

    if (Number.isNaN(orden) || orden < 0) {
      setError("El orden debe estar vacío o ser un número igual o mayor que 0.");
      return;
    }

    if (!["campana", "sirena", "jackpot"].includes(tipo_sonido)) {
      setError("La celebración seleccionada no es válida.");
      return;
    }

    setGuardando(true);

    try {
      const promocion = await obtenerPromocionPrincipal();

      if (!promocion?.id) {
        setError("No existe una promoción de ruleta configurada.");
        setGuardando(false);
        return;
      }

      const datosPremio = {
        promocion_id: promocion.id,
        articulo_id: articuloId,
        nombre,
        imagen_url: imagen_url || null,
        color: formulario.color || "#f59e0b",
        probabilidad,
        stock,
        tipo_sonido,
        activo: formulario.activo,
        orden,
      };

      const resultado = idEditando
        ? await supabase
            .from("promociones_ruleta_premios")
            .update(datosPremio)
            .eq("id", idEditando)
        : await supabase
            .from("promociones_ruleta_premios")
            .insert(datosPremio);

      if (resultado.error) {
        console.error(resultado.error);
        setError(
          idEditando
            ? "No se ha podido actualizar el premio."
            : "No se ha podido guardar el premio."
        );
      } else {
        setMensaje(
          idEditando
            ? "Premio actualizado correctamente."
            : "Premio guardado correctamente."
        );

        setFormulario(premioVacio);
        setIdEditando(null);
        await cargarPremios();
      }
    } catch (err) {
      console.error(err);
      setError("No se ha podido guardar el premio.");
    }

    setGuardando(false);
  }

  function editarPremio(premio) {
    setIdEditando(premio.id);

    setFormulario({
      nombre: premio.nombre || "",
      articulo_id: premio.articulo_id ? String(premio.articulo_id) : "",
      imagen_url: premio.imagen_url || premio.foto_url || premio.image_url || "",
      color: premio.color || "#f59e0b",
      probabilidad: premio.probabilidad ?? "",
      stock: premio.stock ?? "",
      tipo_sonido: premio.tipo_sonido || "campana",
      activo: premio.activo ?? true,
      orden: premio.orden ?? "",
    });

    setError("");
    setMensaje("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function eliminarPremio(premio) {
    const confirmar = window.confirm(
      `¿Eliminar el premio "${premio.nombre}"?`
    );

    if (!confirmar) return;

    setError("");
    setMensaje("");

    const { error } = await supabase
      .from("promociones_ruleta_premios")
      .delete()
      .eq("id", premio.id);

    if (error) {
      setError("No se ha podido eliminar el premio.");
      return;
    }

    if (idEditando === premio.id) {
      cancelarEdicion();
    }

    setMensaje("Premio eliminado correctamente.");
    await cargarPremios();
  }

  const totalProbabilidad = premios.reduce(
    (total, premio) => total + Number(premio.probabilidad || 0),
    0
  );

  return (
    <div>
      <h3 style={titulo}>🎡 Ruleta promocional</h3>

      <p style={texto}>
        Configura las condiciones de participación, los artículos válidos y los
        premios que aparecerán en la ruleta.
      </p>

      <RuletaConfiguracion />

      <RuletaArticulos />

      <div style={separador}>
        <h4 style={bloqueTitulo}>🎁 Premios de la ruleta</h4>
      </div>

      <RuletaFormulario
        formulario={formulario}
        articulosPremio={articulosPremio}
        cambiarCampo={cambiarCampo}
        guardarPremio={guardarPremio}
        guardando={guardando}
        error={error}
        mensaje={mensaje}
        idEditando={idEditando}
        cancelarEdicion={cancelarEdicion}
      />

      <div style={resumen}>
        <strong>Total probabilidad:</strong> {totalProbabilidad}

        {totalProbabilidad !== 100 && (
          <span style={advertencia}>
            {" "}
            · Recomendado: que el total sea 100
          </span>
        )}
      </div>

      <RuletaTabla
        premios={premios}
        cargando={cargando}
        onEditar={editarPremio}
        onEliminar={eliminarPremio}
      />
    </div>
  );
}

const titulo = {
  margin: "0 0 8px",
  fontSize: "22px",
  color: "#111827",
};

const texto = {
  margin: "0 0 18px",
  color: "#6b7280",
  fontSize: "15px",
};

const separador = {
  margin: "18px 0 10px",
};

const bloqueTitulo = {
  margin: 0,
  fontSize: "18px",
  color: "#111827",
};

const resumen = {
  margin: "0 0 16px",
  padding: "12px",
  borderRadius: "12px",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  color: "#111827",
  fontSize: "14px",
};

const advertencia = {
  color: "#b45309",
  fontWeight: "700",
};
