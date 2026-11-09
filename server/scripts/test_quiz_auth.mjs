// JWT and session verification against isolated account fixtures.
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const require=createRequire(new URL('../package.json',import.meta.url)),jwt=require('jsonwebtoken');
const secret='isolated-test-secret-not-used-by-the-application';
const result=await build({entryPoints:[fileURLToPath(new URL('../src/middlewares/auth.middleware.js',import.meta.url))],bundle:true,external:['jsonwebtoken'],platform:'node',format:'cjs',write:false,logLevel:'silent',plugins:[{name:'auth-fixtures',setup(b){
 b.onResolve({filter:/auth\.controller\.js$/},()=>({path:'accounts',namespace:'fixture'}));
 b.onResolve({filter:/db\/supabase\.js$/},()=>({path:'db',namespace:'fixture'}));
 b.onResolve({filter:/^dotenv$/},()=>({path:'env',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='env'?'export default {config(){}}':args.path==='db'?'export const supabase=null,isSupabaseConfigured=false;':'export const getInstructorByIdOrEmail=async()=>({id:"instructor",rol:"Instructor",activo:true,current_session_token:"active"});export const getStudentByCuentaAndCarrera=async()=>({numero_cuenta:"A",seccion_id:"s1",activo:true,auth_user_id:"auth-student",correo:"student@example.invalid",activation_completed_at:"2026-11-09T00:00:00Z",current_session_token:"active"});export const getStudentSession=()=>null;',loader:'js'}));
}}]});
const module={exports:{}};vm.runInNewContext(result.outputFiles[0].text,{module,exports:module.exports,require,console,process:{env:{JWT_SECRET:secret}}});
async function run(handler,token){let code=200,next=false;const req={headers:token?{authorization:'Bearer '+token}:{}};const res={status(value){code=value;return res},json(){return res}};await handler(req,res,()=>next=true);return {code,next,req};}
const student=jwt.sign({rol:'ESTUDIANTE',numero_cuenta:'A',carrera:'Medicina',session_id:'active'},secret);
const instructor=jwt.sign({rol:'Instructor',id:'instructor',session_id:'active'},secret);
assert((await run(module.exports.authenticateStudent,student)).next);
assert((await run(module.exports.authenticateInstructor,instructor)).next);
assert.equal((await run(module.exports.authenticateInstructor,student)).code,403);
assert.equal((await run(module.exports.authenticateStudent,instructor)).code,403);
assert.equal((await run(module.exports.authenticateStudent,null)).code,401);
assert.equal((await run(module.exports.authenticateStudent,jwt.sign({rol:'ESTUDIANTE'},'wrong-secret'))).code,401);
assert.equal((await run(module.exports.authenticateStudent,jwt.sign({rol:'ESTUDIANTE'},secret,{expiresIn:-1}))).code,401);
assert.equal((await run(module.exports.authenticateStudent,jwt.sign({rol:'ESTUDIANTE',numero_cuenta:'A',session_id:'old'},secret))).code,401);
console.log('PASS: sesiones válidas, falta de token, firma falsa, expiración, rol incorrecto y sesión reemplazada.');
