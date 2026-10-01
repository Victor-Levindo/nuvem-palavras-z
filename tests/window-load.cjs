/* Integração dos arquivos XHTML/JS reais em ordem de leitura.
   DOM e APIs do Zotero simulados; medição de texto com canvas real.
   Não abre o Zotero nem substitui o teste no aplicativo. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const dep=name=>require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,name):name);
const xml=dep('xml-js'),{createCanvas}=dep('@napi-rs/canvas');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const expectedFailure=process.argv.includes('--expect-failure');
const ids=new Map(),docEvents={},winEvents={},errors=[];
let doc;
class Node{
 constructor(tag,attrs={}){this.tag=tag;this.attrs={...attrs};this.children=[];this.parentNode=null;this.events={};this._text='';this.value=attrs.value||'';this.checked='checked'in attrs;this.disabled='disabled'in attrs;this.hidden='hidden'in attrs;this.style={};this.open='open'in attrs;}
 get id(){return this.attrs.id||''} get textContent(){return this._text+this.children.map(c=>c.textContent).join('')}
 set textContent(s){this._text=String(s);this.children=[]}
 getAttribute(k){return this.attrs[k]??null}setAttribute(k,v){this.attrs[k]=String(v)}setAttributeNS(ns,k,v){this.setAttribute(k,v)}
 appendChild(c){this.children.push(c);c.parentNode=this;if(c.id)ids.set(c.id,c);return c}
 replaceChildren(...nodes){this.children=[];this._text='';nodes.forEach(n=>this.appendChild(n))}
 addEventListener(t,fn){(this.events[t]??=[]).push(fn)}focus(){}scrollIntoView(){}
 contains(n){return n===this||this.children.some(c=>c.contains(n))}
 matches(s){if(s.startsWith('.'))return (this.attrs.class||'').split(' ').includes(s.slice(1));const attr=s.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);if(attr)return attr[1]in this.attrs&&(attr[2]===undefined||this.attrs[attr[1]]===attr[2]);if(s==='text.word')return this.tag==='text'&&(this.attrs.class||'').split(' ').includes('word');return this.tag===s}
 querySelectorAll(s){const all=[];for(const n of this.children){if(n.matches(s))all.push(n);all.push(...n.querySelectorAll(s))}return all}
 querySelector(s){return this.querySelectorAll(s)[0]||null}
}
doc={documentElement:null,body:null,getElementById:id=>ids.get(id)||null,createElement:tag=>tag==='canvas'?createCanvas(1200,720):new Node(tag),createElementNS:(ns,tag)=>new Node(tag),addEventListener:(t,fn)=>(docEvents[t]??=[]).push(fn)};
const texts=['proteção de dados. proteção para com os dados. dados dados.','proteção sob dados. dados dados.'];
const seed=vm.createContext({console});for(const f of ['core.js','article-analysis.js'])vm.runInContext(fs.readFileSync(path.join(root,'content',f),'utf8'),seed);
let offset=0;const payload={title:'Teste de abertura',pdf:'2 PDFs',text:texts.join('\f'),coverage:'Teste',options:seed.NuvemCore.mergeOptions({minFreq:1}),documents:texts.map((text,i)=>{const record=seed.NuvemArticleAnalysis.sourceRecord({id:i+1,getField:()=> 'Artigo '+(i+1)},{id:i+10,parentID:i+1,libraryID:1},text,offset);offset+=text.length+1;return record})};
const saved=[];const win={arguments:[{json:JSON.stringify(payload),save:async json=>{saved.push(JSON.parse(json));return 'Salvo';}}],addEventListener:(t,fn)=>(winEvents[t]??=[]).push(fn),dispatchEvent:e=>{for(const fn of winEvents[e.type]||[])fn(e)}};
win.document=doc;
const ctx=vm.createContext({document:doc,window:win,Services:{prefs:{getStringPref:()=>'',setStringPref(){},clearUserPref(){}},prompt:{alert(){}}},console:{log(){},error(...args){errors.push(args.join(' '))}},MutationObserver:class{observe(){}disconnect(){}},CustomEvent:class{constructor(type){this.type=type}},TextEncoder,setTimeout:()=>1,clearTimeout(){}});
const tree=xml.xml2js(fs.readFileSync(path.join(root,'content/cloud.xhtml'),'utf8'),{compact:false});
function parse(entry,parent){if(entry.type==='text'){if(parent){parent._text+=entry.text;if(parent.tag==='textarea')parent.value+=entry.text}return}if(entry.type!=='element')return;const n=new Node(entry.name,entry.attributes||{});if(parent)parent.appendChild(n);else if(n.id)ids.set(n.id,n);if(n.tag==='html')doc.documentElement=n;if(n.tag==='body')doc.body=n;for(const child of entry.elements||[])parse(child,n);if(n.tag==='script'&&n.attrs.src){try{vm.runInContext(fs.readFileSync(path.join(root,'content',n.attrs.src),'utf8'),ctx,{filename:n.attrs.src})}catch(e){errors.push(n.attrs.src+': '+e.message)}}}
for(const entry of tree.elements)parse(entry,null);
(async()=>{
 if(expectedFailure){assert(errors.some(e=>e.startsWith('cloud.js:')&&/null/.test(e)),errors.join('\n'));assert.equal(doc.getElementById('cloud').querySelectorAll('text.word').length,0);console.log('REPRODUCED: 0.9.3 loads cloud.js before corpus exists; initialization fails and cloud stays empty. '+errors.join(' | '));return;}
 assert.deepEqual(errors,[]);assert.equal(doc.getElementById('corpus').value,payload.text);assert(doc.getElementById('cloud').querySelectorAll('text.word').length>0);assert(vm.runInContext('drawn.length',ctx)>0);
 const query=doc.getElementById('comparison-query');query.value='proteção + dados';for(const fn of doc.getElementById('comparison-run').events.click)fn();
 assert.deepEqual(doc.getElementById('comparison-rows').children.map(row=>Number(row.children[1].textContent)),[2,1]);
 for(const fn of doc.getElementById('comparison-include').events.click)fn();assert.equal(doc.getElementById('compounds').value,'proteção + dados');assert(doc.getElementById('cloud').querySelectorAll('text.word').length>0);
 for(const fn of doc.getElementById('save-zotero').events.click)await fn();assert.equal(saved.length,1);assert.equal(saved[0].text,payload.text);assert.equal(saved[0].options.compounds,'proteção + dados');
 const en=doc.getElementById('language-options').querySelectorAll('[data-language]').find(n=>n.attrs['data-language']==='en');for(const fn of en.events.click)fn();assert.equal(doc.documentElement.getAttribute('lang'),'en');assert.equal(doc.getElementById('comparison-title').textContent,'Article lookup');
 assert.deepEqual(errors,[]);
 console.log('PASS: actual XHTML and all external scripts loaded in parser order; real canvas; initial cloud drawn; + query 2/1; expression included and cloud redrawn; original save handler sends text/options; language switch. DOM and Zotero APIs simulated.');
})().catch(e=>{console.error(e);process.exitCode=1});
