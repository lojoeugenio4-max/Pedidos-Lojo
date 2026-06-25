import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const DIAS = [
  { id: "1", label: "Lunes" },
  { id: "2", label: "Martes" },
  { id: "3", label: "Miércoles" },
  { id: "4", label: "Jueves" },
  { id: "5", label: "Viernes" },
  { id: "6", label: "Sábado" },
  { id: "0", label: "Domingo" },
];

function articuloVacio(orden) {
  return {
    orden,
    articulo_id: "",
    codigo_articulo: "",
    nombre_articulo: "",
    texto: "",
    imagen_url: "",
    comprable: true,
  };
}

function nuevoForm() {
  return {
    titulo: "🔥 Ofertas del día",
    descripcion: "",
    fecha_inicio: "",
    fecha_fin: "",
    dias_semana: [],
    activo: true,
    ruta: "",
    departamento: "",
    numero_articulos: 1,
    articulos_push: [articuloVacio(1), articuloVacio(2), articuloVacio(3)],
  };
}

export default function Pushes() {
  const formRef = useRef(null);

  const [pushes, setPushes] = useState([]);
  const [pushArticulos, setPushArticulos] = useState([]);
  const [calendario, setCalendario] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busquedas, setBusquedas] = useState(["", "", ""]);
  const [form, setForm] = useState(() => nuevoForm());

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);
    setError("");

    try {
      const { data: pushesData, error: pushesError } = await supabase
        .from("push_ofertas")
        .select("*")
        .order("fecha_inicio", { ascending: true });
      if (pushesError) throw pushesError;

      const { data: pushArticulosData, error: pushArticulosError } = await supabase
        .from("push_articulos")
        .select("*")
        .order("orden", { ascending: true });
      if (pushArticulosError) throw pushArticulosError;

      const { data: calendarioData, error: calendarioError } = await supabase
        .from("push_calendario")
        .select("*")
        .order("fecha", { ascending: true });
      if (calendarioError) throw calendarioError;

      const { data: articulosData, error: articulosError } = await supabase
        .from("articulos")
        .select("id, codigo, nombre, activo, oculto, foto, departamentos(nombre)")
        .eq("activo", true)
        .order("nombre", { ascending: true });
      if (articulosError) throw articulosError;

      setPushes(pushesData || []);
      setPushArticulos(pushArticulosData || []);
      setCalendario(calendarioData || []);
      setArticulos(articulosData || []);
    } catch (err) {
      console.error("Error cargando Push Diario:", err);
      setError(err?.message || JSON.stringify(err));
    } finally {
      setCargando(false);
    }
  }

  const articulosPorPush = useMemo(() => {
    const mapa = new Map();

    pushArticulos.forEach((item) => {
      const lista = mapa.get(item.push_id) || [];
      lista.push(item);
      mapa.set(item.push_id, lista.sort((a, b) => Number(a.orden) - Number(b.orden)));
    });

    // Compatibilidad con pushes antiguos que aún no tengan registros en push_articulos.
    pushes.forEach((push) => {
      if (!mapa.has(push.id) && push.articulo_id) {
        mapa.set(push.id, [
          {
            id: `legacy-${push.id}`,
            push_id: push.id,
            orden: 1,
            articulo_id: push.articulo_id,
            codigo_articulo: push.codigo_articulo,
            nombre_articulo: push.nombre_articulo,
            texto: push.descripcion || push.texto || "",
            imagen_url: "",
            comprable: true,
          },
        ]);
      }
    });

    return mapa;
  }, [pushArticulos, pushes]);

  const calendarioConPush = useMemo(() => {
    return calendario.map((dia) => {
      const push = pushes.find((p) => p.id === dia.push_id);
      return { ...dia, push };
    });
  }, [calendario, pushes]);

  const fechasCalculadas = useMemo(() => {
    return calcularFechas(form.fecha_inicio, form.fecha_fin, form.dias_semana);
  }, [form.fecha_inicio, form.fecha_fin, form.dias_semana]);

  const conflictosFormulario = useMemo(() => {
    if (!form.activo) return [];

    return calendarioConPush.filter((dia) => {
      if (editando && dia.push_id === editando.id) return false;
      return fechasCalculadas.includes(dia.fecha);
    });
  }, [calendarioConPush, editando, fechasCalculadas, form.activo]);

  function abrirFormulario() {
    setEditando(null);
    setForm(nuevoForm());
    setBusquedas(["", "", ""]);
    setMostrarFormulario(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function cerrarFormulario() {
    setEditando(null);
    setMostrarFormulario(false);
    setForm(nuevoForm());
    setBusquedas(["", "", ""]);
  }

  function cambiarCampo(campo, valor) {
    setForm((actual) => ({ ...actual, [campo]: valor }));
  }

  function cambiarArticuloPush(index, campo, valor) {
    setForm((actual) => {
      const copia = actual.articulos_push.map((item) => ({ ...item }));
      copia[index] = { ...copia[index], [campo]: valor };
      return { ...actual, articulos_push: copia };
    });
  }

  function seleccionarArticulo(index, articulo) {
    setForm((actual) => {
      const copia = actual.articulos_push.map((item) => ({ ...item }));
      copia[index] = {
        ...copia[index],
        articulo_id: String(articulo.id),
        codigo_articulo: articulo.codigo || "",
        nombre_articulo: articulo.nombre || "",
      };

      return {
        ...actual,
        departamento: actual.departamento || String(articulo.departamentos?.nombre || "").trim(),
        articulos_push: copia,
      };
    });

    setBusquedas((actual) => {
      const copia = [...actual];
      copia[index] = articulo.nombre || "";
      return copia;
    });
  }

  function limpiarArticulo(index) {
    setForm((actual) => {
      const copia = actual.articulos_push.map((item) => ({ ...item }));
      copia[index] = articuloVacio(index + 1);
      return { ...actual, articulos_push: copia };
    });

    setBusquedas((actual) => {
      const copia = [...actual];
      copia[index] = "";
      return copia;
    });
  }

  async function subirImagenPush(index, file) {
    if (!file) return;

    setError("");
    setCargando(true);

    try {
      const extension = file.name.split(".").pop() || "jpg";
      const safeName = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;
      const path = `ofertas/${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("push")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("push").getPublicUrl(path);
      const publicUrl = data?.publicUrl || "";

      if (!publicUrl) {
        throw new Error("No se pudo obtener la URL pública de la imagen");
      }

      cambiarArticuloPush(index, "imagen_url", publicUrl);
    } catch (err) {
      console.error("Error subiendo imagen push:", err);
      setError(err?.message || JSON.stringify(err));
      alert("Error subiendo imagen. Revisa el mensaje rojo.");
    } finally {
      setCargando(false);
    }
  }

  function alternarDia(diaId) {
    setForm((actual) => {
      const existe = actual.dias_semana.includes(diaId);
      return {
        ...actual,
        dias_semana: existe
          ? actual.dias_semana.filter((d) => d !== diaId)
          : [...actual.dias_semana, diaId],
      };
    });
  }

  function marcarTodosLosDias() {
    setForm((actual) => ({ ...actual, dias_semana: DIAS.map((dia) => dia.id) }));
  }

  function limpiarDias() {
    setForm((actual) => ({ ...actual, dias_semana: [] }));
  }

  function editarPush(push) {
    const articulosActuales = articulosPorPush.get(push.id) || [];
    const normalizados = [articuloVacio(1), articuloVacio(2), articuloVacio(3)];

    articulosActuales.slice(0, 3).forEach((item, index) => {
      normalizados[index] = {
        orden: index + 1,
        articulo_id: item.articulo_id ? String(item.articulo_id) : "",
        codigo_articulo: item.codigo_articulo || "",
        nombre_articulo: item.nombre_articulo || "",
        texto: item.texto || "",
        imagen_url: item.imagen_url || "",
        comprable: item.comprable !== false,
      };
    });

    setEditando(push);
    setBusquedas(normalizados.map((item) => item.nombre_articulo || ""));
    setForm({
      titulo: push.titulo || "🔥 Ofertas del día",
      descripcion: push.descripcion || push.texto || "",
      fecha_inicio: push.fecha_inicio || "",
      fecha_fin: push.fecha_fin || "",
      dias_semana: Array.isArray(push.dias_semana) ? push.dias_semana.map(String) : [],
      activo: Boolean(push.activo),
      ruta: push.ruta || "",
      departamento: push.departamento || "",
      numero_articulos: Math.max(1, Math.min(3, articulosActuales.length || 1)),
      articulos_push: normalizados,
    });

    setMostrarFormulario(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function obtenerArticulosFormulario() {
    return form.articulos_push
      .slice(0, Number(form.numero_articulos))
      .map((item, index) => ({ ...item, orden: index + 1 }))
      .filter((item) => item.articulo_id || item.texto.trim() || item.imagen_url.trim());
  }

  function validarFormulario() {
    if (!form.titulo.trim()) return "El título es obligatorio";
    if (!form.descripcion.trim()) return "El texto general del push es obligatorio";
    if (!form.fecha_inicio) return "La fecha de inicio es obligatoria";
    if (!form.fecha_fin) return "La fecha fin es obligatoria";
    if (!form.dias_semana.length) return "Selecciona al menos un día de la semana";
    if (form.fecha_fin < form.fecha_inicio) return "La fecha fin no puede ser anterior a la fecha inicio";
    if (!fechasCalculadas.length) return "No hay ningún día válido en ese rango";

    const articulosValidos = obtenerArticulosFormulario();

    if (articulosValidos.length !== Number(form.numero_articulos)) {
      return `Has elegido ${form.numero_articulos} artículo(s). Completa todos los bloques.`;
    }

    const sinArticulo = articulosValidos.find((item) => !item.articulo_id);
    if (sinArticulo) {
      return `El bloque ${sinArticulo.orden} necesita un artículo seleccionado.`;
    }

    const sinTexto = articulosValidos.find((item) => !String(item.texto || "").trim());
    if (sinTexto) return `El artículo ${sinTexto.orden} necesita texto visible para el push.`;

    if (form.activo && conflictosFormulario.length > 0) {
      const listado = conflictosFormulario
        .slice(0, 12)
        .map((dia) => `${formatearFecha(dia.fecha)} - ${dia.push?.titulo || "Push existente"}`)
        .join("\n");
      return `No se puede activar este push.\n\nEstos días ya están ocupados por otros push activos:\n\n${listado}`;
    }

    return "";
  }

  function crearDatosPush(primerArticulo) {
    return {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim(),
      articulo_id: primerArticulo?.articulo_id ? Number(primerArticulo.articulo_id) : null,
      codigo_articulo: primerArticulo?.codigo_articulo || null,
      nombre_articulo: primerArticulo?.nombre_articulo || null,
      departamento: form.departamento.trim() || null,
      texto: form.descripcion.trim(),
      ruta: form.ruta.trim() || null,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
      dias_semana: form.dias_semana,
      activo: Boolean(form.activo),
    };
  }

  async function guardarPush() {
    setError("");

    const errorValidacion = validarFormulario();
    if (errorValidacion) return alert(errorValidacion);

    setCargando(true);

    try {
      const articulosValidos = obtenerArticulosFormulario();
      const datosPush = crearDatosPush(articulosValidos[0]);
      let pushId = editando?.id;

      if (editando) {
        const { error: pushError } = await supabase
          .from("push_ofertas")
          .update(datosPush)
          .eq("id", editando.id);
        if (pushError) throw pushError;

        const { error: borrarCalendarioError } = await supabase
          .from("push_calendario")
          .delete()
          .eq("push_id", editando.id);
        if (borrarCalendarioError) throw borrarCalendarioError;

        const { error: borrarArticulosError } = await supabase
          .from("push_articulos")
          .delete()
          .eq("push_id", editando.id);
        if (borrarArticulosError) throw borrarArticulosError;
      } else {
        const { data: pushCreado, error: pushError } = await supabase
          .from("push_ofertas")
          .insert([datosPush])
          .select("id")
          .single();
        if (pushError) throw pushError;
        pushId = pushCreado.id;
      }

      await guardarArticulosPush(pushId, articulosValidos);

      if (form.activo) {
        await reservarCalendario(pushId, fechasCalculadas);
      }

      cerrarFormulario();
      await cargarDatos();
    } catch (err) {
      console.error("Error guardando push:", err);
      setError(err?.message || JSON.stringify(err));
      alert("Error guardando push. Revisa el mensaje rojo.");
    } finally {
      setCargando(false);
    }
  }

  async function guardarArticulosPush(pushId, articulosValidos) {
    const registros = articulosValidos.map((item, index) => ({
      push_id: pushId,
      orden: index + 1,
      articulo_id: Number(item.articulo_id),
      codigo_articulo: item.codigo_articulo || null,
      nombre_articulo: item.nombre_articulo || null,
      texto: item.texto.trim() || null,
      imagen_url: item.imagen_url.trim() || null,
      comprable: Boolean(item.comprable),
    }));

    const { error: articulosError } = await supabase.from("push_articulos").insert(registros);
    if (articulosError) throw articulosError;
  }

  async function reservarCalendario(pushId, fechas) {
    if (!pushId || !fechas.length) return;

    const registrosCalendario = fechas.map((fecha) => ({ push_id: pushId, fecha }));
    const { error: calendarioError } = await supabase.from("push_calendario").insert(registrosCalendario);
    if (calendarioError) throw calendarioError;
  }

  async function cambiarEstadoPush(push) {
    setCargando(true);
    setError("");

    try {
      if (push.activo) {
        const { error: calendarioError } = await supabase.from("push_calendario").delete().eq("push_id", push.id);
        if (calendarioError) throw calendarioError;

        const { error: pushError } = await supabase.from("push_ofertas").update({ activo: false }).eq("id", push.id);
        if (pushError) throw pushError;
      } else {
        const fechas = calcularFechas(
          push.fecha_inicio,
          push.fecha_fin,
          Array.isArray(push.dias_semana) ? push.dias_semana.map(String) : []
        );

        if (!fechas.length) {
          alert("Este push no tiene fechas válidas. Edítalo antes de activarlo.");
          return;
        }

        const fechasOcupadas = calendarioConPush.filter((dia) => fechas.includes(dia.fecha));
        if (fechasOcupadas.length > 0) {
          const listado = fechasOcupadas
            .slice(0, 12)
            .map((dia) => `${formatearFecha(dia.fecha)} - ${dia.push?.titulo || "Push existente"}`)
            .join("\n");
          alert(`No se puede activar.\n\nEstos días ya están ocupados:\n\n${listado}`);
          return;
        }

        const { error: pushError } = await supabase.from("push_ofertas").update({ activo: true }).eq("id", push.id);
        if (pushError) throw pushError;

        await reservarCalendario(push.id, fechas);
      }

      await cargarDatos();
    } catch (err) {
      console.error("Error cambiando estado del push:", err);
      setError(err?.message || JSON.stringify(err));
      alert("Error cambiando estado del push. Revisa el mensaje rojo.");
    } finally {
      setCargando(false);
    }
  }

  async function liberarCalendarioPush(push) {
    const confirmar = confirm(
      `¿Liberar calendario de este push?\n\n${push.titulo || "Sin título"}\n\nEl push quedará inactivo.`
    );
    if (!confirmar) return;

    setCargando(true);
    setError("");

    try {
      const { error: calendarioError } = await supabase.from("push_calendario").delete().eq("push_id", push.id);
      if (calendarioError) throw calendarioError;

      const { error: pushError } = await supabase.from("push_ofertas").update({ activo: false }).eq("id", push.id);
      if (pushError) throw pushError;

      await cargarDatos();
    } catch (err) {
      console.error("Error liberando calendario:", err);
      setError(err?.message || JSON.stringify(err));
      alert("Error liberando calendario. Revisa el mensaje rojo.");
    } finally {
      setCargando(false);
    }
  }

  async function eliminarPush(push) {
    const confirmar = confirm(`¿Eliminar este push?\n\n${push.titulo || "Sin título"}`);
    if (!confirmar) return;

    setCargando(true);
    setError("");

    try {
      const { error: calendarioError } = await supabase.from("push_calendario").delete().eq("push_id", push.id);
      if (calendarioError) throw calendarioError;

      const { error: articulosError } = await supabase.from("push_articulos").delete().eq("push_id", push.id);
      if (articulosError) throw articulosError;

      const { error: pushError } = await supabase.from("push_ofertas").delete().eq("id", push.id);
      if (pushError) throw pushError;

      await cargarDatos();
    } catch (err) {
      console.error("Error eliminando push:", err);
      setError(err?.message || JSON.stringify(err));
      alert("Error eliminando push. Revisa el mensaje rojo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={page}>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Administración</div>
          <h1 style={title}>Push Diario</h1>
          <p style={subtitle}>
            Programa un push con 1, 2 o 3 artículos. Cada artículo puede ser comprable o informativo.
          </p>
        </div>

        <div style={heroActions}>
          <button type="button" onClick={abrirFormulario} style={newButton}>+ Nuevo Push</button>
          <button type="button" onClick={cargarDatos} style={refreshHeroButton}>Actualizar</button>
        </div>
      </section>

      <section style={infoBox}>
        <strong>Nuevo sistema</strong>
        <p>
          Un mismo push puede mostrar hasta 3 ofertas. Si un artículo es informativo, no aparecerá botón de compra en la app.
          Los push inactivos no ocupan calendario.
        </p>
      </section>

      <section style={statsGrid}>
        <StatCard label="Pushes creados" value={pushes.length} />
        <StatCard label="Pushes activos" value={pushes.filter((p) => p.activo).length} />
        <StatCard label="Pushes inactivos" value={pushes.filter((p) => !p.activo).length} />
        <StatCard label="Días ocupados" value={calendario.length} />
      </section>

      {error && (
        <section style={errorBox}>
          <strong>Error</strong>
          <p>{error}</p>
        </section>
      )}

      {mostrarFormulario && (
        <section ref={formRef} style={formBox}>
          <div style={formHeader}>
            <div>
              <h2 style={formTitle}>{editando ? "Editar Push" : "Nuevo Push"}</h2>
              <p style={formSubtitle}>Elige cuántos artículos tendrá el push y configura cada bloque.</p>
            </div>
            <button type="button" onClick={cerrarFormulario} style={closeButton}>Cerrar</button>
          </div>

          <div style={formGrid}>
            <div>
              <label style={label}>Título general</label>
              <input type="text" value={form.titulo} onChange={(e) => cambiarCampo("titulo", e.target.value)} style={input} />

              <label style={label}>Texto general del push</label>
              <textarea value={form.descripcion} onChange={(e) => cambiarCampo("descripcion", e.target.value)} placeholder="Ej: Ofertas especiales de hoy" style={textarea} />

              <label style={label}>Número de artículos</label>
              <div style={numberButtons}>
                {[1, 2, 3].map((numero) => (
                  <button key={numero} type="button" onClick={() => cambiarCampo("numero_articulos", numero)} style={numberButton(Number(form.numero_articulos) === numero)}>
                    {numero} artículo{numero > 1 ? "s" : ""}
                  </button>
                ))}
              </div>

              <div style={dateGrid}>
                <div>
                  <label style={label}>Fecha inicio</label>
                  <input type="date" value={form.fecha_inicio} onChange={(e) => cambiarCampo("fecha_inicio", e.target.value)} style={input} />
                </div>
                <div>
                  <label style={label}>Fecha fin</label>
                  <input type="date" value={form.fecha_fin} onChange={(e) => cambiarCampo("fecha_fin", e.target.value)} style={input} />
                </div>
              </div>

              <label style={label}>Días de la semana</label>
              <div style={weekGrid}>
                {DIAS.map((dia) => (
                  <button key={dia.id} type="button" onClick={() => alternarDia(dia.id)} style={weekButton(form.dias_semana.includes(dia.id))}>{dia.label}</button>
                ))}
              </div>
              <div style={miniActions}>
                <button type="button" onClick={marcarTodosLosDias} style={miniButton}>Marcar todos</button>
                <button type="button" onClick={limpiarDias} style={miniButtonMuted}>Limpiar días</button>
              </div>

              <div style={dateGrid}>
                <div>
                  <label style={label}>Departamento opcional</label>
                  <input type="text" value={form.departamento} onChange={(e) => cambiarCampo("departamento", e.target.value)} placeholder="Bebidas / Charcutería" style={input} />
                </div>
                <div>
                  <label style={label}>Ruta opcional</label>
                  <input type="text" value={form.ruta} onChange={(e) => cambiarCampo("ruta", e.target.value)} placeholder="Ej: Ruta Vigo" style={input} />
                </div>
              </div>

              <label style={checkboxLabel}>
                <input type="checkbox" checked={form.activo} onChange={(e) => cambiarCampo("activo", e.target.checked)} /> Push activo
              </label>

              <div style={previewBox}>
                <strong>{form.titulo || "🔥 Ofertas del día"}</strong>
                <p>{form.descripcion || "Texto general del push..."}</p>
                {form.activo ? <span style={activeBadge}>Reservará {fechasCalculadas.length} día(s)</span> : <span style={inactiveBadge}>Inactivo: no ocupa calendario</span>}
              </div>

              <PreviewPush form={form} />

              {conflictosFormulario.length > 0 && (
                <div style={warningBox}>
                  <strong>Conflictos detectados</strong>
                  <p>Estas fechas ya están ocupadas por otros push activos.</p>
                  <ul style={conflictList}>
                    {conflictosFormulario.slice(0, 12).map((dia) => (
                      <li key={dia.id || dia.fecha}>{formatearFecha(dia.fecha)} — {dia.push?.titulo || "Push existente"}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              {form.articulos_push.slice(0, Number(form.numero_articulos)).map((item, index) => (
                <ArticuloPushEditor
                  key={item.orden}
                  index={index}
                  item={item}
                  busqueda={busquedas[index] || ""}
                  articulos={articulos}
                  onBusqueda={(valor) => {
                    setBusquedas((actual) => {
                      const copia = [...actual];
                      copia[index] = valor;
                      return copia;
                    });
                  }}
                  onSeleccionar={(articulo) => seleccionarArticulo(index, articulo)}
                  onCambiar={(campo, valor) => cambiarArticuloPush(index, campo, valor)}
                  onLimpiar={() => limpiarArticulo(index)}
                  onUpload={(file) => subirImagenPush(index, file)}
                />
              ))}

              <div style={formActions}>
                <button type="button" onClick={guardarPush} style={saveButton}>{editando ? "Actualizar Push" : "Guardar Push"}</button>
                <button type="button" onClick={cerrarFormulario} style={cancelButton}>Cancelar</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {cargando ? (
        <div style={loadingBox}>Cargando push...</div>
      ) : (
        <>
          <section style={tableShell}>
            <div style={tableHeader}>
              <div>
                <h2 style={tableTitle}>Calendario ocupado</h2>
                <p style={tableSubtitle}>Solo aparecen días reservados por push activos.</p>
              </div>
            </div>
            <TablaCalendario calendarioConPush={calendarioConPush} />
          </section>

          <section style={tableShell}>
            <div style={tableHeader}>
              <div>
                <h2 style={tableTitle}>Pushes creados</h2>
                <p style={tableSubtitle}>Puedes editar, activar, desactivar/liberar o eliminar.</p>
              </div>
            </div>

            <div style={tableCard}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Título</th>
                    <th style={th}>Artículos</th>
                    <th style={th}>Inicio</th>
                    <th style={th}>Fin</th>
                    <th style={th}>Estado</th>
                    <th style={th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pushes.length === 0 ? (
                    <tr><td colSpan="6" style={emptyCell}>No hay registros en push_ofertas</td></tr>
                  ) : (
                    pushes.map((push) => {
                      const lista = articulosPorPush.get(push.id) || [];
                      return (
                        <tr key={push.id}>
                          <td style={td}>
                            <strong>{push.titulo || "Sin título"}</strong>
                            <div style={smallText}>{push.descripcion || push.texto || ""}</div>
                          </td>
                          <td style={td}>
                            {lista.length === 0 ? "Sin artículos" : lista.map((item) => (
                              <div key={item.id || item.orden} style={pushItemLine}>
                                <strong>{item.orden}.</strong> {item.nombre_articulo || "Sin artículo"} {item.comprable ? <span style={buyBadge}>Comprable</span> : <span style={infoBadge}>Informativo</span>}
                              </div>
                            ))}
                          </td>
                          <td style={td}>{push.fecha_inicio || "—"}</td>
                          <td style={td}>{push.fecha_fin || "—"}</td>
                          <td style={td}>{push.activo ? <span style={activeBadge}>Activo</span> : <span style={inactiveBadge}>Inactivo</span>}</td>
                          <td style={td}>
                            <div style={actionButtons}>
                              <button type="button" onClick={() => editarPush(push)} style={editButton}>Editar</button>
                              <button type="button" onClick={() => cambiarEstadoPush(push)} style={push.activo ? deactivateButton : activateButton}>{push.activo ? "Desactivar y liberar" : "Activar"}</button>
                              <button type="button" onClick={() => liberarCalendarioPush(push)} style={releaseButton}>Liberar calendario</button>
                              <button type="button" onClick={() => eliminarPush(push)} style={deleteButton}>Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function PreviewPush({ form }) {
  const articulosPreview = form.articulos_push
    .slice(0, Number(form.numero_articulos))
    .filter((item) => item.articulo_id || item.texto.trim() || item.imagen_url.trim());

  return (
    <section style={clientPreviewBox}>
      <div style={clientPreviewHeader}>
        <strong>{form.titulo || "🔥 Ofertas del día"}</strong>
        {form.descripcion && <p>{form.descripcion}</p>}
      </div>

      {articulosPreview.length === 0 ? (
        <div style={clientPreviewEmpty}>
          La vista previa aparecerá cuando completes los artículos.
        </div>
      ) : (
        <div style={clientPreviewItems}>
          {articulosPreview.map((item, index) => (
            <div key={`${item.orden}-${index}`} style={clientPreviewItem}>
              <div style={clientPreviewImageBox}>
                {item.imagen_url ? (
                  <img src={item.imagen_url} alt="" style={clientPreviewImage} />
                ) : (
                  <div style={clientPreviewNoImage}>Foto artículo</div>
                )}
              </div>

              <div style={clientPreviewContent}>
                <strong>{item.nombre_articulo || `Artículo ${index + 1}`}</strong>
                {item.texto && <p>{item.texto}</p>}

                {item.comprable ? (
                  <button type="button" style={clientPreviewBuyButton}>
                    Pedir artículo
                  </button>
                ) : (
                  <span style={clientPreviewInfoBadge}>Solo informativo</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ArticuloPushEditor({
  index,
  item,
  busqueda,
  articulos,
  onBusqueda,
  onSeleccionar,
  onCambiar,
  onLimpiar,
  onUpload,
}) {
  const textoBusqueda = busqueda.trim().toLowerCase();
  const articulosFiltrados = articulos
    .filter((articulo) => !articulo.oculto)
    .filter((articulo) => {
      if (!textoBusqueda) return true;
      return `${articulo.codigo || ""} ${articulo.nombre || ""}`.toLowerCase().includes(textoBusqueda);
    })
    .slice(0, 40);

  return (
    <section style={articleEditor}>
      <div style={articleEditorHeader}>
        <h3 style={articleEditorTitle}>Artículo {index + 1}</h3>
        <button type="button" onClick={onLimpiar} style={miniButtonMuted}>Limpiar</button>
      </div>

      <label style={label}>Buscar artículo</label>
      <input type="text" value={busqueda} onChange={(e) => onBusqueda(e.target.value)} placeholder="Buscar por nombre o código..." style={input} />

      <div style={articleList}>
        {articulosFiltrados.map((articulo) => {
          const seleccionado = String(articulo.id) === String(item.articulo_id);
          return (
            <button key={articulo.id} type="button" onClick={() => onSeleccionar(articulo)} style={articleOption(seleccionado)}>
              <span><strong>{articulo.nombre}</strong><small style={articleCode}>Código {articulo.codigo || "-"}</small></span>
              {seleccionado && <span style={selectedBadge}>Seleccionado</span>}
            </button>
          );
        })}
      </div>

      <label style={label}>Texto de este artículo</label>
      <textarea value={item.texto} onChange={(e) => onCambiar("texto", e.target.value)} placeholder="Ej: Oferta especial, regalo, precio, condiciones..." style={smallTextarea} />

      <label style={label}>Imagen propia opcional</label>

      <div style={uploadBox}>
        {item.imagen_url ? (
          <img src={item.imagen_url} alt="" style={uploadPreview} />
        ) : (
          <div style={uploadEmpty}>Sin imagen propia</div>
        )}

        <div style={uploadControls}>
          <label style={uploadButton}>
            Subir imagen
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onUpload(e.target.files?.[0])}
              style={hiddenFileInput}
            />
          </label>

          {item.imagen_url && (
            <button
              type="button"
              onClick={() => onCambiar("imagen_url", "")}
              style={removeImageButton}
            >
              Quitar imagen
            </button>
          )}
        </div>
      </div>

      <input
        type="text"
        value={item.imagen_url}
        onChange={(e) => onCambiar("imagen_url", e.target.value)}
        placeholder="URL de imagen. Si está vacío, usará la foto del artículo."
        style={input}
      />

      <label style={checkboxLabel}>
        <input type="checkbox" checked={item.comprable} onChange={(e) => onCambiar("comprable", e.target.checked)} /> Se puede pedir desde el push
      </label>

      {!item.comprable && <p style={hint}>Este bloque será solo informativo y no mostrará botón de compra.</p>}
    </section>
  );
}

function TablaCalendario({ calendarioConPush }) {
  return (
    <div style={tableCard}>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Fecha</th>
            <th style={th}>Título</th>
            <th style={th}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {calendarioConPush.length === 0 ? (
            <tr><td colSpan="3" style={emptyCell}>No hay días ocupados en calendario</td></tr>
          ) : (
            calendarioConPush.map((dia) => (
              <tr key={dia.id}>
                <td style={td}>{formatearFecha(dia.fecha)}</td>
                <td style={td}><strong>{dia.push?.titulo || "Push no encontrado"}</strong></td>
                <td style={td}>{dia.push?.activo ? <span style={activeBadge}>Activo</span> : <span style={inactiveBadge}>Inactivo</span>}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function calcularFechas(fechaInicio, fechaFin, diasSemana) {
  if (!fechaInicio || !fechaFin) return [];
  const inicio = crearFechaLocal(fechaInicio);
  const fin = crearFechaLocal(fechaFin);
  const diasPermitidos = new Set((diasSemana || []).map(String));
  const fechas = [];
  const actual = new Date(inicio);

  while (actual <= fin) {
    const diaSemana = String(actual.getDay());
    if (diasPermitidos.has(diaSemana)) fechas.push(fechaLocalISO(actual));
    actual.setDate(actual.getDate() + 1);
  }

  return fechas;
}

function StatCard({ label, value }) {
  return (
    <div style={statCard}>
      <div style={statValue}>{value}</div>
      <div style={statLabel}>{label}</div>
    </div>
  );
}

function crearFechaLocal(fechaISO) {
  const [year, month, day] = String(fechaISO).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function fechaLocalISO(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return "—";
  return crearFechaLocal(fechaISO).toLocaleDateString("es-ES");
}

const page = { minHeight: "100vh", padding: "24px", background: "linear-gradient(180deg, #eef2ff 0%, #f8fafc 38%, #ffffff 100%)", boxSizing: "border-box" };
const hero = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px", background: "linear-gradient(135deg, #111827 0%, #7c2d12 48%, #ea580c 100%)", borderRadius: "24px", padding: "28px", color: "#ffffff", boxShadow: "0 22px 45px rgba(234,88,12,0.22)", marginBottom: "18px" };
const heroActions = { display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" };
const eyebrow = { display: "inline-block", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "999px", padding: "6px 12px", fontSize: "12px", fontWeight: "900", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "12px" };
const title = { margin: 0, fontSize: "34px", lineHeight: "1", fontWeight: "950" };
const subtitle = { margin: "10px 0 0", color: "#ffedd5", fontSize: "15px", maxWidth: "680px" };
const newButton = { background: "#22c55e", color: "#fff", border: "none", borderRadius: "16px", padding: "15px 22px", fontSize: "15px", fontWeight: "950", cursor: "pointer", boxShadow: "0 14px 26px rgba(34,197,94,0.28)", whiteSpace: "nowrap" };
const refreshHeroButton = { background: "#ffffff", color: "#9a3412", border: "none", borderRadius: "16px", padding: "15px 22px", fontSize: "15px", fontWeight: "950", cursor: "pointer", whiteSpace: "nowrap" };
const infoBox = { background: "#eff6ff", color: "#1e3a8a", border: "1px solid #bfdbfe", padding: "14px 16px", borderRadius: "18px", marginBottom: "18px" };
const statsGrid = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px", marginBottom: "18px" };
const statCard = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "18px", padding: "16px", boxShadow: "0 10px 28px rgba(15,23,42,0.06)" };
const statValue = { fontSize: "28px", fontWeight: "950", color: "#111827", lineHeight: "1" };
const statLabel = { marginTop: "8px", fontSize: "12px", fontWeight: "850", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" };
const errorBox = { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", padding: "16px", borderRadius: "18px", marginBottom: "18px" };
const warningBox = { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", padding: "14px", borderRadius: "16px", marginTop: "12px" };
const conflictList = { margin: "8px 0 0", paddingLeft: "18px" };
const formBox = { background: "#ffffff", border: "1px solid #fed7aa", borderRadius: "22px", padding: "18px", marginBottom: "18px", boxShadow: "0 18px 40px rgba(234,88,12,0.12)" };
const formHeader = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px", marginBottom: "14px" };
const formTitle = { margin: 0, color: "#111827", fontSize: "21px", fontWeight: "950" };
const formSubtitle = { margin: "5px 0 0", color: "#64748b", fontSize: "13px" };
const closeButton = { border: "none", borderRadius: "999px", padding: "9px 14px", background: "#f1f5f9", color: "#334155", fontWeight: "900", cursor: "pointer" };
const formGrid = { display: "grid", gridTemplateColumns: "minmax(280px, 0.85fr) minmax(360px, 1.15fr)", gap: "18px", alignItems: "start" };
const label = { display: "block", fontWeight: "900", marginBottom: "7px", color: "#334155", fontSize: "13px" };
const input = { width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #d1d5db", borderRadius: "13px", fontSize: "14px", marginBottom: "12px", outline: "none", background: "#ffffff" };
const textarea = { ...input, minHeight: "108px", resize: "vertical" };
const smallTextarea = { ...input, minHeight: "72px", resize: "vertical" };
const articleList = { maxHeight: "190px", overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: "16px", background: "#fff", marginBottom: "14px" };
const articleOption = (selected) => ({ width: "100%", border: "none", borderBottom: "1px solid #f1f5f9", background: selected ? "#ffedd5" : "#fff", padding: "12px 13px", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" });
const articleCode = { display: "block", color: "#64748b", fontSize: "12px", marginTop: "3px" };
const selectedBadge = { background: "#ea580c", color: "#fff", padding: "6px 9px", borderRadius: "999px", fontSize: "11px", fontWeight: "900", whiteSpace: "nowrap" };
const clientPreviewBox = { background: "rgba(15,23,42,0.92)", borderRadius: "22px", padding: "14px", marginTop: "14px", marginBottom: "14px", color: "#ffffff", boxShadow: "0 18px 36px rgba(15,23,42,0.18)" };
const clientPreviewHeader = { textAlign: "center", marginBottom: "12px", fontSize: "17px", lineHeight: "1.2" };
const clientPreviewItems = { display: "flex", flexDirection: "column", gap: "10px" };
const clientPreviewItem = { display: "grid", gridTemplateColumns: "92px minmax(0, 1fr)", gap: "10px", alignItems: "center", background: "#ffffff", color: "#111827", borderRadius: "16px", padding: "9px" };
const clientPreviewImageBox = { width: "92px", height: "92px", borderRadius: "12px", background: "#f8fafc", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" };
const clientPreviewImage = { width: "100%", height: "100%", objectFit: "contain" };
const clientPreviewNoImage = { color: "#94a3b8", fontSize: "12px", fontWeight: "900", textAlign: "center" };
const clientPreviewContent = { minWidth: 0, fontSize: "13px", lineHeight: "1.25" };
const clientPreviewBuyButton = { width: "100%", border: "none", borderRadius: "999px", padding: "9px 11px", background: "#22c55e", color: "#ffffff", fontSize: "13px", fontWeight: "1000", marginTop: "7px" };
const clientPreviewInfoBadge = { display: "inline-block", marginTop: "7px", background: "#e0f2fe", color: "#075985", borderRadius: "999px", padding: "6px 9px", fontSize: "12px", fontWeight: "950" };
const clientPreviewEmpty = { background: "#ffffff", color: "#64748b", borderRadius: "14px", padding: "16px", textAlign: "center", fontWeight: "900" };
const articleEditor = { border: "1px solid #fed7aa", background: "#fff7ed", borderRadius: "18px", padding: "14px", marginBottom: "14px" };
const articleEditorHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "8px" };
const articleEditorTitle = { margin: 0, color: "#9a3412", fontSize: "17px", fontWeight: "950" };
const dateGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };
const numberButtons = { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" };
const numberButton = (selected) => ({ border: "none", borderRadius: "999px", padding: "10px 13px", background: selected ? "#ea580c" : "#f1f5f9", color: selected ? "#fff" : "#334155", cursor: "pointer", fontWeight: "950" });
const weekGrid = { display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" };
const weekButton = (selected) => ({ border: "none", borderRadius: "999px", padding: "9px 12px", background: selected ? "#ea580c" : "#f1f5f9", color: selected ? "#fff" : "#334155", cursor: "pointer", fontWeight: "950" });
const miniActions = { display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" };
const miniButton = { border: "none", borderRadius: "999px", padding: "8px 12px", background: "#dbeafe", color: "#1d4ed8", fontWeight: "900", cursor: "pointer" };
const miniButtonMuted = { ...miniButton, background: "#f1f5f9", color: "#475569" };
const hint = { margin: "0 0 12px", color: "#64748b", fontSize: "12px", fontWeight: "800" };
const uploadBox = { display: "grid", gridTemplateColumns: "90px 1fr", gap: "10px", alignItems: "center", background: "#ffffff", border: "1px solid #fed7aa", borderRadius: "14px", padding: "10px", marginBottom: "10px" };
const uploadPreview = { width: "90px", height: "90px", objectFit: "contain", borderRadius: "12px", background: "#fff", border: "1px solid #e5e7eb" };
const uploadEmpty = { width: "90px", height: "90px", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#94a3b8", fontSize: "12px", fontWeight: "900", borderRadius: "12px", background: "#f8fafc", border: "1px dashed #cbd5e1", boxSizing: "border-box" };
const uploadControls = { display: "flex", flexDirection: "column", gap: "8px" };
const uploadButton = { display: "inline-flex", justifyContent: "center", alignItems: "center", background: "#22c55e", color: "#ffffff", borderRadius: "999px", padding: "10px 12px", fontWeight: "950", cursor: "pointer", fontSize: "13px" };
const hiddenFileInput = { display: "none" };
const removeImageButton = { border: "none", background: "#fee2e2", color: "#991b1b", borderRadius: "999px", padding: "9px 12px", fontWeight: "950", cursor: "pointer", fontSize: "13px" };
const checkboxLabel = { display: "block", marginBottom: "10px", fontWeight: "850", color: "#334155" };
const previewBox = { background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "16px", padding: "14px", color: "#9a3412" };
const formActions = { display: "flex", gap: "10px", marginTop: "12px" };
const saveButton = { background: "#22c55e", color: "white", border: "none", padding: "12px 18px", borderRadius: "14px", fontWeight: "950", cursor: "pointer" };
const cancelButton = { background: "#e5e7eb", color: "#111827", border: "none", padding: "12px 18px", borderRadius: "14px", fontWeight: "950", cursor: "pointer" };
const loadingBox = { padding: "30px", textAlign: "center", color: "#64748b", fontWeight: "900", background: "#ffffff", borderRadius: "16px" };
const tableShell = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "22px", padding: "16px", boxShadow: "0 14px 35px rgba(15,23,42,0.07)", marginBottom: "18px" };
const tableHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", marginBottom: "14px" };
const tableTitle = { margin: 0, color: "#111827", fontSize: "20px", fontWeight: "950" };
const tableSubtitle = { margin: "5px 0 0", color: "#64748b", fontSize: "13px" };
const tableCard = { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "18px", background: "#fff" };
const table = { width: "100%", borderCollapse: "separate", borderSpacing: 0 };
const th = { background: "#f8fafc", color: "#475569", textAlign: "left", padding: "13px 14px", fontSize: "12px", fontWeight: "950", borderBottom: "1px solid #e5e7eb", textTransform: "uppercase" };
const td = { padding: "13px 14px", verticalAlign: "middle", fontSize: "14px", borderBottom: "1px solid #f1f5f9" };
const emptyCell = { textAlign: "center", padding: "30px", color: "#94a3b8", fontWeight: "800" };
const smallText = { marginTop: "4px", color: "#64748b", fontSize: "12px" };
const activeBadge = { background: "#dcfce7", color: "#166534", padding: "6px 10px", borderRadius: "999px", fontWeight: "950", fontSize: "12px" };
const inactiveBadge = { background: "#fee2e2", color: "#991b1b", padding: "6px 10px", borderRadius: "999px", fontWeight: "950", fontSize: "12px" };
const buyBadge = { background: "#dcfce7", color: "#166534", padding: "3px 7px", borderRadius: "999px", fontWeight: "900", fontSize: "11px" };
const infoBadge = { background: "#e0f2fe", color: "#075985", padding: "3px 7px", borderRadius: "999px", fontWeight: "900", fontSize: "11px" };
const pushItemLine = { marginBottom: "5px" };
const actionButtons = { display: "flex", flexDirection: "column", gap: "6px", minWidth: "135px" };
const editButton = { background: "#dbeafe", color: "#1d4ed8", border: "none", padding: "8px 12px", borderRadius: "10px", fontWeight: "950", cursor: "pointer", fontSize: "12px" };
const activateButton = { background: "#dcfce7", color: "#166534", border: "none", padding: "8px 12px", borderRadius: "10px", fontWeight: "950", cursor: "pointer", fontSize: "12px" };
const deactivateButton = { background: "#e5e7eb", color: "#374151", border: "none", padding: "8px 12px", borderRadius: "10px", fontWeight: "950", cursor: "pointer", fontSize: "12px" };
const releaseButton = { background: "#fef3c7", color: "#92400e", border: "none", padding: "8px 12px", borderRadius: "10px", fontWeight: "950", cursor: "pointer", fontSize: "12px" };
const deleteButton = { background: "#fee2e2", color: "#b91c1c", border: "none", padding: "8px 12px", borderRadius: "10px", fontWeight: "950", cursor: "pointer", fontSize: "12px" };
