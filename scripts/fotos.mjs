// Casamento de fotos → expositor, partilhado por build-data e build-images.
// Cada subpasta de fotos-originais/MERCADITO FORÁNEO/ é um negócio. O nome da
// pasta casa com o contacto (nome da pessoa) ou com a marca, por tokens.
import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PASTA_ORIGINAIS = "fotos-originais/MERCADITO FORÁNEO";
export const PASTA_SAIDA = "img/expositores";
export const EXTENSOES = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// Exceções para gralhas da planilha, aplicadas antes do casamento por tokens.
// O destino é a marca, o contacto ou o id do expositor.
export const ALIAS_PASTAS = {
  "XIMENA CALVO": "Desereta",       // na folha: Ximena Calva Osorio
  // Linha dividida Ana Janet Vera / Sebas Arce: as pastas vêm trocadas em relação às pessoas.
  "SEBASTIAN ARCE": "AR Watches",   // as fotos são de relógios
  "ANA JANET": "Morona",            // as fotos são de bolachas
  // Foráneo sem marca: o nome vem do Instagram e o contacto é outro (Leonardo Wanderkoke)
  "MARIA FORMIGA": "Maria Formiga Mx Br",
};

// Fotos sueltas que van a otro negocio que el de su carpeta. Destino: marca, nombre,
// contacto o id, como en ALIAS_PASTAS. Ruta: "<pasta>/<fichero>".
export const ASIGNAR_FOTOS = new Map(Object.entries({
  // REGINA RAMOS casa con Revu Shop; la ilustración naranja es de Snacks Anahuacnorte
  "REGINA RAMOS/WhatsApp Image 2026-09-22 at 9.36.31 PM.jpeg": "Snacks Anahuacnorte",
}).map(([r, d]) => [r.normalize("NFC"), d]));

// Portada elegida a mano: va primera en la ficha y es la miniatura de la tarjeta.
// Gana sobre la regla automática (logo, o la foto más cuadrada). Ruta: "<pasta>/<fichero>".
export const PORTADAS = new Set([
  "ALMAS JOYERAS/IMG_6809 - Sheyla Ramírez.jpeg",  // anillos plateados con corazón rojo
].map(r => r.normalize("NFC")));

// Fotos que están en la carpeta de un negocio pero no son suyas. No se borran de
// fotos-originais/; solo se ignoran. Ruta: "<pasta>/<fichero>".
export const EXCLUIR_FOTOS = new Set([
  "MARÍA FERNANDA/WhatsApp Image 2026-09-23 at 10.49.48 AM.jpeg",  // logo "SS Fitness" de SportStyle; copiado a MARGARITA SOTO
  // Paponas y enchilados pidió una sola imagen: el logo conjunto (Paponas, Enchilados, Le Petit Jardin)
  "CLAUDIA CARRASCO/WhatsApp Image 2026-09-23 at 7.54.14 PM (1).jpeg",
  "CLAUDIA CARRASCO/WhatsApp Image 2026-09-23 at 7.54.14 PM (2).jpeg",
  "CLAUDIA CARRASCO/WhatsApp Image 2026-09-23 at 7.54.14 PM.jpeg",
  // Antojo Lab: logo con fondo claro, sustituido por "logo antojo lab.jpeg" (fondo guinda)
  "NERI CABRAL/WhatsApp Image 2026-09-26 at 15.43.06.jpeg",
].map(r => r.normalize("NFC")));

export const caminhoFoto = (id, k) => `${PASTA_SAIDA}/${id}-${k}.webp`;
export const caminhoThumb = id => `${PASTA_SAIDA}/${id}-thumb.webp`;

const tokens = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
const chave = s => tokens(s).join(" ");
const porNome = (a, b) => a.localeCompare(b, "es", { numeric: true });

const porDestino = (destino, expositores) => {
  const alvo = chave(destino);
  return expositores.filter(e => e.id === destino || [e.marca, e.nombre, e.contacto].some(v => v && chave(v) === alvo));
};

function candidatos(pasta, expositores) {
  const alias = Object.entries(ALIAS_PASTAS).find(([p]) => chave(p) === chave(pasta));
  if (alias) {
    const alvo = chave(alias[1]);
    return expositores.filter(e => e.id === alias[1] || [e.marca, e.nombre, e.contacto].some(v => v && chave(v) === alvo));
  }
  const palavras = tokens(pasta).filter(t => t.length > 2);
  if (!palavras.length) return [];
  return expositores.filter(e => {
    const disponiveis = new Set([...tokens(e.contacto || ""), ...tokens(e.marca || "")]);
    return palavras.every(t => disponiveis.has(t));
  });
}

// Devolve { porId: Map(id → [caminhos relativos à raiz]), semCasar, ambiguas, pdfs, ignorados }
export function emparelharPastas(expositores, { silencioso = false } = {}) {
  const res = { porId: new Map(), semCasar: [], ambiguas: [], pdfs: [], ignorados: [], excluidos: [] };
  const base = join(RAIZ, PASTA_ORIGINAIS);
  if (!existsSync(base)) return res;

  const pastas = readdirSync(base).filter(p => !p.startsWith(".") && statSync(join(base, p)).isDirectory()).sort(porNome);
  for (const pasta of pastas) {
    const achados = candidatos(pasta, expositores);
    if (achados.length !== 1) {
      if (achados.length > 1) {
        res.ambiguas.push({ pasta, ids: achados.map(e => e.id) });
        if (!silencioso) console.warn(`aviso: a pasta "${pasta}" casa com ${achados.map(e => `${e.id} ${e.nombre}`).join(", ")}; ignorada`);
      } else res.semCasar.push(pasta);
      continue;
    }
    const { id } = achados[0];
    const ficheiros = readdirSync(join(base, pasta)).filter(f => !f.startsWith(".")).sort(porNome);
    for (const f of ficheiros) {
      const rel = `${PASTA_ORIGINAIS}/${pasta}/${f}`;
      const ext = extname(f).toLowerCase();
      if (ext === ".pdf") { res.pdfs.push(rel); continue; }
      if (!EXTENSOES.has(ext)) { res.ignorados.push(rel); continue; }
      const clave = `${pasta}/${f}`.normalize("NFC");
      if (EXCLUIR_FOTOS.has(clave)) { res.excluidos.push(rel); continue; }
      let destino = id;
      if (ASIGNAR_FOTOS.has(clave)) {
        const otros = porDestino(ASIGNAR_FOTOS.get(clave), expositores);
        if (otros.length === 1) destino = otros[0].id;
        else if (!silencioso) console.warn(`aviso: ASIGNAR_FOTOS "${clave}" → "${ASIGNAR_FOTOS.get(clave)}" casa con ${otros.length} negocios; se queda en ${id}`);
      }
      if (!res.porId.has(destino)) res.porId.set(destino, []);
      res.porId.get(destino).push(rel);
    }
  }
  return res;
}
