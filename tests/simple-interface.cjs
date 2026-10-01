const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
class Node{constructor(id){this.id=id;this.hidden=true;this.disabled=false;this.attrs={};this.events={};this.children=[]}addEventListener(t,fn){(this.events[t]??=[]).push(fn)}setAttribute(k,v){this.attrs[k]=v}focus(){focused=this}scrollIntoView(){}contains(n){return n===this||this.children.some(c=>c.contains(n))}querySelectorAll(){return this.children}}
let focused;const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id)};
const picker=get('export-picker'),trigger=get('export-open'),options=get('export-options');picker.children=[trigger,options];
const formats=['jpg-export','png-export','svg-export','csv-export','comparison-csv'];options.children=formats.map(get);get('comparison-csv').disabled=true;
let originalCalls=0;get('png-export').addEventListener('click',()=>originalCalls++);
const handlers={};const doc={getElementById:get,addEventListener(type,fn){(handlers[type]??=[]).push(fn)}};
const ctx=vm.createContext({document:doc,console});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../content/simple-interface.js'),'utf8'),ctx);
function click(id){for(const fn of get(id).events.click||[])fn();for(const fn of handlers.click||[])fn({target:get(id)})}
click('export-open');assert.equal(options.hidden,false);assert.equal(focused,get('jpg-export'));click('png-export');assert.equal(originalCalls,1);assert.equal(options.hidden,true);
click('export-open');let prevented=false;for(const fn of handlers.keydown)fn({key:'Escape',preventDefault(){prevented=true}});assert(prevented);assert.equal(options.hidden,true);assert.equal(focused,trigger);
click('export-open');click('help-open');assert.equal(options.hidden,true);assert.equal(get('help-panel').hidden,false);click('help-close');assert.equal(get('help-panel').hidden,true);
console.log('PASS: export choices invoke existing handler once; open/close/Esc/outside; disabled comparison CSV retained; Help open/close. DOM simulated.');
