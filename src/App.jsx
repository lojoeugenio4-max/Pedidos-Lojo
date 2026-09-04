import React, { useEffect, useMemo, useRef, useState } from "react";
import { flushSync, createPortal } from "react-dom";
import {
  ShoppingCart,
  Trash2,
  Send,
  Search,
  ChevronDown,
  Check,
  X,
  Star,
  Grid3X3,
  Download,
  Share,
  ArrowUp,
  Plus,
  Minus,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { supabaseStorage } from "./supabaseStorageClient";
import StorePage from "./pages/StorePage";
import DisplayPage from "./pages/DisplayPage";
import BingoDemo from "./pages/bingo/BingoDemo";
import BingoShow from "./pages/bingo/BingoShow";
import BingoCard from "./components/bingo/BingoCard";
import BingoDrum from "./components/bingo/BingoDrum";
import CelebracionPremio from "./components/sorteo/CelebracionPremio";
import logoLojo from "./assets/logo-lojo.jpg";
import {
  construirTextoPedidoWhatsApp,
  abrirPedidoEnWhatsApp,
} from "./utils/whatsappPedido";
import { calcularVentanaPedido, puedeEditarPedido } from "./utils/pedidoEdicion";
import { compararDepartamentosPedido } from "./utils/ordenDepartamentosPedido";

const WHATSAPP_NUMBER = "34670716744";
const ORDER_STORAGE_KEY = "cash-lojo-pedido";

// El carrito se guarda por cliente (según el token de su enlace personal),
// no en una única clave global. Antes, si en el mismo navegador/dispositivo
// se probaban dos clientes distintos (dos enlaces personales seguidos),
// el carrito de uno se colaba en el del otro al recargar, porque ambos
// leían y escribían la misma clave de localStorage.
function obtenerClaveOrderStorage(clienteToken) {
  return `${ORDER_STORAGE_KEY}:${clienteToken || "sin-cliente"}`;
}

const LANGUAGE_STORAGE_KEY = "cash-lojo-language";
const APP_INSTALLED_STORAGE_KEY = "cash-lojo-app-instalada";
const ORDER_STORAGE_VERSION = 3;
// Cuando el cliente elige "Hacer un pedido nuevo" en vez de modificar el
// pedido ya enviado, guardamos aquí el identificador (pedido_stats_id) de
// ESE pedido concreto que decidió dejar de lado. Así, si recarga la
// página antes de enviar el pedido nuevo, no se le vuelve a mostrar el
// aviso ni se le recarga el pedido anterior desde Supabase: solo se
// ignora ese pedido en particular, cualquier otro pedido previo distinto
// sigue avisando con normalidad.
const PEDIDO_IGNORADO_STORAGE_KEY = "cash-lojo-pedido-ignorado";

function obtenerClavePedidoIgnorado(clienteToken) {
  return `${PEDIDO_IGNORADO_STORAGE_KEY}:${clienteToken || "sin-cliente"}`;
}

function leerPedidoIgnorado(clienteToken) {
  try {
    return localStorage.getItem(obtenerClavePedidoIgnorado(clienteToken)) || null;
  } catch (error) {
    return null;
  }
}

function guardarPedidoIgnorado(clienteToken, pedidoStatsId) {
  try {
    if (pedidoStatsId) {
      localStorage.setItem(obtenerClavePedidoIgnorado(clienteToken), pedidoStatsId);
    } else {
      localStorage.removeItem(obtenerClavePedidoIgnorado(clienteToken));
    }
  } catch (error) {
    console.warn("No se pudo guardar el pedido ignorado:", error);
  }
}

function readSavedOrder(clienteToken) {
  try {
    const saved = localStorage.getItem(obtenerClaveOrderStorage(clienteToken));
    if (!saved) return {};

    const parsed = JSON.parse(saved);
    return {
      quantities: parsed?.quantities && typeof parsed.quantities === "object" ? parsed.quantities : {},
      customerName: typeof parsed?.customerName === "string" ? parsed.customerName : "",
      notes: typeof parsed?.notes === "string" ? parsed.notes : "",
      // A partir de la versión 2: si el pedido ya se envió por WhatsApp,
      // guardamos cuándo y hasta cuándo se puede seguir modificando, para
      // poder ofrecer al cliente reabrirlo y editarlo en vez de obligarle
      // a empezar uno nuevo.
      enviadoEn: typeof parsed?.enviadoEn === "string" ? parsed.enviadoEn : null,
      fechaLimiteEdicion:
        typeof parsed?.fechaLimiteEdicion === "string" ? parsed.fechaLimiteEdicion : null,
      // A partir de la versión 3: identificador estable del pedido para
      // Estadísticas. Se reutiliza en cada modificación para que el
      // pedido editado sustituya al anterior en vez de aparecer como uno
      // nuevo.
      pedidoStatsId: typeof parsed?.pedidoStatsId === "string" ? parsed.pedidoStatsId : null,
    };
  } catch (error) {
    console.warn("No se pudo recuperar el pedido guardado:", error);
    return {};
  }
}

function savePendingOrder({
  clienteToken,
  quantities,
  customerName,
  notes,
  enviadoEn,
  fechaLimiteEdicion,
  pedidoStatsId,
}) {
  try {
    localStorage.setItem(
      obtenerClaveOrderStorage(clienteToken),
      JSON.stringify({
        version: ORDER_STORAGE_VERSION,
        updatedAt: new Date().toISOString(),
        quantities,
        customerName,
        notes,
        enviadoEn: enviadoEn || null,
        fechaLimiteEdicion: fechaLimiteEdicion || null,
        pedidoStatsId: pedidoStatsId || null,
      })
    );
  } catch (error) {
    console.warn("No se pudo guardar el pedido pendiente:", error);
  }
}

const translations = {
  es: {
    language: "Idioma",
    title: "Pedido online Cash Lojo",
    subtitle:
      "Escribe cantidades en Unidades o Cajas, revisa el pedido y envíalo por WhatsApp.",
    customerName: "Nombre o referencia del cliente",
    optional: "Opcional",
    searchProduct: "Buscar artículo",
    searchPlaceholder: "Buscar...",
    department: "Departamento",
    allDepartments: "Todos los departamentos",
    tapToChangeDepartment: "Toca para cambiar de departamento",
    articles: "artículos",
    noItems: "Sin artículos",
    noPhoto: "Sin foto",
    boxes: "Cajas",
    boxesLower: "cajas",
    units: "Unidades Sueltas",
    unitsLower: "unidades",
    notes: "Observaciones",
    summary: "Resumen",
    itemsWithQuantity: "artículos con cantidad",
    review: "Revisar",
    andSend: "y Enviar",
    reviewAndSend: "Revisar y Enviar",
    clearOrder: "Borrar pedido",
    orderSummary: "Resumen del pedido",
    customer: "Cliente",
    noItemsWithQuantity: "No hay artículos con cantidad.",
    sendByWhatsApp: "Enviar por WhatsApp",
    back: "↩ Volver",
    close: "Cerrar",
    newOrder: "Nuevo pedido",
    sentFrom: "Enviado desde el formulario de pedidos",
    alertEmpty: "Introduce al menos una cantidad antes de enviar el pedido.",
    loading: "Cargando artículos...",
    offers: "Ofertas",
    news: "Novedad",
    searchedArticles: "Artículos buscados",
    catalogError: "Error cargando catálogo.",
    onlyBoxes: "Solo por cajas",
    avisoModificacionTitulo: "Ya tienes un pedido enviado hoy",
    avisoModificacionTexto:
      "Todavía estás a tiempo de modificarlo. Al continuar vas a editar el pedido que ya enviaste por WhatsApp; al enviarlo de nuevo, sustituirá al anterior. Si lo que quieres es hacer un pedido distinto, puedes empezar uno nuevo en su lugar.",
    avisoModificacionSeguir: "Continuar modificando este pedido",
    avisoModificacionNuevo: "Hacer un pedido nuevo",
    pushRecordatorioTitulo: "📦 Tienes un pedido enviado",
    pushRecordatorioTexto:
      "Todavía no se ha impreso. Si has olvidado algo, puedes seguir añadiendo artículos a tu pedido.",
    pushRecordatorioAceptar: "Aceptar",
  },
  zh: {
    language: "语言",
    title: "Cash Lojo 在线下单",
    subtitle: "请输入箱数或件数，确认订单后通过 WhatsApp 发送。",
    customerName: "客户姓名或备注",
    optional: "可选",
    searchProduct: "搜索商品",
    searchPlaceholder: "搜索...",
    department: "分类",
    allDepartments: "全部分类",
    tapToChangeDepartment: "点击更换分类",
    articles: "个商品",
    noItems: "没有商品",
    noPhoto: "无图片",
    boxes: "箱",
    boxesLower: "箱",
    units: "散件",
    unitsLower: "件",
    notes: "备注",
    summary: "订单摘要",
    itemsWithQuantity: "个已选商品",
    review: "查看",
    andSend: "并发送",
    reviewAndSend: "查看并发送",
    clearOrder: "清空订单",
    orderSummary: "订单摘要",
    customer: "客户",
    noItemsWithQuantity: "没有已填写数量的商品。",
    sendByWhatsApp: "通过 WhatsApp 发送",
    back: "↩ 返回",
    close: "关闭",
    newOrder: "新订单",
    sentFrom: "通过订货表单发送",
    alertEmpty: "发送订单前请至少输入一个数量。",
    loading: "正在加载商品...",
    offers: "优惠",
    news: "新品",
    searchedArticles: "搜索到的商品",
    catalogError: "加载商品出错。",
    onlyBoxes: "只能按箱订购",
    avisoModificacionTitulo: "您今天已经提交过一个订单",
    avisoModificacionTexto:
      "您仍可以修改该订单。继续操作将修改您已通过 WhatsApp 发送的订单，再次发送后会替换之前的订单。如果您想下一个不同的新订单，也可以选择新建一个订单。",
    avisoModificacionSeguir: "继续修改此订单",
    avisoModificacionNuevo: "新建一个订单",
    pushRecordatorioTitulo: "📦 您有一个已发送的订单",
    pushRecordatorioTexto: "该订单尚未打印。如果您忘记添加什么，仍可以继续往订单里添加商品。",
    pushRecordatorioAceptar: "确定",
  },
};

const departmentTranslations = {
  zh: {
    TODOS: "全部分类",
    OFERTAS: "优惠",
    NOVEDAD: "新品",
    "ARTÍCULOS BUSCADOS": "搜索到的商品",
    AGUA: "水",
    CERVEZAS: "啤酒",
    "REFRESCOS LATAS": "罐装饮料",
    "REFRESCOS 2L / 1.5L": "大瓶饮料 2L / 1.5L",
    ENERGÉTICAS: "能量饮料",
    "VINOS Y LICORES": "葡萄酒和烈酒",
    PIZZAS: "披萨",
    "CHARCUTERÍA LONCHEADA": "切片熟食",
    APERITIVOS: "零食小吃",
    "LECHES Y BATIDOS/CAFÉS/LÁCTEOS": "牛奶/奶昔/咖啡/乳制品",
    ZUMOS: "果汁",
    ALIMENTACIÓN: "食品",
    DROGUERIA: "清洁日用品",
    "CHARCUTERÍA CORTE": "熟食切块",
    VARIOS: "其他",
  },
};

function getDepartmentLabel(departmentName, language) {
  if (language !== "zh") return departmentName;
  return departmentTranslations.zh[departmentName] || departmentName;
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizePromoValue(value) {
  return normalizeText(value).replace(/[^a-z0-9ñ]/gi, "");
}


function buscarReglaBingoParaItem(item, reglas = []) {
  const articuloIdPedido = item?.product?.id;
  if (articuloIdPedido === null || articuloIdPedido === undefined) return null;

  return reglas.find(
    (regla) => String(regla.articuloId) === String(articuloIdPedido)
  ) || null;
}

function productMatchesSearch(product, searchText) {
  const normalizedProduct = normalizeText(
    `${product.codigo || ""} ${product.nombre || ""} ${product.offerText || ""}`
  );

  const searchWords = normalizeText(searchText)
    .split(/[^a-z0-9ñ]+/i)
    .filter(Boolean);

  return searchWords.every((searchWord) =>
    normalizedProduct.includes(searchWord)
  );
}

function getPublicPhotoUrl(fileName) {
  if (!fileName) return "";

  const { data } = supabaseStorage.storage
    .from("productos")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

function getOfferStatus(offer) {
  if (!offer) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = offer.fecha_inicio ? new Date(offer.fecha_inicio) : null;
  const end = offer.fecha_fin ? new Date(offer.fecha_fin) : null;

  if (start && start > today) return "programada";
  if (end && end < today) return "caducada";
  return "activa";
}

function getActiveOffer(offers) {
  if (!Array.isArray(offers) || offers.length === 0) return null;

  return (
    offers.find((offer) => getOfferStatus(offer) === "activa") ||
    offers[0]
  );
}

function getTodayISO() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function obtenerCantidadMinimaRuletaArticulo(item) {
  const candidatos = [
    item?.cantidad_minima,
    item?.unidades_minimas,
    item?.unidades_minima,
    item?.minimo_unidades,
    item?.cantidad_minima_articulo,
    item?.cantidadMinima,
  ]
    .map((valor) => Number(String(valor ?? "").replace(",", ".")))
    .filter((valor) => Number.isFinite(valor) && valor > 0);

  return Math.max(1, ...candidatos);
}

function MiniRuletaPromocion({ cantidadMinima = 1, permiteUnidades = true }) {
  const minimo = Math.max(1, Number(cantidadMinima || 1));
  const unidadMinima = permiteUnidades ? "ud." : "cajas";

  return (
    <div style={styles.ruletaPromoBadge} aria-label={`Ruleta, mínimo ${minimo} ${unidadMinima}`}>
      <img
        src="/productos/Ruleta.webp"
        alt="Ruleta"
        style={styles.ruletaPromoImage}
      />
      <span style={styles.ruletaPromoText}>Ruleta</span>
      <span style={styles.ruletaPromoMinimo}>Mín. {minimo} {unidadMinima}</span>
    </div>
  );
}

function MiniBingoPromocion({ cantidadMinima = 1, permiteUnidades = true }) {
  const minimo = Math.max(1, Number(cantidadMinima || 1));
  const unidadMinima = permiteUnidades ? "ud." : "cajas";

  return (
    <div style={styles.ruletaPromoBadge} aria-label={`Bingo, mínimo ${minimo} ${unidadMinima}`}>
      <span style={styles.bingoBallIcono}><b style={styles.bingoBallNumero}>8</b></span>
      <span style={styles.ruletaPromoText}>Bingo</span>
      <span style={styles.ruletaPromoMinimo}>Mín. {minimo} {unidadMinima}</span>
    </div>
  );
}

// Cuando un artículo participa en Ruleta Y en Bingo a la vez, en vez de
// mostrar dos pastillas de 132px una junto a otra (satura la ficha), se
// muestra una sola pastilla con las dos líneas compactas. Si solo
// participa en una de las dos, se mantiene el mismo aspecto de siempre.
function MiniPromocionesBadge({
  participaRuleta,
  cantidadMinimaRuleta,
  permiteUnidadesRuleta = true,
  participaBingo,
  cantidadMinimaBingo,
  permiteUnidadesBingo = true,
  mostrarBingo = false,
}) {
  // El Bingo es exclusivo de clientes identificados (entran con su enlace
  // personal): a un visitante anónimo nunca se le debe insinuar que existe.
  const bingoVisible = participaBingo && mostrarBingo;

  if (!participaRuleta && !bingoVisible) return null;

  if (participaRuleta && !bingoVisible) {
    return <MiniRuletaPromocion cantidadMinima={cantidadMinimaRuleta} permiteUnidades={permiteUnidadesRuleta} />;
  }

  if (bingoVisible && !participaRuleta) {
    return <MiniBingoPromocion cantidadMinima={cantidadMinimaBingo} permiteUnidades={permiteUnidadesBingo} />;
  }

  const minRuleta = Math.max(1, Number(cantidadMinimaRuleta || 1));
  const unidadRuleta = permiteUnidadesRuleta ? "ud." : "cajas";
  const minBingo = Math.max(1, Number(cantidadMinimaBingo || 1));
  const unidadBingo = permiteUnidadesBingo ? "ud." : "cajas";

  return (
    <div
      style={styles.promoBadgeDoble}
      aria-label={`Ruleta, mínimo ${minRuleta} ${unidadRuleta}; Bingo, mínimo ${minBingo} ${unidadBingo}`}
    >
      <div style={styles.promoBadgeDobleFila}>
        <img src="/productos/Ruleta.webp" alt="Ruleta" style={styles.promoBadgeDobleIcono} />
        <span style={styles.promoBadgeDobleTexto}>Ruleta</span>
        <span style={styles.promoBadgeDobleMinimo}>Mín. {minRuleta} {unidadRuleta}</span>
      </div>
      <div style={styles.promoBadgeDobleDivisor} />
      <div style={styles.promoBadgeDobleFila}>
        <span style={styles.promoBadgeDobleIconoEmoji}><b style={styles.bingoBallNumeroChico}>8</b></span>
        <span style={styles.promoBadgeDobleTexto}>Bingo</span>
        <span style={styles.promoBadgeDobleMinimo}>Mín. {minBingo} {unidadBingo}</span>
      </div>
    </div>
  );
}


function crearCartonBingo90() {
  // Cartón clásico: 3 filas, 9 columnas y 15 números (5 por fila).
  // Cada columna conserva su decena y sus números quedan ordenados.
  for (let intento = 0; intento < 200; intento += 1) {
    const posiciones = Array.from({ length: 3 }, () => Array(9).fill(false));
    const filasUsadas = [0, 0, 0];
    const columnasUsadas = Array(9).fill(0);

    // Garantiza al menos un número en cada columna.
    const columnasBarajadas = Array.from({ length: 9 }, (_, i) => i).sort(
      () => Math.random() - 0.5
    );

    columnasBarajadas.forEach((columna) => {
      const filasDisponibles = [0, 1, 2]
        .filter((fila) => filasUsadas[fila] < 5)
        .sort(() => Math.random() - 0.5);
      const fila = filasDisponibles[0];
      posiciones[fila][columna] = true;
      filasUsadas[fila] += 1;
      columnasUsadas[columna] += 1;
    });

    let seguridad = 0;
    while (filasUsadas.some((cantidad) => cantidad < 5) && seguridad < 300) {
      seguridad += 1;
      const filasPendientes = [0, 1, 2].filter((fila) => filasUsadas[fila] < 5);
      const fila = filasPendientes[Math.floor(Math.random() * filasPendientes.length)];
      const columnasDisponibles = Array.from({ length: 9 }, (_, i) => i).filter(
        (columna) => !posiciones[fila][columna] && columnasUsadas[columna] < 3
      );

      if (columnasDisponibles.length === 0) break;
      const columna =
        columnasDisponibles[Math.floor(Math.random() * columnasDisponibles.length)];
      posiciones[fila][columna] = true;
      filasUsadas[fila] += 1;
      columnasUsadas[columna] += 1;
    }

    if (!filasUsadas.every((cantidad) => cantidad === 5)) continue;

    const carton = Array.from({ length: 3 }, () => Array(9).fill(null));

    for (let columna = 0; columna < 9; columna += 1) {
      const minimo = columna === 0 ? 1 : columna * 10;
      const maximo = columna === 8 ? 90 : columna * 10 + 9;
      const cantidad = columnasUsadas[columna];
      const numeros = [];

      while (numeros.length < cantidad) {
        const numero = minimo + Math.floor(Math.random() * (maximo - minimo + 1));
        if (!numeros.includes(numero)) numeros.push(numero);
      }

      numeros.sort((a, b) => a - b);
      const filasColumna = [0, 1, 2].filter((fila) => posiciones[fila][columna]);
      filasColumna.forEach((fila, indice) => {
        carton[fila][columna] = numeros[indice];
      });
    }

    return carton;
  }

  throw new Error("No se pudo generar el cartón de Bingo.");
}

export default function App() {
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;

  const isStoreMode = searchParams?.get("store") === "1";
  const isDisplayMode = searchParams?.get("display") === "1";
  const isBingoMode = searchParams?.get("bingo") === "1";
  const isBingoDisplayMode = searchParams?.get("bingoDisplay") === "1";

  const clienteToken =
    typeof window !== "undefined" && window.location.pathname.startsWith("/cliente/")
      ? decodeURIComponent(window.location.pathname.slice("/cliente/".length)).trim()
      : "";

  if (isDisplayMode) {
    return <DisplayPage />;
  }

  if (isBingoDisplayMode) {
    return <BingoShow />;
  }

  if (isBingoMode) {
    return <BingoDemo />;
  }

  if (isStoreMode) {
    return <StorePage />;
  }

  const rowRefs = useRef({});
  const cajasInputRefs = useRef({});
  const departmentDropdownRef = useRef(null);
  const stickyCardRef = useRef(null);
  const searchInputRef = useRef(null);

  const [savedOrder] = useState(() => readSavedOrder(clienteToken));

  const [articulos, setArticulos] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [pushOferta, setPushOferta] = useState(null);
  const [pushCerrado, setPushCerrado] = useState(false);
  const [mostrarVolverPush, setMostrarVolverPush] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [errorCatalogo, setErrorCatalogo] = useState("");

  const [quantities, setQuantities] = useState(() => savedOrder.quantities || {});
  const [customerName, setCustomerName] = useState(() => savedOrder.customerName || "");
  const [customerNameFocused, setCustomerNameFocused] = useState(false);
  const [soloCajasAviso, setSoloCajasAviso] = useState(null);
  const [notes, setNotes] = useState(() => savedOrder.notes || "");

  // Modificación de un pedido ya enviado (mientras siga dentro de plazo,
  // hasta las 4:00 AM del día de preparación). "pedidoEnviadoActivo"
  // indica que el pedido actual en pantalla ya se mandó por WhatsApp y,
  // si se envía de nuevo, sustituye al anterior. "avisoPedidoPrevio"
  // controla el aviso que se muestra antes de dejar editar.
  const [pedidoEnviadoActivo, setPedidoEnviadoActivo] = useState(() =>
    Boolean(
      savedOrder.enviadoEn &&
        puedeEditarPedido(savedOrder.fechaLimiteEdicion, new Date())
    )
  );
  const [pedidoEnviadoEn, setPedidoEnviadoEn] = useState(() => savedOrder.enviadoEn || null);
  const [pedidoFechaLimiteEdicion, setPedidoFechaLimiteEdicion] = useState(
    () => savedOrder.fechaLimiteEdicion || null
  );
  // Identificador estable del pedido para Estadísticas: se reutiliza en
  // cada modificación (en vez de generar uno nuevo) para que las filas
  // de estadisticas_movimientos se sustituyan y no aparezcan como un
  // segundo pedido del mismo cliente.
  const [pedidoStatsIdActual, setPedidoStatsIdActual] = useState(
    () => savedOrder.pedidoStatsId || null
  );
  const [avisoPedidoPrevio, setAvisoPedidoPrevio] = useState(null);
  const [confirmarPedidoNuevo, setConfirmarPedidoNuevo] = useState(false);
  const [comprobandoPedidoPrevio, setComprobandoPedidoPrevio] = useState(false);
  // Aviso destacado (tipo push, con botón "Aceptar") que confirma al
  // cliente, justo después de ENVIAR una modificación, que su pedido
  // sigue pudiéndose seguir editando. (No se muestra al elegir "seguir
  // modificando" en el aviso de pedido previo — sería repetir la misma
  // información dos veces seguidas.)
  const [pushRecordatorioModificacion, setPushRecordatorioModificacion] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("TODOS");
  const [articuloDestacado, setArticuloDestacado] = useState(null);
  const [fichaProductoId, setFichaProductoId] = useState(null);
  const [campoCantidadActivo, setCampoCantidadActivo] = useState(null);
  const [departmentDropdownOpen, setDepartmentDropdownOpen] = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [logoError, setLogoError] = useState(false);
  const [language, setLanguage] = useState(
    () => localStorage.getItem(LANGUAGE_STORAGE_KEY) || "es"
  );
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const bloqueColapsoCabeceraRef = useRef(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [mostrarAyudaInstalacion, setMostrarAyudaInstalacion] = useState(false);
  const [appInstalada, setAppInstalada] = useState(() => {
    if (typeof window === "undefined") return false;

    const abiertaComoApp =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    const instalacionGuardada =
      localStorage.getItem(APP_INSTALLED_STORAGE_KEY) === "true";

    return Boolean(abiertaComoApp || instalacionGuardada);
  });

  // El acceso identificado es opcional. Sin token, la aplicación sigue
  // funcionando exactamente igual para clientes anónimos.
  const [clienteIdentificado, setClienteIdentificado] = useState(null);
  const [premioSorteoPendiente, setPremioSorteoPendiente] = useState(null);
  const [cargandoCliente, setCargandoCliente] = useState(Boolean(clienteToken));
  const [favoritos, setFavoritos] = useState(() => new Set());
  const [cargandoFavoritos, setCargandoFavoritos] = useState(false);
  const [errorFavoritos, setErrorFavoritos] = useState("");
  const [soloFavoritos, setSoloFavoritos] = useState(false);
  const [mostrarBingo, setMostrarBingo] = useState(false);
  const [cartonBingo, setCartonBingo] = useState(null);
  const [cargandoBingo, setCargandoBingo] = useState(false);
  const [errorBingo, setErrorBingo] = useState("");
  const [premiosBingo, setPremiosBingo] = useState({ line: null, lineSpecial: null, bingo: null, special: null });
  const [configuracionBingoCliente, setConfiguracionBingoCliente] = useState(null);
  const [articulosBingoCliente, setArticulosBingoCliente] = useState([]);
  const [fechaLimiteBingoPropia, setFechaLimiteBingoPropia] = useState(null);

  // Sorteo: en construcción, solo activo para el cliente de pruebas
  // (clienteIdentificado.es_pruebas) mientras se valida en real. Nada
  // de esto se muestra ni se registra para el resto de clientes.
  const [configuracionSorteoCliente, setConfiguracionSorteoCliente] = useState(null);
  const [departamentosSorteoCliente, setDepartamentosSorteoCliente] = useState([]);
  const [mostrarJuegos, setMostrarJuegos] = useState(false);
  const [mostrarMiSorteo, setMostrarMiSorteo] = useState(false);
  const [numerosSorteoCliente, setNumerosSorteoCliente] = useState([]);
  const [cargandoSorteo, setCargandoSorteo] = useState(false);
  const [errorSorteo, setErrorSorteo] = useState("");

  const [premiosRuleta, setPremiosRuleta] = useState([]);
  const [configuracionRuleta, setConfiguracionRuleta] = useState(null);
  const [articulosRuleta, setArticulosRuleta] = useState([]);
  const [departamentosRuleta, setDepartamentosRuleta] = useState([]);

  const t = translations[language];

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    const estaAbiertaComoApp = () =>
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    const marcarInstalada = () => {
      localStorage.setItem(APP_INSTALLED_STORAGE_KEY, "true");
      setAppInstalada(true);
      setInstallPrompt(null);
      setMostrarAyudaInstalacion(false);
    };

    const comprobarModoAplicacion = () => {
      if (estaAbiertaComoApp()) marcarInstalada();
    };

    const guardarPrompt = (event) => {
      event.preventDefault();

      // Si ya se confirmó o detectó la instalación, nunca volvemos a mostrarla.
      if (localStorage.getItem(APP_INSTALLED_STORAGE_KEY) === "true") return;
      setInstallPrompt(event);
    };

    comprobarModoAplicacion();
    window.addEventListener("beforeinstallprompt", guardarPrompt);
    window.addEventListener("appinstalled", marcarInstalada);
    window.addEventListener("pageshow", comprobarModoAplicacion);
    document.addEventListener("visibilitychange", comprobarModoAplicacion);

    return () => {
      window.removeEventListener("beforeinstallprompt", guardarPrompt);
      window.removeEventListener("appinstalled", marcarInstalada);
      window.removeEventListener("pageshow", comprobarModoAplicacion);
      document.removeEventListener("visibilitychange", comprobarModoAplicacion);
    };
  }, []);

  function confirmarAplicacionInstalada() {
    localStorage.setItem(APP_INSTALLED_STORAGE_KEY, "true");
    setAppInstalada(true);
    setInstallPrompt(null);
    setMostrarAyudaInstalacion(false);
  }

  async function instalarAplicacion() {
    if (installPrompt) {
      await installPrompt.prompt();
      const resultado = await installPrompt.userChoice;
      if (resultado.outcome === "accepted") confirmarAplicacionInstalada();
      setInstallPrompt(null);
      return;
    }

    setMostrarAyudaInstalacion(true);
  }

  useEffect(() => {
    let cancelado = false;

    async function identificarCliente() {
      if (!clienteToken) {
        setClienteIdentificado(null);
        setCargandoCliente(false);
        return;
      }

      setCargandoCliente(true);

      try {
        const { data, error } = await supabase
          .from("clientes")
          .select("id, nombre, telefono, estado, token, es_pruebas")
          .eq("token", clienteToken)
          .maybeSingle();

        if (error) throw error;
        if (cancelado) return;

        if (data?.estado === "activo") {
          setClienteIdentificado(data);
          setCustomerName(data.nombre || "");
        } else {
          // Token inexistente o cliente inactivo: no se identifica. Más
          // abajo esto hace que se muestre la pantalla de "enlace no
          // válido" en vez de dejar comprar de forma anónima.
          setClienteIdentificado(null);
        }
      } catch (error) {
        console.error("No se pudo identificar al cliente:", error);
        if (!cancelado) setClienteIdentificado(null);
      } finally {
        if (!cancelado) setCargandoCliente(false);
      }
    }

    identificarCliente();

    return () => {
      cancelado = true;
    };
  }, [clienteToken]);

  useEffect(() => {
    let cancelado = false;

    async function comprobarPremioSorteoPendiente() {
      if (!clienteIdentificado?.token) return;

      try {
        const { data, error } = await supabase.rpc("obtener_premio_sorteo_pendiente", {
          p_token: clienteIdentificado.token,
        });
        if (error) throw error;
        if (cancelado) return;

        const premio = Array.isArray(data) ? data[0] : data;
        if (premio?.edition_id) setPremioSorteoPendiente(premio);
      } catch (error) {
        console.error("No se pudo comprobar si hay un premio de Sorteo pendiente:", error);
      }
    }

    comprobarPremioSorteoPendiente();

    return () => {
      cancelado = true;
    };
  }, [clienteIdentificado?.token]);

  async function cerrarCelebracionPremioSorteo() {
    const premio = premioSorteoPendiente;
    setPremioSorteoPendiente(null);
    if (!premio?.edition_id || !clienteIdentificado?.token) return;

    try {
      const { error } = await supabase.rpc("marcar_premio_sorteo_visto", {
        p_edition_id: premio.edition_id,
        p_cliente_token: clienteIdentificado.token,
      });
      if (error) throw error;
    } catch (error) {
      console.error("No se pudo marcar el premio de Sorteo como visto:", error);
    }
  }

  useEffect(() => {
    let cancelado = false;

    async function cargarFavoritos() {
      if (!clienteIdentificado?.id) {
        setFavoritos(new Set());
        setSoloFavoritos(false);
        setErrorFavoritos("");
        return;
      }

      setCargandoFavoritos(true);
      setErrorFavoritos("");

      try {
        const { data, error } = await supabase
          .from("clientes_favoritos")
          .select("articulo_id")
          .eq("cliente_id", clienteIdentificado.id);

        if (error) throw error;
        if (!cancelado) {
          setFavoritos(new Set((data || []).map((item) => String(item.articulo_id))));
        }
      } catch (error) {
        console.error("No se pudieron cargar los favoritos:", error);
        if (!cancelado) {
          setErrorFavoritos("No se pudieron cargar tus favoritos.");
          setFavoritos(new Set());
        }
      } finally {
        if (!cancelado) setCargandoFavoritos(false);
      }
    }

    cargarFavoritos();

    return () => {
      cancelado = true;
    };
  }, [clienteIdentificado]);

  // Al cargar, comprobamos si ya había un pedido enviado hoy y todavía
  // dentro de plazo para modificarse. Si es así, avisamos al cliente
  // antes de dejarle tocar nada. Si el plazo ya pasó, lo limpiamos en
  // silencio y se comporta como un pedido nuevo, igual que antes.
  useEffect(() => {
    if (cargandoCliente) return;

    let cancelado = false;

    async function comprobarPedidoPrevio() {
      const ahora = new Date();
      // Pedido concreto que el cliente ya descartó explícitamente
      // (botón "Hacer un pedido nuevo"). Si es el mismo que encontramos
      // aquí, no se recupera ni se vuelve a avisar de él.
      const pedidoIgnoradoId = leerPedidoIgnorado(clienteToken);

      if (savedOrder.enviadoEn && !puedeEditarPedido(savedOrder.fechaLimiteEdicion, ahora)) {
        limpiarPedidoDespuesEnvio();
        return;
      }

      const savedOrderIgnorado =
        pedidoIgnoradoId &&
        (savedOrder.pedidoStatsId === pedidoIgnoradoId ||
          savedOrder.enviadoEn === pedidoIgnoradoId);

      let pedidoPrevio =
        !savedOrderIgnorado &&
        savedOrder.enviadoEn &&
        puedeEditarPedido(savedOrder.fechaLimiteEdicion, ahora)
          ? { enviadoEn: savedOrder.enviadoEn }
          : null;

      // Se guarda aparte (no como estado de React) porque este mismo id
      // puede acabar de determinarse unas líneas más abajo (si venía de
      // Supabase) y el estado pedidoStatsIdActual todavía no se habría
      // actualizado en este mismo ciclo de la función.
      let pedidoStatsIdParaComprobar = pedidoPrevio ? savedOrder.pedidoStatsId || null : null;

      if (clienteIdentificado?.id) {
        setComprobandoPedidoPrevio(true);
        try {
          const { data, error } = await supabase
            .from("pedidos_actuales")
            .select(
              "quantities, customer_name, notes, enviado_en, fecha_limite_edicion, pedido_stats_id"
            )
            .eq("cliente_id", clienteIdentificado.id)
            .maybeSingle();

          if (error) throw error;
          if (cancelado) return;

          const dataIgnorada =
            pedidoIgnoradoId &&
            (data?.pedido_stats_id === pedidoIgnoradoId ||
              data?.enviado_en === pedidoIgnoradoId);

          if (
            data &&
            !dataIgnorada &&
            puedeEditarPedido(data.fecha_limite_edicion, ahora) &&
            !pedidoPrevio
          ) {
            // No había nada guardado en este navegador: recuperamos el
            // pedido desde Supabase para poder seguir editándolo aquí
            // (por ejemplo, si lo envió desde otro dispositivo).
            setQuantities(
              data.quantities && typeof data.quantities === "object" ? data.quantities : {}
            );
            setCustomerName(data.customer_name || "");
            setNotes(data.notes || "");
            setPedidoEnviadoEn(data.enviado_en);
            setPedidoFechaLimiteEdicion(data.fecha_limite_edicion);
            setPedidoStatsIdActual(data.pedido_stats_id || null);
            pedidoPrevio = { enviadoEn: data.enviado_en };
            pedidoStatsIdParaComprobar = data.pedido_stats_id || null;
          }
        } catch (error) {
          console.error("No se pudo comprobar si había un pedido previo:", error);
        } finally {
          if (!cancelado) setComprobandoPedidoPrevio(false);
        }
      }

      // Aunque el pedido siga dentro del plazo horario de modificación, si
      // su QR ya se pasó por caja (se jugó Ruleta/Bingo/Sorteo, aunque sea
      // solo una parte), ya no tiene sentido ofrecer "modificar": el
      // pedido ya se atendió en tienda, y modificarlo generaría un QR
      // distinto que no se correspondería con lo que ya se validó en caja.
      // En ese caso se trata directamente como un pedido nuevo, sin avisar.
      if (pedidoPrevio && !cancelado) {
        const pedidoStatsIdParaComprobarFinal = pedidoStatsIdParaComprobar;
        if (pedidoStatsIdParaComprobarFinal) {
          try {
            const { data: entitlement, error: entitlementError } = await supabase
              .from("game_entitlements")
              .select("roulette_plays_used, bingo_plays_used, sorteo_revelado")
              .eq("order_id", pedidoStatsIdParaComprobarFinal)
              .maybeSingle();

            if (entitlementError) throw entitlementError;

            const yaValidado = Boolean(
              entitlement &&
                (Number(entitlement.roulette_plays_used || 0) > 0 ||
                  Number(entitlement.bingo_plays_used || 0) > 0 ||
                  entitlement.sorteo_revelado === true)
            );

            if (yaValidado) {
              if (!cancelado) limpiarPedidoDespuesEnvio();
              return;
            }
          } catch (error) {
            console.error("No se pudo comprobar si el QR del pedido previo ya se validó:", error);
            // Ante la duda (fallo de red, etc.) se sigue ofreciendo modificar,
            // igual que se hacía antes de esta comprobación.
          }
        }
      }

      if (pedidoPrevio && !cancelado) {
        setPedidoEnviadoActivo(true);
        setAvisoPedidoPrevio(pedidoPrevio);
      }
    }

    comprobarPedidoPrevio();

    return () => {
      cancelado = true;
    };
  }, [cargandoCliente, clienteIdentificado?.id]);

  async function alternarFavorito(articuloId) {
    if (!clienteIdentificado?.id) return;

    const idArticulo = String(articuloId);
    const yaEsFavorito = favoritos.has(idArticulo);

    setErrorFavoritos("");
    setFavoritos((actuales) => {
      const siguientes = new Set(actuales);
      if (yaEsFavorito) siguientes.delete(idArticulo);
      else siguientes.add(idArticulo);
      return siguientes;
    });

    try {
      if (yaEsFavorito) {
        const { error } = await supabase
          .from("clientes_favoritos")
          .delete()
          .eq("cliente_id", clienteIdentificado.id)
          .eq("articulo_id", idArticulo);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clientes_favoritos").insert({
          cliente_id: clienteIdentificado.id,
          articulo_id: idArticulo,
        });
        if (error) throw error;
      }
    } catch (error) {
      console.error("No se pudo actualizar el favorito:", error);
      setFavoritos((actuales) => {
        const siguientes = new Set(actuales);
        if (yaEsFavorito) siguientes.add(idArticulo);
        else siguientes.delete(idArticulo);
        return siguientes;
      });
      setErrorFavoritos("No se pudo guardar el favorito. Inténtalo de nuevo.");
    }
  }


  useEffect(() => {
    setCartonBingo(null);
    setMostrarBingo(false);
    setErrorBingo("");
    setPremiosBingo({ line: null, lineSpecial: null, bingo: null, special: null });
  }, [clienteIdentificado?.id]);

  useEffect(() => {
    let activo = true;
    async function cargarDisponibilidadBingo() {
      const { data, error } = await supabase
        .from("promociones_bingo")
        .select("*")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (!activo) return;
      if (error) {
        console.error("No se pudo comprobar la disponibilidad del Bingo:", error);
        setConfiguracionBingoCliente(null);
        return;
      }
      const hoy = getTodayISO();
      const promociones = data || [];
      const vigente = promociones.find((item) => item.activa && (!item.fecha_inicio || item.fecha_inicio <= hoy) && (!item.fecha_fin || item.fecha_fin >= hoy));
      setConfiguracionBingoCliente(vigente || null);
      if (!vigente) setMostrarBingo(false);
    }
    cargarDisponibilidadBingo();
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    let activo = true;
    async function cargarDisponibilidadSorteo() {
      // Solo tiene sentido consultarlo para el cliente de pruebas: el
      // resto de clientes no debe ver ni registrar nada del Sorteo
      // mientras esté en fase de validación en real.
      if (!clienteIdentificado?.es_pruebas) {
        setConfiguracionSorteoCliente(null);
        return;
      }
      const { data, error } = await supabase
        .from("promociones_sorteo")
        .select("*")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (!activo) return;
      if (error) {
        console.error("No se pudo comprobar la disponibilidad del Sorteo:", error);
        setConfiguracionSorteoCliente(null);
        return;
      }
      const hoy = getTodayISO();
      const promociones = data || [];
      const vigente = promociones.find((item) => item.activa && (!item.fecha_inicio || item.fecha_inicio <= hoy) && (!item.fecha_fin || item.fecha_fin >= hoy));
      setConfiguracionSorteoCliente(vigente || null);
    }
    cargarDisponibilidadSorteo();
    return () => { activo = false; };
  }, [clienteIdentificado?.es_pruebas]);

  useEffect(() => {
    let activo = true;
    async function cargarDepartamentosSorteo() {
      if (configuracionSorteoCliente?.modo !== "departamentos" || !configuracionSorteoCliente?.id) {
        setDepartamentosSorteoCliente([]);
        return;
      }
      const { data, error } = await supabase
        .from("promociones_sorteo_departamentos")
        .select("departamento_id")
        .eq("promocion_id", configuracionSorteoCliente.id);
      if (!activo) return;
      if (error) {
        console.error("No se pudieron cargar los departamentos del Sorteo:", error);
        setDepartamentosSorteoCliente([]);
        return;
      }
      setDepartamentosSorteoCliente((data || []).map((d) => d.departamento_id));
    }
    cargarDepartamentosSorteo();
    return () => { activo = false; };
  }, [configuracionSorteoCliente?.id, configuracionSorteoCliente?.modo]);

  useEffect(() => {
    let activo = true;
    async function cargarFechaLimitePropia() {
      if (!clienteToken || !configuracionBingoCliente?.id) {
        setFechaLimiteBingoPropia(null);
        return;
      }
      const { data, error } = await supabase.rpc("obtener_estado_carton_bingo", {
        p_customer_token: clienteToken,
      });
      if (!activo) return;
      const respuesta = Array.isArray(data) ? data[0] : data;
      if (error || !respuesta?.ok) {
        setFechaLimiteBingoPropia(null);
        return;
      }
      setFechaLimiteBingoPropia(respuesta.fecha_limite || null);
    }
    cargarFechaLimitePropia();
    return () => { activo = false; };
  }, [clienteToken, configuracionBingoCliente?.id]);

  useEffect(() => {
    let activo = true;

    async function cargarArticulosBingo() {
      const promocionId = configuracionBingoCliente?.id;
      if (!promocionId) {
        setArticulosBingoCliente([]);
        return;
      }

      const { data: reglas, error: reglasError } = await supabase
        .from("promociones_bingo_articulos")
        .select("articulo_id,codigo_articulo,nombre_articulo,cantidad_minima")
        .eq("promocion_id", promocionId);

      if (!activo) return;
      if (reglasError) {
        console.error("No se pudieron cargar los artículos del Bingo:", reglasError);
        setArticulosBingoCliente([]);
        return;
      }

      const ids = [...new Set((reglas || []).map((regla) => regla.articulo_id).filter(Boolean))];
      let articulos = [];

      if (ids.length > 0) {
        const { data, error } = await supabase
          .from("articulos")
          .select("id,codigo,permite_unidades")
          .in("id", ids);

        if (!activo) return;
        if (error) {
          console.error("No se pudieron completar los artículos del Bingo:", error);
          setArticulosBingoCliente([]);
          return;
        }
        articulos = data || [];
      }

      const articulosPorId = new Map(
        articulos.map((articulo) => [String(articulo.id), articulo])
      );

      setArticulosBingoCliente(
        (reglas || []).map((regla) => {
          const articulo = articulosPorId.get(String(regla.articulo_id)) || {};
          return {
            articuloId: regla.articulo_id,
            codigo: String(regla.codigo_articulo || articulo.codigo || "").trim(),
            nombre: String(regla.nombre_articulo || "").trim(),
            cantidadMinima: Math.max(1, Number(regla.cantidad_minima || 1)),
            permiteUnidades: Boolean(articulo.permite_unidades),
          };
        }).filter((regla) => regla.articuloId != null)
      );
    }

    cargarArticulosBingo();
    return () => { activo = false; };
  }, [configuracionBingoCliente?.id]);

  async function abrirMiBingo() {
    if (!clienteIdentificado?.id || !clienteToken || !configuracionBingoCliente) return;

    setMostrarBingo(true);
    if (cartonBingo) return;

    setCargandoBingo(true);
    setErrorBingo("");

    try {
      const nuevoCarton = crearCartonBingo90();
      const { data, error } = await supabase.rpc("ensure_customer_bingo_card", {
        p_token: clienteToken,
        p_carton: nuevoCarton,
      });

      if (error) throw error;
      const respuesta = Array.isArray(data) ? data[0] : data;

      if (!respuesta?.ok) {
        throw new Error(respuesta?.message || "No se pudo asignar tu cartón de Bingo.");
      }

      const resultado = respuesta.card_result || respuesta;
      const carton = resultado.carton || resultado.card || respuesta.card;
      const cartonId = resultado.carton_id || resultado.id || respuesta.carton_id;
      const editionId = resultado.edition_id || respuesta.edition_id;

      if (!cartonId || !carton || !editionId) {
        throw new Error("El cartón fue localizado, pero sus datos están incompletos.");
      }

      setCartonBingo({
        id: cartonId,
        card: carton,
        drawn_numbers: resultado.numeros_marcados || resultado.drawn_numbers || [],
        status: resultado.estado || resultado.status || "activo",
        edition_id: editionId,
        fecha_limite: resultado.fecha_limite || respuesta.fecha_limite || null,
      });
      setFechaLimiteBingoPropia(resultado.fecha_limite || respuesta.fecha_limite || null);

      const hoy = getTodayISO();
      const { data: promocionesBingo, error: premiosError } = await supabase
        .from("promociones_bingo")
        .select("*")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (premiosError) throw premiosError;

      const promocionesDisponibles = promocionesBingo || [];
      const promo = promocionesDisponibles.find((item) => {
        const inicioOk = !item.fecha_inicio || item.fecha_inicio <= hoy;
        const finOk = !item.fecha_fin || item.fecha_fin >= hoy;
        return item.activa && inicioOk && finOk;
      }) || promocionesDisponibles.find((item) => item.activa) || promocionesDisponibles[0] || null;

      if (!promo) throw new Error("El Bingo no está activo o ha finalizado.");
      setConfiguracionBingoCliente(promo);
      const prizeIds = [...new Set([promo?.premio_linea_articulo_id, promo?.premio_linea_especial_articulo_id, promo?.premio_bingo_articulo_id, promo?.premio_especial_articulo_id].filter(Boolean))];
      let prizeArticles = [];
      if (prizeIds.length) {
        const { data: articles } = await supabase.from("articulos").select("id,nombre,foto").in("id", prizeIds);
        prizeArticles = articles || [];
      }
      const articleById = new Map(prizeArticles.map((article) => [String(article.id), article]));
      const makePrize = (type) => {
        const id = promo?.[`premio_${type}_articulo_id`];
        const article = articleById.get(String(id || ""));
        return {
          active: Boolean(promo?.[`premio_${type}_activo`]),
          name: promo?.[`premio_${type}_nombre`] || article?.nombre || "",
          message: promo?.[`premio_${type}_mensaje`] || "",
          image: getPublicPhotoUrl(article?.foto),
        };
      };
      setPremiosBingo({
        line: makePrize("linea"),
        lineSpecial: { ...makePrize("linea_especial"), maxBalls: Number(promo?.premio_linea_especial_max_bolas) || 0 },
        bingo: makePrize("bingo"),
        special: { ...makePrize("especial"), maxBalls: Number(promo?.premio_especial_max_bolas) || 0 },
      });
    } catch (error) {
      console.error("No se pudo cargar el Bingo personal:", error);
      setErrorBingo(
        error?.message?.includes("JSON")
          ? "No se ha podido leer tu cartón."
          : "Todavía no tienes cartón para este Bingo. Debes completar un pedido que cumpla sus condiciones dentro de las fechas activas."
      );
    } finally {
      setCargandoBingo(false);
    }
  }

  async function abrirMiSorteo() {
    if (!clienteIdentificado?.es_pruebas || !clienteToken) return;

    setMostrarMiSorteo(true);
    setCargandoSorteo(true);
    setErrorSorteo("");

    try {
      const { data, error } = await supabase.rpc("obtener_numeros_sorteo_cliente", {
        p_token: clienteToken,
      });
      if (error) throw error;
      setNumerosSorteoCliente(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("No se pudo cargar el Sorteo del cliente:", error);
      setErrorSorteo("No se han podido cargar tus números de Sorteo. Inténtalo de nuevo.");
    } finally {
      setCargandoSorteo(false);
    }
  }

  useEffect(() => {
    cargarConfiguracionRuleta();
  }, []);

  async function cargarConfiguracionRuleta() {
    try {
      const hoy = getTodayISO();

      const { data: promociones, error: promocionError } = await supabase
        .from("promociones_ruleta")
        .select("*")
        .eq("activa", true)
        .order("created_at", { ascending: true });

      if (promocionError) {
        throw promocionError;
      }

      const promocion = (promociones || []).find((item) => {
        const inicioOk = !item.fecha_inicio || item.fecha_inicio <= hoy;
        const finOk = !item.fecha_fin || item.fecha_fin >= hoy;
        return inicioOk && finOk;
      });

      if (!promocion) {
        setConfiguracionRuleta(null);
        setArticulosRuleta([]);
        setDepartamentosRuleta([]);
        setPremiosRuleta([]);
        return;
      }

      setConfiguracionRuleta(promocion);

      const { data: articulos, error: articulosError } = await supabase
        .from("promociones_ruleta_articulos")
        .select("*")
        .eq("promocion_id", promocion.id);

      if (articulosError) {
        throw articulosError;
      }

      setArticulosRuleta(articulos || []);

      const { data: departamentosPromo, error: departamentosPromoError } =
        await supabase
          .from("promociones_ruleta_departamentos")
          .select("departamento_id")
          .eq("promocion_id", promocion.id);

      if (departamentosPromoError) {
        throw departamentosPromoError;
      }

      setDepartamentosRuleta(departamentosPromo || []);

      const { data: premios, error: premiosError } = await supabase
        .from("promociones_ruleta_premios")
        .select("*")
        .eq("promocion_id", promocion.id)
        .eq("activo", true)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true });

      if (premiosError) {
        throw premiosError;
      }

      setPremiosRuleta(premios || []);
    } catch (error) {
      console.error("Error cargando configuración de ruleta:", error);
      setConfiguracionRuleta(null);
      setArticulosRuleta([]);
      setDepartamentosRuleta([]);
      setPremiosRuleta([]);
    }
  }

  useEffect(() => {
    const abrirPushSiempre = () => {
      setPushCerrado(false);
      setMostrarVolverPush(false);
    };

    const abrirPushSiLaAppVuelve = () => {
      if (document.visibilityState === "visible") {
        abrirPushSiempre();
      }
    };

    abrirPushSiempre();

    window.addEventListener("pageshow", abrirPushSiempre);
    window.addEventListener("focus", abrirPushSiempre);
    document.addEventListener("visibilitychange", abrirPushSiLaAppVuelve);

    return () => {
      window.removeEventListener("pageshow", abrirPushSiempre);
      window.removeEventListener("focus", abrirPushSiempre);
      document.removeEventListener("visibilitychange", abrirPushSiLaAppVuelve);
    };
  }, []);

  useEffect(() => {
    savePendingOrder({
      clienteToken,
      quantities,
      customerName,
      notes,
      enviadoEn: pedidoEnviadoEn,
      fechaLimiteEdicion: pedidoFechaLimiteEdicion,
      pedidoStatsId: pedidoStatsIdActual,
    });
  }, [
    clienteToken,
    quantities,
    customerName,
    notes,
    pedidoEnviadoEn,
    pedidoFechaLimiteEdicion,
    pedidoStatsIdActual,
  ]);

  useEffect(() => {
    const guardarAntesDeSalir = () => {
      savePendingOrder({
        clienteToken,
        quantities,
        customerName,
        notes,
        enviadoEn: pedidoEnviadoEn,
        fechaLimiteEdicion: pedidoFechaLimiteEdicion,
        pedidoStatsId: pedidoStatsIdActual,
      });
    };

    window.addEventListener("pagehide", guardarAntesDeSalir);
    document.addEventListener("visibilitychange", guardarAntesDeSalir);

    return () => {
      window.removeEventListener("pagehide", guardarAntesDeSalir);
      document.removeEventListener("visibilitychange", guardarAntesDeSalir);
    };
  }, [
    quantities,
    customerName,
    notes,
    pedidoEnviadoEn,
    pedidoFechaLimiteEdicion,
    pedidoStatsIdActual,
  ]);

  useEffect(() => {
    let viewport = document.querySelector("meta[name=viewport]");

    if (!viewport) {
      viewport = document.createElement("meta");
      viewport.setAttribute("name", "viewport");
      document.head.appendChild(viewport);
    }

    viewport.setAttribute(
      "content",
      "width=device-width, initial-scale=1, viewport-fit=cover"
    );

    document.documentElement.style.width = "100%";
    document.documentElement.style.maxWidth = "100%";
    document.documentElement.style.overflowX = "hidden";
    document.body.style.width = "100%";
    document.body.style.maxWidth = "100%";
    document.body.style.overflowX = "hidden";
    document.body.style.margin = "0";
    document.body.style.boxSizing = "border-box";
  }, []);

  useEffect(() => {
    // Mientras se edita una cantidad (y justo después, al cerrarse el
    // teclado) NO dejamos que la cabecera cambie de tamaño sola. Antes
    // reactivábamos el colapso automático a los pocos milisegundos, pero
    // ese tiempo fijo no siempre bastaba: si el teléfono tardaba un poco
    // más en cerrar el teclado, el reajuste de scroll del propio teléfono
    // competía con nuestro cambio de tamaño de cabecera y el artículo de
    // al lado se perdía igual que antes.
    //
    // Ahora dejamos la cabecera "congelada" en el tamaño que tuviera hasta
    // que el cliente hace un gesto de scroll de verdad con el dedo
    // (touchmove). A partir de ahí, vuelve a comportarse con normalidad.
    // Se congela tanto al EMPEZAR a editar como al TERMINAR (justo cuando
    // se cierra el teclado y el teléfono reajusta el scroll por su cuenta).
    bloqueColapsoCabeceraRef.current = true;
  }, [campoCantidadActivo]);

  useEffect(() => {
    const handleScroll = () => {
      if (bloqueColapsoCabeceraRef.current) return;
      setHeaderCollapsed(window.scrollY > 90);
    };

    // Antes, CUALQUIER touchmove desbloqueaba el colapso de cabecera, sin
    // mirar cuánto se había movido el dedo. Tocar con precisión un
    // objetivo pequeño (los recuadros de "Cajas"/"Unid.", mucho más
    // estrechos que el resto de la tarjeta) casi siempre viene acompañado
    // de un ligero temblor del dedo, que ya se contaba como "el cliente
    // quiere hacer scroll" y desbloqueaba el colapso ANTES de que el
    // propio teléfono hiciera su reajuste de scroll al abrir el teclado
    // — volviendo a colar el mismo fallo (la cabecera se expandía sola)
    // pero SOLO al tocar esos recuadros directamente, no el resto de la
    // tarjeta. Por eso ahora se exige un desplazamiento real (más de
    // 10px) antes de considerarlo un scroll manual de verdad.
    let touchStartY = null;

    const handleTouchStart = (event) => {
      touchStartY = event.touches?.[0]?.clientY ?? null;
    };

    const handleTouchMove = (event) => {
      const currentY = event.touches?.[0]?.clientY;
      if (touchStartY != null && currentY != null) {
        if (Math.abs(currentY - touchStartY) < 10) return;
      }

      // Gesto de scroll manual real del cliente: a partir de aquí la
      // cabecera vuelve a poder colapsarse/expandirse con normalidad.
      bloqueColapsoCabeceraRef.current = false;
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  // El cierre al tocar fuera del desplegable de Departamentos ya lo
  // gestiona el propio overlay (backdrop con onClick + panel con
  // stopPropagation), así que este listener global ya no hace falta
  // para eso. Se quitó porque, al pasar el menú a un portal (fuera del
  // DOM de departmentDropdownRef), CUALQUIER toque dentro del propio
  // menú —incluido el gesto de hacer scroll— hacía que
  // departmentDropdownRef.current.contains(event.target) diera false, y
  // el desplegable se cerraba en el instante de tocarlo, antes de poder
  // desplazar la lista.

  useEffect(() => {
    async function cargarCatalogo() {
      setCargando(true);
      setErrorCatalogo("");

      const { data: articulosData, error: articulosError } = await supabase
        .from("articulos")
        .select(`
          id,
          codigo,
          nombre,
          precio,
          activo,
          permite_unidades,
          novedad,
          oculto,
          foto,
          departamento_id,
          departamentos (
            id,
            nombre
          ),
          ofertas (
            id,
            texto,
            fecha_inicio,
            fecha_fin,
            es_push,
            push_titulo,
            push_activo
          )
        `)
        .order("nombre", { ascending: true });

      const { data: departamentosData } = await supabase
        .from("departamentos")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      const hoy = getTodayISO();

      let pushData = null;

      const { data: calendarioPushData, error: calendarioPushError } =
        await supabase
          .from("push_calendario")
          .select("id, fecha, push_id")
          .eq("fecha", hoy)
          .maybeSingle();

      if (calendarioPushError) {
        console.error(calendarioPushError);
      }

      if (calendarioPushData?.push_id) {
        const { data: pushOfertaData, error: pushOfertaError } = await supabase
          .from("push_ofertas")
          .select("*")
          .eq("id", calendarioPushData.push_id)
          .eq("activo", true)
          .maybeSingle();

        if (pushOfertaError) {
          console.error(pushOfertaError);
        }

        if (pushOfertaData) {
          let articulosPush = [];

          const { data: pushArticulosData, error: pushArticulosError } =
            await supabase
              .from("push_articulos")
              .select("*")
              .eq("push_id", pushOfertaData.id)
              .order("orden", { ascending: true });

          if (pushArticulosError) {
            console.error(pushArticulosError);
          }

          if (Array.isArray(pushArticulosData) && pushArticulosData.length > 0) {
            const idsArticulos = pushArticulosData
              .map((item) => item.articulo_id)
              .filter(Boolean);

            let articulosCatalogoPush = [];

            if (idsArticulos.length > 0) {
              const { data: articulosPushData, error: articulosPushError } =
                await supabase
                  .from("articulos")
                  .select("id, codigo, nombre, foto")
                  .in("id", idsArticulos);

              if (articulosPushError) {
                console.error(articulosPushError);
              }

              articulosCatalogoPush = articulosPushData || [];
            }

            articulosPush = pushArticulosData.map((item) => {
              const articuloCatalogo = articulosCatalogoPush.find(
                (articulo) => Number(articulo.id) === Number(item.articulo_id)
              );

              return {
                id: item.articulo_id ? String(item.articulo_id) : "",
                codigo:
                  item.codigo_articulo ||
                  articuloCatalogo?.codigo ||
                  "",
                nombre:
                  item.nombre_articulo ||
                  articuloCatalogo?.nombre ||
                  "Información",
                foto: articuloCatalogo?.foto || null,
                imagen_url: item.imagen_url || "",
                texto: item.texto || "",
                orden: item.orden || 1,
                comprable: item.comprable !== false && Boolean(item.articulo_id),
              };
            });
          }

          if (articulosPush.length === 0 && pushOfertaData.articulo_id) {
            const { data: articuloPushData, error: articuloPushError } =
              await supabase
                .from("articulos")
                .select("id, codigo, nombre, foto")
                .eq("id", pushOfertaData.articulo_id)
                .maybeSingle();

            if (articuloPushError) {
              console.error(articuloPushError);
            }

            articulosPush = [
              articuloPushData
                ? {
                    id: String(articuloPushData.id),
                    codigo: articuloPushData.codigo,
                    nombre: articuloPushData.nombre,
                    foto: articuloPushData.foto,
                    imagen_url: "",
                    texto:
                      pushOfertaData.descripcion ||
                      pushOfertaData.texto ||
                      "",
                    orden: 1,
                    comprable: true,
                  }
                : {
                    id: String(pushOfertaData.articulo_id || ""),
                    codigo: pushOfertaData.codigo_articulo,
                    nombre: pushOfertaData.nombre_articulo,
                    foto: null,
                    imagen_url: "",
                    texto:
                      pushOfertaData.descripcion ||
                      pushOfertaData.texto ||
                      "",
                    orden: 1,
                    comprable: Boolean(pushOfertaData.articulo_id),
                  },
            ];
          }

          pushData = {
            id: pushOfertaData.id,
            texto: pushOfertaData.descripcion || pushOfertaData.texto || "",
            push_titulo: pushOfertaData.titulo || "🔥 Ofertas del día",
            push_activo: Boolean(pushOfertaData.activo),
            articulos: articulosPush,
          };
        }
      }

      // Fallback temporal: si no hay Push Diario para hoy, mantiene el push antiguo.
      if (!pushData) {
        const { data: pushAntiguoData, error: pushAntiguoError } = await supabase
          .from("ofertas")
          .select(`
            id,
            texto,
            push_titulo,
            push_activo,
            articulos (
              id,
              codigo,
              nombre,
              foto
            )
          `)
          .eq("push_activo", true)
          .limit(1)
          .maybeSingle();

        if (pushAntiguoError) {
          console.error(pushAntiguoError);
        }

        pushData = pushAntiguoData
          ? {
              id: pushAntiguoData.id,
              texto: pushAntiguoData.texto || "",
              push_titulo: pushAntiguoData.push_titulo || "🔥 Oferta del día",
              push_activo: Boolean(pushAntiguoData.push_activo),
              articulos: pushAntiguoData.articulos
                ? [
                    {
                      id: String(pushAntiguoData.articulos.id),
                      codigo: pushAntiguoData.articulos.codigo,
                      nombre: pushAntiguoData.articulos.nombre,
                      foto: pushAntiguoData.articulos.foto,
                      imagen_url: "",
                      texto: pushAntiguoData.texto || "",
                      orden: 1,
                      comprable: true,
                    },
                  ]
                : [],
            }
          : null;
      }

      if (articulosError) {
        console.error(articulosError);
        setErrorCatalogo(t.catalogError);
      }

      setArticulos(articulosData || []);
      setDepartamentos(
        Array.from(
          new Map(
            (departamentosData || [])
              .filter((departamento) => {
                const nombre = String(departamento.nombre || "").trim();
                return (
                  nombre &&
                  nombre !== "NOVEDAD" &&
                  nombre !== "OFERTAS" &&
                  nombre !== "TODOS" &&
                  nombre !== "ARTÍCULOS BUSCADOS"
                );
              })
              .map((departamento) => [
                String(departamento.nombre || "").trim(),
                {
                  ...departamento,
                  nombre: String(departamento.nombre || "").trim(),
                },
              ])
          ).values()
        )
      );
      setPushOferta(pushData || null);
      setCargando(false);
    }

    cargarCatalogo();
  }, [t.catalogError]);

  const ordenarProductos = (lista) =>
    [...lista].sort((a, b) =>
      String(a.name || a.nombre || "").localeCompare(
        String(b.name || b.nombre || ""),
        "es",
        { sensitivity: "base" }
      )
    );

  const codigosRuleta = useMemo(() => {
    return new Set(
      articulosRuleta
        .map((item) => normalizePromoValue(item.codigo_articulo))
        .filter(Boolean)
    );
  }, [articulosRuleta]);

  const idsArticulosRuleta = useMemo(() => {
    return new Set(
      articulosRuleta
        .map((item) => normalizePromoValue(item.articulo_id))
        .filter(Boolean)
    );
  }, [articulosRuleta]);

  const nombresArticulosRuleta = useMemo(() => {
    return new Set(
      articulosRuleta
        .map((item) => normalizePromoValue(item.nombre_articulo))
        .filter(Boolean)
    );
  }, [articulosRuleta]);

  const idsDepartamentosRuleta = useMemo(() => {
    return new Set(
      departamentosRuleta
        .map((item) => normalizePromoValue(item.departamento_id))
        .filter(Boolean)
    );
  }, [departamentosRuleta]);

  const cantidadesMinimasRuletaPorArticulo = useMemo(() => {
    // Se usan mapas separados por tipo de clave (id / código / nombre) en
    // lugar de un único Map compartido. Antes, al mezclar todas las claves
    // en el mismo Map, el id numérico interno de un artículo (p. ej. 1)
    // podía coincidir con el código de otro artículo distinto (p. ej. el
    // código "1"), y uno pisaba el mínimo del otro según el orden de
    // procesamiento. Eso provocaba que el artículo con código 1 (mínimo 20
    // cajas) mostrara el mínimo configurado para otro artículo cuyo id
    // interno era también "1".
    const porId = new Map();
    const porCodigo = new Map();
    const porNombre = new Map();

    articulosRuleta.forEach((item) => {
      const cantidadMinima = obtenerCantidadMinimaRuletaArticulo(item);

      const claveId = normalizePromoValue(item.articulo_id);
      const claveCodigo = normalizePromoValue(item.codigo_articulo);
      const claveNombre = normalizePromoValue(item.nombre_articulo);

      if (claveId) porId.set(claveId, cantidadMinima);
      if (claveCodigo) porCodigo.set(claveCodigo, cantidadMinima);
      if (claveNombre) porNombre.set(claveNombre, cantidadMinima);
    });

    return { porId, porCodigo, porNombre };
  }, [articulosRuleta]);

  // El Bingo, a diferencia de la Ruleta, identifica los artículos
  // EXCLUSIVAMENTE por id (así es como registrar_pedido_bingo los valida),
  // así que aquí solo hace falta un mapa por id.
  const idsArticulosBingo = useMemo(() => {
    return new Set(
      articulosBingoCliente
        .map((item) => normalizePromoValue(item.articuloId))
        .filter(Boolean)
    );
  }, [articulosBingoCliente]);

  const cantidadesMinimasBingoPorArticulo = useMemo(() => {
    const porId = new Map();
    articulosBingoCliente.forEach((item) => {
      const claveId = normalizePromoValue(item.articuloId);
      if (claveId) porId.set(claveId, Math.max(1, Number(item.cantidadMinima || 1)));
    });
    return porId;
  }, [articulosBingoCliente]);

  const productos = useMemo(() => {
    return ordenarProductos(
      articulos
        .filter((articulo) => articulo.activo)
        .map((articulo) => {
        const oferta = getActiveOffer(articulo.ofertas);
        const articuloId = normalizePromoValue(articulo.id);
        const codigoArticulo = normalizePromoValue(articulo.codigo);
        const nombreArticulo = normalizePromoValue(articulo.nombre);
        const participaRuleta =
          idsArticulosRuleta.has(articuloId) ||
          codigosRuleta.has(codigoArticulo) ||
          nombresArticulosRuleta.has(nombreArticulo);
        const cantidadMinimaRuleta =
          cantidadesMinimasRuletaPorArticulo.porId.get(articuloId) ||
          cantidadesMinimasRuletaPorArticulo.porCodigo.get(codigoArticulo) ||
          cantidadesMinimasRuletaPorArticulo.porNombre.get(nombreArticulo) ||
          1;
        const participaBingo = idsArticulosBingo.has(articuloId);
        const cantidadMinimaBingo = cantidadesMinimasBingoPorArticulo.get(articuloId) || 1;

        return {
          id: String(articulo.id),
          codigo: articulo.codigo,
          departamento_id: articulo.departamento_id,
          idnum: articulo.codigo,
          nombre: articulo.nombre,
          name: articulo.nombre,
          foto: articulo.foto,
          image: getPublicPhotoUrl(articulo.foto),
          permite_unidades: articulo.permite_unidades,
          novedad: articulo.novedad,
          oculto: articulo.oculto,
          departamento: String(articulo.departamentos?.nombre || "").trim(),
          department: String(articulo.departamentos?.nombre || "").trim(),
          offerText: oferta?.texto || "",
          ofertas: articulo.ofertas || [],
          participaRuleta,
          cantidadMinimaRuleta,
          participaBingo,
          cantidadMinimaBingo,
        };
      })
    );
  }, [
    articulos,
    codigosRuleta,
    idsArticulosRuleta,
    nombresArticulosRuleta,
    cantidadesMinimasRuletaPorArticulo,
    idsArticulosBingo,
    cantidadesMinimasBingoPorArticulo,
  ]);

  const productosVisibles = useMemo(
    () => productos.filter((product) => !product.oculto),
    [productos]
  );

  const productosConOferta = useMemo(
    () =>
      ordenarProductos(
        productosVisibles.filter((product) =>
          String(product.offerText || "").trim()
        )
      ),
    [productosVisibles]
  );

  const productosNovedad = useMemo(
    () => ordenarProductos(productosVisibles.filter((product) => product.novedad)),
    [productosVisibles]
  );

  const productosRuleta = useMemo(
    () =>
      ordenarProductos(
        productosVisibles.filter((product) => product.participaRuleta)
      ),
    [productosVisibles]
  );

  // El departamento de Bingo, igual que el de Ruleta, es exclusivo de
  // clientes identificados (entran con su enlace personal): un visitante
  // anónimo no debe ni verlo en el desplegable de departamentos.
  const productosBingo = useMemo(
    () =>
      clienteIdentificado
        ? ordenarProductos(
            productosVisibles.filter((product) => product.participaBingo)
          )
        : [],
    [productosVisibles, clienteIdentificado]
  );

  const departamentosCatalogo = useMemo(() => {
    const grupos = [];

    if (productosConOferta.length > 0) {
      grupos.push({
        name: "OFERTAS",
        products: ordenarProductos(productosConOferta),
      });
    }

    if (productosNovedad.length > 0) {
      grupos.push({
        name: "NOVEDAD",
        products: ordenarProductos(productosNovedad),
      });
    }

    if (productosRuleta.length > 0) {
      grupos.push({
        name: "RULETA",
        products: ordenarProductos(productosRuleta),
      });
    }

    if (productosBingo.length > 0) {
      grupos.push({
        name: "BINGO",
        products: ordenarProductos(productosBingo),
      });
    }

    departamentos.forEach((departamento) => {
      const nombreDepartamento = String(departamento.nombre || "").trim();

      if (
        !nombreDepartamento ||
        nombreDepartamento === "NOVEDAD" ||
        nombreDepartamento === "OFERTAS" ||
        nombreDepartamento === "RULETA" ||
        nombreDepartamento === "BINGO" ||
        nombreDepartamento === "TODOS" ||
        nombreDepartamento === "ARTÍCULOS BUSCADOS"
      ) {
        return;
      }

      const products = ordenarProductos(
        productosVisibles.filter(
          (product) => product.department === nombreDepartamento
        )
      );

      if (products.length > 0) {
        grupos.push({
          name: nombreDepartamento,
          products,
        });
      }
    });

    return grupos;
  }, [
    departamentos,
    productosVisibles,
    productosConOferta,
    productosNovedad,
    productosRuleta,
    productosBingo,
    soloFavoritos,
    clienteIdentificado,
    favoritos,
    departamentos,
  ]);

  const departmentOptions = useMemo(() => {
    const uniqueDepartments = Array.from(
      new Map(
        departamentosCatalogo.map((department) => [department.name, department])
      ).values()
    );

    return [
      {
        name: "TODOS",
        label: t.allDepartments,
        count: productosVisibles.length,
      },
      ...uniqueDepartments.map((department) => ({
        name: department.name,
        label: getDepartmentLabel(department.name, language),
        count: department.products.length,
      })),
    ];
  }, [departamentosCatalogo, language, productosVisibles.length, t.allDepartments]);

  const filteredDepartments = useMemo(() => {
    const cleanSearch = search.trim();

    const filterBySearch = (lista) =>
      cleanSearch
        ? lista.filter((product) => productMatchesSearch(product, cleanSearch))
        : lista;

    if (soloFavoritos && clienteIdentificado) {
      const favoritosVisibles = filterBySearch(
        productosVisibles.filter((product) => favoritos.has(String(product.id)))
      );

      // Mantiene juntos los artículos de cada departamento siguiendo el orden
      // configurado en Administración. Dentro de cada departamento se ordenan
      // alfabéticamente. Los nombres de los departamentos no se muestran.
      const ordenDepartamentos = departamentos
        .map((departamento) => String(departamento.nombre || "").trim())
        .filter(
          (nombre) =>
            nombre &&
            !["NOVEDAD", "OFERTAS", "RULETA", "BINGO", "TODOS", "ARTÍCULOS BUSCADOS"].includes(
              nombre
            )
        );

      const productosFavoritos = [];
      const idsIncluidos = new Set();

      ordenDepartamentos.forEach((nombreDepartamento) => {
        ordenarProductos(
          favoritosVisibles.filter(
            (product) => product.department === nombreDepartamento
          )
        ).forEach((product) => {
          const id = String(product.id);
          if (!idsIncluidos.has(id)) {
            idsIncluidos.add(id);
            productosFavoritos.push(product);
          }
        });
      });

      // Por seguridad, añade al final cualquier artículo cuyo departamento ya
      // no exista en la configuración, agrupándolo también por departamento.
      const restantes = favoritosVisibles
        .filter((product) => !idsIncluidos.has(String(product.id)))
        .sort((a, b) => {
          const porDepartamento = String(a.department || "").localeCompare(
            String(b.department || ""),
            "es",
            { sensitivity: "base" }
          );
          return porDepartamento ||
            String(a.name || a.nombre || "").localeCompare(
              String(b.name || b.nombre || ""),
              "es",
              { sensitivity: "base" }
            );
        });

      productosFavoritos.push(...restantes);

      return productosFavoritos.length > 0
        ? [{ name: "MIS FAVORITOS", products: productosFavoritos }]
        : [];
    }

    if (selectedDepartment !== "TODOS") {
      let selectedProducts = [];

      if (selectedDepartment === "NOVEDAD") {
        selectedProducts = productosNovedad;
      } else if (selectedDepartment === "OFERTAS") {
        selectedProducts = productosConOferta;
      } else if (selectedDepartment === "RULETA") {
        selectedProducts = productosRuleta;
      } else if (selectedDepartment === "BINGO") {
        selectedProducts = productosBingo;
      } else {
        selectedProducts = productosVisibles.filter(
          (product) => product.department === selectedDepartment
        );
      }

      selectedProducts = ordenarProductos(filterBySearch(selectedProducts));

      return selectedProducts.length > 0
        ? [
            {
              name: selectedDepartment,
              products: selectedProducts,
            },
          ]
        : [];
    }

    const visibleDepartments = departamentosCatalogo
      .map((department) => ({
        ...department,
        products: ordenarProductos(filterBySearch(department.products)),
      }))
      .filter((department) => department.products.length > 0);

    if (!cleanSearch) {
      return visibleDepartments;
    }

    const hiddenMatches = productos
      .filter((product) => product.oculto)
      .filter((product) => productMatchesSearch(product, cleanSearch));

    if (hiddenMatches.length > 0) {
      visibleDepartments.push({
        name: "ARTÍCULOS BUSCADOS",
        products: ordenarProductos(hiddenMatches),
      });
    }

    return visibleDepartments;
  }, [
    search,
    selectedDepartment,
    departamentosCatalogo,
    productos,
    productosVisibles,
    productosNovedad,
    productosConOferta,
    productosRuleta,
    productosBingo,
  ]);

  useEffect(() => {
    // No forzamos scroll automático al primer artículo.
    // Así evitamos que el primer artículo quede tapado debajo de la cabecera fija.
  }, [filteredDepartments]);

  const orderedItems = useMemo(() => {
    return Object.entries(quantities)
      .map(([productId, quantity]) => {
        const product = productos.find((item) => item.id === productId);
        if (!product) return null;

        const boxes = Number(quantity.boxes || 0);
        const units = product.permite_unidades
          ? Number(quantity.units || 0)
          : 0;
        const itemNotes = quantity.notes || "";

        if (!boxes && !units && !itemNotes.trim()) return null;

        return {
          product,
          boxes,
          units,
          notes: itemNotes,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const porDepartamento = compararDepartamentosPedido(
          a.product.department || a.product.departamento,
          b.product.department || b.product.departamento
        );
        if (porDepartamento !== 0) return porDepartamento;

        return String(a.product.name).localeCompare(String(b.product.name), "es", {
          sensitivity: "base",
        });
      });
  }, [quantities, productos]);

  const selectedCount = orderedItems.filter(
    (item) => item.boxes > 0 || item.units > 0
  ).length;

  const obtenerResumenPedidoRuleta = (itemsPedido = []) => {
    if (!configuracionRuleta || articulosRuleta.length === 0) {
      return null;
    }

    const variedadMinima = Math.max(
      1,
      Number(configuracionRuleta.variedad_minima || 1)
    );

    const reglasPorCodigo = new Map(
      articulosRuleta
        .map((item) => {
          const codigo = normalizarCodigoRuleta(item.codigo_articulo);
          if (!codigo) return null;

          return [codigo, obtenerCantidadMinimaRuletaArticulo(item)];
        })
        .filter(Boolean)
    );

    const codigosValidos = new Set();

    itemsPedido.forEach((item) => {
      if (!item?.product?.participaRuleta) return;

      const codigoArticulo = normalizarCodigoRuleta(
        item.product.codigo || item.product.idnum || item.product.id || ""
      );
      const cantidadMinima = reglasPorCodigo.get(codigoArticulo) || 1;

      if (articuloPedidoCumpleCantidadMinimaRuleta(item, cantidadMinima)) {
        codigosValidos.add(codigoArticulo || item.product.id);
      }
    });

    const variedadActual = codigosValidos.size;
    const tiradasConseguidas = Math.floor(variedadActual / variedadMinima);
    const variedadParaSiguienteTirada = variedadActual % variedadMinima;
    const variedadRestante = Math.max(0, variedadMinima - variedadActual);
    const variedadRestanteSiguienteTirada =
      variedadParaSiguienteTirada === 0
        ? variedadMinima
        : variedadMinima - variedadParaSiguienteTirada;

    return {
      cumple: tiradasConseguidas > 0,
      variedadActual,
      variedadMinima,
      variedadRestante,
      tiradasConseguidas,
      variedadParaSiguienteTirada,
      variedadRestanteSiguienteTirada,
    };
  };

  const resumenRuletaPedido = useMemo(
    () => obtenerResumenPedidoRuleta(orderedItems),
    [orderedItems, configuracionRuleta, articulosRuleta]
  );

  const resumenSorteoPedido = useMemo(() => {
    if (!clienteIdentificado?.es_pruebas || !configuracionSorteoCliente) return null;

    const variedadMinima = Math.max(1, Number(configuracionSorteoCliente.variedad_minima || 10));
    const departamentosPermitidos = new Set(departamentosSorteoCliente.map((id) => String(id)));

    const articulosValidos = new Set();

    orderedItems.forEach((item) => {
      const cajas = Number(item.boxes || 0);
      const unidades = Number(item.units || 0);
      if (cajas <= 0 && unidades <= 0) return;

      if (configuracionSorteoCliente.modo === "departamentos") {
        const departamentoId = String(item?.product?.departamento_id ?? "");
        if (!departamentoId || !departamentosPermitidos.has(departamentoId)) return;
      }

      articulosValidos.add(item?.product?.id);
    });

    const variedadActual = articulosValidos.size;
    const numerosConseguidos = Math.floor(variedadActual / variedadMinima);
    const variedadParaSiguiente = variedadActual % variedadMinima;
    const variedadRestanteSiguiente =
      variedadParaSiguiente === 0 ? variedadMinima : variedadMinima - variedadParaSiguiente;

    return {
      cumple: numerosConseguidos > 0,
      variedadActual,
      variedadMinima,
      numerosConseguidos,
      variedadRestante: Math.max(0, variedadMinima - variedadActual),
      variedadRestanteSiguiente,
    };
  }, [
    orderedItems,
    clienteIdentificado?.es_pruebas,
    configuracionSorteoCliente,
    departamentosSorteoCliente,
  ]);

  const resumenBingoPedido = useMemo(() => {
    if (!clienteIdentificado?.id || !configuracionBingoCliente) return null;
    // Si RLS no permite leer las reglas desde el navegador, no mostramos un
    // resultado falso. La validación definitiva se hace al enviar mediante RPC.
    if (!Array.isArray(articulosBingoCliente) || articulosBingoCliente.length === 0) return null;

    const variedadMinima = Math.max(
      1,
      Number(configuracionBingoCliente.variedad_minima || 1)
    );

    const articulosValidos = new Set();

    orderedItems.forEach((item) => {
      const regla = buscarReglaBingoParaItem(item, articulosBingoCliente);
      if (!regla) return;

      const articuloId = String(regla.articuloId);

      const cajas = Number(item.boxes || 0);
      const unidades = Number(item.units || 0);
      const cumpleCantidad = regla.permiteUnidades
        ? cajas > 0 || unidades >= regla.cantidadMinima
        : cajas >= regla.cantidadMinima;

      if (cumpleCantidad) articulosValidos.add(articuloId);
    });

    const variedadActual = articulosValidos.size;
    const cumple = variedadActual >= variedadMinima;
    const bolasPorBloque = Math.max(1, Number(configuracionBingoCliente.bolas_por_pedido || 1));
    const bloquesCumplidos = cumple ? Math.floor(variedadActual / variedadMinima) : 0;

    return {
      cumple,
      variedadActual,
      variedadMinima,
      variedadRestante: Math.max(0, variedadMinima - variedadActual),
      bolasConseguidas: bloquesCumplidos * bolasPorBloque,
      bolasPorBloque,
    };
  }, [
    orderedItems,
    clienteIdentificado?.id,
    configuracionBingoCliente,
    articulosBingoCliente,
  ]);

  const obtenerEstadoArticuloRuleta = (product, quantity = {}) => {
    if (!product?.participaRuleta) return null;

    const minimo = Math.max(1, Number(product.cantidadMinimaRuleta || 1));
    const cajas = Number(quantity.boxes || 0);
    const unidades = Number(quantity.units || 0);

    if (product.permite_unidades) {
      if (cajas > 0 || unidades >= minimo) {
        return {
          completo: true,
          texto: "✓ Este artículo ya cuenta para la Ruleta",
        };
      }

      // Sin nada de cantidad metida todavía no mostramos aviso: el badge
      // de Ruleta junto al nombre del artículo ya indica el mínimo.
      if (unidades === 0) return null;

      return {
        completo: false,
        texto: `Te faltan ${Math.max(0, minimo - unidades)} unidades para que cuente`,
      };
    }

    if (cajas >= minimo) {
      return {
        completo: true,
        texto: "✓ Este artículo ya cuenta para la Ruleta",
      };
    }

    if (cajas === 0) return null;

    return {
      completo: false,
      texto: `Te faltan ${Math.max(0, minimo - cajas)} cajas para que cuente`,
    };
  };

  // Igual que obtenerEstadoArticuloRuleta, pero para Bingo. Bingo es
  // exclusivo de clientes identificados, así que sin cliente identificado
  // no se calcula nada (ni se insinúa que el artículo participa).
  const obtenerEstadoArticuloBingo = (product, quantity = {}) => {
    if (!product?.participaBingo || !clienteIdentificado) return null;

    const minimo = Math.max(1, Number(product.cantidadMinimaBingo || 1));
    const cajas = Number(quantity.boxes || 0);
    const unidades = Number(quantity.units || 0);

    if (product.permite_unidades) {
      if (cajas > 0 || unidades >= minimo) {
        return {
          completo: true,
          texto: "✓ Este artículo ya cuenta para el Bingo",
        };
      }

      // Sin nada de cantidad metida todavía no mostramos aviso: el badge
      // de Bingo junto al nombre del artículo ya indica el mínimo.
      if (unidades === 0) return null;

      return {
        completo: false,
        texto: `Te faltan ${Math.max(0, minimo - unidades)} unidades para que cuente en el Bingo`,
      };
    }

    if (cajas >= minimo) {
      return {
        completo: true,
        texto: "✓ Este artículo ya cuenta para el Bingo",
      };
    }

    if (cajas === 0) return null;

    return {
      completo: false,
      texto: `Te faltan ${Math.max(0, minimo - cajas)} cajas para que cuente en el Bingo`,
    };
  };

  const activarCampoCantidad = (productId, field) => {
    // Usado como respaldo por el onFocus nativo de los inputs (por si el
    // campo recibe el foco por una vía que no pase por
    // posicionarYFijarArticulo). Solo marca estado, sin tocar scroll ni
    // cabecera, para no interferir con un posicionamiento ya en marcha.
    setArticuloDestacado(productId);
    setCampoCantidadActivo(`${productId}:${field}`);
  };

  // En iPhone, cuando se abre el teclado, iOS desplaza la página por su
  // cuenta para "ayudar" a que el campo enfocado quede por encima del
  // teclado. Se intentó corregir eso "clavando" con position:fixed el
  // body entero, y luego solo el listado de artículos — pero manipular la
  // posición de esos elementos JUSTO durante el toque es lo que rompía
  // cosas mucho más graves: el navegador perdía de vista en qué artículo
  // se había tocado (activaba el vecino) y, si el toque era sobre el
  // campo "Cajas", a veces ni siquiera llegaba a abrir el teclado.
  //
  // También se probó calculando el scroll a mano (con getBoundingClientRect
  // y restando la altura de la cabecera), pero esa altura se mide justo en
  // el mismo instante en que la cabecera se está colapsando con una
  // animación CSS (headerWrap tiene transition en max-height): medirla en
  // ese momento da un valor inestable/a medio camino según el instante
  // exacto, lo que hacía que a veces el cálculo se pasara de largo y el
  // artículo tocado (sobre todo el primero de cada departamento) acabase
  // desapareciendo por arriba en vez de quedar visible.
  //
  // Por eso aquí NO se calcula nada a mano: se usa el scrollIntoView()
  // nativo del navegador, que ya tiene en cuenta el scroll-margin-top
  // definido en la propia tarjeta (ver styles.productCard) sin depender de
  // medir la cabecera ni de la estructura de hermanos en el DOM.
  const posicionarYFijarArticulo = (productId, field, input) => {
    // IMPORTANTE: esto tiene que fijarse AQUÍ, de forma síncrona, antes de
    // cualquier scroll. Hay un listener de scroll (más arriba en el
    // archivo) que recalcula solo por su cuenta si la cabecera debe estar
    // colapsada o no, según window.scrollY > 90 — y ese cálculo se
    // desactiva mientras bloqueColapsoCabeceraRef.current sea true. Antes,
    // ese ref solo se ponía a true dentro de un useEffect ligado a
    // campoCantidadActivo, que se ejecuta DESPUÉS del scrollIntoView de
    // aquí abajo. Para artículos que quedan cerca de arriba tras el
    // scroll (scrollY final ≤ 90px) — típicamente el PRIMER artículo de
    // cualquier departamento — el scroll del scrollIntoView disparaba el
    // evento "scroll" ANTES de que el useEffect llegara a bloquear nada,
    // así que el propio listener revertía setHeaderCollapsed(true) a
    // false (window.scrollY ≤ 90), la cabecera grande volvía a
    // expandirse, y el artículo tocado quedaba tapado/descolocado — dando
    // la sensación de que se había activado "otro" artículo. Fijando el
    // bloqueo aquí, síncronamente, antes de tocar el scroll, esa carrera
    // desaparece.
    bloqueColapsoCabeceraRef.current = true;

    if (input) {
      input.focus({ preventScroll: true });
      input.select?.();
    }

    flushSync(() => {
      setHeaderCollapsed(true);
      setArticuloDestacado(productId);
      setCampoCantidadActivo(`${productId}:${field}`);
    });

    // IMPORTANTE: en la vista "Todos", un mismo artículo puede aparecer DOS
    // VECES en la página (una en su sección promocional — Ofertas, Novedad,
    // Ruleta, Bingo — y otra en su departamento real). rowRefs solo guarda
    // UN elemento por id de producto: la segunda copia que se pinta
    // sobrescribe a la primera, así que buscar la tarjeta ahí podía
    // devolver la copia equivocada — la que se resaltaba/hacía scroll no
    // era la que se acababa de tocar, sino su duplicado en otra sección
    // más abajo (o arriba). Por eso aquí SIEMPRE se parte del propio
    // campo que se acaba de tocar (input) para localizar SU tarjeta con
    // closest("article"), nunca del mapa por id — así no hay ambigüedad
    // posible, sea cual sea la copia tocada.
    const elemento = input
      ? input.closest("article")
      : rowRefs.current[productId];
    if (elemento) {
      elemento.scrollIntoView({ block: "start", behavior: "auto" });
    }
  };

  // Toque en CUALQUIER parte de la tarjeta del artículo (fuera de sus
  // controles propios) manda el foco directamente al campo "Cajas",
  // listo para escribir la cantidad. La foto queda excluida a propósito:
  // debe poder ampliarse en vez de activar el campo de cantidad. Los
  // inputs, botones y enlaces también quedan excluidos porque ya
  // gestionan su propio toque (incluida "Unid.", que activa su propio
  // campo en vez de redirigir a "Cajas").
  //
  // IMPORTANTE: se dispara en onClick (no en onPointerDown/touchstart).
  // En iOS Safari, un focus() lanzado sobre un elemento DISTINTO al que
  // se ha tocado solo abre el teclado si ocurre en el evento "click"
  // (tras soltar el dedo); en "pointerdown"/"touchstart" Safari lo
  // ignora aunque el elemento quede técnicamente enfocado. Por eso tocar
  // directamente el cuadro de Cajas siempre funcionó (ahí el propio
  // Safari lo enfoca de forma nativa al tocar), pero tocar el resto de
  // la tarjeta no abría el teclado.
  const manejarToqueTarjetaArticulo = (event, productId) => {
    if (event.target.closest("img, input, button, a")) {
      return;
    }

    // No usamos cajasInputRefs (mapa por id, ambiguo si el artículo
    // aparece dos veces en la vista "Todos" — ver el comentario en
    // posicionarYFijarArticulo): buscamos el campo "Cajas" DENTRO de la
    // propia tarjeta tocada (event.currentTarget es siempre la tarjeta
    // correcta, la que se ha tocado de verdad), así no hay duda posible
    // de cuál de las dos copias es.
    const inputCajas = event.currentTarget.querySelector("input");
    posicionarYFijarArticulo(productId, "boxes", inputCajas);
  };

  const updateQuantity = (productId, field, value) => {
    const product = productos.find((item) => item.id === productId);

    if (field === "units" && product && !product.permite_unidades) {
      avisarSoloCajas(productId);
      return;
    }

    const numericValue = value === "" ? "" : Math.max(0, Number(value));

    setQuantities((current) => {
      const previous = current[productId] || {};
      const hasValue = numericValue !== "" && Number(numericValue) > 0;

      return {
        ...current,
        [productId]: {
          boxes:
            field === "boxes"
              ? numericValue
              : hasValue
                ? ""
                : previous.boxes || "",
          units:
            field === "units"
              ? numericValue
              : hasValue
                ? ""
                : product?.permite_unidades
                  ? previous.units || ""
                  : "",
          notes: previous.notes || "",
        },
      };
    });
  };

  // Botones +/- del catálogo (estilo Yollgo). No es una vía nueva de
  // negocio: simplemente calcula el siguiente número y se lo pasa a
  // updateQuantity de toda la vida, así que hereda gratis la exclusividad
  // cajas/unidades y el aviso de "solo cajas" que ya tenía updateQuantity.
  const stepQuantity = (productId, field, delta) => {
    const current = quantities[productId] || {};
    const currentValue = Number(current[field] || 0) || 0;
    const nextValue = Math.max(0, currentValue + delta);
    updateQuantity(productId, field, String(nextValue));
  };

  const updateNotes = (productId, value) => {
    setQuantities((current) => ({
      ...current,
      [productId]: {
        boxes: current[productId]?.boxes || "",
        units: current[productId]?.units || "",
        notes: value,
      },
    }));
  };

  const cerrarPush = () => {
    setPushCerrado(true);
    setHeaderCollapsed(false);

    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 40);
  };

  const irAlArticuloPush = (articuloPush) => {
    const articuloId = String(articuloPush?.id || "");

    if (!articuloId) {
      alert("Este bloque del push es informativo y no tiene artículo asociado.");
      return;
    }

    const totalComprables = Array.isArray(pushOferta?.articulos)
      ? pushOferta.articulos.filter((item) => item.comprable && item.id).length
      : 0;

    setPushCerrado(true);
    setMostrarVolverPush(totalComprables > 1);
    setHeaderCollapsed(true);
    setSelectedDepartment("TODOS");
    setSearchInput("");
    setSearch("");
    setDepartmentDropdownOpen(false);
    setArticuloDestacado(articuloId);

    setTimeout(() => {
      setArticuloDestacado((actual) => (actual === articuloId ? null : actual));
    }, 4500);

    const intentarScroll = () => {
      asegurarArticuloVisible(articuloId);
    };

    setTimeout(intentarScroll, 120);
    setTimeout(intentarScroll, 350);
    setTimeout(intentarScroll, 700);
    setTimeout(intentarScroll, 1100);
  };

  const asegurarArticuloVisible = (productId) => {
    const recolocar = () => {
      const element = rowRefs.current[productId];
      if (!element) return;

      const topArea = document.querySelector("[data-top-area='true']");
      const topHeight = topArea ? topArea.getBoundingClientRect().height : 0;
      const margin = 10;
      const rect = element.getBoundingClientRect();
      const absoluteTop = window.scrollY + rect.top;
      const targetTop = Math.max(0, absoluteTop - topHeight - margin);

      window.scrollTo({
        top: targetTop,
        behavior: "smooth",
      });
    };

    recolocar();
    setTimeout(recolocar, 180);
    setTimeout(recolocar, 380);
  };

  const aceptarCantidad = (productId, elementoTarjeta = null) => {
    // "Aceptar" únicamente cierra el teclado. No se mueve ni se "clava"
    // ningún elemento del catálogo — eso fue lo que causaba que se
    // activara el artículo equivocado y que a veces no se abriera el
    // teclado al tocar "Cajas".
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setArticuloDestacado(productId);
    setCampoCantidadActivo(null);

    // Red de seguridad, sin tocar la posición de nada: si al cerrarse el
    // teclado el teléfono ha dejado el artículo fuera de la vista, lo
    // volvemos a traer con un scrollIntoView nativo (no manual). Se
    // comprueba con margen de sobra tras la animación de cierre del
    // teclado, y solo actúa si de verdad hace falta.
    //
    // Se usa la tarjeta recibida por parámetro (la que de verdad se ha
    // tocado) en vez de rowRefs.current[productId]: ese mapa solo guarda
    // una tarjeta por id de producto, así que con artículos duplicados en
    // la vista "Todos" (ver el comentario en posicionarYFijarArticulo)
    // podía devolver la copia equivocada.
    window.setTimeout(() => {
      const elemento = elementoTarjeta || rowRefs.current[productId];
      if (!elemento) return;

      const rect = elemento.getBoundingClientRect();
      const visible = rect.top >= 0 && rect.bottom <= window.innerHeight;

      if (!visible) {
        elemento.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }, 350);
  };

  const manejarEnterCantidad = (event, productId) => {
    if (event.key === "Enter") {
      event.preventDefault();
      aceptarCantidad(productId, event.target.closest("article"));
    }
  };

  const avisarSoloCajas = (productId) => {
    setSoloCajasAviso(productId);

    if (document.activeElement) {
      document.activeElement.blur();
    }

    setTimeout(() => {
      setSoloCajasAviso((actual) => (actual === productId ? null : actual));
    }, 1800);
  };

  const clearOrder = () => {
    setQuantities({});
    setCustomerName(clienteIdentificado?.nombre || "");
    setNotes("");
    setShowOrderSummary(false);
  };

  const resetToInitialState = () => {
    setQuantities({});
    setCustomerName(clienteIdentificado?.nombre || "");
    setCustomerNameFocused(false);
    setSoloCajasAviso(null);
    setNotes("");
    setSearchInput("");
    setSearch("");
    setSelectedDepartment("TODOS");
    setDepartmentDropdownOpen(false);
    setShowOrderSummary(false);
    setSelectedImage(null);
    setPushCerrado(false);
    setMostrarVolverPush(false);
    setHeaderCollapsed(false);
    localStorage.removeItem(obtenerClaveOrderStorage(clienteToken));

    window.scrollTo({ top: 0, behavior: "auto" });
  };

  function crearPedidoId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async function guardarEstadisticasPedido(
    itemsPedido = orderedItems,
    pedidoId = crearPedidoId(),
    customerNamePedido = ""
  ) {
    try {
      const movimientos = itemsPedido
        .map((item) => {
          const product = item.product;
          const cajas = Number(item.boxes || 0);
          const unidades = Number(item.units || 0);

          if (!cajas && !unidades) return null;

          return {
            pedido_id: pedidoId,
            codigo_articulo: product.codigo || product.idnum || "",
            nombre_articulo: product.name || product.nombre || "",
            departamento: product.department || product.departamento || "",
            cajas,
            unidades,
            // Se guardan en TODOS los pedidos, ganen o no premio de Ruleta o
            // Bingo (a diferencia de game_entitlements, que solo se crea
            // cuando hay premio) — así Estadísticas puede mostrar el
            // nombre del cliente y saber si vino por su enlace personal
            // en cualquier pedido.
            customer_name: customerNamePedido || null,
            cliente_token: clienteToken || null,
          };
        })
        .filter(Boolean);

      // Si este pedido_id ya tenía filas guardadas (porque es una
      // modificación de un pedido enviado antes), las sustituimos en vez
      // de acumularlas: así en Estadísticas solo aparece un pedido por
      // cliente, con el contenido más reciente.
      const { error: borrarError } = await supabase
        .from("estadisticas_movimientos")
        .delete()
        .eq("pedido_id", pedidoId);

      if (borrarError) throw borrarError;

      if (!movimientos.length) return;

      const { error: movimientosError } = await supabase
        .from("estadisticas_movimientos")
        .insert(movimientos);

      if (movimientosError) {
        throw movimientosError;
      }
    } catch (err) {
      console.error("Error guardando estadísticas:", err);
      // No bloqueamos WhatsApp si falla la estadística.
    }
  }

  function limpiarPedidoDespuesEnvio() {
    localStorage.removeItem(obtenerClaveOrderStorage(clienteToken));
    setQuantities({});
    // Si el cliente está identificado por su enlace personal, dejamos su
    // nombre puesto para el siguiente pedido (evita que un pedido
    // posterior en la misma sesión salga "Sin nombre" si el campo se
    // limpia aquí sin volver a rellenarse).
    setCustomerName(clienteIdentificado?.nombre || "");
    setCustomerNameFocused(false);
    setSoloCajasAviso(null);
    setNotes("");
    setSearchInput("");
    setSearch("");
    setSelectedDepartment("TODOS");
    setDepartmentDropdownOpen(false);
    setShowOrderSummary(false);
    setSelectedImage(null);
    setPushCerrado(false);
    setMostrarVolverPush(false);
    setHeaderCollapsed(false);
    setPedidoEnviadoActivo(false);
    setPedidoEnviadoEn(null);
    setPedidoFechaLimiteEdicion(null);
    setPedidoStatsIdActual(null);
    setAvisoPedidoPrevio(null);
    setPushRecordatorioModificacion(false);
  }

  function continuarEditandoPedidoPrevio() {
    // Los datos del pedido (cantidades, nombre, notas) ya están cargados
    // en el estado; solo cerramos el aviso y le dejamos editar
    // directamente. Antes aquí se mostraba un segundo aviso ("Tienes un
    // pedido enviado...") justo después de este mismo aviso — repetía la
    // misma información dos veces seguidas, así que se quitó.
    setAvisoPedidoPrevio(null);
  }

  function empezarPedidoNuevoTrasAviso() {
    // El cliente no quiere modificar el pedido ya enviado, quiere hacer
    // uno nuevo e independiente. El pedido anterior se queda tal cual se
    // envió por WhatsApp (no se toca ni se reenvía); aquí solo vaciamos
    // el carrito en pantalla y desvinculamos el estado de "modificación"
    // para que, al enviar, cuente como un pedido nuevo de verdad: id
    // propio y sin las restricciones de "ya jugado hoy" de Bingo/Ruleta
    // que sí aplican a una modificación del mismo pedido.
    //
    // Guardamos también qué pedido concreto ha decidido ignorar (su
    // pedido_stats_id), para que si recarga la página antes de llegar a
    // enviar el pedido nuevo, no se le recupere desde Supabase el pedido
    // que acaba de descartar ni se le vuelva a mostrar el aviso.
    guardarPedidoIgnorado(clienteToken, pedidoStatsIdActual || pedidoEnviadoEn);
    limpiarPedidoDespuesEnvio();
    setConfirmarPedidoNuevo(false);
  }

  function normalizarCodigoRuleta(codigo) {
    return String(codigo || "").trim();
  }

  function obtenerCantidadPedidoArticuloRuleta(item) {
    return Number(item.boxes || 0) + Number(item.units || 0);
  }

  function articuloPedidoCumpleCantidadMinimaRuleta(item, cantidadMinima = 1) {
    const minimo = Math.max(1, Number(cantidadMinima || 1));
    const cajasPedidas = Number(item?.boxes || 0);
    const unidadesPedidas = Number(item?.units || 0);
    const permiteUnidades = Boolean(item?.product?.permite_unidades);

    // Si el artículo permite pedir por unidades, el mínimo de la promoción
    // está expresado en unidades. En ese caso, cualquier caja pedida cumple
    // siempre, porque 1 caja es más que pedir unidades sueltas.
    if (permiteUnidades) {
      return cajasPedidas > 0 || unidadesPedidas >= minimo;
    }

    // Si el artículo no permite unidades, el mínimo se evalúa en cajas.
    return cajasPedidas >= minimo;
  }

  function pedidoCumplePromocionRuletaActual({
    itemsPedido = [],
    articulosPromocion = [],
    variedadMinima = 1,
  }) {
    const reglasPorCodigo = new Map(
      articulosPromocion
        .map((item) => {
          const codigo = normalizarCodigoRuleta(item.codigo_articulo);
          if (!codigo) return null;

          return [
            codigo,
            obtenerCantidadMinimaRuletaArticulo(item),
          ];
        })
        .filter(Boolean)
    );

    if (reglasPorCodigo.size === 0) return false;

    const codigosCumplidos = new Set();

    itemsPedido.forEach((item) => {
      const codigoArticulo = normalizarCodigoRuleta(
        item.product.codigo || item.product.idnum || ""
      );

      if (!reglasPorCodigo.has(codigoArticulo)) return;

      const cantidadMinima = reglasPorCodigo.get(codigoArticulo);

      if (articuloPedidoCumpleCantidadMinimaRuleta(item, cantidadMinima)) {
        codigosCumplidos.add(codigoArticulo);
      }
    });

    return codigosCumplidos.size >= Math.max(1, Number(variedadMinima || 1));
  }

  async function crearParticipacionPromocion({
    promocionId,
    pedidoId,
    customerNamePedido,
    tiradasRuleta = 1,
  }) {
    const tiradas = Math.max(1, Number(tiradasRuleta || 1));
    const { data, error } = await supabase.rpc("create_promotion_participation", {
      p_promotion_id: promocionId,
      p_order_id: pedidoId,
      // La participación histórica de Ruleta exige un valor único en customer_phone.
      // No usamos el teléfono real: la tabla subyacente solo permite una partida activa
      // por teléfono y bloquearía pedidos posteriores del mismo cliente identificado.
      p_customer_phone: `RULETA-${pedidoId}`,
      p_customer_name: customerNamePedido || null,
      p_expires_at: null,
      p_created_by: null,
    });

    if (error) {
      throw error;
    }

    const participacion = Array.isArray(data) ? data[0] : data;
    const participacionId = participacion?.id || participacion?.participation_id || null;
    const participacionCode = participacion?.code || participacion?.codigo || null;

    // Si la tabla ya tiene campos para varias tiradas, los dejamos guardados.
    // Si todavía no existen en Supabase, no bloqueamos el envío del pedido.
    if (tiradas > 1 && (participacionId || participacionCode)) {
      try {
        let query = supabase
          .from("promotion_participations")
          .update({
            spins_total: tiradas,
            spins_used: 0,
            status: "pending",
            played_at: null,
          });

        query = participacionId
          ? query.eq("id", participacionId)
          : query.eq("code", participacionCode);

        const { error: updateError } = await query;
        if (updateError) throw updateError;
      } catch (errorUpdate) {
        console.warn("No se pudieron guardar las tiradas extra de ruleta:", errorUpdate);
      }
    }

    return {
      ...participacion,
      tiradas_ruleta: tiradas,
      tiradas_totales: tiradas,
      spins_total: tiradas,
    };
  }

  function normalizarRespuestaRpc(raw) {
    let value = Array.isArray(raw) ? raw[0] : raw;
    const clavesAnidadas = ["result", "resultado", "data", "bingo_result", "order_result", "entitlement"];

    for (let i = 0; i < 4 && value && typeof value === "object"; i += 1) {
      const nestedKey = clavesAnidadas.find(
        (key) => value[key] && typeof value[key] === "object"
      );
      if (!nestedKey) break;
      value = Array.isArray(value[nestedKey]) ? value[nestedKey][0] : value[nestedKey];
    }

    return value;
  }

  function pedidoCumpleBingo(participacionBingo) {
    if (!participacionBingo || typeof participacionBingo !== "object") {
      return false;
    }

    const valor =
      participacionBingo.qualified ??
      participacionBingo.clasificado ??
      participacionBingo.eligible ??
      participacionBingo.cumple ??
      participacionBingo.bingo_eligible ??
      false;

    if (typeof valor === "boolean") {
      return valor;
    }

    if (typeof valor === "number") {
      return valor === 1;
    }

    if (typeof valor === "string") {
      return ["true", "1", "yes", "si", "sí"].includes(
        valor.trim().toLowerCase()
      );
    }

    return false;
  }

  function bloquesCumplidosBingo(participacionBingo) {
    if (!participacionBingo || typeof participacionBingo !== "object") return 1;
    const matched = Number(
      participacionBingo.matched ?? participacionBingo.matched_count ?? 0
    );
    const required = Number(
      participacionBingo.required ?? participacionBingo.required_count ?? 0
    );
    if (!Number.isFinite(required) || required <= 0) return 1;
    return Math.max(1, Math.floor(matched / required));
  }

  function sorteoCumpleVariedad(participacionSorteo) {
    if (!participacionSorteo || typeof participacionSorteo !== "object") return false;
    const matched = Number(participacionSorteo.matched ?? 0);
    const required = Number(participacionSorteo.required ?? 0);
    if (!Number.isFinite(required) || required <= 0) return false;
    return matched >= required;
  }

  function bloquesCumplidosSorteo(participacionSorteo) {
    if (!participacionSorteo || typeof participacionSorteo !== "object") return 0;
    const matched = Number(participacionSorteo.matched ?? 0);
    const required = Number(participacionSorteo.required ?? 0);
    if (!Number.isFinite(required) || required <= 0) return 0;
    return Math.max(0, Math.floor(matched / required));
  }

  async function crearParticipacionJuegos({
    pedidoId,
    customerNamePedido,
    participacionRuleta = null,
    tiradasRuleta = 0,
    participacionBingo = null,
    participacionSorteo = null,
  }) {
    const bingoConseguido = pedidoCumpleBingo(participacionBingo);
    const ruletaConseguida = Boolean(participacionRuleta);
    const sorteoConseguido = sorteoCumpleVariedad(participacionSorteo);

    if (!ruletaConseguida && !bingoConseguido && !sorteoConseguido) return null;

    const participacionRuletaId =
      participacionRuleta?.id || participacionRuleta?.participation_id || null;

    const { data, error } = await supabase.rpc(
      "create_or_update_game_entitlement",
      {
        p_order_id: pedidoId,
        p_customer_token: clienteToken || null,
        p_customer_name: customerNamePedido || null,
        p_roulette_participation_id: participacionRuletaId,
        p_roulette_eligible: ruletaConseguida,
        p_roulette_plays_total: ruletaConseguida
          ? Math.max(1, Number(tiradasRuleta || 1))
          : 0,
        p_bingo_eligible: bingoConseguido,
        p_bingo_reference: participacionBingo || null,
        p_bingo_plays_total: bingoConseguido
          ? Math.max(1, bloquesCumplidosBingo(participacionBingo) * Number(configuracionBingoCliente?.bolas_por_pedido || 1))
          : 0,
        p_expires_at: null,
        p_sorteo_eligible: sorteoConseguido,
        p_sorteo_plays_total: sorteoConseguido ? bloquesCumplidosSorteo(participacionSorteo) : 0,
      }
    );

    if (error) throw error;

    const entitlement = normalizarRespuestaRpc(data);
    const codigo = entitlement?.code || entitlement?.codigo || null;
    if (!codigo) {
      throw new Error("Supabase creó la participación de juegos sin devolver un código QR válido.");
    }

    return entitlement;
  }

  async function registrarPedidoParaBingo(itemsPedido, pedidoId) {
    // La función SQL es la única fuente de verdad para decidir qué artículos
    // cuentan para Bingo. Enviamos el pedido completo y Supabase aplica allí
    // promociones_bingo_articulos, cantidad_minima y permite_unidades.
    if (!clienteIdentificado?.id || !clienteToken || !configuracionBingoCliente) return null;

    const items = itemsPedido.map((item) => {
      const reglaBingo = buscarReglaBingoParaItem(item, articulosBingoCliente);

      return {
        // Bingo identifica el artículo exclusivamente por articulos.id.
        articulo_id: item?.product?.id ?? null,
        cajas: Number(item.boxes || 0),
        unidades: Number(item.units || 0),
      };
    });

    const { data, error } = await supabase.rpc("registrar_pedido_bingo", {
      p_token: clienteToken,
      p_order_id: pedidoId,
      p_items: items,
    });

    if (error) {
      console.error("No se pudo registrar el pedido para Bingo:", error);
      throw error;
    }

    const result = normalizarRespuestaRpc(data);
    if (!result || typeof result !== "object") {
      throw new Error("Supabase no devolvió una respuesta válida al registrar el pedido de Bingo.");
    }

    if (pedidoCumpleBingo(result)) setCartonBingo(null);
    return result;
  }

  async function registrarPedidoParaSorteo(itemsPedido, pedidoId) {
    // Igual que Bingo: la SQL decide qué artículos cuentan (todos, o solo
    // los de ciertos departamentos, según promociones_sorteo.modo).
    // Solo se llama para el cliente de pruebas mientras se valida en real.
    if (!clienteIdentificado?.es_pruebas || !clienteToken || !configuracionSorteoCliente) return null;

    const items = itemsPedido.map((item) => ({
      articulo_id: item?.product?.id ?? null,
      cajas: Number(item.boxes || 0),
      unidades: Number(item.units || 0),
    }));

    const { data, error } = await supabase.rpc("registrar_pedido_sorteo", {
      p_token: clienteToken,
      p_order_id: pedidoId,
      p_items: items,
    });

    if (error) {
      console.error("No se pudo registrar el pedido para el Sorteo:", error);
      throw error;
    }

    const result = normalizarRespuestaRpc(data);
    if (!result || typeof result !== "object") {
      throw new Error("Supabase no devolvió una respuesta válida al registrar el pedido de Sorteo.");
    }

    return result;
  }

  // Registra el pedido como "ya enviado" sin borrar el carrito, para que
  // el cliente pueda reabrirlo y modificarlo mientras siga dentro de
  // plazo (hasta las 4:00 AM del día de preparación). Si el pedido se ha
  // hecho fuera de la franja modificable (por la mañana, antes del
  // corte), no hay nada que guardar: se comporta como antes, limpiando
  // el carrito tras el envío. Si el cliente está identificado por su
  // enlace personal, además dejamos constancia en Supabase (un único
  // registro por cliente, se sobrescribe en cada modificación) para que
  // también pueda retomarlo desde otro dispositivo y quede accesible
  // desde el ADMIN.
  async function marcarPedidoComoEnviado({
    ventana,
    customerNamePedido,
    notesPedido,
    pedidoStatsId,
  }) {
    // Cualquier pedido que se envía a partir de aquí es el pedido
    // "actual" del cliente (sustituye al registro de pedidos_actuales),
    // así que ya no hace falta seguir protegiendo del aviso a ningún
    // pedido anterior que hubiera descartado antes.
    guardarPedidoIgnorado(clienteToken, null);

    if (!ventana.editable) {
      limpiarPedidoDespuesEnvio();
      return;
    }

    const enviadoEnIso = new Date().toISOString();
    const fechaLimiteIso = ventana.fechaLimiteEdicion.toISOString();

    // Guardado SÍNCRONO en localStorage, aquí mismo, sin depender del
    // useEffect que vigila estos estados. Justo después de esto se
    // navega a WhatsApp (window.location.assign) y esa navegación puede
    // llegar antes de que React tenga ocasión de ejecutar el efecto,
    // sobre todo en móvil, donde abrir WhatsApp saca la página a segundo
    // plano casi al instante. Si eso pasa, el localStorage se queda con
    // el pedido como "no enviado" y la siguiente vez se trata como un
    // pedido nuevo en vez de una modificación (y arrastra también el
    // Bingo: se registra con un pedidoId distinto y la regla de "1
    // pedido de Bingo al día" lo bloquea, dando "ya jugado" al escanear
    // el QR del pedido modificado). Por eso este guardado no puede
    // depender de un ciclo de render.
    savePendingOrder({
      clienteToken,
      quantities,
      customerName: customerNamePedido,
      notes: notesPedido,
      enviadoEn: enviadoEnIso,
      fechaLimiteEdicion: fechaLimiteIso,
      pedidoStatsId,
    });

    setPedidoEnviadoActivo(true);
    setPedidoEnviadoEn(enviadoEnIso);
    setPedidoFechaLimiteEdicion(fechaLimiteIso);
    setPedidoStatsIdActual(pedidoStatsId);
    setPushRecordatorioModificacion(true);

    if (!clienteIdentificado?.id) return;

    try {
      const { error } = await supabase.from("pedidos_actuales").upsert(
        {
          cliente_id: clienteIdentificado.id,
          quantities,
          customer_name: customerNamePedido,
          notes: notesPedido,
          enviado_en: enviadoEnIso,
          dia_preparacion: ventana.diaPreparacion.toISOString().slice(0, 10),
          fecha_limite_edicion: fechaLimiteIso,
          pedido_stats_id: pedidoStatsId,
        },
        { onConflict: "cliente_id" }
      );

      if (error) throw error;
    } catch (error) {
      // No bloqueamos WhatsApp si falla el guardado en Supabase: el
      // pedido ya se ha enviado y sigue editable en este mismo navegador
      // gracias al localStorage.
      console.error("No se pudo guardar el pedido actual en Supabase:", error);
    }
  }

  async function enviarPedidoFinal({
    itemsPedido,
    customerNamePedido,
    notesPedido,
    participacionRuleta = null,
    pedidoId = crearPedidoId(),
    resumenRuletaPedidoEnvio = null,
    participacionBingo = null,
    participacionJuegos = null,
    participacionSorteo = null,
  }) {
    const esModificacion = pedidoEnviadoActivo;
    const ventana = calcularVentanaPedido(new Date());

    let texto = construirTextoPedidoWhatsApp({
      t,
      itemsPedido,
      customerNamePedido,
      notesPedido,
      participacionRuleta,
      tiradasRuleta: resumenRuletaPedidoEnvio?.tiradasConseguidas || 0,
      participacionBingo,
      participacionJuegos,
      participacionSorteo,
    });

    if (esModificacion) {
      // Aviso al inicio del mensaje para que en tienda quede claro que
      // este pedido sustituye al que se envió antes por WhatsApp.
      texto = `✏️ *PEDIDO MODIFICADO* (sustituye al enviado antes)\n\n${texto}`;
    }

    // Identificador de Estadísticas: en una modificación reutilizamos el
    // que ya tenía el pedido (para sustituir sus filas), en un pedido
    // nuevo usamos el recibido en pedidoId. Desde sendByWhatsApp, este
    // "pedidoId" YA es el id estable reutilizado en modificaciones
    // (pedidoIdEstable), el mismo que se usa también para Ruleta, Bingo
    // y el QR común: un único id por pedido en todos los sitios.
    const pedidoIdEstadisticas =
      esModificacion && pedidoStatsIdActual ? pedidoStatsIdActual : pedidoId;

    // Esperamos a que termine de marcarse como enviado (localStorage ya
    // se guarda dentro de forma síncrona, y aquí además esperamos a que
    // termine —o falle— el intento de guardado en Supabase) ANTES de
    // navegar a WhatsApp. Si no se espera, la navegación puede cortar la
    // petición a Supabase a medias y el pedido queda sin marcar como
    // modificable ni en local ni en remoto.
    await marcarPedidoComoEnviado({
      ventana,
      customerNamePedido,
      notesPedido,
      pedidoStatsId: pedidoIdEstadisticas,
    });

    // Guardamos estadísticas en segundo plano, sin bloquear WhatsApp.
    guardarEstadisticasPedido(itemsPedido, pedidoIdEstadisticas, customerNamePedido);

    // Abrir en la misma pestaña es lo más fiable en móviles.
    abrirPedidoEnWhatsApp({
      whatsappNumber: WHATSAPP_NUMBER,
      texto,
    });
  }

  const sendByWhatsApp = async () => {
    if (!orderedItems.length) {
      alert(t.alertEmpty);
      return;
    }

    // Si hay un enlace personal en la URL pero todavía estamos
    // comprobando quién es el cliente (petición a Supabase en curso),
    // no dejamos enviar todavía: es la causa real de los pedidos que
    // llegaban "Sin nombre" (el token ya está disponible al instante,
    // pero el nombre tarda un poco más en llegar).
    if (cargandoCliente) {
      alert(
        "Un momento, todavía estamos comprobando tu enlace personal. Vuelve a pulsar \"Enviar\" en un par de segundos."
      );
      return;
    }

    // Snapshot del pedido en el momento exacto del clic.
    // Así podemos limpiar la app sin perder el contenido que irá a WhatsApp.
    const itemsPedido = [...orderedItems];
    // El nombre asociado al enlace personal manda siempre que exista,
    // para que un pedido nunca llegue "Sin nombre" por el simple hecho
    // de que el campo de texto esté vacío (por ejemplo, si se borró sin
    // querer o no se volvió a rellenar tras un pedido anterior). Si el
    // cliente es anónimo (sin enlace), se usa lo que haya escrito.
    //
    // Comprobación extra de seguridad: si hay token pero por lo que sea
    // "clienteIdentificado" todavía no tiene nombre en memoria (aunque
    // ya no está cargando), volvemos a preguntarle a Supabase justo
    // aquí, en el momento del envío, para no depender de ningún efecto
    // anterior. Así el nombre nunca falta si el cliente SÍ lo tiene
    // registrado en el ADMIN.
    let nombreClienteEnvio = clienteIdentificado?.nombre || "";
    if (clienteToken && !nombreClienteEnvio) {
      try {
        const { data } = await supabase
          .from("clientes")
          .select("nombre")
          .eq("token", clienteToken)
          .maybeSingle();
        nombreClienteEnvio = data?.nombre || "";
      } catch (error) {
        console.error("No se pudo volver a comprobar el nombre del cliente:", error);
      }
    }
    const customerNamePedido = (nombreClienteEnvio || customerName).trim();
    const notesPedido = notes.trim();
    const esModificacion = pedidoEnviadoActivo;

    // Identificador ESTABLE del pedido: en una modificación reutilizamos
    // el mismo que ya tenía (para Ruleta, Bingo, el QR común de premios y
    // Estadísticas), en vez de uno nuevo cada vez. Así el pedido editado
    // se sigue reconociendo como EL MISMO pedido en todos los sitios —ya
    // no vuelve a sumar bolas de Bingo como si fuera un pedido nuevo, ni
    // aparece como un "pedido" fantasma aparte (sin artículos) en el
    // panel de Pedidos y juegos del ADMIN, que es justo lo que pasaba
    // antes al usar un id distinto solo para la Ruleta.
    const pedidoIdEstable =
      esModificacion && pedidoStatsIdActual ? pedidoStatsIdActual : crearPedidoId();

    const resumenRuletaPedidoEnvio = obtenerResumenPedidoRuleta(itemsPedido);

    const cumplePromocionRuleta =
      configuracionRuleta &&
      premiosRuleta.length > 0 &&
      articulosRuleta.length > 0 &&
      resumenRuletaPedidoEnvio?.cumple;

    let participacionRuleta = null;

    if (cumplePromocionRuleta) {
      try {
        participacionRuleta = await crearParticipacionPromocion({
          promocionId: configuracionRuleta.id,
          pedidoId: pedidoIdEstable,
          customerNamePedido,
          tiradasRuleta: resumenRuletaPedidoEnvio?.tiradasConseguidas || 1,
        });
      } catch (error) {
        console.error("Error creando participación de ruleta:", error);
        const detalleError = [
          error?.code ? `Código: ${error.code}` : null,
          error?.message ? `Mensaje: ${error.message}` : null,
          error?.details ? `Detalle: ${error.details}` : null,
          error?.hint ? `Sugerencia: ${error.hint}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        if (esModificacion) {
          // En una modificación no bloqueamos el reenvío del pedido por
          // un fallo al actualizar la Ruleta: el pedido ya se registró
          // correctamente la primera vez.
          console.error(
            "No se pudo actualizar la Ruleta al modificar el pedido (se envía igualmente):",
            detalleError || error
          );
        } else {
          alert(
            `No se ha podido generar el código de ruleta.${
              detalleError ? `\n\n${detalleError}` : " Inténtalo de nuevo."
            }`
          );
          return;
        }
      }
    }

    let participacionBingo = null;
    if (clienteIdentificado?.id) {
      try {
        participacionBingo = await registrarPedidoParaBingo(itemsPedido, pedidoIdEstable);
      } catch (error) {
        const detalleErrorBingo = [
          error?.code ? `Código: ${error.code}` : null,
          error?.message ? `Mensaje: ${error.message}` : null,
          error?.details ? `Detalle: ${error.details}` : null,
          error?.hint ? `Sugerencia: ${error.hint}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        if (esModificacion) {
          // En una modificación no bloqueamos el reenvío del pedido por
          // un fallo al actualizar Bingo: el pedido ya se registró
          // correctamente la primera vez.
          console.error(
            "No se pudo actualizar el Bingo al modificar el pedido (se envía igualmente):",
            detalleErrorBingo || error
          );
        } else {
          alert(
            `El pedido no se enviará porque no se pudo registrar el Bingo.${
              detalleErrorBingo ? `\n\n${detalleErrorBingo}` : ""
            }`
          );
          return;
        }
      }
    }

    let participacionSorteo = null;
    if (clienteIdentificado?.es_pruebas) {
      try {
        participacionSorteo = await registrarPedidoParaSorteo(itemsPedido, pedidoIdEstable);
      } catch (error) {
        const detalleErrorSorteo = [
          error?.code ? `Código: ${error.code}` : null,
          error?.message ? `Mensaje: ${error.message}` : null,
          error?.details ? `Detalle: ${error.details}` : null,
          error?.hint ? `Sugerencia: ${error.hint}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        // El Sorteo está en pruebas: un fallo aquí nunca debe bloquear el
        // envío del pedido, solo se registra en consola.
        console.error(
          "No se pudo registrar el pedido para el Sorteo (se envía igualmente):",
          detalleErrorSorteo || error
        );
      }
    }

    let participacionJuegos = null;
    // El QR común debe crearse para cualquier pedido que consiga Ruleta o Bingo.
    // No puede depender de que el cliente esté identificado: los pedidos anónimos
    // también necesitan su fila en game_entitlements para que el lector los valide.
    if (
      participacionRuleta ||
      pedidoCumpleBingo(participacionBingo) ||
      sorteoCumpleVariedad(participacionSorteo)
    ) {
      try {
        participacionJuegos = await crearParticipacionJuegos({
          pedidoId: pedidoIdEstable,
          customerNamePedido,
          participacionRuleta,
          tiradasRuleta: resumenRuletaPedidoEnvio?.tiradasConseguidas || 0,
          participacionBingo,
          participacionSorteo,
        });
      } catch (error) {
        console.error("Error creando la participación común:", error);
        const detalleErrorComun = [
          error?.code ? `Código: ${error.code}` : null,
          error?.message ? `Mensaje: ${error.message}` : null,
          error?.details ? `Detalle: ${error.details}` : null,
          error?.hint ? `Sugerencia: ${error.hint}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        if (esModificacion) {
          console.error(
            "No se pudo actualizar el QR común al modificar el pedido (se envía igualmente):",
            detalleErrorComun || error
          );
        } else {
          alert(
            `El pedido no se enviará porque no se pudo generar el QR común.${
              detalleErrorComun
                ? `\n\n${detalleErrorComun}`
                : " Comprueba que la migración de staging está instalada."
            }`
          );
          return;
        }
      }
    }

    enviarPedidoFinal({
      itemsPedido,
      customerNamePedido,
      notesPedido,
      participacionRuleta,
      pedidoId: pedidoIdEstable,
      resumenRuletaPedidoEnvio,
      participacionBingo,
      participacionJuegos,
      participacionSorteo,
    });
  };

  const pushItems = Array.isArray(pushOferta?.articulos)
    ? pushOferta.articulos
    : pushOferta?.articulos
      ? [pushOferta.articulos]
      : [];

  const getPushItemImageUrl = (item) => {
    if (item?.imagen_url) return item.imagen_url;
    if (item?.foto) return getPublicPhotoUrl(item.foto);
    return "";
  };

  const pushTieneVariosComprables =
    pushItems.filter((item) => item.comprable && item.id).length > 1;

  // El enlace genérico (sin token, la URL raíz de la primera versión) y
  // los tokens inválidos o de clientes dados de baja ya no dan acceso a
  // la tienda: solo vale el enlace personal de cada cliente.
  if (!cargandoCliente && !clienteIdentificado) {
    return (
      <div style={styles.page}>
        <div style={styles.enlaceInvalidoOverlay}>
          <div style={styles.enlaceInvalidoPanel}>
            <h1 style={styles.enlaceInvalidoTitulo}>Este enlace ya no es válido</h1>
            <p style={styles.enlaceInvalidoTexto}>
              Para hacer tu pedido necesitas usar tu enlace personal. Si no lo tienes o no te
              funciona, contacta con Cash Lojo por WhatsApp y te lo enviamos.
            </p>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.enlaceInvalidoBoton}
            >
              Contactar por WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {premioSorteoPendiente && (
        <CelebracionPremio premio={premioSorteoPendiente} onCerrar={cerrarCelebracionPremioSorteo} />
      )}

      {!appInstalada && clienteToken && (
        <div style={styles.installBanner} role="region" aria-label="Instalar aplicación">
          <div style={styles.installBannerIcon}>
            <Download size={26} />
          </div>
          <div style={styles.installBannerContent}>
            <strong style={styles.installBannerTitle}>Ten Cash Lojo siempre a mano</strong>
            <span style={styles.installBannerText}>Añade esta aplicación a la pantalla de inicio de tu móvil.</span>
          </div>
          <button
            type="button"
            onClick={instalarAplicacion}
            style={styles.installButton}
            aria-label="Instalar Cash Lojo en el móvil"
          >
            Cómo instalarla
          </button>
        </div>
      )}

      {mostrarAyudaInstalacion && (
        <div style={styles.installOverlay} onClick={() => setMostrarAyudaInstalacion(false)}>
          <div style={styles.installModal} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              style={styles.installClose}
              onClick={() => setMostrarAyudaInstalacion(false)}
              aria-label="Cerrar"
            >
              ×
            </button>
            <Download size={34} />
            <h3 style={styles.installTitle}>Añadir Cash Lojo al escritorio</h3>
            <p style={styles.installText}>
              <strong>iPhone/iPad:</strong> pulsa <Share size={16} style={{ verticalAlign: "middle" }} /> Compartir y después “Añadir a pantalla de inicio”.
            </p>
            <p style={styles.installText}>
              <strong>Android:</strong> abre el menú del navegador y pulsa “Instalar aplicación” o “Añadir a pantalla de inicio”.
            </p>
            <p style={styles.installNote}>
              Se guardará este enlace personal para que el cliente entre siempre con su acceso.
            </p>
            <button
              type="button"
              onClick={confirmarAplicacionInstalada}
              style={styles.installConfirmedButton}
            >
              No volver a mostrar
            </button>
          </div>
        </div>
      )}
      {pushOferta && pushItems.length > 0 && !pushCerrado && (
        <div style={styles.pushOverlay}>
          <button
            type="button"
            onClick={cerrarPush}
            style={styles.pushCloseX}
            aria-label={t.close}
          >
            ×
          </button>

          <div style={styles.pushPanel}>
            <div style={styles.pushHeader}>
              <strong>{pushOferta.push_titulo || "🔥 Ofertas del día"}</strong>
              {pushOferta.texto && <p>{pushOferta.texto}</p>}
            </div>

            <div style={styles.pushItemsGrid}>
              {pushItems.map((item, index) => {
                const imagen = getPushItemImageUrl(item);

                return (
                  <div key={`${item.id || "info"}-${index}`} style={styles.pushItemCard}>
                    <div style={styles.pushItemImageBox}>
                      {imagen ? (
                        <img
                          src={imagen}
                          alt=""
                          style={styles.pushItemImage}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setSelectedImage(imagen);
                          }}
                        />
                      ) : (
                        <div style={styles.pushNoImage}>Sin imagen</div>
                      )}
                    </div>

                    <div style={styles.pushItemContent}>
                      <strong>{item.nombre || "Información"}</strong>
                      {item.texto && <p>{item.texto}</p>}

                      {item.comprable && item.id ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            irAlArticuloPush(item);
                          }}
                          style={styles.pushOrderButton}
                        >
                          PEDIR ARTÍCULO
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={cerrarPush}
              style={styles.pushBottomButton}
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {mostrarVolverPush && pushTieneVariosComprables && pushCerrado && (
        <button
          type="button"
          onClick={() => {
            setPushCerrado(false);
            setMostrarVolverPush(false);
            setHeaderCollapsed(false);
          }}
          style={styles.returnPushButton}
        >
          ← Volver a ofertas
        </button>
      )}


      {mostrarJuegos && clienteIdentificado && (
        <div style={styles.bingoOverlay} onClick={() => setMostrarJuegos(false)} role="presentation">
          <div
            style={{ ...styles.bingoModal, maxWidth: 420 }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Juegos"
          >
            <button type="button" onClick={() => setMostrarJuegos(false)} style={styles.bingoCloseButton} aria-label="Cerrar Juegos">
              <X size={24} />
            </button>
            <div style={styles.juegosSelectorBody}>
              <h2 style={styles.juegosSelectorTitulo}>🎮 Juegos</h2>
              <p style={styles.juegosSelectorSubtitulo}>Elige a cuál quieres entrar</p>
              <div style={styles.juegosSelectorGrid}>
                {configuracionBingoCliente && (
                  <button
                    type="button"
                    onClick={() => { setMostrarJuegos(false); abrirMiBingo(); }}
                    style={styles.juegoTarjeta}
                  >
                    <span style={styles.juegoTarjetaIcono}>🎱</span>
                    <span style={styles.juegoTarjetaTitulo}>Bingo</span>
                    {fechaLimiteBingoPropia && (
                      <span style={styles.juegoTarjetaSubtitulo}>
                        hasta {new Date(fechaLimiteBingoPropia).toLocaleDateString("es-ES")}
                      </span>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!configuracionSorteoCliente) return;
                    setMostrarJuegos(false);
                    abrirMiSorteo();
                  }}
                  disabled={!configuracionSorteoCliente}
                  style={{
                    ...styles.juegoTarjeta,
                    ...styles.juegoTarjetaSorteo,
                    ...(configuracionSorteoCliente ? null : styles.juegoTarjetaCapada),
                  }}
                >
                  <span style={styles.juegoTarjetaIcono}>🎟️</span>
                  <span style={styles.juegoTarjetaTitulo}>Sorteo</span>
                  {!configuracionSorteoCliente && (
                    <span style={styles.juegoTarjetaSubtitulo}>Aún no disponible</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarMiSorteo && clienteIdentificado && (
        <div style={styles.bingoOverlay} onClick={() => setMostrarMiSorteo(false)} role="presentation">
          <div
            style={styles.bingoModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Mi Sorteo"
          >
            <button type="button" onClick={() => setMostrarMiSorteo(false)} style={styles.bingoCloseButton} aria-label="Cerrar Mi Sorteo">
              <X size={24} />
            </button>
            <div style={styles.bingoModalBody}>
              <h2 style={{ margin: "0 0 12px" }}>🎟️ Mi Sorteo</h2>

              {cargandoSorteo && <div style={styles.bingoStatusBox}>Cargando tus números...</div>}
              {!cargandoSorteo && errorSorteo && <div style={styles.bingoErrorBox}>{errorSorteo}</div>}

              {!cargandoSorteo && !errorSorteo && numerosSorteoCliente.length === 0 && (
                <div style={styles.bingoStatusBox}>
                  Todavía no tienes ningún número. Se te asigna uno por cada {configuracionSorteoCliente?.variedad_minima || 10} artículos distintos que pidas.
                </div>
              )}

              {!cargandoSorteo && !errorSorteo && numerosSorteoCliente.length > 0 && (
                <div style={{ display: "grid", gap: 10 }}>
                  {numerosSorteoCliente.map((n, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        borderRadius: 12,
                        background: n.ganador ? "#dcfce7" : "#f0fdf4",
                        border: n.ganador ? "2px solid #16a34a" : "1px solid #bbf7d0",
                      }}
                    >
                      <div>
                        <strong>{n.edition_nombre}</strong>
                        <div style={{ fontSize: 13, color: "#166534" }}>
                          {n.estado === "resuelta"
                            ? n.ganador
                              ? "¡Enhorabuena, este número ha sido el premiado!"
                              : `Resuelto · número premiado: ${String(n.numero_premiado).padStart(2, "0")}`
                            : "Cuadrícula aún en juego"}
                        </div>
                      </div>
                      <div style={{ fontSize: 30, fontWeight: 900, color: "#166534" }}>
                        {String(n.numero).padStart(2, "0")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {mostrarBingo && clienteIdentificado && configuracionBingoCliente && (
        <div
          style={styles.bingoOverlay}
          onClick={() => setMostrarBingo(false)}
          role="presentation"
        >
          <div
            style={styles.bingoModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Mi Bingo personal"
          >
            <button
              type="button"
              onClick={() => setMostrarBingo(false)}
              style={styles.bingoCloseButton}
              aria-label="Cerrar Mi Bingo"
            >
              <X size={24} />
            </button>

            <div style={styles.bingoModalBody}>
              {cargandoBingo && (
                <div style={styles.bingoStatusBox}>Preparando tu cartón...</div>
              )}

              {!cargandoBingo && errorBingo && (
                <div style={styles.bingoErrorBox}>{errorBingo}</div>
              )}

              {!cargandoBingo && !errorBingo && cartonBingo && (
                <>
                  <BingoDrum
                    editionId={cartonBingo.edition_id}
                    customerToken={clienteToken}
                    initialNumbers={cartonBingo.drawn_numbers}
                    onNumbersChange={(numbers) => setCartonBingo((current) => current ? { ...current, drawn_numbers: numbers } : current)}
                  />
                  <BingoCard
                    card={cartonBingo.card}
                    drawnNumbers={cartonBingo.drawn_numbers}
                    customerName={clienteIdentificado.nombre}
                    linePrize={premiosBingo.line}
                    lineSpecialPrize={premiosBingo.lineSpecial}
                    bingoPrize={premiosBingo.bingo}
                    specialPrize={premiosBingo.special}
                    endDate={cartonBingo.fecha_limite ? cartonBingo.fecha_limite.slice(0, 10) : ""}
                  />

                </>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <div style={styles.imageOverlay} onClick={() => setSelectedImage(null)}>
          <button
            type="button"
            style={styles.imageClose}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setSelectedImage(null);
            }}
          >
            ×
          </button>
          <img src={selectedImage} alt="" style={styles.bigImage} />
        </div>
      )}

      <div style={styles.topArea} data-top-area="true">
        {!headerCollapsed && (
          <>
            <header style={styles.header}>
              <div style={styles.logoBlock}>
                {!logoError ? (
                  <img
                    src={logoLojo}
                    alt="Cash Lojo"
                    style={styles.logo}
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div style={styles.logoFallback}>Lojo</div>
                )}

                <div>
                  <div style={styles.brandTitle}>CASH LOJO</div>
                  <h1 style={styles.title}>{t.title}</h1>
                  <p style={styles.subtitle}>{t.subtitle}</p>
                </div>
              </div>
            </header>

            <section style={styles.customerPanel}>
              <div style={styles.languageLine}>
                <label style={styles.labelCompact}>{t.language}</label>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  style={styles.selectInputCompact}
                >
                  <option value="es">ES Español</option>
                  <option value="zh">中文</option>
                </select>
              </div>

              {cargandoCliente && (
                <div style={styles.clienteSesionCargando}>
                  Comprobando enlace personal...
                </div>
              )}

              {!cargandoCliente && clienteIdentificado && (
                <div style={styles.clienteSesionActiva}>
                  <strong>Hola, {clienteIdentificado.nombre}</strong>
                  <span>Cliente identificado · ventajas personales activadas</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSoloFavoritos((valor) => !valor);
                      setSelectedDepartment("TODOS");
                      setSearch("");
                      setSearchInput("");
                    }}
                    style={{
                      ...styles.favoritesFilterButton,
                      ...(soloFavoritos ? styles.favoritesFilterButtonActive : {}),
                    }}
                  >
                    <Star size={16} fill={soloFavoritos ? "currentColor" : "none"} />
                    {soloFavoritos ? "Ver todos" : `Mis favoritos (${favoritos.size})`}
                  </button>
                  {configuracionBingoCliente && !clienteIdentificado?.es_pruebas && (
                    <button
                      type="button"
                      onClick={abrirMiBingo}
                      style={styles.bingoButton}
                      title={fechaLimiteBingoPropia ? `Disponible hasta el ${new Date(fechaLimiteBingoPropia).toLocaleDateString("es-ES")}` : "Bingo activo"}
                    >
                      <Grid3X3 size={17} />
                      Mi Bingo{fechaLimiteBingoPropia ? ` · hasta ${new Date(fechaLimiteBingoPropia).toLocaleDateString("es-ES")}` : ""}
                    </button>
                  )}
                  {/* Pestaña "Juegos" (Bingo + Sorteo en pantalla de selección):
                      de momento solo para el cliente de pruebas, mientras se
                      valida el Sorteo en real. Cuando se confirme, basta con
                      quitar la condición es_pruebas de aquí y del bloque de
                      arriba para que sustituya a "Mi Bingo" para todos. */}
                  {clienteIdentificado?.es_pruebas && (
                    <button type="button" onClick={() => setMostrarJuegos(true)} style={styles.bingoButton}>
                      <Grid3X3 size={17} />
                      Juegos
                    </button>
                  )}
                  {cargandoFavoritos && <small>Cargando favoritos...</small>}
                  {errorFavoritos && <small style={styles.favoritesError}>{errorFavoritos}</small>}
                </div>
              )}

              <label style={styles.labelCompact}>{t.customerName}</label>
              <input
                type="text"
                value={customerName}
                readOnly={Boolean(clienteIdentificado)}
                onFocus={() => setCustomerNameFocused(true)}
                onBlur={() => setCustomerNameFocused(false)}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder={t.optional}
                style={{
                  ...styles.inputCompact,
                  borderColor: customerNameFocused ? "#2563eb" : "#aeb7ff",
                  ...(clienteIdentificado ? styles.inputClienteIdentificado : {}),
                }}
              />
            </section>
          </>
        )}

        <section style={headerCollapsed ? styles.searchStickyCollapsed : styles.searchSticky}>
          <div style={styles.compactTopRow}>
            <div style={styles.searchInputWrap}>
              <Search size={16} color="#64748b" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setSearch(event.target.value);
                  if (event.target.value.trim()) {
                    setSelectedDepartment("TODOS");
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();

                    setTimeout(() => {
                      window.scrollTo({
                        top: window.scrollY,
                        behavior: "auto",
                      });
                    }, 80);
                  }
                }}
                placeholder={t.searchPlaceholder}
                style={styles.searchInput}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowOrderSummary(true)}
              style={styles.topReviewButton}
            >
              {t.review}
            </button>
          </div>

          <div ref={departmentDropdownRef} style={styles.departmentBox}>
            <button
              type="button"
              style={styles.departmentButton}
              onClick={() => setDepartmentDropdownOpen((open) => !open)}
            >
              <span style={styles.departmentButtonLeft}>
                <Grid3X3 size={18} />
                <span style={styles.departmentButtonLabel}>
                  <span style={styles.departmentButtonCaption}>{t.department}</span>
                  <strong>{getDepartmentLabel(selectedDepartment, language)}</strong>
                </span>
              </span>
              <ChevronDown size={19} strokeWidth={3} />
            </button>

            {departmentDropdownOpen && createPortal(
              <div
                style={styles.departmentMenuOverlay}
                onClick={() => setDepartmentDropdownOpen(false)}
              >
                <div
                  style={styles.departmentMenuSheet}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div style={styles.departmentMenuSheetHeader}>
                    <strong>{t.department}</strong>
                    <button
                      type="button"
                      onClick={() => setDepartmentDropdownOpen(false)}
                      style={styles.departmentMenuCloseButton}
                      aria-label="Cerrar"
                    >
                      <X size={16} strokeWidth={3} />
                    </button>
                  </div>
                  <div style={styles.departmentMenuSheetList}>
                    {departmentOptions.map((option) => (
                      <button
                        key={option.name}
                        type="button"
                        onClick={() => {
                          setSelectedDepartment(option.name);
                          setDepartmentDropdownOpen(false);
                        }}
                        style={{
                          ...styles.departmentOption,
                          ...(["RULETA", "BINGO"].includes(option.name)
                            ? styles.departmentOptionPromo
                            : {}),
                        }}
                      >
                        <span>{option.label}</span>
                        <span style={styles.departmentCount}>{option.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>

          {resumenRuletaPedido && (
            <div style={styles.ruletaProgressPanel}>
              <div style={styles.ruletaProgressHeader}>
                <span style={styles.ruletaProgressTitle}>🎡 Progreso Ruleta</span>
                <strong>
                  {resumenRuletaPedido.variedadActual}/{resumenRuletaPedido.variedadMinima}
                </strong>
              </div>
              <div style={styles.ruletaProgressTrack}>
                <div
                  style={{
                    ...styles.ruletaProgressFill,
                    width: `${Math.min(
                      100,
                      (resumenRuletaPedido.variedadParaSiguienteTirada /
                        resumenRuletaPedido.variedadMinima) *
                        100
                    )}%`,
                  }}
                />
              </div>
              <div style={styles.ruletaProgressMessage}>
                {resumenRuletaPedido.tiradasConseguidas > 0
                  ? `Tienes ${resumenRuletaPedido.tiradasConseguidas} ${
                      resumenRuletaPedido.tiradasConseguidas === 1
                        ? "tirada"
                        : "tiradas"
                    }. Te faltan ${
                      resumenRuletaPedido.variedadRestanteSiguienteTirada
                    } artículos diferentes para la siguiente.`
                  : `Te faltan ${resumenRuletaPedido.variedadRestante} artículos diferentes de Ruleta para conseguir una tirada.`}
              </div>
            </div>
          )}

          {resumenSorteoPedido && (
            <div style={styles.ruletaProgressPanel}>
              <div style={styles.ruletaProgressHeader}>
                <span style={styles.ruletaProgressTitle}>🎟️ Progreso Sorteo</span>
                <strong>
                  {resumenSorteoPedido.variedadMinima - resumenSorteoPedido.variedadRestanteSiguiente}/
                  {resumenSorteoPedido.variedadMinima}
                </strong>
              </div>
              <div style={styles.ruletaProgressTrack}>
                <div
                  style={{
                    ...styles.ruletaProgressFill,
                    width: `${Math.min(
                      100,
                      ((resumenSorteoPedido.variedadMinima - resumenSorteoPedido.variedadRestanteSiguiente) /
                        resumenSorteoPedido.variedadMinima) *
                        100
                    )}%`,
                  }}
                />
              </div>
              <div style={styles.ruletaProgressMessage}>
                {resumenSorteoPedido.numerosConseguidos > 0
                  ? `Tienes ${resumenSorteoPedido.numerosConseguidos} ${
                      resumenSorteoPedido.numerosConseguidos === 1 ? "número" : "números"
                    } de Sorteo. Te faltan ${resumenSorteoPedido.variedadRestanteSiguiente} artículos diferentes para el siguiente.`
                  : `Te faltan ${resumenSorteoPedido.variedadRestante} artículos diferentes para conseguir un número de Sorteo.`}
              </div>
            </div>
          )}
        </section>
      </div>

      <main
        style={{
          ...styles.catalog,
          ...styles.catalogMinScrollRoom,
          ...(selectedDepartment !== "TODOS" && !search.trim()
            ? styles.catalogSingleDepartment
            : {}),
          ...(soloFavoritos && clienteIdentificado
            ? styles.catalogFavoritesMode
            : {}),
        }}
      >
        {cargando && <p style={styles.loading}>{t.loading}</p>}
        {errorCatalogo && <p style={styles.error}>{errorCatalogo}</p>}

        {!cargando &&
          filteredDepartments.map((department) => (
            <section key={department.name} style={styles.departmentSection}>
              {!(soloFavoritos && clienteIdentificado) && (
                <h2
                  style={{
                    ...styles.departmentTitle,
                    ...(["RULETA", "BINGO"].includes(department.name)
                      ? styles.departmentTitlePromo
                      : {}),
                  }}
                >
                  {getDepartmentLabel(department.name, language)}
                  <span style={styles.departmentTitleCount}>
                    {department.products.length} {t.articles}
                  </span>
                </h2>
              )}

              {department.products.length === 0 ? (
                <div style={styles.emptyBox}>{t.noItems}</div>
              ) : (
                <div style={styles.productsGrid}>
                {department.products.map((product) => {
                  const quantity = quantities[product.id] || {};

                  return (
                    <article
                      key={product.id}
                      ref={(element) => {
                        rowRefs.current[product.id] = element;
                      }}
                      style={{
                        ...styles.productCard,
                        ...(articuloDestacado === product.id
                          ? styles.productCardHighlighted
                          : {}),
                      }}
                    >
                      <div
                        style={styles.photoBox}
                        onClick={() => setFichaProductoId(product.id)}
                      >
                        {product.image ? (
                          <img
                            src={product.image}
                            alt=""
                            style={styles.productImage}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span style={styles.noPhoto}>{t.noPhoto}</span>
                        )}

                        {(Number(quantity.boxes) > 0 || Number(quantity.units) > 0) && (
                          <span style={styles.quantityBadge}>
                            {Number(quantity.boxes) > 0
                              ? `${quantity.boxes} ${t.boxes}`
                              : `${quantity.units} ${t.units}`}
                          </span>
                        )}
                      </div>

                      <div style={styles.productContent}>
                        <div style={styles.productTop}>
                          <div style={styles.productTitleBlock}>
                            <h3 style={styles.productName}>
                              {product.codigo ? `${product.codigo} · ` : ""}
                              {product.name}
                            </h3>

                            <div style={styles.badges}>
                              {product.novedad && (
                                <span style={styles.newsBadge}>⭐ {t.news}</span>
                              )}

                              {product.offerText && (
                                <span style={styles.offerBadge}>
                                  🏷️ {product.offerText}
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={styles.productTopActions}>
                            {(product.participaRuleta || (product.participaBingo && clienteIdentificado)) && (
                              <MiniPromocionesBadge
                                participaRuleta={product.participaRuleta}
                                cantidadMinimaRuleta={product.cantidadMinimaRuleta}
                                permiteUnidadesRuleta={product.permite_unidades}
                                participaBingo={product.participaBingo}
                                cantidadMinimaBingo={product.cantidadMinimaBingo}
                                permiteUnidadesBingo={product.permite_unidades}
                                mostrarBingo={Boolean(clienteIdentificado)}
                              />
                            )}

                            {clienteIdentificado && (
                              <button
                                type="button"
                                onClick={() => alternarFavorito(product.id)}
                                style={{
                                  ...styles.favoriteButton,
                                  ...(favoritos.has(String(product.id))
                                    ? styles.favoriteButtonActive
                                    : {}),
                                }}
                                aria-label={
                                  favoritos.has(String(product.id))
                                    ? "Quitar de favoritos"
                                    : "Añadir a favoritos"
                                }
                                title={
                                  favoritos.has(String(product.id))
                                    ? "Quitar de favoritos"
                                    : "Añadir a favoritos"
                                }
                              >
                                <Star
                                  size={20}
                                  fill={
                                    favoritos.has(String(product.id))
                                      ? "currentColor"
                                      : "none"
                                  }
                                />
                              </button>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setFichaProductoId(product.id)}
                          style={
                            Number(quantity.boxes) > 0 || Number(quantity.units) > 0
                              ? styles.addButtonActive
                              : styles.addButton
                          }
                        >
                          {Number(quantity.boxes) > 0 || Number(quantity.units) > 0
                            ? "Editar cantidad"
                            : "Añadir"}
                        </button>
                      </div>
                    </article>
                  );
                })}
                </div>
              )}
            </section>
          ))}
      </main>

      {(() => {
        if (!fichaProductoId) return null;
        const fichaProducto = productos.find((item) => item.id === fichaProductoId);
        if (!fichaProducto) return null;
        const fichaQuantity = quantities[fichaProductoId] || {};

        const estadoRuleta = fichaProducto.participaRuleta
          ? obtenerEstadoArticuloRuleta(fichaProducto, fichaQuantity)
          : null;
        const estadoBingo = obtenerEstadoArticuloBingo(fichaProducto, fichaQuantity);
        const rouletteOk = Boolean(estadoRuleta?.completo);
        const bingoOk = Boolean(estadoBingo?.completo);
        // Reservamos hueco fijo para estos avisos SIEMPRE que el artículo
        // participe en Ruleta o Bingo, aunque de momento no haya ningún
        // mensaje que mostrar (cantidad a 0 todavía). Así, cuando el
        // cliente mete cantidad y aparece o cambia el aviso, el hueco ya
        // estaba reservado de antes y ni la foto ni el resto de la ficha
        // se desplazan.
        const tienePromoRuletaOBingo = Boolean(
          fichaProducto.participaRuleta ||
            (fichaProducto.participaBingo && clienteIdentificado)
        );

        const campoActivoCajas = campoCantidadActivo === `${fichaProducto.id}:boxes`;
        const campoActivoUnidades = campoCantidadActivo === `${fichaProducto.id}:units`;
        const cantidadEscrita = campoActivoCajas
          ? fichaQuantity.boxes
          : campoActivoUnidades
            ? fichaQuantity.units
            : "";
        const mostrarAceptarCantidad =
          (campoActivoCajas || campoActivoUnidades) &&
          cantidadEscrita !== "" &&
          cantidadEscrita != null;

        return (
          <div style={styles.fichaOverlay} onClick={() => setFichaProductoId(null)}>
            <div style={styles.fichaPanel} onClick={(event) => event.stopPropagation()}>
              <div style={styles.fichaPhotoBox}>
                {fichaProducto.image ? (
                  <img
                    src={fichaProducto.image}
                    alt=""
                    style={styles.productImage}
                    onClick={() => setSelectedImage(fichaProducto.image)}
                  />
                ) : (
                  <span style={styles.noPhoto}>{t.noPhoto}</span>
                )}
                {clienteIdentificado && (
                  <button
                    type="button"
                    onClick={() => alternarFavorito(fichaProducto.id)}
                    style={{
                      ...styles.fichaFavoriteButton,
                      ...(favoritos.has(String(fichaProducto.id))
                        ? styles.fichaFavoriteButtonActive
                        : {}),
                    }}
                    aria-label={
                      favoritos.has(String(fichaProducto.id))
                        ? "Quitar de favoritos"
                        : "Añadir a favoritos"
                    }
                    title={
                      favoritos.has(String(fichaProducto.id))
                        ? "Quitar de favoritos"
                        : "Añadir a favoritos"
                    }
                  >
                    <Star
                      size={16}
                      fill={
                        favoritos.has(String(fichaProducto.id))
                          ? "currentColor"
                          : "none"
                      }
                    />
                    <span style={styles.fichaFavoriteButtonText}>
                      {favoritos.has(String(fichaProducto.id)) ? (
                        <>
                          Quitar de
                          <br />
                          Mis Favoritos
                        </>
                      ) : (
                        <>
                          Añadir a
                          <br />
                          Mis Favoritos
                        </>
                      )}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFichaProductoId(null)}
                  style={styles.fichaCloseButton}
                  aria-label="Cerrar"
                >
                  <X size={16} strokeWidth={3} />
                </button>
              </div>

              <div style={styles.fichaBody}>
                {fichaProducto.codigo && (
                  <p style={styles.fichaProductCode}>{fichaProducto.codigo}</p>
                )}
                <h3 style={styles.fichaProductName}>{fichaProducto.name}</h3>

                <div style={styles.badges}>
                  {fichaProducto.novedad && (
                    <span style={styles.newsBadge}>⭐ {t.news}</span>
                  )}
                  {fichaProducto.offerText && (
                    <span style={styles.offerBadge}>🏷️ {fichaProducto.offerText}</span>
                  )}
                </div>

                {(fichaProducto.participaRuleta ||
                  (fichaProducto.participaBingo && clienteIdentificado)) && (
                  <div style={styles.fichaPromoBadgeWrap}>
                    <MiniPromocionesBadge
                      participaRuleta={fichaProducto.participaRuleta}
                      cantidadMinimaRuleta={fichaProducto.cantidadMinimaRuleta}
                      permiteUnidadesRuleta={fichaProducto.permite_unidades}
                      participaBingo={fichaProducto.participaBingo}
                      cantidadMinimaBingo={fichaProducto.cantidadMinimaBingo}
                      permiteUnidadesBingo={fichaProducto.permite_unidades}
                      mostrarBingo={Boolean(clienteIdentificado)}
                    />
                  </div>
                )}

                <p style={styles.fichaSectionLabel}>Cantidad</p>
                <div style={styles.fichaQuantityCard}>
                <div style={styles.quantityGrid}>
                  <div style={styles.quantityRow}>
                    <span style={styles.quantityLabel}>{t.boxes}</span>
                    <div style={styles.stepperControl}>
                      <button
                        type="button"
                        onClick={() => stepQuantity(fichaProducto.id, "boxes", -1)}
                        style={styles.stepperButtonMinus}
                        aria-label="Restar caja"
                      >
                        <Minus size={18} strokeWidth={3} />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="done"
                        min="0"
                        step="1"
                        autoComplete="off"
                        ref={(element) => {
                          cajasInputRefs.current[fichaProducto.id] = element;
                        }}
                        value={fichaQuantity.boxes || ""}
                        onFocus={() => activarCampoCantidad(fichaProducto.id, "boxes")}
                        onKeyDown={(event) => manejarEnterCantidad(event, fichaProducto.id)}
                        onBlur={() => setCampoCantidadActivo(null)}
                        onChange={(event) =>
                          updateQuantity(
                            fichaProducto.id,
                            "boxes",
                            event.target.value.replace(/[^0-9]/g, "")
                          )
                        }
                        style={{
                          ...styles.quantityInputFicha,
                          ...(campoActivoCajas ? styles.quantityInputActive : {}),
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => stepQuantity(fichaProducto.id, "boxes", 1)}
                        style={styles.stepperButtonPlus}
                        aria-label="Sumar caja"
                      >
                        <Plus size={18} strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                  <div style={styles.quantityRow}>
                    <span style={styles.quantityLabel}>
                      {t.units.includes(" ") ? (
                        <>
                          {t.units.split(" ")[0]}
                          <br />
                          {t.units.split(" ").slice(1).join(" ")}
                        </>
                      ) : (
                        t.units
                      )}
                    </span>
                    <div style={styles.stepperControl}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!fichaProducto.permite_unidades) {
                            avisarSoloCajas(fichaProducto.id);
                            return;
                          }
                          stepQuantity(fichaProducto.id, "units", -1);
                        }}
                        style={
                          fichaProducto.permite_unidades
                            ? styles.stepperButtonMinus
                            : styles.stepperButtonDisabled
                        }
                        aria-label="Restar unidad"
                      >
                        <Minus size={18} strokeWidth={3} />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="done"
                        min="0"
                        step="1"
                        autoComplete="off"
                        readOnly={!fichaProducto.permite_unidades}
                        value={fichaProducto.permite_unidades ? fichaQuantity.units || "" : ""}
                        placeholder={fichaProducto.permite_unidades ? "" : "—"}
                        onFocus={() => {
                          activarCampoCantidad(fichaProducto.id, "units");
                          if (!fichaProducto.permite_unidades) {
                            avisarSoloCajas(fichaProducto.id);
                          }
                        }}
                        onClick={() => {
                          if (!fichaProducto.permite_unidades) {
                            avisarSoloCajas(fichaProducto.id);
                          }
                        }}
                        onKeyDown={(event) => manejarEnterCantidad(event, fichaProducto.id)}
                        onBlur={() => setCampoCantidadActivo(null)}
                        onChange={(event) =>
                          updateQuantity(
                            fichaProducto.id,
                            "units",
                            event.target.value.replace(/[^0-9]/g, "")
                          )
                        }
                        style={{
                          ...(fichaProducto.permite_unidades
                            ? styles.quantityInputFicha
                            : styles.quantityInputBlockedFicha),
                          ...(fichaProducto.permite_unidades && campoActivoUnidades
                            ? styles.quantityInputActive
                            : {}),
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!fichaProducto.permite_unidades) {
                            avisarSoloCajas(fichaProducto.id);
                            return;
                          }
                          stepQuantity(fichaProducto.id, "units", 1);
                        }}
                        style={
                          fichaProducto.permite_unidades
                            ? styles.stepperButtonPlus
                            : styles.stepperButtonDisabled
                        }
                        aria-label="Sumar unidad"
                      >
                        <Plus size={18} strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                  {mostrarAceptarCantidad && (
                    <button
                      type="button"
                      style={styles.acceptQuantityButton}
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() => aceptarCantidad(fichaProducto.id)}
                      aria-label="Aceptar cantidad"
                    >
                      <Check size={15} strokeWidth={3} />
                      <span>Aceptar cantidad</span>
                    </button>
                  )}
                </div>
                </div>

                {tienePromoRuletaOBingo && (
                  <div style={styles.fichaPromoStatusWrap}>
                    {(estadoRuleta || estadoBingo) &&
                      (rouletteOk && bingoOk ? (
                        <div style={styles.ruletaProductStatusOk}>
                          ✓ Este artículo ya cuenta para Ruleta y Bingo
                        </div>
                      ) : (
                        <>
                          {estadoRuleta && (
                            <div style={rouletteOk ? styles.ruletaProductStatusOk : styles.ruletaProductStatusPending}>
                              {estadoRuleta.texto}
                            </div>
                          )}
                          {estadoBingo && (
                            <div style={bingoOk ? styles.ruletaProductStatusOk : styles.ruletaProductStatusPending}>
                              {estadoBingo.texto}
                            </div>
                          )}
                        </>
                      ))}
                  </div>
                )}

                {!fichaProducto.permite_unidades && soloCajasAviso === fichaProducto.id && (
                  <div style={styles.onlyBoxesMessage}>{t.onlyBoxes}</div>
                )}
              </div>

              <div style={styles.fichaFooter}>
                <button
                  type="button"
                  onClick={() => setFichaProductoId(null)}
                  style={styles.fichaListoButton}
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <button
        type="button"
        onClick={() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
          setSearchInput("");
          setSearch("");
          searchInputRef.current?.focus();
        }}
        style={styles.scrollTopButton}
        aria-label="Volver al inicio"
        title="Volver al inicio"
      >
        <ArrowUp size={18} strokeWidth={3} />
      </button>

      <div ref={stickyCardRef} style={styles.stickySummary}>
        <div>
          <strong>{t.summary}</strong>
          <div style={styles.summarySmall}>
            {selectedCount} {t.itemsWithQuantity}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowOrderSummary(true)}
          style={styles.reviewButton}
        >
          <ShoppingCart size={18} />
          {t.reviewAndSend}
        </button>
      </div>

      {avisoPedidoPrevio && (
        <div style={styles.avisoModificacionOverlay}>
          <div style={styles.avisoModificacionPanel}>
            <h2 style={styles.avisoModificacionTitulo}>{t.avisoModificacionTitulo}</h2>
            <p style={styles.avisoModificacionTexto}>{t.avisoModificacionTexto}</p>

            <button
              type="button"
              onClick={continuarEditandoPedidoPrevio}
              style={styles.avisoModificacionBotonPrimario}
            >
              {t.avisoModificacionSeguir}
            </button>

            <button
              type="button"
              onClick={() => setConfirmarPedidoNuevo(true)}
              style={styles.avisoModificacionBotonSecundario}
            >
              {t.avisoModificacionNuevo}
            </button>
          </div>
        </div>
      )}

      {avisoPedidoPrevio && confirmarPedidoNuevo && (
        <div style={styles.avisoModificacionOverlay}>
          <div style={styles.avisoModificacionPanel}>
            <h2 style={styles.avisoModificacionTitulo}>¿Empezar un pedido nuevo?</h2>
            <p style={styles.avisoModificacionTexto}>
              Se vaciará el pedido que tienes ahora en pantalla. Tu pedido ya enviado no se toca ni se
              cancela, sigue como lo mandaste.
            </p>

            <button
              type="button"
              onClick={empezarPedidoNuevoTrasAviso}
              style={styles.avisoModificacionBotonPrimario}
            >
              Sí, empezar pedido nuevo
            </button>

            <button
              type="button"
              onClick={() => setConfirmarPedidoNuevo(false)}
              style={styles.avisoModificacionBotonSecundario}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {pushRecordatorioModificacion && (
        <div style={styles.avisoModificacionOverlay}>
          <div style={styles.avisoModificacionPanel}>
            <h2 style={styles.avisoModificacionTitulo}>{t.pushRecordatorioTitulo}</h2>
            <p style={styles.avisoModificacionTexto}>{t.pushRecordatorioTexto}</p>

            <button
              type="button"
              onClick={() => setPushRecordatorioModificacion(false)}
              style={styles.avisoModificacionBotonPrimario}
            >
              {t.pushRecordatorioAceptar}
            </button>
          </div>
        </div>
      )}

      {showOrderSummary && (
        <div style={styles.summaryOverlay}>
          <div style={styles.summaryPanel}>
            <button
              type="button"
              onClick={() => setShowOrderSummary(false)}
              style={styles.summaryClose}
            >
              ×
            </button>

            <h2 style={styles.summaryTitle}>{t.orderSummary}</h2>

            <label style={styles.label}>{t.customerName}</label>
            <input
              type="text"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder={t.optional}
              style={styles.summaryCustomerInput}
            />

            {resumenRuletaPedido && orderedItems.length > 0 && (
              <div
                style={
                  resumenRuletaPedido.cumple
                    ? styles.ruletaSummaryOk
                    : styles.ruletaSummaryPending
                }
              >
                <div style={styles.ruletaSummaryTitle}>Promoción Ruleta</div>
                <div style={styles.ruletaSummaryText}>
                  Llevas {resumenRuletaPedido.variedadActual} artículos válidos de ruleta.
                </div>
                <div style={styles.ruletaSummaryText}>
                  Tiradas conseguidas: {resumenRuletaPedido.tiradasConseguidas}
                </div>
                {!resumenRuletaPedido.cumple && (
                  <div style={styles.ruletaSummaryMissing}>
                    Te faltan {resumenRuletaPedido.variedadRestante} artículos diferentes de ruleta para conseguir 1 tirada.
                  </div>
                )}
                {resumenRuletaPedido.cumple && (
                  <div style={styles.ruletaSummaryMissing}>
                    Ya tienes {resumenRuletaPedido.tiradasConseguidas} {resumenRuletaPedido.tiradasConseguidas === 1 ? "tirada" : "tiradas"}. Te faltan {resumenRuletaPedido.variedadRestanteSiguienteTirada} artículos diferentes más para la siguiente.
                  </div>
                )}
              </div>
            )}

            {resumenBingoPedido && orderedItems.length > 0 && (
              <div
                style={
                  resumenBingoPedido.cumple
                    ? styles.bingoSummaryOk
                    : styles.bingoSummaryPending
                }
              >
                <div style={styles.ruletaSummaryTitle}>Promoción Bingo</div>
                <div style={styles.ruletaSummaryText}>
                  Llevas {resumenBingoPedido.variedadActual} {resumenBingoPedido.variedadActual === 1 ? "artículo válido" : "artículos válidos"} para Bingo.
                </div>
                {resumenBingoPedido.cumple ? (
                  <div style={styles.bingoSummaryMessage}>
                    Has conseguido {resumenBingoPedido.bolasConseguidas} {resumenBingoPedido.bolasConseguidas === 1 ? "bola" : "bolas"} de Bingo. Se {resumenBingoPedido.bolasConseguidas === 1 ? "incluirá" : "incluirán"} en el QR del pedido.
                  </div>
                ) : (
                  <div style={styles.bingoSummaryMessage}>
                    Te faltan {resumenBingoPedido.variedadRestante} {resumenBingoPedido.variedadRestante === 1 ? "artículo distinto en cajas" : "artículos distintos en cajas"} para conseguir {resumenBingoPedido.bolasPorBloque} {resumenBingoPedido.bolasPorBloque === 1 ? "bola" : "bolas"}.
                  </div>
                )}
                <div style={styles.bingoSummaryNote}>
                  Solo cuentan los artículos y cantidades configurados en la promoción.
                </div>
              </div>
            )}

            {orderedItems.length === 0 ? (
              <p style={styles.emptyBox}>{t.noItemsWithQuantity}</p>
            ) : (
              orderedItems.map((item) => (
                <div key={item.product.id} style={styles.summaryItem}>
                  <div style={styles.summaryProductName}>
                    {item.product.name}
                  </div>

                  <div style={styles.summaryQuantity}>
                    {item.boxes ? `${item.boxes} ${t.boxesLower}` : ""}
                    {item.boxes && item.units ? " + " : ""}
                    {item.units ? `${item.units} ${t.unitsLower}` : ""}
                  </div>

                  {item.notes && (
                    <div style={styles.summarySmall}>
                      {t.notes}: {item.notes}
                    </div>
                  )}
                </div>
              ))
            )}

            <label style={styles.label}>{t.notes}</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              style={styles.summaryNotes}
            />

            <div style={styles.summaryActions}>
              <button type="button" onClick={sendByWhatsApp} style={styles.sendButton}>
                <Send size={18} />
                {t.sendByWhatsApp}
              </button>

              <button type="button" onClick={resetToInitialState} style={styles.clearButton}>
                <Trash2 size={18} />
                {t.clearOrder}
              </button>

              <button
                type="button"
                onClick={() => setShowOrderSummary(false)}
                style={styles.backButton}
              >
                {t.back}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  installBanner: {
    position: "fixed",
    left: "50%",
    bottom: "18px",
    transform: "translateX(-50%)",
    zIndex: 1200,
    width: "min(720px, calc(100% - 24px))",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "14px",
    border: "2px solid #ffffff",
    borderRadius: "20px",
    background: "linear-gradient(135deg, #0b1185 0%, #2835d4 100%)",
    color: "#ffffff",
    boxShadow: "0 16px 42px rgba(11,17,133,0.42)",
  },
  installBannerIcon: {
    flex: "0 0 auto",
    display: "grid",
    placeItems: "center",
    width: "48px",
    height: "48px",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.18)",
  },
  installBannerContent: {
    minWidth: 0,
    flex: "1 1 auto",
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  installBannerTitle: {
    fontSize: "17px",
    lineHeight: 1.2,
  },
  installBannerText: {
    fontSize: "14px",
    lineHeight: 1.35,
    opacity: 0.95,
  },
  installButton: {
    flex: "0 0 auto",
    border: "none",
    borderRadius: "13px",
    padding: "13px 18px",
    background: "#ffffff",
    color: "#0b1185",
    fontSize: "15px",
    fontWeight: "900",
    boxShadow: "0 8px 22px rgba(0,0,0,0.18)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  installOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 5000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    background: "rgba(15,23,42,0.68)",
  },
  installModal: {
    position: "relative",
    width: "min(420px, 100%)",
    borderRadius: "22px",
    padding: "28px 22px 22px",
    background: "#ffffff",
    color: "#111827",
    textAlign: "center",
    boxShadow: "0 24px 70px rgba(0,0,0,0.28)",
  },
  installClose: {
    position: "absolute",
    top: "8px",
    right: "12px",
    border: "none",
    background: "transparent",
    fontSize: "30px",
    lineHeight: 1,
    cursor: "pointer",
  },
  installTitle: { margin: "12px 0 14px", fontSize: "21px" },
  installText: { margin: "10px 0", lineHeight: 1.45, textAlign: "left" },
  installNote: {
    margin: "16px 0 0",
    padding: "10px 12px",
    borderRadius: "12px",
    background: "#eef2ff",
    color: "#3730a3",
    fontSize: "13px",
    fontWeight: "800",
    lineHeight: 1.4,
  },
  installConfirmedButton: {
    width: "100%",
    marginTop: "14px",
    border: "none",
    borderRadius: "13px",
    padding: "13px 16px",
    background: "#0b1185",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "900",
    cursor: "pointer",
  },
  ruletaProgressPanel: {
    marginTop: "8px",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "2px solid #f59e0b",
    background: "#fff7d6",
    color: "#78350f",
  },

  ruletaProgressHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    fontSize: "14px",
  },

  ruletaProgressTitle: {
    fontWeight: "900",
  },

  ruletaProgressTrack: {
    height: "10px",
    marginTop: "7px",
    overflow: "hidden",
    borderRadius: "999px",
    background: "#fde68a",
  },

  ruletaProgressFill: {
    height: "100%",
    borderRadius: "999px",
    background: "#f59e0b",
    transition: "width 160ms ease",
  },

  ruletaProgressMessage: {
    marginTop: "6px",
    fontSize: "13px",
    lineHeight: "1.25",
    fontWeight: "800",
  },

  ruletaProductStatusPending: {
    marginTop: "8px",
    padding: "7px 9px",
    borderRadius: "9px",
    background: "#dc2626",
    border: "1px solid #991b1b",
    color: "#ffffff",
    fontSize: "12px",
    lineHeight: "1.25",
    fontWeight: "900",
  },

  ruletaProductStatusOk: {
    marginTop: "8px",
    padding: "7px 9px",
    borderRadius: "9px",
    background: "#dcfce7",
    border: "1px solid #22c55e",
    color: "#166534",
    fontSize: "12px",
    lineHeight: "1.25",
    fontWeight: "900",
  },

  page: {
    minHeight: "100dvh",
    width: "100%",
    maxWidth: "100vw",
    overflowX: "hidden",
    background: "#eef1f8",
    color: "#06145f",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    paddingBottom: "calc(78px + env(safe-area-inset-bottom))",
    boxSizing: "border-box",
  },

  topArea: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: "#eef1f8",
    padding: "2px 0 4px",
    boxShadow: "0 4px 10px rgba(15,23,42,0.07)",
    width: "100%",
    maxWidth: "100vw",
    boxSizing: "border-box",
    overflow: "visible",
  },

  headerWrap: {
    maxHeight: "260px",
    overflow: "hidden",
    transition: "max-height 180ms ease, opacity 180ms ease",
  },

  collapsedHeaderWrap: {
    maxHeight: "62px",
    overflow: "hidden",
    transition: "max-height 180ms ease, opacity 180ms ease",
  },

  header: {
    width: "min(1100px, calc(100vw - 12px))",
    margin: "0 auto",
    background: "#0b1185",
    color: "#ffffff",
    padding: "10px 12px",
    borderRadius: "0 0 16px 16px",
    boxShadow: "0 8px 16px rgba(11,17,133,0.22)",
    transition: "all 180ms ease",
    boxSizing: "border-box",
  },

  headerCollapsed: {
    maxWidth: "1100px",
    margin: "0 auto",
    background: "#0b1185",
    color: "#ffffff",
    padding: "7px 12px",
    borderRadius: "0 0 14px 14px",
    boxShadow: "0 6px 14px rgba(11,17,133,0.18)",
    transition: "all 180ms ease",
  },

  logoBlock: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },

  logo: {
    width: "56px",
    height: "56px",
    objectFit: "contain",
    borderRadius: "12px",
    background: "#fff",
  },

  logoCollapsed: {
    width: "42px",
    height: "42px",
    objectFit: "contain",
    borderRadius: "10px",
    background: "#fff",
  },

  logoFallback: {
    width: "56px",
    height: "56px",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#0b1185",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: "900",
    textAlign: "center",
    padding: "6px",
    boxSizing: "border-box",
  },

  logoFallbackCollapsed: {
    width: "42px",
    height: "42px",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#0b1185",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "900",
    textAlign: "center",
  },

  brandTitle: {
    color: "#ff1e1e",
    fontSize: "25px",
    lineHeight: "1",
    fontWeight: "1000",
    letterSpacing: "0.01em",
  },

  brandTitleCollapsed: {
    color: "#ff1e1e",
    fontSize: "20px",
    lineHeight: "1",
    fontWeight: "1000",
    letterSpacing: "0.01em",
  },

  title: {
    margin: "4px 0 0",
    fontSize: "14px",
    lineHeight: "1.1",
    color: "#ffffff",
  },

  subtitle: {
    margin: "4px 0 0",
    color: "#ffffff",
    fontSize: "11px",
    lineHeight: "1.2",
  },

  languageBox: {
    display: "none",
  },

  languageLabel: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: "700",
  },

  languageButton: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111827",
    borderRadius: "999px",
    padding: "8px 12px",
    fontWeight: "800",
    cursor: "pointer",
  },

  languageActive: {
    border: "1px solid #111827",
    background: "#111827",
    color: "#fff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontWeight: "800",
    cursor: "pointer",
  },

  customerPanel: {
    width: "min(1100px, calc(100vw - 12px))",
    margin: "6px auto 0",
    background: "#ffffff",
    borderRadius: "12px",
    padding: "7px 8px 1px",
    boxShadow: "0 4px 12px rgba(15,23,42,0.07)",
    boxSizing: "border-box",
  },

  languageLine: {
    display: "grid",
    gridTemplateColumns: "70px 1fr",
    gap: "8px",
    alignItems: "center",
    marginBottom: "6px",
  },

  labelCompact: {
    display: "block",
    color: "#06145f",
    fontSize: "11px",
    fontWeight: "900",
  },

  searchSticky: {
    width: "min(1100px, calc(100vw - 10px))",
    margin: "4px auto 0",
    background: "#ffffff",
    borderRadius: "11px",
    padding: "5px 6px",
    boxShadow: "0 3px 10px rgba(15,23,42,0.07)",
    boxSizing: "border-box",
    transition: "all 180ms ease",
    overflow: "visible",
  },

  searchStickyCollapsed: {
    width: "min(1100px, calc(100vw - 10px))",
    margin: "2px auto 0",
    background: "#ffffff",
    borderRadius: "11px",
    padding: "5px 6px",
    boxShadow: "0 3px 10px rgba(15,23,42,0.07)",
    boxSizing: "border-box",
    transition: "all 180ms ease",
    overflow: "visible",
  },

  compactTopRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 62px",
    gap: "6px",
    alignItems: "center",
    marginBottom: "5px",
    width: "100%",
    boxSizing: "border-box",
  },

  languageSelectCompact: {
    height: "34px",
    border: "1px solid #aeb7ff",
    borderRadius: "9px",
    background: "#ffffff",
    color: "#06145f",
    fontSize: "12px",
    fontWeight: "900",
    padding: "0 4px",
  },

  customerBox: {
    display: "none",
  },

  searchBox: {
    display: "none",
  },

  departmentBox: {
    position: "relative",
    background: "#fff",
    padding: 0,
    marginTop: "4px",
    zIndex: 150,
    overflow: "visible",
  },

  label: {
    display: "block",
    marginBottom: "4px",
    color: "#06145f",
    fontSize: "12px",
    fontWeight: "900",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #aeb7ff",
    borderRadius: "12px",
    padding: "12px 13px",
    fontSize: "16px",
    outline: "none",
    background: "#fff",
    marginBottom: "14px",
  },

  inputCompact: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #aeb7ff",
    borderRadius: "9px",
    padding: "6px 9px",
    fontSize: "13px",
    outline: "none",
    background: "#fff",
    marginBottom: "6px",
    height: "32px",
  },

  selectInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #aeb7ff",
    borderRadius: "12px",
    padding: "12px 13px",
    fontSize: "16px",
    outline: "none",
    background: "#fff",
    marginBottom: "14px",
    fontWeight: "800",
    color: "#111827",
  },

  selectInputCompact: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #aeb7ff",
    borderRadius: "9px",
    padding: "6px 9px",
    fontSize: "13px",
    outline: "none",
    background: "#fff",
    fontWeight: "800",
    color: "#111827",
    height: "32px",
  },

  searchRow: {
    display: "grid",
    gridTemplateColumns: "1fr 88px",
    gap: "7px",
    alignItems: "stretch",
    marginBottom: "6px",
  },

  searchInputWrap: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid #aeb7ff",
    borderRadius: "9px",
    padding: "0 9px",
    background: "#fff",
    height: "34px",
    boxSizing: "border-box",
    overflow: "hidden",
  },

  topReviewButton: {
    border: "none",
    borderRadius: "9px",
    background: "#8584c8",
    color: "#fff",
    fontWeight: "900",
    fontSize: "11px",
    lineHeight: "1",
    cursor: "pointer",
    height: "34px",
  },

  searchInput: {
    width: "100%",
    border: "none",
    outline: "none",
    padding: "6px 0",
    fontSize: "16px",
    background: "transparent",
    transform: "scale(0.875)",
    transformOrigin: "left center",
    height: "22px",
  },

  departmentButton: {
    width: "100%",
    border: "2px solid #ff1e1e",
    borderRadius: "12px",
    padding: "9px 12px",
    background: "linear-gradient(180deg, #fff5f5, #ffffff)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "15px",
    fontWeight: "900",
    color: "#06145f",
    height: "48px",
    boxShadow: "0 3px 10px rgba(255,30,30,.18)",
    cursor: "pointer",
  },

  departmentButtonLeft: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    color: "#ff1e1e",
  },

  departmentButtonLabel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    lineHeight: 1.15,
    color: "#06145f",
  },

  departmentButtonCaption: {
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "0.04em",
    color: "#ff1e1e",
    textTransform: "uppercase",
  },

  departmentHint: {
    display: "block",
    color: "#3e4b88",
    fontSize: "10px",
    fontWeight: "700",
    marginTop: "2px",
  },

  departmentMenu: {
    position: "absolute",
    zIndex: 999,
    left: 0,
    right: 0,
    top: "38px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    boxShadow: "0 16px 34px rgba(15,23,42,0.28)",
    maxHeight: "60vh",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  },

  departmentMenuOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "28px 14px",
    boxSizing: "border-box",
    zIndex: 300,
  },

  departmentMenuSheet: {
    width: "100%",
    maxWidth: "480px",
    maxHeight: "100%",
    background: "#fff",
    borderRadius: "20px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },

  departmentMenuSheetHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 16px 12px",
    borderBottom: "1px solid #e5e7eb",
    fontSize: "16px",
    fontWeight: "800",
    color: "#111827",
    flex: "0 0 auto",
  },

  departmentMenuCloseButton: {
    width: "30px",
    height: "30px",
    borderRadius: "999px",
    border: "none",
    background: "#f1f5f9",
    color: "#111827",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },

  departmentMenuSheetList: {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    overscrollBehavior: "contain",
    padding: "4px 0 calc(4px + env(safe-area-inset-bottom))",
  },

  departmentOption: {
    width: "100%",
    border: "none",
    borderBottom: "1px solid #f1f5f9",
    background: "#fff",
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    fontWeight: "800",
    textAlign: "left",
  },

  departmentOptionPromo: {
    color: "#dc2626",
  },

  departmentCount: {
    color: "#64748b",
    fontWeight: "900",
  },

  catalog: {
    width: "min(1100px, 100vw)",
    margin: "0 auto",
    padding: "6px 6px calc(150px + env(safe-area-inset-bottom))",
    boxSizing: "border-box",
    overflowX: "hidden",
    position: "relative",
    zIndex: 1,
    WebkitOverflowScrolling: "touch",
  },

  catalogSingleDepartment: {
    // No añadimos espacio artificial ni recolocamos el catálogo.
    // La posición permanece exactamente donde la dejó el cliente.
    paddingTop: "6px",
  },

  // Garantiza recorrido vertical aunque la lista visible sea muy corta
  // (pocos resultados de búsqueda, un departamento con pocos artículos,
  // etc.). Sin espacio suficiente, el navegador bloquea el gesto de
  // scroll y la pantalla se queda "atascada". Misma solución que ya se
  // aplicaba solo en Mis favoritos, ahora también en el resto de casos.
  catalogMinScrollRoom: {
    minHeight: "calc(100dvh + 180px)",
  },

  catalogFavoritesMode: {
    // Garantiza recorrido vertical aunque la lista personal sea muy corta.
    // Con uno o dos favoritos, el navegador ya dispone de suficiente espacio
    // para desplazar la cabecera sticky sin bloquear el gesto de scroll.
    minHeight: "calc(100dvh + 180px)",
  },

  departmentSection: {
    marginBottom: "16px",
  },

  departmentTitle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    margin: "0 0 5px",
    fontSize: "14px",
  },

  departmentTitlePromo: {
    color: "#dc2626",
    fontWeight: "900",
  },

  departmentTitleCount: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: "800",
  },

  productsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
  },

  quantityBadge: {
    position: "absolute",
    top: "6px",
    right: "6px",
    background: "#22c55e",
    color: "#fff",
    fontSize: "11px",
    fontWeight: "800",
    padding: "2px 7px",
    borderRadius: "999px",
    lineHeight: "1.3",
  },

  addButton: {
    width: "100%",
    marginTop: "auto",
    padding: "7px",
    border: "none",
    borderRadius: "8px",
    background: "#111827",
    color: "#fff",
    fontSize: "12px",
    fontWeight: "800",
    cursor: "pointer",
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
  },

  addButtonActive: {
    width: "100%",
    marginTop: "auto",
    padding: "7px",
    border: "1px solid #22c55e",
    borderRadius: "8px",
    background: "#dcfce7",
    color: "#15803d",
    fontSize: "12px",
    fontWeight: "800",
    cursor: "pointer",
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
  },

  fichaOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.55)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 60,
  },

  fichaPanel: {
    width: "100%",
    maxWidth: "480px",
    maxHeight: "96dvh",
    overflow: "hidden",
    background: "#fff",
    borderTopLeftRadius: "20px",
    borderTopRightRadius: "20px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
  },

  fichaPhotoBox: {
    position: "relative",
    width: "100%",
    height: "min(26dvh, 200px)",
    flex: "0 0 auto",
    background: "#dc2626",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  fichaCloseButton: {
    position: "absolute",
    top: "12px",
    right: "12px",
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    border: "none",
    background: "rgba(15,23,42,0.55)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },

  fichaFavoriteButton: {
    position: "absolute",
    top: "12px",
    left: "12px",
    width: "62px",
    padding: "6px 4px",
    borderRadius: "12px",
    border: "none",
    background: "rgba(15,23,42,0.55)",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "3px",
    cursor: "pointer",
    boxSizing: "border-box",
  },

  fichaFavoriteButtonText: {
    fontSize: "10px",
    fontWeight: "800",
    lineHeight: "1.2",
    textAlign: "center",
  },

  fichaFavoriteButtonActive: {
    background: "#fffbeb",
    color: "#f59e0b",
  },

  fichaBody: {
    padding: "14px 16px 0",
    boxSizing: "border-box",
    overflow: "hidden",
    flex: "1 1 auto",
    minHeight: 0,
  },

  fichaProductCode: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    margin: "0 0 2px",
  },

  fichaProductName: {
    fontSize: "18px",
    fontWeight: "800",
    color: "#111827",
    lineHeight: "1.25",
    margin: "0 0 6px",
  },

  fichaPromoBadgeWrap: {
    display: "flex",
    justifyContent: "flex-start",
    margin: "2px 0 10px",
  },

  fichaSectionLabel: {
    fontSize: "12px",
    fontWeight: "800",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: "0 0 6px",
  },

  fichaQuantityCard: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "12px",
    boxSizing: "border-box",
  },

  // Hueco fijo para los avisos de Ruleta/Bingo dentro de la ficha. Igual
  // aparezcan 0, 1 o 2 líneas de aviso (o cambien de rojo "pendiente" a
  // verde "completo", que ocupa menos), este contenedor no cambia de
  // altura: así ni la foto ni el resto de la ficha se desplazan al
  // meter o cambiar la cantidad.
  fichaPromoStatusWrap: {
    marginTop: "14px",
    minHeight: "94px",
    boxSizing: "border-box",
  },

  fichaFooter: {
    flex: "0 0 auto",
    background: "#fff",
    borderTop: "1px solid #e5e7eb",
    padding: "10px 16px calc(10px + env(safe-area-inset-bottom))",
    marginTop: "10px",
    boxSizing: "border-box",
  },

  fichaListoButton: {
    width: "100%",
    padding: "13px",
    border: "none",
    borderRadius: "12px",
    background: "#22c55e",
    color: "#fff",
    fontSize: "15px",
    fontWeight: "900",
    cursor: "pointer",
  },

  quantityInputFicha: {
    width: "56px",
    minWidth: "56px",
    maxWidth: "56px",
    boxSizing: "border-box",
    border: "none",
    borderLeft: "1px solid #d1d5db",
    borderRight: "1px solid #d1d5db",
    borderRadius: "0",
    padding: "1px 2px",
    fontSize: "19px",
    fontWeight: "800",
    lineHeight: "26px",
    height: "38px",
    minHeight: "38px",
    maxHeight: "38px",
    textAlign: "center",
    outline: "none",
    background: "#fff",
    appearance: "textfield",
    WebkitAppearance: "none",
  },

  quantityInputBlockedFicha: {
    width: "56px",
    minWidth: "56px",
    maxWidth: "56px",
    boxSizing: "border-box",
    border: "none",
    borderLeft: "1px solid #f3a5a5",
    borderRight: "1px solid #f3a5a5",
    borderRadius: "0",
    padding: "1px 2px",
    fontSize: "19px",
    fontWeight: "800",
    lineHeight: "26px",
    height: "38px",
    minHeight: "38px",
    maxHeight: "38px",
    textAlign: "center",
    outline: "none",
    background: "#fee2e2",
    color: "#991b1b",
    cursor: "not-allowed",
  },

  productCard: {
    display: "flex",
    flexDirection: "column",
    gap: "0",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "0",
    marginBottom: "0",
    boxShadow: "0 2px 5px rgba(15,23,42,0.03)",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
    scrollMarginTop: "150px",
    transition: "background 180ms ease, border 180ms ease, box-shadow 180ms ease",
  },

  productCardHighlighted: {
    background: "#e0f2fe",
    border: "2px solid #0ea5e9",
    boxShadow: "0 0 20px rgba(14,165,233,0.45)",
  },

  photoBox: {
    width: "100%",
    aspectRatio: "1 / 1",
    flex: "0 0 auto",
    position: "relative",
    border: "none",
    borderBottom: "1px solid #e5e7eb",
    borderRadius: "0",
    background: "#f8fafc",
    borderTopLeftRadius: "12px",
    borderTopRightRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  productImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    cursor: "pointer",
  },

  noPhoto: {
    color: "#94a3b8",
    fontSize: "11px",
    fontWeight: "800",
  },

  productContent: {
    flex: 1,
    minWidth: 0,
    padding: "6px",
    display: "flex",
    flexDirection: "column",
  },

  productTop: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "6px",
  },

  productTitleBlock: {
    minWidth: 0,
    // flex-basis 100% obliga al bloque de título a ocupar toda la fila:
    // en la tarjeta estrecha de la cuadrícula (2 columnas), la pastilla
    // de Ruleta/Bingo y el corazón de favoritos ya no caben al lado del
    // nombre, así que bajan a su propia fila (productTop tiene flexWrap).
    flex: "1 1 100%",
  },

  productTopActions: {
    display: "flex",
    alignItems: "flex-start",
    gap: "4px",
    flexShrink: 0,
    marginTop: "2px",
  },

  favoriteButton: {
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#94a3b8",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  },

  favoriteButtonActive: {
    color: "#f59e0b",
    borderColor: "#fbbf24",
    background: "#fffbeb",
  },

  ruletaPromoBadge: {
    width: "132px",
    height: "auto",
    minWidth: "132px",
    maxWidth: "132px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1px",
    flexShrink: 0,
    overflow: "visible",
  },

  ruletaPromoImage: {
    width: "36px",
    height: "36px",
    objectFit: "contain",
    display: "block",
    flexShrink: 0,
  },

  ruletaPromoText: {
    fontSize: "9px",
    lineHeight: "9px",
    fontWeight: "800",
    color: "#be185d",
    textAlign: "center",
    whiteSpace: "nowrap",
  },

  ruletaPromoMinimo: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    padding: "0 2px",
    fontSize: "14px",
    lineHeight: "15px",
    fontWeight: "1000",
    color: "#0b1185",
    textAlign: "center",
    whiteSpace: "nowrap",
    overflow: "visible",
    textOverflow: "clip",
    letterSpacing: "-0.2px",
  },

  bingoBallIcono: {
    width: "34px",
    height: "34px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderRadius: "50%",
    border: "2px double #fff0a2",
    outline: "2px solid #a5691a",
    background: "radial-gradient(circle at 32% 26%, #fff 0 12%, #fff8d1 32%, #e4ad34 68%, #a5691a 100%)",
    boxShadow: "inset -6px -7px 8px #5e260533, 0 2px 4px #0004",
  },

  promoBadgeDoble: {
    width: "132px",
    minWidth: "132px",
    maxWidth: "132px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    flexShrink: 0,
    padding: "4px 5px",
    borderRadius: "8px",
    background: "#fff7fb",
    border: "1px solid #f3c6dd",
  },

  promoBadgeDobleFila: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },

  promoBadgeDobleIcono: {
    width: "16px",
    height: "16px",
    objectFit: "contain",
    flexShrink: 0,
  },

  promoBadgeDobleIconoEmoji: {
    width: "16px",
    height: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderRadius: "50%",
    border: "1px double #fff0a2",
    outline: "1px solid #a5691a",
    background: "radial-gradient(circle at 32% 26%, #fff 0 12%, #fff8d1 32%, #e4ad34 68%, #a5691a 100%)",
    boxShadow: "inset -3px -3px 4px #5e260533",
  },

  bingoBallNumero: {
    color: "#c1121f",
    fontWeight: 950,
    fontFamily: "Georgia, serif",
    fontSize: "16px",
    lineHeight: 1,
    textShadow: "0 1px 0 #fff",
  },

  bingoBallNumeroChico: {
    color: "#c1121f",
    fontWeight: 950,
    fontFamily: "Georgia, serif",
    fontSize: "9px",
    lineHeight: 1,
    textShadow: "0 1px 0 #fff",
  },

  promoBadgeDobleTexto: {
    fontSize: "8px",
    fontWeight: "800",
    color: "#be185d",
    whiteSpace: "nowrap",
  },

  promoBadgeDobleMinimo: {
    fontSize: "10px",
    fontWeight: "1000",
    color: "#0b1185",
    whiteSpace: "nowrap",
    marginLeft: "auto",
  },

  promoBadgeDobleDivisor: {
    height: "1px",
    background: "#f3c6dd",
  },

  productName: {
    margin: 0,
    fontSize: "12px",
    lineHeight: "1.12",
  },

  badges: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    marginTop: "4px",
  },

  newsBadge: {
    background: "#fef3c7",
    color: "#92400e",
    borderRadius: "999px",
    padding: "2px 6px",
    fontSize: "11px",
    fontWeight: "900",
  },

  offerBadge: {
    background: "#fff7ed",
    color: "#9a3412",
    borderRadius: "8px",
    padding: "3px 8px",
    fontSize: "11px",
    fontWeight: "900",
    lineHeight: "1.25",
    whiteSpace: "normal",
    wordBreak: "break-word",
    display: "inline-block",
  },

  quantityGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    width: "100%",
  },

  quantityRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    width: "100%",
    gap: "12px",
  },

  quantityLabel: {
    color: "#111827",
    fontSize: "15px",
    fontWeight: "800",
    flexShrink: 0,
    width: "84px",
    lineHeight: "1.2",
  },

  stepperControl: {
    display: "flex",
    alignItems: "stretch",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    overflow: "hidden",
    flexShrink: 0,
    background: "#fff",
  },

  stepperButtonMinus: {
    width: "38px",
    minWidth: "38px",
    height: "38px",
    border: "none",
    background: "#f1f5f9",
    color: "#111827",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
  },

  stepperButtonPlus: {
    width: "38px",
    minWidth: "38px",
    height: "38px",
    border: "none",
    background: "#dcfce7",
    color: "#16a34a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
  },

  stepperButtonDisabled: {
    width: "38px",
    minWidth: "38px",
    height: "38px",
    border: "none",
    background: "#fee2e2",
    color: "#991b1b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "not-allowed",
    padding: 0,
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
  },

  quantityInput: {
    width: "32px",
    minWidth: "32px",
    maxWidth: "32px",
    boxSizing: "border-box",
    border: "none",
    borderLeft: "1px solid #e5e7eb",
    borderRight: "1px solid #e5e7eb",
    borderRadius: "0",
    padding: "1px 2px",
    fontSize: "14px",
    lineHeight: "20px",
    height: "26px",
    minHeight: "26px",
    maxHeight: "26px",
    textAlign: "center",
    outline: "none",
    background: "#fff",
    appearance: "textfield",
    WebkitAppearance: "none",
  },

  quantityInputActive: {
    background: "#fef08a",
    fontWeight: "900",
  },

  quantityInputBlocked: {
    width: "32px",
    minWidth: "32px",
    maxWidth: "32px",
    boxSizing: "border-box",
    border: "none",
    borderLeft: "1px solid #fecaca",
    borderRight: "1px solid #fecaca",
    borderRadius: "0",
    padding: "1px 2px",
    fontSize: "14px",
    lineHeight: "20px",
    height: "26px",
    minHeight: "26px",
    maxHeight: "26px",
    textAlign: "center",
    outline: "none",
    background: "#fee2e2",
    color: "#991b1b",
    cursor: "not-allowed",
  },

  onlyBoxesMessage: {
    display: "inline-block",
    marginTop: "3px",
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: "999px",
    padding: "2px 7px",
    fontSize: "10px",
    fontWeight: "900",
  },

  acceptQuantityButton: {
    width: "100%",
    minWidth: "100%",
    maxWidth: "100%",
    minHeight: "30px",
    border: "none",
    borderRadius: "8px",
    background: "#22c55e",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    cursor: "pointer",
    padding: "5px 8px",
    boxSizing: "border-box",
    flexShrink: 0,
    fontSize: "11px",
    lineHeight: 1,
    fontWeight: "900",
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
  },

  noteInput: {
    display: "none",
  },

  stickySummary: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    maxWidth: "100vw",
    background: "#111827",
    color: "#fff",
    padding: "10px 10px calc(10px + env(safe-area-inset-bottom))",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    zIndex: 30,
    boxShadow: "0 -10px 24px rgba(15,23,42,0.2)",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  summaryProductName: {
    color: "#111827",
    fontSize: "16px",
    fontWeight: "500",
    lineHeight: "1.25",
  },

  summaryQuantity: {
    color: "#111827",
    fontSize: "22px",
    fontWeight: "1000",
    lineHeight: "1.2",
    marginTop: "6px",
  },

  summarySmall: {
    color: "#94a3b8",
    fontSize: "12px",
    marginTop: "4px",
  },

  reviewButton: {
    border: "none",
    background: "#22c55e",
    color: "#fff",
    borderRadius: "12px",
    padding: "10px 11px",
    fontWeight: "900",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  summaryOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.65)",
    zIndex: 1000,
    padding: "12px 10px 0",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "flex-end",
    width: "100vw",
    maxWidth: "100vw",
    overflowX: "hidden",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  },

  summaryPanel: {
    width: "100%",
    maxWidth: "100%",
    maxHeight: "calc(100dvh - 24px)",
    overflowY: "auto",
    overflowX: "hidden",
    background: "#fff",
    borderRadius: "22px 22px 0 0",
    padding: "16px 16px calc(110px + env(safe-area-inset-bottom))",
    position: "relative",
    boxSizing: "border-box",
    WebkitOverflowScrolling: "touch",
  },

  summaryClose: {
    position: "absolute",
    top: "12px",
    right: "12px",
    width: "36px",
    height: "36px",
    borderRadius: "999px",
    border: "none",
    background: "#e5e7eb",
    fontSize: "24px",
    fontWeight: "900",
  },

  summaryTitle: {
    margin: "0 44px 14px 0",
  },

  summaryCustomer: {
    background: "#f8fafc",
    padding: "10px 12px",
    borderRadius: "12px",
  },

  summaryCustomerInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "11px 12px",
    fontSize: "16px",
    marginBottom: "12px",
  },

  summaryItem: {
    borderBottom: "1px solid #e5e7eb",
    padding: "10px 0",
  },

  ruletaSummaryPending: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
    borderRadius: "14px",
    padding: "12px",
    marginBottom: "12px",
  },

  ruletaSummaryOk: {
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    borderRadius: "14px",
    padding: "12px",
    marginBottom: "12px",
  },

  ruletaSummaryTitle: {
    fontSize: "15px",
    fontWeight: "1000",
    marginBottom: "4px",
  },

  ruletaSummaryText: {
    fontSize: "14px",
    fontWeight: "800",
    lineHeight: "1.25",
  },

  ruletaSummaryMissing: {
    fontSize: "13px",
    fontWeight: "700",
    lineHeight: "1.25",
    marginTop: "5px",
  },

  summaryNotes: {
    width: "100%",
    minHeight: "70px",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "10px",
    fontSize: "15px",
  },

  summaryActions: {
    display: "flex",
    flexDirection: "column",
    gap: "9px",
    marginTop: "14px",
  },

  sendButton: {
    border: "none",
    background: "#22c55e",
    color: "#fff",
    borderRadius: "12px",
    padding: "12px",
    fontWeight: "900",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },

  clearButton: {
    border: "none",
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: "12px",
    padding: "12px",
    fontWeight: "900",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },

  backButton: {
    border: "none",
    background: "#e5e7eb",
    color: "#111827",
    borderRadius: "12px",
    padding: "12px",
    fontWeight: "900",
  },

  emptyBox: {
    color: "#64748b",
    background: "#fff",
    border: "1px dashed #cbd5e1",
    borderRadius: "14px",
    padding: "18px",
    textAlign: "center",
    fontWeight: "800",
  },

  loading: {
    textAlign: "center",
    color: "#64748b",
    fontWeight: "800",
  },

  error: {
    textAlign: "center",
    color: "#991b1b",
    background: "#fee2e2",
    padding: "12px",
    borderRadius: "12px",
    fontWeight: "800",
  },

  imageOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.86)",
    zIndex: 9000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "18px",
  },

  imageClose: {
    position: "absolute",
    top: "16px",
    right: "16px",
    zIndex: 9001,
    width: "42px",
    height: "42px",
    borderRadius: "999px",
    border: "none",
    background: "#fff",
    color: "#111827",
    fontSize: "28px",
    fontWeight: "900",
  },

  bigImage: {
    maxWidth: "100%",
    maxHeight: "86vh",
    objectFit: "contain",
    borderRadius: "18px",
    background: "#fff",
  },

  pushOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 5000,
    background: "rgba(15,23,42,0.92)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: "18px",
    boxSizing: "border-box",
  },

  pushCloseX: {
    position: "absolute",
    top: "14px",
    right: "14px",
    width: "44px",
    height: "44px",
    borderRadius: "999px",
    border: "none",
    background: "#ffffff",
    color: "#111827",
    fontSize: "30px",
    lineHeight: "1",
    fontWeight: "900",
    zIndex: 5001,
  },

  pushPanel: {
    width: "min(520px, 100%)",
    maxHeight: "calc(100vh - 74px)",
    overflowY: "auto",
    background: "linear-gradient(180deg, #fff7ed 0%, #ffffff 45%, #f8fafc 100%)",
    borderRadius: "24px",
    padding: "13px",
    boxShadow: "0 28px 70px rgba(0,0,0,0.42)",
    boxSizing: "border-box",
    border: "3px solid #ffffff",
  },

  pushHeader: {
    textAlign: "center",
    color: "#7c2d12",
    marginBottom: "16px",
    fontSize: "22px",
    lineHeight: "1.15",
    fontWeight: "1000",
  },

  pushItemsGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  pushItemCard: {
    border: "2px solid #fed7aa",
    borderRadius: "16px",
    background: "#ffffff",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    alignItems: "stretch",
    boxShadow: "0 12px 28px rgba(234,88,12,0.10)",
  },

  pushItemImageBox: {
    width: "100%",
    height: "185px",
    background: "#ffffff",
    borderRadius: "20px",
    border: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  pushItemImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    cursor: "pointer",
  },

  pushNoImage: {
    color: "#94a3b8",
    fontSize: "13px",
    fontWeight: "900",
  },

  pushItemContent: {
    minWidth: 0,
    color: "#111827",
    fontSize: "15px",
    lineHeight: "1.25",
    textAlign: "center",
  },

  pushOrderButton: {
    width: "100%",
    border: "none",
    borderRadius: "999px",
    padding: "13px 15px",
    background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "1000",
    marginTop: "10px",
    boxShadow: "0 14px 26px rgba(34,197,94,0.34)",
    letterSpacing: "0.03em",
  },

  pushAddedBadge: {
    width: "100%",
    borderRadius: "999px",
    padding: "13px 16px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: "16px",
    fontWeight: "1000",
    marginTop: "10px",
    textAlign: "center",
    boxSizing: "border-box",
  },

  pushBottomButton: {
    width: "100%",
    border: "none",
    borderRadius: "999px",
    padding: "14px 18px",
    background: "#111827",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "900",
    marginTop: "16px",
  },


  clienteSesionCargando: {
    marginBottom: "10px",
    border: "1px solid #bfdbfe",
    borderRadius: "12px",
    padding: "10px 12px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: "13px",
    fontWeight: "800",
  },

  clienteSesionActiva: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    marginBottom: "10px",
    border: "1px solid #bbf7d0",
    borderRadius: "12px",
    padding: "10px 12px",
    background: "#f0fdf4",
    color: "#166534",
    fontSize: "13px",
  },

  favoritesFilterButton: {
    marginTop: "6px",
    border: "1px solid #d97706",
    borderRadius: "9px",
    background: "#f59e0b",
    color: "#ffffff",
    padding: "8px 12px",
    fontWeight: "900",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    cursor: "pointer",
    boxShadow: "0 3px 10px rgba(245,158,11,0.35)",
  },

  favoritesFilterButtonActive: {
    background: "#b45309",
    borderColor: "#92400e",
    color: "#ffffff",
  },

  favoritesError: {
    color: "#b91c1c",
    fontWeight: "700",
  },

  inputClienteIdentificado: {
    background: "#f8fafc",
    color: "#166534",
    fontWeight: "900",
    cursor: "default",
  },

  returnPushButton: {
    position: "fixed",
    left: "12px",
    right: "12px",
    bottom: "calc(74px + env(safe-area-inset-bottom))",
    zIndex: 45,
    border: "none",
    borderRadius: "999px",
    padding: "14px 16px",
    background: "#0ea5e9",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "1000",
    boxShadow: "0 14px 28px rgba(14,165,233,0.35)",
  },

  scrollTopButton: {
    position: "fixed",
    right: "10px",
    top: "calc(8px + env(safe-area-inset-top))",
    zIndex: 60,
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    border: "none",
    background: "#1e293b",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 16px rgba(15,23,42,0.35)",
    opacity: 0.9,
  },

  bingoSummaryOk: {
    marginBottom: "18px",
    padding: "14px",
    border: "1px solid #8bc49b",
    borderRadius: "14px",
    background: "#eefaf1",
  },
  bingoSummaryPending: {
    marginBottom: "18px",
    padding: "14px",
    border: "1px solid #d7b86a",
    borderRadius: "14px",
    background: "#fff9e9",
  },
  bingoSummaryMessage: {
    marginTop: "8px",
    fontWeight: 800,
    lineHeight: 1.4,
  },
  bingoSummaryNote: {
    marginTop: "6px",
    fontSize: "13px",
    opacity: 0.78,
  },
  bingoButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    border: "1px solid #111a8f",
    borderRadius: "999px",
    padding: "8px 14px",
    background: "#111a8f",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "900",
    cursor: "pointer",
  },

  bingoOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 10020,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px",
    background: "rgba(15, 23, 42, 0.78)",
    boxSizing: "border-box",
  },

  bingoModal: {
    position: "relative",
    width: "min(1540px, 100%)",
    maxHeight: "calc(100dvh - 24px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: "30px",
    background: "transparent",
    boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
  },

  bingoModalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "14px 16px",
    background: "#ffffff",
    borderBottom: "1px solid #dbe3ef",
  },

  bingoModalTitle: {
    display: "block",
    color: "#111a8f",
    fontSize: "22px",
    fontWeight: "900",
  },

  bingoModalSubtitle: {
    marginTop: "3px",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: "700",
  },

  bingoCloseButton: {
    position: "absolute",
    zIndex: 5,
    top: "20px",
    right: "20px",
    width: "44px",
    height: "44px",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid rgba(255,255,255,.75)",
    borderRadius: "999px",
    background: "rgba(3,22,58,.88)",
    color: "#ffffff",
    boxShadow: "0 5px 18px rgba(0,0,0,.3)",
    cursor: "pointer",
  },

  bingoModalBody: {
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    padding: "0",
  },

  juegosSelectorBody: {
    padding: "28px 20px",
    textAlign: "center",
  },
  juegosSelectorTitulo: {
    margin: "0 0 4px",
    fontSize: 24,
    color: "#0b1220",
  },
  juegosSelectorSubtitulo: {
    margin: "0 0 22px",
    color: "#6b7280",
    fontSize: 14,
  },
  juegosSelectorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 16,
  },
  juegoTarjeta: {
    display: "grid",
    justifyItems: "center",
    gap: 8,
    border: 0,
    borderRadius: 20,
    padding: "28px 14px",
    background: "linear-gradient(135deg, #7c3aed, #4c1d95)",
    color: "#fff",
    cursor: "pointer",
    boxShadow: "0 10px 26px rgba(124,58,237,.35)",
  },
  juegoTarjetaSorteo: {
    background: "linear-gradient(135deg, #059669, #064e3b)",
    boxShadow: "0 10px 26px rgba(5,150,105,.35)",
  },
  juegoTarjetaCapada: {
    background: "linear-gradient(135deg, #6b7280, #374151)",
    boxShadow: "none",
    opacity: 0.55,
    cursor: "not-allowed",
  },
  juegoTarjetaIcono: { fontSize: 40, lineHeight: 1 },
  juegoTarjetaTitulo: { fontSize: 19, fontWeight: 900 },
  juegoTarjetaSubtitulo: { fontSize: 12, opacity: 0.85 },

  bingoStatusBox: {
    padding: "34px 18px",
    borderRadius: "16px",
    background: "#ffffff",
    color: "#111a8f",
    textAlign: "center",
    fontWeight: "900",
  },

  bingoErrorBox: {
    padding: "24px 18px",
    border: "2px solid #dc2626",
    borderRadius: "16px",
    background: "#ffffff",
    color: "#b91c1c",
    textAlign: "center",
    fontWeight: "800",
  },

  bingoInfoBox: {
    marginTop: "12px",
    padding: "12px 14px",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#475569",
    textAlign: "center",
    fontSize: "13px",
    fontWeight: "700",
  },

  enlaceInvalidoOverlay: {
    position: "fixed",
    inset: 0,
    background: "#0f172a",
    zIndex: 1300,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    boxSizing: "border-box",
  },

  enlaceInvalidoPanel: {
    width: "100%",
    maxWidth: "420px",
    background: "#fff",
    borderRadius: "18px",
    padding: "28px 22px",
    boxSizing: "border-box",
    textAlign: "center",
    boxShadow: "0 20px 40px rgba(15,23,42,0.35)",
  },

  enlaceInvalidoTitulo: {
    margin: "0 0 12px",
    fontSize: "19px",
    fontWeight: "900",
    color: "#111a8f",
  },

  enlaceInvalidoTexto: {
    margin: "0 0 22px",
    fontSize: "14px",
    lineHeight: 1.5,
    color: "#334155",
  },

  enlaceInvalidoBoton: {
    display: "inline-block",
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 16px",
    borderRadius: "12px",
    background: "#25D366",
    color: "#fff",
    fontWeight: "800",
    fontSize: "15px",
    textDecoration: "none",
  },

  avisoModificacionOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.65)",
    zIndex: 1200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    boxSizing: "border-box",
  },

  avisoModificacionPanel: {
    width: "100%",
    maxWidth: "420px",
    background: "#fff",
    borderRadius: "18px",
    padding: "22px 20px",
    boxSizing: "border-box",
    boxShadow: "0 20px 40px rgba(15,23,42,0.35)",
  },

  avisoModificacionTitulo: {
    margin: "0 0 10px",
    fontSize: "18px",
    fontWeight: "900",
    color: "#111a8f",
  },

  avisoModificacionTexto: {
    margin: "0 0 20px",
    fontSize: "14px",
    lineHeight: 1.5,
    color: "#334155",
  },

  avisoModificacionBotonPrimario: {
    width: "100%",
    padding: "13px 16px",
    borderRadius: "12px",
    border: "none",
    background: "#111a8f",
    color: "#fff",
    fontWeight: "800",
    fontSize: "15px",
    marginBottom: "10px",
  },

  avisoModificacionBotonSecundario: {
    width: "100%",
    padding: "13px 16px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    fontWeight: "800",
    fontSize: "15px",
  },

};
