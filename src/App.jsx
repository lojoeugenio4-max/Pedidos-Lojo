import React, { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { supabaseStorage } from "./supabaseStorageClient";
import StorePage from "./pages/StorePage";
import DisplayPage from "./pages/DisplayPage";
import BingoDemo from "./pages/bingo/BingoDemo";
import BingoShow from "./pages/bingo/BingoShow";
import BingoCard from "./components/bingo/BingoCard";
import BingoDrum from "./components/bingo/BingoDrum";
import logoLojo from "./assets/logo-lojo.jpg";
import {
  construirTextoPedidoWhatsApp,
  abrirPedidoEnWhatsApp,
} from "./utils/whatsappPedido";

const WHATSAPP_NUMBER = "34670716744";
const ORDER_STORAGE_KEY = "cash-lojo-pedido";
const ORDER_SENT_PENDING_CLEAR_KEY = "cash-lojo-pedido-enviado-pendiente-borrar";
const LANGUAGE_STORAGE_KEY = "cash-lojo-language";
const APP_INSTALLED_STORAGE_KEY = "cash-lojo-app-instalada";
const ORDER_STORAGE_VERSION = 1;

function readSavedOrder() {
  try {
    const saved = localStorage.getItem(ORDER_STORAGE_KEY);
    if (!saved) return {};

    const parsed = JSON.parse(saved);
    return {
      quantities: parsed?.quantities && typeof parsed.quantities === "object" ? parsed.quantities : {},
      customerName: typeof parsed?.customerName === "string" ? parsed.customerName : "",
      notes: typeof parsed?.notes === "string" ? parsed.notes : "",
    };
  } catch (error) {
    console.warn("No se pudo recuperar el pedido guardado:", error);
    return {};
  }
}

function savePendingOrder({ quantities, customerName, notes }) {
  try {
    localStorage.setItem(
      ORDER_STORAGE_KEY,
      JSON.stringify({
        version: ORDER_STORAGE_VERSION,
        updatedAt: new Date().toISOString(),
        quantities,
        customerName,
        notes,
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
    units: "Unid.",
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
    units: "件",
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
  const departmentDropdownRef = useRef(null);
  const stickyCardRef = useRef(null);

  const [savedOrder] = useState(() => readSavedOrder());

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
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("TODOS");
  const [articuloDestacado, setArticuloDestacado] = useState(null);
  const [campoCantidadActivo, setCampoCantidadActivo] = useState(null);
  const [departmentDropdownOpen, setDepartmentDropdownOpen] = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [logoError, setLogoError] = useState(false);
  const [language, setLanguage] = useState(
    () => localStorage.getItem(LANGUAGE_STORAGE_KEY) || "es"
  );
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
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
  const [cargandoCliente, setCargandoCliente] = useState(Boolean(clienteToken));
  const [favoritos, setFavoritos] = useState(() => new Set());
  const [cargandoFavoritos, setCargandoFavoritos] = useState(false);
  const [errorFavoritos, setErrorFavoritos] = useState("");
  const [soloFavoritos, setSoloFavoritos] = useState(false);
  const [mostrarBingo, setMostrarBingo] = useState(false);
  const [cartonBingo, setCartonBingo] = useState(null);
  const [cargandoBingo, setCargandoBingo] = useState(false);
  const [errorBingo, setErrorBingo] = useState("");
  const [premiosBingo, setPremiosBingo] = useState({ line: null, bingo: null, special: null });
  const [configuracionBingoCliente, setConfiguracionBingoCliente] = useState(null);
  const [articulosBingoCliente, setArticulosBingoCliente] = useState([]);

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
          .select("id, nombre, telefono, estado, token")
          .eq("token", clienteToken)
          .maybeSingle();

        if (error) throw error;
        if (cancelado) return;

        if (data?.estado === "activo") {
          setClienteIdentificado(data);
          setCustomerName(data.nombre || "");
        } else {
          // Token inexistente o cliente inactivo: compra anónima, sin bloquear.
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
  }, [clienteIdentificado?.id]);

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
    setPremiosBingo({ line: null, bingo: null, special: null });
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
      });

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
      const prizeIds = [...new Set([promo?.premio_linea_articulo_id, promo?.premio_bingo_articulo_id, promo?.premio_especial_articulo_id].filter(Boolean))];
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
    savePendingOrder({ quantities, customerName, notes });
  }, [quantities, customerName, notes]);

  useEffect(() => {
    const guardarAntesDeSalir = () => {
      savePendingOrder({ quantities, customerName, notes });
    };

    window.addEventListener("pagehide", guardarAntesDeSalir);
    document.addEventListener("visibilitychange", guardarAntesDeSalir);

    return () => {
      window.removeEventListener("pagehide", guardarAntesDeSalir);
      document.removeEventListener("visibilitychange", guardarAntesDeSalir);
    };
  }, [quantities, customerName, notes]);

  useEffect(() => {
    const borrarPedidoSiVuelveDeWhatsApp = () => {
      if (sessionStorage.getItem(ORDER_SENT_PENDING_CLEAR_KEY) !== "true") return;

      sessionStorage.removeItem(ORDER_SENT_PENDING_CLEAR_KEY);
      localStorage.removeItem(ORDER_STORAGE_KEY);
      setQuantities({});
      setCustomerName("");
      setCustomerNameFocused(false);
      setSoloCajasAviso(null);
      setNotes("");
      setSearchInput("");
      setSearch("");
      setSelectedDepartment("TODOS");
      setDepartmentDropdownOpen(false);
      setShowOrderSummary(false);
      setSelectedImage(null);
      setHeaderCollapsed(false);
    };

    const comprobarVisibilidad = () => {
      if (document.visibilityState === "visible") {
        borrarPedidoSiVuelveDeWhatsApp();
      }
    };

    window.addEventListener("pageshow", borrarPedidoSiVuelveDeWhatsApp);
    window.addEventListener("focus", borrarPedidoSiVuelveDeWhatsApp);
    document.addEventListener("visibilitychange", comprobarVisibilidad);

    borrarPedidoSiVuelveDeWhatsApp();

    return () => {
      window.removeEventListener("pageshow", borrarPedidoSiVuelveDeWhatsApp);
      window.removeEventListener("focus", borrarPedidoSiVuelveDeWhatsApp);
      document.removeEventListener("visibilitychange", comprobarVisibilidad);
    };
  }, []);

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
    const handleScroll = () => {
      setHeaderCollapsed(window.scrollY > 90);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        departmentDropdownRef.current &&
        !departmentDropdownRef.current.contains(event.target)
      ) {
        setDepartmentDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

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
        };
      })
    );
  }, [
    articulos,
    codigosRuleta,
    idsArticulosRuleta,
    nombresArticulosRuleta,
    cantidadesMinimasRuletaPorArticulo,
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

    departamentos.forEach((departamento) => {
      const nombreDepartamento = String(departamento.nombre || "").trim();

      if (
        !nombreDepartamento ||
        nombreDepartamento === "NOVEDAD" ||
        nombreDepartamento === "OFERTAS" ||
        nombreDepartamento === "RULETA" ||
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
            !["NOVEDAD", "OFERTAS", "RULETA", "TODOS", "ARTÍCULOS BUSCADOS"].includes(
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
      .sort((a, b) =>
        String(a.product.name).localeCompare(String(b.product.name), "es", {
          sensitivity: "base",
        })
      );
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

    return {
      cumple: variedadActual >= variedadMinima,
      variedadActual,
      variedadMinima,
      variedadRestante: Math.max(0, variedadMinima - variedadActual),
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

      return {
        completo: false,
        texto:
          unidades > 0
            ? `Te faltan ${Math.max(0, minimo - unidades)} unidades para que cuente`
            : `Pide 1 caja o ${minimo} unidades para que cuente`,
      };
    }

    if (cajas >= minimo) {
      return {
        completo: true,
        texto: "✓ Este artículo ya cuenta para la Ruleta",
      };
    }

    return {
      completo: false,
      texto:
        cajas > 0
          ? `Te faltan ${Math.max(0, minimo - cajas)} cajas para que cuente`
          : `Pide ${minimo} ${minimo === 1 ? "caja" : "cajas"} para que cuente`,
    };
  };

  const activarCampoCantidad = (productId, field) => {
    // Solo marca el artículo y el campo activo. No cambia el departamento,
    // no busca el artículo y no modifica el scroll.
    setArticuloDestacado(productId);
    setCampoCantidadActivo(`${productId}:${field}`);
  };

  const alinearArticuloActivo = (input) => {
    if (!input || document.activeElement !== input) return;

    const article = input.closest("article");
    const departmentSection = article?.closest("section");
    const departmentTitle = departmentSection?.querySelector("h2");
    const topArea = document.querySelector("[data-top-area='true']");

    if (!article) return;

    const articleRect = article.getBoundingClientRect();
    const topAreaRect = topArea?.getBoundingClientRect();
    const titleHeight = departmentTitle?.getBoundingClientRect().height || 0;

    // La tarjeta queda en la misma zona visual que el primer artículo de un
    // departamento: justo debajo de la cabecera y del título, nunca oculta.
    const desiredArticleTop = Math.max(
      12,
      Math.min(window.innerHeight * 0.28, (topAreaRect?.bottom || 0) + titleHeight + 10)
    );

    const delta = articleRect.top - desiredArticleTop;
    if (Math.abs(delta) > 2) {
      window.scrollBy({ top: delta, left: 0, behavior: "auto" });
    }
  };

  const prepararCampoCantidad = (event, productId, field) => {
    const input = event.currentTarget;

    activarCampoCantidad(productId, field);

    // El foco se obtiene SINCRÓNICAMENTE durante el primer toque. Así el
    // teclado se abre en ese mismo toque. Cancelamos únicamente la acción
    // nativa posterior para impedir que el navegador vuelva a desplazar la
    // página o quite el cursor al terminar el gesto.
    event.preventDefault();
    input.focus({ preventScroll: true });
    input.select?.();

    let adjusted = false;
    const ajustarUnaVez = () => {
      if (adjusted || document.activeElement !== input) return;
      adjusted = true;
      requestAnimationFrame(() => alinearArticuloActivo(input));
    };

    // En iOS/Android la altura visible cambia cuando aparece el teclado.
    // Esperamos ese cambio para colocar la tarjeta una sola vez, manteniendo
    // el foco y el teclado abiertos.
    const viewport = window.visualViewport;
    if (viewport) {
      viewport.addEventListener("resize", ajustarUnaVez, { once: true });
      setTimeout(ajustarUnaVez, 220);
    } else {
      setTimeout(ajustarUnaVez, 120);
    }
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

  const aceptarCantidad = (productId) => {
    // “Aceptar” únicamente cierra el teclado. Antes se desplazaba al artículo
    // siguiente y podía saltar incluso al departamento siguiente.
    // Ese desplazamiento automático queda eliminado por completo.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setArticuloDestacado(productId);
    setCampoCantidadActivo(null);
  };

  const manejarEnterCantidad = (event, productId) => {
    if (event.key === "Enter") {
      event.preventDefault();
      aceptarCantidad(productId);
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
    setCustomerName("");
    setNotes("");
    setShowOrderSummary(false);
  };

  const resetToInitialState = () => {
    setQuantities({});
    setCustomerName("");
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
    localStorage.removeItem(ORDER_STORAGE_KEY);

    window.scrollTo({ top: 0, behavior: "auto" });
  };

  function crearPedidoId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async function guardarEstadisticasPedido(itemsPedido = orderedItems, pedidoId = crearPedidoId()) {
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
          };
        })
        .filter(Boolean);

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
    localStorage.removeItem(ORDER_STORAGE_KEY);
    setQuantities({});
    setCustomerName("");
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

  async function crearParticipacionJuegos({
    pedidoId,
    customerNamePedido,
    participacionRuleta = null,
    tiradasRuleta = 0,
    participacionBingo = null,
  }) {
    const bingoConseguido = pedidoCumpleBingo(participacionBingo);
    const ruletaConseguida = Boolean(participacionRuleta);

    if (!ruletaConseguida && !bingoConseguido) return null;

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
        p_expires_at: null,
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

  function enviarPedidoFinal({
    itemsPedido,
    customerNamePedido,
    notesPedido,
    participacionRuleta = null,
    pedidoId = crearPedidoId(),
    resumenRuletaPedidoEnvio = null,
    participacionBingo = null,
    participacionJuegos = null,
  }) {
    const texto = construirTextoPedidoWhatsApp({
      t,
      itemsPedido,
      customerNamePedido,
      notesPedido,
      participacionRuleta,
      tiradasRuleta: resumenRuletaPedidoEnvio?.tiradasConseguidas || 0,
      participacionBingo,
      participacionJuegos,
    });

    limpiarPedidoDespuesEnvio();

    // Guardamos estadísticas en segundo plano, sin bloquear WhatsApp.
    guardarEstadisticasPedido(itemsPedido, pedidoId);

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

    // Snapshot del pedido en el momento exacto del clic.
    // Así podemos limpiar la app sin perder el contenido que irá a WhatsApp.
    const itemsPedido = [...orderedItems];
    const customerNamePedido = customerName.trim();
    const notesPedido = notes.trim();
    const pedidoId = crearPedidoId();

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
          pedidoId,
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

        alert(
          `No se ha podido generar el código de ruleta.${
            detalleError ? `\n\n${detalleError}` : " Inténtalo de nuevo."
          }`
        );
        return;
      }
    }

    let participacionBingo = null;
    if (clienteIdentificado?.id) {
      try {
        participacionBingo = await registrarPedidoParaBingo(itemsPedido, pedidoId);
      } catch (error) {
        const detalleErrorBingo = [
          error?.code ? `Código: ${error.code}` : null,
          error?.message ? `Mensaje: ${error.message}` : null,
          error?.details ? `Detalle: ${error.details}` : null,
          error?.hint ? `Sugerencia: ${error.hint}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        alert(
          `El pedido no se enviará porque no se pudo registrar el Bingo.${
            detalleErrorBingo ? `\n\n${detalleErrorBingo}` : ""
          }`
        );
        return;
      }
    }

    let participacionJuegos = null;
    // El QR común debe crearse para cualquier pedido que consiga Ruleta o Bingo.
    // No puede depender de que el cliente esté identificado: los pedidos anónimos
    // también necesitan su fila en game_entitlements para que el lector los valide.
    if (
      participacionRuleta ||
      pedidoCumpleBingo(participacionBingo)
    ) {
      try {
        participacionJuegos = await crearParticipacionJuegos({
          pedidoId,
          customerNamePedido,
          participacionRuleta,
          tiradasRuleta: resumenRuletaPedidoEnvio?.tiradasConseguidas || 0,
          participacionBingo,
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

    enviarPedidoFinal({
      itemsPedido,
      customerNamePedido,
      notesPedido,
      participacionRuleta,
      pedidoId,
      resumenRuletaPedidoEnvio,
      participacionBingo,
      participacionJuegos,
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

  return (
    <div style={styles.page}>
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
                    initialNumbers={cartonBingo.drawn_numbers}
                    onNumbersChange={(numbers) => setCartonBingo((current) => current ? { ...current, drawn_numbers: numbers } : current)}
                  />
                  <BingoCard
                    card={cartonBingo.card}
                    drawnNumbers={cartonBingo.drawn_numbers}
                    customerName={clienteIdentificado.nombre}
                    linePrize={premiosBingo.line}
                    bingoPrize={premiosBingo.bingo}
                    specialPrize={premiosBingo.special}
                    endDate={configuracionBingoCliente.fecha_fin}
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
                  {configuracionBingoCliente && (
                    <button
                      type="button"
                      onClick={abrirMiBingo}
                      style={styles.bingoButton}
                      title={configuracionBingoCliente.fecha_fin ? `Disponible hasta el ${new Date(`${configuracionBingoCliente.fecha_fin}T12:00:00`).toLocaleDateString("es-ES")}` : "Bingo activo"}
                    >
                      <Grid3X3 size={17} />
                      Mi Bingo{configuracionBingoCliente.fecha_fin ? ` · hasta ${new Date(`${configuracionBingoCliente.fecha_fin}T12:00:00`).toLocaleDateString("es-ES")}` : ""}
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
              <span>
                <strong>{getDepartmentLabel(selectedDepartment, language)}</strong>
              </span>
              <ChevronDown size={17} />
            </button>

            {departmentDropdownOpen && (
              <div style={styles.departmentMenu}>
                {departmentOptions.map((option) => (
                  <button
                    key={option.name}
                    type="button"
                    onClick={() => {
                      setSelectedDepartment(option.name);
                      setDepartmentDropdownOpen(false);
                    }}
                    style={styles.departmentOption}
                  >
                    <span>{option.label}</span>
                    <span style={styles.departmentCount}>{option.count}</span>
                  </button>
                ))}
              </div>
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
        </section>
      </div>

      <main
        style={{
          ...styles.catalog,
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
                <h2 style={styles.departmentTitle}>
                  {getDepartmentLabel(department.name, language)}
                  <span style={styles.departmentTitleCount}>
                    {department.products.length} {t.articles}
                  </span>
                </h2>
              )}

              {department.products.length === 0 ? (
                <div style={styles.emptyBox}>{t.noItems}</div>
              ) : (
                department.products.map((product) => {
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
                      <div style={styles.photoBox}>
                        {product.image ? (
                          <img
                            src={product.image}
                            alt=""
                            style={styles.productImage}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setSelectedImage(product.image);
                            }}
                          />
                        ) : (
                          <span style={styles.noPhoto}>{t.noPhoto}</span>
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
                            {product.participaRuleta && (
                              <MiniRuletaPromocion
                                cantidadMinima={product.cantidadMinimaRuleta}
                                permiteUnidades={product.permite_unidades}
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

                        <div style={styles.quantityGrid}>
                          <label style={styles.quantityLabel}>
                            {t.boxes}
                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              enterKeyHint="done"
                              min="0"
                              step="1"
                              autoComplete="off"
                              value={quantity.boxes || ""}
                              onPointerDown={(event) =>
                                prepararCampoCantidad(event, product.id, "boxes")
                              }
                              onFocus={() => activarCampoCantidad(product.id, "boxes")}
                              onKeyDown={(event) => manejarEnterCantidad(event, product.id)}
                              onBlur={() => setCampoCantidadActivo(null)}
                              onChange={(event) =>
                                updateQuantity(
                                  product.id,
                                  "boxes",
                                  event.target.value.replace(/[^0-9]/g, "")
                                )
                              }
                              style={{
                                ...styles.quantityInput,
                                ...(campoCantidadActivo === `${product.id}:boxes`
                                  ? styles.quantityInputActive
                                  : {}),
                              }}
                            />
                          </label>

                          <label style={styles.quantityLabel}>
                            {t.units}
                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              enterKeyHint="done"
                              min="0"
                              step="1"
                              autoComplete="off"
                              readOnly={!product.permite_unidades}
                              value={product.permite_unidades ? quantity.units || "" : ""}
                              placeholder={product.permite_unidades ? "" : "—"}
                              onPointerDown={(event) => {
                                if (product.permite_unidades) {
                                  prepararCampoCantidad(event, product.id, "units");
                                }
                              }}
                              onFocus={() => {
                                activarCampoCantidad(product.id, "units");
                                if (!product.permite_unidades) {
                                  avisarSoloCajas(product.id);
                                }
                              }}
                              onClick={() => {
                                if (!product.permite_unidades) {
                                  avisarSoloCajas(product.id);
                                }
                              }}
                              onKeyDown={(event) => manejarEnterCantidad(event, product.id)}
                              onBlur={() => setCampoCantidadActivo(null)}
                              onChange={(event) =>
                                updateQuantity(
                                  product.id,
                                  "units",
                                  event.target.value.replace(/[^0-9]/g, "")
                                )
                              }
                              style={{
                                ...(product.permite_unidades
                                  ? styles.quantityInput
                                  : styles.quantityInputBlocked),
                                ...(product.permite_unidades &&
                                campoCantidadActivo === `${product.id}:units`
                                  ? styles.quantityInputActive
                                  : {}),
                              }}
                            />
                          </label>

                          {(() => {
                            const campoActivoCajas =
                              campoCantidadActivo === `${product.id}:boxes`;
                            const campoActivoUnidades =
                              campoCantidadActivo === `${product.id}:units`;
                            const cantidadEscrita = campoActivoCajas
                              ? quantity.boxes
                              : campoActivoUnidades
                                ? quantity.units
                                : "";

                            if (
                              !campoActivoCajas &&
                              !campoActivoUnidades
                            ) {
                              return null;
                            }

                            if (cantidadEscrita === "" || cantidadEscrita == null) {
                              return null;
                            }

                            return (
                              <button
                                type="button"
                                style={styles.acceptQuantityButton}
                                onPointerDown={(event) => {
                                  // Evita que el botón pierda el foco antes de ejecutar
                                  // el clic. Así no desaparece prematuramente en iPhone.
                                  event.preventDefault();
                                }}
                                onClick={() => aceptarCantidad(product.id)}
                                aria-label="Aceptar cantidad"
                              >
                                <Check size={15} strokeWidth={3} />
                                <span>Aceptar cantidad</span>
                              </button>
                            );
                          })()}

                        </div>

                        {product.participaRuleta && (() => {
                          const estadoRuleta = obtenerEstadoArticuloRuleta(
                            product,
                            quantity
                          );

                          // Solo se muestra la confirmación de que YA cuenta
                          // para la Ruleta. El aviso de "te faltan X" se ha
                          // quitado: el badge con el mínimo, junto al nombre
                          // del artículo, ya deja claro cuánto hace falta.
                          if (!estadoRuleta?.completo) return null;

                          return (
                            <div style={styles.ruletaProductStatusOk}>
                              {estadoRuleta.texto}
                            </div>
                          );
                        })()}

                        {!product.permite_unidades && soloCajasAviso === product.id && (
                          <div style={styles.onlyBoxesMessage}>
                            {t.onlyBoxes}
                          </div>
                        )}


                      </div>
                    </article>
                  );
                })
              )}
            </section>
          ))}
      </main>

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
                    Has conseguido 1 bola de Bingo. Se incluirá en el QR del pedido.
                  </div>
                ) : (
                  <div style={styles.bingoSummaryMessage}>
                    Te faltan {resumenBingoPedido.variedadRestante} {resumenBingoPedido.variedadRestante === 1 ? "artículo distinto en cajas" : "artículos distintos en cajas"} para conseguir 1 bola.
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
    background: "#fff7d6",
    border: "1px solid #f59e0b",
    color: "#92400e",
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
    border: "1px solid #aeb7ff",
    borderRadius: "9px",
    padding: "7px 10px",
    background: "#fff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "14px",
    fontWeight: "900",
    color: "#06145f",
    height: "34px",
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

  departmentTitleCount: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: "800",
  },

  productCard: {
    display: "flex",
    gap: "6px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "4px",
    marginBottom: "4px",
    boxShadow: "0 2px 5px rgba(15,23,42,0.03)",
    minHeight: "58px",
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
    width: "46px",
    height: "46px",
    flex: "0 0 46px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    background: "#fff",
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
  },

  productTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "8px",
  },

  productTitleBlock: {
    minWidth: 0,
    flex: 1,
  },

  productTopActions: {
    display: "flex",
    alignItems: "flex-start",
    gap: "4px",
    flexShrink: 0,
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
    display: "grid",
    gridTemplateColumns: "52px 52px 52px",
    gap: "4px",
    marginTop: "3px",
    alignItems: "end",
    width: "164px",
    maxWidth: "164px",
    flexShrink: 0,
  },

  quantityLabel: {
    color: "#374151",
    fontSize: "9px",
    fontWeight: "800",
  },

  quantityInput: {
    width: "52px",
    minWidth: "52px",
    maxWidth: "52px",
    boxSizing: "border-box",
    marginTop: "1px",
    border: "1px solid #d1d5db",
    borderRadius: "7px",
    padding: "1px 3px",
    fontSize: "16px",
    lineHeight: "20px",
    height: "24px",
    minHeight: "24px",
    maxHeight: "24px",
    textAlign: "center",
    outline: "none",
    appearance: "textfield",
    WebkitAppearance: "none",
  },

  quantityInputActive: {
    background: "#fef08a",
    border: "2px solid #f59e0b",
    boxShadow: "0 0 0 3px rgba(245,158,11,0.22)",
    fontWeight: "900",
  },

  quantityInputBlocked: {
    width: "52px",
    minWidth: "52px",
    maxWidth: "52px",
    boxSizing: "border-box",
    marginTop: "1px",
    border: "1px solid #fecaca",
    borderRadius: "7px",
    padding: "1px 3px",
    fontSize: "16px",
    lineHeight: "20px",
    height: "24px",
    minHeight: "24px",
    maxHeight: "24px",
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
    gridColumn: "1 / -1",
    width: "164px",
    minWidth: "164px",
    maxWidth: "164px",
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
    border: "1px solid #cbd5e1",
    borderRadius: "9px",
    background: "#ffffff",
    color: "#334155",
    padding: "7px 10px",
    fontWeight: "800",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    cursor: "pointer",
  },

  favoritesFilterButtonActive: {
    background: "#fffbeb",
    borderColor: "#f59e0b",
    color: "#b45309",
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

};
