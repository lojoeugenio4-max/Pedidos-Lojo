export function crearPremiosConNoPremio(premios = []) {
  const premiosReales = premios.filter((premio) => premio.activo);

  const totalPremios = premiosReales.reduce(
    (total, premio) => total + Number(premio.probabilidad || 0),
    0
  );

  const restante = Math.max(0, 100 - totalPremios);

  if (restante <= 0) {
    return premiosReales;
  }

  return [
    ...premiosReales,
    {
      id: "no-premio-automatico",
      nombre: "Suerte la próxima vez",
      color: "#64748b",
      probabilidad: restante,
      stock: null,
      activo: true,
      esNoPremio: true,
    },
  ];
}

export function filtrarPremiosDisponibles(premios = []) {
  return premios.filter((premio) => {
    if (!premio.activo) return false;

    if (premio.esNoPremio) return true;

    if (premio.stock === null || premio.stock === undefined) return true;

    return Number(premio.stock) > 0;
  });
}

export function calcularTotalProbabilidad(premios = []) {
  return premios.reduce(
    (total, premio) => total + Number(premio.probabilidad || 0),
    0
  );
}

export function elegirPremio(premios = []) {
  const disponibles = filtrarPremiosDisponibles(premios);

  if (!disponibles.length) return null;

  const total = calcularTotalProbabilidad(disponibles);

  if (total <= 0) {
    return disponibles[Math.floor(Math.random() * disponibles.length)];
  }

  const numero = Math.random() * total;

  let acumulado = 0;

  for (const premio of disponibles) {
    acumulado += Number(premio.probabilidad || 0);

    if (numero <= acumulado) {
      return premio;
    }
  }

  return disponibles[disponibles.length - 1];
}

export function calcularIndicePremio(premios = [], premioGanador) {
  return premios.findIndex((premio) => premio.id === premioGanador.id);
}

export function calcularRotacionDestino({
  rotacionActual,
  indiceGanador,
  totalPremios,
}) {
  const gradosSector = 360 / totalPremios;
  const centroSector = indiceGanador * gradosSector + gradosSector / 2;

  // Rotación actual normalizada (0-360)
  const rotacionNormalizada = ((rotacionActual % 360) + 360) % 360;

  // Número de vueltas completas antes de llegar al premio
  const vueltasExtra = 26;

  return (
    rotacionActual -
    rotacionNormalizada +
    vueltasExtra * 360 +
    (360 - centroSector)
  );
}

export async function descontarStock(supabase, premio) {
  if (premio.esNoPremio) return;

  if (premio.stock === null || premio.stock === undefined) return;

  if (Number(premio.stock) <= 0) return;

  await supabase
    .from("promociones_ruleta_premios")
    .update({
      stock: Number(premio.stock) - 1,
    })
    .eq("id", premio.id);
}
