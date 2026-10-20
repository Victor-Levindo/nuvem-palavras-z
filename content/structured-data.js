/* Tags manuais e palavras-chave declaradas. Não modifica o contador da nuvem de texto. */
var NuvemTerms = (() => {
  const clean = value => String(value || '').normalize('NFKC').replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim();
  const keyOf = value => NuvemCore.normalize(clean(value)).replace(/[‐‑–]/g, '-');
  const articleKey = source => source.libraryID + ':' + (source.articleID || source.articleKey || source.pdfID);
  const tagDefaults = () => ({...NuvemCore.defaults(), minLength:1, minFreq:1, languages:[], references:false, group:false, compounds:'', consume:false});
  function manualTags(item) {
    const tags = typeof item?.getTags === 'function' ? item.getTags() : [];
    return tags.filter(tag => tag.type === undefined || tag.type === 0)
      .map(tag => clean(tag.tag)).filter(Boolean);
  }
  function tagReport(payload) {
    const terms = new Map(), articles = [];
    for (const source of payload.tagDocuments || []) {
      const seen = new Set();
      const article = {...source, id:articleKey(source), tags:[]};
      for (const raw of source.tags || []) {
        const word = clean(raw), key = keyOf(word);
        if (!key || seen.has(key)) continue;
        seen.add(key); article.tags.push(key);
        if (!terms.has(key)) terms.set(key, {key, word, count:0});
        terms.get(key).count++;
      }
      articles.push(article);
    }
    const rows = Array.from(terms.values()).sort((a,b) => b.count-a.count || a.word.localeCompare(b.word,'pt-BR'));
    return {ok:true, rows, articles};
  }
  function countTags(payload, options) {
    const report = tagReport(payload);
    // Uma tag inteira por linha, inclusive quando a própria tag contém vírgulas.
    const excluded = new Set(String(options.exclude || '').split(/\r?\n/).map(keyOf).filter(Boolean));
    const rows = report.rows.filter(row => row.count >= options.minFreq && !excluded.has(row.key));
    return {rows, total:report.rows.reduce((n,row) => n+row.count,0), retained:rows.length, compounds:[], cut:false};
  }

  const LABEL = /(?<![\p{L}\p{N}])(?:palavras[\s‐‑–-]*chave|key[\s‐‑–-]*words?|palabras[\s‐‑–-]*clave|mots[\s‐‑–-]*cl[eé]s|schl[uü]sselw[oö]rter|schlagw[oö]rter|descritores|descriptores|关键词|关键字|關鍵詞|關鍵字|キーワード)[ \t]*(?:[:：]|[—–-][ \t]+|(?=\r?\n))/giu;
  const SECTION = /^(?:\d+(?:\.\d+)*[.)]?\s+)?(?:resumo|abstract|resumen|r[eé]sum[eé]|zusammenfassung|introdu[cç][aã]o|introduction|introducci[oó]n|introduktion|refer[eê]ncias|references|bibliograf[ií]a|bibliography|considera[cç][oõ]es|conclus[aã]o|conclusion|metodologia|methodology|received|recebido|aceito|accepted|doi\s*:|https?:|e-?mail\s*:|摘要|引言|要旨|序論)(?:\b|\s|[:：]|$)/iu;
  const INLINE_SECTION = /[.!?]\s+(?:(?:\d+(?:\.\d+)*[.)]?\s+)?(?:resumo|abstract|resumen|introdu[cç][aã]o|introduction|introducci[oó]n|introduktion))\b/iu;
  function keywordBlocks(text) {
    const input = String(text || '').replace(/\r\n?/g,'\n');
    const labels = Array.from(input.matchAll(new RegExp(LABEL.source,LABEL.flags)));
    const blocks = [];
    for (let index=0; index<labels.length; index++) {
      const match = labels[index], start = match.index+match[0].length;
      let tail = input.slice(start, Math.min(start+1600, labels[index+1]?.index ?? input.length));
      const inlineEnd = tail.search(INLINE_SECTION);
      if (inlineEnd >= 0) tail = tail.slice(0,inlineEnd+1);
      const lines = tail.split('\n'), kept = [];
      for (let i=0; i<Math.min(lines.length,14); i++) {
        const line = lines[i].trim();
        if (!line) { if (kept.length) break; else continue; }
        if (SECTION.test(line) || /^\d+(?:\.\d+)+[.)]?\s+\p{L}/u.test(line) || /^\d{1,4}$/u.test(line)) break;
        // Parágrafos do corpo não são listas de descritores.
        if ((line.match(/\p{L}+/gu) || []).length > 45) break;
        if (kept.length && /[.。]$/.test(kept.at(-1)) && !/[;；,，]/.test(line)) break;
        kept.push(line);
      }
      let list = kept.join('\n').replace(/(\p{L})[-\u00ad‐][ \t]*\n[ \t]*(?=\p{L})/gu,'$1');
      // Listas em linhas ou com marcadores; quebras dentro de uma expressão são preservadas como espaços.
      list = list.replace(/\n\s*[•●▪]\s*/g,';').replace(/\n(?=\s*\d+[.)]\s)/g,';');
      const chunks = list.split(/[;；,，、•●▪]|[.。](?=\s|$)/u);
      const terms = [];
      for (let part of chunks) {
        part = clean(part).replace(/^\d+[.)]\s*/,'').replace(/^[\s:：•●▪"“”«»]+|[\s;；,，:："“”«»]+$/g,'');
        const words = part.match(/[\p{L}\p{N}]+/gu) || [];
        if (!part || part.length>160 || words.length>16 || !/\p{L}/u.test(part) || SECTION.test(part) || /https?:\/\//i.test(part)) continue;
        terms.push({key:'kw:'+keyOf(part), word:part});
      }
      const unique = Array.from(new Map(terms.map(term => [term.key,term])).values());
      if (unique.length) blocks.push({label:clean(match[0]).replace(/[:：]$/,''), start:match.index, snippet:clean(kept.join(' ')).slice(0,1200), terms:unique});
    }
    return blocks;
  }
  function foldedText(text) {
    return keyOf(String(text).replace(/(\p{L})[-\u00ad‐][ \t]*\r?\n[ \t]*(?=\p{L})/gu,'$1'));
  }
  function occurrences(folded, term) {
    const target=keyOf(term);
    if (!target) return 0;
    const cjk=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(term);
    const characters=Array.from(target), word=character=>!!character && /[\p{L}\p{N}_]/u.test(character);
    let total=0,cursor=0;
    while (cursor<folded.length) {
      const index=folded.indexOf(target,cursor);if(index<0) break;
      const end=index+target.length, before=index?Array.from(folded.slice(Math.max(0,index-2),index)).at(-1):'',after=end<folded.length?String.fromCodePoint(folded.codePointAt(end)):'';
      const left=word(before) || (!word(characters[0]) && before===characters[0]);
      const right=word(after) || (!word(characters.at(-1)) && after===characters.at(-1));
      if(cjk || (!left && !right)) {total++;cursor=end;} else cursor=index+1;
    }
    return total;
  }
  function keywordReport(payload) {
    const available = NuvemArticleAnalysis.sources(payload,payload.text);
    if (!available.ok) return {schema:'nuvem-keywords/v1', ok:false, reason:available.reason, articles:[], rows:[]};
    const articles = new Map(), terms = new Map(), prepared = [];
    for (const doc of available.docs) {
      const id=articleKey(doc), blocks=keywordBlocks(doc.text);
      if (!articles.has(id)) articles.set(id,{id,articleID:doc.articleID,articleKey:doc.articleKey,libraryID:doc.libraryID,title:doc.title,pdfs:[],declared:[],counts:{}});
      const article=articles.get(id), declared=new Set(article.declared);
      const pdf={pdfID:doc.pdfID,pdfKey:doc.pdfKey,pdf:doc.pdf,blocks,declared:[],counts:{}};
      const pdfTerms=new Set();
      for (const block of blocks) for (const term of block.terms) {
        if (!terms.has(term.key)) terms.set(term.key,{key:term.key,word:term.word,count:0,occurrences:0,variants:[]});
        const row=terms.get(term.key);
        if (!row.variants.includes(term.word)) row.variants.push(term.word);
        declared.add(term.key); pdfTerms.add(term.key);
      }
      article.declared=Array.from(declared); pdf.declared=Array.from(pdfTerms); article.pdfs.push(pdf);
      prepared.push({article,pdf,text:foldedText(doc.text)});
    }
    // Conta também os textos que usam o termo sem o declarar como palavra-chave.
    for (const part of prepared) for (const row of terms.values()) {
      const count=occurrences(part.text,row.word);
      if (count) {
        part.pdf.counts[row.key]=count;
        part.article.counts[row.key]=(part.article.counts[row.key] || 0)+count;
        row.occurrences+=count;
      }
    }
    for (const article of articles.values()) for (const key of article.declared) terms.get(key).count++;
    return {schema:'nuvem-keywords/v1',ok:true,textHash:NuvemArticleAnalysis.textHash(payload.text),articles:Array.from(articles.values()),rows:Array.from(terms.values()).sort((a,b)=>b.count-a.count || b.occurrences-a.occurrences || a.word.localeCompare(b.word,'pt-BR'))};
  }
  function attachKeywords(payload) {
    if (payload.kind==='tags') return payload;
    const previous=payload.keywordReport;
    if (previous?.schema==='nuvem-keywords/v1' && previous.ok && Array.isArray(previous.articles) && Array.isArray(previous.rows) && previous.textHash===NuvemArticleAnalysis.textHash(payload.text)) return payload;
    try { payload.keywordReport=keywordReport(payload); }
    catch (error) { payload.keywordReport={schema:'nuvem-keywords/v1',ok:false,reason:'error',articles:[],rows:[]}; }
    return payload;
  }
  function quote(value) {
    let text=String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  }
  const csv = rows => '\ufeff'+rows.map(row=>row.map(quote).join(';')).join('\r\n');
  function keywordsCSV(report,labels=['Palavra-chave','Artigos que a declaram','Ocorrências nos textos','Artigo','Identificador do artigo','PDF','Declarada neste PDF?','Ocorrências neste PDF','Cabeçalho','Lista declarada no PDF']) {
    const rows=[labels];
    for (const term of report.rows) for (const article of report.articles) for (const pdf of article.pdfs) {
      const declared=pdf.declared.includes(term.key), count=pdf.counts[term.key] || 0;
      if (!declared && !count) continue;
      const blocks=pdf.blocks.filter(block=>block.terms.some(t=>t.key===term.key));
      rows.push([term.word,term.count,term.occurrences,article.title,article.libraryID+':'+article.articleKey,pdf.pdf,declared?'Sim':'Não',count,blocks.map(b=>b.label).join(' | '),blocks.map(b=>b.snippet).join(' | ')]);
    }
    return csv(rows);
  }
  function tagsCSV(payload,labels=['Tag','Itens com a tag','Item','Identificador do item'],options=null) {
    const report=tagReport(payload), rows=[labels];
    const visible=options?countTags(payload,options).rows:report.rows;
    for (const term of visible) for (const article of report.articles) if (article.tags.includes(term.key)) rows.push([term.word,term.count,article.title,article.libraryID+':'+article.articleKey]);
    return csv(rows);
  }
  function svgTags(payload,doc) {
    const options={...tagDefaults(),...(payload.options || {})};
    const result=countTags(payload,options), words=NuvemCore.cloudLayout(result.rows.slice(0,options.limit),options.rotate,doc);
    if (!words.length) throw new Error('Nenhuma tag manual passou pelos filtros.');
    const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
    const shapes=words.map((w,i)=>`<g transform="translate(${w.x.toFixed(2)} ${w.y.toFixed(2)})${w.vertical?' rotate(-90)':''}"><text text-anchor="middle" x="0" y="${(w.size*.34).toFixed(2)}" textLength="${w.glyphWidth.toFixed(2)}" lengthAdjust="spacingAndGlyphs" font-family="Arial, sans-serif" font-weight="700" font-size="${w.size}" fill="${NuvemCore.colorOf(w,i)}">${escape(w.word)}<title>${escape(w.word)}: ${w.count} itens</title></text></g>`).join('');
    return {words,rows:result.rows,content:`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720"><title>${escape('Nuvem de tags: '+payload.title)}</title><metadata id="nuvem-zotero-data">${escape(JSON.stringify({...payload,schema:'nuvem-zotero/v1',options}))}</metadata><rect width="1200" height="720" fill="#ffffff"/>${shapes}</svg>`};
  }
  return {clean,keyOf,manualTags,tagDefaults,tagReport,countTags,keywordBlocks,occurrences,foldedText,keywordReport,attachKeywords,keywordsCSV,tagsCSV,svgTags};
})();
