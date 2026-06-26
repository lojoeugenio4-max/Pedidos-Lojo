import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingCart,
  Trash2,
  Send,
  Search,
  ChevronDown,
  Check,
  X,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import logoLojo from "./assets/logo-lojo.jpg";

const WHATSAPP_NUMBER = "34670716744";
const ORDER_STORAGE_KEY = "cash-lojo-pedido";
const LANGUAGE_STORAGE_KEY = "cash-lojo-language";
const SUPABASE_URL = "https://bohlxagrtpjvqrgkonlo.supabase.co";

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
  return `${SUPABASE_URL}/storage/v1/object/public/productos/${fileName}`;
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

export default function App() {
  const rowRefs = useRef({});
  const departmentDropdownRef = useRef(null);
  const stickyCardRef = useRef(null);

  const getSavedOrder = () => {
    try {
      const saved = localStorage.getItem(ORDER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  const [articulos, setArticulos] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [pushOferta, setPushOferta] = useState(null);
  const [pushCerrado, setPushCerrado] = useState(false);
  const [mostrarVolverPush, setMostrarVolverPush] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [errorCatalogo, setErrorCatalogo] = useState("");

  const [quantities, setQuantities] = useState(
    () => getSavedOrder().quantities || {}
  );
  const [customerName, setCustomerName] = useState(
    () => getSavedOrder().customerName || ""
  );
  const [customerNameFocused, setCustomerNameFocused] = useState(false);
  const [soloCajasAviso, setSoloCajasAviso] = useState(null);
  const [notes, setNotes] = useState(() => getSavedOrder().notes || "");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("OFERTAS");
  const [articuloDestacado, setArticuloDestacado] = useState(null);
  const [departmentDropdownOpen, setDepartmentDropdownOpen] = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [logoError, setLogoError] = useState(false);
  const [language, setLanguage] = useState(
    () => localStorage.getItem(LANGUAGE_STORAGE_KEY) || "es"
  );
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  const t = translations[language];

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

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
    localStorage.setItem(
      ORDER_STORAGE_KEY,
      JSON.stringify({
        quantities,
        customerName,
        notes,
      })
    );
  }, [quantities, customerName, notes]);

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

  const productos = useMemo(() => {
    return ordenarProductos(
      articulos
        .filter((articulo) => articulo.activo)
        .map((articulo) => {
        const oferta = getActiveOffer(articulo.ofertas);

        return {
          id: String(articulo.id),
          codigo: articulo.codigo,
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
        };
      })
    );
  }, [articulos]);

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

    departamentos.forEach((departamento) => {
      const nombreDepartamento = String(departamento.nombre || "").trim();

      if (
        !nombreDepartamento ||
        nombreDepartamento === "NOVEDAD" ||
        nombreDepartamento === "OFERTAS" ||
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
  }, [departamentos, productosVisibles, productosConOferta, productosNovedad]);

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

    if (selectedDepartment !== "TODOS") {
      let selectedProducts = [];

      if (selectedDepartment === "NOVEDAD") {
        selectedProducts = productosNovedad;
      } else if (selectedDepartment === "OFERTAS") {
        selectedProducts = productosConOferta;
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

  const updateQuantity = (productId, field, value) => {
    const product = productos.find((item) => item.id === productId);

    if (field === "units" && product && !product.permite_unidades) {
      avisarSoloCajas(productId);
      return;
    }

    const numericValue = value === "" ? "" : Math.max(0, Number(value));

    setQuantities((current) => ({
      ...current,
      [productId]: {
        boxes: current[productId]?.boxes || "",
        units:
          field === "units"
            ? current[productId]?.units || ""
            : product?.permite_unidades
              ? current[productId]?.units || ""
              : "",
        notes: current[productId]?.notes || "",
        [field]: numericValue,
      },
    }));
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
    if (document.activeElement) {
      document.activeElement.blur();
    }

    const productIds = filteredDepartments.flatMap((department) =>
      department.products.map((product) => product.id)
    );

    const currentIndex = productIds.indexOf(productId);
    const nextProductId = productIds[currentIndex + 1];

    if (nextProductId) {
      setTimeout(() => {
        asegurarArticuloVisible(nextProductId);
      }, 120);
    }
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
    setSelectedDepartment("OFERTAS");
    setDepartmentDropdownOpen(false);
    setShowOrderSummary(false);
    setSelectedImage(null);
    setPushCerrado(false);
    setMostrarVolverPush(false);
    setHeaderCollapsed(false);
    localStorage.removeItem(ORDER_STORAGE_KEY);

    window.scrollTo({ top: 0, behavior: "auto" });
  };

  async function guardarEstadisticasPedido() {
    try {
      const pedidoId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const movimientos = orderedItems
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

  const sendByWhatsApp = async () => {
    if (!orderedItems.length) {
      alert(t.alertEmpty);
      return;
    }

    await guardarEstadisticasPedido();

    const lines = [];

    lines.push(`*${t.orderSummary}*`);
    lines.push("");

    if (customerName.trim()) {
      lines.push(`*${t.customer}:* ${customerName.trim()}`);
      lines.push("");
    }

    const itemsOrdenados = [...orderedItems].sort((a, b) => {
      const departamentoA = String(
        a.product.department || a.product.departamento || "SIN DEPARTAMENTO"
      );
      const departamentoB = String(
        b.product.department || b.product.departamento || "SIN DEPARTAMENTO"
      );

      const compararDepartamento = departamentoA.localeCompare(
        departamentoB,
        "es",
        { sensitivity: "base" }
      );

      if (compararDepartamento !== 0) return compararDepartamento;

      return String(a.product.name || "").localeCompare(
        String(b.product.name || ""),
        "es",
        { sensitivity: "base" }
      );
    });

    itemsOrdenados.forEach((item) => {
      const product = item.product;

      // Nombre sin código y sin negrita
      lines.push(String(product.name || "").trim());

      // Cantidades en negrita
      if (item.boxes) {
        lines.push(`*${item.boxes} ${t.boxesLower}*`);
      }

      if (item.units) {
        lines.push(`*${item.units} ${t.unitsLower}*`);
      }

      if (item.notes.trim()) {
        lines.push(`${t.notes}: ${item.notes.trim()}`);
      }

      lines.push("");
    });

    if (notes.trim()) {
      lines.push(`*${t.notes}:* ${notes.trim()}`);
      lines.push("");
    }

    lines.push(t.sentFrom);

    const message = encodeURIComponent(lines.join("\n"));
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;

    const link = document.createElement("a");
    link.href = whatsappUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    resetToInitialState();
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

              <label style={styles.labelCompact}>{t.customerName}</label>
              <input
                type="text"
                value={customerName}
                onFocus={() => setCustomerNameFocused(true)}
                onBlur={() => setCustomerNameFocused(false)}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder={t.optional}
                style={{
                  ...styles.inputCompact,
                  borderColor: customerNameFocused ? "#2563eb" : "#aeb7ff",
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
        </section>
      </div>

      <main style={styles.catalog}>
        {cargando && <p style={styles.loading}>{t.loading}</p>}
        {errorCatalogo && <p style={styles.error}>{errorCatalogo}</p>}

        {!cargando &&
          filteredDepartments.map((department) => (
            <section key={department.name} style={styles.departmentSection}>
              <h2 style={styles.departmentTitle}>
                {getDepartmentLabel(department.name, language)}
                <span style={styles.departmentTitleCount}>
                  {department.products.length} {t.articles}
                </span>
              </h2>

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
                          <div>
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
                        </div>

                        <div style={styles.quantityGrid}>
                          <label style={styles.quantityLabel}>
                            {t.boxes}
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              enterKeyHint="done"
                              autoComplete="off"
                              value={quantity.boxes || ""}
                              onFocus={() => asegurarArticuloVisible(product.id)}
                              onKeyDown={(event) => manejarEnterCantidad(event, product.id)}
                              onChange={(event) =>
                                updateQuantity(
                                  product.id,
                                  "boxes",
                                  event.target.value.replace(/[^0-9]/g, "")
                                )
                              }
                              style={styles.quantityInput}
                            />
                          </label>

                          <label style={styles.quantityLabel}>
                            {t.units}
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              enterKeyHint="done"
                              autoComplete="off"
                              readOnly={!product.permite_unidades}
                              value={product.permite_unidades ? quantity.units || "" : ""}
                              placeholder={product.permite_unidades ? "" : "—"}
                              onFocus={() => {
                                asegurarArticuloVisible(product.id);
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
                              onChange={(event) =>
                                updateQuantity(
                                  product.id,
                                  "units",
                                  event.target.value.replace(/[^0-9]/g, "")
                                )
                              }
                              style={
                                product.permite_unidades
                                  ? styles.quantityInput
                                  : styles.quantityInputBlocked
                              }
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => aceptarCantidad(product.id)}
                            style={styles.acceptQuantityButton}
                            aria-label="Aceptar cantidad"
                          >
                            Aceptar
                          </button>
                        </div>

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
    position: "relative",
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
    gap: "8px",
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
    borderRadius: "999px",
    padding: "2px 6px",
    fontSize: "11px",
    fontWeight: "900",
    lineHeight: "1.15",
    maxWidth: "210px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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
    width: "52px",
    minWidth: "52px",
    maxWidth: "52px",
    height: "24px",
    minHeight: "24px",
    maxHeight: "24px",
    border: "none",
    borderRadius: "7px",
    background: "#22c55e",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
    boxSizing: "border-box",
    flexShrink: 0,
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
};
