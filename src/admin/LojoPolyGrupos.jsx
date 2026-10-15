import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  urlFotoArticulo,
  COLORES_GRUPO,
  contenedor,
  tituloSeccion,
  texto,
  campo,
  campoCheckbox,
  input,
  fila,
  boton,
  botonSecundario,
  botonPeligro,
  botonIcono,
  avisoError,
  avisoOk,
  avisoAtencion,
  ayuda,
  etiquetaDificil,
} from "./lojopolyEstilos";
import LojoPolyArticuloPremio from "./LojoPolyArticuloPremio";

const normalizar = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

// datetime-local <-> ISO
const aLocal = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const aISO = (local) => (local ? new Date(local).toISOString() : null);

export default function LojoPolyGrupos({ campana, grupos, onCambio }) {
  const [articulos, setArticulos] = useState([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("articulos")
        .select("id, codigo, nombre, foto, activo, departamentos ( nombre )")
        .eq("activo", true)
        .order("nombre", { ascending: true });
      if (cancelado) return;
      if (err) setError(`No se han podido cargar los artículos: ${err.message}`);
      else setArticulos(data || []);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const idsUsados = useMemo(() => {
    const usados = new Set();
    grupos.forEach((g) => g.casillas.forEach((c) => c.articulo_id && usados.add(String(c.articulo_id))));
    return usados;
  }, [grupos]);

  const resumen = useMemo(() => {
    const casillas = grupos.flatMap((g) => g.casillas);
    return {
      grupos: grupos.length,
      articulos: casillas.length,
      dificiles: casillas.filter((c) => c.es_dificil).length,
    };
  }, [grupos]);

  async function ejecutar(accion, textoOk) {
    setError("");
    setMensaje("");
    setOcupado(true);
    try {
      await accion();
      if (textoOk) setMensaje(textoOk);
      await onCambio?.();
    } catch (err) {
      console.error(err);
      setError(err?.message || "No se ha podido guardar el cambio.");
    } finally {
      setOcupado(false);
    }
  }

  const comprobar = ({ error: err }) => {
    if (err) throw err;
  };

  function anadirGrupo() {
    const orden = grupos.length ? Math.max(...grupos.map((g) => g.orden ?? 0)) + 1 : 0;
    const usados = new Set(grupos.map((g) => g.color));
    const color = COLORES_GRUPO.find((c) => !usados.has(c)) || COLORES_GRUPO[grupos.length % COLORES_GRUPO.length];
    return ejecutar(async () => {
      comprobar(
        await supabase.from("lojopoly_grupos").insert({
          campana_id: campana.id,
          nombre: `Grupo ${grupos.length + 1}`,
          color,
          orden,
        })
      );
    }, "Grupo añadido.");
  }

  const actualizarGrupo = (id, cambios) =>
    ejecutar(async () => comprobar(await supabase.from("lojopoly_grupos").update(cambios).eq("id", id)));

  const eliminarGrupo = (id) =>
    ejecutar(async () => comprobar(await supabase.from("lojopoly_grupos").delete().eq("id", id)), "Grupo eliminado.");

  function moverGrupo(indice, direccion) {
    const otro = grupos[indice + direccion];
    const este = grupos[indice];
    if (!otro) return;
    return ejecutar(async () => {
      comprobar(await supabase.from("lojopoly_grupos").update({ orden: otro.orden }).eq("id", este.id));
      comprobar(await supabase.from("lojopoly_grupos").update({ orden: este.orden }).eq("id", otro.id));
    });
  }

  function anadirArticulo(grupo, articulo) {
    const orden = grupo.casillas.length ? Math.max(...grupo.casillas.map((c) => c.orden_en_grupo ?? 0)) + 1 : 0;
    return ejecutar(async () => {
      comprobar(
        await supabase.from("lojopoly_casillas").insert({
          campana_id: campana.id,
          tipo: "propiedad",
          grupo_id: grupo.id,
          articulo_id: articulo.id,
          orden_en_grupo: orden,
        })
      );
    }, `${articulo.nombre} añadido a ${grupo.nombre}.`);
  }

  const actualizarCasilla = (id, cambios) =>
    ejecutar(async () => comprobar(await supabase.from("lojopoly_casillas").update(cambios).eq("id", id)));

  const quitarCasilla = (id) =>
    ejecutar(async () => comprobar(await supabase.from("lojopoly_casillas").delete().eq("id", id)), "Artículo quitado del grupo.");

  function moverCasilla(grupo, indice, direccion) {
    const este = grupo.casillas[indice];
    const otro = grupo.casillas[indice + direccion];
    if (!otro) return;
    return ejecutar(async () => {
      comprobar(await supabase.from("lojopoly_casillas").update({ orden_en_grupo: otro.orden_en_grupo }).eq("id", este.id));
      comprobar(await supabase.from("lojopoly_casillas").update({ orden_en_grupo: este.orden_en_grupo }).eq("id", otro.id));
    });
  }

  return (
    <div style={contenedor}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h4 style={tituloSeccion}>Grupos y artículos</h4>
        <span style={texto}>
          {resumen.grupos} grupos · {resumen.articulos} artículos · {resumen.dificiles} difíciles
        </span>
      </div>

      <p style={ayuda}>
        Cada grupo es un color del tablero. Sus casillas son artículos del catálogo y en el tablero se ve la foto
        del artículo. Marca como <strong>difícil</strong> la casilla que quieras controlar: el dado nunca cae en ella
        salvo las veces que tú indiques. Con <strong>0 veces</strong> no sale nunca, así que nadie completará ese
        grupo hasta que le des alguna unidad. El cliente no ve qué casillas son difíciles.
      </p>

      {error && <div style={avisoError}>{error}</div>}
      {mensaje && <div style={avisoOk}>{mensaje}</div>}

      {grupos.length === 0 && <p style={texto}>Todavía no hay grupos. Añade el primero.</p>}

      {grupos.map((grupo, indice) => (
        <TarjetaGrupo
          key={grupo.id}
          grupo={grupo}
          esPrimero={indice === 0}
          esUltimo={indice === grupos.length - 1}
          ocupado={ocupado}
          articulos={articulos}
          idsUsados={idsUsados}
          onActualizar={(cambios) => actualizarGrupo(grupo.id, cambios)}
          onEliminar={() => eliminarGrupo(grupo.id)}
          onMover={(dir) => moverGrupo(indice, dir)}
          onAnadirArticulo={(art) => anadirArticulo(grupo, art)}
          onActualizarCasilla={actualizarCasilla}
          onQuitarCasilla={quitarCasilla}
          onMoverCasilla={(i, dir) => moverCasilla(grupo, i, dir)}
        />
      ))}

      <button type="button" style={boton} onClick={anadirGrupo} disabled={ocupado}>
        + Añadir grupo
      </button>
    </div>
  );
}

function TarjetaGrupo({
  grupo,
  esPrimero,
  esUltimo,
  ocupado,
  articulos,
  idsUsados,
  onActualizar,
  onEliminar,
  onMover,
  onAnadirArticulo,
  onActualizarCasilla,
  onQuitarCasilla,
  onMoverCasilla,
}) {
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [buscando, setBuscando] = useState(false);

  const dificiles = grupo.casillas.filter((c) => c.es_dificil);
  const avisos = [];
  if (grupo.casillas.length < 2) avisos.push("Un grupo necesita al menos 2 artículos.");
  if (grupo.casillas.length >= 2 && dificiles.length === 0)
    avisos.push("Este grupo no tiene ninguna casilla difícil: muchos clientes lo completarán.");
  if (!grupo.premio_texto) avisos.push("Falta definir el premio del grupo.");
  if (dificiles.length > 0 && dificiles.every((c) => (c.stock_max ?? 0) === 0))
    avisos.push("Su casilla difícil está a 0: ahora mismo nadie puede completar este grupo.");

  return (
    <section style={tarjeta(grupo.color)}>
      <div style={cabeceraGrupo(grupo.color)}>
        <strong style={{ fontSize: 16 }}>{grupo.nombre}</strong>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={botonIconoClaro} onClick={() => onMover(-1)} disabled={esPrimero || ocupado} aria-label="Subir grupo">↑</button>
          <button type="button" style={botonIconoClaro} onClick={() => onMover(1)} disabled={esUltimo || ocupado} aria-label="Bajar grupo">↓</button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, padding: 14 }}>
        <div style={fila}>
          <label style={campo}>
            <span>Nombre del grupo (proveedor)</span>
            <input
              id={`lp-grupo-nombre-${grupo.id}`}
              key={`n-${grupo.nombre}`}
              style={input}
              defaultValue={grupo.nombre}
              onBlur={(e) => e.target.value.trim() && e.target.value !== grupo.nombre && onActualizar({ nombre: e.target.value.trim() })}
            />
          </label>
          <div style={campo}>
            <span>Color</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {COLORES_GRUPO.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => c !== grupo.color && onActualizar({ color: c })}
                  style={muestraColor(c, c === grupo.color)}
                />
              ))}
              <input
                id={`lp-grupo-color-${grupo.id}`}
                type="color"
                value={grupo.color}
                onChange={(e) => onActualizar({ color: e.target.value })}
                style={{ width: 34, height: 28, padding: 0, border: 0, background: "none" }}
                title="Otro color"
              />
            </div>
          </div>
        </div>

        <div style={fila}>
          <label style={{ ...campo, flex: 3 }}>
            <span>Premio al completar el grupo</span>
            <input
              id={`lp-grupo-premio-${grupo.id}`}
              key={`p-${grupo.premio_texto}`}
              style={input}
              placeholder="Ej.: Cheque de 25 € en Cash Lojo"
              defaultValue={grupo.premio_texto || ""}
              onBlur={(e) => e.target.value !== (grupo.premio_texto || "") && onActualizar({ premio_texto: e.target.value.trim() || null })}
            />
          </label>
          <label style={campo}>
            <span>Valor (€)</span>
            <input
              id={`lp-grupo-valor-${grupo.id}`}
              key={`v-${grupo.premio_valor}`}
              style={input}
              type="number"
              min={0}
              step="0.01"
              defaultValue={grupo.premio_valor ?? ""}
              onBlur={(e) => {
                const valor = e.target.value === "" ? null : Number(e.target.value);
                if (valor !== (grupo.premio_valor === null ? null : Number(grupo.premio_valor))) onActualizar({ premio_valor: valor });
              }}
            />
          </label>
        </div>

        <LojoPolyArticuloPremio
          idBase={`lp-grupo-regalo-${grupo.id}`}
          articuloId={grupo.premio_articulo_id}
          cantidad={grupo.premio_cantidad}
          ocupado={ocupado}
          onCambiar={(c) =>
            onActualizar({
              ...("articulo_id" in c ? { premio_articulo_id: c.articulo_id } : {}),
              ...("cantidad" in c ? { premio_cantidad: c.cantidad } : {}),
            })
          }
        />

        {avisos.length > 0 && (
          <div style={avisoAtencion}>
            {avisos.map((a) => (
              <div key={a}>• {a}</div>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gap: 8 }}>
          {grupo.casillas.map((casilla, i) => (
            <FilaCasilla
              key={casilla.id}
              casilla={casilla}
              color={grupo.color}
              esPrimera={i === 0}
              esUltima={i === grupo.casillas.length - 1}
              ocupado={ocupado}
              onActualizar={(cambios) => onActualizarCasilla(casilla.id, cambios)}
              onQuitar={() => onQuitarCasilla(casilla.id)}
              onMover={(dir) => onMoverCasilla(i, dir)}
            />
          ))}
        </div>

        {buscando ? (
          <BuscadorArticulos
            articulos={articulos}
            idsUsados={idsUsados}
            onElegir={(art) => {
              onAnadirArticulo(art);
              setBuscando(false);
            }}
            onCerrar={() => setBuscando(false)}
          />
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
            <button type="button" style={botonSecundario} onClick={() => setBuscando(true)} disabled={ocupado}>
              + Añadir artículo
            </button>
            {confirmarBorrado ? (
              <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#991b1b", fontWeight: 700 }}>
                ¿Eliminar el grupo y sus artículos?
                <button type="button" style={botonPeligro} onClick={onEliminar} disabled={ocupado}>Sí, eliminar</button>
                <button type="button" style={botonSecundario} onClick={() => setConfirmarBorrado(false)}>No</button>
              </span>
            ) : (
              <button type="button" style={botonPeligro} onClick={() => setConfirmarBorrado(true)} disabled={ocupado}>
                Eliminar grupo
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function FilaCasilla({ casilla, color, esPrimera, esUltima, ocupado, onActualizar, onQuitar, onMover }) {
  const articulo = casilla.articulos;
  const foto = urlFotoArticulo(articulo?.foto);
  const stock = casilla.stock_max ?? 0;
  const quedan = Math.max(0, stock - (casilla.emitidas ?? 0));

  return (
    <div style={filaCasilla(color)}>
      <div style={fotoCaja}>
        {foto ? <img src={foto} alt="" style={fotoImg} /> : <span style={sinFoto}>Sin foto</span>}
      </div>

      <div style={{ display: "grid", gap: 8, minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ color: "#111827", fontSize: 14 }}>{articulo?.nombre || "Artículo borrado del catálogo"}</strong>
          {articulo?.codigo && <span style={{ color: "#6b7280", fontSize: 12 }}>Cód. {articulo.codigo}</span>}
          {casilla.es_dificil && (
            <span style={etiquetaDificil}>
              Difícil · {stock === 0 ? "no sale nunca" : `quedan ${quedan} de ${stock}`}
            </span>
          )}
        </div>

        <div style={fila}>
          <label style={{ ...campo, flex: 2 }}>
            <span style={{ fontWeight: 500, fontSize: 13 }}>Nombre en el tablero (opcional)</span>
            <input
              id={`lp-casilla-nombre-${casilla.id}`}
              key={`nm-${casilla.nombre_mostrar}`}
              style={input}
              placeholder={articulo?.nombre || ""}
              defaultValue={casilla.nombre_mostrar || ""}
              onBlur={(e) =>
                e.target.value.trim() !== (casilla.nombre_mostrar || "") && onActualizar({ nombre_mostrar: e.target.value.trim() || null })
              }
            />
          </label>
        </div>

        <label style={campoCheckbox}>
          <input
            id={`lp-casilla-dificil-${casilla.id}`}
            type="checkbox"
            checked={casilla.es_dificil}
            disabled={ocupado}
            onChange={(e) => onActualizar({ es_dificil: e.target.checked })}
          />
          <span>Casilla difícil</span>
        </label>

        {casilla.es_dificil && (
          <div style={{ ...fila, padding: 10, borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a" }}>
            <label style={campo}>
              <span style={{ fontWeight: 500, fontSize: 13 }}>Veces que puede salir en toda la campaña (0 = nunca)</span>
              <input
                id={`lp-casilla-stock-${casilla.id}`}
                key={`st-${stock}`}
                style={input}
                type="number"
                min={casilla.emitidas ?? 0}
                defaultValue={stock}
                onBlur={(e) => {
                  const valor = Math.max(casilla.emitidas ?? 0, Number(e.target.value) || 0);
                  if (valor !== stock) onActualizar({ stock_max: valor });
                }}
              />
            </label>
            <label style={campo}>
              <span style={{ fontWeight: 500, fontSize: 13 }}>No puede salir antes de (opcional)</span>
              <input
                id={`lp-casilla-liberar-${casilla.id}`}
                key={`lb-${casilla.liberar_desde}`}
                style={input}
                type="datetime-local"
                defaultValue={aLocal(casilla.liberar_desde)}
                onBlur={(e) => {
                  const iso = aISO(e.target.value);
                  if (iso !== (casilla.liberar_desde ? new Date(casilla.liberar_desde).toISOString() : null))
                    onActualizar({ liberar_desde: iso });
                }}
              />
            </label>
            <div style={{ ...campo, justifyContent: "end" }}>
              <span style={{ fontWeight: 500, fontSize: 13 }}>Ya ha salido</span>
              <strong style={{ fontSize: 18, color: "#92400e", fontVariantNumeric: "tabular-nums" }}>
                {casilla.emitidas ?? 0} {casilla.emitidas === 1 ? "vez" : "veces"}
              </strong>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button type="button" style={botonIcono} onClick={() => onMover(-1)} disabled={esPrimera || ocupado} aria-label="Subir artículo">↑</button>
        <button type="button" style={botonIcono} onClick={() => onMover(1)} disabled={esUltima || ocupado} aria-label="Bajar artículo">↓</button>
        <button type="button" style={{ ...botonIcono, color: "#b91c1c" }} onClick={onQuitar} disabled={ocupado} aria-label="Quitar artículo">✕</button>
      </div>
    </div>
  );
}

function BuscadorArticulos({ articulos, idsUsados, onElegir, onCerrar }) {
  const [busqueda, setBusqueda] = useState("");

  const resultados = useMemo(() => {
    const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return [];
    return articulos
      .filter((a) => !idsUsados.has(String(a.id)))
      .filter((a) => {
        const textoArticulo = normalizar(`${a.nombre} ${a.codigo} ${a.departamentos?.nombre || ""}`);
        return palabras.every((p) => textoArticulo.includes(p));
      })
      .slice(0, 30);
  }, [articulos, idsUsados, busqueda]);

  return (
    <div style={{ display: "grid", gap: 8, padding: 12, borderRadius: 12, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          id="lp-buscar-articulo"
          style={input}
          autoFocus
          placeholder="Busca por nombre, código o departamento"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <button type="button" style={botonSecundario} onClick={onCerrar}>Cerrar</button>
      </div>

      {busqueda && resultados.length === 0 && (
        <p style={texto}>No hay artículos activos que coincidan, o ya están en otro grupo de esta campaña.</p>
      )}

      <div style={{ display: "grid", gap: 6, maxHeight: 340, overflowY: "auto" }}>
        {resultados.map((a) => {
          const foto = urlFotoArticulo(a.foto);
          return (
            <button key={a.id} type="button" onClick={() => onElegir(a)} style={resultado}>
              <span style={{ ...fotoCaja, width: 44, height: 44 }}>
                {foto ? <img src={foto} alt="" style={fotoImg} /> : <span style={sinFoto}>Sin foto</span>}
              </span>
              <span style={{ display: "grid", textAlign: "left", minWidth: 0 }}>
                <strong style={{ fontSize: 14, color: "#111827" }}>{a.nombre}</strong>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  Cód. {a.codigo || "—"} · {a.departamentos?.nombre || "Sin departamento"}
                  {!a.foto && " · sin foto"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const tarjeta = (color) => ({ border: `2px solid ${color}`, borderRadius: 14, overflow: "hidden", background: "#fff" });
const cabeceraGrupo = (color) => ({ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: color, color: "#fff", textShadow: "0 1px 1px rgba(0,0,0,.25)" });
const botonIconoClaro = { ...botonIcono, background: "rgba(255,255,255,.9)" };
const muestraColor = (c, activo) => ({ width: 26, height: 26, borderRadius: 7, background: c, border: activo ? "3px solid #111827" : "2px solid #fff", boxShadow: "0 0 0 1px #d1d5db", cursor: "pointer", padding: 0 });
const filaCasilla = (color) => ({ display: "flex", gap: 12, alignItems: "flex-start", padding: 10, borderRadius: 12, border: "1px solid #e5e7eb", borderLeft: `5px solid ${color}`, background: "#fff" });
const fotoCaja = { width: 64, height: 64, borderRadius: 10, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 };
const fotoImg = { width: "100%", height: "100%", objectFit: "contain" };
const sinFoto = { fontSize: 10, color: "#9ca3af", textAlign: "center", fontWeight: 700 };
const resultado = { display: "flex", gap: 10, alignItems: "center", padding: 8, borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", width: "100%" };
