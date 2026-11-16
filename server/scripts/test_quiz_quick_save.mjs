import assert from 'node:assert/strict';
import { createQuickGradeSaver } from '../../client/src/utils/quickGradeSave.mjs';

const values = new Map();
const storage = { getItem:key=>values.get(key) ?? null, setItem:(key,value)=>values.set(key,value), removeItem:key=>values.delete(key) };
const payload = {nota_obtenida:1,evaluaciones_incisos:{q___a:{estado:'mala',puntos_obtenidos:0}}};
const details = {submissionId:'A',studentName:'Alumno ficticio',payload,transition:{questionIdx:0,studentIdx:1,finishedPrompt:false,allCompleted:false}};
let release,calls=0,confirmed=[];
const saver = createQuickGradeSaver({storage,key:'scope-A',makeId:()=>'save-A',send:async(id,snapshot)=>{
  calls++;assert.equal(id,'A');assert.equal(snapshot.evaluaciones_incisos.q___a.estado,'mala');
  return new Promise(resolve=>{release=()=>resolve({success:true,data:{id}});});
},onConfirmed:(record,data)=>confirmed.push({record,data})});
const queued=saver.prepare(details);
assert(queued.durable);assert.equal(JSON.parse(values.get('scope-A')).submissionId,'A','La copia existe antes de adelantar');
payload.evaluaciones_incisos.q___a.estado='buena';
const pending=saver.run();await saver.run();assert.equal(calls,1,'Un solo envío activo');
assert.throws(()=>saver.prepare({...details,submissionId:'B'}));assert.equal(confirmed.length,0,'Pendiente no equivale a confirmado');
release();await pending;assert.equal(confirmed.length,1);assert.equal(confirmed[0].data.id,'A');assert.equal(values.has('scope-A'),false);
assert.equal(saver.snapshot().pending,null);

// Error y recarga: reintentar exactamente la nota pendiente, nunca la del alumno visible.
let restoredConfirmed;
const failing=createQuickGradeSaver({storage,key:'scope-A',makeId:()=>'retry-A',send:async()=>{throw Error('sin conexión');}});
failing.prepare({...details,payload:structuredClone(confirmed[0].record.payload)});await failing.run();
assert.equal(failing.snapshot().error,'sin conexión');assert(values.has('scope-A'));failing.dispose();
const restored=createQuickGradeSaver({storage,key:'scope-A',send:async(id,snapshot)=>{assert.equal(id,'A');assert.equal(snapshot.evaluaciones_incisos.q___a.estado,'mala');return {success:true,data:{id}};},onConfirmed:record=>{restoredConfirmed=record;}});
assert(restored.snapshot().pending.recovered);await restored.run();assert.equal(restoredConfirmed.id,'retry-A');assert(!values.has('scope-A'));

// Sin almacenamiento duradero no se autoriza el avance anticipado.
const blocked=createQuickGradeSaver({key:'blocked',storage:{getItem:()=>null,setItem:()=>{throw Error('quota');}},send:async()=>({success:false,message:'indisponible'})});
assert.equal(blocked.prepare(details).durable,false);await blocked.run();assert(blocked.snapshot().pending);assert.equal(blocked.snapshot().error,'indisponible');
const silent=createQuickGradeSaver({key:'silent',storage:{getItem:()=>null,setItem(){}},send:async()=>({success:true})});
assert.equal(silent.prepare(details).durable,false,'La relectura detecta almacenamiento que no conserva datos');

// Otra pestaña no debe perder su respaldo por una nota nueva o una confirmación tardía.
const other=createQuickGradeSaver({storage,key:'other',send:async()=>({success:true})});
values.set('other',JSON.stringify({id:'another-tab'}));assert.equal(other.prepare(details).durable,false);await other.run();assert.equal(JSON.parse(values.get('other')).id,'another-tab');
let done;
const detached=createQuickGradeSaver({storage,key:'detached',makeId:()=>'detached-A',send:()=>new Promise(resolve=>{done=resolve;}),onConfirmed:()=>assert.fail('No actualiza una vista desmontada')});
detached.prepare(details);const detachedRun=detached.run();await Promise.resolve();detached.dispose();done({success:true});await detachedRun;assert(!values.has('detached'));

// Remontar la vista durante la solicitud comparte el envío ya activo.
let finishShared,sharedCalls=0;
const oldView=createQuickGradeSaver({storage,key:'shared',makeId:()=>'shared-A',send:()=>{sharedCalls++;return new Promise(resolve=>{finishShared=resolve;});}});
oldView.prepare(details);const oldRequest=oldView.run();await Promise.resolve();oldView.dispose();
let recovered;
const newView=createQuickGradeSaver({storage,key:'shared',send:()=>assert.fail('No duplica una solicitud de la vista anterior'),onConfirmed:record=>{recovered=record;}});
const resumedRequest=newView.run();assert.equal(sharedCalls,1);finishShared({success:true});await Promise.all([oldRequest,resumedRequest]);assert.equal(recovered.submissionId,'A');assert(!values.has('shared'));
console.log('PASS guardado rápido: copia previa, envío único, instantánea aislada, confirmación, error/reintento/recarga, almacenamiento bloqueado y aislamiento entre pestañas/vistas.');
