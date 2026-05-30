import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingCart,
  Trash2,
  Send,
  Search,
  ChevronDown,
  Check,
  ArrowLeft,
} from "lucide-react";
import hiddenProductsRaw from "./hiddenProducts";

const WHATSAPP_NUMBER = "34670716744";
const ORDER_STORAGE_KEY = "cash-lojo-pedido";

const LANGUAGE_STORAGE_KEY = "cash-lojo-language";

const translations = {
  es: {
    language: "Idioma",
    title: "Pedido online Cash Lojo",
    subtitle: "Escribe cantidades en Unidades o Cajas, revisa el pedido y envíalo por WhatsApp.",
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
    departmentNames: {
      OFERTAS: "OFERTAS",
      NOVEDAD: "NOVEDAD",
      AGUA: "AGUA",
      CERVEZAS: "CERVEZAS",
      "REFRESCOS LATAS": "REFRESCOS LATAS",
      "REFRESCOS 2L / 1.5L": "REFRESCOS 2L / 1.5L",
      ENERGÉTICAS: "ENERGÉTICAS",
      "VINOS Y LICORES": "VINOS Y LICORES",
      PIZZAS: "PIZZAS",
      "CHARCUTERÍA LONCHEADA": "CHARCUTERÍA LONCHEADA",
      APERITIVOS: "APERITIVOS",
      "LECHES Y BATIDOS/CAFÉS/LÁCTEOS": "LECHES Y BATIDOS/CAFÉS/LÁCTEOS",
      ZUMOS: "ZUMOS",
      ALIMENTACIÓN: "ALIMENTACIÓN",
      DROGUERIA: "DROGUERIA",
      "CHARCUTERÍA CORTE": "CHARCUTERÍA CORTE",
      VARIOS: "VARIOS",
      "ARTÍCULOS BUSCADOS": "ARTÍCULOS BUSCADOS",
    },
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
    departmentNames: {
      OFERTAS: "优惠",
      NOVEDAD: "新品",
      AGUA: "饮用水",
      CERVEZAS: "啤酒",
      "REFRESCOS LATAS": "罐装饮料",
      "REFRESCOS 2L / 1.5L": "2L / 1.5L 饮料",
      ENERGÉTICAS: "能量饮料",
      "VINOS Y LICORES": "葡萄酒和烈酒",
      PIZZAS: "披萨",
      "CHARCUTERÍA LONCHEADA": "切片熟食",
      APERITIVOS: "零食小吃",
      "LECHES Y BATIDOS/CAFÉS/LÁCTEOS": "牛奶/奶昔/咖啡/乳制品",
      ZUMOS: "果汁",
      ALIMENTACIÓN: "食品",
      DROGUERIA: "清洁用品",
      "CHARCUTERÍA CORTE": "散装熟食",
      VARIOS: "其他",
      "ARTÍCULOS BUSCADOS": "搜索到的商品",
    },
  },
};

const fixedProduct = (idnum, name, offerText = "") => ({
  idnum,
  name,
  offerText,
});

const departments = [
  {
    name: "NOVEDAD",
    products: [
		fixedProduct(1056, "ATUN DORNA A.VEGETAL BOLSA 1 K", "SUPERPRECIO( hasta fin de existencias ) "),
	],
  },

  {
    name: "AGUA",
    products: [
fixedProduct(3, "AGUA FUENTELAJARA 0.5L", "Comprando 10 cajas REGALO 1 caja "),
fixedProduct(1, "AGUA FUENTELAJARA 1.5L", "Comprando 10 cajas REGALO 1 caja "),
fixedProduct(9, "AGUA GOURMET CON GAS 0.5L"),
fixedProduct(10, "AGUA GOURMET CON GAS 1.5L"),
fixedProduct(4, "AGUA LANJARON 0.5L"),
fixedProduct(2, "AGUA LANJARON 1.5L PACK 6"),
fixedProduct(301, "AGUA LANJARON S/G 6 L TAPON GR"),
fixedProduct(302, "AGUA SOLAN DE CABRA 500 ML"),
fixedProduct(7, "AGUA SOLAN CABRAS 1.5L", "OFERTA"),
fixedProduct(8, "AGUA SOLAN DE CABRAS S/G 5L GFA"),
fixedProduct(5, "AGUA VALTORRE 0.5L PITORRO"),
fixedProduct(6, "AGUA VALTORRE GARRAFA 5L"),
fixedProduct(305, "AGUA VALTORRE TREKKING 0.75"," Por 5 cajas REGALO 1 caja"),

    ],
  },
  {
    name: "CERVEZAS",
    products: [
fixedProduct(111, "CERVEZA CRUZ DEL SUR 1L", "Comprando 10 cajas PRECIO OFERTA"),
fixedProduct(108, "CERVEZA CRUZCAMPO 50CL", "Por 6 cajas REGALO 1 caja"),
fixedProduct(110, "CERVEZA CRUZCAMPO CHAPA 1L"),
fixedProduct(117, "CERVEZA CRUZCAMPO BOTELLIN CAJA 24", "Comprando 5 cajas PRECIO OFERTA"),
fixedProduct(102, "CERVEZA CRUZCAMPO LATA 33CL", "Por 7 cajas REGALO 1 caja"),
fixedProduct(116, "CERVEZA CRUZCAMPO PACK 6"),
fixedProduct(114, "CERVEZA CRUZCAMPO ROSCA 1L"),
fixedProduct(105, "CERVEZA CRUZCAMPO S/A LATA 33CL", "Comprando 2 cajas PRECIO OFERTA"),
fixedProduct(115, "CERVEZA CRUZCAMPO 750ML"),
fixedProduct(113, "CERVEZA ESTRELLA 0.0 1L"),
fixedProduct(104, "CERVEZA ESTRELLA 0.0 LATA 33CL"),
fixedProduct(112, "CERVEZA ESTRELLA 1L"),
fixedProduct(120, "CERVEZA ESTRELLA DEL SUR PACK 6"),
fixedProduct(109, "CERVEZA ESTRELLA SUR 50CL LATA GRANDE", "Por 5 cajas REGALO 12 unidades"),
fixedProduct(103, "CERVEZA ESTRELLA SUR LATA", "Por 6 cajas REGALO 1 caja"),
fixedProduct(107, "CERVEZA HEINEKEN LATA 33CL"),
fixedProduct(106, "CERVEZA RADLER LIMON CRUZCAMPO LATA", "Comprando 2 cajas PRECIO OFERTA"),
fixedProduct(119, "CERVEZA CRUZCAMPO SIN ALCOHOL PACK6", "Comprando 2 cajas PRECIO OFERTA"),
    ],
  },
  {
    name: "REFRESCOS LATAS",
    products: [
fixedProduct(801, "AQUARIUS BLANCO PET 500 ML"),
fixedProduct(17, "AQUARIUS LIMON LATA 33CL"),
fixedProduct(16, "AQUARIUS NARANJA LATA 33CL"),
fixedProduct(802, "AQUARIUS NARANJA PET 500 ML"),
fixedProduct(11, "COCA COLA LATA 33CL"),
fixedProduct(803, "COCA COLA NORMAL PET 500 ML"),
fixedProduct(13, "COCA COLA ZERO S/CAF 33CL"),
fixedProduct(12, "COCA COLA ZERO LATA 33CL"),
fixedProduct(804, "COCA COLA ZERO PET 500 ML"),
fixedProduct(15, "FANTA LIMON LATA 33CL"),
fixedProduct(798, "FANTA NATANJA PET 500 ML"),
fixedProduct(14, "FANTA NARANJA LATA 33CL"),
fixedProduct(22, "NESTEA FRUTOS ROJOS LATA 33CL", "Comprando 2 cajas PRECIO OFERTA"),
fixedProduct(21, "NESTEA LIMON LATA 33CL", "Comprando 2 cajas PRECIO OFERTA"),
fixedProduct(799, "NESTEA LIMON PET 500 ML"),
fixedProduct(20, "NESTEA MARACUYA LATA 33CL", "Comprando 2 cajas PRECIO OFERTA"),
fixedProduct(800, "NESTEA MARACUYA PET 500 ML"),
fixedProduct(19, "PEPSI COLA LATA 33CL"),
fixedProduct(18, "SEVEN UP LATA 33CL"),
fixedProduct(26, "TINTO VERANO LIMON CASERA LATA"),
fixedProduct(23, "TONICA LATA 33CL"),

      
    ],
  },
  {
    name: "REFRESCOS 2L / 1.5L",
    products: [
fixedProduct(331, "AQUAPLUS LIMON 1.5 L VALTORRE"),
fixedProduct(40, "AQUARIUS BLANCO 1.5L"),
fixedProduct(39, "AQUARIUS NARANJA 1.5L"),
fixedProduct(38, "CASERA BLANCA 1.5L"),
fixedProduct(36, "CASERA LIMON 1.5L"),
fixedProduct(37, "CASERA NARANJA 1.5L"),
fixedProduct(27, "COCA COLA 2L"),
fixedProduct(28, "COCA COLA ZERO 2L"),
fixedProduct(29, "COCA ZERO S/CAFEINA 2L"),
fixedProduct(31, "FANTA LIMON 2L"),
fixedProduct(30, "FANTA NARANJA 2L"),
fixedProduct(49, "LIMONADA MINUTE MAID 1L"),
fixedProduct(43, "NESTEA FRUTOS ROJOS 1.5L", "Comprando 2 cajas PRECIO OFERTA"),
fixedProduct(42, "NESTEA LIMÓN 1.5L"),
fixedProduct(41, "NESTEA MARACUYA 1.5L"),
fixedProduct(47, "PEPSI COLA 1.75L"),
fixedProduct(33, "REVOLTOSA COLA 2L"),
fixedProduct(35, "REVOLTOSA LIMON 2L"),
fixedProduct(34, "REVOLTOSA NARANJA 2L"),
fixedProduct(32, "SEVEN UP 2L"),
fixedProduct(955, "SUNNY DELIGHT FLORIDA 1.25 L"),
fixedProduct(48, "TONICA SCHWEPPES 1L"),
    ],
  },
  {
    name: "ENERGÉTICAS",
    products: [
fixedProduct(89, "BURN LATA 500ML"),
fixedProduct(78, "CAMALEON 250ML", " Por 10 cajas REGALO 2 cajas"),
fixedProduct(79, "CAMALEON GRANDE 50CL"),
fixedProduct(93, "ENERDRINK COCO Y PIÑA"),
fixedProduct(98, "ENERDRINK COCO LOCO"),
fixedProduct(94, "ENERDRINK FRESA SALVAJE"),
fixedProduct(96, "ENERDRINK MANZANA"),
fixedProduct(95, "ENERDRINK MORA"),
fixedProduct(501, "ENERDRINK SANDIA Y UVA"),
fixedProduct(97, "ENERDRINK TARTA QUESO"),
fixedProduct(558, "FRESHYETI CANDI PLATANO 500 ML"),
fixedProduct(559, "FRESHYETI PINTALENGUAS 500ML"),
fixedProduct(503, "LATA ENERYETI ATOMYC"),
fixedProduct(644, "LATA ENERYETI BLOOM 500ML"),
fixedProduct(645, "LATA ENERYETI CANDY MORA 500ML"),
fixedProduct(646, "LATA ENERYETI CARIBE 500CL"),
fixedProduct(647, "LATA ENERYETI COCO ANYEL 500ML"),
fixedProduct(361, "LATA ENERYETI DRAGON 500ML"),
fixedProduct(648, "LATA ENERYETI FEROZ 500ML"),
fixedProduct(649, "LATA ENERYETI INFRAMUNDO 500CL"),
fixedProduct(650, "LATA ENERYETI ORIGINAL 500ML"),
fixedProduct(101, "LATA ENERYETI PIRULETA 500ML"),
fixedProduct(651, "LATA ENERYETI SANDIA SPLASH 500CL"),
fixedProduct(91, "LOCURA COCO LATA 50CL"),
fixedProduct(92, "LOCURA ENERGY DRINK PEQUEÑO"),
fixedProduct(90, "LOCURA LATA 50CL"),
fixedProduct(88, "MONSTER AZUL 50CL"),
fixedProduct(723, "MONSTER LANDO NORRIS ZER LATA 50 CL"),
fixedProduct(87, "MONSTER MANGO 50CL"),
fixedProduct(725, "MONSTER REHAB PEACH LATA 50 CL"),
fixedProduct(726, "MONSTER RIPPER LATA 50 CL"),
fixedProduct(727, "MONSTER ULTRA STRAWBERRY DREAMS 500 CC"),
fixedProduct(85, "MONSTER ULTRA WHITE 50CL"),
fixedProduct(84, "MONSTER VERDE LATA 50CL"),
fixedProduct(86, "MONSTER ZERO VERDE 50CL"),
fixedProduct(80, "POWER KING 25CL"),
fixedProduct(81, "POWER KING GRANDE 50CL"),
fixedProduct(100, "POWERADE BLOOD 50CL"),
fixedProduct(99, "POWERADE ICE 50CL"),
fixedProduct(82, "RED BULL 250ML"),
fixedProduct(83, "RED BULL SIN AZUCAR 250ML"),
    ],
  },
  {
    name: "VINOS Y LICORES",
    products: [
fixedProduct(140, "ANIS CASTELLANA 70CL", " Por 12 botellas REGALO 1 botella"),
fixedProduct(350, "BAILEYS ORIGINAL 70CL"),
fixedProduct(139, "BRANDY TERRY 1L"),
fixedProduct(413, "CAVA SEMI SECO BONAVAL 3/4"),
fixedProduct(447, "COÑAC SOBERANO MINI"),
fixedProduct(138, "GINEBRA BEEFEATER 70CL", "Comprando 6 unidades PRECIO OFERTA"),
fixedProduct(582, "GINEBRE BEEFEATER 1 L"),
fixedProduct(517, "GINEBRA EXOTICA 1890 70CL"),
fixedProduct(137, "GINEBRA LARIOS 1L"),
fixedProduct(716, "GINEBRA MINIATURA RIVES"),
fixedProduct(583, "GINEBRA PUERTO DE INDIAS 70CL"),
fixedProduct(578, "GINEBRA RIVES 0.70"),
fixedProduct(579, "GINEBRA RIVES 1 L."),
fixedProduct(580, "GINEBRA SEAGRAM´S 70CL"),
fixedProduct(581, "GINEBRA TANQUERAY 70 CL"),
fixedProduct(575, "GINEBRA BEEFEATER MINIATURA"),
fixedProduct(813, "GIENBRA PUERTO INDIA-MINIATURA-"),
fixedProduct(610, "JAGERMEISTER HERB 0.70CL"),
fixedProduct(674, "LICOR 43 70CL"),
fixedProduct(675, "LICOR 43 MINIATURA"),
fixedProduct(676, "LICOR AMARETTO DISARONNO 70 CL"),
fixedProduct(677, "LICOR COCO-RON MALIBU 0.70"),
fixedProduct(678, "LICOR JAGERMEISTER 200 ML 35º ( PETACA )"),
fixedProduct(141, "LICOR MIURA 70CL"),
fixedProduct(679, "LICOR RUAVIEJA HIERBAS 70 CL"),
fixedProduct(698, "MANZANILLA MUY FINA BARBADILLO 3/4","Comprando 12 unidades PRECIO OFERTA"),
fixedProduct(885, "RON BACARDI 1L"),
fixedProduct(346, "RON BACARDI 200 ML ( PETACA )"),
fixedProduct(886, "RON BACARDI C/B MINIATURA"),
fixedProduct(130, "RON BARCELO AÑEJO 70CL"),
fixedProduct(888, "RON BARCELO-MINIATURA-"),
fixedProduct(889, "RON BRUGAL AÑEJO 0.70"),
fixedProduct(129, "RON CACIQUE 70CL"),
fixedProduct(890, "RON LEGENDARIO ELIX 7 AÑOS 0.70"),
fixedProduct(891, "RON MIEL DORAMAS 70 CL."),
fixedProduct(143, "RON MINI BARCELO"),
fixedProduct(715, "RON MINIATURA LEGENDARIO AÑEJO"),
fixedProduct(131, "RON NEGRITA 70CL"),
fixedProduct(893, "RON NEGRITA 200 ML"),
fixedProduct(894, "RON NEGRITA DORADO 0.70"),
fixedProduct(895, "RON NEGRITA DORADO-MINIATURA-"),
fixedProduct(913, "SALITO AZUL UNIDAD"),
fixedProduct(914, "SALITO ROJO UNIDAD"),
fixedProduct(128, "TINTO VERANO CASERA LIMON 1.5L"),
fixedProduct(1025, "VODKA ABSOLUT 70 CL"),
fixedProduct(289, "VODKA ABSOLUT MINIATURA"),
fixedProduct(288, "VODKA ABSOLUTE 200 ML ( PETACA )"),
fixedProduct(1026, "VODKA CARAMELO GECKO 0.70 L 30º"),
fixedProduct(1029, "VODKA CARAMELO RIVES 70CL"),
fixedProduct(1027, "VODKA CIROC APLLE 0.7"),
fixedProduct(1028, "VODKA ERISTOFF 70CL"),
fixedProduct(1006, "VINO BLANCO CASTILLO SAN DIEGO 3/4"),
fixedProduct(126, "VINO BLANCO DON SIMON 1L"),
fixedProduct(121, "VINO BLANCO GRAN DUQUE 1L"),
fixedProduct(123, "VINO BLANCO RIVILLA 2L"),
fixedProduct(1061, "VINO DULCE MATIPE 2L PET"),
fixedProduct(122, "VINO TINTO GRAN DUQUE 1L"),
fixedProduct(877, "VINO TINTO RIOJA BERONIA CRIANZA 3/4"),
fixedProduct(1015, "VINO TINTO RIOJA CAMPOVIEJO 70C"),
fixedProduct(963, "VINO TINTO RIOJA M CACERES3/4 CRIANZA"),
fixedProduct(1018, "VINO TINTO PROTOS COSECHA 3/4"),
fixedProduct(127, "VINO TINTO RIOJA SEÑORES 3/4"),
fixedProduct(124, "VINO TINTO RIVILLA 2L"),
fixedProduct(1019, "VINO TINTO SOLDEPEÑAS 1 L."),
fixedProduct(125, "VINO TINTO DON SIMON 1L"),
fixedProduct(133, "WHISKY BALLANTINES 70CL"),
fixedProduct(1035, "WHISKY CHIVAS REGAL 0.70"),
fixedProduct(1036, "WHISKY DYC 5 AÑOS 70 CL"),
fixedProduct(1040, "WHISKY J&B 200 ML ( PETACA )"),
fixedProduct(134, "WHISKY J&B 70CL"),
fixedProduct(1041, "WHISKY J.B. MINIATURA"),
fixedProduct(1037, "WHISKY JACK DANIEL 200 ML ( PETACA )"),
fixedProduct(1038, "WHISKY JACK DANIELS 3/4"),
fixedProduct(1039, "WHISKY JACK DANIELS MINIATURA"),
fixedProduct(135, "WHISKY JHONNIE WALKER E/ROJA 3/4", "Comprando 12 unidades PRECIO OFERTA"),
fixedProduct(136, "WHISKY JHONNIE WALKER E/ROJA MINIATURA"),
fixedProduct(615, "WHISKY J.WALKER NEGRO MINIATURA"),
fixedProduct(142, "WHISKY MINI WHITE LABEL"),
fixedProduct(1030, "WHISKY WALKER 200 ML ( PETACA )"),
fixedProduct(1031, "WHISKY WALKER BLACK LABEL 70 CL"),
fixedProduct(1032, "WHISKY WALKER NEGRO 1L"),
fixedProduct(1033, "WHISKY WALKER ROJO 1L"),
fixedProduct(132, "WHISKY WHITE LABEL 70CL", "Comprando 6 unidades PRECIO OFERTA"),
		
    ],
  },
  {
    name: "PIZZAS",
    products: [
fixedProduct(273, "PIZZA CAMPOFRIO 5 QUESOS"),
fixedProduct(817, "PIZZA CAMPOFRIO ATUN-CEBOLLA S/TERIYAKI"),
fixedProduct(277, "PIZZA CAMPOFRIO BARBACOA"),
fixedProduct(275, "PIZZA CAMPOFRIO BOLOÑESA"),
fixedProduct(276, "PIZZA CAMPOFRIO CARBONARA"),
fixedProduct(278, "PIZZA CAMPOFRIO JAMON BACON CEBOLLA"),
fixedProduct(274, "PIZZA CAMPOFRIO JAMON QUESO"),
fixedProduct(279, "PIZZA CAMPOFRIO PEPPERONI"),
fixedProduct(280, "PIZZA CAMPOFRIO POLLO KANSAS"),
fixedProduct(281, "PIZZA CAMPOFRIO POLLO MOSTAZA MIEL"),
fixedProduct(282, "PIZZA CAMPOFRIO SALSA MEXICANA"),
      
    ],
  },
  {
    name: "CHARCUTERÍA LONCHEADA",
    products: [
fixedProduct(323, "ANCHOAS CAPRIMAR ABRE FACIL"),
fixedProduct(347, "BACON CASA TARRADELLAS 2X100G"),
fixedProduct(270, "BACON OSCAR MAYER LONCHA 100G"),
fixedProduct(385, "BUDIN PROLONGO 150GR"),
fixedProduct(393, "CABECERO LOMO VIAN SANA 60G"),
fixedProduct(402, "CALLOS CERDO 400GR MONTEALBOR"),
fixedProduct(403, "CALLOS TERNERA 400GR MONTEALBOR"),
fixedProduct(387, "CAÑA DE LOMO NAVIDUL L/40 GR"),
fixedProduct(259, "CHOPPED CERDO CAMPOFRIO 95G"),
fixedProduct(428, "CHOPPED PAVO L/95 GR CAMPOF."),
fixedProduct(258, "CHOPPED TERNERA CAMPOFRIO 95G"),
fixedProduct(430, "CHORIZO BLANCO 65 GR"),
fixedProduct(433, "CHORIZO IBERICO LONCHA 45G NAVIDUL"),
fixedProduct(266, "CHORIZO PAMPLONA REVILLA 65G"),
fixedProduct(435, "CHORIZO PICANTE REVILLA L/65 GR"),
fixedProduct(265, "CHORIZO REVILLA 65G"),
fixedProduct(436, "CHORIZO REVILLA TAQUITOS 65GR"),
fixedProduct(439, "CHORIZO TUNEL PIMIENTA LONCHA 80GR PROLONGO"),
fixedProduct(441, "CHORIZO Y MORCILLA IBERICOS VACIO 200G"),
fixedProduct(467, "COMPANGO 3X100 GR"),
fixedProduct(264, "JAMON COCIDO EXTRA CAMPOFRIO 75G"),
fixedProduct(262, "JAMON CURADO NAVIDUL 50G"),
fixedProduct(687, "LOMO HORNO A LA PIMIENTA PROLONGO 100 G"),
fixedProduct(162, "MARGARINA TULIPAN 225G"),
fixedProduct(163, "MARGARINA TULIPAN 400G"),
fixedProduct(164, "NATA COCINA RENY PICOT 200ML"),
fixedProduct(720, "MINI STICK FUET CF 50G 12U"),
fixedProduct(261, "MORTADELA CON ACEITUNAS CAMPOFRIO 95G"),
fixedProduct(736, "MORTADELA PAVO L/95 GR CAMPOFRIO"),
fixedProduct(260, "MORTADELA SICILIANA CAMPOFRIO 95G"),
fixedProduct(739, "MOZZARELLA OGGI 150GR ROJA"),
fixedProduct(789, "PAVO BRASEADO CAMPOFRIO 75 GR 1 E"),
fixedProduct(263, "PECHUGA PAVO CAMPOFRIO 70G"),
fixedProduct(792, "PECHUGA POLLO EXTRAJUGOSA L/80"),
fixedProduct(846, "QUESO FRESCO 250GR LOS VAZQUEZ"),
fixedProduct(850, "QUESO LONCHA CASERIO 8/U"),
fixedProduct(851, "QUESO LONCHA TRANCHETE 7 131.25X9"),
fixedProduct(745, "QUESO OGGI RALLADO 4 QUESOS 150G"),
fixedProduct(854, "QUESO PORCIONES CASERIO 8/U"),
fixedProduct(862, "QUESO RALLADO GRATINAR HOCHLAND 100G"),
fixedProduct(863, "QUESO RALLADO OGGI FUNDIR PARA PASTA 200G"),
fixedProduct(864, "QUESO RALLADO VERDE PASTA HOCHLAND 50 G"),
fixedProduct(855, "QUESO ROQUEFORT 100 GR"),
fixedProduct(245, "QUESO SEMI PUROVI 1.50E"),
fixedProduct(478, "QUESO SEMI NAVIDUL CUÑA  170 GR"),
fixedProduct(858, "QUESO TIERNO SIN LACTOSA 110 GR.NAVID.2€"),
fixedProduct(267, "SALAMI REVILLA 65G"),
fixedProduct(900, "SALCHICHAS CAMPESAN PACK 3 CAMPOFRIO"),
fixedProduct(271, "SALCHICHAS CAMPOFRIO FRANKFURT"),
fixedProduct(901, "SALCHICHAS MONTEALBOR VACIO 1KG"),
fixedProduct(902, "SALCHICHAS JAMON CAMPOFRIO PACK 3"),
fixedProduct(905, "SALCHICHAS POLLO 6 UN.CAMPOFRIO 140 G"),
fixedProduct(906, "SALCHICHAS POLLO MONTEALBOR 250 G"),
fixedProduct(910, "SALCHICHON IBERICO LONCHAS NAVIDUL 45GRS"),
fixedProduct(268, "SALCHICHON REVILLA 65G"),
fixedProduct(912, "SALCHICHON TUNEL PIMIENTA LONCHA 80GR PROLONGO"),
fixedProduct(269, "TAQUITOS NAVIDUL 50G"),
      
    ],
  },
  {
    name: "APERITIVOS",
    products: [
fixedProduct(315, "ALTRAMUZ SALADITO BANDEJA 250GR C/10"),
fixedProduct(328, "APETINAS KETCHUP 25G"),
fixedProduct(329, "APETINAS KETCHUP 90G"),
fixedProduct(195, "BOLAS MATCHBALL 105G"),
fixedProduct(189, "BUSCALIOS BARBACOA"),
fixedProduct(443, "CHURRUCA KIKONAZO PLUS 50 UNID."),
fixedProduct(626, "CHURRUCA KIKONAZOS SUPER SENIOR XXL 10U"),
fixedProduct(572, "CHURRUCA GIGANTONES EJECUTIVO CAJA 10U"),
fixedProduct(573, "CHURRUCA GIGANTONES SENIOR 20U"),
fixedProduct(574, "CHURRUCA GIGANTONES SUPER SENIOR XXL 10U"),
fixedProduct(444, "CHURRUCA PASARRATOS EJECUTIVE 10UDS"),
fixedProduct(445, "CHURRUCA PASARRATOS SENIOR 20UDS"),
fixedProduct(762, "CHURRUCA PASARRATOS SUPER SENIOR XXL 10U"),
fixedProduct(473, "CORTEZAS 100 GR CARTUJANO"),
fixedProduct(200, "GOFRE CON CHOCO 110G"),
fixedProduct(589, "GUSANITO 85GR 8U RISI"),
fixedProduct(590, "GUSANITOS QUESO 110GR CARTUJANO"),
fixedProduct(604, "HUEVOS KINDER INVIERNO UNI"),
fixedProduct(619, "JUMMY 100GR 9U"),
fixedProduct(620, "JUMPERS MANTEQUILLA"),
fixedProduct(621, "JUMPERS YORK Y QUESO 24 U"),
fixedProduct(622, "KASKYS 120 G"),
fixedProduct(623, "KASKYS 45G"),
fixedProduct(627, "KINDER BUENO CHOCO PACK 10"),
fixedProduct(628, "KINDER BUENO WHITE PACK 10"),
fixedProduct(714, "MINI APENINAS KETCHUP 24G 0.50€"),
fixedProduct(717, "MINI KASKYS 40G 0.50€"),
fixedProduct(718, "MINI PICOTEO 30G"),
fixedProduct(750, "PALOMITA CARAMELO FAM 16U"),
fixedProduct(752, "PALOMITA CHOCO FAM 16U"),
fixedProduct(751, "PALOMITA CHOCO BLANCO FAM 16U"),
fixedProduct(201, "PALOMITA KETCHUP MOSTAZA 8U"),
fixedProduct(754, "PALOMITA MANTEQUILLA RISI 8U"),
fixedProduct(778, "PATATAS AL AJILLO HISPALANA 140G"),
fixedProduct(773, "PATATAS BACALAO 180G","OFERTA"),
fixedProduct(191, "PATATAS HISPALANA 140G", "Por 1 caja REGALO 1 paquete"),
fixedProduct(781, "PATATAS LIGHT EL CARTUJANO"),
fixedProduct(782, "PATATAS QUESO HISPALANA 140G"),
fixedProduct(197, "PATATAS RUEDAS 100G"),
fixedProduct(784, "PATATAS SABOR BACON HISPALANA 140G"),
fixedProduct(785, "PATATAS SABOR JAMON HISPALANA 140G"),
fixedProduct(786, "PATATAS TRADICIONAL 180G 1.5€"),
fixedProduct(830, "POPITAS MANTEQUILLA MICRO BORGES 100 MICRO"),
fixedProduct(831, "POPITAS UNIDAD BORGES 100 MICRO"),
fixedProduct(408, "PIPAS CASCALES DOÑA PIPA JUVENIL DE 30 UN"),
fixedProduct(409, "PIPAS CASCALES GRANDE DOÑA PIPA 14 U"),
fixedProduct(304, "PIPAS SEVILLANAS AGUASAL"),
fixedProduct(186, "PIPAS SEVILLANAS"),
fixedProduct(938, "PIPAS SEVILLANAS SIN SAL"),
fixedProduct(192, "PRINGLES CREAM ONION 70G"),
fixedProduct(1055, "PRINGLES ONION 165G"),
fixedProduct(193, "PRINGLES ORIGINAL 70G"),
fixedProduct(194, "PRINGLES ORIGINAL 165G"),
fixedProduct(849, "QUESO KIKO PLUS JUN.30 UNID"),
fixedProduct(196, "REVUELTO CARTUJANO 120G"),
fixedProduct(188, "RISKETOS 120G"),
fixedProduct(187, "SEVILLANAS REBUJINAS 120G"),
fixedProduct(190, "SEVILLANAS TOSTAITOS"),
fixedProduct(945, "SPIDERS 70G"),
fixedProduct(958, "TEJITAS FAMI RISI 8U"),
fixedProduct(199, "TOTAS CAMPESINA 100G"),
fixedProduct(1058, "TOTAS CHORIZO 100G"),	
fixedProduct(198, "TOTAS ESTILO CASERO 100G"),
fixedProduct(981, "TOTAS JAMON ONDULADAS 100G"),
fixedProduct(982, "TOTAS QUESO CABRA Y CEBOLLA 100G"),
fixedProduct(983, "TOTAS QUESO CURADO 100G"),
fixedProduct(1057, "TOTAS YORK QUESO 100G"),
fixedProduct(984, "TOTAS CAMPESINA SABOR FUET 100G"),		
fixedProduct(980, "TOSTAITOS SEVILLANAS 100 G X 10"),
fixedProduct(986, "TRISKYS FAM 16U"),
fixedProduct(1044, "YOGO ICE 10UDS","Por 1 caja REGALO 2 unidades"),
fixedProduct(1045, "ZAMBA FRUTAS SURTIDAS P10"),
      
    ],
  },
  {
    name: "LECHES Y BATIDOS/CAFÉS/LÁCTEOS",
    products: [
      fixedProduct(151, "BATIDO PULEVA CACAO 1L"),
fixedProduct(154, "BATIDO PULEVA CACAO P6 200"),
fixedProduct(152, "BATIDO PULEVA FRESA 1L"),
fixedProduct(155, "BATIDO PULEVA FRESA P6 200"),
fixedProduct(153, "BATIDO PULEVA VAINILLA 1L"),
fixedProduct(156, "BATIDO PULEVA VAINILLA P6 200"),
fixedProduct(160, "CAFE FRIO LANDESSA CARAMELO"),
fixedProduct(158, "CAFE FRIO LANDESSA CON LECHE"),
fixedProduct(1059, "CAFE FRIO ÑANDESSA DESCAFEINADO"),
fixedProduct(396, "CAFE FRIO LANDESSA KAKAO"),
fixedProduct(157, "CAFE FRIO LANDESSA CAPUCHINO"),
fixedProduct(159, "CAFE FRIO LANDESSA SOLO"),
fixedProduct(161, "CAFE FRIO LANDESSA VAINILLA"),
fixedProduct(656, "LECHE CONDENSADA LECHERA LATA 370"),
fixedProduct(655, "LECHE CONDENSADA LA LECHERA 450 G SIRVEFACIL"),
fixedProduct(145, "LECHE COVAP ENTERA 1L"),
fixedProduct(657, "LECHE COVAP DESNATADA 1 L."),
fixedProduct(146, "LECHE COVAP SEMIDESNATADA 1L"),
fixedProduct(147, "LECHE COVAP SIN LACTOSA ENTERA 1L"),
fixedProduct(148, "LECHE COVAP SIN LACTOSA SEMI 1L"),
fixedProduct(660, "LECHE OFERTA ENTERA 1L","Por 5 Cajas REGALO 3 unidades"),
fixedProduct(149, "LECHE PULEVA ENTERA 1L"),
fixedProduct(150, "LECHE PULEVA A+D SEMI 1L"),
    ],
  },
  {
    name: "ZUMOS",
    products: [
fixedProduct(53, "BIOFRUTA PASCUAL 1L TROPI"),
fixedProduct(52, "BIOFRUTA PASCUAL IBIZA P3"),
fixedProduct(51, "BIOFRUTA PASCUAL PACIFICO P3"),
fixedProduct(50, "BIOFRUTA PASCUAL TROPICAL P3"),
fixedProduct(1047, "BIOFRUTA TROPICAL PASCUAL P6"),
fixedProduct(504, "ENJOY 1/2 L NARANJA"),
fixedProduct(55, "FUNCIONA D.SIMON CARIBE P6"),
fixedProduct(56, "FUNCIONA D.SIMON MEDITERRANEO P6"),
fixedProduct(54, "FUNCIONA D.SIMON TROPICAL P6"),
fixedProduct(77, "KUYX 330ML FRUTOS ROJOS", "Por 1 caja REGALO 1 unidad KUYX 330ML FRUTOS ROJOS"),
fixedProduct(76, "KUYX 330ML MANGO", "Por 1 caja REGALO 1 unidad KUYX 330ML FRUTOS ROJOS"),
fixedProduct(72, "KUYX 330ML MANDARINA", "Por 1 caja REGALO 1 unidad KUYX 330ML FRUTOS ROJOS"),
fixedProduct(71, "KUYX 330ML NARANJA", "Por 1 caja REGALO 1 unidad KUYX 330ML FRUTOS ROJOS"),
fixedProduct(75, "KUYX 330ML OCEANICO", "Por 1 caja REGALO 1 unidad KUYX 330ML FRUTOS ROJOS"),
fixedProduct(74, "KUYX 330ML PIÑA", "Por 1 caja REGALO 1 unidad KUYX 330ML FRUTOS ROJOS"),
fixedProduct(73, "KUYX 330ML TROPICAL", "Por 1 caja REGALO 1 unidad KUYX 330ML FRUTOS ROJOS"),
fixedProduct(67, "KUYX FRUTOS DEL BOSQUE 3L", "Por 2 cajas REGALO 1 unidad KUYX PIÑA COCO 3L"),
fixedProduct(66, "KUYX MANDARINA 3L", "Por 2 cajas REGALO 1 unidad KUYX PIÑA COCO 3L"),
fixedProduct(64, "KUYX NARANJA 3L", "Por 2 cajas REGALO 1 unidad KUYX PIÑA COCO 3L"),
fixedProduct(70, "KUYX OCEANICO 3L", "Por 2 cajas REGALO 1 unidad KUYX PIÑA COCO 3L"),
fixedProduct(68, "KUYX PIÑA 3L", "Por 2 cajas REGALO 1 unidad KUYX PIÑA COCO 3L"),
fixedProduct(69, "KUYX PIÑA COCO 3L", "Por 2 cajas REGALO 1 unidad KUYX PIÑA COCO 3L"),
fixedProduct(65, "KUYX TROPICAL 3L", "Por 2 cajas REGALO 1 unidad KUYX PIÑA COCO 3L"),
fixedProduct(59, "ROSTOY MELOCOTON 33CL"),
fixedProduct(60, "ROSTOY PIÑA COCO 33CL"),
fixedProduct(46, "SIMON LIFE MANGO 1.5L"),
fixedProduct(25, "SIMON LIFE MANGO LATA 33CL"),
fixedProduct(45, "SIMON LIFE MANDARINA 1.5L"),
fixedProduct(936, "SIMON LIFE MANDARINA P-4 (4314)"),
fixedProduct(44, "SIMON LIFE NARANJA 1.5L"),
fixedProduct(934, "SIMON LIFE 33CL NARANJA (12738)"),
fixedProduct(937, "SIMON LIFE NARANJA P-4 (4313)"),
fixedProduct(954, "SUNNY 330 CL FLORIDA P-12"),
fixedProduct(380, "ZUMO BOTELLIN JUVER MELOCOTON 200 ML"),
fixedProduct(381, "ZUMO BOTELLIN JUVER PIÑA 200 ML"),
fixedProduct(1052, "ZUMO D.SIMON NARANJA 200 P-6 (3039)"),
fixedProduct(58, "ZUMO D.SIMON MELOCOTON P6 200"),
fixedProduct(57, "ZUMO D.SIMON PIÑA P6 200"),
fixedProduct(62, "ZUMO JUVER MELOCOTON 850ML"),
fixedProduct(63, "ZUMO JUVER NARANJA 850ML"),
fixedProduct(61, "ZUMO JUVER PIÑA 850ML"),
      
    ],
  },
  {
    name: "ALIMENTACIÓN",
    products: [
     fixedProduct(165, "ACEITE GIRASOL ROSIL 1L", "Por 1 cajas REGALO 1 unidad"),
fixedProduct(166, "ACEITE GIRASOL ROSIL 5L"),
fixedProduct(167, "ACEITE OLIVA VIRGEN ROSIL 1L"),
fixedProduct(313, "ALCACHOFA DIAMIR 6/8 LT 390 GR"),
fixedProduct(312, "ALBONDIGAS LOURIÑO L/425"),
fixedProduct(311, "ALBONDIGAS C/GUISAN LOURIÑO L/425"),
fixedProduct(316, "FRASCO ALUBIAS FRASCO 570 GR"),
fixedProduct(182, "ARROZ BRILLANTE 1KG"),
fixedProduct(183, "ARROZ BRILLANTE 500G"),
fixedProduct(336, "ARROZ CIGALA 500 GR."),
fixedProduct(337, "ARROZ SOS 1/2"),
fixedProduct(338, "ATUN DIAMIR 1KG"),
fixedProduct(340, "ATUN RAZO AC/VEG. PACK 3 ABREFACIL","Por 4 unidades REGALO 1 unidad"),
fixedProduct(342, "AVECREM POLLO 8"),
fixedProduct(168, "AZUCAR 1KG", "Comprando 2 cajas REGALO 1 K"),
fixedProduct(345, "AZUCAR SOBRES 10GR CONSEMUR"),
fixedProduct(390, "CABALLERO GARBANZOS LECHOSO 1/2 K"),
fixedProduct(392, "CABALLERO LENTEJAS VERDINA 1/2 KG"),
fixedProduct(391, "CABALLERO LENTEJAS CASTELLANA 1/2 K"),
fixedProduct(673, "CABALLERO LENTEJAS PARDINA 1/2 K"),
fixedProduct(388, "CABALLA ACEITE/V UBAGO 90"),
fixedProduct(389, "CABALLA UBAGO TOMATE 90G"),
fixedProduct(179, "CALDO GALLINA BLANCA POLLO 1L"),
fixedProduct(400, "CALDO GOURMET POLLO 1L"),
fixedProduct(397, "CALAMAR MIAU AMERICANA RO-85P3"),
fixedProduct(398, "CALAMAR MIAU TINTA RO-85P3"),
fixedProduct(406, "CANELA MOLIDA LA BARRACA"),
fixedProduct(407, "CANELA RAMA LA BARRACA"),
fixedProduct(424, "CHAMPIÑON GOURMET ENTERO 185GR"),
fixedProduct(425, "CHAMPIÑON NATURAL LAMINADO L/500"),
fixedProduct(455, "COLA-CAO 400 G"),
fixedProduct(457, "COLORANTE LA BARRACA"),
fixedProduct(462, "COMINO GRANO LA BARRACA B/PEQUEÑO"),
fixedProduct(463, "COMINO MOLIDO LA BARRACA BTE PEQUEÑO"),
fixedProduct(505, "ENSALADA PIMIENTOS ASADOS ALSUR L/420GR"),
fixedProduct(506, "ESPARRAGOS GOURMET EXT.FCO 9/12 205G (8096)"),
fixedProduct(507, "ESPARRAGOS TRIGUEROS ALSUR TROC 390 GR AF"),
fixedProduct(510, "ESPINACAS ALSUR FRASCO 660GR"),
fixedProduct(519, "FABADA ASTURIANA LITORAL LT 435 GR"),
fixedProduct(537, "FOIGRAS PIARA 75 GR P3"),
fixedProduct(538, "FOIGRAS PIARA 800 GR"),
fixedProduct(539, "FOIGRAS APIS 200 GR"),
fixedProduct(540, "FOIGRAS APIS P3 80 GR NORMAL"),
fixedProduct(180, "FRASCO GARBANZOS FRASCO 560G"),
fixedProduct(526, "GALLO FIDEOS Nº0 250 GR"),
fixedProduct(527, "GALLO FIDEOS Nº1 250 GR"),
fixedProduct(528, "GALLO FIDEOS Nº2 250 GR"),
fixedProduct(529, "GALLO FIDEOS Nº4 250 GR"),
fixedProduct(689, "GALLO MACARRONES Nº 6 250 GR"),
fixedProduct(690, "GALLO MACARRONES VEGETALES 250 GR"),
fixedProduct(764, "GALLO PASTA ESTRELLAS 250GR"),
fixedProduct(765, "GALLO PASTA FIDEUA 250 GR"),
fixedProduct(766, "GALLO PASTA HELICE C/VGET 250"),
fixedProduct(767, "GALLO PASTA LETRA 250GR"),
fixedProduct(768, "GALLO PASTA MACARRONES Nº6 500G"),
fixedProduct(769, "GALLO PASTA SPAGHETTI 500G"),
fixedProduct(770, "GALLO PASTA TALLARIN 250"),
fixedProduct(944, "GALLO SPAGUETTI 250 GR"),
fixedProduct(960, "GALLO TIBURON N 0 250 GR"),
fixedProduct(587, "GUISANTES LOZANO LT 185"),
fixedProduct(588, "GUISANTES LOZANO LATA 500 GRS."),
fixedProduct(593, "HAMBURGUESAS SIMON DE POLLO P-3","Por 2 cajas REGALO 2 bolsas Patatas Congeladas 1kg"),
fixedProduct(595, "HARINA PANAERAS FREIR 1 K","OFERTA"),
fixedProduct(596, "HARINA PANAERAS FREIR 500"),
fixedProduct(597, "HARINA PANAERAS REPOSTERIA 1 K.","OFERTA"),
fixedProduct(598, "HARINA PANAERAS REPOSTER.500 G"),
fixedProduct(599, "HARINA YOLANDA REBOZAR 500"),
fixedProduct(600, "HIERBAS NATURALES BARRACA 15G"),
fixedProduct(225, "HUEVOS P12 L","2,85 € docena. Comprando 1 caja sale a 2,71 €"),
fixedProduct(616, "JUDIA ANCHA CORTADA ALSUR FRASCO 660 G"),
fixedProduct(185, "KETCHUP ORLANDO 265G"),
fixedProduct(625, "KETCHUP PRIMA 290G"),
fixedProduct(692, "MAIZ DULCE GOURMET DULCE 140G P-3"),
fixedProduct(694, "MAIZ GOURMET DULCE 285GR"),
fixedProduct(699, "MANZANILLA SOBRE LA BARRACA"),
fixedProduct(184, "MAYONESA YBARRA 450G"),
fixedProduct(702, "MAYONESA PRIMA 400"),
fixedProduct(705, "MEJILLON CALVO ESCAB PACK3/80"),
fixedProduct(707, "MELOCOTON CONSEMUR EXTRA 1KG"),
fixedProduct(708, "MELVA ACEITE DIAMIR RO 1KG"),
fixedProduct(709, "MELVA CANUTERA PLAYA GIRASOL RR125"),
fixedProduct(738, "MOSTAZA ORLANDO 260 GR"),
fixedProduct(741, "NESQUIK BOTE 400 GR."),
fixedProduct(747, "OREGANO HOJA LA BARRACA BOTE"),
fixedProduct(181, "PAN RALLADO PANAERAS 300G", "OFERTA"),
fixedProduct(772, "PATATAS 3/8 1 KG (MARQUISE)"),
fixedProduct(779, "PATATAS GOURMET BABY 420GR"),
fixedProduct(797, "PEREJIL LA BARRACA BTE PEQUEÑO"),
fixedProduct(805, "PIÑA JUGO EXT DIAMIR P3 227"),
fixedProduct(806, "PIMENTON DULCE 1/8 LA BARRACA-LATA-"),
fixedProduct(807, "PIMENTON PICANTE BARRACA"),
fixedProduct(808, "PIMIENTA NEGRA GRANO LA BARRACA BTE PEQUEÑO"),
fixedProduct(809, "PIMIENTA NEGRA MOLIDA LA BARRACA"),
fixedProduct(810, "PIMIENTO MORRON EXTRA P-3"),
fixedProduct(811, "PIMIENTO PIQUILLO DIAMIR 185G"),
fixedProduct(812, "PIMIENTOS ASADOS 445GR. CRISTAL CAMPO RICO"),
fixedProduct(816, "PISTO ORLANDO LATA 410 GR"),
fixedProduct(222, "POLVILLO ANDALUZA CAJA 47U"),
fixedProduct(223, "POLVILLO ANDALUZA GOURMET CAJA 54U"),
fixedProduct(996, "POLVILLO VIENA GRANDE ( 45 UNIDADES )"),
fixedProduct(224, "POLVILLO VIENA ARTESANA CAJA 65U"),
fixedProduct(787, "PATE LOURIÑO LATA 840 GR."),
fixedProduct(169, "SAL FINA 1KG"),
fixedProduct(170, "SAL GRUESA CHALUPA 1KG"),
fixedProduct(442, "SALSA ALIOLI CHOVI 250 ML"),
fixedProduct(915, "SALSA ALIOLI MONTEALBOR 180ML"),
fixedProduct(916, "SALSA BOLOÑESA GALLO FCO 230 GR"),
fixedProduct(917, "SALSA COCKTAIL YBARRA 250 GR"),
fixedProduct(918, "SALSA GAUCHA BOCABAJO 300ML"),
fixedProduct(919, "SALSA MOJO PICON CANARIO BOTE 180GR","OFERTA"),
fixedProduct(920, "SALSA VERDE 180GR MONTEALBOAR"),
fixedProduct(921, "SALSA WHISKY MONTEALBOR BOTE 180GRS"),
fixedProduct(922, "SALSA YBARRA ALI-OLI 225"),
fixedProduct(923, "SALSA YBARRA ALI-OLI BOTE"),
fixedProduct(924, "SALSA YBARRA COCKTAIL 450 ML."),
fixedProduct(925, "SALSA YBARRA GAUCHA 225 GR"),
fixedProduct(926, "SARDINAS ACEITE F.A 90G"),
fixedProduct(927, "SARDINAS TOMATE F.A 90G"),
fixedProduct(939, "SOPA GALLINA BLANCA 24 SB AVE C/ARROZ"),
fixedProduct(940, "SOPA GALLINA BLANCA POLLO-FID.FINOS 18SOB."),
fixedProduct(941, "SOPA GALLINA BLANCA  TERNERA-ESTRELLA 24S"),
fixedProduct(943, "SOPA GALLINA BLANCA STANDAR AVE CON FIDEOS"),
fixedProduct(942, "SOPA GALLINA BLANCA VERDURAS 24 S"),
fixedProduct(959, "TE LA BARRACA 10U."),
fixedProduct(171, "TOMATE FRITO ORLANDO 400G"),
fixedProduct(172, "TOMATE FRITO ORLANDO 800G"),
fixedProduct(173, "TOMATE FRITO ORLANDO 350G"),
fixedProduct(174, "TOMATE FRITO MARTINETE 810G"),
fixedProduct(175, "TOMATE FRITO MARTINETE 400G"),
fixedProduct(969, "TOMATE FRITO FRUCO/APIS"),
fixedProduct(967, "TOMATE ENTERO MARTINETE 400"),
fixedProduct(968, "TOMATE ENTERO MARTINETE 810"),
fixedProduct(176, "TOMATE TRITURADO MARTINETE 810G"),
fixedProduct(177, "TOMATE TRITURADO MARTINETE 400G"),
fixedProduct(976, "TOMATE TRITURADO APIS 800"),
fixedProduct(961, "TILA BARRACA 10U."),
fixedProduct(997, "VINAGRE FLOR DEL CONDADO 1/2 L"),
fixedProduct(998, "VINAGRE FLOR DEL CONDADO 1 L."),
fixedProduct(1003, "VINAGRE MANZANA PRIMA 3/4"),
fixedProduct(1004, "VINAGRE YBARRA 1/2 L."),
fixedProduct(1005, "VINAGRE YBARRA 1 L."),
fixedProduct(178, "YATEKOMO POLLO 60G"),
fixedProduct(1046, "ZANAHORIA GOURMET TIRAS 180 GR"),

    ],
  },
  {
    name: "DROGUERIA",
    products: [
     fixedProduct(298, "AGUA FUERTE 1.5L KIRIKO"),
fixedProduct(313, "ALUMINIO DOMESTICO 30"),
fixedProduct(319, "ALUMINIO DOMESTICO 8 METROS"),
fixedProduct(320, "AMONIACO NORMAL KIRIKO 1.5LT"),
fixedProduct(321, "AMONIACO PERFUMADO 1.5L KIRIKO"),
fixedProduct(464, "COMPRESA AFECTIVA NOCHE 10U"),
fixedProduct(465, "COMPRESA AFECTIVA NOCHE ALA 14U"),
fixedProduct(470, "COMPRESA AFECTIVA ECONOMICA EST.20 UNI"),
fixedProduct(466, "COMPRESA AFECTIVA ULTRA ALA 16U"),
fixedProduct(468, "COMPRESA EVAX FINA Y SEGURA NORM 16 U"),
fixedProduct(471, "COMPRESA FINA Y SEG.ALAS NORMAL EVAX 12U"),
fixedProduct(479, "CUBO FREGONA KARIN + ESCURRIDOR"),
fixedProduct(486, "DESENGRASANTE AGERUL PIST 750"),
fixedProduct(485, "DESENGRASANTE NUCA MAX 1L PERFUMADO EL MILAGRITO"),
fixedProduct(487, "DESENGRASANTE PISTOLA 750 KIRIKO"),
fixedProduct(208, "DETERGENTE KIRIKO BASICO 2.8L"),
fixedProduct(496, "DETERGENTE LIQUIDO  J.MARSELLA 3L KIRIKO"),
fixedProduct(489, "DETERGENTE LIQUIDO 5L LUCECITA ORIGINAL KIRIKO"),
fixedProduct(490, "DETERGENTE LIQUIDO 5L LUCECITA AZUL KIRIKO"),
fixedProduct(491, "DETERGENTE LIQUIDO 5L LUCECITA J MARSELLA KIRIKO"),
fixedProduct(493, "DETERGENTE LIQUIDO 2.8L LUCECITA ORIGINAL"),
fixedProduct(207, "DETERGENTE KIRIKO MARSELLA 3L"),
fixedProduct(220, "ESCOBA PRIMER PRECIO"),
fixedProduct(515, "ESTROPAJO MICAL SALVAUÑAS P-3"),
fixedProduct(210, "FLOTA VAJILLAS 750ML"),
fixedProduct(209, "FLOTAS VAJILLAS 1.1L"),
fixedProduct(536, "FLOTA PASTILLAS VERDE NORMAL 250 G"),
fixedProduct(542, "FREGASUELO COLONIA 1.500 L KIRIKO"),
fixedProduct(544, "FREGASUELOS ASEVI CIAN 1L"),
fixedProduct(545, "FREGASUELOS ASEVI MIO 1L"),
fixedProduct(546, "FREGASUELOS ASEVI NARANJA 1L"),
fixedProduct(212, "FREGASUELOS DAMA NOCHE 1.5L"),
fixedProduct(548, "FREGASUELOS FLORAL 1.5 L KIRIKO"),
fixedProduct(213, "FREGASUELOS J.MARSELLA 1.5L"),
fixedProduct(550, "FREGASUELOS KIRIKO LIMON 1,5L"),
fixedProduct(211, "FREGASUELOS PINO KIRIKO 1.5L"),
fixedProduct(214, "FREGASUELOS SPA 1.5L"),
fixedProduct(553, "FREGASUELOS TALCO 1.5L KIRIKO"),
fixedProduct(554, "FREGONA MICAL ALGODON"),
fixedProduct(555, "FREGONA MICAL AMARILLA"),
fixedProduct(556, "FREGONA MICAL AZUL"),
fixedProduct(557, "FREGONA MICAL MICROFIBRA"),
fixedProduct(571, "GEL FIJA GIORGI MAX EXT FUERTE 240 N3 NEW"),
fixedProduct(217, "HIGIENICO ECONOMICO P12"),
fixedProduct(602, "HIGIENICO RENOVA DUPLEX P4"),
fixedProduct(606, "JABON DE MANOS COCINAS 500ML NAVINIA"),
fixedProduct(607, "JABON DE MANOS DERMO 500ML NAVINIA"),
fixedProduct(608, "JABON DE MANOS FRESA Y NATA 500ML NAVINIA"),
fixedProduct(662, "LEJIA ACE 2 L."),
fixedProduct(205, "LEJIA + DETERGENTE KIRIKO 2L"),
fixedProduct(203, "LEJIA AMARILLA KIRIKO 2L"),
fixedProduct(664, "LEJIA COLOR 1 LT KIRIKO"),
fixedProduct(666, "LEJIA ESTRELLA AZUL 1.5 L."),
fixedProduct(667, "LEJIA ESTRELLA PINO 1.5 L."),
fixedProduct(204, "LEJIA LAVADORA KIRIKO 2L"),
fixedProduct(206, "LEJIA LIMON PERFUMADA KIRIKO 2L"),
fixedProduct(670, "LEJIA LIMON ESTRELLA 1.5L"),
fixedProduct(202, "LEJIA PINO PERFUMADA KIRIKO 2L"),
fixedProduct(681, "LIMPIAHOGAR BAÑOS 1.500 KIRIKO"),
fixedProduct(215, "LIMPIACRISTALES KIRIKO 500ML"),
fixedProduct(696, "MANGO 1.40 PINTADO ROJO (BARATO)"),
fixedProduct(216, "PAPEL HIGIENICO FAMADIS 6R"),
fixedProduct(759, "PAPEL FILMS MERCASUR 30 M"),
fixedProduct(788, "PAÑUELOS RENOVA P-6"),
fixedProduct(815, "PISTOLA NUCA MAX 1L PERFUMADO EL MILAGRITO"),
fixedProduct(860, "QUITAMANCHAS ESPECIAL ROPA PULVERIZADOR KIRIKO"),
fixedProduct(867, "RECOGEDOR C/MANGO"),
fixedProduct(453, "ROLLO COCINA NICKY LIMON P-2"),
fixedProduct(879, "ROLLO COCINA RENOVA PACK 2"),
fixedProduct(218, "SECAMANO BUENO"),
fixedProduct(233, "SERVILLETA DOBLE BLANCA P2"),
fixedProduct(931, "SERVILLETAS CELIA 30X30 MORADA"),
fixedProduct(953, "SUAVIZANTE  SAN 1.5L AZUL (FLORAL)"),
fixedProduct(947, "SUAVIZANTE KIRIKO AZUL 2L"),
fixedProduct(948, "SUAVIZANTE SPA 2L KIRIKO"),
fixedProduct(949, "SUAVIZANTE TALCO 2L KIRIKO"),
fixedProduct(950, "SUAVIZANTE SAN 1.29L CELESTE"),
fixedProduct(951, "SUAVIZANTE SAN 1.29L ESENCIAS PARA RECORDAR"),
fixedProduct(952, "SUAVIZANTE SAN 1.29L TALCO ROSA"),
fixedProduct(965, "TOALLITAS DODOT BASICO REC. 54U"),
fixedProduct(219, "TOALLITAS BEBE BEKIDS 120U", "Por 1 Caja REGALO 2 unidades"),
fixedProduct(1002, "VINAGRE LIMPIEZA KIRIKO 1L"),
fixedProduct(221, "PASTA COLGATE 75ML"),
      
    ],
  },
  {
    name: "CHARCUTERÍA CORTE",
    products: [
      fixedProduct(348, "BACON PROLONGO,KG"),
fixedProduct(394, "CABEZADA LOMO CARLOTEÑA,KG"),
fixedProduct(404, "CALLOS TERNERA BARRA MONTEALBOR,KG."),
fixedProduct(414, "CENTRO JAMON CURADO NAVIDUL KG"),
fixedProduct(243, "CHOPPED CERDO CAMPOFRIO KG"),
fixedProduct(429, "CHOPPED CERDO LATA 2 KG FAMADESA"),
fixedProduct(242, "CHOPPED TERNERA CAMPOFRIO KG"),
fixedProduct(256, "CHORIZO CULAR IBERICO KG"),
fixedProduct(254, "CHORIZO EXTRA VILLAR KG"),
fixedProduct(255, "CHORIZO TRADICIONAL REVILLA KG"),
fixedProduct(440, "CHORIZO TURON TUNEL PIMIENTA 1/2 PIEZA"),
fixedProduct(484, "DELICIA SURIMI,KG"),
fixedProduct(523, "FIAMBRE CASADEMONT 11 X11 KG-DUCADO-"),
fixedProduct(524, "FIAMBRE DE PALETA COCIDA CAMPOFRIO.KG"),
fixedProduct(612, "JAMON COCIDO 1ª CON/PIEL EXTRAJUGOSO"),
fixedProduct(611, "JAMON CASADEMONT 8.600 KG (PEQUEÑO)"),
fixedProduct(614, "JAMON NATURA COCIDO EXTRA CASADEMONT,KG"),
fixedProduct(248, "LOMO AL HORNO FAMADESA KG", "Comprando 1 Caja PRECIO OFERTA"),
fixedProduct(686, "LOMITO IBERICO DE BELLOTA VILLAR KG"),
fixedProduct(688, "LUNCH CAMPOFRIO,KG"),
fixedProduct(249, "MAGRETA AL AJILLO FAMADESA KG", "Comprando 1 Caja PRECIO OFERTA"),
fixedProduct(731, "MORTADELA ACEITU.CASADEMONT,KG"),
fixedProduct(733, "MORTADELA CASADEMONT,KG"),
fixedProduct(734, "MORTADELA CLASICA CAMPOFRIO, KG."),
fixedProduct(735, "MORTADELA PAVO CAMPOFRIO,KG"),
fixedProduct(251, "PALETA REVILLA KG"),
fixedProduct(252, "PECHUGA PAVO NOEL KG"),
fixedProduct(253, "PECHUGA PAVOFRIO KG"),
fixedProduct(247, "POLLO RELLENO BLANCE KG"),
fixedProduct(246, "POLLO RELLENO CARLOTEÑA KG"),
fixedProduct(244, "QUESO BARRA OLDENBURGER GOUDA,KG"),
fixedProduct(843, "QUESO CERDO PROLONGO,KG"),
fixedProduct(844, "QUESO CIGARRAL BARRA,KG","OFERTA"),
fixedProduct(845, "QUESO DON APOLONIO ACEITE KG"),
fixedProduct(847, "QUESO G.BAQUERO CURADO,KG"),
fixedProduct(848, "QUESO G.BAQUERO SEMI,KG"),
fixedProduct(852, "QUESO OVEJA BOFFARD,KG"),
fixedProduct(853, "QUESO OVEJA GRAN RESERVA APOLONIO"),
fixedProduct(856, "QUESO ROQUEFORT,KG"),
fixedProduct(898, "SALAMI EXTRA TURON KG"),
fixedProduct(908, "SALCHICHON CULAR IBERICO 1ª,KG"),
fixedProduct(257, "SALCHICHON TURON KG"),
fixedProduct(907, "SALCHICHÓN TURON TUNEL PIMIENTA 1/2 PIEZA"),


      
    ],
  },
  {
    name: "VARIOS",
    products: [
fixedProduct(234, "ARENA GATO MIC&FRIENDS 5KG", "OFERTA"),
fixedProduct(226, "BANDEJA T89 NEGRA"),
fixedProduct(365, "BOBINA P.V.C. 45X1500"),
fixedProduct(284, "BOLSA 15 x 30 TRAMPARENTE"),
fixedProduct(379, "BOLSA 12X25 PURUÑUELA"),
fixedProduct(369, "BOLSA 30X40 ASA KG FUERTE CAMISETA B.O 70% SEGUN LEY"),
fixedProduct(370, "BOLSA 35X50 ASA FINA 200 U CAMISETA"),
fixedProduct(1060, "BOLSA BLANCA 35X50 1KG NORMAL"),		
fixedProduct(228, "BOLSA BLANCA 42X53 1KG"),
fixedProduct(376, "BOLSA BLANCA 50x60 GRANDE BLANCA"),
fixedProduct(230, "BOLSA BASURA COMUNIDAD 180L"),
fixedProduct(231, "BOLSA BASURA NORMAL 30L"),
fixedProduct(232, "BOLSA PANADERIA 30X43"),
fixedProduct(227, "BOLSA VERDE OFERTA 42X53"),
fixedProduct(378, "BOLSAS 10X20 PURUÑUELA"),
fixedProduct(237, "CARBON"),
fixedProduct(458, "COMIDA GATO MIC&FR.MIX CARNR 4K"),
fixedProduct(460, "COMIDA MIC&FR. PERRO POLLO 300GR"),
fixedProduct(461, "COMIDA PERRO MIC&FRIENDS 4K"),
fixedProduct(239, "FILM INDUSTRIAL 200M"),
fixedProduct(533, "FILMS INDUSTRIAL 45X300 (MELCHO)MORADO LARGO PARA FRUTA"),
fixedProduct(568, "GAS KARIN"),
fixedProduct(704, "MECHERO CLIPER TRANSPARENTE CAJA"),
fixedProduct(719, "MINI SERVI P-2 UNIDAD"),
fixedProduct(238, "PAPEL ALUMINIO IND"),
fixedProduct(236, "PAPEL OCB 100U"),
fixedProduct(761, "PAPEL PARAFINADO"),
fixedProduct(240, "PASTILLAS ENCENDIDO"),
fixedProduct(814, "PINZA PLASTICO 24U"),
fixedProduct(827, "PLATO LLANO"),
fixedProduct(229, "ROLLO COMPOSTABLE 30X40 1KG"),
fixedProduct(881, "ROLLOS PESOS 57 x 55"),
fixedProduct(882, "ROLLOS TPV 57 x 35"),
fixedProduct(883, "ROLLOS TPV 80 x 80"),
fixedProduct(235, "VASO PLASTICO 350CC"),
fixedProduct(989, "VASO 200 C 50UNI"),
fixedProduct(991, "VASO DE TUBO IRROMPIBLE"),
fixedProduct(992, "VASO MACETA"),
fixedProduct(993, "VASO POREX 7 OZ 200CC B/50"),
fixedProduct(1024, "VIVO PERRO POLLO LT 830"),
    ],
  },
];

const imageModules = import.meta.glob(
  "./assets/productos/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}",
  {
    eager: true,
    query: "?url",
    import: "default",
  }
);

const productImagesByIdnum = Object.fromEntries(
  Object.entries(imageModules).map(([path, src]) => {
    const fileName = path.split("/").pop();
    const idnum = Number(
      fileName.toLowerCase().replace(/\.(jpg|jpeg|png|webp)$/, "")
    );
    return [idnum, src];
  })
);

const normalizeForCompare = (text) =>
  String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ]+/gi, "")
    .trim();

const normalizeText = (text) =>
  String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const productMatchesSearch = (product, searchText) => {
  const normalizedProduct = normalizeText(
    `${product.name} ${product.offerText || ""}`
  );
  const searchWords = normalizeText(searchText)
    .split(/[^a-z0-9ñ]+/i)
    .filter(Boolean);

  return searchWords.every((searchWord) =>
    normalizedProduct.includes(searchWord)
  );
};

const productHasOffer = (product) =>
  Boolean(String(product.offerText || "").trim());

const offerProducts = departments.flatMap((department) =>
  department.products
    .filter(productHasOffer)
    .map((product) => ({
      ...product,
      id: `${department.name}-${product.idnum}-${product.name}`,
      sourceDepartment: department.name,
    }))
);

const catalogDepartments = [
  {
    name: "OFERTAS",
    products: offerProducts,
  },
  ...departments,
];

const departmentImages = Object.fromEntries(
  catalogDepartments.map((department) => {
    const firstProductWithImage = department.products.find(
      (product) => productImagesByIdnum[product.idnum]
    );

    return [
      department.name,
      firstProductWithImage
        ? productImagesByIdnum[firstProductWithImage.idnum]
        : null,
    ];
  })
);

const visibleProducts = departments.flatMap((department) =>
  department.products.map((product) => ({
    id: `${department.name}-${product.idnum}-${product.name}`,
    idnum: product.idnum,
    name: product.name,
    offerText: product.offerText || "",
    department: department.name,
    hidden: false,
  }))
);

const visibleProductNamesForCompare = new Set(
  visibleProducts.map((product) => normalizeForCompare(product.name))
);

const hiddenProductsUnique = Array.from(
  new Map(
    hiddenProductsRaw
      .filter(
        (product) =>
          !visibleProductNamesForCompare.has(normalizeForCompare(product.name))
      )
      .map((product) => [normalizeForCompare(product.name), product])
  ).values()
);

const hiddenProductsFormatted = hiddenProductsUnique.map((product) => ({
  id: `ARTÍCULOS BUSCADOS-${product.idnum}-${product.name}`,
  idnum: product.idnum,
  name: product.name,
  offerText: product.offerText || "",
  department: "ARTÍCULOS BUSCADOS",
  hidden: true,
}));

const products = [...visibleProducts, ...hiddenProductsFormatted];

export default function App() {
  const rowRefs = useRef({});
  const departmentDropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const stickyCardRef = useRef(null);

  const getSavedOrder = () => {
    try {
      const saved = localStorage.getItem(ORDER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  const [quantities, setQuantities] = useState(
    () => getSavedOrder().quantities || {}
  );
  const [customerName, setCustomerName] = useState(
    () => getSavedOrder().customerName || ""
  );
  const [notes, setNotes] = useState(() => getSavedOrder().notes || "");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("TODOS");
  const [selectedImage, setSelectedImage] = useState(null);
  const [compactHeader, setCompactHeader] = useState(false);
  const [departmentDropdownOpen, setDepartmentDropdownOpen] = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [language, setLanguage] = useState(
    () => localStorage.getItem(LANGUAGE_STORAGE_KEY) || "es"
  );

  const t = translations[language];

  const getDepartmentLabel = (departmentName) =>
    departmentName === "TODOS"
      ? t.allDepartments
      : t.departmentNames?.[departmentName] || departmentName;

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    const style = document.createElement("style");

    style.innerHTML = `
      @keyframes novedadBlink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.25; }
      }
    `;

    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
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

    viewport.setAttribute("content", "width=device-width, initial-scale=1");
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

  const departmentOptions = useMemo(() => {
    return [
      {
        name: "TODOS",
        label: getDepartmentLabel("TODOS"),
        count: visibleProducts.length,
      },
      ...catalogDepartments.map((department) => ({
        name: department.name,
        label: getDepartmentLabel(department.name),
        count: department.products.length,
      })),
    ];
  }, [language, t.allDepartments]);

  const filteredDepartments = useMemo(() => {
    const cleanSearch = search.trim();

    const visibleDepartments = catalogDepartments
      .filter(
        (department) =>
          selectedDepartment === "TODOS" ||
          department.name === selectedDepartment
      )
      .map((department) => ({
        ...department,
        products: cleanSearch
          ? department.products.filter((product) =>
              productMatchesSearch(product, cleanSearch)
            )
          : department.products,
      }))
      .filter(
        (department) =>
          department.name === "NOVEDAD" ||
          department.name === "OFERTAS" ||
          department.products.length > 0
      );

    if (!cleanSearch || selectedDepartment !== "TODOS") {
      return visibleDepartments;
    }

    const hiddenMatches = hiddenProductsUnique.filter((product) =>
      productMatchesSearch(product, cleanSearch)
    );

    if (hiddenMatches.length > 0) {
      visibleDepartments.push({
        name: "ARTÍCULOS BUSCADOS",
        products: hiddenMatches,
      });
    }

    return visibleDepartments;
  }, [search, selectedDepartment]);

  useEffect(() => {
    if (!filteredDepartments.length) return;

    const firstDepartment = filteredDepartments[0];
    if (!firstDepartment?.products?.length) return;

    const firstProduct = firstDepartment.products[0];
    const firstProductId =
      firstProduct.id ||
      `${firstDepartment.name}-${firstProduct.idnum}-${firstProduct.name}`;

    const timer = setTimeout(() => {
      rowRefs.current[firstProductId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);

    return () => clearTimeout(timer);
  }, [filteredDepartments]);

  const selectedItems = useMemo(() => {
    return products
      .map((product) => ({
        ...product,
        cajas: Number(quantities[product.id]?.cajas || 0),
        unidades: Number(quantities[product.id]?.unidades || 0),
      }))
      .filter((product) => product.cajas > 0 || product.unidades > 0);
  }, [quantities]);

  const updateQuantity = (productId, field, value) => {
    const cleanValue = value.replace(/[^0-9]/g, "");

    setQuantities((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        [field]: cleanValue,
      },
    }));

    setTimeout(() => {
      rowRefs.current[productId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);
  };

  const closeKeyboardOnEnter = (event) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();

      setTimeout(() => {
        stickyCardRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        searchInputRef.current?.focus();
      }, 120);
    }
  };

  const applySearch = () => {
    const cleanValue = searchInput.trim();
    setSearch(cleanValue);
    setSelectedDepartment("TODOS");
  };

  const searchOnEnter = (event) => {
    if (event.key === "Enter") {
      applySearch();
      event.currentTarget.blur();

      setTimeout(() => {
        stickyCardRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
    }
  };

  const openDepartmentDropdown = () => {
    setDepartmentDropdownOpen((open) => {
      const nextOpen = !open;

      if (nextOpen) {
        setTimeout(() => {
          departmentDropdownRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 50);
      }

      return nextOpen;
    });
  };

  const selectDepartment = (departmentName) => {
    setSelectedDepartment(departmentName);
    setSearchInput("");
    setSearch("");
    setDepartmentDropdownOpen(false);

    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }, 80);
  };

  useEffect(() => {
    const handleScroll = () => {
      setCompactHeader(window.scrollY > 120);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const clearOrder = () => {
    setQuantities({});
    setCustomerName("");
    setNotes("");
    setSearchInput("");
    setSearch("");
    setSelectedDepartment("TODOS");
    setDepartmentDropdownOpen(false);
    setShowOrderSummary(false);
    localStorage.removeItem(ORDER_STORAGE_KEY);
  };

  const createWhatsAppMessage = () => {
    const lines = ["NUEVO PEDIDO", ""];

    if (customerName.trim()) {
      lines.push(`Cliente: ${customerName.trim()}`, "");
    }

    selectedItems.forEach((item) => {
      const parts = [];

      if (item.cajas > 0) parts.push(`*${item.cajas} cajas*`);
      if (item.unidades > 0) parts.push(`*${item.unidades} unidades*`);

      lines.push(`- ${item.name}: ${parts.join(" / ")}`);
      lines.push("");
    });

    if (notes.trim()) {
      lines.push(`Observaciones: ${notes.trim()}`, "");
    }

    lines.push("Enviado desde el formulario de pedidos");
    return encodeURIComponent(lines.join("\n"));
  };

  const sendOrder = () => {
    if (selectedItems.length === 0) {
      alert(t.alertEmpty);
      return;
    }

    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${createWhatsAppMessage()}`;

    clearOrder();

    window.location.href = whatsappUrl;
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {!compactHeader && (
          <header style={styles.header}>
            <div style={styles.iconBox}>
              <ShoppingCart size={28} />
            </div>

            <div>
              <h1 style={styles.title}>{t.title}</h1>
              <p style={styles.subtitle}>{t.subtitle}</p>
            </div>
          </header>
        )}

        <div ref={stickyCardRef} style={styles.cardSticky}>
          {!compactHeader && (
            <>
              <label style={styles.label}>{t.language}</label>

              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                style={styles.languageSelect}
              >
                <option value="es">🇪🇸 Español</option>
                <option value="zh">🇨🇳 中文</option>
              </select>

              <label style={styles.label}>{t.customerName}</label>

              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder={t.optional}
                style={styles.input}
              />
            </>
          )}

          <label style={styles.label}>{t.searchProduct}</label>

          <div style={styles.searchAndSendRow}>
            <div style={styles.searchBoxCompact}>
              <Search size={20} style={styles.searchIcon} />

              <input
                ref={searchInputRef}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={searchOnEnter}
                onBlur={applySearch}
                inputMode="search"
                enterKeyHint="done"
                placeholder={t.searchPlaceholder}
                style={styles.searchInput}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowOrderSummary(true)}
              style={{
                ...styles.stickyWhatsappButton,
                opacity: selectedItems.length === 0 ? 0.5 : 1,
              }}
              disabled={selectedItems.length === 0}
            >
              <span>{t.review}</span>
              <span>{t.andSend}</span>
            </button>
          </div>

          <label style={styles.label}>{t.department}</label>

          <div ref={departmentDropdownRef} style={styles.departmentSelector}>
            <button
              type="button"
              onClick={openDepartmentDropdown}
              style={styles.departmentButton}
            >
              <div>
                <div
                  style={{
                    ...styles.departmentButtonLabel,
                    ...(selectedDepartment === "NOVEDAD"
                      ? styles.novedadText
                      : {}),
                  }}
                >
                  {getDepartmentLabel(selectedDepartment)}
                </div>

                <div style={styles.departmentButtonHint}>{t.tapToChangeDepartment}</div>
              </div>

              <ChevronDown
                size={20}
                style={{
                  ...styles.departmentChevron,
                  transform: departmentDropdownOpen
                    ? "rotate(180deg)"
                    : "rotate(0deg)",
                }}
              />
            </button>

            {departmentDropdownOpen && (
              <div style={styles.departmentDropdown}>
                <div style={styles.departmentList}>
                  {departmentOptions.map((option) => {
                    const isActive = selectedDepartment === option.name;
                    const departmentImage = departmentImages[option.name];

                    return (
                      <button
                        key={option.name}
                        type="button"
                        onClick={() => selectDepartment(option.name)}
                        style={{
                          ...styles.departmentOption,
                          ...(isActive ? styles.departmentOptionActive : {}),
                        }}
                      >
                        <div style={styles.departmentOptionContent}>
                          {option.name !== "TODOS" && departmentImage ? (
                            <img
                              src={departmentImage}
                              alt={option.label}
                              style={styles.departmentMiniImage}
                            />
                          ) : (
                            <div style={styles.departmentMiniPlaceholder}>
                              📋
                            </div>
                          )}

                          <div>
                            <div
                              style={{
                                ...styles.departmentOptionName,
                                ...(option.name === "NOVEDAD"
                                  ? styles.novedadText
                                  : {}),
                              }}
                            >
                              {option.label}
                            </div>

                            <div style={styles.departmentOptionCount}>
                              {option.count} {t.articles}
                            </div>
                          </div>
                        </div>

                        {isActive && <Check size={18} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {filteredDepartments.map((department) => (
          <section key={department.name} style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2
                style={{
                  ...styles.sectionTitle,
                  ...(department.name === "NOVEDAD"
                    ? styles.novedadText
                    : {}),
                }}
              >
                {getDepartmentLabel(department.name)}
              </h2>
            </div>

            {department.products.length === 0 ? (
              <div style={styles.emptyDepartment}>{t.noItems}</div>
            ) : (
              department.products.map((product) => {
                const productId =
                  product.id ||
                  `${department.name}-${product.idnum}-${product.name}`;
                const imageSrc = productImagesByIdnum[product.idnum];

                const isSelected =
                  Number(quantities[productId]?.cajas || 0) > 0 ||
                  Number(quantities[productId]?.unidades || 0) > 0;

                return (
                  <div
                    key={productId}
                    ref={(element) => {
                      rowRefs.current[productId] = element;
                    }}
                    style={{
                      ...styles.row,
                      ...(isSelected ? styles.rowSelected : {}),
                    }}
                  >
                    <div style={styles.leftColumn}>
                      <div style={styles.imageBox}>
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt={product.name}
                            style={styles.productImage}
                            onClick={() =>
                              setSelectedImage({
                                src: imageSrc,
                                name: product.name,
                                idnum: product.idnum,
                              })
                            }
                          />
                        ) : (
                          `${t.noPhoto} #${product.idnum}`
                        )}
                      </div>

                      <div style={styles.qtyRow}>
                        <div>
                          <label style={styles.qtyLabel}>{t.boxes}</label>

                          <input
                            inputMode="numeric"
                            enterKeyHint="done"
                            value={quantities[productId]?.cajas || ""}
                            onChange={(event) =>
                              updateQuantity(
                                productId,
                                "cajas",
                                event.target.value
                              )
                            }
                            onKeyDown={closeKeyboardOnEnter}
                            placeholder="0"
                            style={styles.qtyInput}
                          />
                        </div>

                        <div>
                          <label style={styles.qtyLabel}>{t.units}</label>

                          <input
                            inputMode="numeric"
                            enterKeyHint="done"
                            value={quantities[productId]?.unidades || ""}
                            onChange={(event) =>
                              updateQuantity(
                                productId,
                                "unidades",
                                event.target.value
                              )
                            }
                            onKeyDown={closeKeyboardOnEnter}
                            placeholder="0"
                            style={styles.qtyInput}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <p style={styles.productName}>
                        <span style={styles.idnum}>#{product.idnum}</span>
                        {product.name}
                      </p>

                      {product.offerText && (
                        <div style={styles.offerText}>{product.offerText}</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        ))}

        <div style={styles.card}>
          <label style={styles.label}>{t.notes}</label>

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t.optional}
            rows={3}
            style={styles.textarea}
          />

          <div style={styles.summary}>
            <strong>{t.summary}:</strong> {selectedItems.length} {t.itemsWithQuantity}.
          </div>

          <button
            onClick={() => setShowOrderSummary(true)}
            style={{
              ...styles.primaryButton,
              opacity: selectedItems.length === 0 ? 0.5 : 1,
            }}
            disabled={selectedItems.length === 0}
          >
            <ShoppingCart size={20} /> {t.reviewAndSend}
          </button>

          <button onClick={clearOrder} style={styles.secondaryButton}>
            <Trash2 size={20} /> {t.clearOrder}
          </button>
        </div>
      </div>

      {showOrderSummary && (
        <div style={styles.modal} onClick={() => setShowOrderSummary(false)}>
          <div
            style={styles.orderModalContent}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 style={styles.orderModalTitle}>{t.orderSummary}</h2>

            {customerName.trim() && (
              <p style={styles.orderCustomer}>
                {t.customer}: <strong>{customerName.trim()}</strong>
              </p>
            )}

            {selectedItems.length === 0 ? (
              <p>{t.noItemsWithQuantity}</p>
            ) : (
              <div style={styles.orderItemsList}>
                {selectedItems.map((item) => (
                  <div key={item.id} style={styles.orderItem}>
                    <div style={styles.orderItemName}>
                      #{item.idnum} {item.name}
                    </div>

                    <div style={styles.orderItemQty}>
                      {item.cajas > 0 && <span>{item.cajas} {t.boxesLower}</span>}
                      {item.unidades > 0 && (
                        <span>{item.unidades} {t.unitsLower}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {notes.trim() && (
              <div style={styles.orderNotes}>
                <strong>{t.notes}:</strong>
                <br />
                {notes.trim()}
              </div>
            )}

            <button onClick={sendOrder} style={styles.whatsappButton}>
              <Send size={20} /> {t.sendByWhatsApp}
            </button>

            <button
              onClick={() => setShowOrderSummary(false)}
              style={styles.secondaryButton}
            >
              <ArrowLeft size={18} /> {t.back}
            </button>
          </div>
        </div>
      )}

      {selectedImage && (
        <div style={styles.modal} onClick={() => setSelectedImage(null)}>
          <div style={styles.modalContent}>
            <img
              src={selectedImage.src}
              alt={selectedImage.name}
              style={styles.modalImage}
              onClick={(event) => event.stopPropagation()}
            />

            <p style={styles.modalTitle}>
              #{selectedImage.idnum} {selectedImage.name}
            </p>

            <button
              onClick={() => setSelectedImage(null)}
              style={styles.closeButton}
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "10px",
    color: "#0f172a",
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box",
  },
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
  },
  header: {
    background: "white",
    padding: "16px",
    borderRadius: "18px",
    display: "flex",
    gap: "14px",
    alignItems: "center",
    marginBottom: "16px",
    boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
  },
  iconBox: {
    background: "#0f172a",
    color: "white",
    borderRadius: "16px",
    padding: "12px",
    display: "flex",
  },
  title: {
    margin: 0,
    fontSize: "22px",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#475569",
    fontSize: "14px",
  },
  cardSticky: {
    position: "sticky",
    top: "8px",
    zIndex: 10,
    background: "white",
    padding: "14px",
    borderRadius: "18px",
    marginBottom: "18px",
    boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
  },
  card: {
    background: "white",
    padding: "18px",
    borderRadius: "18px",
    marginTop: "18px",
    boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
  },
  label: {
    display: "block",
    fontWeight: "bold",
    fontSize: "13px",
    marginBottom: "6px",
    marginTop: "8px",
  },
  input: {
    width: "100%",
    padding: "11px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontSize: "16px",
    boxSizing: "border-box",
  },
  languageSelect: {
    width: "100%",
    padding: "11px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontSize: "16px",
    fontWeight: "bold",
    background: "white",
    boxSizing: "border-box",
    marginBottom: "8px",
  },
  searchAndSendRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 104px",
    gap: "8px",
    alignItems: "center",
  },
  searchBoxCompact: {
    position: "relative",
    minWidth: 0,
  },
  searchIcon: {
    position: "absolute",
    left: "12px",
    top: "16px",
    color: "#64748b",
  },
  searchInput: {
    width: "100%",
    height: "52px",
    padding: "13px 12px 13px 40px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontSize: "16px",
    boxSizing: "border-box",
  },
  departmentSelector: {
    position: "relative",
  },
  departmentButton: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    textAlign: "left",
    boxSizing: "border-box",
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
    cursor: "pointer",
  },
  departmentButtonLabel: {
    fontSize: "16px",
    fontWeight: "800",
    color: "#0f172a",
  },
  departmentButtonHint: {
    marginTop: "2px",
    fontSize: "12px",
    fontWeight: "600",
    color: "#64748b",
  },
  departmentChevron: {
    color: "#334155",
    transition: "transform 0.18s ease",
    flexShrink: 0,
  },
  departmentDropdown: {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: 0,
    right: 0,
    zIndex: 50,
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    boxShadow: "0 18px 45px rgba(15,23,42,0.18)",
    padding: "10px",
    boxSizing: "border-box",
  },
  departmentList: {
    maxHeight: "320px",
    overflowY: "auto",
    display: "grid",
    gap: "6px",
  },
  departmentOption: {
    width: "100%",
    border: "none",
    borderRadius: "12px",
    background: "white",
    padding: "9px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    textAlign: "left",
    color: "#0f172a",
    cursor: "pointer",
  },
  departmentOptionActive: {
    background: "#0f172a",
    color: "white",
  },
  departmentOptionContent: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
  },
  departmentMiniImage: {
    width: "46px",
    height: "46px",
    borderRadius: "12px",
    objectFit: "contain",
    background: "white",
    border: "1px solid #cbd5e1",
    flexShrink: 0,
  },
  departmentMiniPlaceholder: {
    width: "46px",
    height: "46px",
    borderRadius: "12px",
    background: "#e2e8f0",
    border: "1px solid #cbd5e1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "22px",
    flexShrink: 0,
  },
  departmentOptionName: {
    fontSize: "14px",
    fontWeight: "800",
    textTransform: "uppercase",
  },
  departmentOptionCount: {
    marginTop: "2px",
    fontSize: "12px",
    fontWeight: "600",
    opacity: 0.75,
  },
  section: {
    background: "white",
    borderRadius: "18px",
    overflow: "hidden",
    marginBottom: "18px",
    boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
  },
  sectionHeader: {
    background: "#0f172a",
    color: "white",
    padding: "12px 16px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "18px",
    textTransform: "uppercase",
  },
  emptyDepartment: {
    padding: "20px",
    textAlign: "center",
    color: "#64748b",
    fontWeight: "bold",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(118px, 38vw) 1fr",
    gap: "10px",
    alignItems: "start",
    padding: "10px",
    borderTop: "1px solid #e2e8f0",
    scrollMarginTop: "170px",
  },
  rowSelected: {
    background: "#ecfdf5",
    borderLeft: "5px solid #22c55e",
  },
  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: 0,
  },
  imageBox: {
    width: "100%",
    height: "clamp(105px, 32vw, 180px)",
    borderRadius: "14px",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: "bold",
    textAlign: "center",
  },
  productImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
    cursor: "pointer",
  },
  qtyRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "6px",
  },
  qtyLabel: {
    display: "block",
    fontSize: "11px",
    fontWeight: "bold",
    marginBottom: "4px",
    textAlign: "center",
    color: "#475569",
  },
  qtyInput: {
    width: "100%",
    padding: "8px 3px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: "16px",
    boxSizing: "border-box",
  },
  productName: {
    margin: 0,
    fontSize: "16px",
    fontWeight: "600",
    lineHeight: "1.3",
    paddingTop: "4px",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    minWidth: 0,
  },
  idnum: {
    display: "inline-block",
    marginRight: "8px",
    color: "#64748b",
    fontWeight: "bold",
  },
  offerText: {
    marginTop: "6px",
    fontSize: "13px",
    fontWeight: "bold",
    color: "#dc2626",
    background: "#fef2f2",
    padding: "6px 8px",
    borderRadius: "8px",
    border: "1px solid #fecaca",
    lineHeight: "1.3",
  },
  textarea: {
    width: "100%",
    padding: "11px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontSize: "16px",
    boxSizing: "border-box",
  },
  summary: {
    background: "#e2e8f0",
    padding: "12px",
    borderRadius: "12px",
    margin: "14px 0",
    fontSize: "14px",
  },
  primaryButton: {
    width: "100%",
    height: "50px",
    border: "none",
    borderRadius: "12px",
    background: "#0f172a",
    color: "white",
    fontSize: "16px",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    marginBottom: "10px",
  },
  stickyWhatsappButton: {
    width: "100%",
    height: "52px",
    border: "none",
    borderRadius: "12px",
    background: "#0f172a",
    color: "white",
    fontSize: "12px",
    fontWeight: "bold",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1px",
    lineHeight: "1.05",
    textAlign: "center",
    padding: "4px",
  },
  whatsappButton: {
    width: "100%",
    height: "50px",
    border: "none",
    borderRadius: "12px",
    background: "#22c55e",
    color: "white",
    fontSize: "16px",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    marginBottom: "10px",
  },
  secondaryButton: {
    width: "100%",
    height: "50px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    background: "white",
    color: "#0f172a",
    fontSize: "16px",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  modal: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.82)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "18px",
  },
  modalContent: {
    maxWidth: "95vw",
    maxHeight: "95vh",
    textAlign: "center",
  },
  modalImage: {
    maxWidth: "100%",
    maxHeight: "75vh",
    borderRadius: "16px",
    background: "white",
    objectFit: "contain",
  },
  modalTitle: {
    color: "white",
    fontSize: "16px",
    fontWeight: "bold",
    margin: "12px 0",
  },
  closeButton: {
    border: "none",
    borderRadius: "12px",
    background: "white",
    color: "#0f172a",
    fontSize: "15px",
    fontWeight: "bold",
    padding: "10px 18px",
  },
  orderModalContent: {
    width: "min(520px, 95vw)",
    maxHeight: "88vh",
    overflowY: "auto",
    background: "white",
    borderRadius: "18px",
    padding: "18px",
    boxSizing: "border-box",
  },
  orderModalTitle: {
    margin: "0 0 12px",
    fontSize: "22px",
  },
  orderCustomer: {
    background: "#f1f5f9",
    padding: "10px",
    borderRadius: "12px",
    marginBottom: "12px",
  },
  orderItemsList: {
    display: "grid",
    gap: "8px",
    marginBottom: "14px",
  },
  orderItem: {
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "10px",
    background: "#f8fafc",
  },
  orderItemName: {
    fontSize: "14px",
    fontWeight: "800",
    marginBottom: "6px",
  },
  orderItemQty: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    fontSize: "14px",
    fontWeight: "bold",
    color: "#16a34a",
  },
  orderNotes: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: "12px",
    padding: "10px",
    marginBottom: "14px",
    fontSize: "14px",
  },
  novedadText: {
    color: "#ff0000",
    fontWeight: "900",
    animation: "novedadBlink 0.8s infinite",
  },
};
