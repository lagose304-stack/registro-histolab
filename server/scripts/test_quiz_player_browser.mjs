// Full student portal with isolated API fixtures. Never contacts HistoLab/Supabase.
// Set HISTOLAB_PLAYWRIGHT_MODULE and HISTOLAB_CHROMIUM_PATH when using a runtime installation.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const TARGET_URL = 'http://localhost:43173/';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.HISTOLAB_PLAYWRIGHT_MODULE || 'playwright');
const student = { id: 'fixture-student', numero_cuenta: 'fixture', carrera: 'Medicina', seccion_id: 'fixture-section', nombre_completo: 'Alumno de prueba', notas: {}, asistencias: {}, seccion: { id: 'fixture-section', codigo: 'A' } };
const quiz = { id: 'fixture-quiz', numero_semana: 1, publicada: true, titulo: 'Prueba aislada', tiempo_por_pregunta_segundos: 90, preguntas: [{ id: 'q', enunciado: 'Pregunta de verificación', puntos: 1, items: [{ id: 'a', tipo: 'texto_corto', instruccion: 'Respuesta', puntos: 1 }] }] };
const live = { estado: 'en_pregunta', habilitada: true, numero_semana: 1, pregunta_actual_idx: 0, tiempo_restante_segundos: 90 };
const compiled = await build({
  stdin: { contents: `import './client/src/index.css';import React from 'react';import{createRoot}from'react-dom/client';import Portal from './client/src/components/StudentPortalView.jsx';import Review from './client/src/components/QuizActivityReview.jsx';createRoot(document.getElementById('root')).render(window.fixture.review?<Review section="s" week={1} account="fixture"/>:<Portal student={window.fixture.student} onActivityLeaveChange={handler=>window.fixture.leavePortal=handler} notify={(message,type)=>window.fixture.notices.push({message,type})}/>);`, resolveDir: process.cwd(), loader: 'jsx' },
  bundle: true, write: false, outfile: 'fixture.js', format: 'iife', logLevel: 'silent',
  loader: { '.png': 'dataurl', '.ico': 'dataurl' },
  plugins: [{ name: 'fixture-api', setup(b) {
    b.onResolve({ filter: /services\/api(\.js)?$/ }, () => ({ path: 'api', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
      const policy='salidas-tres-faltas-v1';
      const ok=data=>Promise.resolve({success:true,data});
      const f=()=>window.fixture;
      export const api={
        semanas:{getConfig:()=>ok([{numero_semana:1,parcial:'I Parcial',tipo:'normal'}])},
        temario:{getAll:()=>ok([]),getPuntajes:()=>ok({})},
        estudiantes:{getByCuenta:()=>ok(f().student),getMiRanking:()=>ok(null),getMySectionRank:()=>ok(null)},
        pruebas:{
          getActivity:()=>ok([{id:'fixture-attempt',politica:'salidas-tres-faltas-v1',aceptado_at:new Date().toISOString(),faltas:1,eventos:[{id:'event-departure',episodio_id:'episode-1',tipo:'salida',falta:1,senales:['pagina_oculta'],pregunta_indice:0,pregunta_id:'q',hora_cliente:new Date().toISOString(),recibido_at:new Date().toISOString()},{id:'event-return',episodio_id:'episode-1',tipo:'regreso',falta:1,senales:[],hora_cliente:new Date().toISOString(),recibido_at:new Date().toISOString()}]}]),
          getBySeccion:()=>ok([f().quiz]),getBySemana:()=>ok(f().quiz),getLiveState:()=>ok(f().live),
          getMiEntrega:()=>ok(f().submission||null),getActiveLiveSession:()=>Promise.resolve({success:true,activa:false}),
          startActivity:async(section,week,payload)=>{
            if(!f().activity){f().activity=JSON.parse(localStorage.getItem('fixture-server-activity')||'null')||{id:'00000000-0000-4000-8000-000000000001',quiz_id:f().quiz.id,politica:policy,aceptado_at:new Date().toISOString(),faltas:0,episodio_abierto:null,eventos:[]};}
            return ok(structuredClone(f().activity));
          },
          saveActivity:async(section,week,id,events)=>{
            if(f().failActivity)throw Error('offline journal');
            const a=f().activity;
            for(const e of events){if(a.eventos.some(row=>row.id===e.id))continue;if(e.tipo==='salida'){if(a.episodio_abierto||a.faltas>=3)continue;a.faltas++;a.episodio_abierto=e.episodio_id;}else a.episodio_abierto=null;a.eventos.push({...e,falta:a.faltas,recibido_at:new Date().toISOString()});}
            localStorage.setItem('fixture-server-activity',JSON.stringify(a));return ok(structuredClone(a));
          },
          sendLiveHeartbeat:async(section,week,payload)=>{f().heartbeats.push(structuredClone(payload));return ok(f().live);},
          submit:async(section,payload)=>{f().sent.push(structuredClone(payload));if(f().failSubmit)throw Error('isolated offline');if(f().delaySubmit)await new Promise(r=>setTimeout(r,250));f().submission={...payload,id:'fixture-delivery',estado:'enviado'};return {success:true,data:f().submission};}
        }
      };`, loader: 'js' }));
  } }]
});
const js = compiled.outputFiles.find(file => file.path.endsWith('.js')).text;
const css = compiled.outputFiles.find(file => file.path.endsWith('.css'))?.text || '';
const browser = await chromium.launch({ headless: false, ...(process.env.HISTOLAB_CHROMIUM_PATH ? { executablePath: process.env.HISTOLAB_CHROMIUM_PATH } : {}) });
async function setup({ size = { width: 390, height: 844 }, phase = 'en_pregunta', restore = false, deny = false, review = false } = {}) {
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error('Portal fixture:', error.message); });
  await page.route('**/*', async route => {
    if (route.request().url() !== TARGET_URL) throw Error(`Unexpected network: ${route.request().url()}`);
    await route.fulfill({ contentType: 'text/html', body: `<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0"><div id="root"></div><script>${js.replaceAll('</script', '<\\/script')}</script></body></html>` });
  });
  await page.addInitScript(({ student, quiz, live, restore, deny, review }) => {
    window.fixture = { student, quiz, live, notices: [], sent: [], heartbeats: [], fullscreenRequests: 0, deny, review };
    
    Element.prototype.requestFullscreen = function () { window.fixture.fullscreenRequests++;return Promise.reject(Error('fullscreen must not be requested')); };
    localStorage.setItem('histolab_cancelled_quiz_fixture_sem_1', JSON.stringify({cancelledAt:Date.now()}));
    if (restore) {
      localStorage.setItem('histolab_active_quiz_session_fixture', JSON.stringify({ quiz, liveSess: live }));
      localStorage.setItem('histolab_active_quiz_fixture_sem_1', JSON.stringify({ quiz, quizAnswers: { q: { a: 'Respuesta conservada' } }, strikes: 3, incidents: [{tipo:'perdida_de_foco'}], startTime: Date.now(), endTime: Date.now() + 90000 }));
    }
  }, { student, quiz, live: { ...live, estado: phase }, restore, deny, review });
  await page.goto(TARGET_URL);
  async function start() {
    await page.getByRole('button', { name: 'Pruebas semanales', exact: true }).click();
    await page.getByRole('button', { name: 'Entrar a la prueba' }).click();
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.getByRole('button',{name:'Aceptar y comenzar'}).isDisabled(),true);
    await page.getByRole('checkbox').check();
    await page.getByRole('button',{name:'Aceptar y comenzar'}).click();
  }
  return { page, context, errors, start };
}
const playable=async page=>{await page.getByRole('textbox').waitFor();await page.waitForFunction(()=>!document.querySelector('textarea').disabled);};
async function leave(page){await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('blur'));});}
async function back(page){await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));});await page.waitForFunction(()=>!window.fixture.activity?.episodio_abierto);}
try{
 await mkdir('artifacts/quiz-activity',{recursive:true});
 for(const size of [{width:320,height:640},{width:640,height:360},{width:768,height:1024},{width:1024,height:768}]){
  const fixture=await setup({size});const {page}=fixture;
  await fixture.start();await playable(page);
  assert.equal(await page.evaluate(()=>window.fixture.fullscreenRequests),0);
  await page.getByRole('textbox').fill('Respuestas al llegar a tres faltas');
  await leave(page);await page.getByText('Falta 1 de 3',{exact:true}).waitFor();
  assert.equal(await page.getByRole('textbox').isEnabled(),true);
  assert.equal(await page.getByRole('dialog').count(),0);
  await back(page);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`artifacts/quiz-activity/${size.width}x${size.height}.png`,fullPage:true});
  await leave(page);await page.getByText('Falta 2 de 3',{exact:true}).waitFor();await back(page);
  await page.evaluate(()=>{window.fixture.delaySubmit=true;});
  await leave(page);
  await page.waitForFunction(()=>window.fixture.sent.length===1&&!document.querySelector('.quiz-player'));
  const sent=await page.evaluate(()=>window.fixture.sent[0]);
  assert.equal(sent.respuestas.q.a,'Respuestas al llegar a tres faltas');assert.equal(sent.auditoria.motivo_finalizacion,'limite_tres_faltas');
  assert(sent.actividad_intento_id);assert.equal(await page.evaluate(()=>window.fixture.sent.length),1);
  assert.deepEqual(fixture.errors,[]);await fixture.context.close();
 }
 // Una ráfaga no duplica, recargar conserva contador y respuestas.
 let fixture=await setup();let {page}=fixture;await fixture.start();await playable(page);
 await page.getByRole('textbox').fill('Borrador conservado');await leave(page);await back(page);
 await page.reload();await playable(page);assert.equal(await page.getByRole('textbox').inputValue(),'Borrador conservado');
 await page.waitForFunction(()=>window.fixture.activity?.faltas===2);
 await back(page);
 assert.equal(await page.getByRole('dialog').count(),0);
 await page.evaluate(()=>{window.fixture.failSubmit=true;window.fixture.failActivity=true;});
 await leave(page);
 await page.waitForFunction(()=>Boolean(localStorage.getItem('histolab_sealed_quiz_fixture_sem_1')));
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('histolab_sealed_quiz_fixture_sem_1')));
 assert.equal(saved.respuestas.q.a,'Borrador conservado');assert.equal(saved.auditoria.motivo_finalizacion,'limite_tres_faltas');
 await page.reload();
 await page.waitForFunction(()=>Boolean(window.fixture.submission));
 assert.equal(await page.evaluate(()=>window.fixture.submission.respuestas.q.a),'Borrador conservado');
 assert.deepEqual(fixture.errors,[]);await fixture.context.close();
 // Confirmación voluntaria y fin docente continúan funcionando.
 fixture=await setup();page=fixture.page;await fixture.start();await playable(page);
 await page.getByRole('textbox').fill('Entrega voluntaria');
 await page.getByRole('button',{name:'Finalizar y entregar',exact:true}).click();
 await page.getByRole('button',{name:'Seguir Revisando'}).click();await playable(page);
 await page.evaluate(()=>{window.fixture.live={...window.fixture.live,estado:'finalizada'};});
 await page.waitForFunction(()=>window.fixture.sent.length===1);
 assert.equal(await page.evaluate(()=>window.fixture.sent[0].auditoria.motivo_finalizacion),'finalizada_por_docente');
 assert.deepEqual(fixture.errors,[]);await fixture.context.close();
 // La sala de espera tiene las mismas tres faltas y entrega vacía permitida.
 fixture=await setup({phase:'lobby'});page=fixture.page;await fixture.start();
 for(let i=0;i<3;i++){await leave(page);if(i<2)await back(page);}
 await page.waitForFunction(()=>window.fixture.sent.length===1);
 assert.deepEqual(fixture.errors,[]);await fixture.context.close();
 // Salir por el cierre de sesión suma una salida, sin interceptar la acción.
 fixture=await setup();page=fixture.page;await fixture.start();await playable(page);
 await page.evaluate(()=>window.fixture.leavePortal());
 await page.getByText('Falta 1 de 3',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.fixture.sent.length),0);
 assert.deepEqual(fixture.errors,[]);await fixture.context.close();
 for(const size of [{width:320,height:640},{width:768,height:1024}]){
  fixture=await setup({size,review:true});page=fixture.page;
  await page.getByText('Falta 1: La página dejó de estar visible',{exact:true}).waitFor();
  assert(await page.getByText(/Recepción del servidor/).isVisible());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`artifacts/quiz-activity/revision-${size.width}x${size.height}.png`,fullPage:true});
  assert.deepEqual(fixture.errors,[]);await fixture.context.close();
 }
 console.log('PASS navegador: aceptación, falta visible sin bloqueo, tres episodios/envío único, respuestas exactas, recarga, cierre offline/reintento, docente y lobby en móvil/tablet.');
}finally{await browser.close();}
