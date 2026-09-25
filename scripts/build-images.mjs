// Lê fotos-originais/ e gera, por expositor:
//   img/expositores/<id>-1.webp, -2.webp… a 900px (ficha)
//   img/expositores/<id>-thumb.webp a 500px, da primeira foto (tarjeta)
// O casamento ficheiro → expositor é pelo nome da marca (ver fotos.mjs).
// Uso: node scripts/build-images.mjs   (depois de build-data.mjs)
import { readFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { PASTA_ORIGINAIS, PASTA_SAIDA, listarOriginais, emparelhar, caminhoFoto, caminhoThumb } from "./fotos.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const QUALIDADE = 78;
const LARGURA_FICHA = 900;
const LARGURA_THUMB = 500;

// Os expositores vêm do index.html, com os ids que o site está a usar
const html = readFileSync(join(RAIZ, "index.html"), "utf8");
const bloco = html.split("/* EXPOSITORES:inicio */")[1]?.split("/* EXPOSITORES:fim */")[0];
if (!bloco) { console.error("index.html: array EXPOSITORES não encontrado"); process.exit(1); }
const EXPOSITORES = new Function(`${bloco};return EXPOSITORES`)();

const ficheiros = listarOriginais(join(RAIZ, PASTA_ORIGINAIS));
const { porId, semCasar, ignorados } = emparelhar(EXPOSITORES, ficheiros);

// Apaga o que foi gerado antes, para não ficarem fotos de ids que mudaram
const saida = join(RAIZ, PASTA_SAIDA);
mkdirSync(saida, { recursive: true });
for (const f of readdirSync(saida)) if (/^E-\d+-(\d+|thumb)\.webp$/.test(f)) unlinkSync(join(saida, f));

const gerar = (origem, destino, largura) =>
  sharp(join(RAIZ, PASTA_ORIGINAIS, origem))
    .rotate()
    .resize({ width: largura, withoutEnlargement: true })
    .webp({ quality: QUALIDADE })
    .toFile(join(RAIZ, destino));

let n = 0;
for (const [id, lista] of porId) {
  for (const [k, f] of lista.entries()) {
    await gerar(f, caminhoFoto(id, k + 1), LARGURA_FICHA); n++;
    if (k === 0) { await gerar(f, caminhoThumb(id), LARGURA_THUMB); n++; }
  }
}

const desatualizados = EXPOSITORES.filter(e =>
  JSON.stringify(e.fotos || []) !== JSON.stringify((porId.get(e.id) || []).map((_, k) => caminhoFoto(e.id, k + 1))));

console.log(`${ficheiros.length} ficheiros em ${PASTA_ORIGINAIS}/ · ${porId.size} expositores com foto · ${n} webp gerados em ${PASTA_SAIDA}/`);
console.log(`\nFicheiros que não casaram (${semCasar.length}):`);
for (const f of semCasar) console.log(`  ${f}`);
if (ignorados.length) {
  console.log(`\nIgnorados, formato não suportado (${ignorados.length}):`);
  for (const f of ignorados) console.log(`  ${f}`);
}
const semFoto = EXPOSITORES.filter(e => !porId.has(e.id));
console.log(`\nNegocios sin foto (${semFoto.length}):`);
for (const e of semFoto) console.log(`  ${e.id}  ${e.nombre}`);
if (desatualizados.length)
  console.warn(`\naviso: o campo fotos de ${desatualizados.length} expositores no index.html não bate com estas imagens. Corre node scripts/build-data.mjs.`);
