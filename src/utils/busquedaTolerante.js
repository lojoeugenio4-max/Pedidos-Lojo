// Búsqueda tolerante del catálogo.
//
// Antes, cada palabra buscada tenía que aparecer TAL CUAL en el código o el
// nombre del artículo. Ahora la búsqueda entiende:
//   - Palabras juntas o separadas: "cocacola" encuentra "COCA COLA".
//   - Plurales: "cervezas" encuentra "CERVEZA ...".
//   - Pequeñas faltas de ortografía: "cruscampo", "fnata", "heiniken".
//   - Abreviaturas de los nombres: "sin alcohol" ↔ "S/A", "sin gas" ↔ "S/G",
//     "sin cafeína" ↔ "S/CAF", "garrafa" ↔ "GFA", "tinto de verano" ↔ "T. VERANO".
//   - Medidas dichas o escritas de muchas formas: "2 litros" / "2 l" → "2L",
//     "litro y medio" / "1,5 litros" → "1.5L", "medio litro" → "0.5L",
//     "33 centilitros" → "33CL", "tercio" → "33CL".
//   - Sinónimos: "birra" → cerveza, "cero" → zero, "7up" → seven up…
//   - El nombre del departamento: "cerveza heineken" encuentra "HEINEKEN
//     LATA 33CL" porque está en el departamento CERVEZAS.
//   - Pronunciación con acento (clientes chinos sobre todo): se tratan
//     como iguales los sonidos que se confunden: R/L/N ("cluzcampo",
//     "fanta lalanja"), B/P/V, D/T, G/K/C/Q, Z/S/C suave, J/G suave, LL/Y,
//     la H y la S final ("cocacolas"). Solo se usa si la palabra no se ha
//     encontrado de otra forma.
//   - Frases dictadas por voz: "ponme dos cajas de cruzcampo" busca
//     "cruzcampo" (se ignoran cantidades y palabras de relleno).
//
// Para no llenar los resultados de "ruido", la tolerancia es escalonada POR
// PALABRA: si una palabra existe tal cual en algún artículo, se busca tal
// cual (como siempre). Solo si no existe en ningún artículo se prueba en
// plural/singular y, si tampoco, con faltas de ortografía. Y si una palabra
// no se parece a nada del catálogo, se ignora en vez de dejar la búsqueda
// vacía.

function quitarTildes(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const NUMEROS_EN_LETRA = {
  un: "1",
  una: "1",
  uno: "1",
  dos: "2",
  tres: "3",
  cuatro: "4",
  cinco: "5",
  seis: "6",
  siete: "7",
  ocho: "8",
  nueve: "9",
  diez: "10",
  once: "11",
  doce: "12",
  quince: "15",
  veinte: "20",
  veinticuatro: "24",
  treinta: "30",
  cincuenta: "50",
  cien: "100",
};

const PALABRAS_DE_UNIDAD =
  "litros?|lts?|l|centilitros?|cl|mililitros?|ml|kilos?|kilogramos?|kgs?|gramos?|grs?|g|cajas?|unidades?|paquetes?|packs?|botellas?";

// Convierte el texto (del artículo o de la búsqueda) a una forma "canónica"
// en la que las distintas maneras de decir lo mismo quedan iguales.
function canonizar(textoOriginal) {
  let texto = ` ${quitarTildes(textoOriginal)} `;

  // Decimales con coma: 1,5 → 1.5
  texto = texto.replace(/(\d),(\d)/g, "$1.$2");

  // Números en letra delante de una medida o de "cajas": "dos litros" → "2 litros"
  texto = texto.replace(
    new RegExp(`\\b(${Object.keys(NUMEROS_EN_LETRA).join("|")})\\s+(?=(${PALABRAS_DE_UNIDAD})\\b)`, "g"),
    (_, numero) => `${NUMEROS_EN_LETRA[numero]} `
  );

  // Medidas habladas
  texto = texto.replace(/\b(1\s+|un\s+|uno\s+)?litro\s+y\s+medio\b/g, " 1.5l ");
  texto = texto.replace(/\bmedio\s+litro\b/g, " 0.5l ");
  texto = texto.replace(/\btercios?\b/g, " 33cl ");

  // Unidades pegadas al número: "2 litros" / "2 l" / "2lts" → "2l"
  texto = texto.replace(/(\d+(?:\.\d+)?)\s*(litros?|lts?|l)\b/g, "$1l");
  texto = texto.replace(/(\d+(?:\.\d+)?)\s*(centilitros?|cl)\b/g, "$1cl");
  texto = texto.replace(/(\d+(?:\.\d+)?)\s*(mililitros?|ml)\b/g, "$1ml");
  texto = texto.replace(/(\d+(?:\.\d+)?)\s*(kilogramos?|kilos?|kgs?)\b/g, "$1kg");
  texto = texto.replace(/(\d+(?:\.\d+)?)\s*(gramos?|grs?|g)\b/g, "$1g");

  // Abreviaturas de los nombres de artículos
  texto = texto.replace(/\bs\s*\/\s*a\b|\bsin\s+alcohol\b/g, " sinalcohol ");
  texto = texto.replace(/\bs\s*\/\s*g\b|\bsin\s+gas\b/g, " singas ");
  texto = texto.replace(/\bc\s*\/\s*g\b|\bcon\s+gas\b/g, " congas ");
  texto = texto.replace(/\bs\s*\/\s*caf(eina)?\b|\bsin\s+cafeina\b/g, " sincafeina ");
  texto = texto.replace(/\bs\s*\/\s*azucar\b|\bsin\s+azucar\b/g, " sinazucar ");
  texto = texto.replace(/\bt\.\s*verano\b|\btinto\s+(de\s+)?verano\b/g, " tinto verano ");

  return texto.replace(/\s+/g, " ").trim();
}

function compactar(texto) {
  return String(texto ?? "").replace(/[^a-z0-9ñ]/g, "");
}

function partirEnPalabras(texto) {
  return String(texto ?? "")
    .split(/[^a-z0-9ñ.]+/)
    .map((palabra) => palabra.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
}

// Palabras que no ayudan a encontrar un artículo (sobre todo al dictar).
const PALABRAS_VACIAS = new Set([
  "de", "del", "la", "el", "los", "las", "lo", "y", "e", "o", "a", "al", "en",
  "con", "por", "para", "un", "una", "unos", "unas", "me", "mi", "que",
  "favor", "porfa", "porfavor", "quiero", "queria", "ponme", "pon", "pongame",
  "dame", "deme", "necesito", "mas", "tambien", "otra", "otro", "otras", "otros",
  "hola", "buenas", "gracias", "vale",
]);

// Palabras de cantidad que se ignoran cuando van detrás de un número:
// "2 cajas de cruzcampo" → "cruzcampo".
const CANTIDAD_DELANTE = /\b\d+\s+(cajas?|unidades?|paquetes?|packs?|botellas?)\b/g;

const SINONIMOS = {
  birra: ["cerveza"],
  birras: ["cerveza"],
  cerve: ["cerveza"],
  cero: ["zero", "0.0"],
  zero: ["cero"],
  "7up": ["seven up", "sevenup"],
  sevenup: ["seven up"],
  garrafa: ["gfa"],
  garrafas: ["gfa", "garrafa"],
  gfa: ["garrafa"],
  cocacola: ["coca cola"],
  coke: ["coca cola"],
  pepsicola: ["pepsi"],
  fantas: ["fanta"],
  refresco: ["refrescos"],
  botellin: ["botellines"],
  tercio: ["33cl"],
  whiskey: ["whisky"],
  wisky: ["whisky"],
  guisqui: ["whisky"],
  jb: ["j&b"],
  energetica: ["energeticas", "energy"],
  energeticas: ["energetica", "energy"],
};

// Distancia entre dos palabras (letras cambiadas, de más, de menos o dos
// letras seguidas intercambiadas). Se corta en cuanto supera el máximo.
function distancia(a, b, maximo) {
  if (Math.abs(a.length - b.length) > maximo) return maximo + 1;
  const filas = [];
  for (let i = 0; i <= a.length; i += 1) {
    filas.push(new Array(b.length + 1).fill(0));
    filas[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) filas[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    let minimoFila = Infinity;
    for (let j = 1; j <= b.length; j += 1) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      let valor = Math.min(
        filas[i - 1][j] + 1,
        filas[i][j - 1] + 1,
        filas[i - 1][j - 1] + coste
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        valor = Math.min(valor, filas[i - 2][j - 2] + 1);
      }
      filas[i][j] = valor;
      if (valor < minimoFila) minimoFila = valor;
    }
    if (minimoFila > maximo) return maximo + 1;
  }
  return filas[a.length][b.length];
}


// Clave fonética: dos palabras que "suenan parecido" para alguien que
// confunde R/L/N, B/P/V, D/T, G/K, etc. quedan con la misma clave.
// Ej.: "cruzcampo" y "cluzcampo" → "glusgabo"; "naranja" y "lalanja" →
// "lalaja"… Solo se aplica a palabras de letras (no a medidas ni códigos).
export function claveFonetica(palabra) {
  let w = String(palabra || "").toLowerCase();
  if (!/^[a-zñ]+$/.test(w)) return "";
  w = w
    .replace(/ñ/g, "n")
    .replace(/ch/g, "x")
    .replace(/ll/g, "y")
    .replace(/qu/g, "k")
    .replace(/gu(?=[ei])/g, "g")
    .replace(/c(?=[ei])/g, "s")
    .replace(/g(?=[ei])/g, "j")
    .replace(/c/g, "k")
    .replace(/z/g, "s")
    .replace(/h/g, "")
    .replace(/w/g, "u")
    .replace(/y$/g, "i")
    // Sonidos que se confunden con acento chino
    .replace(/[rln]/g, "l") // R / L / N
    .replace(/[pv]/g, "b") // B / P / V
    .replace(/t/g, "d") // D / T
    .replace(/k/g, "g") // G / K / C / Q
    .replace(/(.)\1+/g, "$1") // letras repetidas: rr, ll, cc…
    .replace(/(.)s$/, "$1") // s final (se suele perder o añadir)
    .replace(/(?<=[aeiou])l(?=[bdgjfms])/g, "") // "campo" ≈ "capo", "fanta" ≈ "fata"
    .replace(/(.)\1+/g, "$1");
  return w;
}

function faltasPermitidas(palabra) {
  if (!/^[a-zñ]+$/.test(palabra)) return 0; // números y medidas: exactos
  if (palabra.length >= 8) return 2;
  if (palabra.length >= 4) return 1;
  return 0;
}

/**
 * Prepara (una vez por catálogo) el texto de búsqueda de cada artículo.
 * Devuelve un Map id → datos de búsqueda del artículo.
 */
export function crearIndiceBusqueda(productos = []) {
  const indice = new Map();
  productos.forEach((producto) => indice.set(String(producto.id), entradaDeProducto(producto)));
  return indice;
}

function entradaDeProducto(producto) {
  // Código, nombre y texto de oferta del artículo.
  const propio = [producto.codigo, producto.nombre || producto.name, producto.offerText]
    .filter(Boolean)
    .join(" ");
  // El departamento solo ayuda con palabras ("cerveza heineken"), nunca
  // con medidas: si no, "1.5L" encontraría todo REFRESCOS 2L / 1.5L.
  const departamento = producto.department || producto.departamento || "";

  const canonicoPropio = canonizar(propio);
  const textoPropio = `${quitarTildes(propio)} ${canonicoPropio}`;
  const textoDepartamento = `${quitarTildes(departamento)} ${canonizar(departamento)}`;
  const texto = `${textoPropio} ${textoDepartamento}`;

  const palabras = new Set(partirEnPalabras(texto));
  // Pares de palabras seguidas juntas ("coca"+"cola" → "cocacola") para
  // que las faltas en palabras escritas juntas también se encuentren.
  const lista = partirEnPalabras(canonicoPropio);
  for (let i = 0; i < lista.length - 1; i += 1) palabras.add(lista[i] + lista[i + 1]);

  // "Colas" de texto compacto que empiezan en cada palabra: sirven para
  // encontrar palabras escritas juntas ("cocacola") sin que salgan
  // coincidencias a mitad de palabra ("cola" dentro de "COCO LATA").
  const listaTexto = partirEnPalabras(texto);
  const iniciosCompactos = listaTexto.map((_, i) => compactar(listaTexto.slice(i).join("")));

  const claves = [...new Set([...palabras].map(claveFonetica).filter((c) => c.length >= 3))];

  return {
    textoPropio,
    iniciosCompactos,
    claves,
    palabrasPropias: new Set(partirEnPalabras(textoPropio)),
    texto,
    palabras: [...palabras],
  };
}

function coincideTalCual(alternativa, entrada) {
  // Medidas y números con decimales ("2l", "1.5l", "33cl", "0.0"): tienen
  // que coincidir como palabra completa del artículo ("5l" no es "1.5l").
  if (/\d/.test(alternativa) && /[^\d]/.test(alternativa) && !/\s/.test(alternativa)) {
    if (entrada.palabrasPropias.has(alternativa)) return true;
    // Número con decimales sin unidad ("1.5", "0.0"): vale "1.5l", "0.0"…
    if (/^[\d.]+$/.test(alternativa)) {
      for (const palabra of entrada.palabrasPropias) {
        if (palabra.startsWith(alternativa) && /^[a-z]*$/.test(palabra.slice(alternativa.length))) {
          return true;
        }
      }
    }
    return false;
  }
  // Solo números (códigos o "2"): como siempre, dentro del código/nombre.
  if (/^\d+$/.test(alternativa)) {
    return entrada.textoPropio.includes(alternativa);
  }
  if (entrada.texto.includes(alternativa)) return true;
  const compacta = compactar(alternativa);
  return (
    compacta.length >= 3 &&
    entrada.iniciosCompactos.some((inicio) => inicio.startsWith(compacta))
  );
}

function formasSingularPlural(palabra) {
  const formas = [];
  if (palabra.length > 4 && palabra.endsWith("es")) formas.push(palabra.slice(0, -2));
  if (palabra.length > 3 && palabra.endsWith("s")) formas.push(palabra.slice(0, -1));
  if (/^[a-zñ]+$/.test(palabra) && !palabra.endsWith("s")) formas.push(`${palabra}s`);
  return formas;
}

// Nombres de marca que el dictado por voz parte en varias palabras
// normales: "Yatekomo" llega como "ya te como", "Nocilla" como "no cilla"…
// Por separado esas palabras no sirven ("ya" y "te" se descartan por cortas
// y "como" acaba encontrando "COCO"). Aquí se prueba a juntar 2, 3 o 4
// palabras seguidas de lo buscado: si la palabra unida existe en el
// catálogo (tal cual, con una pequeña falta o porque suena igual), se
// busca unida. Solo se juntan grupos en los que alguna palabra es corta,
// ("ya", "te") o no existe en ningún artículo, para no tocar búsquedas que
// ya funcionaban ("coca cola", "agua con gas", "fanta naranja"…).
function unirPalabrasPartidas(lista, entradas) {
  if (lista.length < 2) return lista;

  const existeTalCual = (palabra) =>
    entradas.some((entrada) => coincideTalCual(palabra, entrada));

  const unidaExiste = (unida) => {
    if (unida.length < 5 || !/^[a-zñ]+$/.test(unida)) return false;
    // Tal cual (también como principio de palabras escritas juntas)
    if (entradas.some((entrada) => coincideTalCual(unida, entrada))) return true;
    // Con alguna falta: "yatecomo" ≈ "yatekomo"
    const maximo = faltasPermitidas(unida);
    if (
      maximo > 0 &&
      entradas.some((entrada) =>
        entrada.palabras.some((palabra) => distancia(unida, palabra, maximo) <= maximo)
      )
    ) {
      return true;
    }
    // Por cómo suena: "llatecomo" ≈ "yatekomo"
    const clave = claveFonetica(unida);
    if (clave.length >= 5) {
      const maximoClave = clave.length >= 7 ? 1 : 0;
      return entradas.some((entrada) =>
        entrada.claves.some((claveArticulo) => distancia(clave, claveArticulo, maximoClave) <= maximoClave)
      );
    }
    return false;
  };

  const resultado = [];
  let i = 0;
  while (i < lista.length) {
    let unidaEncontrada = null;
    for (let n = Math.min(4, lista.length - i); n >= 2; n -= 1) {
      const grupo = lista.slice(i, i + n);
      if (!grupo.every((palabra) => /^[a-zñ]+$/.test(palabra))) continue;
      // Un grupo no empieza ni acaba en "de", "la", "con"…: "estrella del
      // sur" no debe convertirse en "estrelladelsur".
      if (PALABRAS_VACIAS.has(grupo[0]) || PALABRAS_VACIAS.has(grupo[grupo.length - 1])) continue;
      const hayPalabraDudosa = grupo.some(
        (palabra) =>
          (palabra.length <= 2 && !PALABRAS_VACIAS.has(palabra)) || !existeTalCual(palabra)
      );
      if (!hayPalabraDudosa) continue;
      const unida = grupo.join("");
      if (unidaExiste(unida)) {
        unidaEncontrada = { unida, n };
        break;
      }
    }
    if (unidaEncontrada) {
      resultado.push(unidaEncontrada.unida);
      i += unidaEncontrada.n;
    } else {
      resultado.push(lista[i]);
      i += 1;
    }
  }
  return resultado;
}

/**
 * Crea la función que dice si un artículo encaja con lo buscado.
 * `indice` es el resultado de crearIndiceBusqueda (con todo el catálogo).
 */
export function crearBuscador(textoBuscado, indice) {
  const entradas = [...indice.values()];

  let consulta = canonizar(textoBuscado).replace(CANTIDAD_DELANTE, " ");
  let palabras = unirPalabrasPartidas(partirEnPalabras(consulta), entradas).filter(
    (palabra) => !PALABRAS_VACIAS.has(palabra) && (palabra.length > 1 || /\d/.test(palabra))
  );
  // Palabras de solo 2 letras ("ap" de "seben ap"): con voz suelen ser
  // trozos mal entendidos. Se ignoran si hay otras palabras más largas
  // (si es lo único que se busca, como "jb", se busca normal).
  const palabrasLargas = palabras.filter((palabra) => !/^[a-zñ]{1,2}$/.test(palabra));
  if (palabrasLargas.length > 0) palabras = palabrasLargas;

  // Para cada palabra se decide UNA forma de comprobarla, de la más
  // estricta a la más tolerante, mirando si existe en algún artículo.
  const comprobaciones = [];

  palabras.forEach((palabra) => {
    const alternativas = [palabra, ...(SINONIMOS[palabra] || []).map(canonizar)];

    // 1) Tal cual (o con un sinónimo)
    if (entradas.some((entrada) => alternativas.some((alt) => coincideTalCual(alt, entrada)))) {
      comprobaciones.push((entrada) => alternativas.some((alt) => coincideTalCual(alt, entrada)));
      return;
    }

    // 2) En singular / plural
    const formas = formasSingularPlural(palabra);
    if (formas.length && entradas.some((entrada) => formas.some((forma) => coincideTalCual(forma, entrada)))) {
      comprobaciones.push((entrada) => formas.some((forma) => coincideTalCual(forma, entrada)));
      return;
    }

    // 3) Con alguna falta de ortografía (también contra el principio de
    //    palabras más largas: "cruscamp" → "cruzcampo")
    const maximo = faltasPermitidas(palabra);
    if (maximo > 0) {
      const parecida = (entrada) =>
        entrada.palabras.some(
          (palabraArticulo) =>
            distancia(palabra, palabraArticulo, maximo) <= maximo ||
            (palabraArticulo.length > palabra.length &&
              distancia(palabra, palabraArticulo.slice(0, palabra.length), maximo) <= maximo)
        );
      if (entradas.some(parecida)) {
        comprobaciones.push(parecida);
        return;
      }
    }

    // 4) Por cómo suena (pronunciación con acento): R/L/N, B/P/V, D/T…
    const clave = claveFonetica(palabra);
    if (clave.length >= 3) {
      const maximoClave = clave.length >= 5 ? 1 : 0;
      const suenaParecido = (entrada) =>
        entrada.claves.some(
          (claveArticulo) =>
            distancia(clave, claveArticulo, maximoClave) <= maximoClave ||
            (claveArticulo.length > clave.length &&
              clave.length >= 4 &&
              distancia(clave, claveArticulo.slice(0, clave.length), maximoClave) <= maximoClave)
        );
      if (entradas.some(suenaParecido)) {
        comprobaciones.push(suenaParecido);
        return;
      }
    }

    // 5) No se parece a nada del catálogo: se ignora (no vacía la búsqueda).
  });

  if (comprobaciones.length === 0) {
    // Nada de lo buscado existe: no se muestra ningún artículo.
    return () => false;
  }

  const cache = new Map();
  return (producto) => {
    const id = String(producto.id);
    if (cache.has(id)) return cache.get(id);
    const entrada = indice.get(id) || entradaDeProducto(producto);
    const resultado = comprobaciones.every((comprobar) => comprobar(entrada));
    cache.set(id, resultado);
    return resultado;
  };
}
