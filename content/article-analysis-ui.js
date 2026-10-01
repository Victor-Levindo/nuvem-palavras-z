/* Controles adicionais. As funções e eventos originais de cloud.js permanecem intactos. */
(() => {
  const htmlNS = 'http://www.w3.org/1999/xhtml';
  const el = id => document.getElementById(id);
  const input = el('comparison-query');
  const button = el('comparison-run');
  const csvButton = el('comparison-csv');
  const clickMode = el('comparison-cloud-mode');
  const includeButton = el('comparison-include');
  const expressionPanel = el('comparison-expressions');
  let expressionMessage = '';
  let report = null;
  function t(source) {
    const lang = document.documentElement.getAttribute('lang') || 'pt-BR';
    return lang === 'pt-BR' ? source : NuvemTranslations[source]?.[lang] || NuvemTranslations[source]?.en || source;
  }
  function setText(node, text) { if (node.textContent !== text) node.textContent = text; }
  function format(source, values) { return t(source).replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? '')); }
  function clearReport() {
    report = null;
    csvButton.disabled = true;
    el('comparison-rows').replaceChildren();
    el('comparison-table-wrap').hidden = true;
    el('comparison-summary').textContent = '';
  }
  function availability() {
    const state = NuvemArticleAnalysis.sources(DATA, el('corpus').value);
    button.disabled = !state.ok;
    clickMode.disabled = !state.ok;
    refreshIncludeButton();
    return state;
  }
  function showProblem(reason) {
    clearReport();
    const source = reason === 'missing'
      ? 'Esta nuvem não possui a identificação dos artigos. Selecione os artigos e gere uma nova nuvem nesta versão.'
      : reason === 'edited'
        ? 'O texto reunido foi editado e não pode mais ser separado por artigo com segurança. Gere uma nova nuvem dos artigos para esta consulta.'
        : 'Digite uma palavra ou uma expressão válida. Use + com a mesma ordem das palavras no texto.';
    setText(el('comparison-message'), t(source));
  }
  function renderReport() {
    const rows = el('comparison-rows');
    rows.replaceChildren();
    if (!report) return;
    for (const article of report.rows) {
      const tr = document.createElementNS(htmlNS, 'tr');
      const name = document.createElementNS(htmlNS, 'td');
      name.textContent = article.title;
      name.setAttribute('title', article.pdfs.filter(Boolean).join('\n'));
      const count = document.createElementNS(htmlNS, 'td');
      count.textContent = String(article.count);
      tr.appendChild(name); tr.appendChild(count); rows.appendChild(tr);
    }
    el('comparison-table-wrap').hidden = false;
    csvButton.disabled = false;
    setText(el('comparison-message'), t('Resultado da consulta:') + ' ' + report.query);
    setText(el('comparison-summary'), format('{articles} artigos · {total} ocorrências', {articles:report.rows.length, total:report.total}));
  }
  function query() {
    const state = availability();
    if (!state.ok) { showProblem(state.reason); return; }
    const result = NuvemArticleAnalysis.count(DATA, el('corpus').value, input.value, getOptions());
    if (!result.ok) { showProblem(result.reason); return; }
    report = result;
    DATA.comparisonQuery = report.query; // o salvamento original inclui os novos metadados
    renderReport();
  }
  function selectWord(row) {
    const options = getOptions();
    input.value = row.compound
      ? String(options.compounds || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)[row.specIndex] || row.word
      : row.word;
    query();
    el('article-comparison').scrollIntoView({block:'nearest'});
  }
  function selectExpression(expression) {
    input.value = expression;
    query();
    el('article-comparison').scrollIntoView({block:'nearest'});
  }
  function refreshIncludeButton() {
    const selected = NuvemArticleAnalysis.target(input.value, getOptions());
    includeButton.disabled = !selected.ok || !selected.key.startsWith('expr:');
  }
  function showExpressionMessage(source) {
    expressionMessage = source;
    setText(el('expression-message'), t(source));
  }
  includeButton.addEventListener('click', () => {
    const options = getOptions();
    const selected = NuvemArticleAnalysis.target(input.value, options);
    if (!selected.ok || !selected.key.startsWith('expr:')) return;
    const lines = String(options.compounds || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const added = Number(selected.key.slice(5)) >= lines.length;
    if (added) {
      lines.push(input.value.trim());
      el('compounds').value = lines.join('\n');
    }
    expressionPanel.open = true;
    try {
      render(); // utiliza a geração original, sem substituir a contagem ou o salvamento
      refreshQuery();
      showExpressionMessage(added ? 'Expressão adicionada à lista da nuvem. Use Salvar no Zotero para gravar o ajuste.' : 'Essa expressão já está na lista da nuvem.');
    } catch (error) { err('Erro ao gerar a nuvem: ' + error.message); }
  });
  el('comparison-apply').addEventListener('click', () => {
    try { render(); refreshQuery(); showExpressionMessage('Expressões aplicadas. Use Salvar no Zotero para gravar o ajuste.'); }
    catch (error) { err('Erro ao gerar a nuvem: ' + error.message); }
  });
  button.addEventListener('click', query);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); query(); }
  });
  input.addEventListener('input', () => {
    refreshIncludeButton();
    showExpressionMessage('');
    clearReport();
    const state = availability();
    if (!state.ok) showProblem(state.reason);
    else setText(el('comparison-message'), '');
  });
  csvButton.addEventListener('click', guard(async () => {
    if (!report) return;
    const csv = NuvemArticleAnalysis.toCSV(report, [t('Artigo'), t('Consulta'), t('Ocorrências')]);
    await saveBytes(slug() + '-por-artigo.csv', new TextEncoder().encode(csv));
  }));
  // Modo explícito: apenas quando marcado, o clique deixa de executar a exclusão original.
  el('cloud').addEventListener('click', event => {
    if (!clickMode.checked || clickMode.disabled) return;
    const text = event.target.closest?.('text.word');
    if (!text) return;
    const texts = Array.from(el('cloud').querySelectorAll('text.word'));
    const row = drawn[texts.indexOf(text)];
    if (!row) return;
    event.preventDefault(); event.stopPropagation();
    selectWord(row);
  }, true);
  const frequencyBody = el('frequencies');
  const compoundBody = el('compound-rows');
  const observer = new MutationObserver(() => {
    decorateRows();
    if (input.value.trim()) query();
  });
  function decorateRows() {
    observer.disconnect();
    try {
      const state = availability();
      Array.from(frequencyBody.children).forEach((tr, index) => {
        const row = frequencies[index];
        if (!row) return;
        let control = tr.querySelector('.comparison-word');
        if (!control) {
          const cell = document.createElementNS(htmlNS, 'td');
          control = document.createElementNS(htmlNS, 'button');
          control.setAttribute('type', 'button');
          control.setAttribute('class', 'comparison-word');
          control.setAttribute('data-i18n', 'Por artigo');
          control.addEventListener('click', () => selectWord(row));
          cell.appendChild(control); tr.appendChild(cell);
        }
        control.disabled = !state.ok;
        setText(control, t('Por artigo'));
      });
      Array.from(compoundBody.children).forEach(tr => {
        const expression = tr.children[0]?.textContent;
        if (!expression) return;
        let control = tr.querySelector('.comparison-compound');
        if (!control) {
          const cell = document.createElementNS(htmlNS, 'td');
          control = document.createElementNS(htmlNS, 'button');
          control.setAttribute('type', 'button');
          control.setAttribute('class', 'comparison-compound');
          control.setAttribute('data-i18n', 'Por artigo');
          control.addEventListener('click', () => selectExpression(expression));
          cell.appendChild(control); tr.appendChild(cell);
        }
        control.disabled = !state.ok;
        setText(control, t('Por artigo'));
      });
    } finally {
      observer.observe(frequencyBody, {childList:true, subtree:true});
      observer.observe(compoundBody, {childList:true, subtree:true});
    }
  }
  function refreshQuery() {
    decorateRows();
    const state = availability();
    if (!state.ok) showProblem(state.reason);
    else if (input.value.trim()) query();
    else setText(el('comparison-message'), '');
  }
  for (const id of ['min-length','min-freq','pt','en','es','exclude','references','group','compounds','consume']) el(id).addEventListener('change', refreshQuery);
  el('corpus').addEventListener('input', refreshQuery);
  window.addEventListener('nuvem-languagechange', () => {
    decorateRows();
    if (expressionMessage) setText(el('expression-message'), t(expressionMessage));
    if (report) renderReport();
    else refreshQuery();
  });
  if (typeof DATA.comparisonQuery === 'string') input.value = DATA.comparisonQuery;
  refreshQuery();
})();
