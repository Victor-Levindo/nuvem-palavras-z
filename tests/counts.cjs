const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');
const ctx = vm.createContext({console});
for (const file of ['content/core.js','content/article-analysis.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
const core=ctx.NuvemCore, analysis=ctx.NuvemArticleAnalysis;
const opts=core.mergeOptions({minFreq:2});
function payload(docs) {
  let start=0;
  return {text:docs.map(d=>d.text).join('\f'),documents:docs.map((doc,index)=>{
    const article={id:doc.articleID || index+1,key:'A'+(doc.articleID || index+1),getField:()=>doc.title};
    const pdf={id:index+101,parentID:article.id,libraryID:1,key:'P'+index,attachmentFilename:doc.title+'.pdf'};
    const record=analysis.sourceRecord(article,pdf,doc.text,start);start+=doc.text.length+1;return record;
  }),options:opts};
}
function query(p,q,o=opts){const r=analysis.count(p,p.text,q,o);assert.equal(r.ok,true);return r;}
let p=payload([6,4,5,0,1,7].map((n,i)=>({title:'Artigo '+String.fromCharCode(65+i),text:n?'dados '.repeat(n):'pesquisa'})));
let r=query(p,'dados');assert.deepEqual(Array.from(r.rows,row=>row.count),[6,4,5,0,1,7]);assert.equal(r.total,23);
assert.deepEqual(Array.from(r.rows,row=>row.title),['Artigo A','Artigo B','Artigo C','Artigo D','Artigo E','Artigo F']);
assert.equal(core.countWords(p.text,opts).rows.find(row=>row.word==='dados').count,r.total);
p=payload([{title:'A',text:'proteção de dados. proteção dos dados. proteção, dados.'},{title:'B',text:'protecao dados. proteção da informação.'},{title:'C',text:'memória cultural'}]);
r=query(p,'proteção + dados');assert.deepEqual(Array.from(r.rows,row=>row.count),[2,1,0]);
assert.deepEqual(Array.from(query(p,'proteção de dados').rows,row=>row.count),[1,0,0]);
assert.equal(query(p,'dados + proteção').total,0);
const compounds={...opts,compounds:'proteção + dados'};
assert.equal(query(p,'proteção+dados',compounds).total,3);
assert.equal(query(p,'dados',compounds).total,1);
assert.equal(query(p,'dados',{...compounds,consume:false}).total,4);
assert.equal(query(p,'dados',{...opts,exclude:'dados'}).total,0);
p=payload([{title:'A',text:'dado dados DADOS'},{title:'B',text:'dados'}]);
assert.deepEqual(Array.from(query(p,'dados',{...opts,group:true}).rows,row=>row.count),[3,1]);
assert.deepEqual(Array.from(query(p,'dados',{...opts,group:false}).rows,row=>row.count),[2,1]);
const body='dados proteção '.repeat(12)+'\nReferências\n dados dados';
p=payload([{title:'A',text:body}]);assert.equal(query(p,'dados').total,12);assert.equal(query(p,'dados',{...opts,references:false}).total,14);
p=payload([{title:'A',text:'proteção'},{title:'B',text:'dados'}]);assert.equal(query(p,'proteção + dados').total,0);
p=payload([{title:'A',articleID:5,text:'dados \f dados'},{title:'A',articleID:5,text:'dados dados dados'},{title:'B',articleID:6,text:'memória'}]);
r=query(p,'dados');assert.equal(r.rows.length,2);assert.equal(r.pdfCount,3);assert.deepEqual(Array.from(r.rows,row=>row.count),[5,0]);
assert.equal(analysis.count(p,p.text+' dados','dados',opts).reason,'edited');
assert.equal(analysis.count({...p,text:p.text+' dados'},p.text+' dados','dados',opts).reason,'edited');
const bad=JSON.parse(JSON.stringify(p));bad.documents[0].textHash='bad';assert.equal(analysis.sources(bad,bad.text).ok,false);
assert.equal(analysis.count({text:p.text},p.text,'dados',opts).reason,'missing');
assert.equal(analysis.count(p,p.text,'',opts).reason,'query');
assert.equal(analysis.count(p,p.text,'dados +',opts).reason,'query');
assert.equal(analysis.count(p,p.text,'dados\nproteção',opts).reason,'query');
r.rows[0].title='Artigo "A"; exemplo';const csv=analysis.toCSV(r);assert(csv.startsWith('\ufeff'));assert(csv.includes('"Artigo ""A""; exemplo"'));assert(csv.includes('"dados";"5"'));
// O SVG original deve guardar os registros e permitir reabrir a consulta sem outra extração.
vm.runInContext(fs.readFileSync(path.join(root,'content/theme.js'),'utf8'),ctx);
let createCanvas;
try { ({createCanvas}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@napi-rs/canvas' : '@napi-rs/canvas')); }
catch (_) { console.log('SKIP: SVG round trip requires optional @napi-rs/canvas.'); }
if (createCanvas) {
const doc={createElement:()=>createCanvas(1200,720)};
const svg=core.svg({...p,title:'Exemplo',options:opts,comparisonQuery:'dados'},doc).content;
const raw=svg.match(/<metadata id="nuvem-zotero-data">([\s\S]*?)<\/metadata>/)[1];
const unescape=s=>s.replace(/&(quot|apos|lt|gt|amp);/g,(_,key)=>({quot:'"',apos:"'",lt:'<',gt:'>',amp:'&'}[key]));
const reopened=JSON.parse(unescape(raw));assert.equal(reopened.comparisonQuery,'dados');assert.equal(query(reopened,'dados').total,5);
}
console.log('PASS: expected per-article counts; phrases/+; group; references; excluded/consumed words; zero/one; boundaries; same-article PDFs; stale/legacy metadata; CSV; actual SVG metadata round trip.');
