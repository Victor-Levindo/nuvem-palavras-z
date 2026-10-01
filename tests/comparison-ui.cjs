const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
class Node {
 constructor(tag='div',id=''){this.tag=tag;this.id=id;this.attrs={};this.children=[];this.handlers={};this.textContent='';this.value='';this.checked=false;this.disabled=false;this.hidden=true;}
 getAttribute(k){return this.attrs[k]}
 setAttribute(k,v){this.attrs[k]=v}
 addEventListener(k,fn,capture=false){(this.handlers[k]??=[]).push({fn,capture})}
 appendChild(c){this.children.push(c);return c}
 replaceChildren(){this.children=[]}
 scrollIntoView(){}
 focus(){}
 contains(target){return target===this||this.children.some(child=>child.contains(target))}
 querySelector(selector){for(const child of this.children){if(selector.startsWith('.')&&child.attrs.class===selector.slice(1))return child;const found=child.querySelector(selector);if(found)return found}return null}
 querySelectorAll(selector){if(selector==='text.word')return this.wordNodes||[];return []}
}
const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,new Node('div',id));return nodes.get(id)};
for(const id of ['comparison-include','comparison-apply','comparison-expressions','expression-message','compound-rows','comparison-query','comparison-run','comparison-csv','comparison-cloud-mode','comparison-rows','comparison-table-wrap','comparison-summary','comparison-message','article-comparison','corpus','cloud','frequencies','min-length','min-freq','pt','en','es','exclude','references','group','compounds','consume'])get(id);
get('comparison-csv').disabled=true; // disabled no XHTML inicial
const observers=[],windowEvents={};class Observer{constructor(fn){this.fn=fn;observers.push(this)}observe(){}disconnect(){}}
const html=new Node('html');html.setAttribute('lang','pt-BR');
const documentHandlers={};
const document={addEventListener(type,fn){(documentHandlers[type]??=[]).push(fn)},getElementById:get,documentElement:html,createElementNS:(ns,tag)=>new Node(tag)};
const writes=[];const ctx=vm.createContext({document,console,MutationObserver:Observer,window:{addEventListener(k,fn){windowEvents[k]=fn}},TextEncoder,guard:fn=>fn,slug:()=> 'example',saveBytes:async(name,bytes)=>writes.push({name,text:new TextDecoder().decode(bytes)})});
for(const f of ['content/core.js','content/article-analysis.js','content/translations.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
let offset=0;const docs=['dados dados dados','memória'];
const payload={text:docs.join('\f'),documents:docs.map((text,i)=>{const record=ctx.NuvemArticleAnalysis.sourceRecord({id:i+1,key:'A'+i,getField:()=> 'Artigo '+(i+1)},{id:i+101,parentID:i+1,libraryID:1,attachmentFilename:'p.pdf'},text,offset);offset+=text.length+1;return record})};
ctx.testPayload=payload;ctx.currentOptions=ctx.NuvemCore.mergeOptions({minFreq:2});
get('corpus').value=payload.text;
vm.runInContext('let DATA=testPayload; let frequencies=NuvemCore.countWords(DATA.text,currentOptions).rows; let drawn=frequencies; let renderCalls=0; function getOptions(){return {...currentOptions,compounds:document.getElementById("compounds").value};} function render(){renderCalls++; currentOptions=getOptions(); frequencies=NuvemCore.countWords(document.getElementById("corpus").value,currentOptions).rows;} function err(message){throw new Error(message);}',ctx);
const frequencyRow=new Node('tr');frequencyRow.appendChild(new Node('td'));frequencyRow.appendChild(new Node('td'));get('frequencies').appendChild(frequencyRow);
const word=new Node('text');word.closest=()=>word;get('cloud').wordNodes=[word];
vm.runInContext(fs.readFileSync(path.join(root,'content/article-analysis-ui.js'),'utf8'),ctx);
function event(id,type,e={}){return Promise.all((get(id).handlers[type]||[]).map(({fn})=>fn(e)))}
const counts=()=>get('comparison-rows').children.map(row=>Number(row.children[1].textContent));
(async()=>{
 assert.equal(get('comparison-run').disabled,false);assert.equal(get('comparison-csv').disabled,true);
 const rowButton=frequencyRow.querySelector('.comparison-word');assert(rowButton);await Promise.all(rowButton.handlers.click.map(h=>h.fn()));assert.deepEqual(counts(),[3,0]);assert.equal(get('comparison-query').value,'dados');
 get('comparison-query').value='dados';await event('comparison-query','input');assert.equal(get('comparison-csv').disabled,true);let prevented=false;await event('comparison-query','keydown',{key:'Enter',preventDefault(){prevented=true}});assert(prevented);assert.deepEqual(counts(),[3,0]);
 await event('comparison-csv','click');assert.equal(writes.length,1);assert(writes[0].text.includes('"Artigo 1";"dados";"3"'));assert.equal(writes[0].name,'example-por-artigo.csv');
 let stopped=false;await event('cloud','click',{target:word,preventDefault(){},stopPropagation(){stopped=true}});assert.equal(stopped,false);
 get('comparison-cloud-mode').checked=true;await event('cloud','click',{target:word,preventDefault(){},stopPropagation(){stopped=true}});assert.equal(stopped,true);assert.deepEqual(counts(),[3,0]);
 ctx.currentOptions.exclude='dados';await event('exclude','change');assert.deepEqual(counts(),[0,0]);ctx.currentOptions.exclude='';await event('exclude','change');assert.deepEqual(counts(),[3,0]);
 html.setAttribute('lang','en');windowEvents['nuvem-languagechange']();assert.equal(get('comparison-summary').textContent,'2 articles · 3 occurrences');assert.equal(get('comparison-query').value,'dados');
 get('corpus').value=payload.text+' edit';await event('corpus','input');assert.equal(get('comparison-run').disabled,true);assert.equal(get('comparison-csv').disabled,true);assert.equal(get('comparison-table-wrap').hidden,true);
 get('corpus').value=payload.text;await event('corpus','input');assert.equal(get('comparison-run').disabled,false);assert.deepEqual(counts(),[3,0]);

 const expressionTexts=['proteção de dados. proteção dos dados.','proteção dados.'];
 let sourceOffset=0;
 const expressionPayload={text:expressionTexts.join('\f'),documents:expressionTexts.map((text,i)=>{const record=ctx.NuvemArticleAnalysis.sourceRecord({id:i+1,key:'A'+i,getField:()=> 'Artigo '+(i+1)},{id:i+101,parentID:i+1,libraryID:1,attachmentFilename:'p.pdf'},text,sourceOffset);sourceOffset+=text.length+1;return record})};
 ctx.expressionPayload=expressionPayload;vm.runInContext('DATA=expressionPayload;',ctx);get('corpus').value=expressionPayload.text;
 get('compounds').value='proteção + dados\nmemória + digital';ctx.currentOptions.compounds=get('compounds').value;
 const compoundRow=new Node('tr');const label=new Node('td');label.textContent='proteção + dados';compoundRow.appendChild(label);compoundRow.appendChild(new Node('td'));compoundRow.appendChild(new Node('td'));get('compound-rows').appendChild(compoundRow);
 await event('compounds','change');const compoundControl=compoundRow.querySelector('.comparison-compound');assert(compoundControl);await Promise.all(compoundControl.handlers.click.map(h=>h.fn()));assert.deepEqual(counts(),[2,1]);assert.equal(get('comparison-query').value,'proteção + dados');
 // Uma consulta não altera a lista nem redesenha a nuvem.
 get('comparison-query').value='proteção de dados';await event('comparison-query','input');
 assert.equal(get('comparison-include').disabled,false);
 const beforeList=get('compounds').value,beforeRender=vm.runInContext('renderCalls',ctx);
 await event('comparison-run','click');assert.deepEqual(counts(),[1,0]);assert.equal(get('compounds').value,beforeList);assert.equal(vm.runInContext('renderCalls',ctx),beforeRender);
 // Incluir usa o mesmo campo, preserva expressões anteriores e atualiza a nuvem.
 await event('comparison-include','click');assert.equal(get('comparison-expressions').open,true);assert.equal(get('compounds').value,beforeList+'\nproteção de dados');assert.equal(vm.runInContext('renderCalls',ctx),beforeRender+1);assert.deepEqual(counts(),[1,0]);
 assert(get('expression-message').textContent.includes('Expression added to the cloud list'));
 assert.equal(ctx.currentOptions.compounds,get('compounds').value); // opções originais usadas pelo salvamento
 // Duplicatas com diferenças de caixa, acento e espaços do + não criam outra linha.
 get('comparison-query').value='PROTECAO+  DADOS';await event('comparison-query','input');
 const included=get('compounds').value;await event('comparison-include','click');assert.equal(get('compounds').value,included);assert.deepEqual(counts(),[1,1]); // a expressão exata mais longa prevalece sobre a expressão com +, conforme o núcleo originalassert.equal(get('expression-message').textContent,'This expression is already in the cloud list.');
 // Mensagens e controles trocam de idioma; o texto pesquisado não é traduzido.
 html.setAttribute('lang','ja');windowEvents['nuvem-languagechange']();assert.equal(get('expression-message').textContent,'この表現はすでにクラウドの一覧にあります。');assert.equal(get('comparison-query').value,'PROTECAO+  DADOS');
 html.setAttribute('lang','pt-BR');windowEvents['nuvem-languagechange']();assert.equal(get('expression-message').textContent,'Essa expressão já está na lista da nuvem.');
 // Palavra simples continua consultável, mas não habilita inclusão como expressão.
 get('comparison-query').value='dados';await event('comparison-query','input');assert.equal(get('comparison-include').disabled,true);const simpleList=get('compounds').value;await event('comparison-include','click');assert.equal(get('compounds').value,simpleList);
 for(const invalid of ['','+++','proteção +','proteção\ndados']){get('comparison-query').value=invalid;await event('comparison-query','input');assert.equal(get('comparison-include').disabled,true);}
 // A lista reunida na consulta pode ser editada, aplicada e removida.
 get('compounds').value='proteção + dados';get('comparison-query').value='proteção+dados';await event('comparison-apply','click');assert.equal(ctx.currentOptions.compounds,'proteção + dados');assert.deepEqual(counts(),[2,1]);
 get('compounds').value='';get('comparison-query').value='dados';await event('comparison-apply','click');assert.equal(ctx.currentOptions.compounds,'');assert.deepEqual(counts(),[2,1]);
 // A inclusão de uma expressão na nuvem antiga funciona mesmo sem metadados de comparação.
 ctx.legacyPayload={text:expressionPayload.text};vm.runInContext('DATA=legacyPayload;',ctx);get('comparison-query').value='proteção de dados';await event('comparison-query','input');assert.equal(get('comparison-run').disabled,true);assert.equal(get('comparison-include').disabled,false);await event('comparison-include','click');assert.equal(get('compounds').value,'proteção de dados');assert.equal(get('comparison-csv').disabled,true);

 const serialized=JSON.stringify(payload);assert.equal(JSON.parse(serialized).comparisonQuery,'dados');
 console.log('PASS: row button/manual Enter/cloud query mode; normal cloud click preserved; counts incl zero; filter changes; independent CSV; language refresh; edited-text protection; remembered query; compound row query; unified single field/exact phrase and + counts; query preserves cloud/list; inclusion, duplicate handling, edits/removal, translated messages, single-word/invalid guards and legacy-cloud inclusion. DOM/Zotero window simulated.');
})().catch(e=>{console.error(e);process.exitCode=1});
