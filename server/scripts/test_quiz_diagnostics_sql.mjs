import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {normalizeDiagnosticPayload} from "../../shared/quizDiagnostics.mjs";
const db=new PGlite();const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const payload=normalizeDiagnosticPayload({version:1,dispositivo:{sistema:'iPadOS',navegador:'Safari'},muestras:[{motivos:['inicio'],hora_cliente:new Date().toISOString(),visible:'visible',foco:true,faltas_observadas:0}]});
try{
 await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;');
 for(const file of ['20261113214049_quiz_activity_journal.sql','20261114030710_quiz_automatic_diagnostics.sql'])await db.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.query("INSERT INTO quiz_activity_attempts(id,quiz_id,seccion_id,numero_semana,alumno_id,numero_cuenta,politica,aceptado_cliente_at,diagnostico_version) VALUES($1,'quiz','section',1,'student','A','salidas-tres-faltas-v1',now(),1),($2,'quiz','section',1,'other','B','salidas-tres-faltas-v1',now(),NULL)",[id(1),id(2)]);
 const append=(batch,student='student',attempt=id(1),data=payload)=>db.query('SELECT append_quiz_diagnostic($1,$2,$3,$4) AS result',[attempt,student,id(batch),JSON.stringify(data)]);
 for(const role of ['anon','authenticated']){await db.exec(`SET ROLE ${role}`);await assert.rejects(append(100),{code:'42501'});await assert.rejects(db.query('SELECT * FROM quiz_diagnostic_batches'),{code:'42501'});await db.exec('RESET ROLE');}
 await db.exec('SET ROLE service_role');
 await assert.rejects(append(100,'other'));await assert.rejects(append(100,'other',id(2)));
 await Promise.all([append(100),append(100)]);assert.equal((await db.query('SELECT count(*)::int n FROM quiz_diagnostic_batches')).rows[0].n,1);
 await assert.rejects(append(101,'student',id(1),{...payload,muestras:Array(17).fill(payload.muestras[0])}));
 await assert.rejects(append(101,'student',id(1),{...payload,extra:'X'.repeat(17000)}));
 await assert.rejects(db.query("UPDATE quiz_diagnostic_batches SET datos='{}'"),{code:'42501'});await assert.rejects(db.query('DELETE FROM quiz_diagnostic_batches'),{code:'42501'});
 await Promise.all(Array.from({length:70},(_,i)=>append(200+i)));
 assert.equal((await db.query('SELECT count(*)::int n FROM quiz_diagnostic_batches')).rows[0].n,64,'El límite no se supera con solicitudes simultáneas');
 assert.equal((await append(500)).rows[0].result.limite,true);
 assert.equal((await db.query('SELECT faltas FROM quiz_activity_attempts WHERE id=$1',[id(1)])).rows[0].faltas,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM quiz_activity_events')).rows[0].n,0);
 assert.equal((await append(100)).rows[0].result.aceptado,true,'Reintento confirmado incluso al llegar al límite');
 await db.exec("RESET ROLE;UPDATE quiz_activity_attempts SET diagnostico_version=1,finalizado_at=now()-interval '2 days' WHERE numero_cuenta='B';SET ROLE service_role;");
 assert.equal((await append(600,'other',id(2))).rows[0].result.limite,true);
 console.log('PASS SQL diagnóstico: identidad y aceptación, acceso privado, reintentos, concurrencia/límites, plazo de sincronización y cero cambios a faltas o eventos.');
}finally{await db.close();}
