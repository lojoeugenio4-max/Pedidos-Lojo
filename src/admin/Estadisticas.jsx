import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const CORTE_HORA = 14;
const CORTE_MINUTO = 30;

function fechaLocalISO(fecha = new Date()) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function crearFechaLocal(fechaISO) {
  const [year, month, day] = String(fechaISO).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function inicioDiaEstadistico(fechaISO) {
  const fecha = crearFechaLocal(fechaISO);
  fecha.setHours(CORTE_HORA, CORTE_MINUTO, 0, 0);
  return fecha;
}

function finDiaEstadistico(fechaISO) {
  const fecha = inicioDiaEstadistico(fechaISO);
  fecha.setDate(fecha.getDate() + 1);
  return fecha;
}

function diaEstadisticoActualISO() {
  const ahora = new Date();
  const corteHoy = new Date();
  corteHoy.setHours(CORTE_HORA, CORTE_MINUTO, 0, 0);

  if (ahora < corteHoy) {
    ahora.setDate(ahora.getDate() - 1);
  }

  return fechaLocalISO(ahora);
}

function sumarDias(fechaISO, dias) {
  const fecha = crearFechaLocal(fechaISO);
  fecha.setDate(fecha.getDate() + dias);
  return fechaLocalISO(fecha);
}

function inicioSemanaISO(fechaISO) {
  const fecha = crearFechaLocal(fechaISO);
  const diaSemana = fecha.getDay();
  const diferenciaLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  fecha.setDate(fecha.getDate() + diferenciaLunes);
  return fechaLocalISO(fecha);
}

function inicioMesISO(fechaISO) {
  const fecha = crearFechaLocal(fechaISO);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return "—";
  return crearFechaLocal(fechaISO).toLocaleDateString("es-ES");
}

function formatearNumero(valor) {
  return Number(valor || 0).toLocaleString("es-ES", {
    maximumFractionDigits: 2,
  });
}

function claveDiaEstadistico(createdAt) {
  const fecha = new Date(createdAt);
  const corte = new Date(fecha);
  corte.setHours(CORTE_HORA, CORTE_MINUTO, 0, 0);

  if (fecha < corte) {
    fecha.setDate(fecha.getDate() - 1);
  }

  return fechaLocalISO(fecha);
}

function obtenerMes(fechaISO) {
  return String(fechaISO || "").slice(0, 7);
}

function nombreMes(mesISO) {
  if (!mesISO) return "—";
  const [year, month] = mesISO.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("es-ES", {
    month: "short",
    year: "numeric",
  });
}


function construirTextoPedido(pedido) {
  const fecha = pedido.created_at
    ? new Date(pedido.created_at).toLocaleString("es-ES")
    : "Fecha no disponible";
  const cliente = pedido.customer_name ? `Cliente: ${pedido.customer_name}\n` : "";
  const telefono = pedido.customer_phone ? `Teléfono: ${pedido.customer_phone}\n` : "";
  const bingo = pedido.bingoParticipa
    ? `Bingo: ${pedido.bingoBolas?.length ? `${pedido.bingoBolas.length} bola(s) cantada(s) (${pedido.bingoBolas.map((b) => b.number).join(", ")})` : "disponible, sin bolas todavía"}\n`
    : "";
  const lineas = pedido.lineas.map((linea) => {
    const cantidades = [];
    if (Number(linea.cajas || 0) > 0) cantidades.push(`${formatearNumero(linea.cajas)} cajas`);
    if (Number(linea.unidades || 0) > 0) cantidades.push(`${formatearNumero(linea.unidades)} unidades`);
    const ruleta = linea.ruleta?.incluido
      ? linea.ruleta.cumple
        ? " · 🎡 válido para ruleta"
        : ` · 🎡 promoción (mínimo ${formatearNumero(linea.ruleta.cantidadMinima)} ${linea.ruleta.permiteUnidades ? "uds." : "cajas"})`
      : "";
    return `• ${linea.nombre_articulo || "Artículo sin nombre"} (${linea.codigo_articulo || "sin código"}): ${cantidades.join(" · ") || "sin cantidad"}${ruleta}`;
  });

  return [
    `PEDIDO ${pedido.pedido_id}`,
    `Fecha: ${fecha}`,
    cliente.trimEnd(),
    telefono.trimEnd(),
    bingo.trimEnd(),
    "",
    ...lineas,
    "",
    `Artículos distintos: ${formatearNumero(pedido.articulosDistintos)}`,
    `Líneas: ${formatearNumero(pedido.totalLineas)}`,
    `Total cajas: ${formatearNumero(pedido.totalCajas)}`,
    `Total unidades: ${formatearNumero(pedido.totalUnidades)}`,
  ].filter((linea, indice, lista) => linea !== "" || lista[indice - 1] !== "").join("\n");
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function telefonoWhatsApp(telefono) {
  const digitos = String(telefono || "").replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.length === 9 && /^[6789]/.test(digitos)) return `34${digitos}`;
  return digitos;
}

function normalizarCodigoRuleta(valor) {
  // La tienda concede la ruleta usando exclusivamente codigo_articulo.
  // No se cruzan nombres, departamentos ni ofertas.
  return String(valor ?? "").trim();
}

function cantidadMinimaReglaRuleta(regla) {
  const valor = Number(String(regla?.cantidad_minima ?? 1).replace(",", "."));
  return Number.isFinite(valor) && valor > 0 ? valor : 1;
}

function cumpleMinimoRuleta(linea, regla) {
  const minimo = cantidadMinimaReglaRuleta(regla);
  const cajas = Number(linea?.cajas || 0);
  const unidades = Number(linea?.unidades || 0);

  // Reproduce la misma regla usada al generar la participación en la tienda.
  if (regla?.permite_unidades) return cajas > 0 || unidades >= minimo;
  return cajas >= minimo;
}

export default function Estadisticas() {
  const hoyEstadistico = diaEstadisticoActualISO();

  const [movimientos, setMovimientos] = useState([]);
  const [participacionesRuleta, setParticipacionesRuleta] = useState([]);
  const [promocionesRuletaPorId, setPromocionesRuletaPorId] = useState(new Map());
  const [entitlements, setEntitlements] = useState([]);
  const [bingoDraws, setBingoDraws] = useState([]);
  const [desde, setDesde] = useState(hoyEstadistico);
  const [hasta, setHasta] = useState(hoyEstadistico);
  const [periodoActivo, setPeriodoActivo] = useState("hoy");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);

  useEffect(() => {
    cargarEstadisticas(hoyEstadistico, hoyEstadistico);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarEstadisticas(desdeFiltro = desde, hastaFiltro = hasta, periodo = periodoActivo) {
    setCargando(true);
    setError("");
    setPeriodoActivo(periodo);

    try {
      const inicio = inicioDiaEstadistico(desdeFiltro).toISOString();
      const fin = finDiaEstadistico(hastaFiltro).toISOString();

      const { data, error: movimientosError } = await supabase
        .from("estadisticas_movimientos")
        .select("id, pedido_id, created_at, codigo_articulo, nombre_articulo, departamento, cajas, unidades")
        .gte("created_at", inicio)
        .lt("created_at", fin)
        .order("created_at", { ascending: true });

      if (movimientosError) throw movimientosError;

      setMovimientos(data || []);

      const { data: participacionesData, error: participacionesError } = await supabase
        .from("promotion_participations")
        .select("*")
        .gte("created_at", inicio)
        .lt("created_at", fin)
        .order("created_at", { ascending: false });

      if (participacionesError) throw participacionesError;

      setParticipacionesRuleta(participacionesData || []);

      // Nombre del cliente y disponibilidad de Bingo por pedido: viene de
      // game_entitlements, la tabla común a Ruleta y Bingo (antes solo se
      // miraba promotion_participations, que es exclusiva de Ruleta y por
      // eso los pedidos de Bingo no salían con nombre de cliente).
      //
      // IMPORTANTE: game_entitlements y bingo_draws tienen RLS y no se
      // pueden leer con un select directo desde el cliente público (Supabase
      // no da error en ese caso, simplemente devuelve la lista vacía en
      // silencio — por eso antes fallaba sin ningún aviso). Se leen a
      // través de dos funciones RPC (admin_listar_game_entitlements y
      // admin_listar_bingo_draws) que sí tienen permiso para saltarse esa
      // protección, igual que ya hace el resto de la app con validate_game_qr
      // y compañía. Sigue con su propio try/catch para que, si estas
      // funciones no existieran todavía en Supabase, el resto de las
      // estadísticas no se rompa.
      try {
        const { data: entitlementsData, error: entitlementsError } = await supabase.rpc(
          "admin_listar_game_entitlements",
          { p_desde: inicio, p_hasta: fin }
        );

        if (entitlementsError) throw entitlementsError;
        setEntitlements(entitlementsData || []);

        const tokens = Array.from(
          new Set(
            (entitlementsData || [])
              .map((fila) => String(fila.customer_token || "").trim())
              .filter(Boolean)
          )
        );

        if (tokens.length === 0) {
          setBingoDraws([]);
        } else {
          const { data: drawsData, error: drawsError } = await supabase.rpc(
            "admin_listar_bingo_draws",
            { p_tokens: tokens }
          );

          if (drawsError) throw drawsError;
          setBingoDraws(drawsData || []);
        }
      } catch (entitlementsCatchError) {
        console.error("Error cargando datos de Bingo/clientes:", entitlementsCatchError);
        setEntitlements([]);
        setBingoDraws([]);
      }

      // El informe debe utilizar la promoción asociada a cada participación,
      // no la promoción activa hoy. Además, la tienda identifica los artículos
      // de ruleta exclusivamente por codigo_articulo.
      const idsPromocion = Array.from(
        new Set(
          (participacionesData || [])
            .map((participacion) => String(participacion?.promotion_id || "").trim())
            .filter(Boolean)
        )
      );

      if (idsPromocion.length === 0) {
        setPromocionesRuletaPorId(new Map());
      } else {
        const [promocionesResultado, reglasResultado, articulosResultado] = await Promise.all([
          supabase
            .from("promociones_ruleta")
            .select("*")
            .in("id", idsPromocion),
          supabase
            .from("promociones_ruleta_articulos")
            .select("*")
            .in("promocion_id", idsPromocion),
          supabase
            .from("articulos")
            .select("codigo, permite_unidades"),
        ]);

        if (promocionesResultado.error) throw promocionesResultado.error;
        if (reglasResultado.error) throw reglasResultado.error;
        if (articulosResultado.error) throw articulosResultado.error;

        const permiteUnidadesPorCodigo = new Map(
          (articulosResultado.data || [])
            .map((articulo) => [
              normalizarCodigoRuleta(articulo.codigo),
              Boolean(articulo.permite_unidades),
            ])
            .filter(([codigo]) => Boolean(codigo))
        );

        const mapaPromociones = new Map();
        (promocionesResultado.data || []).forEach((promocion) => {
          mapaPromociones.set(String(promocion.id), {
            promocion,
            reglasPorCodigo: new Map(),
          });
        });

        (reglasResultado.data || []).forEach((regla) => {
          const promocionId = String(regla.promocion_id || "").trim();
          const codigo = normalizarCodigoRuleta(regla.codigo_articulo);
          const configuracion = mapaPromociones.get(promocionId);

          // Sin código no existe coincidencia válida. No usamos nombre ni id
          // como respaldo porque el pedido histórico guarda codigo_articulo.
          if (!configuracion || !codigo) return;

          configuracion.reglasPorCodigo.set(codigo, {
            ...regla,
            permite_unidades: permiteUnidadesPorCodigo.get(codigo) === true,
            origen_promocion: "articulo",
          });
        });

        setPromocionesRuletaPorId(mapaPromociones);
      }
    } catch (err) {
      console.error("Error cargando estadísticas:", err);
      setError(err?.message || JSON.stringify(err));
    } finally {
      setCargando(false);
    }
  }

  function aplicarHoy() {
    const hoy = diaEstadisticoActualISO();
    setDesde(hoy);
    setHasta(hoy);
    cargarEstadisticas(hoy, hoy, "hoy");
  }

  function aplicarAyer() {
    const ayer = sumarDias(diaEstadisticoActualISO(), -1);
    setDesde(ayer);
    setHasta(ayer);
    cargarEstadisticas(ayer, ayer, "ayer");
  }

  function aplicarSemana() {
    const hoy = diaEstadisticoActualISO();
    const inicio = inicioSemanaISO(hoy);
    setDesde(inicio);
    setHasta(hoy);
    cargarEstadisticas(inicio, hoy, "semana");
  }

  function aplicarMes() {
    const hoy = diaEstadisticoActualISO();
    const inicio = inicioMesISO(hoy);
    setDesde(inicio);
    setHasta(hoy);
    cargarEstadisticas(inicio, hoy, "mes");
  }

  function aplicarFiltroManual() {
    cargarEstadisticas(desde, hasta, "manual");
  }

  // Declarado antes que "resumen" a propósito: resumen ya usa este mapa, y
  // en JavaScript un const no se puede leer antes de la línea donde se
  // declara (aunque esté más abajo en el mismo componente). Tenerlo después
  // de resumen es justo lo que provocaba el "Cannot access before
  // initialization" en la consola.
  const bingoDrawsPorToken = useMemo(() => {
    const mapa = new Map();

    bingoDraws.forEach((draw) => {
      const token = String(draw.customer_token || "").trim();
      if (!token) return;

      const actual = mapa.get(token) || [];
      actual.push(draw);
      mapa.set(token, actual);
    });

    mapa.forEach((lista) => {
      lista.sort((a, b) => new Date(a.drawn_at || 0) - new Date(b.drawn_at || 0));
    });

    return mapa;
  }, [bingoDraws]);

  const resumen = useMemo(() => {
    const pedidosUnicos = new Set(
      movimientos.map((fila) => String(fila.pedido_id || fila.id || ""))
    );

    const totalCajas = movimientos.reduce((total, fila) => total + Number(fila.cajas || 0), 0);
    const totalUnidades = movimientos.reduce((total, fila) => total + Number(fila.unidades || 0), 0);
    const articulosDistintos = new Set(
      movimientos.map((fila) => String(fila.codigo_articulo || fila.nombre_articulo || ""))
    ).size;

    const pedidosConBingo = entitlements.filter((fila) => {
      const token = String(fila.customer_token || "").trim();
      const bolasDesdeDraws = token ? (bingoDrawsPorToken.get(token) || []).length : 0;
      const bolasCount = Math.max(bolasDesdeDraws, Number(fila.bingo_plays_used || 0));
      return Boolean(fila.bingo_eligible) || bolasCount > 0;
    }).length;

    return {
      totalPedidos: pedidosUnicos.size,
      totalLineas: movimientos.length,
      totalCajas,
      totalUnidades,
      articulosDistintos,
      codigosRuleta: participacionesRuleta.length,
      tiradasRuleta: participacionesRuleta.reduce((total, fila) => total + Math.max(1, Number(fila.spins_total || 1)), 0),
      codigosPendientes: participacionesRuleta.filter((fila) => String(fila.status || "").toLowerCase() === "pending").length,
      pedidosConBingo,
      bolasBingoCantadas: bingoDraws.length,
    };
  }, [movimientos, participacionesRuleta, entitlements, bingoDraws, bingoDrawsPorToken]);

  const pedidosPorDia = useMemo(() => {
    const mapa = new Map();

    movimientos.forEach((fila) => {
      const dia = claveDiaEstadistico(fila.created_at);
      const actual = mapa.get(dia) || {
        fecha: dia,
        pedidosSet: new Set(),
        pedidos: 0,
        lineas: 0,
        cajas: 0,
        unidades: 0,
      };

      actual.pedidosSet.add(String(fila.pedido_id || fila.id || ""));
      actual.lineas += 1;
      actual.cajas += Number(fila.cajas || 0);
      actual.unidades += Number(fila.unidades || 0);

      mapa.set(dia, actual);
    });

    return Array.from(mapa.values())
      .map((fila) => ({
        ...fila,
        pedidos: fila.pedidosSet.size,
        pedidosSet: undefined,
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [movimientos]);

  const pedidosPorMes = useMemo(() => {
    const mapa = new Map();

    pedidosPorDia.forEach((fila) => {
      const mes = obtenerMes(fila.fecha);
      const actual = mapa.get(mes) || { mes, pedidos: 0, lineas: 0, cajas: 0, unidades: 0 };

      actual.pedidos += fila.pedidos;
      actual.lineas += fila.lineas;
      actual.cajas += fila.cajas;
      actual.unidades += fila.unidades;

      mapa.set(mes, actual);
    });

    return Array.from(mapa.values()).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [pedidosPorDia]);

  const topCajas = useMemo(() => agruparArticulos(movimientos, "cajas").slice(0, 20), [movimientos]);
  const topUnidades = useMemo(() => agruparArticulos(movimientos, "unidades").slice(0, 20), [movimientos]);
  const topVecesPedido = useMemo(() => agruparArticulos(movimientos, "veces_pedido").slice(0, 20), [movimientos]);

  const entitlementsPorPedido = useMemo(() => {
    const mapa = new Map();

    entitlements.forEach((fila) => {
      const pedidoId = String(fila.order_id || "").trim();
      if (!pedidoId) return;
      // Si un pedido llegara a tener más de un entitlement, nos quedamos
      // con el más reciente (la lista ya viene ordenada por created_at desc).
      if (!mapa.has(pedidoId)) mapa.set(pedidoId, fila);
    });

    return mapa;
  }, [entitlements]);

  const codigosRuletaPorPedido = useMemo(() => {
    const mapa = new Map();

    participacionesRuleta.forEach((participacion) => {
      const pedidoId = String(participacion.order_id || participacion.pedido_id || "");
      if (!pedidoId) return;

      const actual = mapa.get(pedidoId) || [];
      actual.push(participacion);
      mapa.set(pedidoId, actual);
    });

    return mapa;
  }, [participacionesRuleta]);

  const pedidosConJuegos = useMemo(() => {
    const mapa = new Map();

    movimientos.forEach((fila) => {
      const pedidoId = String(fila.pedido_id || fila.id || "");
      if (!pedidoId || mapa.has(pedidoId)) return;

      mapa.set(pedidoId, {
        pedido_id: pedidoId,
        created_at: fila.created_at,
        codigos: codigosRuletaPorPedido.get(pedidoId) || [],
      });
    });

    participacionesRuleta.forEach((participacion) => {
      const pedidoId = String(participacion.order_id || participacion.pedido_id || "");
      if (!pedidoId || mapa.has(pedidoId)) return;

      mapa.set(pedidoId, {
        pedido_id: pedidoId,
        created_at: participacion.created_at,
        codigos: [participacion],
      });
    });

    entitlements.forEach((entitlement) => {
      const pedidoId = String(entitlement.order_id || "").trim();
      if (!pedidoId || mapa.has(pedidoId)) return;

      mapa.set(pedidoId, {
        pedido_id: pedidoId,
        created_at: entitlement.created_at,
        codigos: codigosRuletaPorPedido.get(pedidoId) || [],
      });
    });

    return Array.from(mapa.values())
      .map((pedido) => {
        const entitlement = entitlementsPorPedido.get(pedido.pedido_id) || null;
        const bolas = entitlement?.customer_token
          ? bingoDrawsPorToken.get(String(entitlement.customer_token)) || []
          : [];
        // Respaldo: si por lo que sea no hay filas en bingo_draws pero el
        // propio entitlement indica bolas usadas, se muestra ese número
        // igualmente (aunque sin el detalle de qué números salieron).
        const bolasCount = Math.max(bolas.length, Number(entitlement?.bingo_plays_used || 0));

        return {
          ...pedido,
          customer_name: entitlement?.customer_name || pedido.codigos?.[0]?.customer_name || null,
          customer_phone: pedido.codigos?.[0]?.customer_phone || null,
          bingoParticipa: Boolean(entitlement?.bingo_eligible || bolasCount > 0),
          bingoBolas: bolas,
          bingoBolasCount: bolasCount,
        };
      })
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [
    movimientos,
    participacionesRuleta,
    codigosRuletaPorPedido,
    entitlements,
    entitlementsPorPedido,
    bingoDrawsPorToken,
  ]);


  const detallePedidoSeleccionado = useMemo(() => {
    if (!pedidoSeleccionado) return null;

    const participacion = pedidoSeleccionado.codigos?.find(
      (codigo) => codigo?.customer_phone || codigo?.customer_name
    ) || pedidoSeleccionado.codigos?.[0] || null;

    const entitlement = entitlementsPorPedido.get(pedidoSeleccionado.pedido_id) || null;

    const promocionId = String(participacion?.promotion_id || "").trim();
    const configuracionPedido = promocionesRuletaPorId.get(promocionId) || null;

    const lineas = movimientos
      .filter((fila) => String(fila.pedido_id || fila.id || "") === pedidoSeleccionado.pedido_id)
      .map((fila) => {
        const codigo = normalizarCodigoRuleta(fila.codigo_articulo);
        const regla = configuracionPedido?.reglasPorCodigo.get(codigo) || null;

        return {
          ...fila,
          ruleta: regla
            ? {
                incluido: true,
                cumple: cumpleMinimoRuleta(fila, regla),
                cantidadMinima: cantidadMinimaReglaRuleta(regla),
                permiteUnidades: Boolean(regla.permite_unidades),
                origen: regla.origen_promocion || "articulo",
              }
            : { incluido: false, cumple: false },
        };
      })
      .sort((a, b) => {
        const porDepartamento = String(a.departamento || "").localeCompare(
          String(b.departamento || ""),
          "es",
          { sensitivity: "base" }
        );
        if (porDepartamento !== 0) return porDepartamento;
        return String(a.nombre_articulo || "").localeCompare(
          String(b.nombre_articulo || ""),
          "es",
          { sensitivity: "base" }
        );
      });

    const bingoBolas = entitlement?.customer_token
      ? bingoDrawsPorToken.get(String(entitlement.customer_token)) || []
      : [];
    const bingoBolasCount = Math.max(bingoBolas.length, Number(entitlement?.bingo_plays_used || 0));

    return {
      ...pedidoSeleccionado,
      customer_name: entitlement?.customer_name || participacion?.customer_name || null,
      customer_phone: participacion?.customer_phone || null,
      lineas,
      totalLineas: lineas.length,
      totalCajas: lineas.reduce((total, fila) => total + Number(fila.cajas || 0), 0),
      totalUnidades: lineas.reduce((total, fila) => total + Number(fila.unidades || 0), 0),
      articulosDistintos: new Set(
        lineas.map((fila) => String(fila.codigo_articulo || fila.nombre_articulo || ""))
      ).size,
      articulosRuleta: lineas.filter((fila) => fila.ruleta?.incluido),
      articulosRuletaValidos: lineas.filter((fila) => fila.ruleta?.incluido && fila.ruleta?.cumple),
      promocionRuleta: configuracionPedido?.promocion || null,
      bingoParticipa: Boolean(entitlement?.bingo_eligible || bingoBolasCount > 0),
      bingoBolas,
      bingoBolasCount,
    };
  }, [
    pedidoSeleccionado,
    movimientos,
    promocionesRuletaPorId,
    entitlementsPorPedido,
    bingoDrawsPorToken,
  ]);


  const departamentos = useMemo(() => {
    const mapa = new Map();

    movimientos.forEach((fila) => {
      const departamento = fila.departamento || "Sin departamento";
      const actual = mapa.get(departamento) || {
        departamento,
        cajas: 0,
        unidades: 0,
        veces_pedido: 0,
      };

      actual.cajas += Number(fila.cajas || 0);
      actual.unidades += Number(fila.unidades || 0);
      actual.veces_pedido += 1;

      mapa.set(departamento, actual);
    });

    return Array.from(mapa.values()).sort(
      (a, b) =>
        b.cajas + b.unidades + b.veces_pedido -
        (a.cajas + a.unidades + a.veces_pedido)
    );
  }, [movimientos]);

  return (
    <div style={page}>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Administración</div>
          <h1 style={title}>📊 Estadísticas</h1>
          <p style={subtitle}>
            Día estadístico real: de 14:30 a 14:30. Hoy es {formatearFecha(hoyEstadistico)}.
          </p>
        </div>

        <button type="button" onClick={() => cargarEstadisticas(desde, hasta, periodoActivo)} style={refreshButton}>
          Actualizar
        </button>
      </section>

      {error && (
        <section style={errorBox}>
          <strong>Error cargando estadísticas</strong>
          <p>{error}</p>
        </section>
      )}

      <section style={filtersBox}>
        <div>
          <label style={label}>Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(event) => {
              setDesde(event.target.value);
              setPeriodoActivo("manual");
            }}
            style={input}
          />
        </div>

        <div>
          <label style={label}>Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(event) => {
              setHasta(event.target.value);
              setPeriodoActivo("manual");
            }}
            style={input}
          />
        </div>

        <div style={filterActions}>
          <button type="button" onClick={aplicarHoy} style={periodoActivo === "hoy" ? activeFilterButton : periodButton}>Hoy</button>
          <button type="button" onClick={aplicarAyer} style={periodoActivo === "ayer" ? activeFilterButton : periodButton}>Ayer</button>
          <button type="button" onClick={aplicarSemana} style={periodoActivo === "semana" ? activeFilterButton : periodButton}>Semana</button>
          <button type="button" onClick={aplicarMes} style={periodoActivo === "mes" ? activeFilterButton : periodButton}>Mes</button>
          <button type="button" onClick={aplicarFiltroManual} style={periodoActivo === "manual" ? activeApplyButton : applyButton}>
            Aplicar filtro
          </button>
        </div>
      </section>

      {cargando ? (
        <div style={loadingBox}>Cargando estadísticas...</div>
      ) : (
        <>
          <section style={statsGroups}>
            <div style={statsGroup}>
              <div style={statsGroupLabel}>Pedidos</div>
              <div style={statsGroupCards}>
                <StatCard label="Pedidos" value={formatearNumero(resumen.totalPedidos)} />
                <StatCard label="Cajas" value={formatearNumero(resumen.totalCajas)} />
                <StatCard label="Unidades" value={formatearNumero(resumen.totalUnidades)} />
                <StatCard label="Artículos distintos" value={formatearNumero(resumen.articulosDistintos)} />
              </div>
            </div>

            <div style={statsGroup}>
              <div style={{ ...statsGroupLabel, ...statsGroupLabelRuleta }}>🎡 Ruleta</div>
              <div style={statsGroupCards}>
                <StatCard label="Códigos ruleta" value={formatearNumero(resumen.codigosRuleta)} accent="#7c3aed" />
                <StatCard label="Tiradas ruleta" value={formatearNumero(resumen.tiradasRuleta)} accent="#7c3aed" />
                <StatCard label="Pendientes ruleta" value={formatearNumero(resumen.codigosPendientes)} accent="#7c3aed" />
              </div>
            </div>

            <div style={statsGroup}>
              <div style={{ ...statsGroupLabel, ...statsGroupLabelBingo }}>🎱 Bingo</div>
              <div style={statsGroupCards}>
                <StatCard label="Pedidos con Bingo" value={formatearNumero(resumen.pedidosConBingo)} accent="#b45309" />
                <StatCard label="Bolas cantadas" value={formatearNumero(resumen.bolasBingoCantadas)} accent="#b45309" />
              </div>
            </div>
          </section>

          <section style={noticeBox}>
            <strong>Importante:</strong> desde ahora se cuentan pedidos reales usando pedido_id. Las estadísticas anteriores a este cambio pueden aparecer como líneas si no tenían pedido_id.
          </section>

          <Panel title="Pedidos y juegos" subtitle="Cliente, Ruleta y Bingo de cada pedido del periodo — pulsa un pedido para ver el detalle completo">
            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Fecha</th>
                    <th style={th}>Pedido</th>
                    <th style={th}>Cliente</th>
                    <th style={th}>🎡 Ruleta</th>
                    <th style={th}>🎱 Bingo</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosConJuegos.length === 0 ? (
                    <FilaVacia columnas={5} />
                  ) : (
                    pedidosConJuegos.map((pedido) => {
                      const codigos = pedido.codigos || [];

                      return (
                        <tr key={pedido.pedido_id}>
                          <td style={td}>{new Date(pedido.created_at).toLocaleString("es-ES")}</td>
                          <td style={td}>
                            <button type="button" style={orderButton} onClick={() => setPedidoSeleccionado(pedido)} title="Ver contenido del pedido">
                              {pedido.pedido_id}
                            </button>
                          </td>
                          <td style={td}>{pedido.customer_name || <span style={ruletaNoIncluido}>Sin nombre</span>}</td>
                          <td style={td}>
                            {codigos.length === 0 ? (
                              <span style={ruletaNoIncluido}>No participa</span>
                            ) : (
                              codigos.map((codigo, index) => (
                                <div key={codigo.id || codigo.code || index} style={juegoLineaRuleta}>
                                  <strong>{codigo.code || codigo.codigo || "—"}</strong>
                                  <span style={smallText}>
                                    {formatearNumero(Number(codigo.spins_used || 0))}/{formatearNumero(Math.max(1, Number(codigo.spins_total || 1)))} tiradas · {codigo.status || "—"}
                                  </span>
                                </div>
                              ))
                            )}
                          </td>
                          <td style={td}>
                            {!pedido.bingoParticipa ? (
                              <span style={ruletaNoIncluido}>No participa</span>
                            ) : (
                              <span style={bingoBadge}>🎱 {formatearNumero(pedido.bingoBolasCount)} {pedido.bingoBolasCount === 1 ? "bola" : "bolas"}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <section style={gridTwo}>
            <Panel title="Actividad por día" subtitle="Cada día va de 14:30 a 14:30">
              <MiniBarChart
                data={pedidosPorDia.map((fila) => ({
                  label: formatearFecha(fila.fecha),
                  value: Number(fila.pedidos || 0),
                }))}
                valueLabel="pedidos"
              />

              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Día estadístico</th>
                    <th style={thRight}>Pedidos</th>
                    <th style={thRight}>Líneas</th>
                    <th style={thRight}>Cajas</th>
                    <th style={thRight}>Unid.</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosPorDia.length === 0 ? (
                    <FilaVacia columnas={5} />
                  ) : (
                    pedidosPorDia.map((fila) => (
                      <tr key={fila.fecha}>
                        <td style={td}>{formatearFecha(fila.fecha)}</td>
                        <td style={tdRightStrong}>{formatearNumero(fila.pedidos)}</td>
                        <td style={tdRight}>{formatearNumero(fila.lineas)}</td>
                        <td style={tdRight}>{formatearNumero(fila.cajas)}</td>
                        <td style={tdRight}>{formatearNumero(fila.unidades)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>

            <Panel title="Actividad por mes" subtitle="Agrupado por día estadístico">
              <MiniBarChart
                data={pedidosPorMes.map((fila) => ({
                  label: nombreMes(fila.mes),
                  value: Number(fila.pedidos || 0),
                }))}
                valueLabel="pedidos"
              />

              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Mes</th>
                    <th style={thRight}>Líneas</th>
                    <th style={thRight}>Cajas</th>
                    <th style={thRight}>Unid.</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosPorMes.length === 0 ? (
                    <FilaVacia columnas={5} />
                  ) : (
                    pedidosPorMes.map((fila) => (
                      <tr key={fila.mes}>
                        <td style={td}>{nombreMes(fila.mes)}</td>
                        <td style={tdRightStrong}>{formatearNumero(fila.pedidos)}</td>
                        <td style={tdRight}>{formatearNumero(fila.lineas)}</td>
                        <td style={tdRight}>{formatearNumero(fila.cajas)}</td>
                        <td style={tdRight}>{formatearNumero(fila.unidades)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>
          </section>

          <section style={gridTwo}>
            <Panel title="Departamentos" subtitle="Departamento con más movimiento">
              <MiniBarChart
                data={departamentos.slice(0, 10).map((fila) => ({
                  label: fila.departamento,
                  value: Number(fila.cajas || 0) + Number(fila.unidades || 0),
                }))}
                valueLabel="total"
              />

              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Departamento</th>
                    <th style={thRight}>Cajas</th>
                    <th style={thRight}>Unid.</th>
                    <th style={thRight}>Veces</th>
                  </tr>
                </thead>
                <tbody>
                  {departamentos.length === 0 ? (
                    <FilaVacia columnas={5} />
                  ) : (
                    departamentos.slice(0, 20).map((fila) => (
                      <tr key={fila.departamento}>
                        <td style={td}>{fila.departamento}</td>
                        <td style={tdRight}>{formatearNumero(fila.cajas)}</td>
                        <td style={tdRight}>{formatearNumero(fila.unidades)}</td>
                        <td style={tdRight}>{formatearNumero(fila.veces_pedido)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>

            <Panel title="Artículos que más se piden" subtitle="Veces que aparecen en pedidos">
              <MiniBarChart
                data={topVecesPedido.slice(0, 10).map((fila) => ({
                  label: fila.nombre_articulo,
                  value: Number(fila.veces_pedido || 0),
                }))}
                valueLabel="veces"
              />

              <TablaArticulos filas={topVecesPedido} campo="veces_pedido" etiqueta="Veces" />
            </Panel>
          </section>

          <Panel title="Artículos más vendidos por cajas" subtitle="Suma de cajas del periodo seleccionado">
            <MiniBarChart
              data={topCajas.slice(0, 10).map((fila) => ({
                label: fila.nombre_articulo,
                value: Number(fila.cajas || 0),
              }))}
              valueLabel="cajas"
            />

            <TablaArticulos filas={topCajas} campo="cajas" etiqueta="Cajas" />
          </Panel>

          <Panel title="Artículos más vendidos por unidades" subtitle="Suma de unidades del periodo seleccionado">
            <MiniBarChart
              data={topUnidades.slice(0, 10).map((fila) => ({
                label: fila.nombre_articulo,
                value: Number(fila.unidades || 0),
              }))}
              valueLabel="unidades"
            />

            <TablaArticulos filas={topUnidades} campo="unidades" etiqueta="Unidades" />
          </Panel>
        </>
      )}

      {detallePedidoSeleccionado && (
        <DetallePedidoModal
          pedido={detallePedidoSeleccionado}
          onClose={() => setPedidoSeleccionado(null)}
        />
      )}
    </div>
  );
}

function DetallePedidoModal({ pedido, onClose }) {
  const [mensajeAccion, setMensajeAccion] = useState("");
  const telefonoWa = telefonoWhatsApp(pedido.customer_phone);

  useEffect(() => {
    function cerrarConEscape(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [onClose]);

  async function copiarPedido() {
    const texto = construirTextoPedido(pedido);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const area = document.createElement("textarea");
        area.value = texto;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      setMensajeAccion("Pedido copiado al portapapeles.");
    } catch (error) {
      console.error("No se pudo copiar el pedido:", error);
      setMensajeAccion("No se pudo copiar el pedido.");
    }
  }

  function imprimirPedido() {
    const ventana = window.open("", "_blank", "width=900,height=720");
    if (!ventana) {
      setMensajeAccion("El navegador ha bloqueado la ventana de impresión.");
      return;
    }

    const filas = pedido.lineas.map((linea) => `
      <tr>
        <td><strong>${escaparHtml(linea.nombre_articulo || "Artículo sin nombre")}</strong><br><small>${escaparHtml(linea.codigo_articulo || "—")}</small></td>
        <td>${escaparHtml(linea.departamento || "Sin departamento")}</td>
        <td class="numero">${escaparHtml(formatearNumero(linea.cajas))}</td>
        <td class="numero">${escaparHtml(formatearNumero(linea.unidades))}</td>
        <td>${linea.ruleta?.incluido ? (linea.ruleta.cumple ? "Válido para ruleta" : `Incluido; mínimo ${escaparHtml(formatearNumero(linea.ruleta.cantidadMinima))} ${linea.ruleta.permiteUnidades ? "uds." : "cajas"}`) : "—"}</td>
      </tr>`).join("");

    ventana.document.write(`<!doctype html>
      <html lang="es"><head><meta charset="utf-8"><title>Pedido ${escaparHtml(pedido.pedido_id)}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#111827;margin:32px} h1{font-size:22px;margin:0 0 8px} p{margin:4px 0;color:#475569}
        table{width:100%;border-collapse:collapse;margin-top:22px} th,td{border:1px solid #d1d5db;padding:10px;text-align:left} th{background:#f3f4f6}.numero{text-align:right}
        .resumen{display:flex;gap:24px;flex-wrap:wrap;margin-top:20px;font-weight:700}.cliente{margin-top:14px} small{color:#64748b}
        @media print{body{margin:12mm}}
      </style></head><body>
      <h1>Pedido ${escaparHtml(pedido.pedido_id)}</h1>
      <p>${escaparHtml(pedido.created_at ? new Date(pedido.created_at).toLocaleString("es-ES") : "Fecha no disponible")}</p>
      ${pedido.customer_name ? `<p class="cliente"><strong>Cliente:</strong> ${escaparHtml(pedido.customer_name)}</p>` : ""}
      ${pedido.customer_phone ? `<p><strong>Teléfono:</strong> ${escaparHtml(pedido.customer_phone)}</p>` : ""}
      <table><thead><tr><th>Artículo</th><th>Departamento</th><th>Cajas</th><th>Unidades</th><th>Promoción ruleta</th></tr></thead><tbody>${filas}</tbody></table>
      <div class="resumen"><span>Artículos: ${escaparHtml(formatearNumero(pedido.articulosDistintos))}</span><span>Líneas: ${escaparHtml(formatearNumero(pedido.totalLineas))}</span><span>Cajas: ${escaparHtml(formatearNumero(pedido.totalCajas))}</span><span>Unidades: ${escaparHtml(formatearNumero(pedido.totalUnidades))}</span></div>
      <script>window.addEventListener('load',()=>{window.print();});<\/script></body></html>`);
    ventana.document.close();
  }

  function abrirWhatsApp() {
    if (!telefonoWa) return;
    const mensaje = encodeURIComponent(`Hola${pedido.customer_name ? ` ${pedido.customer_name}` : ""}, te contactamos en relación con tu pedido ${pedido.pedido_id}.`);
    window.open(`https://wa.me/${telefonoWa}?text=${mensaje}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div style={modalOverlay} role="presentation" onMouseDown={onClose}>
      <section
        style={modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalle-pedido-titulo"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div style={modalHeader}>
          <div>
            <div style={modalEyebrow}>Detalle del pedido</div>
            <h2 id="detalle-pedido-titulo" style={modalTitle}>{pedido.pedido_id}</h2>
            <p style={modalDate}>
              {pedido.created_at ? new Date(pedido.created_at).toLocaleString("es-ES") : "Fecha no disponible"}
            </p>
            {(pedido.customer_name || pedido.customer_phone) && (
              <p style={modalCustomer}>
                {pedido.customer_name || "Cliente sin nombre"}
                {pedido.customer_phone ? ` · ${pedido.customer_phone}` : ""}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} style={closeButton} aria-label="Cerrar detalle">×</button>
        </div>

        <div style={modalStats}>
          <StatCard label="Artículos distintos" value={formatearNumero(pedido.articulosDistintos)} />
          <StatCard label="Líneas" value={formatearNumero(pedido.totalLineas)} />
          <StatCard label="Cajas" value={formatearNumero(pedido.totalCajas)} />
          <StatCard label="Unidades" value={formatearNumero(pedido.totalUnidades)} />
          <StatCard label="En promoción ruleta" value={formatearNumero(pedido.articulosRuleta.length)} accent="#7c3aed" />
          <StatCard label="Válidos para ruleta" value={formatearNumero(pedido.articulosRuletaValidos.length)} accent="#7c3aed" />
          <StatCard label="Bolas de Bingo" value={formatearNumero(pedido.bingoBolasCount || 0)} accent="#b45309" />
        </div>

        {pedido.bingoParticipa && (
          <div style={bingoSummary}>
            <div>
              <strong>🎱 Bingo</strong>
              <div style={smallText}>
                {pedido.bingoBolas?.length
                  ? "Bolas cantadas para este cliente, en el orden en que salieron:"
                  : "Este pedido tiene Bingo disponible, pero todavía no se ha extraído ninguna bola."}
              </div>
            </div>
            {pedido.bingoBolas?.length > 0 && (
              <div style={bingoBolasList}>
                {pedido.bingoBolas.map((bola, index) => (
                  <span key={`${bola.number}-${index}`} style={bingoBolaChip}>{bola.number}</span>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={ruletaSummary}>
          <div>
            <strong>🎡 Artículos de la promoción de ruleta</strong>
            <div style={smallText}>
              {pedido.promocionRuleta?.nombre || "Configuración actual de la ruleta"}.
              Los artículos marcados en verde cumplen la cantidad mínima; los amarillos pertenecen a la promoción pero no alcanzan el mínimo.
            </div>
          </div>
          <strong>{pedido.articulosRuletaValidos.length} válidos de {pedido.articulosRuleta.length} incluidos</strong>
        </div>

        <div style={modalTableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Artículo</th>
                <th style={th}>Departamento</th>
                <th style={thRight}>Cajas</th>
                <th style={thRight}>Unidades</th>
                <th style={th}>Promoción ruleta</th>
              </tr>
            </thead>
            <tbody>
              {pedido.lineas.length === 0 ? (
                <FilaVacia columnas={4} />
              ) : (
                pedido.lineas.map((linea) => (
                  <tr key={linea.id || `${linea.codigo_articulo}-${linea.nombre_articulo}`}>
                    <td style={td}>
                      <strong>{linea.nombre_articulo || "Artículo sin nombre"}</strong>
                      <div style={smallText}>Código: {linea.codigo_articulo || "—"}</div>
                    </td>
                    <td style={td}>{linea.departamento || "Sin departamento"}</td>
                    <td style={tdRightStrong}>{formatearNumero(linea.cajas)}</td>
                    <td style={tdRightStrong}>{formatearNumero(linea.unidades)}</td>
                    <td style={td}>
                      {!linea.ruleta?.incluido ? (
                        <span style={ruletaNoIncluido}>No incluido</span>
                      ) : linea.ruleta.cumple ? (
                        <span style={ruletaValido}>🎡 Válido</span>
                      ) : (
                        <span style={ruletaPendiente}>Mínimo: {formatearNumero(linea.ruleta.cantidadMinima)} {linea.ruleta.permiteUnidades ? "uds." : "cajas"}</span>
                      )}
                      {linea.ruleta?.incluido && (
                        <div style={ruletaOrigen}>Por {linea.ruleta.origen === "departamento" ? "departamento" : "artículo"}</div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={modalFooter}>
          <div>
            <span style={modalHint}>{mensajeAccion || "También puedes cerrar pulsando Esc o haciendo clic fuera."}</span>
            {!telefonoWa && <div style={whatsappHint}>WhatsApp no está disponible porque este pedido no tiene teléfono guardado.</div>}
          </div>
          <div style={modalActions}>
            <button type="button" onClick={imprimirPedido} style={secondaryAction}>📄 Imprimir pedido</button>
            <button type="button" onClick={abrirWhatsApp} style={telefonoWa ? whatsappAction : disabledAction} disabled={!telefonoWa} title={telefonoWa ? "Abrir conversación de WhatsApp" : "No hay teléfono guardado"}>📲 Abrir WhatsApp</button>
            <button type="button" onClick={copiarPedido} style={secondaryAction}>📋 Copiar pedido</button>
            <button type="button" onClick={onClose} style={modalCloseAction}>❌ Cerrar</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function agruparArticulos(filas, campoOrden) {
  const mapa = new Map();

  filas.forEach((fila) => {
    const key = String(fila.codigo_articulo || fila.nombre_articulo || "");
    const actual = mapa.get(key) || {
      codigo_articulo: fila.codigo_articulo || "",
      nombre_articulo: fila.nombre_articulo || "Sin nombre",
      departamento: fila.departamento || "",
      cajas: 0,
      unidades: 0,
      veces_pedido: 0,
    };

    actual.cajas += Number(fila.cajas || 0);
    actual.unidades += Number(fila.unidades || 0);
    actual.veces_pedido += 1;

    mapa.set(key, actual);
  });

  return Array.from(mapa.values()).sort((a, b) => {
    const principal = Number(b[campoOrden] || 0) - Number(a[campoOrden] || 0);
    if (principal !== 0) return principal;

    return String(a.nombre_articulo || "").localeCompare(
      String(b.nombre_articulo || ""),
      "es",
      { sensitivity: "base" }
    );
  });
}

function StatCard({ label, value, accent }) {
  return (
    <div style={statCard}>
      <div style={accent ? { ...statValue, color: accent } : statValue}>{value}</div>
      <div style={statLabel}>{label}</div>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section style={panel}>
      <div style={panelHeader}>
        <div>
          <h2 style={panelTitle}>{title}</h2>
          {subtitle && <p style={panelSubtitle}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function MiniBarChart({ data, valueLabel }) {
  const filas = (data || []).filter((fila) => Number(fila.value || 0) > 0).slice(0, 10);
  const max = Math.max(...filas.map((fila) => Number(fila.value || 0)), 0);

  if (!filas.length) {
    return <div style={chartEmpty}>Sin datos para gráfico</div>;
  }

  return (
    <div style={chartBox}>
      {filas.map((fila) => {
        const valor = Number(fila.value || 0);
        const width = max > 0 ? Math.max(6, (valor / max) * 100) : 0;

        return (
          <div key={fila.label} style={chartRow}>
            <div style={chartLabel} title={fila.label}>{fila.label}</div>
            <div style={chartTrack}>
              <div style={{ ...chartBar, width: `${width}%` }} />
            </div>
            <div style={chartValue}>
              {formatearNumero(valor)} {valueLabel}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TablaArticulos({ filas, campo, etiqueta }) {
  return (
    <div style={tableWrap}>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Artículo</th>
            <th style={th}>Departamento</th>
            <th style={thRight}>{etiqueta}</th>
            <th style={thRight}>Cajas</th>
            <th style={thRight}>Unid.</th>
            <th style={thRight}>Veces</th>
          </tr>
        </thead>

        <tbody>
          {filas.length === 0 ? (
            <FilaVacia columnas={6} />
          ) : (
            filas.map((fila) => (
              <tr key={`${fila.codigo_articulo}-${fila.nombre_articulo}`}>
                <td style={td}>
                  <strong>{fila.nombre_articulo}</strong>
                  <div style={smallText}>Código: {fila.codigo_articulo || "-"}</div>
                </td>
                <td style={td}>{fila.departamento || "—"}</td>
                <td style={tdRightStrong}>{formatearNumero(fila[campo])}</td>
                <td style={tdRight}>{formatearNumero(fila.cajas)}</td>
                <td style={tdRight}>{formatearNumero(fila.unidades)}</td>
                <td style={tdRight}>{formatearNumero(fila.veces_pedido)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function FilaVacia({ columnas }) {
  return (
    <tr>
      <td colSpan={columnas} style={emptyCell}>
        Sin datos en este periodo
      </td>
    </tr>
  );
}

const page = { minHeight: "100vh", padding: "24px", background: "linear-gradient(180deg, #eef2ff 0%, #f8fafc 38%, #ffffff 100%)", boxSizing: "border-box" };
const hero = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px", background: "linear-gradient(135deg, #111827 0%, #1d4ed8 48%, #2563eb 100%)", borderRadius: "24px", padding: "28px", color: "#ffffff", boxShadow: "0 22px 45px rgba(37,99,235,0.22)", marginBottom: "18px" };
const eyebrow = { display: "inline-block", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "999px", padding: "6px 12px", fontSize: "12px", fontWeight: "900", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "12px" };
const title = { margin: 0, fontSize: "34px", lineHeight: "1", fontWeight: "950" };
const subtitle = { margin: "10px 0 0", color: "#dbeafe", fontSize: "15px", maxWidth: "720px" };
const refreshButton = { background: "#22c55e", color: "#fff", border: "none", borderRadius: "16px", padding: "15px 22px", fontSize: "15px", fontWeight: "950", cursor: "pointer", boxShadow: "0 14px 26px rgba(34,197,94,0.28)", whiteSpace: "nowrap" };
const filtersBox = { display: "grid", gridTemplateColumns: "180px 180px 1fr", gap: "12px", alignItems: "end", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "16px", marginBottom: "18px", boxShadow: "0 10px 28px rgba(15,23,42,0.06)" };
const label = { display: "block", fontWeight: "900", marginBottom: "7px", color: "#334155", fontSize: "13px" };
const input = { width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #d1d5db", borderRadius: "13px", fontSize: "14px", outline: "none", background: "#ffffff" };
const filterActions = { display: "flex", gap: "8px", flexWrap: "wrap" };
const periodButton = { background: "#eff6ff", color: "#1d4ed8", border: "none", borderRadius: "13px", padding: "12px 14px", fontWeight: "950", cursor: "pointer" };
const activeFilterButton = { ...periodButton, background: "#22c55e", color: "#ffffff", boxShadow: "0 10px 20px rgba(34,197,94,0.24)" };
const applyButton = { background: "#111827", color: "#ffffff", border: "none", borderRadius: "13px", padding: "12px 14px", fontWeight: "950", cursor: "pointer" };
const activeApplyButton = { ...applyButton, background: "#2563eb" };
const statsGrid = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px", marginBottom: "18px" };
const statsGroups = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px", marginBottom: "18px" };
const statsGroup = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "14px", boxShadow: "0 10px 28px rgba(15,23,42,0.06)" };
const statsGroupLabel = { fontSize: "13px", fontWeight: "950", color: "#334155", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.03em" };
const statsGroupLabelRuleta = { color: "#6d28d9" };
const statsGroupLabelBingo = { color: "#b45309" };
const statsGroupCards = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "10px" };
const juegoLineaRuleta = { display: "flex", flexDirection: "column", marginBottom: "4px" };
const bingoBadge = { display: "inline-flex", alignItems: "center", padding: "5px 9px", borderRadius: "999px", background: "#fff7ed", color: "#9a3412", fontSize: "12px", fontWeight: "900", whiteSpace: "nowrap" };
const statCard = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "18px", padding: "16px", boxShadow: "0 10px 28px rgba(15,23,42,0.06)" };
const statValue = { fontSize: "28px", fontWeight: "950", color: "#111827", lineHeight: "1" };
const statLabel = { marginTop: "8px", fontSize: "12px", fontWeight: "850", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" };
const noticeBox = { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: "16px", padding: "13px 15px", marginBottom: "18px", fontSize: "13px" };
const gridTwo = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" };
const panel = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "22px", padding: "16px", boxShadow: "0 14px 35px rgba(15,23,42,0.07)", marginBottom: "18px" };
const panelHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", marginBottom: "14px" };
const panelTitle = { margin: 0, color: "#111827", fontSize: "20px", fontWeight: "950" };
const panelSubtitle = { margin: "5px 0 0", color: "#64748b", fontSize: "13px" };
const tableWrap = { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "18px", background: "#fff" };
const table = { width: "100%", borderCollapse: "separate", borderSpacing: 0 };
const th = { background: "#f8fafc", color: "#475569", textAlign: "left", padding: "13px 14px", fontSize: "12px", fontWeight: "950", borderBottom: "1px solid #e5e7eb", textTransform: "uppercase", whiteSpace: "nowrap" };
const thRight = { ...th, textAlign: "right" };
const td = { padding: "13px 14px", verticalAlign: "middle", fontSize: "14px", borderBottom: "1px solid #f1f5f9" };
const tdRight = { ...td, textAlign: "right", whiteSpace: "nowrap" };
const tdRightStrong = { ...tdRight, fontWeight: "950", color: "#1d4ed8" };
const emptyCell = { textAlign: "center", padding: "30px", color: "#94a3b8", fontWeight: "800" };
const smallText = { marginTop: "4px", color: "#64748b", fontSize: "12px" };
const chartBox = { border: "1px solid #e5e7eb", borderRadius: "16px", padding: "12px", marginBottom: "14px", background: "#f8fafc" };
const chartRow = { display: "grid", gridTemplateColumns: "160px 1fr 90px", gap: "10px", alignItems: "center", marginBottom: "8px" };
const chartLabel = { fontSize: "12px", fontWeight: "850", color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const chartTrack = { height: "11px", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden" };
const chartBar = { height: "100%", background: "linear-gradient(90deg, #1d4ed8, #60a5fa)", borderRadius: "999px" };
const chartValue = { textAlign: "right", fontSize: "11px", fontWeight: "950", color: "#1e293b" };
const chartEmpty = { border: "1px dashed #cbd5e1", borderRadius: "16px", padding: "20px", color: "#94a3b8", fontWeight: "850", textAlign: "center", marginBottom: "14px" };
const loadingBox = { padding: "30px", textAlign: "center", color: "#64748b", fontWeight: "900", background: "#ffffff", borderRadius: "16px" };
const errorBox = { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", padding: "16px", borderRadius: "18px", marginBottom: "18px" };

const orderButton = { border: "none", background: "transparent", color: "#1d4ed8", padding: 0, font: "inherit", fontWeight: "950", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px", textAlign: "left" };
const modalOverlay = { position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "rgba(15,23,42,0.72)", backdropFilter: "blur(5px)" };
const modalCard = { width: "min(980px, 100%)", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", background: "#ffffff", borderRadius: "24px", boxShadow: "0 35px 90px rgba(15,23,42,0.38)", border: "1px solid rgba(255,255,255,0.55)" };
const modalHeader = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", padding: "22px 24px", color: "#ffffff", background: "linear-gradient(135deg, #111827 0%, #1d4ed8 100%)" };
const modalEyebrow = { fontSize: "12px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.08em", color: "#bfdbfe", marginBottom: "7px" };
const modalTitle = { margin: 0, fontSize: "20px", lineHeight: 1.25, overflowWrap: "anywhere" };
const modalDate = { margin: "8px 0 0", color: "#dbeafe", fontSize: "14px" };
const modalCustomer = { margin: "8px 0 0", color: "#ffffff", fontSize: "14px", fontWeight: "800" };
const closeButton = { width: "42px", height: "42px", flex: "0 0 auto", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.12)", color: "#ffffff", fontSize: "28px", lineHeight: 1, cursor: "pointer" };
const modalStats = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: "10px", padding: "16px 20px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" };
const ruletaSummary = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px", margin: "16px 20px 0", padding: "14px 16px", borderRadius: "16px", border: "1px solid #c4b5fd", background: "#f5f3ff", color: "#4c1d95", flexWrap: "wrap" };
const bingoSummary = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px", margin: "12px 20px 0", padding: "14px 16px", borderRadius: "16px", border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412", flexWrap: "wrap" };
const bingoBolasList = { display: "flex", flexWrap: "wrap", gap: "6px", maxWidth: "420px" };
const bingoBolaChip = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "30px", height: "30px", borderRadius: "50%", background: "#fff", border: "2px solid #f4cf62", color: "#9a3412", fontWeight: "950", fontSize: "13px" };
const ruletaValido = { display: "inline-flex", alignItems: "center", padding: "5px 9px", borderRadius: "999px", background: "#dcfce7", color: "#166534", fontSize: "12px", fontWeight: "900", whiteSpace: "nowrap" };
const ruletaPendiente = { display: "inline-flex", alignItems: "center", padding: "5px 9px", borderRadius: "999px", background: "#fef3c7", color: "#92400e", fontSize: "12px", fontWeight: "900", whiteSpace: "nowrap" };
const ruletaNoIncluido = { color: "#94a3b8", fontSize: "12px", fontWeight: "750" };
const ruletaOrigen = { marginTop: "4px", color: "#64748b", fontSize: "10px", fontWeight: "750" };
const modalTableWrap = { overflow: "auto", margin: "18px 20px 0", border: "1px solid #e5e7eb", borderRadius: "16px" };
const modalFooter = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", padding: "16px 20px 20px", flexWrap: "wrap" };
const modalHint = { color: "#64748b", fontSize: "12px" };
const whatsappHint = { color: "#b45309", fontSize: "11px", marginTop: "4px", fontWeight: "750" };
const modalActions = { display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" };
const actionBase = { border: "none", borderRadius: "12px", padding: "11px 14px", fontWeight: "900", cursor: "pointer", whiteSpace: "nowrap" };
const secondaryAction = { ...actionBase, background: "#e2e8f0", color: "#0f172a" };
const whatsappAction = { ...actionBase, background: "#16a34a", color: "#ffffff" };
const disabledAction = { ...actionBase, background: "#e5e7eb", color: "#94a3b8", cursor: "not-allowed" };
const modalCloseAction = { ...actionBase, background: "#111827", color: "#ffffff" };
