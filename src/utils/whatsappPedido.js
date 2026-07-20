function construirUrlQr(codigoParticipacion) {
  if (!codigoParticipacion) return "";

  const baseUrl = String(import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin);
  const urlParticipacion = new URL(baseUrl);
  urlParticipacion.searchParams.set("store", "1");
  urlParticipacion.searchParams.set("code", codigoParticipacion);

  const params = new URLSearchParams({
    size: "360",
    margin: "2",
    text: urlParticipacion.toString(),
  });

  return `https://quickchart.io/qr?${params.toString()}`;
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

  const codigoJuegos =
    participacionJuegos?.code ||
    participacionJuegos?.codigo ||
    codigoParticipacion ||
    participacionRuleta?.code ||
    participacionRuleta?.codigo ||
    null;

  const bingoConseguido = Boolean(
    participacionBingo?.qualified ?? participacionBingo?.clasificado ?? participacionBingo?.eligible
  );

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

    lines.push("🎁 *PARTICIPACIÓN CONSEGUIDA*");
    lines.push("");
    if (numeroTiradas > 0) lines.push(`🎡 Ruleta: *${numeroTiradas} tirada${numeroTiradas === 1 ? "" : "s"}*`);
    if (bingoConseguido) lines.push("🎱 Bingo: *1 bola disponible* (máximo una al día)");
    lines.push(`Código manual: *${codigoJuegos}*`);
    lines.push("");

    if (urlQr) {
      lines.push("📷 *QR para presentar en caja:*");
      lines.push(urlQr);
      lines.push("");
    }

    lines.push("Presenta este QR o el código manual en caja.");
    lines.push("En caja aparecerán los juegos disponibles para este pedido.");
    lines.push("");
  } else if (bingoConseguido) {
    lines.push("🎱 *PARTICIPACIÓN DE BINGO CONSEGUIDA*");
    lines.push("");
    lines.push("Tu pedido cumple las condiciones del Bingo, pero no se pudo generar el código común.");
    lines.push("Contacta con Cash Lojo antes de presentar el pedido en caja.");
    lines.push("");
  } else if (premio) {
    lines.push("🎁 *PREMIO RULETA:*");
    lines.push(`*${premio.nombre}*`);

    if (premio.codigo) {
      lines.push(`Código: ${premio.codigo}`);
    }

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
