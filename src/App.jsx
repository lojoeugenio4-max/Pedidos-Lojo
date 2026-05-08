import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingCart,
  Trash2,
  Send,
  Search,
  ChevronDown,
  Check,
} from "lucide-react";

const WHATSAPP_NUMBER = "34670716744";
const SAVED_ORDER_KEY = "cash-lojo-pedido-habitual";

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
      fixedProduct(3, "AGUA FUENTELAJARA 0.5L", "Comprando 10 cajas REGALO 1 caja "),
      fixedProduct(4, "AGUA LANJARON 0.5L"),
      fixedProduct(5, "AGUA VALTORRE 0.5L PITORRO"),
      fixedProduct(6, "AGUA VALTORRE GARRAFA 5L"),
      fixedProduct(7, "AGUA SOLAN CABRAS 1.5L","OFERTA"),
      fixedProduct(8, "AGUA SOLAN DE CABRAS S/G 5L GFA"),
      fixedProduct(9, "AGUA GOURMET CON GAS 0.5L"),
      fixedProduct(10, "AGUA GOURMET CON GAS 1.5L"),
    ],
  },
  {
    name: "CERVEZAS",
    products: [
      fixedProduct(102, "CERVEZA CRUZCAMPO LATA 33CL","Por 7 cajas REGALO 1 caja"),
      fixedProduct(103, "CERVEZA ESTRELLA SUR LATA","Por 9 cajas REGALO 1 caja"),
      fixedProduct(104, "ESTRELLA 0.0 LATA 33CL"),
      fixedProduct(105, "CRUZCAMPO S/A LATA 33CL","Comprando 2 cajas PRECIO OFERTA"),
      fixedProduct(106, "RADLER LIMON CRUZCAMPO LATA","Comprando 2 cajas PRECIO OFERTA"),
      fixedProduct(107, "HEINEKEN LATA 33CL"),
      fixedProduct(108, "CERVEZA CRUZCAMPO 50CL","Por 6 cajas REGALO 1 caja"),
      fixedProduct(109, "ESTRELLA SUR 50CL LATA GRANDE","Por 5 cajas REGALO 12 unidades"),
      fixedProduct(110, "CERVEZA CRUZCAMPO CHAPA 1L"),
      fixedProduct(111, "CERVEZA CRUZ DEL SUR 1L","Comprando 10 cajas PRECIO OFERTA"),
      fixedProduct(112, "CERVEZA ESTRELLA 1L","Por 25 cajas REGALO 1 caja"),
      fixedProduct(113, "CERVEZA ESTRELLA 0.0 1L"),
      fixedProduct(114, "CRUZCAMPO ROSCA 1L"),
      fixedProduct(115, "CRUZCAMPO 750ML"),
      fixedProduct(116, "CRUZCAMPO PACK 6"),
      fixedProduct(117, "CRUZCAMPO BOTELLIN CAJA 24","Comprando 5 cajas PRECIO OFERTA"),
      fixedProduct(119, "CRUZCAMPO SIN ALCOHOL PACK6","Comprando 2 cajas PRECIO OFERTA"),
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
      fixedProduct(20, "NESTEA MARACUYA LATA 33CL","Comprando 2 cajas PRECIO OFERTA"),
      fixedProduct(21, "NESTEA LIMON LATA 33CL","Comprando 2 cajas PRECIO OFERTA"),
      fixedProduct(22, "NESTEA FRUTOS ROJOS LATA 33CL","Comprando 2 cajas PRECIO OFERTA"),
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
      fixedProduct(42, "NESTEA LIMÓN 1.5L"),
      fixedProduct(43, "NESTEA FRUTOS ROJOS 1.5L","Comprando 2 cajas PRECIO OFERTA"),
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
      fixedProduct(78, "CAMALEON 250ML"," Por 10 cajas REGALO 2 cajas"),
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
      fixedProduct(125, "VINO TINTO DON SIMON 1L","OFERTA"),
      fixedProduct(126, "VINO BLANCO DON SIMON 1L","OFERTA"),
      fixedProduct(127, "VINO RIOJA SEÑORES 3/4"),
      fixedProduct(128, "TINTO VERANO CASERA 1.5L"),
      fixedProduct(129, "RON CACIQUE 70CL"),
      fixedProduct(130, "RON BARCELO AÑEJO 70CL"),
      fixedProduct(131, "RON NEGRITA 70CL"),
      fixedProduct(132, "WHISKY WHITE LABEL 70CL","Comprando 6 unidades PRECIO OFERTA"),
      fixedProduct(133, "WHISKY BALLANTINES 70CL"),
      fixedProduct(134, "WHISKY J&B 70CL"),
      fixedProduct(135, "WHISKY JHONNIE WALKER E/ROJA 3/4","Comprando 12 unidades PRECIO OFERTA"),
      fixedProduct(136, "WHISKY JHONNIE WALKER E/ROJA MINIATURA"),
      fixedProduct(137, "GINEBRA LARIOS 1L"),
      fixedProduct(138, "GINEBRA BEEFEATER 70CL","Comprando 6 unidades PRECIO OFERTA"),
      fixedProduct(139, "BRANDY TERRY 1L"),
      fixedProduct(140, "ANIS CASTELLANA 70CL"," Por 12 botellas REGALO 1 botella"),
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
    name: "APERITIVOS",
    products: [
      fixedProduct(186, "PIPAS SEVILLANAS"),
      fixedProduct(187, "REBUJINAS SEVILLANAS 120G"),
      fixedProduct(188, "RISKETOS 120G"),
      fixedProduct(189, "BUSCALIOS BARBACOA"),
      fixedProduct(190, "TOSTAITOS SEVILLANOS"),
      fixedProduct(191, "PATATAS HISPALANA 140G","Por 1 caja REGALO 1 paquete"),
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
    name: "LECHES Y BATIDOS/CAFÉS/LÁCTEOS",
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
    name: "ZUMOS",
    products: [
      fixedProduct(50, "BIOFRUTA PASCUAL TROPICAL P3"),
      fixedProduct(51, "BIOFRUTA PASCUAL PACIFICO P3"),
      fixedProduct(52, "BIOFRUTA PASCUAL IBIZA P3"),
      fixedProduct(53, "BIOFRUTA PASCUAL 1L TROPI"),
      fixedProduct(54, "FUNC. D.SIMON TROPICAL P6"),
      fixedProduct(55, "FUNC. D.SIMON CARIBE P6"),
      fixedProduct(56, "FUNC. D.SIMON MEDITERRANEO P6","Por 2 cajas REGALO 1 unidad KUYX PIÑA COCO 3L"),
      fixedProduct(64, "KUYX NARANJA 3L","Por 2 cajas REGALO 1 unidad KUYX PIÑA COCO 3L"),
      fixedProduct(65, "KUYX TROPICAL 3L","Por 2 cajas REGALO 1 unidad KUYX PIÑA COCO 3L"),
      fixedProduct(66, "KUYX MANDARINA 3L","Por 2 cajas REGALO 1 unidad KUYX PIÑA COCO 3L"),
      fixedProduct(67, "KUYX FRUTOS DEL BOSQUE 3L","Por 2 cajas REGALO 1 unidad KUYX PIÑA COCO 3L"),
      fixedProduct(68, "KUYX PIÑA 3L","Por 2 cajas REGALO 1 unidad KUYX PIÑA COCO 3L"),
      fixedProduct(69, "KUYX PIÑA COCO 3L","Por 2 cajas REGALO 1 unidad KUYX PIÑA COCO 3L"),
      fixedProduct(70, "KUYX OCEANICO 3L","Por 2 cajas REGALO 1 unidad KUYX PIÑA COCO 3L"),
      fixedProduct(71, "KUYX 330ML NARANJA","Por 1 caja REGALO 1 unidad KUYX 330ML FRUTOS ROJOS"),
      fixedProduct(72, "KUYX 330ML MANDARINA","Por 1 caja REGALO 1 unidad KUYX 330ML FRUTOS ROJOS"),
      fixedProduct(73, "KUYX 330ML TROPICAL","Por 1 caja REGALO 1 unidad KUYX 330ML FRUTOS ROJOS"),
      fixedProduct(74, "KUYX 330ML PIÑA","Por 1 caja REGALO 1 unidad KUYX 330ML FRUTOS ROJOS"),
      fixedProduct(75, "KUYX 330ML OCEANICO","Por 1 caja REGALO 1 unidad KUYX 330ML FRUTOS ROJOS"),
      fixedProduct(76, "KUYX 330ML MANGO","Por 1 caja REGALO 1 unidad KUYX 330ML FRUTOS ROJOS"),
      fixedProduct(77, "KUYX 330ML FRUTOS ROJOS","Por 1 caja REGALO 1 unidad KUYX 330ML FRUTOS ROJOS"),
      fixedProduct(59, "ROSTOY MELOCOTON 33CL"),
      fixedProduct(60, "ROSTOY PIÑA COCO 33CL"),
      fixedProduct(57, "ZUMO D.SIMON PIÑA P6 200"),
      fixedProduct(58, "ZUMO D.SIMON MELOCOTON P6 200"),
      fixedProduct(61, "ZUMO JUVER PIÑA 850ML"),
      fixedProduct(62, "ZUMO JUVER MELOCOTON 850ML"),
      fixedProduct(63, "ZUMO JUVER NARANJA 850ML"),
    ],
  },
  
  {
    name: "ALIMENTACIÓN",
    products: [
      fixedProduct(165, "ACEITE GIRASOL ROSIL 1L","Por 1 cajas REGALO 1 unidad"),
      fixedProduct(166, "ACEITE GIRASOL ROSIL 5L"),
      fixedProduct(167, "ACEITE OLIVA VIRGEN ROSIL 1L"),
      fixedProduct(168, "AZUCAR 1KG","Comprando 2 cajas REGALO 1 K"),
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
      fixedProduct(181, "PAN RALLADO PANAERAS 300G","OFERTA"),
      fixedProduct(182, "ARROZ BRILLANTE 1KG"),
      fixedProduct(183, "ARROZ BRILLANTE 500G"),
      fixedProduct(184, "MAYONESA YBARRA 450G"),
      fixedProduct(185, "KETCHUP ORLANDO 265G"),
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
      fixedProduct(208, "DETERGENTE KIRIKO BASICO 2.8L","OFERTA"),
      fixedProduct(209, "LAVAVAJILLAS FLOTA 1.1L"),
      fixedProduct(210, "FLOTA VAJILLAS 750ML"),
      fixedProduct(211, "FREGASUELOS PINO KIRIKO 1.5L","OFERTA"),
      fixedProduct(212, "FREGASUELOS DAMA NOCHE 1.5L","OFERTA"),
      fixedProduct(213, "FREGASUELOS J.MARSELLA 1.5L","OFERTA"),
      fixedProduct(214, "FREGASUELOS SPA 1.5L","OFERTA"),
      fixedProduct(215, "LIMPIACRISTALES KIRIKO 500ML"),
      fixedProduct(216, "PAPEL HIGIENICO FAMADIS 6R"),
      fixedProduct(217, "HIGIENICO ECONOMICO P12"),
      fixedProduct(218, "SECAMANO BUENO"),
      fixedProduct(219, "TOALLITAS BEBE BEKIDS 120U","Por 1 Caja REGALO 2 unidades"),
      fixedProduct(220, "ESCOBA PRIMER PRECIO"),
      fixedProduct(221, "PASTA COLGATE 75ML"),
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
      fixedProduct(248, "LOMO AL HORNO FAMADESA KG","Comprando 1 Caja PRECIO OFERTA"),
      fixedProduct(249, "MAGRETA AL AJILLO FAMADESA KG","Comprando 1 Caja PRECIO OFERTA"),
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
      fixedProduct(234, "ARENA GATO MIC&FRIENDS 5KG","OFERTA"),
      fixedProduct(235, "VASO PLASTICO 350CC"),
      fixedProduct(236, "PAPEL OCB 100U"),
      fixedProduct(237, "CARBON"),
      fixedProduct(238, "PAPEL ALUMINIO IND"),
      fixedProduct(239, "FILM INDUSTRIAL 200M"),
      fixedProduct(240, "PASTILLAS ENCENDIDO"),
      fixedProduct(241, "ESTUCHES DE LOS REYES"),
    ],
  },
];

/* ========================================= */

const products = departments.flatMap((department) =>
  department.products.map((product) => ({
    id: `${department.name}-${product.idnum}-${product.name}`,
    idnum: product.idnum,
    name: product.name,
    offerText: product.offerText || "",
    department: department.name,
  }))
);

export default function App() {
  const rowRefs = useRef({});

  const [quantities, setQuantities] = useState({});
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("TODOS");
  const [compactHeader, setCompactHeader] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setCompactHeader(window.scrollY > 120);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const filteredDepartments = useMemo(() => {
    return departments
      .filter(
        (department) =>
          selectedDepartment === "TODOS" ||
          department.name === selectedDepartment
      )
      .map((department) => ({
        ...department,
        products: department.products.filter((product) =>
          product.name.toLowerCase().includes(search.toLowerCase())
        ),
      }))
      .filter((department) => department.products.length > 0);
  }, [search, selectedDepartment]);

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
  };

  const clearOrder = () => {
    setQuantities({});
    setCustomerName("");
    setNotes("");
    setSearchInput("");
    setSearch("");
    setSelectedDepartment("TODOS");
  };

  /* =========================================
     GUARDAR PEDIDO HABITUAL
  ========================================= */

  const saveFrequentOrder = () => {
    if (selectedItems.length === 0) {
      alert("Introduce cantidades antes de guardar.");
      return;
    }

    localStorage.setItem(
      SAVED_ORDER_KEY,
      JSON.stringify({
        quantities,
        customerName,
        notes,
        savedAt: new Date().toISOString(),
      })
    );

    alert("Lista habitual guardada.");
  };

  const loadFrequentOrder = () => {
    const savedOrder = localStorage.getItem(SAVED_ORDER_KEY);

    if (!savedOrder) {
      alert("No hay lista guardada.");
      return;
    }

    const parsedOrder = JSON.parse(savedOrder);

    setQuantities(parsedOrder.quantities || {});
    setCustomerName(parsedOrder.customerName || "");
    setNotes(parsedOrder.notes || "");

    alert("Lista habitual cargada.");
  };

  const deleteFrequentOrder = () => {
    localStorage.removeItem(SAVED_ORDER_KEY);

    alert("Lista habitual borrada.");
  };

  /* ========================================= */

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

    return encodeURIComponent(lines.join("\n"));
  };

  const sendOrder = () => {
    if (selectedItems.length === 0) {
      alert("Introduce cantidades.");
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
              <h1 style={styles.title}>Pedido online</h1>

              <p style={styles.subtitle}>
                Guarda pedidos habituales y repítelos en segundos.
              </p>
            </div>
          </header>
        )}

        <div style={styles.card}>
          <label style={styles.label}>Cliente</label>

          <input
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Nombre cliente"
            style={styles.input}
          />

          <label style={styles.label}>Buscar artículo</label>

          <div style={styles.searchBox}>
            <Search size={18} />

            <input
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setSearch(event.target.value);
              }}
              placeholder="Buscar..."
              style={styles.searchInput}
            />
          </div>
        </div>

        {filteredDepartments.map((department) => (
          <section key={department.name} style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>{department.name}</h2>
            </div>

            {department.products.map((product) => {
              const productId = `${department.name}-${product.idnum}-${product.name}`;

              return (
                <div
                  key={productId}
                  ref={(element) => {
                    rowRefs.current[productId] = element;
                  }}
                  style={styles.row}
                >
                  <div>
                    <p style={styles.productName}>
                      #{product.idnum} {product.name}
                    </p>

                    {product.offerText && (
                      <div style={styles.offerText}>
                        {product.offerText}
                      </div>
                    )}
                  </div>

                  <div style={styles.qtyRow}>
                    <input
                      value={quantities[productId]?.cajas || ""}
                      onChange={(event) =>
                        updateQuantity(
                          productId,
                          "cajas",
                          event.target.value
                        )
                      }
                      placeholder="Cajas"
                      style={styles.qtyInput}
                    />

                    <input
                      value={quantities[productId]?.unidades || ""}
                      onChange={(event) =>
                        updateQuantity(
                          productId,
                          "unidades",
                          event.target.value
                        )
                      }
                      placeholder="Unid."
                      style={styles.qtyInput}
                    />
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
            rows={3}
            style={styles.textarea}
          />

          <div style={styles.summary}>
            <strong>{selectedItems.length}</strong> artículos seleccionados
          </div>

          <button
            onClick={saveFrequentOrder}
            style={styles.secondaryButton}
          >
            Guardar lista habitual
          </button>

          <button
            onClick={loadFrequentOrder}
            style={styles.secondaryButton}
          >
            Cargar lista habitual
          </button>

          <button
            onClick={deleteFrequentOrder}
            style={styles.secondaryButton}
          >
            Borrar lista guardada
          </button>

          <button onClick={sendOrder} style={styles.primaryButton}>
            <Send size={18} />
            Enviar WhatsApp
          </button>

          <button onClick={clearOrder} style={styles.secondaryButton}>
            <Trash2 size={18} />
            Borrar pedido
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "12px",
    fontFamily: "Arial",
  },

  container: {
    maxWidth: "900px",
    margin: "0 auto",
  },

  header: {
    background: "white",
    padding: "18px",
    borderRadius: "18px",
    display: "flex",
    gap: "12px",
    alignItems: "center",
    marginBottom: "16px",
  },

  iconBox: {
    background: "#0f172a",
    color: "white",
    padding: "12px",
    borderRadius: "14px",
  },

  title: {
    margin: 0,
  },

  subtitle: {
    marginTop: "6px",
    color: "#64748b",
  },

  card: {
    background: "white",
    padding: "16px",
    borderRadius: "18px",
    marginBottom: "18px",
  },

  label: {
    display: "block",
    marginBottom: "6px",
    marginTop: "10px",
    fontWeight: "bold",
  },

  input: {
    width: "100%",
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    boxSizing: "border-box",
  },

  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "10px",
  },

  searchInput: {
    border: "none",
    outline: "none",
    width: "100%",
  },

  section: {
    background: "white",
    borderRadius: "18px",
    overflow: "hidden",
    marginBottom: "18px",
  },

  sectionHeader: {
    background: "#0f172a",
    color: "white",
    padding: "12px",
  },

  sectionTitle: {
    margin: 0,
  },

  row: {
    padding: "14px",
    borderTop: "1px solid #e2e8f0",
  },

  productName: {
    fontWeight: "bold",
    marginBottom: "10px",
  },

  qtyRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },

  qtyInput: {
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    textAlign: "center",
  },

  offerText: {
    background: "#fef2f2",
    color: "#dc2626",
    padding: "6px",
    borderRadius: "8px",
    marginBottom: "8px",
    fontSize: "13px",
    fontWeight: "bold",
  },

  textarea: {
    width: "100%",
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    boxSizing: "border-box",
  },

  summary: {
    margin: "16px 0",
    background: "#e2e8f0",
    padding: "12px",
    borderRadius: "12px",
  },

  primaryButton: {
    width: "100%",
    height: "48px",
    border: "none",
    borderRadius: "12px",
    background: "#22c55e",
    color: "white",
    fontWeight: "bold",
    marginTop: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },

  secondaryButton: {
    width: "100%",
    height: "48px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    background: "white",
    fontWeight: "bold",
    marginTop: "10px",
  },
};
