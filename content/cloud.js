'use strict';
/* Janela da ferramenta. Roda com permissões do Zotero, então grava arquivos
   diretamente (FilePicker + IOUtils). Não há actors nem página remota. */
const NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);
const PREF = 'extensions.nuvem-palavras.defaults';
const ARG = (() => { const a = window.arguments && window.arguments[0]; return a && (a.wrappedJSObject || a); })();

let DATA;
try {
  DATA = JSON.parse(ARG.json);
} catch (e) {
  document.body.textContent = 'Não foi possível carregar os dados da nuvem: ' + e;
  throw e;
}

let frequencies = [], drawn = [];

function msg(text) { $('export-message').textContent = text; }
function err(text) { $('error').textContent = text; }

/* ---------- Opções ---------- */

function getOptions() {
  return {
    limit: Number($('limit').value),
    minLength: Math.max(1, Math.min(20, Number($('min-length').value) || 3)),
    minFreq: Math.max(1, Math.min(9999, Number($('min-freq').value) || 1)),
    languages: ['pt', 'en', 'es'].filter(x => $(x).checked),
    exclude: $('exclude').value,
    references: $('references').checked,
    rotate: $('rotate').checked,
    group: $('group').checked,
    compounds: $('compounds').value,
    consume: $('consume').checked
  };
}

function applyOptions(o) {
  o = NuvemCore.mergeOptions(o);
  $('limit').value = String(Math.max(15, Math.min(150, Math.round((Number(o.limit) || 90) / 15) * 15)));
  $('limit-value').textContent = $('limit').value;
  $('min-length').value = o.minLength;
  $('min-freq').value = o.minFreq;
  $('exclude').value = o.exclude || '';
  for (const l of ['pt', 'en', 'es']) $(l).checked = (o.languages || []).includes(l);
  $('references').checked = !!o.references;
  $('rotate').checked = !!o.rotate;
  $('group').checked = !!o.group;
  $('compounds').value = o.compounds || '';
  $('consume').checked = o.consume !== false;
}

function savedDefaults() {
  try { const s = Services.prefs.getStringPref(PREF, ''); return s ? JSON.parse(s) : null; }
  catch (e) { return null; }
}

/* ---------- Desenho ---------- */

function svgElement(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function removeCompoundLine(specIndex) {
  let n = -1;
  $('compounds').value = $('compounds').value.split(/\r?\n/).filter(line => {
    if (!line.trim()) return true;
    n++;
    return n !== specIndex;
  }).join('\n');
}

function drawCloud(words) {
  const svg = $('cloud');
  svg.replaceChildren();
  const title = svgElement('title');
  title.textContent = 'Nuvem de palavras: ' + DATA.title;
  svg.appendChild(title);
  svg.appendChild(svgElement('rect', { width: 1200, height: 720, fill: '#ffffff' }));
  words.forEach((w, i) => {
    const g = svgElement('g', { transform: `translate(${w.x.toFixed(2)} ${w.y.toFixed(2)})${w.vertical ? ' rotate(-90)' : ''}` });
    const t = svgElement('text', {
      'text-anchor': 'middle', x: 0, y: (w.size * .34).toFixed(2),
      textLength: w.glyphWidth.toFixed(2), lengthAdjust: 'spacingAndGlyphs',
      'font-family': 'Arial, sans-serif', 'font-weight': 700, 'font-size': w.size,
      fill: NuvemCore.colorOf(w, i), class: 'word'
    });
    t.textContent = w.word;
    const tip = svgElement('title');
    tip.textContent = `${w.word}: ${w.count} ocorrências. ` + (w.compound ? 'Clique para remover a expressão.' : 'Clique para ignorar.');
    t.appendChild(tip);
    t.addEventListener('click', () => {
      if (w.compound) removeCompoundLine(w.specIndex);
      else {
        const before = $('exclude').value.trim();
        $('exclude').value = before ? before + ', ' + w.word : w.word;
      }
      render();
    });
    g.appendChild(t);
    svg.appendChild(g);
  });
  if (!words.length) {
    const empty = svgElement('text', { x: 600, y: 355, 'text-anchor': 'middle', fill: '#647a78', 'font-family': 'Arial, sans-serif', 'font-size': 22 });
    empty.textContent = 'Nenhuma palavra passou pelos filtros.';
    svg.appendChild(empty);
  }
}

function cell(tr, text) {
  const td = document.createElement('td');
  td.textContent = String(text);
  tr.appendChild(td);
}

function render() {
  const options = getOptions();
  const result = NuvemCore.countWords($('corpus').value, options);
  frequencies = result.rows;
  drawn = NuvemCore.cloudLayout(NuvemCore.pickRows(frequencies, options.limit), options.rotate, document);
  drawCloud(drawn);
  $('status').textContent = `${result.total.toLocaleString('pt-BR')} palavras no texto analisado · ${frequencies.length.toLocaleString('pt-BR')} termos após os filtros · ${drawn.length} palavras na nuvem`;
  const expected = Math.min(options.limit, frequencies.length);
  const notes = [
    result.cut ? 'A seção final de referências foi retirada por reconhecimento do título. Desmarque a opção para incluir o texto completo.' : '',
    !drawn.length ? 'Reduza a frequência mínima ou revise o texto para obter resultados.' : '',
    drawn.length && drawn.length < expected ? 'Algumas palavras não couberam na imagem. Suas frequências continuam disponíveis no CSV.' : ''
  ].filter(Boolean);
  $('notice').textContent = notes.join(' ');
  $('notice').hidden = notes.length === 0;

  const body = $('frequencies');
  body.replaceChildren();
  for (const row of frequencies.slice(0, 500)) {
    const tr = document.createElement('tr');
    cell(tr, row.word);
    cell(tr, row.count);
    body.appendChild(tr);
  }

  const cbody = $('compound-rows');
  cbody.replaceChildren();
  $('compound-panel').hidden = result.compounds.length === 0;
  for (const c of result.compounds) {
    const tr = document.createElement('tr');
    cell(tr, c.label);
    cell(tr, c.count);
    cell(tr, c.forms.map(([f, n]) => `${f} (${n})`).join(', '));
    cbody.appendChild(tr);
  }

  for (const id of ['jpg-export', 'png-export', 'svg-export', 'csv-export']) $(id).disabled = frequencies.length === 0;
  err('');
}

function slug() {
  return NuvemCore.normalize(DATA.title).replace(/[^a-z0-9]+/g, '-').slice(0, 80).replace(/^-|-$/g, '') || 'artigo';
}

/* ---------- Salvamento de arquivos ---------- */

async function pickPath(name, ext) {
  let FilePicker = null;
  try {
    ({ FilePicker } = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs'));
  } catch (e) { console.error('[Nuvem] FilePicker do Zotero indisponível, usando o do sistema', e); }
  if (FilePicker) {
    const fp = new FilePicker();
    fp.init(window, 'Salvar ' + ext.toUpperCase(), fp.modeSave);
    fp.appendFilter(ext.toUpperCase(), '*.' + ext);
    fp.defaultString = name;
    fp.defaultExtension = ext;
    const answer = await fp.show();
    return (answer === fp.returnOK || answer === fp.returnReplace) ? fp.file : null;
  }
  const nfp = Components.classes['@mozilla.org/filepicker;1'].createInstance(Components.interfaces.nsIFilePicker);
  nfp.init(window.browsingContext, 'Salvar ' + ext.toUpperCase(), Components.interfaces.nsIFilePicker.modeSave);
  nfp.appendFilter(ext.toUpperCase(), '*.' + ext);
  nfp.defaultString = name;
  nfp.defaultExtension = ext;
  const rv = await new Promise(resolve => nfp.open(resolve));
  const ok = rv === Components.interfaces.nsIFilePicker.returnOK || rv === Components.interfaces.nsIFilePicker.returnReplace;
  return ok ? nfp.file.path : null;
}

async function saveBytes(name, bytes) {
  const ext = name.split('.').pop().toLowerCase();
  const safeName = name.replace(/[\\/:*?"<>|]/g, '-');
  msg('Escolha onde salvar o arquivo…');
  const path = await pickPath(safeName, ext);
  if (!path) { msg('Salvamento cancelado.'); return; }
  await IOUtils.write(path, bytes);
  msg('Arquivo salvo em: ' + path);
}

function guard(fn) {
  return async () => {
    try { await fn(); }
    catch (e) { console.error('[Nuvem]', e); msg('Não foi possível concluir: ' + (e && e.message || e)); }
  };
}

function svgSource() {
  const clone = $('cloud').cloneNode(true);
  clone.setAttribute('xmlns', NS);
  clone.setAttribute('width', '1200');
  clone.setAttribute('height', '720');
  return '<?xml version="1.0" encoding="UTF-8"?>' + new XMLSerializer().serializeToString(clone);
}

function exportImage(format) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 2400; c.height = 1440;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(async blob => {
          try {
            if (!blob) throw new Error('Não foi possível gerar a imagem.');
            const bytes = new Uint8Array(await blob.arrayBuffer());
            await saveBytes(slug() + '-nuvem.' + (format === 'jpeg' ? 'jpg' : 'png'), bytes);
            resolve();
          } catch (e) { reject(e); }
        }, 'image/' + format, .95);
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('Não foi possível renderizar a imagem.'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgSource());
  });
}

$('csv-export').addEventListener('click', guard(async () => {
  const quote = s => '"' + String(s).replace(/"/g, '""') + '"';
  const csv = '\ufeffPalavra;Ocorrências\r\n' + frequencies.map(r => quote(r.word) + ';' + r.count).join('\r\n');
  await saveBytes(slug() + '-frequencias.csv', new TextEncoder().encode(csv));
}));
$('svg-export').addEventListener('click', guard(async () => {
  await saveBytes(slug() + '-nuvem.svg', new TextEncoder().encode(svgSource()));
}));
$('png-export').addEventListener('click', guard(() => exportImage('png')));
$('jpg-export').addEventListener('click', guard(() => exportImage('jpeg')));

/* ---------- Gravar no Zotero / padrões ---------- */

$('save-zotero').hidden = false;
$('save-zotero').addEventListener('click', async () => {
  const btn = $('save-zotero'), label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Gravando…';
  msg('Gravando no Zotero…');
  console.log('[Nuvem] clique em Salvar no Zotero');
  let text;
  try {
    if (!ARG || !ARG.save) throw new Error('esta janela não está ligada ao plugin. Feche e abra a nuvem de novo pelo Zotero.');
    const payload = { ...DATA, text: $('corpus').value, options: getOptions() };
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('o Zotero não respondeu em 20 segundos.')), 20000));
    text = await Promise.race([ARG.save(JSON.stringify(payload)), timeout]);
    if (typeof text !== 'string') text = 'Concluído, mas o Zotero não enviou confirmação.';
  } catch (e) {
    console.error('[Nuvem]', e);
    text = 'Não foi possível gravar no Zotero: ' + (e && e.message || e);
  }
  btn.disabled = false;
  btn.textContent = label;
  msg(text);
  try { Services.prompt.alert(window, 'Nuvem de palavras', text); } catch (e) { /* mensagem já exibida na tela */ }
});

$('save-defaults').addEventListener('click', guard(async () => {
  Services.prefs.setStringPref(PREF, JSON.stringify(getOptions()));
  msg('Ajustes salvos como padrão para as próximas nuvens.');
}));
$('reset-defaults').addEventListener('click', guard(async () => {
  try { Services.prefs.clearUserPref(PREF); } catch (e) { /* já estava limpo */ }
  applyOptions(NuvemCore.defaults());
  render();
  msg('Ajustes de fábrica restaurados.');
}));

/* ---------- Sugestões de expressões ---------- */

$('suggest').addEventListener('click', guard(async () => {
  const box = $('suggestions');
  box.replaceChildren();
  const existing = new Set($('compounds').value.split(/\r?\n/).map(l => NuvemCore.normalize(l.trim())));
  const list = NuvemCore.suggestPhrases($('corpus').value, getOptions(), 30)
    .filter(p => !existing.has(NuvemCore.normalize(p.phrase)));
  if (!list.length) { box.textContent = 'Nenhuma sugestão encontrada com os filtros atuais.'; return; }
  for (const p of list) {
    const b = document.createElement('button');
    b.textContent = `${p.phrase} (${p.count})`;
    b.addEventListener('click', () => {
      const cur = $('compounds').value.replace(/\s+$/, '');
      $('compounds').value = cur ? cur + '\n' + p.phrase : p.phrase;
      b.remove();
      render();
    });
    box.appendChild(b);
  }
}));

/* ---------- Controles ---------- */

$('limit').addEventListener('input', () => { $('limit-value').textContent = $('limit').value; });
$('limit').addEventListener('change', () => render());
$('generate').addEventListener('click', () => {
  try { render(); } catch (e) { err('Erro ao gerar a nuvem: ' + e.message); }
});

/* ---------- Início ---------- */

$('article-title').textContent = DATA.title;
$('source').textContent = 'PDF: ' + DATA.pdf;
$('coverage').textContent = DATA.coverage;
$('corpus').value = DATA.text;
document.title = 'Nuvem · ' + DATA.title;
applyOptions(DATA.options ? DATA.options : savedDefaults());
try { render(); } catch (e) { err('Erro ao gerar a nuvem: ' + e.message); }
