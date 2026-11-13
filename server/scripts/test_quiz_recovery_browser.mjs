// Full student portal with isolated API fixtures. Never contacts HistoLab/Supabase.
// Set HISTOLAB_PLAYWRIGHT_MODULE and HISTOLAB_CHROMIUM_PATH when using a runtime installation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.HISTOLAB_PLAYWRIGHT_MODULE || 'playwright');
const student = { id: 'fixture-student', numero_cuenta: 'fixture', carrera: 'Medicina', seccion_id: 'fixture-section', nombre_completo: 'Alumno de prueba', notas: {}, asistencias: {}, seccion: { id: 'fixture-section', codigo: 'A' } };
const quiz = { id: 'fixture-quiz', numero_semana: 1, publicada: true, titulo: 'Prueba aislada', tiempo_por_pregunta_segundos: 90, preguntas: [{ id: 'q', enunciado: 'Pregunta de verificación', puntos: 1, items: [{ id: 'a', tipo: 'texto_corto', instruccion: 'Respuesta', puntos: 1 }] }] };
const live = { estado: 'en_pregunta', habilitada: true, numero_semana: 1, pregunta_actual_idx: 0, tiempo_restante_segundos: 90 };
const compiled = await build({
  stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Portal from './client/src/components/StudentPortalView.jsx';createRoot(document.getElementById('root')).render(<Portal student={window.fixture.student} notify={(message,type)=>window.fixture.notices.push({message,type})}/>);`, resolveDir: process.cwd(), loader: 'jsx' },
  bundle: true, write: false, outfile: 'fixture.js', format: 'iife', logLevel: 'silent',
  loader: { '.png': 'dataurl', '.ico': 'dataurl' },
  plugins: [{ name: 'fixture-api', setup(b) {
    b.onResolve({ filter: /services\/api(\.js)?$/ }, () => ({ path: 'api', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
      const ok=data=>Promise.resolve({success:true,data});
      const f=()=>window.fixture;
      export const api={
        semanas:{getConfig:()=>ok([{numero_semana:1,parcial:'I Parcial',tipo:'normal'}])},
        temario:{getAll:()=>ok([]),getPuntajes:()=>ok({})},
        estudiantes:{getByCuenta:()=>ok(f().student),getMySectionRank:()=>ok(null)},
        pruebas:{
          getBySeccion:()=>ok([f().quiz]),getBySemana:()=>ok(f().quiz),getLiveState:()=>ok(f().live),
          getMiEntrega:()=>ok(f().submission||null),getActiveLiveSession:()=>Promise.resolve({success:true,activa:false}),
          sendLiveHeartbeat:()=>ok(f().live),
          submit:async(section,payload)=>{f().sent.push(structuredClone(payload));if(f().failSubmit)throw Error('isolated offline');if(f().delaySubmit)await new Promise(r=>setTimeout(r,250));f().submission={...payload,id:'fixture-delivery',estado:'enviado'};return {success:true,data:f().submission};}
        }
      };`, loader: 'js' }));
  } }]
});
const js = compiled.outputFiles.find(file => file.path.endsWith('.js')).text;
const css = compiled.outputFiles.find(file => file.path.endsWith('.css'))?.text || '';
const browser = await chromium.launch({ headless: false, ...(process.env.HISTOLAB_CHROMIUM_PATH ? { executablePath: process.env.HISTOLAB_CHROMIUM_PATH } : {}) });
async function setup({ size = { width: 390, height: 844 }, phase = 'en_pregunta', restore = false, deny = false } = {}) {
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    if (route.request().url() !== 'http://histolab.test/') throw Error(`Unexpected network: ${route.request().url()}`);
    await route.fulfill({ contentType: 'text/html', body: `<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0"><div id="root"></div><script>${js.replaceAll('</script', '<\\/script')}</script></body></html>` });
  });
  await page.addInitScript(({ student, quiz, live, restore, deny }) => {
    window.fixture = { student, quiz, live, notices: [], sent: [], deny };
    if (restore) {
      localStorage.setItem('histolab_active_quiz_session_fixture', JSON.stringify({ quiz, liveSess: live }));
      localStorage.setItem('histolab_active_quiz_fixture_sem_1', JSON.stringify({ quiz, quizAnswers: { q: { a: 'Respuesta conservada' } }, strikes: 0, incidents: [], startTime: Date.now(), endTime: Date.now() + 90000 }));
    }
  }, { student, quiz, live: { ...live, estado: phase }, restore, deny });
  await page.goto('http://histolab.test/');
  async function start() {
    await page.getByRole('button', { name: 'Pruebas semanales', exact: true }).click();
    await page.getByRole('button', { name: 'Entrar a la prueba' }).click();
  }
  return { page, context, errors, start };
}
const fullscreen = page => page.evaluate(() => Boolean(document.fullscreenElement));
const waitWarnings = (page, count) => page.waitForFunction(count => document.querySelector('.quiz-player__rules summary')?.textContent.includes(`${count}/3`), count);
try {
  for (const size of [{width:320,height:640},{width:640,height:360},{width:768,height:1024},{width:1024,height:768}]) {
    const fixture = await setup({size});
    const {page} = fixture;
    await fixture.start();
    await page.getByRole('textbox').fill('Respuesta original');
    await waitWarnings(page, 0);
    for (const count of [1,2]) {
      await page.evaluate(() => document.exitFullscreen());
      await page.getByRole('button', {name:'Volver a pantalla completa',exact:true}).waitFor();
      await waitWarnings(page,count);
      await page.getByRole('button', {name:'Volver a pantalla completa',exact:true}).click();
      await page.getByRole('button', {name:'Volver a pantalla completa',exact:true}).waitFor({state:'hidden'});
      await page.getByRole('textbox').fill('Respuesta conservada '+count);
      await page.getByRole('textbox').press('Tab');
      await page.getByRole('textbox').focus();
      await waitWarnings(page,count);
      assert.equal(await page.getByRole('textbox').isDisabled(),false);
      assert.equal(await fullscreen(page),true);
      assert.equal(await page.evaluate(()=>window.fixture.sent.length),0);
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(fixture.errors,[]);
    console.log('PASS browser recovery and internal focus '+size.width+'x'+size.height);
    await fixture.context.close();
  }
} finally { await browser.close(); }




