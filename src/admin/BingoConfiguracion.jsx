import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { supabaseStorage } from "../supabaseStorageClient";

const configuracionVacia = {
  nombre: "Promoción bingo principal", activa: false, variedad_minima: 15,
  mensaje_cliente: "Tu pedido cumple las condiciones para participar en el Bingo.",
  fecha_inicio: "", fecha_fin: "",
  premio_linea_activo: false, premio_linea_nombre: "", premio_linea_mensaje: "", premio_linea_articulo_id: "",
  premio_bingo_activo: false, premio_bingo_nombre: "", premio_bingo_mensaje: "", premio_bingo_articulo_id: "",
  premio_especial_activo: false, premio_especial_nombre: "", premio_especial_mensaje: "", premio_especial_articulo_id: "", premio_especial_max_bolas: 50,
};

function fotoUrl(foto) {
  if (!foto) return "";
  return supabaseStorage.storage.from("productos").getPublicUrl(foto).data.publicUrl;
}

export default function BingoConfiguracion() {
  const [configuracion, setConfiguracion] = useState(configuracionVacia);
  const [articulos, setArticulos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { cargarConfiguracion(); }, []);

  async function cargarConfiguracion() {
    setCargando(true); setError("");
    const [{ data, error }, { data: articulosData, error: articulosError }] = await Promise.all([
      supabase.from("promociones_bingo").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle(),
      supabase.from("articulos").select("id,codigo,nombre,foto,activo").eq("activo", true).order("nombre", { ascending: true }),
    ]);
    if (error || articulosError) setError("No se ha podido cargar la configuración o los artículos.");
    if (data) setConfiguracion({
      nombre: data.nombre || "", activa: Boolean(data.activa), variedad_minima: data.variedad_minima ?? 15,
      mensaje_cliente: data.mensaje_cliente || "", fecha_inicio: data.fecha_inicio || "", fecha_fin: data.fecha_fin || "",
      premio_linea_activo: Boolean(data.premio_linea_activo), premio_linea_nombre: data.premio_linea_nombre || "",
      premio_linea_mensaje: data.premio_linea_mensaje || "", premio_linea_articulo_id: String(data.premio_linea_articulo_id || ""),
      premio_bingo_activo: Boolean(data.premio_bingo_activo), premio_bingo_nombre: data.premio_bingo_nombre || "",
      premio_bingo_mensaje: data.premio_bingo_mensaje || "", premio_bingo_articulo_id: String(data.premio_bingo_articulo_id || ""),
      premio_especial_activo: Boolean(data.premio_especial_activo), premio_especial_nombre: data.premio_especial_nombre || "",
      premio_especial_mensaje: data.premio_especial_mensaje || "", premio_especial_articulo_id: String(data.premio_especial_articulo_id || ""),
      premio_especial_max_bolas: data.premio_especial_max_bolas ?? 50,
    });
    setArticulos(articulosData || []); setCargando(false);
  }

  function cambiarCampo(campo, valor) { setConfiguracion((actual) => ({ ...actual, [campo]: valor })); }

  function elegirArticulo(tipo, articulo) {
    cambiarCampo(`premio_${tipo}_articulo_id`, String(articulo?.id || ""));
    if (articulo) cambiarCampo(`premio_${tipo}_nombre`, articulo.nombre || "");
  }

  async function guardarConfiguracion(evento) {
    evento.preventDefault(); setGuardando(true); setMensaje(""); setError("");
    const variedadMinima = Number.parseInt(configuracion.variedad_minima, 10);
    if (Number.isNaN(variedadMinima) || variedadMinima < 1) return terminarError("La variedad mínima debe ser un número igual o mayor que 1.");
    if (configuracion.fecha_inicio && configuracion.fecha_fin && configuracion.fecha_fin < configuracion.fecha_inicio) return terminarError("La fecha fin no puede ser anterior a la fecha de inicio.");
    if (configuracion.premio_linea_activo && !configuracion.premio_linea_articulo_id) return terminarError("Selecciona un artículo para el premio por línea.");
    if (configuracion.premio_bingo_activo && !configuracion.premio_bingo_articulo_id) return terminarError("Selecciona un artículo para el premio por Bingo.");
    if (configuracion.premio_especial_activo && !configuracion.premio_especial_articulo_id) return terminarError("Selecciona un artículo para el premio especial.");
    const maxBolasEspecial = Number.parseInt(configuracion.premio_especial_max_bolas, 10);
    if (configuracion.premio_especial_activo && (Number.isNaN(maxBolasEspecial) || maxBolasEspecial < 1 || maxBolasEspecial > 90)) return terminarError("El límite del premio especial debe estar entre 1 y 90 bolas.");

    const { data: actual, error: buscarError } = await supabase.from("promociones_bingo").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (buscarError) return terminarError("No se ha podido comprobar la configuración actual.");
    const datos = {
      nombre: configuracion.nombre.trim() || "Promoción bingo principal", activa: configuracion.activa,
      variedad_minima: variedadMinima, mensaje_cliente: configuracion.mensaje_cliente.trim(),
      fecha_inicio: configuracion.fecha_inicio || null, fecha_fin: configuracion.fecha_fin || null,
      premio_linea_activo: configuracion.premio_linea_activo, premio_linea_nombre: configuracion.premio_linea_nombre.trim(),
      premio_linea_mensaje: configuracion.premio_linea_mensaje.trim(), premio_linea_articulo_id: configuracion.premio_linea_articulo_id || null,
      premio_bingo_activo: configuracion.premio_bingo_activo, premio_bingo_nombre: configuracion.premio_bingo_nombre.trim(),
      premio_bingo_mensaje: configuracion.premio_bingo_mensaje.trim(), premio_bingo_articulo_id: configuracion.premio_bingo_articulo_id || null,
      premio_especial_activo: configuracion.premio_especial_activo, premio_especial_nombre: configuracion.premio_especial_nombre.trim(),
      premio_especial_mensaje: configuracion.premio_especial_mensaje.trim(), premio_especial_articulo_id: configuracion.premio_especial_articulo_id || null,
      premio_especial_max_bolas: maxBolasEspecial,
      updated_at: new Date().toISOString(),
    };
    const resultado = actual ? await supabase.from("promociones_bingo").update(datos).eq("id", actual.id) : await supabase.from("promociones_bingo").insert(datos);
    if (resultado.error) { console.error(resultado.error); terminarError("No se ha podido guardar la configuración del Bingo."); }
    else { setMensaje("Configuración del Bingo guardada correctamente."); await cargarConfiguracion(); setGuardando(false); }
  }
  function terminarError(texto) { setError(texto); setGuardando(false); return null; }

  if (cargando) return <p style={texto}>Cargando configuración...</p>;
  return <form style={contenedor} onSubmit={guardarConfiguracion}>
    <h4 style={titulo}>⚙️ Configuración de la promoción</h4>
    <div style={grid}>
      <label style={label}>Nombre de la promoción<input style={input} value={configuracion.nombre} onChange={(e)=>cambiarCampo("nombre",e.target.value)} /></label>
      <label style={label}>Variedad mínima de artículos<input style={input} type="number" min="1" value={configuracion.variedad_minima} onChange={(e)=>cambiarCampo("variedad_minima",e.target.value)} /></label>
      <label style={label}>Fecha inicio<input style={input} type="date" value={configuracion.fecha_inicio} onChange={(e)=>cambiarCampo("fecha_inicio",e.target.value)} /></label>
      <label style={label}>Fecha fin<input style={input} type="date" value={configuracion.fecha_fin} onChange={(e)=>cambiarCampo("fecha_fin",e.target.value)} /></label>
      <label style={checkLabel}><input type="checkbox" checked={configuracion.activa} onChange={(e)=>cambiarCampo("activa",e.target.checked)} />Promoción activa</label>
      <label style={{...label,gridColumn:"1 / -1"}}>Mensaje para el cliente<textarea style={textarea} value={configuracion.mensaje_cliente} onChange={(e)=>cambiarCampo("mensaje_cliente",e.target.value)} rows={3}/></label>
    </div>
    <div style={premiosGrid}>
      <SeccionPremio tipo="linea" titulo="🏅 Premio por línea" activo={configuracion.premio_linea_activo} nombre={configuracion.premio_linea_nombre} mensaje={configuracion.premio_linea_mensaje} articuloId={configuracion.premio_linea_articulo_id} articulos={articulos} onActivo={(v)=>cambiarCampo("premio_linea_activo",v)} onNombre={(v)=>cambiarCampo("premio_linea_nombre",v)} onMensaje={(v)=>cambiarCampo("premio_linea_mensaje",v)} onArticulo={(a)=>elegirArticulo("linea",a)} />
      <SeccionPremio tipo="bingo" titulo="🎱 Premio por Bingo" activo={configuracion.premio_bingo_activo} nombre={configuracion.premio_bingo_nombre} mensaje={configuracion.premio_bingo_mensaje} articuloId={configuracion.premio_bingo_articulo_id} articulos={articulos} onActivo={(v)=>cambiarCampo("premio_bingo_activo",v)} onNombre={(v)=>cambiarCampo("premio_bingo_nombre",v)} onMensaje={(v)=>cambiarCampo("premio_bingo_mensaje",v)} onArticulo={(a)=>elegirArticulo("bingo",a)} />
      <div>
        <SeccionPremio tipo="especial" titulo="⭐ Premio especial por Bingo rápido" activo={configuracion.premio_especial_activo} nombre={configuracion.premio_especial_nombre} mensaje={configuracion.premio_especial_mensaje} articuloId={configuracion.premio_especial_articulo_id} articulos={articulos} onActivo={(v)=>cambiarCampo("premio_especial_activo",v)} onNombre={(v)=>cambiarCampo("premio_especial_nombre",v)} onMensaje={(v)=>cambiarCampo("premio_especial_mensaje",v)} onArticulo={(a)=>elegirArticulo("especial",a)} />
        <label style={{...label,marginTop:10}}>Máximo de bolas para conseguirlo<input style={input} type="number" min="1" max="90" value={configuracion.premio_especial_max_bolas} onChange={(e)=>cambiarCampo("premio_especial_max_bolas",e.target.value)} disabled={!configuracion.premio_especial_activo}/></label>
        <div style={{...ayuda,marginTop:8}}>Se concede únicamente si el cliente completa el Bingo cuando se han cantado como máximo este número de bolas.</div>
      </div>
    </div>
    <div style={ayuda}>Los premios se seleccionan del catálogo de artículos. La foto mostrada al cliente será la foto del artículo seleccionado.</div>
    {error&&<div style={errorStyle}>{error}</div>}{mensaje&&<div style={okStyle}>{mensaje}</div>}
    <button type="submit" style={boton} disabled={guardando}>{guardando?"Guardando...":"Guardar configuración"}</button>
  </form>;
}

function SeccionPremio({titulo,activo,nombre,mensaje,articuloId,articulos,onActivo,onNombre,onMensaje,onArticulo}) {
  const [buscar,setBuscar]=useState("");
  const seleccionado=articulos.find((a)=>String(a.id)===String(articuloId));
  const filtrados=useMemo(()=>{ const q=buscar.toLowerCase().trim(); if(!q)return []; return articulos.filter(a=>`${a.codigo||""} ${a.nombre||""}`.toLowerCase().includes(q)).slice(0,8); },[buscar,articulos]);
  return <section style={premioCard}>
    <div style={premioCabecera}><h5 style={premioTitulo}>{titulo}</h5><label style={switchLabel}><input type="checkbox" checked={activo} onChange={(e)=>onActivo(e.target.checked)}/>{activo?"Activo":"Inactivo"}</label></div>
    <label style={label}>Buscar artículo del premio {activo&&<span style={obligatorio}>*</span>}<input style={input} value={buscar} onChange={(e)=>setBuscar(e.target.value)} placeholder="Código o nombre del artículo"/></label>
    {filtrados.length>0&&<div style={resultados}>{filtrados.map(a=><button key={a.id} type="button" style={resultado} onClick={()=>{onArticulo(a);setBuscar("");}}>{a.foto?<img src={fotoUrl(a.foto)} alt="" style={miniFoto}/>:<span style={sinFoto}>Sin foto</span>}<span><strong>{a.nombre}</strong><small style={codigo}>Código: {a.codigo}</small></span></button>)}</div>}
    {seleccionado&&<div style={seleccionadoStyle}>{seleccionado.foto?<img src={fotoUrl(seleccionado.foto)} alt={seleccionado.nombre} style={fotoSeleccionada}/>:<div style={sinFotoGrande}>Sin foto</div>}<div><strong>{seleccionado.nombre}</strong><div style={codigo}>Código: {seleccionado.codigo}</div><button type="button" style={quitar} onClick={()=>onArticulo(null)}>Quitar selección</button></div></div>}
    <label style={label}>Nombre mostrado<input style={input} value={nombre} onChange={(e)=>onNombre(e.target.value)} required={activo} /></label>
    <label style={label}>Mensaje o descripción<textarea style={textarea} value={mensaje} onChange={(e)=>onMensaje(e.target.value)} rows={3}/></label>
  </section>;
}

const contenedor={border:"1px solid #e5e7eb",borderRadius:14,padding:16,background:"#fff",marginBottom:16}; const titulo={margin:"0 0 14px",fontSize:17,color:"#111827"}; const texto={color:"#6b7280"}; const grid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,marginBottom:14}; const label={display:"flex",flexDirection:"column",gap:6,fontSize:13,fontWeight:700,color:"#374151"}; const checkLabel={display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:"#374151",paddingTop:24}; const input={border:"1px solid #d1d5db",borderRadius:10,padding:10,fontSize:14,background:"#fff"}; const textarea={...input,resize:"vertical"}; const premiosGrid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:14,margin:"4px 0 14px"}; const premioCard={display:"flex",flexDirection:"column",gap:12,padding:14,border:"1px solid #e5e7eb",borderRadius:12,background:"#f9fafb",position:"relative"}; const premioCabecera={display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}; const premioTitulo={margin:0,fontSize:15}; const switchLabel={display:"flex",gap:7,fontSize:13,fontWeight:700}; const obligatorio={color:"#b91c1c"}; const resultados={border:"1px solid #d1d5db",borderRadius:10,background:"#fff",overflow:"hidden",maxHeight:320,overflowY:"auto"}; const resultado={width:"100%",display:"flex",alignItems:"center",gap:10,padding:8,border:0,borderBottom:"1px solid #eee",background:"#fff",textAlign:"left",cursor:"pointer"}; const miniFoto={width:48,height:48,objectFit:"contain",borderRadius:8}; const sinFoto={width:48,height:48,display:"grid",placeItems:"center",fontSize:9,background:"#eee",borderRadius:8}; const codigo={display:"block",fontSize:11,color:"#6b7280",marginTop:3}; const seleccionadoStyle={display:"flex",gap:12,alignItems:"center",padding:10,border:"2px solid #1d4ed8",borderRadius:12,background:"#eff6ff"}; const fotoSeleccionada={width:90,height:90,objectFit:"contain",background:"#fff",borderRadius:10}; const sinFotoGrande={width:90,height:90,display:"grid",placeItems:"center",background:"#fff",borderRadius:10,color:"#6b7280"}; const quitar={marginTop:8,border:0,background:"transparent",color:"#b91c1c",fontWeight:700,cursor:"pointer",padding:0}; const ayuda={margin:"0 0 12px",padding:"10px 12px",borderRadius:10,background:"#eff6ff",border:"1px solid #bfdbfe",color:"#1e3a8a",fontSize:13}; const boton={border:0,background:"#111827",color:"#fff",borderRadius:10,padding:"10px 14px",fontSize:14,cursor:"pointer"}; const errorStyle={marginBottom:10,color:"#b91c1c",fontWeight:700}; const okStyle={marginBottom:10,color:"#15803d",fontWeight:700};
