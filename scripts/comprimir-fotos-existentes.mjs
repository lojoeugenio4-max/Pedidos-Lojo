// Reprocesa las fotos que YA están subidas en el bucket "productos" de
// Supabase Storage: las descarga, si pesan más de UMBRAL_KB las
// redimensiona/comprime, y las vuelve a subir con el MISMO nombre de
// archivo (así ningún artículo en la base de datos cambia de foto, ni
// hay que tocar nada más en la app).
//
// CÓMO EJECUTARLO (desde la carpeta raíz del proyecto, con Node 18+):
//
//   npm install sharp @supabase/supabase-js
//   node scripts/comprimir-fotos-existentes.mjs
//
// Primero hace una pasada "en seco" mostrando cuánto se ahorraría; para
// que suba los cambios de verdad, ejecútalo con --aplicar:
//
//   node scripts/comprimir-fotos-existentes.mjs --aplicar
//
// Es seguro ejecutarlo varias veces: las fotos que ya estén por debajo
// del umbral se dejan tal cual.

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

// Mismas credenciales públicas que ya usa la app en
// src/supabaseStorageClient.js (es la clave "publishable", no una
// clave secreta de administración).
const SUPABASE_URL = "https://bohlxagrtpjvqrgkonlo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tpgtppDeMr2dGJIiZtB5nA_OXih8FKF";
const BUCKET = "productos";

const MAX_LADO_PX = 900;
const CALIDAD_JPEG = 75;
const UMBRAL_KB = 150; // por debajo de esto, no merece la pena tocarla

const APLICAR = process.argv.includes("--aplicar");

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function listarTodosLosArchivos() {
  const archivos = [];
  const limite = 100;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list("", { limit: limite, offset, sortBy: { column: "name", order: "asc" } });

    if (error) throw error;
    if (!data || data.length === 0) break;

    // .list() en la raíz también puede devolver "carpetas" (id null);
    // aquí solo nos interesan archivos reales.
    archivos.push(...data.filter((item) => item.id !== null));

    if (data.length < limite) break;
    offset += limite;
  }

  return archivos;
}

async function procesarArchivo(nombre, tamanoOriginalBytes) {
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(nombre);
  const respuesta = await fetch(urlData.publicUrl);

  if (!respuesta.ok) {
    throw new Error(`No se pudo descargar (HTTP ${respuesta.status})`);
  }

  const bufferOriginal = Buffer.from(await respuesta.arrayBuffer());

  const bufferComprimido = await sharp(bufferOriginal)
    .resize({ width: MAX_LADO_PX, height: MAX_LADO_PX, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: CALIDAD_JPEG })
    .toBuffer();

  // Si por lo que sea sale más pesada (raro, pero puede pasar con
  // imágenes ya muy comprimidas), no la tocamos.
  if (bufferComprimido.length >= tamanoOriginalBytes) {
    return { subida: false, nuevoTamano: tamanoOriginalBytes };
  }

  if (APLICAR) {
    const { error } = await supabase.storage.from(BUCKET).upload(nombre, bufferComprimido, {
      upsert: true,
      contentType: "image/jpeg",
    });
    if (error) throw error;
  }

  return { subida: true, nuevoTamano: bufferComprimido.length };
}

function formatearKB(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

async function main() {
  console.log(APLICAR ? "Modo: APLICANDO cambios de verdad\n" : "Modo: PRUEBA (no sube nada; usa --aplicar para subir)\n");

  const archivos = await listarTodosLosArchivos();
  console.log(`Encontrados ${archivos.length} archivos en el bucket "${BUCKET}".\n`);

  let totalOriginal = 0;
  let totalFinal = 0;
  let procesados = 0;
  let saltados = 0;
  let errores = 0;

  for (const archivo of archivos) {
    const tamanoOriginal = archivo.metadata?.size || 0;
    totalOriginal += tamanoOriginal;

    if (tamanoOriginal <= UMBRAL_KB * 1024) {
      totalFinal += tamanoOriginal;
      saltados += 1;
      continue;
    }

    try {
      const resultado = await procesarArchivo(archivo.name, tamanoOriginal);
      totalFinal += resultado.nuevoTamano;

      if (resultado.subida) {
        procesados += 1;
        console.log(
          `${archivo.name}: ${formatearKB(tamanoOriginal)} -> ${formatearKB(resultado.nuevoTamano)}`
        );
      } else {
        saltados += 1;
      }
    } catch (error) {
      errores += 1;
      totalFinal += tamanoOriginal;
      console.error(`ERROR en ${archivo.name}: ${error.message}`);
    }
  }

  console.log("\n--- Resumen ---");
  console.log(`Procesadas: ${procesados}`);
  console.log(`Saltadas (ya ligeras): ${saltados}`);
  console.log(`Errores: ${errores}`);
  console.log(`Peso total antes: ${formatearKB(totalOriginal)}`);
  console.log(`Peso total ${APLICAR ? "después" : "estimado después"}: ${formatearKB(totalFinal)}`);

  if (!APLICAR) {
    console.log("\nEsto ha sido una prueba. Para subir los cambios de verdad, ejecuta:");
    console.log("  node scripts/comprimir-fotos-existentes.mjs --aplicar");
  }
}

main().catch((error) => {
  console.error("Fallo general del script:", error);
  process.exit(1);
});
