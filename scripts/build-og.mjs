// Genera og-image.png (1200×630), la vista previa al compartir el link en
// WhatsApp, Instagram, Facebook, X, iMessage…
// Se dibuja en Chrome headless para usar las mismas fuentes de Google que la
// página (Zilla Slab y Jost) y la ráfaga oficial (BURST de index.html).
// Composición centrada y título en dos líneas: en vista chica WhatsApp recorta un
// cuadrado del centro (630×630), y todo el texto tiene que caber ahí.
// Uso: node scripts/build-og.mjs    (CHROME_PATH=… si Chrome no está en la ruta de macOS)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const html = readFileSync(join(RAIZ, "index.html"), "utf8");
const BURST = html.match(/const BURST='([^']*)'/)[1];
const RAMPA = JSON.parse(html.match(/const RAMPA=(\[[^\]]*\])/)[1]);

const pagina = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500&family=Zilla+Slab:wght@700&display=block" rel="stylesheet">
<style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#fff;color:#000;font-family:Jost,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;position:relative;overflow:hidden}
.rafaga{width:112px;height:112px}
.ante{margin-top:18px;font:500 20px/1 Jost;letter-spacing:.1em;text-transform:uppercase;color:#BF3912}
h1{margin-top:12px;font:700 100px/.9 "Zilla Slab";letter-spacing:-2.5px}
.lema{margin-top:14px;font:400 28px/1.2 Jost;color:#545C5E}
.info{margin-top:22px;padding-top:14px;border-top:3px solid #000;font:500 26px/1.2 Jost}
/* los 6 pasos centrales de la rampa, como franja de marca */
.franja{position:absolute;left:0;right:0;bottom:0;height:14px;display:flex}
.franja i{flex:1}
</style></head><body>
<svg class="rafaga" viewBox="-104 -104 208 208">${BURST}</svg>
<p class="ante">ADEFA · Anáhuac México Norte</p>
<h1>Mercadito<br>Foráneo</h1>
<p class="lema">Lo que trajimos de casa</p>
<p class="info">30 sep y 1 oct · Salón San Pablo II</p>
<div class="franja">${RAMPA.slice(1, 7).map(c => `<i style="background:${c}"></i>`).join("")}</div>
</body></html>`;

const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true });
const p = await navegador.newPage();
await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await p.setContent(pagina, { waitUntil: "networkidle0" });
await p.evaluate(() => document.fonts.ready);
const faltan = await p.evaluate(() => ["700 10px 'Zilla Slab'", "400 10px Jost", "500 10px Jost"].filter(f => !document.fonts.check(f)));
if (faltan.length) { console.error("No cargaron las fuentes:", faltan.join(", ")); process.exit(1); }
const captura = await p.screenshot({ type: "png" });
await navegador.close();

// PNG de paleta: colores planos, pesa poco (WhatsApp descarta imágenes muy pesadas)
const salida = await sharp(captura).png({ palette: true, quality: 90, compressionLevel: 9 }).toBuffer();
writeFileSync(join(RAIZ, "og-image.png"), salida);
console.log(`og-image.png 1200×630 · ${(salida.length / 1024).toFixed(0)} KB`);
