// Genera los iconos a partir de favicon.svg:
//   favicon.ico            32px (PNG dentro de un contenedor ICO)
//   apple-touch-icon.png   180px, fondo blanco: iOS pinta de negro la transparencia
//   icon-192.png, icon-512.png   para el manifest, transparentes
// Uso: node scripts/build-favicon.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(RAIZ, "favicon.svg"));

// Rasterizar con densidad alta y reducir, para que los bordes salgan limpios
const png = (lado, fondo) => {
  let img = sharp(svg, { density: 1200 }).resize(lado, lado, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (fondo) img = img.flatten({ background: fondo });
  return img.png().toBuffer();
};

// ICO: cabecera de 6 bytes + una entrada de 16 bytes + el PNG
function ico(pngBuf, lado) {
  const cab = Buffer.alloc(6);
  cab.writeUInt16LE(0, 0);   // reservado
  cab.writeUInt16LE(1, 2);   // tipo: icono
  cab.writeUInt16LE(1, 4);   // una imagen
  const ent = Buffer.alloc(16);
  ent.writeUInt8(lado % 256, 0);   // ancho (0 significa 256)
  ent.writeUInt8(lado % 256, 1);   // alto
  ent.writeUInt8(0, 2);            // sin paleta
  ent.writeUInt8(0, 3);            // reservado
  ent.writeUInt16LE(1, 4);         // planos
  ent.writeUInt16LE(32, 6);        // bits por píxel
  ent.writeUInt32LE(pngBuf.length, 8);
  ent.writeUInt32LE(6 + 16, 12);   // offset de los datos
  return Buffer.concat([cab, ent, pngBuf]);
}

const salidas = [
  ["favicon.ico", ico(await png(32), 32)],
  ["apple-touch-icon.png", await png(180, "#ffffff")],
  ["icon-192.png", await png(192)],
  ["icon-512.png", await png(512)],
];
for (const [nombre, buf] of salidas) {
  writeFileSync(join(RAIZ, nombre), buf);
  console.log(`${nombre.padEnd(22)} ${(buf.length / 1024).toFixed(1)} KB`);
}
