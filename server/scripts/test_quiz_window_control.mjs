// Reloj/navegador simulados y SQL embebido, sin conexiones ni datos reales.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { observeQuizActivity } from '../../client/src/utils/quizActivityObserver.mjs';
import { quizWindowStatus } from '../../client/src/utils/quizWindowGuard.mjs';
import { appendLocalActivity } from '../../shared/quizActivity.mjs';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function fixture({ legacy = false, width = 1180 } = {}) {
  let time = 0, id = 10, focused = true, active = true;
  const tasks = new Map(), events = [];
  const win = new EventTarget(), doc = new EventTarget();
  const schedule = (fn, delay, repeat = false) => { const key = ++id; tasks.set(key,{fn,at:time+delay,delay,repeat}); return key; };
  Object.assign(win,{ innerWidth:width, innerHeight:681, navigator:{userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5},
    screen:{width:820,height:1180,orientation:Object.assign(new EventTarget(),{type:'landscape-primary'})},
    visualViewport:Object.assign(new EventTarget(),{width,height:681,scale:1}),
    setTimeout:(fn,ms)=>schedule(fn,ms),clearTimeout:key=>tasks.delete(key),
    setInterval:(fn,ms)=>schedule(fn,ms,true),clearInterval:key=>tasks.delete(key) });
  Object.assign(doc,{visibilityState:'visible',hasFocus:()=>focused,activeElement:null});
  let state = {faltas:0,episodio_abierto:null,eventos:[],...(legacy?{}:{ventana_version:1})};
  const cleanup = observeQuizActivity({window:win,document:doc,nowMs:()=>time,now:()=>new Date(time).toISOString(),
    explicitReturn:true,isActive:()=>active,getState:()=>state,makeId:()=>uuid(++id),
    onEvent:e=>{events.push(e);state=appendLocalActivity(state,[e]);}});
  const advance = ms => { const end=time+ms; for (;;) { const next=[...tasks].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0]; if(!next)break;
    const [key,t]=next;time=t.at;if(t.repeat)t.at+=t.delay;else tasks.delete(key);t.fn();}time=end; };
  return {win,doc,events,tasks,cleanup,advance,get state(){return state;},
    resize:w=>{win.innerWidth=w;win.visualViewport.width=w;win.dispatchEvent(new Event('resize'));},
    return:()=>{assert(cleanup.canReturn());state=appendLocalActivity(state,[{id:uuid(++id),episodio_id:state.episodio_abierto,tipo:'regreso',hora_cliente:new Date(time).toISOString(),senales:[]}]);},
    setFocused:v=>{focused=v;},setActive:v=>{active=v;} };
}
{
  const f=fixture();f.advance(2000);assert.equal(f.events.length,0);
  // Reproduce la secuencia del iPad: visible y enfocado, sin cambios de orientación.
  f.resize(754);f.advance(400);f.resize(375);f.advance(1200);
  assert.equal(f.state.faltas,1);assert.deepEqual(f.events[0].senales,['ventana_reducida']);
  const departure=f.events[0].hora_cliente;
  for(const width of [478,524,600]){f.resize(width);f.advance(1500);}
  assert.equal(f.state.faltas,1);assert.equal(f.cleanup.canReturn(),false);assert.equal(f.events[0].hora_cliente,departure);
  // Incluso innerWidth puede ir por delante del viewport visual al restaurar.
  f.win.innerWidth=1180;assert.equal(f.cleanup.canReturn(),false);
  f.resize(1180);f.advance(500);assert(f.state.episodio_abierto);f.return();
  f.resize(600);f.advance(1600);assert.equal(f.state.faltas,2);
  f.resize(1180);f.advance(500);f.return();f.resize(524);f.advance(1600);assert.equal(f.state.faltas,3);
  f.cleanup();assert.equal(f.tasks.size,0);
}
{
  const f=fixture({width:375});assert(quizWindowStatus(f.win).reduced,'No aprende una ventana reducida como referencia');
  f.advance(1600);assert.equal(f.state.faltas,1);f.cleanup();
}
{
  const f=fixture();
  // Teclado y barras: altura variable con y sin campo activo.
  for(const h of [320,615,750,681]){f.win.innerHeight=h;f.win.visualViewport.height=h;f.win.visualViewport.dispatchEvent(new Event('resize'));f.advance(1600);}
  f.win.visualViewport.width=590;f.win.visualViewport.scale=2;f.advance(2000);assert.equal(f.state.faltas,0,'Zoom con dedos no reduce la ventana');
  f.win.visualViewport.scale=1;f.win.visualViewport.width=1180;
  f.resize(1170);f.advance(1600);assert.equal(f.state.faltas,0,'Tolera pequeñas variaciones');
  f.resize(524);f.advance(400);f.resize(1180);f.advance(1600);assert.equal(f.state.faltas,0,'Ignora cambios transitorios');
  f.win.screen.orientation.type='portrait-primary';f.win.screen.orientation.dispatchEvent(new Event('change'));f.advance(500);f.resize(820);f.advance(2000);assert.equal(f.state.faltas,0,'Rotación válida');
  // Escritura activa y orientación nueva no autorizan mantener la ventana pequeña.
  f.doc.activeElement={tagName:'TEXTAREA'};f.win.screen.orientation.type='landscape-primary';f.resize(524);f.advance(3000);assert.equal(f.state.faltas,1);
  f.cleanup();
}
{
  const f=fixture({legacy:true});f.resize(375);f.advance(5000);assert.equal(f.state.faltas,0,'Intentos anteriores conservan sus reglas');f.cleanup();
  const desktop=fixture();desktop.win.navigator={platform:'Win32',maxTouchPoints:0};desktop.resize(375);desktop.advance(2000);assert.equal(desktop.state.faltas,0);desktop.cleanup();
  const f2=fixture();f2.setActive(false);f2.resize(375);f2.advance(5000);assert.equal(f2.state.faltas,0);f2.cleanup();
  const f3=fixture();f3.resize(375);f3.setFocused(false);f3.win.dispatchEvent(new Event('blur'));f3.advance(2000);assert.equal(f3.state.faltas,1,'Foco y tamaño forman un solo episodio');f3.cleanup();
}
console.log('PASS iPad: secuencia real, inicio reducido, teclado, zoom, rotación, tres episodios, regreso bloqueado y limpieza.');

const db=new PGlite();
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  for(const name of ['20261113214049_quiz_activity_journal.sql','20261117040000_quiz_window_control.sql'])await db.exec(await readFile(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8'));
  const insert=async(n,version)=>db.query("INSERT INTO quiz_activity_attempts(id,quiz_id,seccion_id,numero_semana,alumno_id,numero_cuenta,politica,aceptado_cliente_at,ventana_version) VALUES($1,$2,'s',1,'student','TEST','salidas-tres-faltas-v1',now(),$3)",[uuid(n),'quiz'+n,version]);
  await insert(1,1);await insert(2,null);
  const e={id:uuid(3),episodio_id:uuid(4),tipo:'salida',hora_cliente:new Date().toISOString(),senales:['ventana_reducida'],pregunta_id:'q',pregunta_indice:0};
  const append=(attempt,events=[e],student='student')=>db.query('SELECT append_quiz_activity($1,$2,$3)',[uuid(attempt),student,JSON.stringify(events)]);
  await assert.rejects(append(2));await assert.rejects(append(1,[e],'other'));
  await db.exec('SET ROLE anon');await assert.rejects(append(1),{code:'42501'});await db.exec('RESET ROLE');
  await db.exec('SET ROLE service_role');await Promise.all([append(1),append(1)]);
  assert.equal((await db.query('SELECT faltas FROM quiz_activity_attempts WHERE id=$1',[uuid(1)])).rows[0].faltas,1);
  const rows=(await db.query('SELECT * FROM quiz_activity_events')).rows;assert.equal(rows.length,1);assert.deepEqual(rows[0].senales,['ventana_reducida']);
  await assert.rejects(db.query('DELETE FROM quiz_activity_events'),{code:'42501'});
  await assert.rejects(db.query('UPDATE quiz_activity_events SET falta=2'),{code:'42501'});
  assert.throws(()=>appendLocalActivity({faltas:0,episodio_abierto:null,eventos:[]},[e]),/no aceptó/);
  console.log('PASS SQL: señal nueva, aceptación por intento, aislamiento, deduplicación concurrente y permisos preservados.');
} finally {await db.close();}
