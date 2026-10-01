/* Consulta por artigo. Reutiliza NuvemCore; não altera seu algoritmo.
   Textos não são duplicados: cada PDF guarda título e intervalo no corpus. */
var NuvemArticleAnalysis = (() => {
  const clean = value => NuvemCore.normalize(String(value || '').trim()).replace(/\s+/g, ' ').replace(/\s*\+\s*/g, ' + ');
  // Verificação de alterações acidentais, não é uma assinatura de segurança.
  function textHash(text) {
    let a = 2166136261, b = 5381;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      a = Math.imul(a ^ c, 16777619);
      b = Math.imul(b, 33) ^ c;
    }
    return text.length + ':' + (a >>> 0).toString(16) + ':' + (b >>> 0).toString(16);
  }
  function sourceRecord(article, pdf, text, start) {
    let title = '';
    try { title = article.getField('title'); } catch (_) {}
    const articleID = pdf.parentID || article.id || pdf.id;
    return {
      articleID, libraryID: pdf.libraryID, articleKey: article.key || String(articleID),
      title: title || pdf.attachmentFilename || 'PDF',
      pdfID: pdf.id, pdfKey: pdf.key || String(pdf.id),
      pdf: pdf.attachmentFilename || '', start, end: start + text.length,
      textHash: textHash(text)
    };
  }
  function sources(payload, text) {
    if (!Array.isArray(payload.documents) || !payload.documents.length) return {ok:false, reason:'missing'};
    if (String(text) !== String(payload.text)) return {ok:false, reason:'edited'};
    let cursor = 0;
    const docs = [];
    for (const record of payload.documents) {
      if (!Number.isInteger(record.start) || !Number.isInteger(record.end) || record.start !== cursor
        || record.end < record.start || record.end > text.length) return {ok:false, reason:'edited'};
      const part = text.slice(record.start, record.end);
      if (record.textHash !== textHash(part)) return {ok:false, reason:'edited'};
      docs.push({...record, text:part});
      cursor = record.end + 1;
      if (record.end < text.length && text[record.end] !== '\f') return {ok:false, reason:'edited'};
    }
    if (cursor !== text.length + 1) return {ok:false, reason:'edited'};
    return {ok:true, docs};
  }
  function target(query, options) {
    const value = String(query || '').trim();
    const tokens = value.match(/\p{L}[\p{L}\p{M}]*(?:[-’'][\p{L}\p{M}]+)*/gu) || [];
    if (!value || /[\r\n\f]/.test(value) || !tokens.length) return {ok:false, reason:'query'};
    const opts = {...NuvemCore.mergeOptions(options), minFreq:1};
    if (tokens.length === 1 && !value.includes('+')) {
      // Obtém a chave de agrupamento pelo próprio núcleo, sem copiar a regra de plural.
      const probe = NuvemCore.countWords(tokens[0], {...opts, compounds:'', exclude:'', minLength:1});
      return {ok:true, options:opts, key:probe.rows[0]?.key || NuvemCore.normalize(tokens[0]), label:value};
    }
    if (tokens.length < 2 || value.split('+').some(part => !/\p{L}/u.test(part))) return {ok:false, reason:'query'};
    const lines = String(opts.compounds || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    let index = lines.findIndex(line => clean(line) === clean(value));
    if (index < 0) { index = lines.length; lines.push(value); }
    opts.compounds = lines.join('\n');
    return {ok:true, options:opts, key:'expr:' + index, label:value};
  }
  function count(payload, text, query, options) {
    const available = sources(payload, text);
    if (!available.ok) return available;
    const selected = target(query, options);
    if (!selected.ok) return selected;
    const articles = new Map();
    let total = 0;
    for (const doc of available.docs) {
      const result = NuvemCore.countWords(doc.text, selected.options);
      const occurrences = result.rows.find(row => row.key === selected.key)?.count || 0;
      const id = doc.libraryID + ':' + (doc.articleID || doc.articleKey || doc.pdfID);
      if (!articles.has(id)) articles.set(id, {
        id, articleID:doc.articleID, articleKey:doc.articleKey, libraryID:doc.libraryID,
        title:doc.title, count:0, pdfs:[]
      });
      const article = articles.get(id);
      article.count += occurrences;
      article.pdfs.push(doc.pdf);
      total += occurrences;
    }
    return {ok:true, query:selected.label, key:selected.key, rows:Array.from(articles.values()), total, pdfCount:available.docs.length};
  }
  function toCSV(report, labels = ['Artigo','Consulta','Ocorrências']) {
    const quote = value => '"' + String(value).replace(/"/g, '""') + '"';
    const rows = [labels, ...report.rows.map(row => [row.title, report.query, row.count])];
    return '\ufeff' + rows.map(row => row.map(quote).join(';')).join('\r\n');
  }
  return {textHash, sourceRecord, sources, target, count, toCSV};
})();
