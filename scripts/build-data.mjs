// Lê registro.xlsx e escreve o array EXPOSITORES dentro de index.html.
// Uso: node scripts/build-data.mjs
// build-images.mjs importa lerExpositores() daqui, para usar os mesmos ids.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { emparelharPastas, caminhoFoto } from "./fotos.mjs";

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

// Correções manuais, pela marca tal como aparece na folha; para foráneos sem marca,
// pelo nome gerado (o do Instagram capitalizado)
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
  "Bolita Pet": { categoria: "Mascotas" },
  "Holy Mustard": { categoria: "Moda" },
  "Maria Formiga Mx Br": { rango: "$25 – $350", wa: "525541774506" },
  // Foráneo sin marca ni Instagram: en la folha solo está el nombre de la persona
  "Sofía Giménez Rodríguez": { nombre: "Sookies" },
};

// Negócios que não estão na folha. Entram depois dos da folha, com os ids seguintes.
const NOVOS_EXPOSITORES = [
  {
    nombre: "Espacio Brasil",
    foraneo: true,
    categoria: "Postres y pan",
    desc: "Pasteles y dulces brasileños: trufas de chocolate, coco, fresa, churros y nido, brochetas y vasos de frutas con chocolate.",
    rango: "Desde $15",
    wa: "525549574864",
    ig: "su_martins_mar",
    pagos: "Efectivo, transferencia y tarjeta",
  },
  {
    nombre: "Bruno y Oli",
    foraneo: true,
    categoria: "Mascotas",
    desc: "Galletas y spreads para perro, 100% naturales, sin conservadores ni químicos añadidos.",
    rango: "$100 – $150",
    wa: "527222644107",
    ig: "brunoyoli",
  },
];

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

// Registos de foráneos que juntam dois negócios numa linha, pelo nome da pessoa
// tal como está na folha. Só estes se dividem: noutras linhas "/" não separa negócios.
const DIVISOES = [
  "Regina Ramos Zertuche / Jorge Ramos",
  "Ana Janet Vera / Sebas Arce",
];
// B nome, D descrição, E instagram, G telemóvel, H preços
const CAMPOS_DIVIDIDOS = [1, 3, 4, 6, 7];

// A parte n de cada campo vai para o negócio n. Um campo com menos partes
// do que o nome (um só telemóvel para dois negócios) é herdado por todos.
function dividir(l) {
  const n = texto(l[1]).split("/").length;
  return Array.from({ length: n }, (_, k) => {
    const c = [...l];
    for (const i of CAMPOS_DIVIDIDOS) {
      const partes = String(l[i] ?? "").split("/").map(texto);
      if (partes.length > n) console.warn(`aviso: "${texto(l[1])}", coluna ${"ABCDEFGH"[i]}: ${partes.length} partes para ${n} negócios`);
      c[i] = partes.length >= n ? partes[k] : texto(l[i]);
    }
    return c;
  });
}

const primeirasMaiusculas = s => s.replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

const capitalizar = h => h.replace(/[_.]+/g, " ").trim().toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

// Leitura. Cada expositor sai com campos internos (contacto = nome da pessoa, marca,
// divididoDe) que servem para casar as fotos e nunca são escritos no index.html.
export function lerExpositores() {
  const linhas = XLSX.utils.sheet_to_json(XLSX.readFile(PLANILHA).Sheets[FOLHA], { header: 1, defval: "" });
  let bloco = null;
  const vistos = new Set();
  const brutos = [];
  const divididos = new Set();
  for (const l of linhas) {
    const a = texto(l[0]);
    const linha = l.map(texto).join(" ");
    if (/SPOTS FOR[AÁ]NEOS/i.test(linha)) { bloco = "foraneo"; continue; }
    if (/SPOTS LOCALES/i.test(linha)) { bloco = "local"; continue; }
    if (/^NO\. DE/i.test(a) || !bloco) continue;
    const original = texto(l[1]);
    if (!original) continue;
    const dividido = DIVISOES.includes(original);
    if (dividido) divididos.add(original);
    for (const c of dividido ? dividir(l) : [l]) {
      const persona = texto(c[1]);
      const marca = bloco === "local" ? texto(c[2]) : "";
      const chave = `${persona}|${marca}`.toLowerCase();
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      // Numa linha dividida, um Instagram que não é handle ("AR watches") serve de nome
      const igTexto = texto(c[4]);
      const nomeReserva = dividido && igTexto && !instagram(igTexto) && !/no aplica/i.test(igTexto) ? primeirasMaiusculas(igTexto) : "";
      brutos.push({ foraneo: bloco === "foraneo", persona, marca, nomeReserva, divididoDe: dividido ? original : "", l: c });
    }
  }
  for (const d of DIVISOES)
    if (!divididos.has(d)) console.warn(`aviso: o registo a dividir "${d}" já não existe na folha`);

  // Normalização — foráneos primeiro, pela ordem da folha
  brutos.sort((x, y) => y.foraneo - x.foraneo);
  const EXPOSITORES = brutos.map(({ foraneo, persona, marca, nomeReserva, divididoDe, l }, i) => {
    const descFolha = texto(l[3]);
    const ig = instagram(l[4]);
    const nombre = marca || (ig ? capitalizar(ig) : nomeReserva || persona);
    const { desc: descManual, ...sobreposicao } = SOBREPOSICOES[marca] || SOBREPOSICOES[nombre] || {};
    // A desc manual substitui o texto completo, para a ficha não mostrar o original.
    const descCompleta = descManual ? texto(descManual) : descFolha;
    const e = {
      id: `E-${String(i + 1).padStart(3, "0")}`,
      nombre,
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
      contacto: persona,
      marca,
      divididoDe,
    };
    return { ...e, ...sobreposicao };
  });

  // contacto: una sobreposición puede cambiar el nombre (Sookies); la clave es el nombre de la persona
  const chaves = new Set(EXPOSITORES.flatMap(e => [e.marca, e.nombre, e.contacto]));
  for (const m of Object.keys(SOBREPOSICOES))
    if (!chaves.has(m)) console.warn(`aviso: a sobreposição "${m}" não corresponde a nenhuma marca nem nome da folha`);

  // A marca serve para casar uma pasta de fotos com o mesmo nome; não há contacto.
  for (const [k, n] of NOVOS_EXPOSITORES.entries()) {
    const desc = texto(n.desc);
    EXPOSITORES.push({
      id: `E-${String(brutos.length + k + 1).padStart(3, "0")}`,
      nombre: n.nombre, categoria: n.categoria, foraneo: n.foraneo, estado: n.estado || "",
      desc: cortar(desc), desc_full: desc,
      rango: n.rango || "", stand: n.stand || "", pagos: n.pagos || "",
      wa: n.wa || "", ig: n.ig || "", fotos: [],
      contacto: "", marca: n.nombre, divididoDe: "",
    });
  }

  // Foráneos primeiro, também para os novos (sort estável: mantém a ordem dentro de cada grupo)
  return EXPOSITORES.sort((x, y) => y.foraneo - x.foraneo);
}

const principal = import.meta.url === pathToFileURL(process.argv[1] || "").href;
if (principal) {
  const EXPOSITORES = lerExpositores();

  // fotos: os caminhos que build-images.mjs gera a partir de fotos-originais/
  const { porId } = emparelharPastas(EXPOSITORES, { silencioso: true });
  for (const e of EXPOSITORES) e.fotos = (porId.get(e.id) || []).map((_, k) => caminhoFoto(e.id, k + 1));

  // Escrita — sem os campos internos
  const publico = EXPOSITORES.map(({ contacto, marca, divididoDe, ...e }) => e);
  const html = readFileSync(INDEX, "utf8");
  const a = html.indexOf(INICIO), b = html.indexOf(FIM);
  if (a < 0 || b < a) {
    console.error(`index.html: marcadores ${INICIO} … ${FIM} não encontrados`);
    process.exit(1);
  }
  const js = `${INICIO}\nconst EXPOSITORES=[\n${publico.map(e => "  " + JSON.stringify(e)).join(",\n")}\n];\n`;
  writeFileSync(INDEX, html.slice(0, a) + js + html.slice(b));

  const nF = EXPOSITORES.filter(e => e.foraneo).length;
  const porCat = EXPOSITORES.reduce((m, e) => (m[e.categoria] = (m[e.categoria] || 0) + 1, m), {});
  console.log(`${EXPOSITORES.length} expositores: ${nF} foráneos, ${EXPOSITORES.length - nF} locales`);
  console.log(`sin WhatsApp: ${EXPOSITORES.filter(e => !e.wa).length} · sin Instagram: ${EXPOSITORES.filter(e => !e.ig).length} · sin rango: ${EXPOSITORES.filter(e => !e.rango).length} · con fotos: ${EXPOSITORES.filter(e => e.fotos.length).length}`);
  console.table(porCat);
}
