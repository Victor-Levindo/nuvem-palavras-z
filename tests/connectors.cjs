const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const ctx=vm.createContext({console});for(const f of ['core.js','article-analysis.js'])vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../content',f),'utf8'),ctx);
const core=ctx.NuvemCore,analysis=ctx.NuvemArticleAnalysis;
const connectors='a à às ao aos ante após até com contra de desde em entre para perante por sem sob sobre trás afora conforme consoante durante exceto fora mediante menos salvo segundo senão visto e o as os um uma uns umas da das do dos na nas no nos num numa nuns numas dum duma duns dumas pelo pela pelos pelas deste desta destes destas desse dessa desses dessas daquele daquela daqueles daquelas neste nesta nestes nestas nesse nessa nesses nessas naquele naquela naqueles naquelas disto disso daquilo nisto nisso naquilo'.split(' ');
const options=core.mergeOptions({minFreq:1,languages:[],compounds:'proteção + dados'});
function n(text,opts=options){return core.countWords(text,opts).compounds[0].count;}
for(const connector of connectors)assert.equal(n('proteção '+connector+' dados'),1,connector);
for(const gap of ['','para com os','em uma das','a e o','por uma das','de\n\tos'])assert.equal(n('proteção '+gap+' dados'),1,gap);
for(const text of ['dados de proteção','proteção importante dos dados','proteção, de dados','proteção de, dados','proteção. dados','proteção\f de dados','proteção digital dados'])assert.equal(n(text),0,text);
assert.equal(n('proteção dos dados',{...options,compounds:'proteção de dados'}),0);
assert.equal(n('proteção de dados',{...options,compounds:'proteção de dados'}),1);
assert.equal(n('proteção de direitos para com os dados',{...options,compounds:'proteção + direitos + dados'}),1);
assert.equal(n('protecao para os dados'),1);assert.equal(n('proteção of the dados'),1);
let start=0;const parts=['proteção a e o dados. proteção para com os dados.','proteção sob dados.','proteção importante dados.'];
const payload={text:parts.join('\f'),documents:parts.map((text,i)=>{const rec=analysis.sourceRecord({id:i+1,getField:()=> 'Artigo '+i},{id:i+100,parentID:i+1,libraryID:1},text,start);start+=text.length+1;return rec})};
const report=analysis.count(payload,payload.text,'proteção + dados',{...options,compounds:''});assert(report.ok);assert.deepEqual(Array.from(report.rows,r=>r.count),[2,1,0]);assert.equal(report.total,3);
console.log('PASS: '+connectors.length+' Portuguese connector forms; multi-connector sequences; exact phrases; multiple + groups; accents; original English connectors; order/content/punctuation/PDF boundaries; actual per-article counts 2/1/0.');
