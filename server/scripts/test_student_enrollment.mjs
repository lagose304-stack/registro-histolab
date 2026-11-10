// API real con almacenamiento aislado. Nunca escribe archivos ni usa Supabase real.
import assert from "node:assert/strict";
import vm from "node:vm";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const tables = ["medicina","enfermeria","odontologia","microbiologia","nutricion"].map(c=>`estudiantes_${c}`);
const bundle = await build({ entryPoints: ["server/src/controllers/estudiantes.controller.js"], bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
  plugins: [{ name: "isolated-enrollment", setup(b) {
    b.onResolve({filter:/db\/supabase\.js$/},()=>({path:"db",namespace:"fixture"}));
    b.onResolve({filter:/^(node:)?fs$/},()=>({path:"fs",namespace:"fixture"}));
    b.onResolve({filter:/\.\/(secciones|semanas|asignaciones|academicAgenda|manualsSchedule|temario)\.controller\.js$/},args=>({path:args.path,namespace:"helpers"}));
    b.onLoad({filter:/.*/,namespace:"helpers"},()=>({contents:"export const getLocalSchedulingSections=()=>[],buildAcademicWeeks=weeks=>weeks,getLocalSchedulingWeeks=()=>[],getLocalSectionAssignments=()=>[],getSectionAttendanceEvents=async()=>[],getManualSchedule=async()=>({}),getLocalAcademicSettings=()=>({});"}));
    b.onLoad({filter:/.*/,namespace:"fixture"},({path})=>({contents:path==="db"?"export const supabase=globalThis.fixture.db,isSupabaseConfigured=globalThis.fixture.configured;":"export default {existsSync:()=>true,mkdirSync(){},readFileSync:()=>JSON.stringify(globalThis.fixture.local),renameSync(){},writeFileSync(){globalThis.fixture.writes++}};"}));
  } }]
});
function setup(configured=true) {
  const fixture = { configured, local: Object.fromEntries(tables.map(t=>[t,[]])), writes: 0, mode: "normal", rows: Object.fromEntries(tables.map(t=>[t,[]])) };
  fixture.db = { from(table) { let operation="read",value,single=false;const filters=[];const query={
    select(){return query},eq(key,val){filters.push(row=>row[key]===val);return query},
    maybeSingle(){single=true;return query},single(){single=true;return query},
    insert(row){operation="insert";value=row;return query},update(row){operation="update";value=row;return query},
    then(resolve,reject){return Promise.resolve().then(()=>{
      if(fixture.mode==="offline")return {data:null,error:{code:"offline"}};
      if(operation!=="read"&&fixture.mode==="race")return {data:null,error:{code:"23505"}};
      if(operation!=="read"&&fixture.mode==="write-error")return {data:null,error:{code:"failure"}};
      let rows=fixture.rows[table].filter(row=>filters.every(f=>f(row)));
      if(operation==="insert"){const row={id:'new-id',...value};fixture.rows[table].push(row);rows=[row]}
      if(operation==="update")rows.forEach(row=>Object.assign(row,value));
      return {data:structuredClone(single?rows[0]||null:rows),error:null};
    }).then(resolve,reject)}
  };return query} };
  const module={exports:{}};
  vm.runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,require,fixture,console:{error(){},warn(){}},process:{cwd:()=>"/isolated"}});
  return {fixture,api:module.exports};
}
async function call(handler,body,params={}) {let status=200,data;await handler({body,params},{status(value){status=value;return this},json(value){data=value;return this}});return {status,data};}
const body=(career="Medicina",account="DEMO",section="s2")=>({carrera:career,numero_cuenta:account,seccion_id:section,nombre_completo:"Estudiante de ejemplo",correo:account+"@example.invalid"});
const {fixture,api}=setup();
for(const table of tables){fixture.rows[table].push({id:table,numero_cuenta:"USED",seccion_id:"s1",activo:true});assert.equal((await call(api.createEstudiante,body("Medicina","USED"))).status,409);fixture.rows[table]=[];}
fixture.rows.estudiantes_medicina.push({id:"own",numero_cuenta:"OWN",seccion_id:"s2",activo:true});
assert.equal((await call(api.updateEstudiante,{carrera:"Medicina",nuevo_numero_cuenta:"OWN",nombre_completo:"Cambio"},{seccion_id:"s2",numero_cuenta:"OWN"})).status,200);
fixture.rows.estudiantes_nutricion.push({id:"other",numero_cuenta:"TAKEN",seccion_id:"s3",activo:true});
assert.equal((await call(api.updateEstudiante,{carrera:"Medicina",nuevo_numero_cuenta:"TAKEN"},{seccion_id:"s2",numero_cuenta:"OWN"})).status,409);
assert.equal(fixture.rows.estudiantes_medicina[0].numero_cuenta,"OWN");
for(const [mode,status]of [["offline",503],["race",409],["write-error",503]]){fixture.mode=mode;const count=fixture.writes;assert.equal((await call(api.createEstudiante,body())).status,status);assert.equal(fixture.writes,count,"No anuncia éxito ni usa archivos tras rechazo de Supabase");}
fixture.mode="normal";
fixture.rows.estudiantes_nutricion[0].activo=false;
assert.equal((await call(api.createEstudiante,body("Medicina","TAKEN"))).status,201,"La matrícula inactiva conserva historia sin duplicar actividad");
const local=setup(false);
const concurrent=await Promise.all([call(local.api.createEstudiante,body("Medicina","SHARED")),call(local.api.createEstudiante,body("Enfermeria","SHARED"))]);
assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);
console.log("PASS API: cuenta única entre cinco carreras, edición propia, rechazo al renombrar, conflicto concurrente, sin respaldo falso ante errores y protección local simultánea.");
