/* Nova aba pronta ao abrir a nuvem; a nuvem de texto conserva seus controles. */
(() => {
  const htmlNS='http://www.w3.org/1999/xhtml', el=id=>document.getElementById(id), tags=DATA.kind==='tags';
  let selectedKeyword=null, selectedTag=null;
  const t=source=>{const lang=document.documentElement.getAttribute('lang') || 'pt-BR'; return lang==='pt-BR'?source:NuvemTranslations[source]?.[lang] || NuvemTranslations[source]?.en || source;};
  const fmt=(source,values)=>t(source).replace(/\{(\w+)\}/g,(_,key)=>String(values[key] ?? ''));
  function label(node,source) { node.setAttribute('data-i18n',source); node.textContent=t(source); }
  function cell(row,value) {const node=document.createElementNS(htmlNS,'td');node.textContent=String(value ?? '');row.appendChild(node);return node;}
  function action(row,source,handler) {const node=document.createElementNS(htmlNS,'button');node.type='button';label(node,source);node.addEventListener('click',handler);cell(row,'').appendChild(node);return node;}
  function sourceButton(row,article) {
    const button=action(row,'Ver no Zotero',guard(async()=>{if(!ARG?.selectSource) throw new Error(t('O item de origem não está disponível nesta biblioteca.'));await ARG.selectSource(JSON.stringify({articleID:article.articleID,articleKey:article.articleKey,libraryID:article.libraryID}));}));
    button.disabled=!ARG?.selectSource;
  }
  function showTab(keyword) {
    el('text-cloud-panel').hidden=keyword;el('keyword-cloud-panel').hidden=!keyword;
    el('tag-origins').hidden=!tags || !selectedTag;
    document.querySelector('.workspace').classList.toggle('keyword-workspace',keyword);
    for(const [id,active] of [['text-cloud-tab',!keyword],['keyword-cloud-tab',keyword]]) {el(id).setAttribute('aria-selected',String(active));el(id).tabIndex=active?0:-1;}
  }
  el('text-cloud-tab').addEventListener('click',()=>showTab(false));
  el('keyword-cloud-tab').addEventListener('click',()=>showTab(true));
  for(const id of ['text-cloud-tab','keyword-cloud-tab']) el(id).addEventListener('keydown',event=>{
    if(tags || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();const keyword=event.key==='End' || (event.key!=='Home' && id==='text-cloud-tab');showTab(keyword);el(keyword?'keyword-cloud-tab':'text-cloud-tab').focus();
  });
  function drawKeywords() {
    const report=DATA.keywordReport, svg=el('keyword-cloud'), limit=Number(el('keyword-limit').value);
    el('keyword-limit-value').textContent=String(limit);svg.replaceChildren();
    const title=svgElement('title');title.textContent=t('Nuvem de palavras-chave')+': '+DATA.title;svg.appendChild(title);svg.appendChild(svgElement('rect',{width:1200,height:720,fill:'#ffffff'}));
    const words=NuvemCore.cloudLayout((report?.rows || []).slice(0,limit),false,document);
    for(const [index,word] of words.entries()) {
      const group=svgElement('g',{transform:`translate(${word.x.toFixed(2)} ${word.y.toFixed(2)})`});
      const text=svgElement('text',{'text-anchor':'middle',x:0,y:(word.size*.34).toFixed(2),textLength:word.glyphWidth.toFixed(2),lengthAdjust:'spacingAndGlyphs','font-family':'Arial, sans-serif','font-weight':700,'font-size':word.size,fill:NuvemCore.colorOf(word,index),class:'word',tabindex:0,role:'button','aria-label':word.word});
      text.textContent=word.word;const tip=svgElement('title');tip.textContent=fmt('{term}: {articles} artigos · {count} ocorrências',{term:word.word,articles:word.count,count:word.occurrences});text.appendChild(tip);
      text.addEventListener('click',()=>keywordOrigins(word.key));text.addEventListener('keydown',event=>{if(event.key==='Enter' || event.key===' '){event.preventDefault();keywordOrigins(word.key);}});group.appendChild(text);svg.appendChild(group);
    }
    if(!words.length) {const empty=svgElement('text',{x:600,y:355,'text-anchor':'middle',fill:'#716467','font-family':'Arial, sans-serif','font-size':20});empty.textContent=t('Palavras-chave não identificadas');svg.appendChild(empty);}
  }
  function keywordOrigins(key) {
    selectedKeyword=key;const report=DATA.keywordReport, term=report.rows.find(row=>row.key===key);
    if(!term) return;const body=el('keyword-origin-rows');body.replaceChildren();
    el('keyword-origin-summary').textContent=fmt('{term}: {articles} artigos · {count} ocorrências',{term:term.word,articles:term.count,count:term.occurrences});
    for(const article of report.articles) for(const pdf of article.pdfs) {
      const declared=pdf.declared.includes(key), count=pdf.counts[key] || 0;
      if(!declared && !count) continue;
      const row=document.createElementNS(htmlNS,'tr');cell(row,article.title);cell(row,article.libraryID+':'+article.articleKey);cell(row,(pdf.pdf || t('PDF'))+' ['+pdf.pdfKey+']');cell(row,t(declared?'Sim':'Não'));cell(row,count);
      const blocks=pdf.blocks.filter(block=>block.terms.some(term=>term.key===key));
      cell(row,blocks.map(block=>block.label+': '+block.snippet).join('\n') || t('Não declarada neste PDF'));sourceButton(row,article);body.appendChild(row);
    }
    el('keyword-origins').hidden=false;el('keyword-origins').scrollIntoView({block:'nearest'});
  }
  function keywordTables() {
    const report=DATA.keywordReport, body=el('keyword-rows'), coverage=el('keyword-coverage-rows');body.replaceChildren();coverage.replaceChildren();
    if(!report?.ok) {el('keyword-message').textContent=t('A identificação das palavras-chave não está disponível nesta nuvem. Gere uma nova nuvem dos artigos.');el('keyword-summary').textContent='';}
    else {
      const recognized=report.articles.filter(article=>article.declared.length).length;
      el('keyword-summary').textContent=fmt('{terms} palavras-chave · {found} de {total} artigos com listas identificadas',{terms:report.rows.length,found:recognized,total:report.articles.length});
      el('keyword-message').textContent=report.rows.length>500?t('A tabela mostra as primeiras 500 palavras-chave. O CSV contém todas as palavras-chave e suas origens.'):'';
      for(const term of report.rows.slice(0,500)) {const row=document.createElementNS(htmlNS,'tr');cell(row,term.word);cell(row,term.count);cell(row,term.occurrences);action(row,'Ver origem',()=>keywordOrigins(term.key));body.appendChild(row);}
      for(const article of report.articles) for(const pdf of article.pdfs) {const row=document.createElementNS(htmlNS,'tr');cell(row,article.title+' ['+article.articleKey+']');cell(row,pdf.pdf);cell(row,pdf.blocks.length?Array.from(new Set(pdf.blocks.flatMap(block=>block.terms.map(term=>term.word)))).join('; '):t('Palavras-chave não identificadas'));coverage.appendChild(row);}
    }
    for(const id of ['keyword-png','keyword-jpg','keyword-svg','keyword-csv']) el(id).disabled=!report?.rows.length;
    drawKeywords();if(selectedKeyword) keywordOrigins(selectedKeyword);
  }
  function tagOrigins(key) {
    selectedTag=key;const report=NuvemTerms.tagReport(DATA), term=report.rows.find(row=>row.key===key);if(!term) return;
    const body=el('tag-origin-rows');body.replaceChildren();el('tag-origin-summary').textContent=fmt('{term}: {items} itens',{term:term.word,items:term.count});
    for(const article of report.articles) if(article.tags.includes(key)) {const row=document.createElementNS(htmlNS,'tr');cell(row,article.title);cell(row,article.libraryID+':'+article.articleKey);sourceButton(row,article);body.appendChild(row);}
    el('tag-origins').hidden=false;el('tag-origins').scrollIntoView({block:'nearest'});
  }
  function tagTable() {
    if(!tags) return;
    el('status').textContent=fmt('{terms} tags manuais · {items} itens · {drawn} tags na nuvem',{terms:NuvemTerms.tagReport(DATA).rows.length,items:DATA.tagDocuments.length,drawn:drawn.length});
    for(const [index,row] of Array.from(el('frequencies').children).entries()) {
      const key=frequencies[index]?.key;if(!key) continue;
      const old=row.querySelector('.tag-origin-button');if(old) old.parentNode.remove();
      const button=action(row,'Ver origem',()=>tagOrigins(key));button.className='tag-origin-button';
    }
    if(frequencies.length) {el('notice').hidden=false;label(el('notice'),'Clique em uma tag para consultar os itens de origem. Para ignorar uma tag, escreva seu nome completo na lateral, uma por linha.');}
    if(selectedTag) tagOrigins(selectedTag);
  }
  if(tags) {
    for(const paragraph of el('help-panel').querySelectorAll('p')) paragraph.hidden=paragraph.id!=='tags-help';
    el('keyword-cloud-tab').hidden=true;label(el('text-cloud-tab'),'Tags manuais');
    label(document.querySelector('aside h2'),'Ajustar tags');label(document.querySelector('.visualhead h2'),'Tags manuais');
    label(document.querySelector('label[for="limit"]'),'Quantidade de tags');label(document.querySelector('label[for="min-freq"]'),'Mín. de itens');label(document.querySelector('label[for="exclude"]'),'Tags para ignorar');
    el('exclude').setAttribute('placeholder',t('Uma tag completa por linha'));el('exclude').setAttribute('data-i18n-placeholder','Uma tag completa por linha');
    el('cloud').setAttribute('aria-label',t('Nuvem de tags'));el('cloud').setAttribute('data-i18n-aria-label','Nuvem de tags');
    el('min-length').parentNode.hidden=true;document.querySelector('aside .grid2').style.gridTemplateColumns='1fr';
    document.querySelector('aside .checks').hidden=true;document.querySelector('aside .checks').previousElementSibling.hidden=true;
    el('references').parentNode.hidden=true;el('group').parentNode.hidden=true;el('article-comparison').hidden=true;el('comparison-csv').hidden=true;
    el('source').textContent=t('Tags manuais dos itens e de seus anexos');el('source').setAttribute('data-i18n','Tags manuais dos itens e de seus anexos');
    label(el('csv-export'),'Tags e origens CSV');label(document.querySelector('#frequencies').closest('table').querySelector('th'),'Tag');
    label(document.querySelector('#frequencies').closest('table').querySelectorAll('th')[1],'Itens com a tag');label(document.querySelector('#frequencies').closest('table').querySelectorAll('th')[2],'Origem');
    label(document.querySelector('#frequencies').closest('details').querySelector('summary'),'Ver tabela de tags');
    label(document.querySelector('#frequencies').closest('details').querySelector('p'),'Cada tag é contada uma vez por item. Apenas tags manuais são incluídas.');
    label(document.querySelector('label[for="limit"] + input + p span'),'tags · de 15 a 150');
    el('notice').hidden=false;label(el('notice'),'Clique em uma tag para consultar os itens de origem. Para ignorar uma tag, escreva seu nome completo na lateral, uma por linha.');
    window.addEventListener('nuvem-tag-select',event=>tagOrigins(event.detail));window.addEventListener('nuvem-rendered',tagTable);tagTable();
  } else {NuvemTerms.attachKeywords(DATA);el('keyword-limit').value=String(Math.max(15,Math.min(150,Number(DATA.keywordLimit) || 90)));keywordTables();}
  const mirrorMessage=new MutationObserver(()=>{el('keyword-export-message').textContent=el('export-message').textContent;});mirrorMessage.observe(el('export-message'),{childList:true,subtree:true,characterData:true});
  el('keyword-save').addEventListener('click',()=>el('save-zotero').click());
  el('keyword-limit').addEventListener('input',()=>{el('keyword-limit-value').textContent=el('keyword-limit').value;});
  el('keyword-limit').addEventListener('change',()=>{DATA.keywordLimit=Number(el('keyword-limit').value);drawKeywords();});
  el('keyword-png').addEventListener('click',guard(()=>exportImage('png','keyword-cloud','-palavras-chave')));
  el('keyword-jpg').addEventListener('click',guard(()=>exportImage('jpeg','keyword-cloud','-palavras-chave')));
  el('keyword-svg').addEventListener('click',guard(()=>saveBytes(slug()+'-palavras-chave.svg',new TextEncoder().encode(svgSource('keyword-cloud')))));
  el('keyword-csv').addEventListener('click',guard(()=>saveBytes(slug()+'-palavras-chave-origens.csv',new TextEncoder().encode(NuvemTerms.keywordsCSV(DATA.keywordReport,[t('Palavra-chave'),t('Artigos que a declaram'),t('Ocorrências nos textos'),t('Artigo'),t('Identificador do artigo'),t('PDF'),t('Declarada neste PDF?'),t('Ocorrências neste PDF'),t('Cabeçalho'),t('Lista declarada no PDF')])))));
  window.addEventListener('nuvem-languagechange',()=>{if(tags) tagTable();else keywordTables();});
  showTab(false);
})();
