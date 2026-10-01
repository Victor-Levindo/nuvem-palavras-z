const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');const db=new Map(),extractions=[],logs=[];
function article(id,title,pdfIDs){return {id,key:'A'+id,libraryID:1,isNote:()=>false,isAttachment:()=>false,isRegularItem:()=>true,getAttachments:()=>pdfIDs,getField:()=>title}}
function pdf(id,parentID,text){return {id,parentID,key:'P'+id,libraryID:1,text,attachmentFilename:'pdf-'+id+'.pdf',attachmentContentType:'application/pdf',getFilePathAsync:async()=>'/local/'+id+'.pdf',isNote:()=>false,isAttachment:()=>true,isRegularItem:()=>false,getField:()=>''}}
for(const item of [article(1,'Título A',[101]),article(2,'Título B',[102]),article(3,'Sem texto',[103]),article(4,'Sem PDF',[]),pdf(101,1,'dados '.repeat(6)),pdf(102,2,'dados '.repeat(4)),pdf(103,3,'')])db.set(item.id,item);
const Zotero={Items:{getAsync:async id=>Array.isArray(id)?id.map(n=>db.get(n)):db.get(id)},PDFWorker:{getFullText:async id=>{extractions.push(id);return {text:db.get(id).text,totalPages:1,extractedPages:1}}},logError:error=>logs.push(error)};
const Services={prefs:{getStringPref:()=>''},prompt:{confirm:()=>true}};
const ctx=vm.createContext({console,Zotero,Services});
for(const f of ['content/core.js','content/article-analysis.js','plugin.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
(async()=>{
 const selection=[db.get(1),db.get(101),db.get(2),db.get(3),db.get(4)];
 const p=await ctx.NuvemZotero.buildMultiPayload({},selection,'Conjunto');
 assert.deepEqual(extractions,[101,102,103]);assert.equal(p.documents.length,2);assert.equal(p.documents[0].title,'Título A');assert.equal(p.documents[1].title,'Título B');
 assert.equal(p.documents[0].start,0);assert.equal(p.documents[1].start,db.get(101).text.length+1);
 assert.equal(p.text,db.get(101).text+'\f'+db.get(102).text);
 assert(p.coverage.includes('1 item(ns)'));assert(p.coverage.includes('1 PDF(s)'));
 const report=ctx.NuvemArticleAnalysis.count(p,p.text,'dados',p.options);assert.equal(report.ok,true);assert.deepEqual(Array.from(report.rows,r=>r.count),[6,4]);
 const single=await ctx.NuvemZotero.buildPayload({},[db.get(1)]);assert.equal(single.payload.documents.length,1);assert.equal(single.payload.documents[0].title,'Título A');assert.equal(ctx.NuvemArticleAnalysis.count(single.payload,single.payload.text,'dados',single.payload.options).total,6);
 const restored=JSON.parse(JSON.stringify(p));assert.equal(ctx.NuvemArticleAnalysis.count(restored,restored.text,'dados',restored.options).total,10);
 console.log('PASS: plugin records PDF order/title/ranges; same PDF deduplicated; failed/missing PDFs omitted with original coverage; one extraction per PDF; single and multi JSON round trip. Zotero APIs simulated.');
})().catch(e=>{console.error(e);process.exitCode=1});
