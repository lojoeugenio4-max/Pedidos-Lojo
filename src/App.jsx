import React, { useEffect, useMemo, useRef, useState } from "react";
import { ShoppingCart, Trash2, Send, Search } from "lucide-react";

const WHATSAPP_NUMBER = "34670716744";

const fixedProduct = (idnum, name, offerText = "") => ({
  idnum,
  name,
  offerText,
});

/* PEGA AQUÍ TU LISTADO DE DEPARTAMENTOS COMPLETO */
const departments = [
  {
    name: "AGUA",
    products: [
      fixedProduct(1, "AGUA FUENTELAJARA 1.5L","Comprando 10 cajas REGALO 1 caja "),
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
    name: "CHARCUTERÍA LONCHEADA",
    products: [
      fixedProduct(245, "QUESO SEMI PUROVI 1.50E"),
      fixedProduct(258, "CHOPPED BEEF CAMPOFRIO 95G"),
      fixedProduct(259, "CHOPPED CERDO CAMPOFRIO 95G"),
      fixedProduct(260, "MORTADELA SICILIANA 95G"),
      fixedProduct(261, "MORTADELA C/A CAMPOFRIO 95G"),
      fixedProduct(262, "JAMON CURADO NAVIDUL 50G"),
      fixedProduct(263, "PECHUGA PAVO CAMPOFRIO 70G"),
      fixedProduct(264, "JAMON COCIDO EXTRA 75G"),
      fixedProduct(265, "CHORIZO REVILLA 65G"),
      fixedProduct(266, "CHORIZO PAMPLONA REVILLA 65G"),
      fixedProduct(267, "SALAMI REVILLA 65G"),
      fixedProduct(268, "SALCHICHON REVILLA 65G"),
      fixedProduct(269, "TAQUITOS NAVIDUL 50G"),
      fixedProduct(270, "BACON O.MAYER 100G"),
      fixedProduct(271, "SALCHICHAS CAMPOFRIO FRANKFURT"),
      fixedProduct(273, "PIZZA CAMPOFRIO 4 QUESOS"),
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
    name: "CHARCUTERÍA CORTE",
    products: [
      fixedProduct(242, "CHOPPED TERNERA CAMPOFRIO KG"),
      fixedProduct(243, "CHOPPED CERDO CAMPOFRIO KG"),
      fixedProduct(244, "QUESO GOUDA BARRA KG"),
      fixedProduct(246, "POLLO RELLENO CARLOTEÑA KG"),
      fixedProduct(247, "POLLO RELLENO BLANCE KG"),
      fixedProduct(248, "LOMO AL HORNO FAMADESA KG"),
      fixedProduct(249, "MAGRETA AL AJILLO FAMADESA KG"),
      fixedProduct(250, "JAMON COCIDO 1A KG"),
      fixedProduct(251, "PALETA REVILLA KG"),
      fixedProduct(252, "PECHUGA PAVO NOEL KG"),
      fixedProduct(253, "PECHUGA PAVOFRIO KG"),
      fixedProduct(254, "CHORIZO EXTRA VILLAR KG"),
      fixedProduct(255, "CHORIZO TRADICIONAL KG"),
      fixedProduct(256, "CHORIZO CULAR IBERICO KG"),
      fixedProduct(257, "SALCHICHON TURON KG"),
      
     
      
    ],
  },
];

/* PEGA AQUÍ TU LISTADO DE ARTÍCULOS OCULTOS COMPLETO */
const hiddenProductsRaw = [
 fixedProduct(284, "15 x 30 BOLSA TRAMPARENTE"),
fixedProduct(285, "355ML RED BULL GRANDE"),
fixedProduct(287, "ABRILLANTADOR MICAL MAQUINAS 5L"),
fixedProduct(288, "ABSOLUTE 200 ML ( PETACA )"),
fixedProduct(289, "ABSOLUTE MINIATURA"),
fixedProduct(292, "ACEITUNAS OFERTA SIN HUESO UNIDAD"),
fixedProduct(293, "ACOND ANIAN NATURAL 1000"),
fixedProduct(294, "AGRIO DE LIMON GOURMET 1/2"),
fixedProduct(296, "AGUA DESIONIZADA 2L KIRIKO"),
fixedProduct(297, "AGUA FONT VELLA 1.5 L"),
fixedProduct(298, "AGUA FUERTE 1.5L KIRIKO"),
fixedProduct(300, "AGUA LANJARON 0,75L 15 UNID."),
fixedProduct(301, "AGUA LANJARON S/G 6 L TAPON GR"),
fixedProduct(302, "AGUA SOLAN DE CABRA 500 ML"),
fixedProduct(303, "AGUA OXIGENADA KELSIA 250"),
fixedProduct(304, "AGUASAL PIPAS (SEVILLANAS)"),
fixedProduct(305, "AGUA VALTORRE TREKKING 0.75"),
fixedProduct(306, "AJO GRANULADO LA BARRACA BTE PEQUEÑO"),
fixedProduct(307, "AJONJOLI DORADO LA BARRACA BTE PEQUEÑO"),
fixedProduct(308, "AJO PEREJIL LA BARRACA BTE PEQUEÑO"),
fixedProduct(309, "ALBAHACA BARRACA BTE PEQUEÑO"),
fixedProduct(310, "ALBONDIGAS ABRICOME LAT 420 SALSA"),
fixedProduct(311, "ALBONDIGAS C/GUISAN LOURIÑO L/425"),
fixedProduct(312, "ALBONDIGAS LOURIÑO L/425"),
fixedProduct(313, "ALCACHOFA DIAMIR 6/8 LT 390 GR"),
fixedProduct(314, "ALCOHOL MICADERM SANITARIO 250 ML"),
fixedProduct(315, "ALTRAMUZ SALADITO BANDEJA 250GR C/10"),
fixedProduct(316, "ALUBIA FRASCO 570 GR"),
fixedProduct(317, "ALUBIAS BLANCA 1/2 KG"),
fixedProduct(318, "ALUMINIO DOMESTICO 30"),
fixedProduct(319, "ALUMINIO DOMESTICO 8 METROS"),
fixedProduct(320, "AMONIACO NORMAL KIRIKO 1.5LT"),
fixedProduct(321, "AMONIACO PERFUMADO 1.5L KIRIKO"),
fixedProduct(322, "AMONIACO PQS 1 L."),
fixedProduct(323, "ANCHOAS CAPRIMAR ABRE F."),
fixedProduct(326, "ANIS ARENA SECO 1 L."),
fixedProduct(328, "APETINAS KETCHUP 25G"),
fixedProduct(329, "APETINAS KETCHUP 90G"),
fixedProduct(331, "AQUAPLUS LIMON 1.5 L VALTORRE"),
fixedProduct(333, "ARIEL LIQ 28D"),
fixedProduct(335, "ARROZ BRILLANTE BASMATI 2X125 GR"),
fixedProduct(336, "ARROZ CIGALA 500 GR."),
fixedProduct(337, "ARROZ SOS 1/2"),
fixedProduct(338, "ATUN DIAMIR 1KG"),
fixedProduct(339, "ATUN PESCAMAR TOMATE RO-80 AF"),
fixedProduct(340, "ATUN RAZO AC/VEG. PACK 3 ABREFACIL"),
fixedProduct(341, "AVECREM PESCADO 8 PASTILLAS"),
fixedProduct(342, "AVECREM POLLO 8"),
fixedProduct(344, "AZUCAR AZUCARERA MORENO PPC 800G"),
fixedProduct(345, "AZUCAR SOBRES 10GR CONSEMUR"),
fixedProduct(346, "BACARDI 200 ML ( PETACA )"),
fixedProduct(347, "BACON CASA TARRADELLAS 2X100G"),
fixedProduct(348, "BACON PROLONGO,KG"),
fixedProduct(350, "BAILEYS ORIGINAL 70CL"),
fixedProduct(353, "BANDERILLA GOURMET PICA.150G"),
fixedProduct(354, "BASTONCILLOS ALGODON COALIMENT 200UDS"),
fixedProduct(358, "BAYETA MICAL 1 UNIDAD MICRIFI 38X40"),
fixedProduct(359, "BAYETA MICAL AMARILLA 40X36 CM 10U"),
fixedProduct(360, "BAYETA MICAL MICROFIBRA BAÑO 38X40 2U"),
fixedProduct(361, "BEBIDA ENERYETI DRAGON 500ML"),
fixedProduct(363, "BERBERECHO DIAMIR RR-120 70/80"),
fixedProduct(364, "BICARBONATO LA BARRACA 180 GR"),
fixedProduct(365, "BOBINA P.V.C. 45X1500"),
fixedProduct(367, "BOL GRANDE"),
fixedProduct(368, "BOL PEQUEÑO"),
fixedProduct(369, "BOLSA 30X40 ASA KG FUERTE CAMISETA B.O 70% SEGUN LEY"),
fixedProduct(370, "BOLSA 35X50 ASA FINA 200 U CAMISETA"),
fixedProduct(371, "BOLSA BASURA 115X150 SUPER GRANDE CARNICERIA"),
fixedProduct(374, "BOLSA BLANCA 35X50 1KG NORMA"),
fixedProduct(376, "BOLSA BLANCA 50x60 GRANDE BLANCA"),
fixedProduct(378, "BOLSAS 10X20 PURUÑUELA"),
fixedProduct(379, "BOLSAS 12X25 PURUÑUELA"),
fixedProduct(380, "BOTELLIN JUVER MELOCOTON"),
fixedProduct(381, "BOTELLIN JUVER PIÑA"),
fixedProduct(383, "BRANDY MAGNO 70 CL."),
fixedProduct(384, "BROTES DE SOJA GOURMET 180G"),
fixedProduct(385, "BUDIN PROLONGO 150GR"),
fixedProduct(387, "CAÑA DE LOMO NAVIDUL 1.20€ L/40 GR"),
fixedProduct(388, "CABALLA ACEITE/V UBAGO 90"),
fixedProduct(389, "CABALLA UBAGO TOMATE 90G"),
fixedProduct(390, "CABALLERO GARBANZO LECHOSO 1/2 K"),
fixedProduct(391, "CABALLERO LENTEJA CASTELLANA 1/2 K"),
fixedProduct(392, "CABALLERO VERDINA 1/2 KG"),
fixedProduct(393, "CABECERO LOMO VIAN SANA 60G"),
fixedProduct(394, "CABEZADA LOMO CARLOTEÑA,KG"),
fixedProduct(396, "CAFE FRIO LANDESSA KAKAO"),
fixedProduct(397, "CALAMAR MIAU AMERICANA RO-85P3"),
fixedProduct(398, "CALAMAR MIAU TINTA RO-85P3"),
fixedProduct(400, "CALDO GOURMET POLLO 1L"),
fixedProduct(401, "CALLOS APIS LT 390 GR"),
fixedProduct(402, "CALLOS CERDO 400GR MONTEALBOR"),
fixedProduct(403, "CALLOS TERNERA 400GR MONTEALBOR"),
fixedProduct(404, "CALLOS TERNERA BARRA MONTEALBOR,KG."),
fixedProduct(406, "CANELA MOLIDA LA BARRACA"),
fixedProduct(407, "CANELA RAMA LA BARRACA"),
fixedProduct(408, "CASCALES DOÑA PIPA JUVENIL DE 30 UN"),
fixedProduct(409, "CASCALES GRANDE DOÑA PIPA 14 U"),
fixedProduct(410, "CASERA BLANCA LATA"),
fixedProduct(413, "CAVA SEMI SECO BONAVAL 3/4"),
fixedProduct(414, "CENTRO J.CURADO NAVIDUL KG"),
fixedProduct(415, "CERVEZA 0.0 ESTRELLA 1 L."),
fixedProduct(421, "CERVEZA CRUZCAMPO UNIDAD S/A P-6"),
fixedProduct(424, "CHAMPIÑON GOURMET ENTERO 185GR"),
fixedProduct(425, "CHAMPIÑON NAT.LAMINADO L/500"),
fixedProduct(428, "CHOPPED PAVO L/95 GR CAMPOF."),
fixedProduct(429, "CHOPPED PORK LATA 2 KG FAMADESA"),
fixedProduct(430, "CHORIZO BLANCO 65 GR"),
fixedProduct(433, "CHORIZO IBER.LONCHA 45G NAVIDUL"),
fixedProduct(435, "CHORIZO PICANTE REVILLA L/65 GR"),
fixedProduct(436, "CHORIZO REVILLA TAQUITOS 65GR"),
fixedProduct(439, "CHORIZO TUNEL PIMI.LONCHA 80GR PROLONGO"),
fixedProduct(440, "CHORIZO TURON TUNEL PIMIENTA 1/2 PIEZA"),
fixedProduct(441, "CHORIZO Y MORCILLA IBERICOS VACIO 200G"),
fixedProduct(442, "CHOVI ALIOLI 250 ML.(ALI-OLI)"),
fixedProduct(443, "CHURRUCA KIKONAZO PLUS 50 UNID."),
fixedProduct(444, "CHURRUCA PASARRATOS EJECUTIVE 10UDS"),
fixedProduct(445, "CHURRUCA PASARRATOS SENIOR 20UDS"),
fixedProduct(446, "CLAVO GRANO LA BARRACA BTE CRISTAL"),
fixedProduct(447, "COÑAC SOBERANO MINI"),
fixedProduct(451, "COCIDO MADRILEÑO LITORAL 440GR"),
fixedProduct(452, "COCINA FAMADIS LIMON ROLLOM P-2"),
fixedProduct(453, "COCINA NICKY LIMON ROLLO P-2"),
fixedProduct(455, "COLA-COLA CAO 400"),
fixedProduct(456, "COLONIA MECADERM INF 750 ML"),
fixedProduct(457, "COLORANTE LA BARRACA"),
fixedProduct(458, "COMIDA GATO MIC&FR.MIX CARNR 4K"),
fixedProduct(459, "COMIDA MIC&FR. PERRO BUEY 300GR"),
fixedProduct(460, "COMIDA MIC&FR. PERRO POLLO 300GR"),
fixedProduct(461, "COMIDA PERRO MIC&FRIENDS 4K"),
fixedProduct(462, "COMINO GRANO LA BARRACA B/PEQUEÑO"),
fixedProduct(463, "COMINO MOLIDO LA BARRACA BTE PEQUEÑO"),
fixedProduct(464, "COMP AFECTIVA NOCHE 10U"),
fixedProduct(465, "COMP AFECTIVA NOCHE ALA 14U"),
fixedProduct(466, "COMP AFECTIVA ULTRA ALA 16U"),
fixedProduct(467, "COMPANGO 3X100 GR"),
fixedProduct(468, "COMP. EVAX FINA Y SEGURA NORM 16 U"),
fixedProduct(469, "( COMPOSTABLE ) 30 X 40 MERCADO ROLLO ANONIMA 1 KG"),
fixedProduct(470, "COMPRESA AFECTIVA ECONOMICA EST.20 UNI"),
fixedProduct(471, "COMPRESA FINA Y SEG.ALAS NORMAL EVAX 12U"),
fixedProduct(472, "CONOS VAINILLA Y CHOCOLATE 4 SOMOSIERRA"),
fixedProduct(473, "CORTEZAS 100 GR CARTUJANO"),
fixedProduct(474, "CR CACAO NOCILLA 190 DUO"),
fixedProduct(475, "CR CACAO NOCILLA 190 ORIGINAL"),
fixedProduct(476, "CUÑA DE QUESO RESERVA PREC.200 GR.CAMP."),
fixedProduct(477, "CUÑA QUESO CABRA PRECORT.CAMPOF.200 GR"),
fixedProduct(478, "CUÑA QUESO SEMI NAVIDUL 170 GR"),
fixedProduct(479, "CUBO FREGONA KARIN + ESCURRIDOR"),
fixedProduct(480, "CUBO PESTIÑOS SERAFIN 800 GR"),
fixedProduct(481, "CUCHILLA GILLETE BLUEII 5+1"),
fixedProduct(482, "CURRY BARRACA BOTE CRISTAL PEQUEÑO"),
fixedProduct(483, "C.V ESPUMOSO ROSADO \"MAGNA\""),
fixedProduct(484, "DELICIA SURIMI,KG"),
fixedProduct(485, "DESENG NUCA MAX 1L PERFUMADO EL MILAGRITO"),
fixedProduct(486, "DESENGRASANTE AGERUL PIST 750"),
fixedProduct(487, "DESENGRASANTE PISTOLA 750 KIRIKO"),
fixedProduct(488, "DESOD.DOVE ORIGINAL SP 250ML"),
fixedProduct(489, "DETE LIQ. 5L LUCECITA ORIGINAL KIRIKO 5L"),
fixedProduct(490, "DETE LIQ. LUCECITA AZUL KIRIKO 5L"),
fixedProduct(491, "DETE LIQ. LUCECITA J MARSELLA KIRIKO 5L"),
fixedProduct(493, "DETERGENTE LUCECITA 2.8L ORIGINAL 2.8L"),
fixedProduct(494, "DETERG.LIQ.MARSELLA 2 L.KIRIKO"),
fixedProduct(495, "DETER.LIQ HIGIENIZANTE 3L KIRIKO"),
fixedProduct(496, "DETER.LIQ J.MARSELLA 3L KIRIKO"),
fixedProduct(497, "DULCE MEMBRILLO QUIJOTE 400 GR"),
fixedProduct(498, "EDULCORANTE DOSIF.650 COMP.LA BARRACA"),
fixedProduct(499, "ELIXIR MICADERM MENTA 500 ML"),
fixedProduct(501, "ENERDRINK SANDIA Y UVA"),
fixedProduct(503, "ENERYETI ATOMYC"),
fixedProduct(504, "ENJOY 1/2 L NARANJA"),
fixedProduct(505, "ENSALADA PIMIEN.ASAD.ALSUR L/420GR"),
fixedProduct(506, "ESPARRAGO GOURMET EXT.FCO 9/12 205G (8096)"),
fixedProduct(507, "ESPAR TRIG ALSUR TROC 390 GR AF"),
fixedProduct(508, "ESPECIAS DE CARACOLES GRANO LA BARRACA"),
fixedProduct(509, "ESPECIAS SURT GRANO LA BARRACA BTE PEQUEÑO"),
fixedProduct(510, "ESPINACAS ALSUR FRASCO 660GR"),
fixedProduct(511, "ESP. PINCHOS AMARILLOS LA BARRACA BTE .PEQUEÑO"),
fixedProduct(512, "ESPUMA AFEITAR GILLETE 200ML"),
fixedProduct(513, "ESPUMA PERFE EF GIORGI 200"),
fixedProduct(514, "ESTROPAJO FIBRA VERDE PACK"),
fixedProduct(515, "ESTROPAJO MICAL SALVAUÑAS P-3"),
fixedProduct(516, "ESTROPAJO MITALICO PACK"),
fixedProduct(517, "EXOTICA GIN 1890 70CL"),
fixedProduct(518, "F1 29G 30U KIT KAT"),
fixedProduct(519, "FABADA ASTURIANA LITORAL LT 435 GR"),
fixedProduct(520, "FAIRY 480"),
fixedProduct(521, "FAIRY MAXI PODER"),
fixedProduct(523, "FIAMBRE CASADEMONT 11 X11 KG-DUCADO-"),
fixedProduct(524, "FIAMBRE DE PALETA COCIDA CAMPOFRIO.KG"),
fixedProduct(526, "FIDEOS GALLO Nº0 250 GR"),
fixedProduct(527, "FIDEOS GALLO Nº1 250 GR"),
fixedProduct(528, "FIDEOS GALLO Nº2 250 GR"),
fixedProduct(529, "FIDEOS GALLO Nº4 250 GR"),
fixedProduct(530, "FIDEOS GALLO PERLA 250 GR"),
fixedProduct(531, "FILETE CABALLA A/V DIAMIR 1000"),
fixedProduct(533, "FILMS INDUSTRIAL 45X300 (MELCHO)MORADO LARGO PARA FRUTA"),
fixedProduct(534, "FINISH PLLAS TODO EN1 25+25u"),
fixedProduct(535, "FLOTA LIQ 2.69 L 42+10 D A.PLUS BOUQUET"),
fixedProduct(536, "FLOTA PASTILLAS VERDE NORMAL 250 G"),
fixedProduct(537, "FOIE-GRAS PIARA 75 GR P3"),
fixedProduct(538, "FOIE-GRAS PIARA 800 GR"),
fixedProduct(539, "FOIGRAS APIS 200 GR"),
fixedProduct(540, "FOIGRAS APIS P3 80 GR NORMAL"),
fixedProduct(541, "FOLIO"),
fixedProduct(542, "FREGASUELO COLONIA 1.500 L KIRIKO"),
fixedProduct(543, "FREGASUELOS ALOE VERA 1.5 L KIRIKO"),
fixedProduct(544, "FREGASUELOS ASEVI CIAN 1L"),
fixedProduct(545, "FREGASUELOS ASEVI MIO 1L"),
fixedProduct(546, "FREGASUELOS ASEVI NARANJA 1L"),
fixedProduct(548, "FREGASUELOS FLORAL 1.5 L KIRIKO"),
fixedProduct(550, "FREGASUELOS KIRIKO LIMON 1,5L"),
fixedProduct(553, "FREGASUELOS TALCO 1.5L KIRIKO"),
fixedProduct(554, "FREGONA MICAL ALGODON"),
fixedProduct(555, "FREGONA MICAL AMARILLA"),
fixedProduct(556, "FREGONA MICAL AZUL"),
fixedProduct(557, "FREGONA MICAL MICROFIBRA"),
fixedProduct(558, "FRESHYETI CANDI PLATANO 500 ML"),
fixedProduct(559, "FRESHYETI PINTALENGUAS 500ML"),
fixedProduct(563, "GALLETA OREO 154 GR"),
fixedProduct(564, "GALLETA OREO MINI 160G"),
fixedProduct(565, "GALLET CHIPS-AHOY MINI 160G"),
fixedProduct(566, "GAMA FVL 1.25L LIMON"),
fixedProduct(568, "GAS KARIN"),
fixedProduct(569, "GEL AF GILLETTE 200 SENS EXISTI"),
fixedProduct(570, "GEL DERMO COALIMENT 750ML"),
fixedProduct(571, "GEL FIJA GIORGI MAX EXT FUERTE 240 N3 NEW"),
fixedProduct(572, "GIGANTONES EJECUTIVO CAJA 10U"),
fixedProduct(573, "GIGANTONES SENIOR 20U"),
fixedProduct(574, "GIGANTONES SUPER SENIOR XXL 10U"),
fixedProduct(575, "GINEBRA BEEFEATER MINIATURA"),
fixedProduct(576, "GINEBRA BOMBAY SAPHIRE 0.7"),
fixedProduct(578, "GINEBRA RIVES 0.70"),
fixedProduct(579, "GINEBRA RIVES 1 L."),
fixedProduct(580, "GINEBRA SEAGRAM´S 70CL"),
fixedProduct(581, "GINEBRA TANQUERAY 70 CL"),
fixedProduct(582, "GINEBRE BEEFEATER 1 L"),
fixedProduct(583, "GIN PUERTO DE INDIAS 70CL"),
fixedProduct(585, "GRANDE POWERKING 50CL"),
fixedProduct(586, "GUINDILLA RAMA LA BARRACA B/PEQUEÑO"),
fixedProduct(587, "GUISANTE LOZANO LT 185"),
fixedProduct(588, "GUISANTES LOZANO LATA 500 GRS."),
fixedProduct(589, "GUSANITO 85GR 8U RISI"),
fixedProduct(590, "GUSANITOS QUESO 110GR CARTUJANO"),
fixedProduct(591, "HABAS BABY GOURMET 425G"),
fixedProduct(592, "HAMBURGUESA BUEY UNIDAD"),
fixedProduct(593, "HAMBURGUESAS SIMON DE POLLO P-3"),
fixedProduct(594, "HARINA DE GARBANZO 500GR"),
fixedProduct(595, "HARINA PANAERAS FREIR 1 K"),
fixedProduct(596, "HARINA PANAERAS FREIR 500"),
fixedProduct(597, "HARINA PANAERAS REPOST. 1 K."),
fixedProduct(598, "HARINA PANAERAS REPOSTER.500 G"),
fixedProduct(599, "HARINA YOLANDA REBOZAR 500"),
fixedProduct(600, "HIERBAS NATURALES BARRACA 15G"),
fixedProduct(602, "HIGIENICO RENOVA DUPLEX P4"),
fixedProduct(603, "HIGIENIZANTE MULTIUSOS 750 ML/KIRIKO"),
fixedProduct(604, "HUEVOS KINDER INVIERNO UNI"),
fixedProduct(605, "INSECT CASA JARDIN 600 SP ROSAS"),
fixedProduct(606, "JABON DE MANOS COCINAS 500ML NAVINIA"),
fixedProduct(607, "JABON DE MANOS DERMO 500ML NAVINIA"),
fixedProduct(608, "JABON DE MANOS FRESA Y NATA 500ML NAVINIA"),
fixedProduct(609, "JABUGUITO DULCE CABO 200GR"),
fixedProduct(610, "JAGERMEISTER HERB 0.70CL"),
fixedProduct(611, "JAMON CASADEMONT 8.600 KG (PEQUEÑO)"),
fixedProduct(612, "JAMON COCIDO 1ª CON/PIEL EXTRAJUGOSO"),
fixedProduct(614, "JAMON NATURA COCIDO EXTRA CASADEMONT,KG"),
fixedProduct(615, "JHONY WALKER NEGRO MINIATURA"),
fixedProduct(616, "JUDIA ANCHA CORTADA ALSUR FRASCO 660 G"),
fixedProduct(617, "JUDIAS C/CHORIZO LOZANO LT 425G"),
fixedProduct(618, "JUDIAS VERDES FINAS ALSUR 660 FCO"),
fixedProduct(619, "JUMMY 100GR 9U"),
fixedProduct(620, "JUMPERS MANTEQUILLA"),
fixedProduct(621, "JUMPERS YORK Y QUESO 24 U"),
fixedProduct(622, "KASKYS 120 G"),
fixedProduct(623, "KASKYS 45G"),
fixedProduct(625, "KETCHUP PRIMA 290G"),
fixedProduct(626, "KIKONAZOS SUPER SENIOR XXL 10U"),
fixedProduct(627, "KINDER BUENO CHOCO PACK 10"),
fixedProduct(628, "KINDER BUENO WHITE PACK 10"),
fixedProduct(629, "KINDER HAPPY HIPPO BOLSA 10 U"),
fixedProduct(630, "KIT KAT P-3"),
fixedProduct(641, "LACA NELLY FUERTE 400 ML."),
fixedProduct(642, "LACA NELLY SP NORMAL"),
fixedProduct(643, "LANJARON 1/2"),
fixedProduct(644, "LATA ENERYETI BLOOM 500ML"),
fixedProduct(645, "LATA ENERYETI CANDY MORA 500ML"),
fixedProduct(646, "LATA ENERYETI CARIBE 500CL"),
fixedProduct(647, "LATA ENERYETI COCO ANYEL 500ML"),
fixedProduct(648, "LATA ENERYETI FEROZ 500ML"),
fixedProduct(649, "LATA ENERYETI INFRAMUNDO 500CL"),
fixedProduct(650, "LATA ENERYETI ORIGINAL 500ML"),
fixedProduct(651, "LATA ENERYETI SANDIA SPLASH 500CL"),
fixedProduct(653, "LAUREL CAJA CARTON BARRACA 12U."),
fixedProduct(654, "LAVAVAJILLAS MICAL MAQUINAS 5L"),
fixedProduct(655, "LECHE CONDE . LA LECHERA 450 G SIRVEFACIL"),
fixedProduct(656, "LECHE COND LECHERA LATA 370"),
fixedProduct(657, "LECHE COVAP DESNATADA 1 L."),
fixedProduct(660, "LECHE OFERTA ENTERA 1L"),
fixedProduct(661, "LECHE PULEVA SEMI A+D 1L"),
fixedProduct(662, "LEJIA ACE 2 L."),
fixedProduct(664, "LEJIA COLOR 1 LT KIRIKO"),
fixedProduct(666, "LEJIA ESTRELLA AZUL 1.5 L."),
fixedProduct(667, "LEJIA ESTRELLA PINO 1.5 L."),
fixedProduct(670, "LEJIA LIMON ESTRELLA 1.5L"),
fixedProduct(673, "LENTEJAS PARDINA 1/2 K"),
fixedProduct(674, "LICOR 43 70CL"),
fixedProduct(675, "LICOR 43 MINIATURA"),
fixedProduct(676, "LICOR AMARETTO DISARONNO 70 CL"),
fixedProduct(677, "LICOR COCO-RON MALIBU 0.70"),
fixedProduct(678, "LICOR JAGERMEISTER 200 ML 35º ( PETACA )"),
fixedProduct(679, "LICOR RUAVIEJA HIERBAS 70 CL"),
fixedProduct(681, "LIMPIAHOGAR BAÑOS 1.500 KIRIKO"),
fixedProduct(682, "LIMP. VOLVONE LGHT 750ML"),
fixedProduct(686, "LOMITO IBERICO DE BELLOTA VILLAR KG"),
fixedProduct(687, "LOMO HORNO A LA PIMIE .PROLONGO 100 G"),
fixedProduct(688, "LUNCH CAMPOFRIO,KG"),
fixedProduct(689, "MACARRONES GALLO Nº 6 250 GR"),
fixedProduct(690, "MACARRONES VEGETALES GALLO 250 GR"),
fixedProduct(691, "MACEDONIA VERDURAS ALSUR 660 FCO"),
fixedProduct(692, "MAIZ DULCE GOURMET DULCE 140G P-3"),
fixedProduct(693, "MAIZENA PTE 400 GR"),
fixedProduct(694, "MAIZ GOURMET DULCE 285GR"),
fixedProduct(695, "MALETIN DE JAMON CEBO VILLAR 14X50GR"),
fixedProduct(696, "MANGO 1.40 PINTADO ROJO (BARATO)"),
fixedProduct(697, "MANZANILLA LA GUITA 0.375"),
fixedProduct(698, "MANZANILLA MUY FINA BARBADILLO 3/4"),
fixedProduct(699, "MANZANILLA SOBRE LA BARRACA"),
fixedProduct(702, "MAYONESA PRIMA 400"),
fixedProduct(704, "MECHERO CLIPER TRANSPARENTE CAJA"),
fixedProduct(705, "MEJILLON CALVO ESCAB PACK3/80"),
fixedProduct(706, "MEJILLONES (20/30)RIA SULTAN PEQUEÑO DOP"),
fixedProduct(707, "MELOCOTON CONSEMUR EXTRA 1KG"),
fixedProduct(708, "MELVA ACEITE DIAMIR RO 1KG"),
fixedProduct(709, "MELVA CANUTERA PLAYA GIRASOL RR125"),
fixedProduct(710, "MENTA POLEO LA BARRACA 10 INF."),
fixedProduct(711, "MERMELADA FRESA LA VIEJA FABRICA 350GR"),
fixedProduct(712, "MERMELADA MELOCOTON LA VIEJA FABRICA 350GR"),
fixedProduct(713, "MIEL LA DULCE ABEJA 1KG"),
fixedProduct(714, "MINI APENINAS KRTCHUP 24G 0.50€"),
fixedProduct(715, "MINIATURA LEGENDARIO AÑEJO"),
fixedProduct(716, "MINIATURA RIVES"),
fixedProduct(717, "MINI KASKYS 40G 0.50€"),
fixedProduct(718, "MINI PICOTEO 30G"),
fixedProduct(719, "MINI SERVI P-2 UNIDAD"),
fixedProduct(720, "MINI STICK FUET CF 50G 12U"),
fixedProduct(721, "MOJAMA ATUN USISA KG"),
fixedProduct(722, "MONSTERS AZUL ENERGY LO-CARB 500 CC(4155)"),
fixedProduct(723, "MONSTERS LANDO NORRIS ZER LATA 50 CL"),
fixedProduct(725, "MONSTERS REHAB PEACH LATA 50 CL"),
fixedProduct(726, "MONSTERS RIPPER LATA 50 CL"),
fixedProduct(727, "MONSTERS ULTRA STRAWBERRY DREAMS 500 CC"),
fixedProduct(731, "MORTADELA ACEITU.CASADEMONT,KG"),
fixedProduct(733, "MORTADELA CASADEMONT,KG"),
fixedProduct(734, "MORTADELA CLASICA CAMPOF.KG."),
fixedProduct(735, "MORTADELA PAVO CAMPOFRIO,KG"),
fixedProduct(736, "MORTADELA PAVO L/95 GR CAMPOF."),
fixedProduct(738, "MOSTAZA ORLANDO 260 GR"),
fixedProduct(739, "MOZZARELLA OGGI 150GR ROJA"),
fixedProduct(741, "NESQUIK BOTE 400 GR."),
fixedProduct(743, "NUEZ MOSCADA LA BARRACA BTE PEQUEÑO"),
fixedProduct(745, "OGGI RALLADO 4 QUESOS 150G"),
fixedProduct(746, "ÑORAS SECAS LA BARRACA"),
fixedProduct(747, "OREGANO HOJA LA BARRACA BOTE"),
fixedProduct(748, "PACHARAN ZOCO 1 L."),
fixedProduct(750, "PALOMITA CARAMELO FAM 16U"),
fixedProduct(751, "PALOMITA CHOCO BLANCO FAM 16U"),
fixedProduct(752, "PALOMITA CHOCO FAM 16U"),
fixedProduct(754, "PALOMITA MANTEQUILLA RISI 8U"),
fixedProduct(756, "PAN RALLADO PANAERAS AJO/PEREJIL 300"),
fixedProduct(758, "PAPEL FAMADIS ALOE 3C 23.04M 6 ROLLOS"),
fixedProduct(759, "PAPEL FILMS MERCASUR 30 M"),
fixedProduct(761, "PAPEL PARAFINADO"),
fixedProduct(762, "PASARRATOS SUPER SENIOR XXL 10U"),
fixedProduct(764, "PASTA GALLO ESTRELLAS 250GR"),
fixedProduct(765, "PASTA GALLO FIDEUA 250 GR"),
fixedProduct(766, "PASTA GALLO HELICE C/VGET 250"),
fixedProduct(767, "PASTA GALLO LETRA 250GR"),
fixedProduct(768, "PASTA GALLO MACARR Nº6 500"),
fixedProduct(769, "PASTA GALLO SPAGHETTI 500"),
fixedProduct(770, "PASTA GALLO TALLARIN 250"),
fixedProduct(772, "PATATA 3/8 1 KG (MARQUISE)"),
fixedProduct(773, "PATATA BACALAO 180G"),
fixedProduct(778, "PATATAS AL AJILLO HISPALANA 140G"),
fixedProduct(779, "PATATAS GOURMET BABY 420GR"),
fixedProduct(781, "PATATAS LIGHT EL CARTUJANO"),
fixedProduct(782, "PATATAS QUESO HISPALANA 140G"),
fixedProduct(784, "PATATAS SABOR BACON HISPALANA 140G"),
fixedProduct(785, "PATATAS SABOR JAMON HISPALANA 140G"),
fixedProduct(786, "PATATAS TRADICIONAL 180G 1.5€"),
fixedProduct(787, "PATE LOURIÑO LATA 840 GR."),
fixedProduct(788, "PAÑUELOS RENOVA P-6"),
fixedProduct(789, "PAVO BRASEADO XJ 75 GR 1 E"),
fixedProduct(790, "PECHUGA PAVO BRASEADA CAMPOFRIO KG"),
fixedProduct(792, "PECHUGA POLLO EXTRAJUGOSA L/80"),
fixedProduct(793, "PEDRO XIMENEZ 3 PASAS"),
fixedProduct(794, "PEPINILLOS DELICIAS 360 GR"),
fixedProduct(797, "PEREJIL LA BARRACA BTE PEQUEÑO"),
fixedProduct(798, "PET 1/2 FANTA NARANJA"),
fixedProduct(799, "PET 1/2 L NESTEA"),
fixedProduct(800, "PET 1/2 L NESTEA MARACUYA"),
fixedProduct(801, "PET AQUARIUS BLANCO 500 ML"),
fixedProduct(802, "PET AQUARIUS NARANJA 500 ML"),
fixedProduct(803, "PET COCA COLA 500 ML."),
fixedProduct(804, "PET COCA COLA ZERO 500 ML."),
fixedProduct(805, "PIÑA JUGO EXT DIAMIR P3 227"),
fixedProduct(806, "PIMENTON DULCE 1/8 LA BARRACA-LATA-"),
fixedProduct(807, "PIMENTON PICANTE BARRACA"),
fixedProduct(808, "PIMIENTA NEGRA GRANO LA BARRACA BTE PEQUEÑO"),
fixedProduct(809, "PIMIENTA NEGRA MOLIDA \"LA BARRACA\""),
fixedProduct(810, "PIMIENTO MORRON EXTRA P-3"),
fixedProduct(811, "PIMIENTO PIQUILLO DIAMIR 185G"),
fixedProduct(812, "PIMIENTOS ASADOS 445GR. CRISTAL CAMPO RICO"),
fixedProduct(813, "P. INDIA-MINIATURA-"),
fixedProduct(814, "PINZA PLASTICO 24U"),
fixedProduct(815, "PISTOLA NUCA MAX 1L PERFUMADO EL MILAGRITO"),
fixedProduct(816, "PISTO ORLANDO LATA 410 GR"),
fixedProduct(817, "PIZZA ATUN-CEBOLLA S/TERIYAKI CAMPOF."),
fixedProduct(820, "PIZZA CARBONARA"),
fixedProduct(821, "PIZZA CARNE C/S BARBACOA CAMP."),
fixedProduct(827, "PLATO LLANO"),
fixedProduct(829, "PONCHE CABALLERO 1L"),
fixedProduct(830, "POPITAS MANTEQUILLA MICRO BORGES 100 MICRO"),
fixedProduct(831, "POPITAS UNIDAD BORGES 100 MICRO"),
fixedProduct(834, "PROTOS CRIANZA 201"),
fixedProduct(835, "P.TRAN (80004) 4 8X200"),
fixedProduct(836, "PUNTOMATIC COLOR TUBO 8 UND."),
fixedProduct(837, "PUNTOMATIC TUBO 4 DOSIS BLANCO"),
fixedProduct(838, "Q. APOLONIO ARTESANO CURADO"),
fixedProduct(839, "QUESO APOLONIO SEMI SIN LACTOSA KG"),
fixedProduct(840, "QUESO BARRA OLDENBURGER GOUDA,KG"),
fixedProduct(841, "QUESO BARUS GARCIA BAQUERO KG"),
fixedProduct(842, "QUESO CABRA L/80 G NAVIDUL 2€"),
fixedProduct(843, "QUESO CERDO PROLONGO,KG"),
fixedProduct(844, "QUESO CIGARRAL BARRA,KG"),
fixedProduct(845, "QUESO DON APOLONIO ACEITE KG"),
fixedProduct(846, "QUESO FRESCO 250GR LOS VAZQUEZ"),
fixedProduct(847, "QUESO G.BAQUERO CURADO,KG"),
fixedProduct(848, "QUESO G.BAQUERO SEMI,KG"),
fixedProduct(849, "QUESO KIKO PLUS JUN.30 UNID"),
fixedProduct(850, "QUESO LONCHA CASERIO 8/U"),
fixedProduct(851, "QUESO LONCHA TRANCHETE 7 131.25X9"),
fixedProduct(852, "QUESO OVEJA BOFFARD,KG"),
fixedProduct(853, "QUESO OVEJA GRAN RESERVA APOLONIO"),
fixedProduct(854, "QUESO PORCIONES CASERIO 8/U"),
fixedProduct(855, "QUESO ROQUEFORT 100 GR"),
fixedProduct(856, "QUESO ROQUEFORT,KG"),
fixedProduct(858, "QUESO TIERNO SIN LACT.110 GR.NAVID.2€"),
fixedProduct(859, "QUESO VIEJO MEZCLA LEVASA KG"),
fixedProduct(860, "QUITAMANCHAS ESPECIAL ROPA PULVERIZADOR KIRIKO"),
fixedProduct(862, "RALLADO GRATINAR HOCHLAND 100G"),
fixedProduct(863, "RALLADO OGGI FUNDIR PARA PASTA 200G"),
fixedProduct(864, "RALLADO VERDE PASTA HOCHLAND 50 G SEVILLANA"),
fixedProduct(865, "RAMON BILBAO CRIANZA 2013 75CL"),
fixedProduct(866, "RECAM MOPA PLA ATRAPAPOLVO 20 UN DESECH"),
fixedProduct(867, "RECOGEDOR C/MANGO"),
fixedProduct(872, "REMOLACHA CONSEMUR RALLADA TARRO S/370"),
fixedProduct(877, "RIOJA T BERONIA CRIANZA 3/4"),
fixedProduct(879, "ROLLO COCINA RENOVA PACK 2"),
fixedProduct(880, "ROLLO DE CARNE MECHADA KG CABO"),
fixedProduct(881, "ROLLOS PESOS 57 x 55"),
fixedProduct(882, "ROLLOS TPV 57 x 35"),
fixedProduct(883, "ROLLO TPV 80 x 80"),
fixedProduct(884, "ROMERO LA BARRACA"),
fixedProduct(885, "RON BACARDI 1L"),
fixedProduct(886, "RON BACARDI C/B MINIATURA"),
fixedProduct(888, "RON BARCELO-MINIATURA-"),
fixedProduct(889, "RON BRUGAL AÑEJO 0.70"),
fixedProduct(890, "RON LEGENDARIO ELIX 7 AÑOS 0.70"),
fixedProduct(891, "RON MIEL DORAMAS 70 CL."),
fixedProduct(892, "RON NEGRITA 1 L"),
fixedProduct(893, "RON NEGRITA 200 ML"),
fixedProduct(894, "RON NEGRITA DORADO 0.70"),
fixedProduct(895, "RON NEGRITA DORADO-MINIATURA-"),
fixedProduct(898, "SALAMI EXTRA TURON KG"),
fixedProduct(900, "SALCHICHAS CAMPESAN PACK 3 CAMPOF."),
fixedProduct(901, "SALCHICHAS FRANKFURT VACIO 1KG"),
fixedProduct(902, "SALCHICHAS JAMON CAMPOF.PACK 3"),
fixedProduct(903, "SALCHICHAS JUMBO CLASSIC OM 350G 14U"),
fixedProduct(904, "SALCHICHAS PAVO 6 UN.CAMPOF.140 GR"),
fixedProduct(905, "SALCHICHAS POLLO 6 UN.CAMPOF.140 G"),
fixedProduct(906, "SALCHICHAS POLLO MONTEALBOR 250 G"),
fixedProduct(907, "SALCHICHÓN TURON TUNEL PIMIENTA 1/2 PIEZA"),
fixedProduct(908, "SALCHICHON CULAR IBERICO 1ª,KG"),
fixedProduct(909, "SALCHICHON CUMBRE REAL CAMPOF."),
fixedProduct(910, "SALCHICHON IBERICO LONCHAS NAVIDUL 45GRS"),
fixedProduct(912, "SALCHICHON TUNEL PIMI.LONCHA 80GR PROLONGO"),
fixedProduct(913, "SALITO AZUL UNIDAD"),
fixedProduct(914, "SALITO ROJO UNIDAD"),
fixedProduct(915, "SALSA ALIOLI MONTEALBOR 180ML"),
fixedProduct(916, "SALSA BOLOÑESA GALLO FCO 230 GR"),
fixedProduct(917, "SALSA COCKTAIL YBARRA 250 GR"),
fixedProduct(918, "SALSA GAUCHA BOCABAJO 300ML"),
fixedProduct(919, "SALSA MOJO PICON CANARIO BOTE 180GR"),
fixedProduct(920, "SALSA VERDE 180GR MONTEALBOAR"),
fixedProduct(921, "SALSA WHISKY MONTEALBOR BOTE 180GRS"),
fixedProduct(922, "SALSA YBARRA ALI-OLI 225"),
fixedProduct(923, "SALSA YBARRA ALI-OLI BOTE"),
fixedProduct(924, "SALSA YBARRA COCKTAIL 450 ML."),
fixedProduct(925, "SALSA YBARRA GAUCHA 225 GR"),
fixedProduct(926, "SARDINAS ACEITE F.A 90G"),
fixedProduct(927, "SARDINAS TOMATE F.A 90G"),
fixedProduct(928, "SAZONADOR CARNE LA BARRACA PEQUEÑOS"),
fixedProduct(929, "SAZONADOR DE CARACOLES LA BARRACA"),
fixedProduct(930, "SAZONADOR POLLO LA BARRACA BOTE"),
fixedProduct(931, "SERVILLETA CELIA 30X30 MORADA"),
fixedProduct(933, "SEVEN-UP LATA"),
fixedProduct(934, "SIMON LIFE 33CL NARANJA (12738)"),
fixedProduct(936, "SIMON LIFE MANDARINA P-4 (4314)"),
fixedProduct(937, "SIMON LIFE NARANJA P-4 (4313)"),
fixedProduct(938, "SIN SAL PIPAS (SEVILLANAS)"),
fixedProduct(939, "SOPA G BCA 24 SB AVE C/ARROZ"),
fixedProduct(940, "SOPA G.BLANCA POLLO-FID.FINOS 18SOB."),
fixedProduct(941, "SOPA G.BLANCA TERNERA-ESTRELLA 24S"),
fixedProduct(942, "SOPA G.BLANCA VERDURAS 24 S"),
fixedProduct(943, "SOPA STANDAR AVE CON FIDEOS"),
fixedProduct(944, "SPAGUETTI GALLO 250 GR"),
fixedProduct(945, "SPIDERS 70G"),
fixedProduct(946, "SUAV FLOR 2.2L 44D AZUL"),
fixedProduct(947, "SUAVIZANTE KIRIKO AZUL 2L"),
fixedProduct(948, "SUAVIZANTE SPA 2L KIRIKO"),
fixedProduct(949, "SUAVIZANTE TALCO 2L KIRIKO"),
fixedProduct(950, "SUAV SAN 1.29L CELESTE"),
fixedProduct(951, "SUAV SAN 1.29L ESENCIAS PARA RECORDAR"),
fixedProduct(952, "SUAV SAN 1.29L TALCO ROSA"),
fixedProduct(953, "SUAV SAN 1.5L AZUL (FLORAL)"),
fixedProduct(954, "SUNNY 330 CL FLORIDA P-12"),
fixedProduct(955, "SUNNY DELIGHT FLORIDA 1.25 L"),
fixedProduct(956, "TAPADERA POREX 7 OZ B/100 U."),
fixedProduct(958, "TEJITAS FAMI RISI 8U"),
fixedProduct(959, "TE LA BARRACA 10U."),
fixedProduct(960, "TIBURON GALLO N 0 250 GR"),
fixedProduct(961, "TILA BARRACA 10U."),
fixedProduct(962, "TINTO MISIVA RIBERA DUERO 2023"),
fixedProduct(963, "TINTO RIOJA M CACERES3/4 CRIANZA"),
fixedProduct(965, "TOALLITA DODOT BASICO REC. 54U"),
fixedProduct(967, "TOMATE ENTERO MARTINETE 400"),
fixedProduct(968, "TOMATE ENTERO MARTINETE 810"),
fixedProduct(969, "TOMATE FRITO FRUCO/APIS"),
fixedProduct(976, "TOMATE TRITURADO APIS 800"),
fixedProduct(978, "TOMILLO LA BARRACA"),
fixedProduct(979, "TORTAS ACEITE I ROSALES 4UN C/10"),
fixedProduct(980, "TOSTAITOS SEVILLANAS 100 G X 10"),
fixedProduct(981, "TOTAS JAMON ONDULADAS 100G"),
fixedProduct(982, "TOTAS QUESO CABRA Y CEBOLLA 100G"),
fixedProduct(983, "TOTAS QUESO CURADO 100G"),
fixedProduct(984, "TOTAS SABOR FUET 100G"),
fixedProduct(985, "TRIKERS 100G DORITOS"),
fixedProduct(986, "TRISKYS FAM 16U"),
fixedProduct(988, "VALTORRE 5 L UNIDAD"),
fixedProduct(989, "VASO 200 C 50UNI"),
fixedProduct(991, "VASO DE TUBO IRROMPIBLE"),
fixedProduct(992, "VASO MACETA"),
fixedProduct(993, "VASO POREX 7 OZ 200CC B/50"),
fixedProduct(996, "VIENA GRANDE ( 45 UNIDADES )"),
fixedProduct(997, "VINAGRE FLOR DEL CONDADO 1/2 L"),
fixedProduct(998, "VINAGRE FLOR DEL CONDADO 1 L."),
fixedProduct(999, "VINAGRE GOURMET JEREZ BOT 250ML"),
fixedProduct(1000, "VINAGRE GOURMET MANZANA 1 L"),
fixedProduct(1001, "VINAGRE GOURMET MODENA BOT 250 ML"),
fixedProduct(1002, "VINAGRE LIMPIEZA KIRIKO 1L"),
fixedProduct(1003, "VINAGRE MANZANA PRIMA 3/4"),
fixedProduct(1004, "VINAGRE YBARRA 1/2 L."),
fixedProduct(1005, "VINAGRE YBARRA 1 L."),
fixedProduct(1006, "VINO B CASTILLO S DIEGO 3/4"),
fixedProduct(1008, "VINO BLANCO ELEGIDO 1L"),
fixedProduct(1010, "VINO CANASTA CREAM 75 CL"),
fixedProduct(1011, "VINO COCINA EL GUISO 0.70 C."),
fixedProduct(1013, "VINO SOLERA 1847 3/4"),
fixedProduct(1015, "VINO TINTO D.O RIOJA CAMPOVIEJO 70C"),
fixedProduct(1016, "VINO TINTO ELEGIDO 1L"),
fixedProduct(1017, "VINO TINTO EMILIO MORO 2022 75CL"),
fixedProduct(1018, "VINO TINTO PROTOS COSECHA 3/4"),
fixedProduct(1019, "VINO TINTO SOLDEPEÑAS 1 L."),
fixedProduct(1021, "VINO VERDEJO BELAROSSA 75 CL"),
fixedProduct(1022, "VIVO GATO BOCADITO POLLO LT 415G"),
fixedProduct(1023, "VIVO GATO BUEY 415G"),
fixedProduct(1024, "VIVO PERRO POLLO LT 830"),
fixedProduct(1025, "VODKA ABSOLUT 70 CL"),
fixedProduct(1026, "VODKA CARAMELO GECKO 0.70 L 30º"),
fixedProduct(1027, "VODKA CIROC APLLE 0.7"),
fixedProduct(1028, "VODKA ERISTOFF 70CL"),
fixedProduct(1029, "VVH VODK CARAMEL RIVES 70CL"),
fixedProduct(1030, "WALKER 200 ML ( PETACA )"),
fixedProduct(1031, "WALKER BLACK LABEL 70 CL"),
fixedProduct(1032, "WALKER NEGRO 1L"),
fixedProduct(1033, "WALKER ROJO 1L"),
fixedProduct(1035, "WHISKY CHIVAS REGAL 0.70"),
fixedProduct(1036, "WHISKY DYC 5 AÑOS 70 CL"),
fixedProduct(1037, "WHISKY JACK DANIEL 200 ML ( PETACA )"),
fixedProduct(1038, "WHISKY JACK DANIELS 3/4"),
fixedProduct(1039, "WHISKY JACK DANIELS MINIATURA"),
fixedProduct(1040, "WHISKY J&B 200 ML ( PETACA )"),
fixedProduct(1041, "WHISKY J.B. MINIATURA"),
fixedProduct(1044, "YOGO ICE 10UDS"),
fixedProduct(1045, "ZAMBA FRUTAS SURTIDAS P10"),
fixedProduct(1046, "ZANAHORIA GOURMET TIRAS 180 GR"),
fixedProduct(1052, "ZUMO DON SIMON NARANJA 200 P-6 (3039)"),
fixedProduct(1055, "ZUMO JUVER PIÑA 850ML"),
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

  const [quantities, setQuantities] = useState({});
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);

  const filteredDepartments = useMemo(() => {
    const cleanSearch = search.trim();

    const visibleDepartments = departments
      .map((department) => ({
        ...department,
        products: cleanSearch
          ? department.products.filter((product) =>
              productMatchesSearch(product.name, cleanSearch)
            )
          : department.products,
      }))
      .filter((department) => department.products.length > 0);

    if (!cleanSearch) return visibleDepartments;

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
  }, [search]);

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

  const clearOrder = () => {
    setQuantities({});
    setCustomerName("");
    setNotes("");
    setSearch("");
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
        <header style={styles.header}>
          <div style={styles.iconBox}>
            <ShoppingCart size={28} />
          </div>

          <div>
            <h1 style={styles.title}>Pedido online Cash Lojo</h1>
            <p style={styles.subtitle}>
              Escribe cantidades en Unidades o Cajas y envía el pedido por WhatsApp.
            </p>
          </div>
        </header>

        <div style={styles.cardSticky}>
          <label style={styles.label}>Nombre o referencia del cliente</label>
          <input
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Opcional"
            style={styles.input}
          />

          <label style={styles.label}>Buscar artículo</label>
          <div style={styles.searchAndSendRow}>
            <div style={styles.searchBoxCompact}>
              <Search size={20} style={styles.searchIcon} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar..."
                style={styles.searchInput}
              />
            </div>

            <button onClick={sendOrder} style={styles.stickyWhatsappButton}>
              <Send size={18} /> WhatsApp
            </button>
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
                            updateQuantity(productId, "cajas", event.target.value)
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
            <strong>Resumen:</strong> {selectedItems.length} artículos con cantidad.
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
    scrollMarginTop: "180px",
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
