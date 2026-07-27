import { useState } from "react";
import { supabase } from "../supabaseClient";
import { supabaseStorage } from "../supabaseStorageClient";
import appSource from "../App.jsx?raw";
import hiddenSource from "../hiddenProducts.js?raw";

const BUCKETS_A_MEDIR = ["productos"];

const GB = 1024 * 1024 * 1024;

// Límites orientativos de Supabase (ajusta si tu plan cambia).
const PLANES = {
  free: { etiqueta: "Free", limiteBD: 0.5 * GB, limiteStorage: 1 * GB },
  pro: { etiqueta: "Pro (incluido)", limiteBD: 8 * GB, limiteStorage: 100 * GB },
  personalizado: { etiqueta: "Personalizado", limiteBD: 0.5 * GB, limiteStorage: 1 * GB },
};

const imagenesProductos = import.meta.glob(
  "../assets/productos/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}",
  {
    eager: true,
    query: "?url",
    import: "default",
  }
);

export default function Configuracion() {
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState("");
  const [midiendo, setMidiendo] = useState(false);
  const [usoInfo, setUsoInfo] = useState(null);
  const [usoError, setUsoError] = useState("");
  const [mostrarDetalle, setMostrarDetalle] = useState(false);

  const [plan, setPlan] = useState(
    () => localStorage.getItem("lojo_plan_supabase") || "free"
  );
  const [limiteBDGB, setLimiteBDGB] = useState(
    () => Number(localStorage.getItem("lojo_limite_bd_gb")) || 0.5
  );
  const [limiteStorageGB, setLimiteStorageGB] = useState(
    () => Number(localStorage.getItem("lojo_limite_storage_gb")) || 1
  );

  function cambiarPlan(nuevoPlan) {
    setPlan(nuevoPlan);
    localStorage.setItem("lojo_plan_supabase", nuevoPlan);

    if (nuevoPlan !== "personalizado") {
      const preset = PLANES[nuevoPlan];
      setLimiteBDGB(preset.limiteBD / GB);
      setLimiteStorageGB(preset.limiteStorage / GB);
    }
  }

  function actualizarLimiteBD(valor) {
    setLimiteBDGB(valor);
    localStorage.setItem("lojo_limite_bd_gb", String(valor));
  }

  function actualizarLimiteStorage(valor) {
    setLimiteStorageGB(valor);
    localStorage.setItem("lojo_limite_storage_gb", String(valor));
  }

  async function comprobarUso() {
    setMidiendo(true);
    setUsoError("");
    setUsoInfo(null);

    try {
      const { data: bdBytes, error: errorTotal } = await supabase.rpc(
        "obtener_tamano_total_bd"
      );
      if (errorTotal) throw errorTotal;

      const { data: tablas, error: errorTablas } = await supabase.rpc(
        "obtener_uso_tablas"
      );
      if (errorTablas) throw errorTablas;

      let storageBytes = 0;
      for (const nombreBucket of BUCKETS_A_MEDIR) {
        storageBytes += await medirBucket(nombreBucket);
      }

      setUsoInfo({
        bdBytes: Number(bdBytes) || 0,
        storageBytes,
        tablas: tablas || [],
      });
    } catch (error) {
      console.error("Error midiendo uso de Supabase", error);
      setUsoError(
        "No se pudo consultar el uso. ¿Has ejecutado supabase_uso_memoria.sql en el SQL Editor de Supabase?"
      );
    }

    setMidiendo(false);
  }

  async function medirBucket(nombreBucket) {
    let total = 0;
    let offset = 0;
    const limite = 100;

    while (true) {
      const { data, error } = await supabaseStorage.storage
        .from(nombreBucket)
        .list("", { limit: limite, offset });

      if (error) {
        console.error("Error listando bucket", nombreBucket, error);
        break;
      }
      if (!data || data.length === 0) break;

      for (const archivo of data) {
        total += archivo.metadata?.size || 0;
      }

      if (data.length < limite) break;
      offset += limite;
    }

    return total;
  }

  async function importarCatalogo() {
    const confirmar = confirm(
      "Esto importará los departamentos y artículos actuales desde App.jsx a Supabase. ¿Continuar?"
    );

    if (!confirmar) return;

    setImportando(true);
    setResultado("Preparando importación...");

    try {
      const catalogo = extraerCatalogoDesdeApp(appSource);
      const imagenesPorCodigo = crearMapaImagenes();

      setResultado(
        `Detectados ${catalogo.departamentos.length} departamentos y ${catalogo.productos.length} artículos.`
      );

      await importarDepartamentos(catalogo.departamentos);

      const { data: departamentosBD } = await supabase
        .from("departamentos")
        .select("id, nombre");

      const mapaDepartamentos = new Map(
        departamentosBD.map((d) => [d.nombre, d.id])
      );

      const { data: articulosExistentes } = await supabase
        .from("articulos")
        .select("codigo");

      const codigosExistentes = new Set(
        (articulosExistentes || []).map((a) => String(a.codigo))
      );

      const codigosImportados = new Set();

      let creados = 0;
      let omitidos = 0;
      let ofertasCreadas = 0;
      let fotosSubidas = 0;

      for (const producto of catalogo.productos) {
        const codigoTexto = String(producto.codigo);

        if (
          codigosExistentes.has(codigoTexto) ||
          codigosImportados.has(codigoTexto)
        ) {
          omitidos++;
          continue;
        }

        codigosImportados.add(codigoTexto);

        let nombreFoto = null;
        const imagen = imagenesPorCodigo.get(codigoTexto);

        if (imagen) {
          nombreFoto = imagen.nombre;

          try {
            const response = await fetch(imagen.url);
            const blob = await response.blob();

            const { error: uploadError } = await supabase.storage
              .from("productos")
              .upload(nombreFoto, blob, {
                upsert: true,
                contentType: blob.type || "image/jpeg",
              });

            if (!uploadError) fotosSubidas++;
          } catch (error) {
            console.error("Error subiendo foto", producto.codigo, error);
          }
        }

        const departamentoId = mapaDepartamentos.get(producto.departamento);

        const { data: articuloCreado, error: articuloError } = await supabase
          .from("articulos")
          .insert([
            {
              codigo: Number(producto.codigo),
              nombre: producto.nombre,
              departamento_id: departamentoId,
              precio: null,
              permite_unidades: true,
              activo: true,
              novedad: producto.departamento === "NOVEDAD",
              oculto: false,
              foto: nombreFoto,
            },
          ])
          .select("id")
          .single();

        if (articuloError) {
          console.error("Error creando artículo", producto, articuloError);
          omitidos++;
          continue;
        }

        creados++;

        if (producto.oferta && producto.oferta.trim()) {
          const { error: ofertaError } = await supabase.from("ofertas").insert([
            {
              articulo_id: articuloCreado.id,
              texto: producto.oferta.trim(),
              fecha_inicio: null,
              fecha_fin: null,
            },
          ]);

          if (!ofertaError) ofertasCreadas++;
        }

        setResultado(
          `Importando... Artículos creados: ${creados}, fotos subidas: ${fotosSubidas}, omitidos: ${omitidos}`
        );
      }

      setResultado(
        `Importación terminada. Artículos creados: ${creados}. Fotos subidas: ${fotosSubidas}. Ofertas creadas: ${ofertasCreadas}. Omitidos: ${omitidos}.`
      );
    } catch (error) {
      console.error(error);
      setResultado("Error durante la importación. Revisa la consola.");
      alert("Error durante la importación");
    }

    setImportando(false);
  }

  async function importarOcultos() {
    const confirmar = confirm(
      "Esto importará los artículos ocultos desde hiddenProducts.js. Se marcarán como oculto = true. ¿Continuar?"
    );

    if (!confirmar) return;

    setImportando(true);
    setResultado("Preparando importación de artículos ocultos...");

    try {
      const productosOcultos = extraerFixedProducts(hiddenSource);
      const imagenesPorCodigo = crearMapaImagenes();

      const { data: articulosExistentes } = await supabase
        .from("articulos")
        .select("codigo");

      const codigosExistentes = new Set(
        (articulosExistentes || []).map((a) => String(a.codigo))
      );

      let creados = 0;
      let omitidos = 0;
      let ofertasCreadas = 0;
      let fotosSubidas = 0;

      for (const producto of productosOcultos) {
        const codigoTexto = String(producto.codigo);

        if (codigosExistentes.has(codigoTexto)) {
          omitidos++;
          continue;
        }

        let nombreFoto = null;
        const imagen = imagenesPorCodigo.get(codigoTexto);

        if (imagen) {
          nombreFoto = imagen.nombre;

          try {
            const response = await fetch(imagen.url);
            const blob = await response.blob();

            const { error: uploadError } = await supabase.storage
              .from("productos")
              .upload(nombreFoto, blob, {
                upsert: true,
                contentType: blob.type || "image/jpeg",
              });

            if (!uploadError) fotosSubidas++;
          } catch (error) {
            console.error("Error subiendo foto oculta", producto.codigo, error);
          }
        }

        const { data: articuloCreado, error: articuloError } = await supabase
          .from("articulos")
          .insert([
            {
              codigo: Number(producto.codigo),
              nombre: producto.nombre,
              departamento_id: null,
              precio: null,
              permite_unidades: true,
              activo: true,
              novedad: false,
              oculto: true,
              foto: nombreFoto,
            },
          ])
          .select("id")
          .single();

        if (articuloError) {
          console.error("Error creando artículo oculto", producto, articuloError);
          omitidos++;
          continue;
        }

        creados++;

        if (producto.oferta && producto.oferta.trim()) {
          const { error: ofertaError } = await supabase.from("ofertas").insert([
            {
              articulo_id: articuloCreado.id,
              texto: producto.oferta.trim(),
              fecha_inicio: null,
              fecha_fin: null,
            },
          ]);

          if (!ofertaError) ofertasCreadas++;
        }

        setResultado(
          `Importando ocultos... Creados: ${creados}, fotos subidas: ${fotosSubidas}, omitidos: ${omitidos}`
        );
      }

      setResultado(
        `Importación de ocultos terminada. Creados: ${creados}. Fotos subidas: ${fotosSubidas}. Ofertas creadas: ${ofertasCreadas}. Omitidos: ${omitidos}.`
      );
    } catch (error) {
      console.error(error);
      setResultado("Error durante la importación de ocultos. Revisa la consola.");
      alert("Error durante la importación de ocultos");
    }

    setImportando(false);
  }

  return (
    <div>
      <h1>⚙️ Configuración</h1>

      <div style={card}>
        <h2>Importación inicial</h2>

        <p>
          Importa automáticamente los departamentos, artículos, ofertas y fotos
          actuales desde el código existente.
        </p>

        <button onClick={importarCatalogo} disabled={importando} style={button}>
          {importando ? "Importando..." : "Importar catálogo actual"}
        </button>
      </div>

      <div style={{ ...card, marginTop: "20px" }}>
        <h2>Importar artículos ocultos</h2>

        <p>
          Importa los artículos de baja rotación. Quedarán marcados como ocultos:
          no aparecerán en departamentos, pero sí podrán aparecer en búsquedas.
        </p>

        <button
          onClick={importarOcultos}
          disabled={importando}
          style={secondaryButton}
        >
          {importando ? "Importando..." : "Importar artículos ocultos"}
        </button>
      </div>

      {resultado && <p style={resultadoStyle}>{resultado}</p>}

      <div style={{ ...card, marginTop: "20px" }}>
        <h2>Espacio usado / libre en Supabase</h2>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
          {Object.entries(PLANES).map(([clave, info]) => (
            <button
              key={clave}
              onClick={() => cambiarPlan(clave)}
              style={{
                ...secondaryButton,
                background: plan === clave ? "#2563eb" : "#9ca3af",
                padding: "8px 14px",
              }}
            >
              {info.etiqueta}
            </button>
          ))}
        </div>

        {plan === "personalizado" && (
          <div style={{ display: "flex", gap: "16px", marginBottom: "14px", flexWrap: "wrap" }}>
            <label>
              Límite base de datos (GB):{" "}
              <input
                type="number"
                step="0.1"
                value={limiteBDGB}
                onChange={(e) => actualizarLimiteBD(Number(e.target.value))}
                style={{ width: "80px" }}
              />
            </label>
            <label>
              Límite storage (GB):{" "}
              <input
                type="number"
                step="0.1"
                value={limiteStorageGB}
                onChange={(e) => actualizarLimiteStorage(Number(e.target.value))}
                style={{ width: "80px" }}
              />
            </label>
          </div>
        )}

        <button onClick={comprobarUso} disabled={midiendo} style={button}>
          {midiendo ? "Consultando..." : "Actualizar uso actual"}
        </button>

        {usoError && (
          <p style={{ ...resultadoStyle, color: "#b91c1c" }}>{usoError}</p>
        )}

        {usoInfo && (
          <div style={{ marginTop: "18px" }}>
            <BarraUso
              titulo="Base de datos"
              usadoBytes={usoInfo.bdBytes}
              limiteBytes={limiteBDGB * GB}
            />
            <BarraUso
              titulo="Storage (fotos)"
              usadoBytes={usoInfo.storageBytes}
              limiteBytes={limiteStorageGB * GB}
            />

            <button
              onClick={() => setMostrarDetalle((v) => !v)}
              style={{ ...secondaryButton, marginTop: "12px", background: "#6b7280" }}
            >
              {mostrarDetalle ? "Ocultar detalle por tabla" : "Ver detalle por tabla"}
            </button>

            {mostrarDetalle && (
              <table style={{ width: "100%", marginTop: "12px" }}>
                <thead>
                  <tr>
                    <th style={celda}>Tabla</th>
                    <th style={celda}>Tamaño</th>
                    <th style={celda}>Filas aprox.</th>
                  </tr>
                </thead>
                <tbody>
                  {usoInfo.tablas.map((t) => (
                    <tr key={t.tabla}>
                      <td style={celda}>{t.tabla}</td>
                      <td style={celda}>{t.tamano_total}</td>
                      <td style={celda}>{t.filas_aprox}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BarraUso({ titulo, usadoBytes, limiteBytes }) {
  const porcentaje = limiteBytes > 0 ? Math.min(100, (usadoBytes / limiteBytes) * 100) : 0;
  const libre = Math.max(0, limiteBytes - usadoBytes);

  let color = "#22c55e";
  if (porcentaje >= 90) color = "#dc2626";
  else if (porcentaje >= 70) color = "#f59e0b";

  return (
    <div style={{ marginBottom: "16px" }}>
      <p style={{ margin: "0 0 6px 0" }}>
        <strong>{titulo}:</strong> {formatearBytes(usadoBytes)} usados de{" "}
        {formatearBytes(limiteBytes)} · libre {formatearBytes(libre)} (
        {porcentaje.toFixed(1)}%)
      </p>
      <div
        style={{
          width: "100%",
          height: "14px",
          background: "#e5e7eb",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${porcentaje}%`,
            height: "100%",
            background: color,
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );
}

function formatearBytes(bytes) {
  if (!bytes) return "0 B";
  const unidades = ["B", "KB", "MB", "GB"];
  let valor = bytes;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i++;
  }
  return `${valor.toFixed(1)} ${unidades[i]}`;
}

async function importarDepartamentos(departamentos) {
  for (const nombre of departamentos) {
    await supabase
      .from("departamentos")
      .upsert([{ nombre }], { onConflict: "nombre" });
  }
}

function crearMapaImagenes() {
  const mapa = new Map();

  Object.entries(imagenesProductos).forEach(([ruta, url]) => {
    const nombre = ruta.split("/").pop();
    const codigo = nombre.replace(/\.(jpg|jpeg|png|webp)$/i, "");

    if (!mapa.has(codigo)) {
      mapa.set(codigo, {
        nombre,
        url,
      });
    }
  });

  return mapa;
}

function extraerCatalogoDesdeApp(source) {
  const inicio = source.indexOf("const departments = [");
  const inicioArray = source.indexOf("[", inicio);
  const finArray = encontrarCierre(source, inicioArray, "[", "]");

  const contenido = source.slice(inicioArray + 1, finArray);
  const bloques = extraerBloques(contenido, "{", "}");

  const departamentos = [];
  const productos = [];

  bloques.forEach((bloque) => {
    const nombreMatch = bloque.match(/name\s*:\s*(".*?"|'.*?')/s);
    if (!nombreMatch) return;

    const nombreDepartamento = leerString(nombreMatch[1]);

    departamentos.push(nombreDepartamento);

    const llamadas = extraerFixedProducts(bloque);

    llamadas.forEach((producto) => {
      productos.push({
        ...producto,
        departamento: nombreDepartamento,
      });
    });
  });

  return {
    departamentos,
    productos,
  };
}

function extraerFixedProducts(texto) {
  const productos = [];
  let posicion = 0;

  while (true) {
    const indice = texto.indexOf("fixedProduct", posicion);
    if (indice === -1) break;

    const inicioParentesis = texto.indexOf("(", indice);
    const finParentesis = encontrarCierre(texto, inicioParentesis, "(", ")");
    const argumentos = texto.slice(inicioParentesis + 1, finParentesis);
    const partes = dividirArgumentos(argumentos);

    if (partes.length >= 2) {
      productos.push({
        codigo: Number(partes[0]),
        nombre: leerString(partes[1]),
        oferta: partes[2] ? leerString(partes[2]) : "",
      });
    }

    posicion = finParentesis + 1;
  }

  return productos;
}

function dividirArgumentos(texto) {
  const partes = [];
  let actual = "";
  let dentroString = false;
  let comilla = "";
  let escape = false;

  for (const char of texto) {
    if (dentroString) {
      actual += char;

      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === comilla) {
        dentroString = false;
      }
    } else {
      if (char === '"' || char === "'") {
        dentroString = true;
        comilla = char;
        actual += char;
      } else if (char === ",") {
        partes.push(actual.trim());
        actual = "";
      } else {
        actual += char;
      }
    }
  }

  if (actual.trim()) partes.push(actual.trim());

  return partes;
}

function extraerBloques(texto, abre, cierra) {
  const bloques = [];
  let profundidad = 0;
  let inicio = null;
  let dentroString = false;
  let comilla = "";
  let escape = false;

  for (let i = 0; i < texto.length; i++) {
    const char = texto[i];

    if (dentroString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === comilla) {
        dentroString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      dentroString = true;
      comilla = char;
      continue;
    }

    if (char === abre) {
      if (profundidad === 0) inicio = i;
      profundidad++;
    }

    if (char === cierra) {
      profundidad--;

      if (profundidad === 0 && inicio !== null) {
        bloques.push(texto.slice(inicio, i + 1));
        inicio = null;
      }
    }
  }

  return bloques;
}

function encontrarCierre(texto, inicio, abre, cierra) {
  let profundidad = 0;
  let dentroString = false;
  let comilla = "";
  let escape = false;

  for (let i = inicio; i < texto.length; i++) {
    const char = texto[i];

    if (dentroString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === comilla) {
        dentroString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      dentroString = true;
      comilla = char;
      continue;
    }

    if (char === abre) profundidad++;
    if (char === cierra) profundidad--;

    if (profundidad === 0) return i;
  }

  return -1;
}

function leerString(valor) {
  try {
    return Function(`"use strict"; return (${valor});`)();
  } catch {
    return valor.replace(/^["']|["']$/g, "");
  }
}

const card = {
  padding: "22px",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  background: "#fff",
  maxWidth: "700px",
};

const button = {
  background: "#22c55e",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  padding: "12px 18px",
  fontWeight: "bold",
  cursor: "pointer",
};

const secondaryButton = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  padding: "12px 18px",
  fontWeight: "bold",
  cursor: "pointer",
};

const resultadoStyle = {
  marginTop: "18px",
  padding: "12px",
  background: "#f3f4f6",
  borderRadius: "10px",
  maxWidth: "700px",
};

const celda = {
  border: "1px solid #e5e7eb",
  padding: "6px 10px",
  textAlign: "left",
  fontSize: "14px",
};
