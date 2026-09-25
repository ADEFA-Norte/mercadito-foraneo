// Lê fotos-originais/MERCADITO FORÁNEO/<pasta por negócio>/ e gera, por expositor:
//   img/expositores/<id>-1.webp, -2.webp… a 900px (ficha); a -1 é a capa
//   img/expositores/<id>-thumb.webp a 500px, da mesma capa (tarjeta)
// O casamento pasta → expositor está em fotos.mjs.
// Uso: node scripts/build-images.mjs   (e depois node scripts/build-data.mjs, se o aviso final aparecer)
import { readFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join } from "node:path";
import sharp from "sharp";
import { PASTA_ORIGINAIS, PASTA_SAIDA, emparelharPastas, caminhoFoto, caminhoThumb } from "./fotos.mjs";
import { lerExpositores } from "./build-data.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const QUALIDADE = 78;
const LARGURA_FICHA = 900;
const LARGURA_THUMB = 500;

// Os expositores vêm da planilha, com contacto e marca, e com os mesmos ids que build-data
const EXPOSITORES = lerExpositores();
const { porId, semCasar, ambiguas, pdfs, ignorados } = emparelharPastas(EXPOSITORES);

// Apaga o que foi gerado antes, para não ficarem fotos de ids que mudaram
const saida = join(RAIZ, PASTA_SAIDA);
mkdirSync(saida, { recursive: true });
for (const f of readdirSync(saida)) if (/^E-\d+-(\d+|thumb)\.webp$/.test(f)) unlinkSync(join(saida, f));

const gerar = (origem, destino, largura) =>
  sharp(join(RAIZ, origem))
    .rotate()
    .resize({ width: largura, withoutEnlargement: true })
    .webp({ quality: QUALIDADE })
    .toFile(join(RAIZ, destino));

// Ordem da tira: primeiro a foto que também é a miniatura, depois o resto por
// ordem alfabética. Assim a grade e a ficha abrem com a mesma imagem.
// A escolhida é um ficheiro com "logo" no nome, se houver; senão qualquer foto.
// Entre as candidatas ganha a mais perto de 1:1 (o tile é quadrado, é a que perde
// menos no corte) e, em empate, a de maior resolução. |ln(l/a)| trata igual
// retrato e paisagem, por isso a rotação EXIF não altera a escolha.
const eLogo = f => /logo/i.test(basename(f).normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
async function ordenar(lista) {
  const logos = lista.filter(eLogo);
  const candidatas = logos.length ? logos : lista;
  const medidas = await Promise.all(candidatas.map(async f => {
    const { width, height } = await sharp(join(RAIZ, f)).metadata();
    return { f, desvio: Math.round(Math.abs(Math.log(width / height)) * 1000), area: width * height };
  }));
  const capa = medidas.sort((a, b) => a.desvio - b.desvio || b.area - a.area)[0].f;
  return [capa, ...lista.filter(f => f !== capa)];
}

let n = 0, fotos = 0;
for (const [id, original] of porId) {
  const lista = await ordenar(original);
  for (const [k, f] of lista.entries()) {
    await gerar(f, caminhoFoto(id, k + 1), LARGURA_FICHA); n++; fotos++;
  }
  await gerar(lista[0], caminhoThumb(id), LARGURA_THUMB); n++;
}

console.log(`${fotos} fotos de ${porId.size} expositores · ${n} webp gerados em ${PASTA_SAIDA}/`);

console.log(`\nPastas que não casaram (${semCasar.length}):`);
for (const p of semCasar) console.log(`  ${p}`);
if (ambiguas.length) {
  console.log(`\nPastas ambíguas, ignoradas (${ambiguas.length}):`);
  for (const { pasta, ids } of ambiguas) console.log(`  ${pasta} → ${ids.join(", ")}`);
}
if (pdfs.length) {
  console.log(`\nPDF, não processados (${pdfs.length}):`);
  for (const f of pdfs) console.log(`  ${f.slice(PASTA_ORIGINAIS.length + 1)}`);
}
if (ignorados.length) {
  console.log(`\nOutros ficheiros ignorados (${ignorados.length}):`);
  for (const f of ignorados) console.log(`  ${f.slice(PASTA_ORIGINAIS.length + 1)}`);
}
const semFoto = EXPOSITORES.filter(e => !porId.has(e.id));
console.log(`\nNegocios sin fotos (${semFoto.length}):`);
for (const e of semFoto) console.log(`  ${e.id}  ${e.nombre}  (${e.contacto})`);

// Negócios que vieram de uma linha dividida: se um tem fotos e o outro não,
// as imagens podem ser dos dois. Confirmar à mão.
for (const e of semFoto.filter(e => e.divididoDe)) {
  const comFotos = EXPOSITORES.filter(x => x.divididoDe === e.divididoDe && porId.has(x.id));
  for (const x of comFotos) {
    const pastas = [...new Set(porId.get(x.id).map(f => f.slice(PASTA_ORIGINAIS.length + 1).split("/")[0]))];
    console.warn(`\naviso: ${e.id} ${e.nombre} ficou sem fotos; a pasta ${pastas.join(", ")} foi para ${x.id} ${x.nombre}. Confirma de que negócio são as imagens.`);
  }
}

// O index.html tem de apontar para estas imagens
const html = readFileSync(join(RAIZ, "index.html"), "utf8");
const bloco = html.split("/* EXPOSITORES:inicio */")[1]?.split("/* EXPOSITORES:fim */")[0];
const noSite = bloco ? new Function(`${bloco};return EXPOSITORES`)() : [];
const esperado = id => JSON.stringify((porId.get(id) || []).map((_, k) => caminhoFoto(id, k + 1)));
const desatualizados = EXPOSITORES.filter(e => JSON.stringify(noSite.find(s => s.id === e.id)?.fotos || []) !== esperado(e.id));
if (desatualizados.length)
  console.warn(`\naviso: o campo fotos de ${desatualizados.length} expositores no index.html não bate com estas imagens. Corre node scripts/build-data.mjs.`);
