function normalizarRespuestaJuego(raw) {
  let value = Array.isArray(raw) ? raw[0] : raw;
  const claves = ["result", "resultado", "data", "bingo_result", "order_result", "entitlement"];
  for (let i = 0; i < 4 && value && typeof value === "object"; i += 1) {
    const key = claves.find((candidate) => value[candidate] && typeof value[candidate] === "object");
    if (!key) break;
    value = Array.isArray(value[key]) ? value[key][0] : value[key];
  }
  return value;
}

function construirUrlQr(codigoParticipacion) {
  if (!codigoParticipacion) return "";

  // Antes el QR llevaba solo el código corto (p. ej. "LJK6TU4P") y lo leía
  // cualquier lector sin problema. En algún momento se cambió para meter
  // ahí dentro la URL completa de la tienda con el código como parámetro
  // (algo como "https://.../?store=1&code=LJ-8380-B1AC"), que son muchos
  // más caracteres. Un QR con más contenido necesita una versión más densa
  // (más celdas, más pequeñas), y eso es lo que muchos lectores de caja no
  // consiguen resolver bien, aunque un móvil con buena cámara sí pueda.
  // El código de caja (StorePage) ya sabe leer tanto una URL como el
  // código suelto, así que no hace falta meter la URL en el QR: basta con
  // el código, igual que antes.
  const params = new URLSearchParams({
    size: "400",
    // Un margen de 2 módulos es más "bonito" pero no deja suficiente zona
    // de silencio alrededor del QR. La mayoría de lectores físicos de caja
    // (láser/CCD) son mucho más estrictos que la cámara de un móvil y
    // necesitan el margen mínimo estándar de 4 módulos para reconocer el
    // código; con margin=2 el QR se veía bien pero muchos escáneres no
    // lograban decodificarlo. Con la app se podía leer manualmente el
    // código porque no depende de escanear la imagen.
    margin: "4",
    // Nivel de corrección de errores más alto para que el QR siga siendo
    // legible aunque la pantalla del móvil tenga brillo bajo, esté algo
    // borroso o el escáner capture el código en un ángulo poco favorable.
    ecLevel: "M",
    text: codigoParticipacion,
  });

  return `https://quickchart.io/qr?${params.toString()}`;
}

// WhatsApp no permite poner color de fondo ni de letra en un mensaje de
// texto normal (solo negrita/cursiva/tachado). Para simular el aviso en
// "rojo y amarillo" que pidió el cliente, se usa una franja de emojis
// 🔴🟡 a modo de banda de color arriba y abajo del bloque de participación,
// además de negrita y mayúsculas, para que destaque igual aunque no haya
// color real disponible en el texto.
const FRANJA_DESTACADO = "🔴🟡🔴🟡🔴🟡🔴🟡🔴🟡🔴🟡";

function construirBloqueParticipacion({
  participacionRuleta,
  codigoParticipacion,
  tiradasRuleta,
  participacionJuegos,
  participacionBingo,
  premio,
}) {
  const lines = [];

  const participacionJuegosNormalizada = normalizarRespuestaJuego(participacionJuegos);
  const participacionBingoNormalizada = normalizarRespuestaJuego(participacionBingo);

  const codigoJuegos =
    participacionJuegosNormalizada?.code ||
    participacionJuegosNormalizada?.codigo ||
    codigoParticipacion ||
    participacionRuleta?.code ||
    participacionRuleta?.codigo ||
    null;

  const cumpleVariedadBingo = Boolean(
    participacionBingoNormalizada?.qualified ??
      participacionBingoNormalizada?.clasificado ??
      participacionBingoNormalizada?.eligible ??
      participacionBingoNormalizada?.cumple ??
      participacionBingoNormalizada?.bingo_eligible
  );

  // El pedido puede cumplir la variedad mínima y aun así no recibir Bingo
  // de verdad, si el cliente ya lo consiguió hoy con otro pedido (regla de
  // "1 pedido de Bingo al día"). bingo_eligible es el estado que de verdad
  // quedó guardado tras esa comprobación; sin él, el mensaje podía decir
  // "tienes bolas" aunque ese pedido en concreto no tuviera ninguna.
  const bingoConcedido = Boolean(participacionJuegosNormalizada?.bingo_eligible);
  const bingoConseguido = cumpleVariedadBingo && bingoConcedido;
  const bingoBloqueadoPorLimiteDiario = cumpleVariedadBingo && !bingoConcedido;

  if (codigoJuegos) {
    const urlQr = construirUrlQr(codigoJuegos);

    const numeroTiradas = participacionRuleta
      ? Math.max(
          1,
          Number(
            tiradasRuleta ||
              participacionRuleta?.tiradas_ruleta ||
              participacionRuleta?.tiradas_totales ||
              participacionRuleta?.spins_total ||
              1
          )
        )
      : Math.max(0, Number(tiradasRuleta || 0));

    const numeroBolasBingo = Math.max(
      1,
      Number(
        participacionJuegosNormalizada?.bingo_plays_total ??
          participacionJuegosNormalizada?.bingoPlaysTotal ??
          1
      )
    );

    lines.push(FRANJA_DESTACADO);
    lines.push("🎉 *¡TIENES PARTICIPACIÓN EN RULETA/BINGO!* 🎉");
    if (numeroTiradas > 0) lines.push(`🎡 Ruleta: *${numeroTiradas} tirada${numeroTiradas === 1 ? "" : "s"}*`);
    if (bingoConseguido) {
      lines.push(
        `🟠 Bingo: *${numeroBolasBingo} ${numeroBolasBingo === 1 ? "bola disponible" : "bolas disponibles"}*`
      );
    } else if (bingoBloqueadoPorLimiteDiario) {
      lines.push("🟠 Bingo: ya conseguido hoy con otro pedido, este no suma más.");
    }
    lines.push("");
    lines.push("📷 *Muestra este QR en caja:*");
    lines.push(urlQr);
    lines.push(`Código manual (si falla el escáner): *${codigoJuegos}*`);
    lines.push(FRANJA_DESTACADO);
    lines.push("");
    return lines;
  }

  if (bingoConseguido) {
    lines.push(FRANJA_DESTACADO);
    lines.push("🟠 *PARTICIPACIÓN DE BINGO CONSEGUIDA*");
    lines.push("No se pudo generar el código. Contacta con Cash Lojo antes de presentar el pedido en caja.");
    lines.push(FRANJA_DESTACADO);
    lines.push("");
    return lines;
  }

  if (premio) {
    lines.push(FRANJA_DESTACADO);
    lines.push("🎁 *PREMIO RULETA:*");
    lines.push(`*${premio.nombre}*`);
    if (premio.codigo) {
      lines.push(`Código: ${premio.codigo}`);
    }
    lines.push(FRANJA_DESTACADO);
    lines.push("");
    return lines;
  }

  return lines;
}

export function construirTextoPedidoWhatsApp({
  t,
  itemsPedido,
  customerNamePedido,
  notesPedido,
  premio = null,
  participacionRuleta = null,
  codigoParticipacion = null,
  tiradasRuleta = 0,
  participacionBingo = null,
  participacionJuegos = null,
}) {
  const lines = [];

  // El bloque de participación (QR/Bingo/Ruleta) va primero y bien
  // destacado, para que no pase desapercibido entre el resto del texto.
  // Debajo va el pedido, igual que hasta ahora.
  lines.push(
    ...construirBloqueParticipacion({
      participacionRuleta,
      codigoParticipacion,
      tiradasRuleta,
      participacionJuegos,
      participacionBingo,
      premio,
    })
  );

  lines.push(`*${t.orderSummary}*`);
  lines.push("");

  if (customerNamePedido) {
    lines.push(`*${t.customer}:* ${customerNamePedido}`);
    lines.push("");
  }

  const itemsOrdenados = [...itemsPedido].sort((a, b) => {
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

    lines.push(String(product.name || "").trim());

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

  if (notesPedido) {
    lines.push(`*${t.notes}:* ${notesPedido}`);
    lines.push("");
  }

  lines.push(t.sentFrom);

  return lines.join("\n");
}

export function abrirPedidoEnWhatsApp({ whatsappNumber, texto }) {
  const message = encodeURIComponent(texto);
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;

  window.location.assign(whatsappUrl);
}
