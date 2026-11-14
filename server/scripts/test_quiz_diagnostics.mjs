import assert from "node:assert/strict";
import { diagnosticDevice, normalizeDiagnosticPayload } from "../../shared/quizDiagnostics.mjs";
import { observeQuizDiagnostics } from "../../client/src/utils/quizDiagnosticsObserver.mjs";
import { startQuizDiagnostics } from "../../client/src/utils/quizDiagnosticsTransport.mjs";

class Clock {
  time=1700000000000; next=0; tasks=new Map();
  set=(fn,delay,repeat=false)=>{const id=++this.next;this.tasks.set(id,{fn,at:this.time+delay,delay,repeat});return id;};
  clear=id=>this.tasks.delete(id);
  advance(ms){const end=this.time+ms;for(;;){const entry=[...this.tasks].filter(([,task])=>task.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;const[id,task]=entry;this.time=task.at;if(task.repeat)task.at+=task.delay;else this.tasks.delete(id);task.fn();}this.time=end;}
}
const clock=new Clock();
const win=new EventTarget(),doc=new EventTarget();let focused=true,active=true;
Object.assign(win,{innerWidth:1024,innerHeight:768,screen:{width:1024,height:768,orientation:new EventTarget()},visualViewport:new EventTarget(),navigator:{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18.0 Safari/605.1.15',platform:'MacIntel',maxTouchPoints:5,onLine:true},crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(clock.next++).padStart(12,'0')}`},setTimeout:(f,t)=>clock.set(f,t),clearTimeout:clock.clear,setInterval:(f,t)=>clock.set(f,t,true),clearInterval:clock.clear});
Object.assign(win.visualViewport,{width:1024,height:768,scale:1,offsetLeft:0,offsetTop:0});win.screen.orientation.type='landscape-primary';
Object.assign(doc,{visibilityState:'visible',hasFocus:()=>focused,activeElement:{value:'Texto privado de respuesta',matches:()=>false}});
const samples=[];
const stop=observeQuizDiagnostics({window:win,document:doc,onSample:sample=>samples.push(sample),isActive:()=>active,now:()=>clock.time});
assert.equal(samples.length,1);focused=false;clock.advance(1000);assert.equal(samples.at(-1).motivos[0],'sondeo','Detecta un cambio de estado sin evento de foco');
win.visualViewport.height=400;doc.activeElement.matches=()=>true;win.visualViewport.dispatchEvent(new Event('resize'));clock.advance(250);assert(samples.at(-1).campo_activo);assert.equal(samples.at(-1).viewport_alto,400);
win.innerWidth=600;win.dispatchEvent(new Event('resize'));win.screen.orientation.dispatchEvent(new Event('change'));clock.advance(250);assert(samples.at(-1).motivos.includes('resize'));
const count=samples.length;active=false;clock.advance(31000);assert.equal(samples.length,count,'La captura no se extiende fuera de la prueba');stop();assert.equal(clock.tasks.size,0,'Limpia todos los observadores y temporizadores');
active=true;focused=true;
const brief=[];
const stopBrief=observeQuizDiagnostics({window:win,document:doc,onSample:value=>brief.push(value),isActive:()=>active,now:()=>clock.time});
focused=false;win.dispatchEvent(new Event('blur'));
assert.equal(brief.at(-1).foco,false,'Registra la pérdida de foco antes de que se recupere');
clock.advance(50);focused=true;win.dispatchEvent(new Event('focus'));
assert.equal(brief.at(-1).foco,true);assert.equal(brief.at(-2).foco,false);
assert.equal(brief.at(-2).motivos[0],'blur');assert.equal(brief.at(-1).motivos[0],'focus');
stopBrief();assert.equal(clock.tasks.size,0);
assert.equal(diagnosticDevice(win.navigator).sistema,'iPadOS');assert.equal(diagnosticDevice(win.navigator).version_sistema,null,'No confunde macOS simulado con la versión de iPadOS');
const raw={version:1,dispositivo:{...diagnosticDevice(win.navigator),nombre:'privado'},muestras:[{...samples[0],secuencia:1,pregunta_indice:0,faltas_observadas:0,respuestas:{q:'privado'},url:'private'}],captura:'private'};
const clean=normalizeDiagnosticPayload(raw);assert(!JSON.stringify(clean).includes('privado'));assert(!JSON.stringify(clean).includes('Texto privado'));assert(!Object.hasOwn(clean,'captura'));
const withRevision=normalizeDiagnosticPayload({...raw,muestras:[{...raw.muestras[0],detector_version:3}]});
assert.equal(withRevision.muestras[0].detector_version,3);
assert.equal(Object.hasOwn(clean.muestras[0],'detector_version'),false,'Las muestras antiguas no reciben una revisión inventada');
assert.equal(Object.hasOwn(normalizeDiagnosticPayload({...raw,muestras:[{...raw.muestras[0],detector_version:'privado'}]}).muestras[0],'detector_version'),false);
assert.throws(()=>normalizeDiagnosticPayload({...raw,muestras:Array(17).fill(raw.muestras[0])}));assert.throws(()=>normalizeDiagnosticPayload({...raw,muestras:[{...samples[0],motivos:['aplicacion_detectada']}]}));

// Lote estable después de perder la confirmación y después de recargar.
const storageMap=new Map();const storage={getItem:k=>storageMap.get(k),setItem:(k,v)=>storageMap.set(k,v)};
const realNow=Date.now;Date.now=()=>clock.time;
const calls=[];let failing=true;const server=new Set();
const api={saveDiagnostics:async(section,week,attempt,batch)=>{calls.push(structuredClone(batch));server.add(batch.id);if(failing)throw Error('confirmación perdida');return {success:true,data:{aceptado:true}};}};
const args={window:win,document:doc,storage,section:'s',week:1,account:'A',attemptId:'attempt',api,isActive:()=>true,getQuestion:()=>({pregunta_indice:1}),getFaults:()=>2};
const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
try{
 const end=startQuizDiagnostics(args);await settle();assert.equal(calls.length,1);assert.equal(calls[0].datos.muestras[0].detector_version,3);const firstId=calls[0].id;end();await settle();
 failing=false;const resumed=startQuizDiagnostics(args);await settle();assert.equal(calls[2].id,firstId,'La recarga reintenta exactamente el lote persistido');
 assert(server.has(firstId));assert.equal(calls.filter(batch=>batch.id===firstId).length,3,'La misma identidad permite deduplicar en el servidor');
 assert(!JSON.stringify(calls).includes('Texto privado'));assert.equal(calls.at(-1).datos.muestras.at(-1).faltas_observadas,2);
 resumed();await settle();assert.equal(clock.tasks.size,0);
 storageMap.set('histolab_diagnostic_v1_A_legacy',JSON.stringify({guardado_at:clock.time,registros:[{...samples[0],secuencia:1}],lote:null,total:1,lotes:0}));
 const beforeLegacy=calls.length;
 const legacy=startQuizDiagnostics({...args,attemptId:'legacy'});await settle();
 const mixed=calls[beforeLegacy].datos.muestras;
 assert.equal(Object.hasOwn(mixed[0],'detector_version'),false,'Una muestra antigua en cola no se etiqueta con el detector nuevo');
 assert.equal(mixed[1].detector_version,3,'La muestra nueva sí identifica el detector');
 legacy();await settle();assert.equal(clock.tasks.size,0);
}finally{Date.now=realNow;}
console.log('PASS diagnóstico: foco silencioso, teclado/rotación sin faltas, privacidad por campos permitidos, límites, reintento/recarga idempotente y limpieza.');
