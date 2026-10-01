/* Lógica compartilhada: contagem, filtros, posicionamento e SVG.
   Carregado pelo plugin (loadSubScript) e pela janela da ferramenta (<script src>). */
var NuvemCore = (() => {
const normalize = w => w.toLocaleLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const STOPS = {
pt:`a à às ao aos as o os um uma uns umas de da das do dos em na nas no nos num numa para por pelo pela pelos pelas com sem sob sobre entre até após ante antes depois durante contra desde e ou mas nem que se caso como quando onde enquanto porque pois portanto porém contudo entretanto então também apenas ainda já muito muitos muita muitas mais menos pouco poucos pouca poucas todo todos toda todas outro outros outra outras qual quais qualquer cada algum alguns alguma algumas nenhum nenhuma este esta estes estas esse essa esses essas aquele aquela aqueles aquelas isto isso aquilo aqui ali lá eu tu ele ela eles elas nós vós vocês você me te lhe lhes nos vos meu minha meus minhas teu tua seus sua suas seu nosso nossa nossos nossas ter tem têm temos tinha tinham tive teve sido ser sou somos são é era eram foi foram será serão seja sejam estar está estão estava estavam estiver estou estamos há houve houver haver fazer faz fazem feito pode podem poderia poderão deve devem deveria vai vão ir vamos tanto quanto mesmo mesma mesmos mesmas próprio própria tais cujo cuja cujos cujas dessa desse desta deste naquele naquela assim vez vezes si não sim bem além através segundo mediante`,
en:`a an the and or but if then else when where while so because therefore however thus also just only very more most less least many much few several each all any some no none other another this that these those it its itself he his him she her hers they them their theirs themselves we us our ours you your yours yourself i me my mine is are was were be been being am do does did done doing have has had having can could may might must shall should will would not nor of in on at by to from for with without within into onto out about above below between among during before after since until through over under up down as than such both either neither which who whom whose what how why there here now then again once always often sometimes further own same against via per et al`,
es:`el la los las un una unos unas de del en al a con por para sin sobre entre y o pero que como cuando donde porque pues también muy más menos todo todos toda todas otro otros otra otras este esta estos estas ese esa esos esas aquel aquella aquellos aquellas esto eso aquello es son era eran fue fueron ser sido estar está están estaba estaban hay ha han haber tiene tienen tener puede pueden se su sus lo le les nos me te usted ustedes nosotros nuestra nuestro no sí ya así cada algún alguna algunos algunas ningún ninguna cual cuales quien quienes tanto cuanto después antes durante desde hasta`};
const COLORS = ['#245e52','#348775','#407c91','#af733c','#637744','#614e71','#335d70'];


const COMPOUND_COLOR = '#b3261e';
// + aceita preposições, artigos e contrações; normalização inclui à/às/até/após.
const CONNECTORS = new Set('a ante apos ate com contra de desde em entre para perante por sem sob sobre tras afora conforme consoante durante exceto fora mediante menos salvo segundo senão visto e o as os um uma uns umas ao aos da das do dos na nas no nos num numa nuns numas dum duma duns dumas pelo pela pelos pelas deste desta destes destas desse dessa desses dessas daquele daquela daqueles daquelas neste nesta nestes nestas nesse nessa nesses nessas naquele naquela naqueles naquelas disto disso daquilo nisto nisso naquilo of the and in for to'.split(' ').map(normalize));

const defaults = () => ({ limit: 90, minLength: 3, minFreq: 2, languages: ['pt','en'], exclude: '', references: true, rotate: false, group: false, compounds: '', consume: true });
const mergeOptions = saved => ({ ...defaults(), ...(saved || {}) });

const TOKEN = /\p{L}[\p{L}\p{M}]*(?:[-’'][\p{L}\p{M}]+)*/gu;
function tokenize(src) {
  const out = [];
  for (const m of src.matchAll(TOKEN)) out.push({ w: m[0], n: normalize(m[0]), s: m.index, e: m.index + m[0].length });
  return out;
}

function stripReferences(text, enabled) {
  if (!enabled) return { text, cut: false };
  const heading = /(?:^|\n)[ \t]*(?:\d+[.)]?\s+)?(?:refer[eê]ncias(?:\s+bibliogr[aá]ficas)?|references|bibliograf[ií]a|bibliography)[ \t]*\r?\n/gi;
  let found, chosen;
  while ((found = heading.exec(text))) if (found.index > text.length * 0.55) chosen = found;
  return chosen ? { text: text.slice(0, chosen.index), cut: true } : { text, cut: false };
}

// Prepara um documento: corta referências, junta hifenização e põe em minúsculas.
function prepare(doc, references) {
  const cleaned = stripReferences(doc, references);
  const source = cleaned.text
    .replace(/(\p{L})[-\u00ad‐][ \t]*\r?\n[ \t]*(?=\p{L})/gu, '$1')
    .replace(/\u00ad/g, '')
    .toLocaleLowerCase();
  return { source, cut: cleaned.cut };
}

// Agrupa singular e plural de forma simples (dados/dado, informações/informação).
function stem(k, ptes, en) {
  if (k.length <= 3) return k;
  if (ptes && k.endsWith('oes')) return k.slice(0, -3) + 'ao';
  if (en && !ptes && k.length > 4 && k.endsWith('ies')) return k.slice(0, -3) + 'y';
  if (ptes && k.length > 5 && k.endsWith('ais')) return k.slice(0, -3) + 'al';
  if (ptes && k.length > 5 && k.endsWith('eis')) return k.slice(0, -3) + 'el';
  if (ptes && k.length > 4 && k.endsWith('ns')) return k.slice(0, -2) + 'm';
  if (ptes && k.length > 5 && (k.endsWith('res') || k.endsWith('zes'))) return k.slice(0, -2);
  if (/(ss|is|us)$/.test(k)) return k;
  if (k.endsWith('s')) return k.slice(0, -1);
  return k;
}

// Lê a lista de expressões compostas, uma por linha.
// "proteção de dados"  -> frase exata.   "proteção + dados" -> aceita conectores (de, da, dos...) entre as partes.
function parseCompounds(text) {
  const specs = [];
  let lineNo = -1;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    lineNo++;
    const flexible = line.includes('+');
    const groups = (flexible ? line.split('+') : [line])
      .map(p => tokenize(p.toLocaleLowerCase()).map(t => t.n))
      .filter(g => g.length);
    const size = groups.reduce((s, g) => s + g.length, 0);
    if (size < 2) continue;
    specs.push({ index: lineNo, label: line, groups, flexible, size });
  }
  return specs;
}

function matchAt(tokens, i, spec, source) {
  const seq = [];
  let pos = i;
  for (let g = 0; g < spec.groups.length; g++) {
    const grp = spec.groups[g];
    const flexible = g > 0 && spec.flexible;
    const skipped = [];
    let p = pos;
    while (true) {
      const trial = [];
      let good = true;
      for (let k = 0; k < grp.length && good; k++) {
        const tok = tokens[p + k];
        const prev = trial[trial.length - 1] || skipped[skipped.length - 1] || seq[seq.length - 1];
        good = !!tok && tok.n === grp[k] && (!prev || /^\s+$/.test(source.slice(prev.e, tok.s)));
        if (good) trial.push(tok);
      }
      if (good) { seq.push(...skipped, ...trial); pos = p + grp.length; break; }
      const connector = tokens[p];
      const prev = skipped[skipped.length - 1] || seq[seq.length - 1];
      if (!flexible || !connector || !CONNECTORS.has(connector.n)
        || (prev && !/^\s+$/.test(source.slice(prev.e, connector.s)))) return null;
      skipped.push(connector); p++;
    }
  }
  return seq;
}

function stopsAndExcluded(opts) {
  const stops = new Set(opts.languages.flatMap(l => STOPS[l].split(/\s+/)).map(normalize));
  const ptes = opts.languages.includes('pt') || opts.languages.includes('es');
  const en = opts.languages.includes('en');
  const excluded = new Set();
  for (const x of String(opts.exclude || '').split(/[,;\n]+/).map(s => normalize(s.trim())).filter(Boolean)) {
    excluded.add(x);
    if (opts.group) excluded.add(stem(x, ptes, en));
  }
  return { stops, excluded, ptes, en };
}

function countWords(text, options) {
  const opts = mergeOptions(options);
  const { stops, excluded, ptes, en } = stopsAndExcluded(opts);
  const specs = parseCompounds(opts.compounds);
  const ordered = [...specs].sort((a, b) => b.size - a.size);
  const stats = new Map(specs.map(s => [s.index, { label: s.label, count: 0, forms: new Map() }]));
  const counts = new Map();
  let total = 0, retained = 0, cut = false;

  const add = (key, word, compound, specIndex) => {
    if (!counts.has(key)) counts.set(key, { key, count: 0, variants: new Map(), compound, specIndex });
    const row = counts.get(key);
    row.count++;
    row.variants.set(word, (row.variants.get(word) || 0) + 1);
  };

  for (const doc of String(text).split('\f')) {
    const prepared = prepare(doc, opts.references);
    if (prepared.cut) cut = true;
    const source = prepared.source;
    const tokens = tokenize(source);
    total += tokens.length;
    for (let i = 0; i < tokens.length;) {
      let hit = null;
      for (const spec of ordered) {
        const seq = matchAt(tokens, i, spec, source);
        if (seq) { hit = { spec, seq }; break; }
      }
      if (hit) {
        const form = hit.seq.map(t => t.w).join(' ');
        const st = stats.get(hit.spec.index);
        st.count++;
        st.forms.set(form, (st.forms.get(form) || 0) + 1);
        add('expr:' + hit.spec.index, form, true, hit.spec.index);
        retained++;
        if (opts.consume) { i += hit.seq.length; continue; }
      }
      const t = tokens[i++];
      const key = t.n;
      if (key.replace(/[^a-z\p{L}]/gu, '').length < opts.minLength || stops.has(key)) continue;
      const gkey = opts.group ? stem(key, ptes, en) : key;
      if (excluded.has(key) || excluded.has(gkey)) continue;
      retained++;
      add(gkey, t.w, false, -1);
    }
  }

  const rows = Array.from(counts.values())
    .filter(x => x.compound || x.count >= opts.minFreq)
    .map(x => ({
      key: x.key, count: x.count, compound: x.compound, specIndex: x.specIndex,
      word: Array.from(x.variants).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))[0][0]
    }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, 'pt-BR'));
  const compounds = specs.map(s => {
    const st = stats.get(s.index);
    return { label: st.label, count: st.count, forms: Array.from(st.forms).sort((a, b) => b[1] - a[1]) };
  });
  return { rows, total, retained, cut, compounds };
}

// Sugere pares/trios de palavras que aparecem juntos com frequência.
function suggestPhrases(text, options, max = 30) {
  const opts = mergeOptions(options);
  const { stops, excluded } = stopsAndExcluded({ ...opts, group: false });
  const ok = t => t.n.length >= Math.max(3, opts.minLength) && !stops.has(t.n) && !excluded.has(t.n);
  const gap = (a, b, src) => /^\s+$/.test(src.slice(a.e, b.s));
  const counts = new Map();
  const bump = phrase => {
    const k = normalize(phrase);
    const row = counts.get(k) || { phrase, count: 0 };
    row.count++;
    counts.set(k, row);
  };
  for (const doc of String(text).split('\f')) {
    const { source } = prepare(doc, opts.references);
    const tk = tokenize(source);
    for (let i = 0; i < tk.length; i++) {
      const a = tk[i], b = tk[i + 1], c = tk[i + 2];
      if (b && ok(a) && ok(b) && gap(a, b, source)) bump(a.w + ' ' + b.w);
      if (b && c && ok(a) && ok(c) && CONNECTORS.has(b.n) && gap(a, b, source) && gap(b, c, source)) bump(a.w + ' ' + b.w + ' ' + c.w);
    }
  }
  return Array.from(counts.values()).filter(r => r.count >= 2)
    .sort((x, y) => y.count - x.count || x.phrase.localeCompare(y.phrase, 'pt-BR')).slice(0, max);
}

// As N palavras mais frequentes + todas as expressões compostas pedidas.
function pickRows(rows, limit) {
  const top = rows.slice(0, limit);
  const extra = rows.filter(r => r.compound && !top.includes(r));
  return [...top, ...extra].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, 'pt-BR'));
}

function cloudLayout(rows, rotate, doc) {
  const canvas = doc.createElement('canvas'), ctx = canvas.getContext('2d');
  const placed = [], W = 1200, H = 720;
  const max = rows[0]?.count || 1, min = rows.at(-1)?.count || 1;
  const baseSize = row => max === min ? 38 : 19 + 69 * (Math.sqrt(row.count) - Math.sqrt(min)) / (Math.sqrt(max) - Math.sqrt(min));
  const area = rows.reduce((sum, row) => {
    const size = baseSize(row);
    ctx.font = `700 ${size}px Arial`;
    return sum + (ctx.measureText(row.word).width * 1.25 + 20) * (size * 1.3 + 8);
  }, 0);
  const densityScale = Math.min(1, Math.sqrt(W * H * .40 / Math.max(1, area)));
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const font = baseSize(row) * densityScale;
    const vertical = rotate && i > 5 && i % 7 === 0;
    let fit = null;
    for (let attempt = 0; attempt < 4 && !fit; attempt++) {
      const size = Math.max(12, Math.round(font * (1 - attempt * .16)));
      ctx.font = `700 ${size}px Arial`;
      const measured = ctx.measureText(row.word).width * 1.25 + 20, h = size * 1.3 + 8;
      const width = vertical ? h : measured, height = vertical ? measured : h;
      if (width > W - 40 || height > H - 40) continue;
      for (let step = 0; step < 3600; step++) {
        const angle = step * .34 + i * 1.13, r = 7.2 * Math.sqrt(step);
        const x = W / 2 + Math.cos(angle) * r * 1.5, y = H / 2 + Math.sin(angle) * r * .95;
        const left = x - width / 2, right = x + width / 2, top = y - height / 2, bottom = y + height / 2;
        if (left < 18 || right > W - 18 || top < 18 || bottom > H - 18) continue;
        if (placed.some(p => left < p.right && right > p.left && top < p.bottom && bottom > p.top)) continue;
        fit = { ...row, size, vertical, x, y, left, right, top, bottom, glyphWidth: (measured - 20) / 1.25 };
        break;
      }
    }
    if (fit) placed.push(fit);
  }
  return placed;
}

const escapeXML = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const colorOf = (w, i) => w.compound ? COMPOUND_COLOR : COLORS[i % COLORS.length];

// Gera o SVG que é salvo como anexo no Zotero (com os dados embutidos).
function svg(payload, doc) {
  const options = mergeOptions(payload.options);
  const result = countWords(payload.text, options);
  const words = cloudLayout(pickRows(result.rows, options.limit), options.rotate, doc);
  if (!words.length) throw new Error('Nenhuma palavra passou pelos filtros. O PDF pode conter pouco texto ou precisar de OCR.');
  const metadata = { ...payload, schema: 'nuvem-zotero/v1', options };
  const shapes = words.map((w, i) =>
    `<g transform="translate(${w.x.toFixed(2)} ${w.y.toFixed(2)})${w.vertical ? ' rotate(-90)' : ''}"><text text-anchor="middle" x="0" y="${(w.size * .34).toFixed(2)}" textLength="${w.glyphWidth.toFixed(2)}" lengthAdjust="spacingAndGlyphs" font-family="Arial, sans-serif" font-weight="700" font-size="${w.size}" fill="${colorOf(w, i)}">${escapeXML(w.word)}<title>${escapeXML(w.word)}: ${w.count} ocorrências</title></text></g>`).join('');
  const content = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720"><title>${escapeXML('Nuvem de palavras: ' + payload.title)}</title><metadata id="nuvem-zotero-data">${escapeXML(JSON.stringify(metadata))}</metadata><rect width="1200" height="720" fill="#ffffff"/>${shapes}</svg>`;
  return { content, words, rows: result.rows };
}

return { defaults, mergeOptions, countWords, suggestPhrases, pickRows, cloudLayout, svg, normalize, colorOf, COLORS, COMPOUND_COLOR };
})();
