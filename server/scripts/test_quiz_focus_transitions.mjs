// Reloj y navegador simulados; sin red ni datos académicos.
import assert from 'node:assert/strict';
import { observeQuizActivity } from '../../client/src/utils/quizActivityObserver.mjs';
const win=new EventTarget(),doc=new EventTarget();win.visualViewport=new EventTarget();
let focused=true,active=true,time=0,id=0;
const timers=new Map();
win.setTimeout=(callback,delay)=>{const key=++id;timers.set(key,{callback,at:time+delay});return key;};
win.clearTimeout=key=>timers.delete(key);
let poll,pollDelay;
win.setInterval=(callback,delay)=>{poll=callback;pollDelay=delay;return 'poll';};
win.clearInterval=()=>{poll=null;};
doc.visibilityState='visible';doc.hasFocus=()=>focused;
let state={faltas:0,episodio_abierto:null};const events=[];
const cleanup=observeQuizActivity({window:win,document:doc,explicitReturn:true,isActive:()=>active,getState:()=>state,makeId:()=>String(++id),onEvent:event=>{events.push(event);state={faltas:state.faltas+1,episodio_abierto:event.episodio_id};}});
const advance=ms=>{time+=ms;for(const [key,timer] of [...timers])if(timer.at<=time){timers.delete(key);timer.callback();}};
assert.equal(pollDelay,500);
// Leer sin tocar nada y una pausa prolongada no equivalen a una salida.
advance(60000);poll();assert.equal(events.length,0);
// Cambiar de campo, ocultar teclado, rotar o cancelar un gesto no basta.
for(const type of ['focusout','focusin','pointercancel','resume'])doc.dispatchEvent(new Event(type));
for(const type of ['resize','orientationchange'])win.dispatchEvent(new Event(type));
win.visualViewport.dispatchEvent(new Event('resize'));advance(200);assert.equal(events.length,0);
// Sale brevemente sin blur de ventana: focusout permite comprobar antes del sondeo.
doc.dispatchEvent(new Event('focusout'));advance(0);focused=false;advance(200);
assert.equal(events.length,1);assert.equal(events[0].senales[0],'ventana_sin_foco');
for(let n=0;n<1000;n++)doc.dispatchEvent(new Event('focusout'));
assert(timers.size<=2,'Las ráfagas mantienen una cola acotada');advance(200);poll();assert.equal(events.length,1);
focused=true;win.dispatchEvent(new Event('focus'));advance(200);assert(state.episodio_abierto,'El regreso sigue requiriendo confirmación');
state={...state,episodio_abierto:null};
// Resume puede observar el estado aunque no se haya emitido visibilitychange.
doc.visibilityState='hidden';doc.dispatchEvent(new Event('resume'));advance(0);
assert.equal(events.length,2);assert.equal(events[1].senales[0],'pagina_oculta');
state={...state,episodio_abierto:null};doc.visibilityState='visible';active=false;focused=false;
doc.dispatchEvent(new Event('focusout'));poll();advance(500);assert.equal(events.length,2);
active=true;win.dispatchEvent(new Event('resize'));assert.equal(timers.size,2);
cleanup();assert.equal(timers.size,0);assert.equal(poll,null);
doc.dispatchEvent(new Event('focusout'));win.visualViewport.dispatchEvent(new Event('resize'));assert.equal(timers.size,0);
console.log('PASS foco: sondeo de 500 ms, transiciones sin blur, pausa/teclado/rotación sin faltas, deduplicación, regreso explícito y limpieza.');
