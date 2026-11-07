// Pure event tests: no browser, network, credentials or persisted data.
import assert from "node:assert/strict";
import { observeQuizIntegrity } from "../../client/src/utils/quizIntegrity.mjs";
class Surface {
  listeners = new Map(); hidden = false; fullscreenElement = null;
  addEventListener(type,callback) { if (!this.listeners.has(type)) this.listeners.set(type,new Set()); this.listeners.get(type).add(callback); }
  removeEventListener(type,callback) { this.listeners.get(type)?.delete(callback); }
  emit(type,event={}) { this.listeners.get(type)?.forEach(callback=>callback(event)); }
}
let clock=1000,active=true,suppressed=false,departures=[],blocked=[],pauses=0,resumes=0;
const doc=new Surface(),win=new Surface();
const dispose=observeQuizIntegrity({document:doc,window:win,isActive:()=>active,isSuppressed:()=>suppressed,now:()=>clock,onHidden:()=>pauses++,onVisible:()=>resumes++,onDeparture:seconds=>departures.push(seconds),onBlocked:type=>blocked.push(type),onFullscreen:()=>{}});
const hidden=()=>{doc.hidden=true;doc.emit('visibilitychange')};
const visible=()=>{doc.hidden=false;doc.emit('visibilitychange')};
hidden();clock+=1999;visible();assert.deepEqual(departures,[]);
hidden();clock+=2200;visible();win.emit('focus');doc.emit('visibilitychange');assert.deepEqual(departures,[2]);
for(const type of ['blur','resize','touchstart','touchcancel','orientationchange','keydown'])win.emit(type,{});
doc.emit('fullscreenchange');assert.equal(departures.length,1);
active=false;hidden();clock+=10000;visible();assert.equal(departures.length,1);
active=true;suppressed=true;hidden();clock+=3000;visible();assert.equal(departures.length,1);
suppressed=false;
let prevented=0;
const event={target:{closest:()=>true},preventDefault:()=>prevented++};
doc.emit('paste',event);doc.emit('paste',event);assert.equal(prevented,2);assert.deepEqual(blocked,['pegar_texto']);assert.equal(departures.length,1);
clock+=2500;doc.emit('paste',event);assert.equal(blocked.length,2);
doc.emit('copy',{...event,target:{closest:()=>false}});assert.equal(blocked.length,2);
hidden();clock+=3000;active=false;visible();assert.equal(departures.length,1);
active=true;hidden();dispose();clock+=3000;visible();assert.equal(departures.length,1);
assert([...doc.listeners.values(),...win.listeners.values()].every(list=>list.size===0));
console.log('PASS: visibilidad sostenida una sola vez, tolerancia breve, teclado/rotación/foco sin sanciones, exclusión de lobby/diálogos/envío, pegado bloqueado y limpieza de eventos.');
