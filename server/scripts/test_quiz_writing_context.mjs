// Navegador y reloj simulados, sin red ni respuestas reales.
import assert from 'node:assert/strict';
import { isQuizWritingField, observeQuizDiagnostics } from '../../client/src/utils/quizDiagnosticsObserver.mjs';
import { observeQuizActivity } from '../../client/src/utils/quizActivityObserver.mjs';

const field = ({ type = 'text', marked = true, disabled = false, readOnly = false, connected = true } = {}) => ({
  readOnly, isConnected: connected,
  matches: selector => selector === '[data-quiz-writing]' ? marked : selector === ':disabled' ? disabled :
    selector === 'textarea,input[type="text"],input:not([type])' ? ['text', 'textarea'].includes(type) : true
});
assert(isQuizWritingField(field()));assert(isQuizWritingField(field({type:'textarea'})));
for (const options of [{type:'radio'},{type:'checkbox'},{type:'select'},{marked:false},{disabled:true},{readOnly:true},{connected:false}]) {
  assert.equal(isQuizWritingField(field(options)),false,JSON.stringify(options));
}
assert.equal(isQuizWritingField(null),false);

let time=0,next=0,focused=true,active=true;
const tasks=new Map();
const set=(fn,delay,repeat=false)=>{const id=++next;tasks.set(id,{fn,at:time+delay,delay,repeat});return id;};
const advance=ms=>{const end=time+ms;for(;;){const entry=[...tasks].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;const[id,t]=entry;time=t.at;if(t.repeat)t.at+=t.delay;else tasks.delete(id);t.fn();}time=end;};
const win=new EventTarget(),doc=new EventTarget();
Object.assign(win,{innerWidth:820,innerHeight:1048,visualViewport:new EventTarget(),setTimeout:(fn,ms)=>set(fn,ms),clearTimeout:id=>tasks.delete(id),setInterval:(fn,ms)=>set(fn,ms,true),clearInterval:id=>tasks.delete(id)});
Object.assign(win.visualViewport,{width:820,height:1048,scale:1});
Object.assign(doc,{visibilityState:'visible',hasFocus:()=>focused,activeElement:null});
const samples=[],events=[];let state={faltas:0,episodio_abierto:null};
const endActivity=observeQuizActivity({window:win,document:doc,isActive:()=>active,getState:()=>state,explicitReturn:true,makeId:()=>String(++next),onEvent:event=>{events.push(event);state={faltas:state.faltas+1,episodio_abierto:event.episodio_id};}});
const endDiagnostics=observeQuizDiagnostics({window:win,document:doc,isActive:()=>active,onSample:s=>samples.push(s),now:()=>time});
const emit=(type,target)=>{const event=new Event(type);Object.defineProperty(event,'target',{value:target});doc.dispatchEvent(event);};
const writer=field();
doc.activeElement=writer;emit('focusin',writer);win.visualViewport.height=640;win.visualViewport.dispatchEvent(new Event('resize'));advance(250);
assert.equal(samples.at(-1).campo_editable_activo,true);assert.equal(samples.at(-1).escritura_reciente,true);assert.equal(events.length,0);
// Un foco muy breve conserva contexto aunque la muestra agrupada ya no tenga campo.
emit('focusout',writer);doc.activeElement=null;writer.isConnected=false;win.visualViewport.height=1048;advance(250);
assert.equal(samples.at(-1).campo_editable_activo,false);assert.equal(samples.at(-1).escritura_reciente,true);
// Cambio a pregunta de selección: el contexto anterior vence y no se renueva.
const radio=field({type:'radio',marked:false});doc.activeElement=radio;emit('focusin',radio);advance(3000);
assert.equal(samples.at(-1).campo_editable_activo,false);assert.equal(samples.at(-1).escritura_reciente,false);assert.equal(events.length,0);
// Cambios geométricos sin escritura previa tampoco son infracciones.
win.visualViewport.height=640;win.visualViewport.dispatchEvent(new Event('resize'));advance(250);
assert.equal(samples.at(-1).escritura_reciente,false);assert.equal(events.length,0);
// El contexto de escritura no crea una exención para salir de la prueba.
doc.activeElement=field();emit('focusin',doc.activeElement);advance(250);focused=false;win.dispatchEvent(new Event('blur'));
assert.equal(events.length,1);assert.equal(events[0].senales[0],'ventana_sin_foco');assert.equal(samples.at(-1).escritura_reciente,true);
advance(2500);assert.equal(samples.at(-1).escritura_reciente,false,'Un campo que queda activo en segundo plano no renueva el contexto');
focused=true;state={...state,episodio_abierto:null};doc.activeElement=field();emit('focusin',doc.activeElement);advance(250);
doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));
assert.equal(events.length,2);assert.equal(events[1].senales[0],'pagina_oculta');assert.equal(samples.at(-1).escritura_reciente,true);
active=false;endDiagnostics();endActivity();assert.equal(tasks.size,0);
console.log('PASS contexto de escritura: campos editables, cierre/cambio de pregunta, caducidad, geometría sin faltas, salidas sin exenciones y limpieza.');
