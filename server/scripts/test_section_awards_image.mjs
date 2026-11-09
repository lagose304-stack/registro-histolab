import assert from "node:assert/strict";
import { getPodiumImageData, drawAwardsPodium } from "../../client/src/utils/exportAwardsImage.js";

const ranking = Array.from({length:4},(_,i)=>({nombre:["María Fernanda Rodríguez de los Ángeles Hernández","José Andrés Núñez Martínez","Ana López","Fuera del podio"][i],numero_cuenta:`CUENTA_PRIVADA_${i}`,grandTotalPremios:98.123-i,notas:{privado:true}}));
const data=getPodiumImageData(ranking,{codigo:"0800",carrera:"Medicina"});
assert.deepEqual(data.winners.map(s=>s.place),[1,2,3]);
assert.equal(data.section,"Sección 0800");
assert(!/CUENTA_PRIVADA|98\.123|notas|Fuera del podio/.test(JSON.stringify(data)),"El dibujo solo recibe nombres, lugares y sección");
assert.equal(getPodiumImageData(ranking,{nombre_seccion:"Sección 0900"}).section,"Sección 0900");

function fixture() {
  const drawn=[];
  const context=new Proxy({font:"32px Arial",measureText(value){return {width:String(value).length*(parseFloat(this.font.match(/(\d+)px/)?.[1])||32)*.56};},createLinearGradient(){return {addColorStop(){}};},fillText(text,x,y){drawn.push({text:String(text),x,y});}}, {get(target,key){return key in target?target[key]:()=>{};}});
  return {drawn,canvas:{width:0,height:0,getContext(){return context;}}};
}
for(const size of [1,2,3]) {
  const {canvas,drawn}=fixture();
  drawAwardsPodium(canvas,getPodiumImageData(ranking.slice(0,size),{codigo:"0800",carrera:"Medicina"}));
  assert.equal(canvas.width,1200);
  assert(canvas.height>=1400);
  assert.equal(drawn.filter(s=>s.text==="LUGAR").length,size);
  assert(drawn.every(s=>s.y>0&&s.y<canvas.height));
  assert(!drawn.some(s=>/CUENTA_PRIVADA|98\.123|puntos|nota/i.test(s.text)));
}
const long=fixture();
drawAwardsPodium(long.canvas,getPodiumImageData([{nombre:"María de los Ángeles Hernández Rodríguez ".repeat(5)}],{codigo:"0800"}));
assert(long.canvas.height>1400,"Los nombres extensos hacen crecer la imagen sin recortarlos");
assert(long.drawn.every(s=>s.y<long.canvas.height));
assert.throws(()=>drawAwardsPodium(fixture().canvas,{winners:[]}),/No hay estudiantes/);
console.log("PASS imagen del podio: solo nombres y lugares, sin notas ni cuentas, datos de sección, uno a tres ganadores y nombres largos sin recortes.");
