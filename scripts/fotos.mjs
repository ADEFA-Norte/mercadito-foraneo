// Casamento fotos-originais/ → expositor, partilhado por build-data e build-images.
// "Joyería Viceli.jpg", "joyeria viceli 2.png" e "JOYERIA_VICELI (3).jpeg"
// casam todos com a marca "Joyería Viceli".
import { existsSync, readdirSync } from "node:fs";
import { extname, basename } from "node:path";

export const PASTA_ORIGINAIS = "fotos-originais";
export const PASTA_SAIDA = "img/expositores";
export const EXTENSOES = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff", ".gif"]);

export const normalizar = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const caminhoFoto = (id, k) => `${PASTA_SAIDA}/${id}-${k}.webp`;
export const caminhoThumb = id => `${PASTA_SAIDA}/${id}-thumb.webp`;

export function listarOriginais(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => !f.startsWith(".")).sort((a, b) => a.localeCompare(b, "es"));
}

// Devolve { porId: Map(id → [ficheiros por ordem]), semCasar: [ficheiros], ignorados: [ficheiros] }
export function emparelhar(expositores, ficheiros) {
  const porMarca = new Map(expositores.map(e => [normalizar(e.nombre), e.id]));
  const porId = new Map();
  const semCasar = [], ignorados = [];
  for (const f of ficheiros) {
    if (!EXTENSOES.has(extname(f).toLowerCase())) { ignorados.push(f); continue; }
    const base = basename(f, extname(f));
    // Primeiro o nome inteiro (para marcas que acabam em número, como "Lucky Things8"),
    // depois sem o sufixo de ordem: " 2", "-2", "_2", "(2)".
    let id = porMarca.get(normalizar(base)), ordem = 0;
    const suf = base.match(/^(.*?)[\s_-]*\(?(\d+)\)?$/);
    if (!id && suf) { id = porMarca.get(normalizar(suf[1])); ordem = Number(suf[2]); }
    if (!id) { semCasar.push(f); continue; }
    if (!porId.has(id)) porId.set(id, []);
    porId.get(id).push({ f, ordem });
  }
  for (const [id, l] of porId) porId.set(id, l.sort((a, b) => a.ordem - b.ordem || a.f.localeCompare(b.f, "es")).map(x => x.f));
  return { porId, semCasar, ignorados };
}
