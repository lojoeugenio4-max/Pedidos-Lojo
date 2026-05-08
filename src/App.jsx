import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingCart,
  Trash2,
  Send,
  Search,
  ChevronDown,
  Check,
} from "lucide-react";
import hiddenProductsRaw from "./hiddenProducts";

const WHATSAPP_NUMBER = "34670716744";

const fixedProduct = (idnum, name, offerText = "") => ({
  idnum,
  name,
  offerText,
});


const departments = [
{
    name: "AGUA",
    products: [
      fixedProduct(1, "AGUA FUENTELAJARA 1.5L", "Comprando 10 cajas REGALO 1 caja "),
      fixedProduct(2, "AGUA LANJARON 1.5L PACK 6"),
      fixedProduct(3, "AGUA FUENTELAJARA 0.5L"),
      fixedProduct(4, "AGUA LANJARON 0.5L"),
      fixedProduct(5, "AGUA VALTORRE 0.5L PITORRO"),
      fixedProduct(6, "AGUA VALTORRE GARRAFA 5L"),
      fixedProduct(7, "AGUA SOLAN CABRAS 1.5L"),
      fixedProduct(8, "AGUA SOLAN DE CABRAS S/G 5L GFA"),
      fixedProduct(9, "AGUA GOURMET CON GAS 0.5L"),
      fixedProduct(10, "AGUA GOURMET CON GAS 1.5L"),
    ],
  },
  {
    name: "CERVEZAS",
    products: [
      fixedProduct(102, "CERVEZA CRUZCAMPO LATA 33CL"),
      fixedProduct(103, "CERVEZA ESTRELLA SUR LATA"),
      fixedProduct(104, "ESTRELLA 0.0 LATA 33CL"),
      fixedProduct(105, "CRUZCAMPO S/A LATA 33CL"),
      fixedProduct(106, "RADLER LIMON CRUZCAMPO LATA"),
      fixedProduct(107, "HEINEKEN LATA 33CL"),
      fixedProduct(108, "CERVEZA CRUZCAMPO 50CL"),
      fixedProduct(109, "ESTRELLA SUR 50CL LATA GRANDE"),
      fixedProduct(110, "CERVEZA CRUZCAMPO CHAPA 1L"),
      fixedProduct(111, "CERVEZA CRUZ DEL SUR 1L"),
      fixedProduct(112, "CERVEZA ESTRELLA 1L"),
      fixedProduct(113, "CERVEZA ESTRELLA 0.0 1L"),
      fixedProduct(114, "CRUZCAMPO ROSCA 1L"),
      fixedProduct(115, "CRUZCAMPO 750ML"),
      fixedProduct(116, "CRUZCAMPO PACK 6"),
      fixedProduct(117, "CRUZCAMPO BOTELLIN CAJA 24"),
      fixedProduct(119, "CRUZCAMPO SIN ALCOHOL PACK"),
      fixedProduct(120, "ESTRELLA DEL SUR PACK 6"),
    ],
  },
  {
    name: "REFRESCOS LATAS",
    products: [
      fixedProduct(11, "COCA COLA LATA 33CL"),
      fixedProduct(12, "COCA COLA ZERO LATA 33CL"),
      fixedProduct(13, "COCA COLA ZERO S/CAF 33CL"),
      fixedProduct(14, "FANTA NARANJA LATA 33CL"),
      fixedProduct(15, "FANTA LIMON LATA 33CL"),
      fixedProduct(16, "AQUARIUS NARANJA LATA 33CL"),
      fixedProduct(17, "AQUARIUS LIMON LATA 33CL"),
      fixedProduct(18, "SEVEN UP LATA 33CL"),
      fixedProduct(19, "PEPSI COLA LATA 33CL"),
      fixedProduct(20, "NESTEA MARACUYA LATA 33CL"),
      fixedProduct(21, "NESTEA LIMON LATA 33CL"),
      fixedProduct(22, "NESTEA FRUTOS ROJOS LATA 33CL"),
      fixedProduct(23, "TONICA LATA 33CL"),
      fixedProduct(25, "SIMON LIFE MANGO LATA 33CL"),
      fixedProduct(26, "TINTO VERANO LIMON CASERA LATA"),
    ],
  },
  {
    name: "REFRESCOS 2L / 1.5L",
    products: [
      fixedProduct(27, "COCA COLA 2L"),
      fixedProduct(28, "COCA COLA ZERO 2L"),
      fixedProduct(29, "COCA ZERO S/CAFEINA 2L"),
      fixedProduct(30, "FANTA NARANJA 2L"),
      fixedProduct(31, "FANTA LIMON 2L"),
      fixedProduct(32, "SEVEN UP 2L"),
      fixedProduct(33, "REVOLTOSA COLA 2L"),
      fixedProduct(34, "REVOLTOSA NARANJA 2L"),
      fixedProduct(35, "REVOLTOSA LIMON 2L"),
      fixedProduct(36, "CASERA LIMON 1.5L"),
      fixedProduct(37, "CASERA NARANJA 1.5L"),
      fixedProduct(38, "CASERA BLANCA 1.5L"),
      fixedProduct(39, "AQUARIUS NARANJA 1.5L"),
      fixedProduct(40, "AQUARIUS BLANCO 1.5L"),
      fixedProduct(41, "NESTEA MARACUYA 1.5L"),
      fixedProduct(42, "NESTEA 1.5L"),
      fixedProduct(43, "NESTEA FRUTOS ROJOS 1.5L"),
      fixedProduct(44, "SIMON LIFE NARANJA 1.5L"),
      fixedProduct(45, "SIMON LIFE MANDARINA 1.5L"),
      fixedProduct(46, "SIMON LIFE MANGO 1.5L"),
      fixedProduct(47, "PEPSI COLA 1.75L"),
      fixedProduct(48, "TONICA SCHWEPPES 1L"),
      fixedProduct(49, "LIMON&NADA MINUTE MAID 1L"),
    ],
  },
  {
    name: "ENERGÉTICAS",
    products: [
      fixedProduct(78, "CAMALEON 250ML"),
      fixedProduct(79, "CAMALEON GRANDE 50CL"),
      fixedProduct(80, "POWER KING 25CL"),
      fixedProduct(81, "POWER KING GRANDE 50CL"),
      fixedProduct(82, "RED BULL 250ML"),
      fixedProduct(83, "RED BULL SIN AZUCAR 250ML"),
      fixedProduct(84, "MONSTER VERDE LATA 50CL"),
      fixedProduct(85, "MONSTER ULTRA WHITE 50CL"),
      fixedProduct(86, "MONSTER ZERO VERDE 50CL"),
      fixedProduct(87, "MONSTER MANGO 50CL"),
      fixedProduct(88, "MONSTER AZUL 50CL"),
      fixedProduct(89, "BURN LATA 500ML"),
      fixedProduct(90, "LOCURA LATA 50CL"),
      fixedProduct(91, "LOCURA COCO LATA 50CL"),
      fixedProduct(92, "LOCURA ENERGY DRINK PEQUEÑO"),
      fixedProduct(93, "ENERDRINK COCO Y PIÑA"),
      fixedProduct(94, "ENERDRINK FRESA SALVAJE"),
      fixedProduct(95, "ENERDRINK MORA"),
      fixedProduct(96, "ENERDRINK MANZANA"),
      fixedProduct(97, "ENERDRINK TARTA QUESO"),
      fixedProduct(98, "ENERDRINK COCO LOCO"),
      fixedProduct(99, "POWERADE ICE 50CL"),
      fixedProduct(100, "POWERADE BLOOD 50CL"),
      fixedProduct(101, "ENERYETI PIRULETA 500ML"),
    ],
  },
  {
    name: "VINOS Y LICORES",
    products: [
      fixedProduct(121, "VINO BLANCO GRAN DUQUE 1L"),
      fixedProduct(122, "VINO TINTO GRAN DUQUE 1L"),
      fixedProduct(123, "VINO BLANCO RIVILLA 2L"),
      fixedProduct(124, "VINO TINTO RIVILLA 2L"),
      fixedProduct(125, "VINO TINTO DON SIMON 1L"),
      fixedProduct(126, "VINO BLANCO DON SIMON 1L"),
      fixedProduct(127, "VINO RIOJA SEÑORES 3/4"),
      fixedProduct(128, "TINTO VERANO CASERA 1.5L"),
      fixedProduct(129, "RON CACIQUE 70CL"),
      fixedProduct(130, "RON BARCELO AÑEJO 70CL"),
      fixedProduct(131, "RON NEGRITA 70CL"),
      fixedProduct(132, "WHISKY WHITE LABEL 70CL"),
      fixedProduct(133, "WHISKY BALLANTINES 70CL"),
      fixedProduct(134, "WHISKY J&B 70CL"),
      fixedProduct(135, "WHISKY JHONNIE WALKER E/ROJA 3/4"),
      fixedProduct(136, "WHISKY JHONNIE WALKER E/ROJA MINIATURA"),
      fixedProduct(137, "GINEBRA LARIOS 1L"),
      fixedProduct(138, "GINEBRA BEEFEATER 70CL"),
      fixedProduct(139, "BRANDY TERRY 1L"),
      fixedProduct(140, "ANIS CASTELLANA 70CL"),
      fixedProduct(141, "LICOR MIURA 70CL"),
      fixedProduct(142, "MINI WHISKY WHITE LABEL"),
      fixedProduct(143, "MINI RON BARCELO"),
      fixedProduct(144, "MINI BALLANTINES"),
    ],
  },
  {
    name: "PIZZAS",
    products: [
      fixedProduct(273, "PIZZA CAMPOFRIO 5 QUESOS"),
      fixedProduct(274, "PIZZA CAMPOFRIO JAMON QUESO"),
      fixedProduct(275, "PIZZA CAMPOFRIO BOLOÑESA"),
      fixedProduct(276, "PIZZA CAMPOFRIO CARBONARA"),
      fixedProduct(277, "PIZZA CAMPOFRIO BARBACOA"),
      fixedProduct(278, "PIZZA JAMON BACON CEBOLLA"),
      fixedProduct(279, "PIZZA PEPPERONI CAMPOFRIO"),
      fixedProduct(280, "PIZZA POLLO KANSAS"),
      fixedProduct(281, "PIZZA POLLO MOSTAZA MIEL"),
      fixedProduct(282, "PIZZA SALSA MEXICANA"), 
    ],
  },
  {
    name: "CHARCUTERÍA LONCHEADA",
    products: [
      fixedProduct(245, "QUESO SEMI PUROVI 1.50E"),
      fixedProduct(258, "CHOPPED BEEF CAMPOFRIO 95G"),
      fixedProduct(259, "CHOPPED CERDO CAMPOFRIO 95G"),
      fixedProduct(260, "MORTADELA SICILIANA CAMPOFRIO 95G"),
      fixedProduct(261, "MORTADELA C/A CAMPOFRIO 95G"),
      fixedProduct(262, "JAMON CURADO NAVIDUL 50G"),
      fixedProduct(263, "PECHUGA PAVO CAMPOFRIO 70G"),
      fixedProduct(264, "JAMON COCIDO EXTRA CAMPOFRIO 75G"),
      fixedProduct(265, "CHORIZO REVILLA 65G"),
      fixedProduct(266, "CHORIZO PAMPLONA REVILLA 65G"),
      fixedProduct(267, "SALAMI REVILLA 65G"),
      fixedProduct(268, "SALCHICHON REVILLA 65G"),
      fixedProduct(269, "TAQUITOS NAVIDUL 50G"),
      fixedProduct(270, "BACON OSCAR MAYER LONCHA 100G"),
      fixedProduct(271, "SALCHICHAS CAMPOFRIO FRANKFURT"),
      
    ],
  },
  {
    name: "ZUMOS",
    products: [
      fixedProduct(50, "BIOFRUTA PASCUAL TROPICAL P3"),
      fixedProduct(51, "BIOFRUTA PASCUAL PACIFICO P3"),
      fixedProduct(52, "BIOFRUTA PASCUAL IBIZA P3"),
      fixedProduct(53, "BIOFRUTA PASCUAL 1L TROPI"),
      fixedProduct(54, "FUNC. D.SIMON TROPICAL P6"),
      fixedProduct(55, "FUNC. D.SIMON CARIBE P6"),
      fixedProduct(56, "FUNC. D.SIMON MEDITERRANEO P6"),
      fixedProduct(57, "ZUMO D.SIMON PIÑA P6 200"),
      fixedProduct(58, "ZUMO D.SIMON MELOCOTON P6 200"),
      fixedProduct(59, "ROSTOY MELOCOTON 33CL"),
      fixedProduct(60, "ROSTOY PIÑA COCO 33CL"),
      fixedProduct(61, "ZUMO JUVER PIÑA 850ML"),
      fixedProduct(62, "ZUMO JUVER MELOCOTON 850ML"),
      fixedProduct(63, "ZUMO JUVER NARANJA 850ML"),
    ],
  },
  {
    name: "KUYX 3L",
    products: [
      fixedProduct(64, "KUYX NARANJA 3L"),
      fixedProduct(65, "KUYX TROPICAL 3L"),
      fixedProduct(66, "KUYX MANDARINA 3L"),
      fixedProduct(67, "KUYX FRUTOS DEL BOSQUE 3L"),
      fixedProduct(68, "KUYX PIÑA 3L"),
      fixedProduct(69, "KUYX PIÑA COCO 3L"),
      fixedProduct(70, "KUYX OCEANICO 3L"),
    ],
  },
  {
    name: "KUYX 330ML",
    products: [
      fixedProduct(71, "KUYX 330ML NARANJA"),
      fixedProduct(72, "KUYX 330ML MANDARINA"),
      fixedProduct(73, "KUYX 330ML TROPICAL"),
      fixedProduct(74, "KUYX 330ML PIÑA"),
      fixedProduct(75, "KUYX 330ML OCEANICO"),
      fixedProduct(76, "KUYX 330ML MANGO"),
      fixedProduct(77, "KUYX 330ML FRUTOS ROJOS"),
    ],
  },
  
  
  
  {
    name: "LÁCTEOS",
    products: [
      fixedProduct(145, "LECHE COVAP ENTERA 1L"),
      fixedProduct(146, "LECHE COVAP SEMIDESNATADA 1L"),
      fixedProduct(147, "LECHE COVAP SIN LACTOSA ENTERA 1L"),
      fixedProduct(148, "LECHE COVAP SIN LACTOSA SEMI 1L"),
      fixedProduct(149, "LECHE PULEVA ENTERA 1L"),
      fixedProduct(150, "LECHE PULEVA SEMI 1L"),
      fixedProduct(151, "BATIDO PULEVA CACAO 1L"),
      fixedProduct(152, "BATIDO PULEVA FRESA 1L"),
      fixedProduct(153, "BATIDO PULEVA VAINILLA 1L"),
      fixedProduct(154, "BAT.PULEVA CACAO P6 200"),
      fixedProduct(155, "BAT.PULEVA FRESA P6 200"),
      fixedProduct(156, "BAT.PULEVA VAINILLA P6 200"),
      fixedProduct(157, "CAFE FRIO LANDESSA CAPUCHINO"),
      fixedProduct(158, "CAFE FRIO LANDESSA CON LECHE"),
      fixedProduct(159, "CAFE FRIO LANDESSA SOLO"),
      fixedProduct(160, "CAFE FRIO LANDESSA CARAMELO"),
      fixedProduct(161, "CAFE FRIO LANDESSA VAINILLA"),
      fixedProduct(162, "MARGARINA TULIPAN 225G"),
      fixedProduct(163, "MARGARINA TULIPAN 400G"),
      fixedProduct(164, "NATA COCINA RENY PICOT 200ML"),
    ],
  },
  {
    name: "ALIMENTACIÓN",
    products: [
      fixedProduct(165, "ACEITE GIRASOL ROSIL 1L"),
      fixedProduct(166, "ACEITE GIRASOL ROSIL 5L"),
      fixedProduct(167, "ACEITE OLIVA VIRGEN ROSIL 1L"),
      fixedProduct(168, "AZUCAR 1KG"),
      fixedProduct(169, "SAL FINA 1KG"),
      fixedProduct(170, "SAL GRUESA CHALUPA 1KG"),
      fixedProduct(171, "TOMATE FRITO ORLANDO 400G"),
      fixedProduct(172, "TOMATE FRITO ORLANDO 800G"),
      fixedProduct(173, "TOMATE FRITO ORLANDO 350G"),
      fixedProduct(174, "TOMATE FRITO MARTINETE 810G"),
      fixedProduct(175, "TOMATE FRITO MARTINETE 400G"),
      fixedProduct(176, "TOMATE TRITURADO MARTINETE 810G"),
      fixedProduct(177, "TOMATE TRITURADO MARTINETE 400G"),
      fixedProduct(178, "YATEKOMO POLLO 60G"),
      fixedProduct(179, "CALDO G.BLANCA POLLO 1L"),
      fixedProduct(180, "GARBANZOS FRASCO 560G"),
      fixedProduct(181, "PAN RALLADO PANAERAS 300G"),
      fixedProduct(182, "ARROZ BRILLANTE 1KG"),
      fixedProduct(183, "ARROZ BRILLANTE 500G"),
      fixedProduct(184, "MAYONESA YBARRA 450G"),
      fixedProduct(185, "KETCHUP ORLANDO 265G"),
    ],
  },
  {
    name: "APERITIVOS",
    products: [
      fixedProduct(186, "PIPAS SEVILLANAS"),
      fixedProduct(187, "REBUJINAS SEVILLANAS 120G"),
      fixedProduct(188, "RISKETOS 120G"),
      fixedProduct(189, "BUSCALIOS BARBACOA"),
      fixedProduct(190, "TOSTAITOS SEVILLANOS"),
      fixedProduct(191, "PATATAS HISPALANA 140G"),
      fixedProduct(192, "PRINGLES CREAM ONION 70G"),
      fixedProduct(193, "PRINGLES ORIGINAL 70G"),
      fixedProduct(194, "PRINGLES ORIGINAL 165G"),
      fixedProduct(195, "BOLAS MATCHBALL 105G"),
      fixedProduct(196, "REVUELTO CARTUJANO 120G"),
      fixedProduct(197, "PATATAS RUEDAS 100G"),
      fixedProduct(198, "TOTAS ESTILO CASERO 100G"),
      fixedProduct(199, "TOTAS CAMPESINA 100G"),
      fixedProduct(200, "GOFRE CON CHOCO 110G"),
      fixedProduct(201, "PALOMITA KETCHUP MOSTAZA 8U"),
    ],
  },
  {
    name: "LIMPIEZA",
    products: [
      fixedProduct(202, "LEJIA PINO PERFUMADA KIRIKO 2L"),
      fixedProduct(203, "LEJIA AMARILLA KIRIKO 2L"),
      fixedProduct(204, "LEJIA LAVADORA KIRIKO 2L"),
      fixedProduct(205, "LEJIA + DETERGENTE KIRIKO 2L"),
      fixedProduct(206, "LEJIA LIMON PERFUMADA KIRIKO 2L"),
      fixedProduct(207, "DETERGENTE KIRIKO MARSELLA 3L"),
      fixedProduct(208, "DETERGENTE KIRIKO BASICO 2.8L"),
      fixedProduct(209, "LAVAVAJILLAS FLOTA 1.1L"),
      fixedProduct(210, "FLOTA VAJILLAS 750ML"),
      fixedProduct(211, "FREGASUELOS PINO KIRIKO 1.5L"),
      fixedProduct(212, "FREGASUELOS DAMA NOCHE 1.5L"),
      fixedProduct(213, "FREGASUELOS J.MARSELLA 1.5L"),
      fixedProduct(214, "FREGASUELOS SPA 1.5L"),
      fixedProduct(215, "LIMPIACRISTALES KIRIKO 500ML"),
      fixedProduct(216, "PAPEL HIGIENICO FAMADIS 6R"),
      fixedProduct(217, "HIGIENICO ECONOMICO P12"),
      fixedProduct(218, "SECAMANO BUENO"),
      fixedProduct(219, "TOALLITAS BEBE 120U"),
      fixedProduct(220, "ESCOBA PRIMER PRECIO"),
      fixedProduct(221, "PASTA COLGATE 75ML"),
    ],
  },
  {
    name: "VARIOS",
    products: [
      fixedProduct(222, "ANDALUZA CAJA 47U"),
      fixedProduct(223, "ANDALUZA GOURMET CAJA 54U"),
      fixedProduct(224, "VIENA ARTESANA CAJA 65U"),
      fixedProduct(225, "HUEVOS P12 L"),
      fixedProduct(226, "BANDEJA T89 NEGRA"),
      fixedProduct(227, "BOLSA VERDE OFERTA 42X53"),
      fixedProduct(228, "BOLSA BLANCA 42X53 1KG"),
      fixedProduct(229, "ROLLO COMPOSTABLE 30X40 1KG"),
      fixedProduct(230, "BOLSA BASURA COMUNIDAD 180L"),
      fixedProduct(231, "BOLSA BASURA NORMAL 30L"),
      fixedProduct(232, "BOLSAS PANADERIA 30X43"),
      fixedProduct(233, "SERVILLETA DOBLE BLANCA P2"),
      fixedProduct(234, "ARENA GATO MIC&FRIENDS 5KG"),
      fixedProduct(235, "VASO PLASTICO 350CC"),
      fixedProduct(236, "PAPEL OCB 100U"),
      fixedProduct(237, "CARBON"),
      fixedProduct(238, "PAPEL ALUMINIO IND"),
      fixedProduct(239, "FILM INDUSTRIAL 200M"),
      fixedProduct(240, "PASTILLAS ENCENDIDO"),
      fixedProduct(241, "ESTUCHES DE LOS REYES"),
    ],
  },
  
  {
    name: "CHARCUTERÍA CORTE",
    products: [
      fixedProduct(242, "CHOPPED TERNERA CAMPOFRIO KG"),
      fixedProduct(243, "CHOPPED CERDO CAMPOFRIO KG"),
      fixedProduct(244, "QUESO GOUDA BARRA KG"),
      fixedProduct(246, "POLLO RELLENO CARLOTEÑA KG"),
      fixedProduct(247, "POLLO RELLENO BLANCE KG"),
      fixedProduct(248, "LOMO AL HORNO FAMADESA KG"),
      fixedProduct(249, "MAGRETA AL AJILLO FAMADESA KG"),
      fixedProduct(250, "JAMON COCIDO 1A CAMPOFRIO KG"),
      fixedProduct(251, "PALETA REVILLA KG"),
      fixedProduct(252, "PECHUGA PAVO NOEL KG"),
      fixedProduct(253, "PECHUGA PAVOFRIO KG"),
      fixedProduct(254, "CHORIZO EXTRA VILLAR KG"),
      fixedProduct(255, "CHORIZO TRADICIONAL REVILLA KG"),
      fixedProduct(256, "CHORIZO CULAR IBERICO KG"),
      fixedProduct(257, "SALCHICHON TURON KG"),
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

const productMatchesSearch = (productName, searchText) => {
  const normalizedProduct = normalizeText(productName);
  const searchWords = normalizeText(searchText)
    .split(/[^a-z0-9ñ]+/i)
    .filter(Boolean);

  return searchWords.every((searchWord) =>
    normalizedProduct.includes(searchWord)
  );
};

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

  const [quantities, setQuantities] = useState({});
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [selectedDepartment, setSelectedDepartment] = useState("TODOS");
  const [selectedImage, setSelectedImage] = useState(null);
  const [compactHeader, setCompactHeader] = useState(false);

  const [departmentDropdownOpen, setDepartmentDropdownOpen] = useState(false);
  const [departmentSearch, setDepartmentSearch] = useState("");

  useEffect(() => {
    let viewport = document.querySelector("meta[name=viewport]");

    if (!viewport) {
      viewport = document.createElement("meta");
      viewport.setAttribute("name", "viewport");
      document.head.appendChild(viewport);
    }

    viewport.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    );
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
    const options = [
      {
        name: "TODOS",
        label: "Todos los departamentos",
        count: visibleProducts.length,
      },
      ...departments.map((department) => ({
        name: department.name,
        label: department.name,
        count: department.products.length,
      })),
    ];

    const cleanSearch = normalizeText(departmentSearch);

    if (!cleanSearch) return options;

    return options.filter((option) =>
      normalizeText(option.label).includes(cleanSearch)
    );
  }, [departmentSearch]);

  const filteredDepartments = useMemo(() => {
    const cleanSearch = search.trim();

    const visibleDepartments = departments
      .filter(
        (department) =>
          selectedDepartment === "TODOS" ||
          department.name === selectedDepartment
      )
      .map((department) => ({
        ...department,
        products: cleanSearch
          ? department.products.filter((product) =>
              productMatchesSearch(product.name, cleanSearch)
            )
          : department.products,
      }))
      .filter((department) => department.products.length > 0);

    if (!cleanSearch || selectedDepartment !== "TODOS") {
      return visibleDepartments;
    }

    const hiddenMatches = hiddenProductsUnique.filter((product) =>
      productMatchesSearch(product.name, cleanSearch)
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
    const firstProductId = `${firstDepartment.name}-${firstProduct.idnum}-${firstProduct.name}`;

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
    }
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
    setDepartmentSearch("");
    setDepartmentDropdownOpen(false);
  };

  const createWhatsAppMessage = () => {
    const lines = ["Nuevo pedido", ""];

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
      alert("Introduce al menos una cantidad antes de enviar el pedido.");
      return;
    }

    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${createWhatsAppMessage()}`,
      "_blank"
    );

    clearOrder();
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
              <h1 style={styles.title}>Pedido online Cash Lojo</h1>
              <p style={styles.subtitle}>
                Escribe cantidades en Unidades o Cajas y envía el pedido por
                WhatsApp.
              </p>
            </div>
          </header>
        )}

        <div style={styles.cardSticky}>
          {!compactHeader && (
            <>
              <label style={styles.label}>
                Nombre o referencia del cliente
              </label>

              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Opcional"
                style={styles.input}
              />
            </>
          )}

          <label style={styles.label}>Buscar artículo</label>

          <div style={styles.searchAndSendRow}>
            <div style={styles.searchBoxCompact}>
              <Search size={20} style={styles.searchIcon} />

              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={searchOnEnter}
                onBlur={applySearch}
                inputMode="search"
                enterKeyHint="done"
                placeholder="Buscar artículo..."
                style={styles.searchInput}
              />
            </div>

            <button onClick={sendOrder} style={styles.stickyWhatsappButton}>
              <Send size={18} /> WhatsApp
            </button>
          </div>

          <label style={styles.label}>Departamento</label>

          <div ref={departmentDropdownRef} style={styles.departmentSelector}>
            <button
              type="button"
              onClick={() => setDepartmentDropdownOpen((open) => !open)}
              style={styles.departmentButton}
            >
              <div>
                <div style={styles.departmentButtonLabel}>
                  {selectedDepartment === "TODOS"
                    ? "Todos los departamentos"
                    : selectedDepartment}
                </div>

                <div style={styles.departmentButtonHint}>
                  Toca para cambiar de departamento
                </div>
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
                <div style={styles.departmentSearchBox}>
                  <Search size={18} style={styles.departmentSearchIcon} />

                  <input
                    value={departmentSearch}
                    onChange={(event) =>
                      setDepartmentSearch(event.target.value)
                    }
                    placeholder="Buscar departamento..."
                    style={styles.departmentSearchInput}
                    autoFocus
                  />
                </div>

                <div style={styles.departmentList}>
                  {departmentOptions.length > 0 ? (
                    departmentOptions.map((option) => {
                      const isActive = selectedDepartment === option.name;

                      return (
                        <button
                          key={option.name}
                          type="button"
                          onClick={() => {
                            setSelectedDepartment(option.name);
                            setSearchInput("");
                            setSearch("");
                            setDepartmentSearch("");
                            setDepartmentDropdownOpen(false);
                          }}
                          style={{
                            ...styles.departmentOption,
                            ...(isActive ? styles.departmentOptionActive : {}),
                          }}
                        >
                          <div>
                            <div style={styles.departmentOptionName}>
                              {option.label}
                            </div>

                            <div style={styles.departmentOptionCount}>
                              {option.count} artículos
                            </div>
                          </div>

                          {isActive && <Check size={18} />}
                        </button>
                      );
                    })
                  ) : (
                    <div style={styles.departmentEmpty}>
                      No hay departamentos con ese nombre.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {filteredDepartments.map((department) => (
          <section key={department.name} style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>{department.name}</h2>
            </div>

            {department.products.map((product) => {
              const productId = `${department.name}-${product.idnum}-${product.name}`;
              const imageSrc = productImagesByIdnum[product.idnum];

              return (
                <div
                  key={productId}
                  ref={(element) => {
                    rowRefs.current[productId] = element;
                  }}
                  style={styles.row}
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
                        `Sin foto #${product.idnum}`
                      )}
                    </div>

                    <div style={styles.qtyRow}>
                      <div>
                        <label style={styles.qtyLabel}>Cajas</label>

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
                        <label style={styles.qtyLabel}>Unid.</label>

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
            })}
          </section>
        ))}

        <div style={styles.card}>
          <label style={styles.label}>Observaciones</label>

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Opcional"
            rows={3}
            style={styles.textarea}
          />

          <div style={styles.summary}>
            <strong>Resumen:</strong> {selectedItems.length} artículos con
            cantidad.
          </div>

          <button onClick={sendOrder} style={styles.primaryButton}>
            <Send size={20} /> Enviar por WhatsApp
          </button>

          <button onClick={clearOrder} style={styles.secondaryButton}>
            <Trash2 size={20} /> Borrar pedido
          </button>
        </div>
      </div>

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
              Cerrar
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
  searchAndSendRow: {
    display: "grid",
    gridTemplateColumns: "1fr 112px",
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
    top: "11px",
    color: "#64748b",
  },
  searchInput: {
    width: "100%",
    padding: "11px 12px 11px 40px",
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
  departmentSearchBox: {
    position: "relative",
    marginBottom: "8px",
  },
  departmentSearchIcon: {
    position: "absolute",
    left: "12px",
    top: "11px",
    color: "#64748b",
  },
  departmentSearchInput: {
    width: "100%",
    padding: "11px 12px 11px 38px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontSize: "15px",
    fontWeight: "600",
    boxSizing: "border-box",
    outline: "none",
  },
  departmentList: {
    maxHeight: "290px",
    overflowY: "auto",
    display: "grid",
    gap: "6px",
  },
  departmentOption: {
    width: "100%",
    border: "none",
    borderRadius: "12px",
    background: "white",
    padding: "11px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    textAlign: "left",
    color: "#0f172a",
  },
  departmentOptionActive: {
    background: "#0f172a",
    color: "white",
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
  departmentEmpty: {
    padding: "14px",
    textAlign: "center",
    color: "#64748b",
    fontSize: "14px",
    fontWeight: "600",
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
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(118px, 38vw) 1fr",
    gap: "10px",
    alignItems: "start",
    padding: "10px",
    borderTop: "1px solid #e2e8f0",
    scrollMarginTop: "170px",
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
    height: "44px",
    border: "none",
    borderRadius: "12px",
    background: "#22c55e",
    color: "white",
    fontSize: "13px",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    whiteSpace: "nowrap",
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
};
