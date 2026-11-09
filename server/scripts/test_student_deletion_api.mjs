// Servicio real con proveedores aislados. No usa cuentas reales.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const bundle=await build({entryPoints:['server/src/services/studentAccountDeletion.js'],bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'fixture',setup(b){
 b.onResolve({filter:/db\/supabase\.js$/},()=>({path:'db',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const supabase=globalThis.fixture.db,isSupabaseConfigured=true;'}));
}}]});
function setup(auth='auth-1'){
 const fixture={rows:{instructores:[]},mode:'ok',authCalls:0,dbDeletes:0,prepared:0};
 for(const c of ['medicina','enfermeria','odontologia','microbiologia','nutricion'])fixture.rows['estudiantes_'+c]=[];
 fixture.rows.estudiantes_medicina.push({id:'student-1',seccion_id:'section-1',numero_cuenta:'DEMO',auth_user_id:auth});
 fixture.db={async rpc(name,args){if(name==='student_account_deletion_ready')return fixture.mode==='missing-schema'?{error:{message:'not installed'}}:{data:true};assert.equal(name,'prepare_student_auth_delete');assert.equal(args.p_profile,'student-1');fixture.prepared++;return fixture.mode==='prepare-fails'?{error:{message:'offline'}}:{data:{allowed:true}};},
 auth:{admin:{async deleteUser(id){fixture.authCalls++;if(fixture.mode==='auth-fails')return {error:{message:'provider error'}};if(fixture.mode!=='cascade-missing')fixture.rows.estudiantes_medicina=fixture.rows.estudiantes_medicina.filter(row=>row.auth_user_id!==id);return {data:{user:{id}}};}}},
 from(table){let operation='read',single=false;const filters=[];const q={select(){return q},eq(k,v){filters.push(row=>row[k]===v);return q},is(k,v){filters.push(row=>row[k]===v);return q},maybeSingle(){single=true;return q},delete(){operation='delete';return q},then(resolve,reject){return Promise.resolve().then(()=>{
  if(fixture.mode==='offline'||fixture.mode==='reference-fails'&&table==='estudiantes_nutricion')return {error:{message:'offline'}};
  const rows=fixture.rows[table].filter(row=>filters.every(f=>f(row)));
  if(operation==='delete'){fixture.dbDeletes++;if(fixture.mode==='db-fails')return {error:{message:'blocked'}};fixture.rows[table]=fixture.rows[table].filter(row=>!rows.includes(row));}
  return {data:structuredClone(single?rows[0]||null:rows)};
 }).then(resolve,reject)}};return q;}};
 const module={exports:{}};vm.runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,require,fixture});
 return {fixture,remove:()=>module.exports.deleteStudentAccount('estudiantes_medicina','section-1','DEMO')};
}
for(const mode of ['missing-schema','offline','reference-fails','prepare-fails','auth-fails','cascade-missing']){
 const {fixture,remove}=setup();fixture.mode=mode;await assert.rejects(remove(),error=>error.status===503);assert.equal(fixture.rows.estudiantes_medicina.length,1);assert.equal(fixture.dbDeletes,0);
 if(['offline','reference-fails','prepare-fails'].includes(mode))assert.equal(fixture.authCalls,0);
}
for(const other of ['student','instructor']){const {fixture,remove}=setup();if(other==='student')fixture.rows.estudiantes_nutricion.push({id:'another-student',auth_user_id:'auth-1'});else fixture.rows.instructores.push({id:'auth-1'});await assert.rejects(remove(),error=>error.status===409);assert.equal(fixture.authCalls,0);assert.equal(fixture.rows.estudiantes_medicina.length,1);}
{const {fixture,remove}=setup();assert.equal(await remove(),'student-1');assert.equal(fixture.prepared,1);assert.equal(fixture.authCalls,1);assert.equal(fixture.dbDeletes,0);assert.equal(fixture.rows.estudiantes_medicina.length,0);}
{const {fixture,remove}=setup(null);assert.equal(await remove(),'student-1');assert.equal(fixture.authCalls,0);assert.equal(fixture.dbDeletes,1);}
{const {fixture,remove}=setup(null);fixture.mode='db-fails';await assert.rejects(remove(),error=>error.status===503);assert.equal(fixture.rows.estudiantes_medicina.length,1);}
{const {fixture,remove}=setup();fixture.rows.estudiantes_medicina=[];await assert.rejects(remove(),error=>error.status===404);assert.equal(fixture.authCalls,0);}
console.log('PASS eliminación API: identidad propia, ficha sin Auth, perfiles compartidos y de instructor protegidos, guardado previo obligatorio, errores de Auth/DB sin éxito falso ni respaldo local, confirmación de cascada.');
