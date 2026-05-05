const fs = require("fs");
const path = require("path");

const APP_FILE = "./src/App.jsx";
const ORIGEN = "./public/fotos-originales";
const DESTINO = "./public/productos";

const slugify = (text) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

if (!fs.existsSync(APP_FILE)) {
  console.error("No encuentro src/App.jsx");
  process.exit(1);
}

if (!fs.existsSync(ORIGEN)) {
  console.error("No encuentro public/fotos-originales");
  process.exit(1);
}

if (!fs.existsSync(DESTINO)) {
  fs.mkdirSync(DESTINO, { recursive: true });
}

const appCode = fs.readFileSync(APP_FILE, "utf8");

const departmentsMatch = appCode.match(
  /const\s+departments\s*=\s*(\[[\s\S]*?\]);/
);

if (!departmentsMatch) {
  console.error("No he podido encontrar const departments = [...] en App.jsx");
  process.exit(1);
}

const departmentsText = departmentsMatch[1];

const productRegex = /products\s*:\s*\[([\s\S]*?)\]/g;
const stringRegex = /"([^"]+)"/g;

const productos = [];
let departmentBlock;

while ((departmentBlock = productRegex.exec(departmentsText)) !== null) {
  const productsContent = departmentBlock[1];
  let productMatch;

  while ((productMatch = stringRegex.exec(productsContent)) !== null) {
    productos.push(productMatch[1]);
  }
}

if (productos.length === 0) {
  console.error("No he encontrado productos dentro de departments.");
  process.exit(1);
}

const fotos = fs
  .readdirSync(ORIGEN)
  .filter((file) => /\.(jpg|jpeg|png|webp)$/i.test(file))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (fotos.length === 0) {
  console.error("No hay fotos en public/fotos-originales");
  process.exit(1);
}

console.log(`Productos encontrados: ${productos.length}`);
console.log(`Fotos encontradas: ${fotos.length}`);
console.log("");

productos.forEach((producto, index) => {
  const foto = fotos[index];

  if (!foto) {
    console.warn(`Sin foto para: ${producto}`);
    return;
  }

  const extensionOriginal = path.extname(foto).toLowerCase();
  const extensionFinal = extensionOriginal === ".jpeg" ? ".jpg" : extensionOriginal;

  const nuevoNombre = `${slugify(producto)}${extensionFinal}`;

  const rutaOrigen = path.join(ORIGEN, foto);
  const rutaDestino = path.join(DESTINO, nuevoNombre);

  fs.copyFileSync(rutaOrigen, rutaDestino);

  console.log(`${foto}  →  ${nuevoNombre}`);
});

console.log("");
console.log("Proceso terminado.");
console.log(`Fotos copiadas en: ${DESTINO}`);

if (fotos.length > productos.length) {
  console.log("");
  console.warn(
    `Aviso: sobran ${fotos.length - productos.length} fotos en fotos-originales.`
  );
}
