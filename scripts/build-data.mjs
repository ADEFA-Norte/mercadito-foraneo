// Lê registro.xlsx e escreve o array EXPOSITORES dentro de index.html.
// Uso: node scripts/build-data.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { PASTA_ORIGINAIS, listarOriginais, emparelhar, caminhoFoto } from "./fotos.mjs";

const XLSX = createRequire(import.meta.url)("xlsx");
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLANILHA = join(RAIZ, "registro.xlsx");
const INDEX = join(RAIZ, "index.html");
const FOLHA = "Hoja 1";
const INICIO = "/* EXPOSITORES:inicio */";
const FIM = "/* EXPOSITORES:fim */";

// Ordem = prioridade. A palavra-chave tem de estar no início de uma palavra,
// para "arte" não apanhar "parte" nem "pin" apanhar "espinaca".
const CATEGORIAS = [
  ["Joyería y accesorios", ["joyer", "arracad", "anillo", "collar", "pulsera", "dije", "charm", "plata", "chapa de oro", "acero inoxidable", "piercing", "brazalete", "perla", "cristales", "waterproof", "reloj"]],
  ["Postres y pan", ["postre", "galleta", "brownie", "pan", "panader", "alfajor", "cupcake", "bakery", "dulcer", "gomita", "chocolate", "brigadeiro", "oblea", "confiter", "mermelada"]],
  ["Comida y botanas", ["esquite", "papas prepar", "chips", "palomitas", "amaranto", "semillas", "churrito", "banderilla"]],
  ["Bebidas", ["matcha", "café", "cafe", "agua fresca", "horchata"]],
  ["Moda", ["ropa", "chamarra", "legging", "top", "calcet", "media", "bolsa", "bolso", "marroquiner", "mezclilla", "tote"]],
  ["Belleza y cuidado", ["maquillaje", "skincare", "cosmétic", "perfum", "jabón", "exfoliante", "suplemento", "capilar"]],
  ["Hogar y velas", ["vela", "warmer", "difusor", "aromátic", "mantel"]],
  ["Arte y papelería", ["papeler", "lienzo", "paint", "rompecabeza", "taza personalizada", "pintad", "arte", "grabado"]],
  ["Juguetes y coleccionables", ["squish", "slime", "peluche", "juguete", "fidget", "sticker", "llavero", "pin"]],
  ["Importados y termos", ["owala", "hydrojug", "brumate", "importad", "termo"]],
];

// Correções manuais, pela marca tal como aparece na folha
const SOBREPOSICOES = {
  "MT 17 CAFE ARTESANAL": {
    rango: "$55 – $320",
    categoria: "Bebidas",
    desc: "Café tostado, en grano y molido, mermelada de café, fresa y zarzamora, velas aromáticas, confitería, jabones y exfoliantes de café.",
  },
  "Pepetines": {
    categoria: "Juguetes y coleccionables",
    desc: "Juguetes artesanales hechos a mano: conejos, gatos, perros, changos, dinosaurios y unicornios creados a partir de calcetines. Cada pieza es única e irrepetible.",
  },
  "Eliette candle shop": { categoria: "Hogar y velas" },
  "Paponas y enchilados": { categoria: "Comida y botanas" },
  "Peluches tu-tuy": { categoria: "Juguetes y coleccionables" },
  // Fica em Otros para não criar um chip com um só negócio; "Mascotas" na desc para a busca.
  "Bolita Pet": { categoria: "Otros", desc: "Mascotas: collares personalizados para mascota." },
  "Holy Mustard": { categoria: "Moda" },
};

const texto = v => String(v ?? "").replace(/\s+/g, " ").trim();
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const REGEX_CAT = CATEGORIAS.map(([nome, chaves]) =>
  [nome, new RegExp(`(?<![\\p{L}\\p{N}])(?:${chaves.map(escRe).join("|")})`, "iu")]);

function categoria(marca, desc) {
  const alvo = `${marca} ${desc}`;
  for (const [nome, re] of REGEX_CAT) if (re.test(alvo)) return nome;
  return "Otros";
}

function cortar(s, max = 170) {
  if (s.length <= max) return s;
  const corte = s.slice(0, max - 1);
  const espaco = corte.lastIndexOf(" ");
  return (espaco > 0 ? corte.slice(0, espaco) : corte).replace(/[\s,;:.\-–—]+$/, "") + "…";
}

function instagram(v) {
  const s = texto(v);
  if (!s || /no aplica|facebook|canva/i.test(s)) return "";
  const url = s.match(/instagram\.com\/\s*([A-Za-z0-9._]+)/i);
  if (url) return url[1].replace(/\.+$/, "").toLowerCase();
  if (/https?:|www\./i.test(s)) return "";
  const primeiro = s.split(/\s*\/\s*|\s+y\s+|\s+(?=@)/)[0].replace(/^@/, "").trim();
  return /^[A-Za-z0-9._]{1,30}$/.test(primeiro) ? primeiro.replace(/\.+$/, "").toLowerCase() : "";
}

function whatsapp(v) {
  const d = String(v ?? "").split("/")[0].replace(/\D/g, "");
  return d.length === 10 ? `52${d}` : "";
}

const pesos = n => "$" + Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });
function rango(v) {
  const nums = (String(v ?? "").split("/")[0].match(/\d[\d,]*/g) || []).map(n => n.replace(/,/g, ""));
  if (!nums.length) return "";
  return nums.length === 1 ? pesos(nums[0]) : `${pesos(nums[0])} – ${pesos(nums[1])}`;
}

const capitalizar = h => h.replace(/[_.]+/g, " ").trim().toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

// Leitura
const linhas = XLSX.utils.sheet_to_json(XLSX.readFile(PLANILHA).Sheets[FOLHA], { header: 1, defval: "" });
let bloco = null;
const vistos = new Set();
const brutos = [];
for (const l of linhas) {
  const a = texto(l[0]);
  const linha = l.map(texto).join(" ");
  if (/SPOTS FOR[AÁ]NEOS/i.test(linha)) { bloco = "foraneo"; continue; }
  if (/SPOTS LOCALES/i.test(linha)) { bloco = "local"; continue; }
  if (/^NO\. DE/i.test(a) || !bloco) continue;
  const persona = texto(l[1]);
  if (!persona) continue;
  const marca = bloco === "local" ? texto(l[2]) : "";
  const chave = `${persona}|${marca}`.toLowerCase();
  if (vistos.has(chave)) continue;
  vistos.add(chave);
  brutos.push({ foraneo: bloco === "foraneo", persona, marca, l });
}

// Normalização — foráneos primeiro, pela ordem da folha
brutos.sort((x, y) => y.foraneo - x.foraneo);
const EXPOSITORES = brutos.map(({ foraneo, persona, marca, l }, i) => {
  const descFolha = texto(l[3]);
  const { desc: descManual, ...sobreposicao } = SOBREPOSICOES[marca] || {};
  // A desc manual substitui o texto completo, para a ficha não mostrar o original.
  const descCompleta = descManual ? texto(descManual) : descFolha;
  const ig = instagram(l[4]);
  const e = {
    id: `E-${String(i + 1).padStart(3, "0")}`,
    nombre: marca || (ig ? capitalizar(ig) : persona),
    categoria: categoria(marca, descFolha),
    foraneo,
    estado: "",
    desc: cortar(descCompleta),
    desc_full: descCompleta,
    rango: rango(l[7]),
    stand: "",
    pagos: "",
    wa: whatsapp(l[6]),
    ig,
    fotos: [],
  };
  return { ...e, ...sobreposicao };
});

// fotos: os caminhos que build-images.mjs gera a partir de fotos-originais/
const { porId } = emparelhar(EXPOSITORES, listarOriginais(join(RAIZ, PASTA_ORIGINAIS)));
for (const e of EXPOSITORES) e.fotos = (porId.get(e.id) || []).map((_, k) => caminhoFoto(e.id, k + 1));

const marcas = new Set(brutos.map(r => r.marca));
for (const m of Object.keys(SOBREPOSICOES))
  if (!marcas.has(m)) console.warn(`aviso: a sobreposição "${m}" não corresponde a nenhuma marca da folha`);

// Escrita
const html = readFileSync(INDEX, "utf8");
const a = html.indexOf(INICIO), b = html.indexOf(FIM);
if (a < 0 || b < a) {
  console.error(`index.html: marcadores ${INICIO} … ${FIM} não encontrados`);
  process.exit(1);
}
const js = `${INICIO}\nconst EXPOSITORES=[\n${EXPOSITORES.map(e => "  " + JSON.stringify(e)).join(",\n")}\n];\n`;
writeFileSync(INDEX, html.slice(0, a) + js + html.slice(b));

const nF = EXPOSITORES.filter(e => e.foraneo).length;
const porCat = EXPOSITORES.reduce((m, e) => (m[e.categoria] = (m[e.categoria] || 0) + 1, m), {});
console.log(`${EXPOSITORES.length} expositores: ${nF} foráneos, ${EXPOSITORES.length - nF} locales`);
console.log(`sin WhatsApp: ${EXPOSITORES.filter(e => !e.wa).length} · sin Instagram: ${EXPOSITORES.filter(e => !e.ig).length} · sin rango: ${EXPOSITORES.filter(e => !e.rango).length} · con fotos: ${EXPOSITORES.filter(e => e.fotos.length).length}`);
console.table(porCat);
