const SIZE = { width: 1200, height: 1400 };
const FONT = '"Segoe UI", Arial, sans-serif';

function linesFor(ctx, value, maxWidth) {
  const words = String(value).trim().split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (ctx.measureText(word).width > maxWidth) {
      if (line) { lines.push(line); line = ""; }
      let part = "";
      for (const char of word) {
        if (ctx.measureText(part + char).width > maxWidth && part) { lines.push(part); part = ""; }
        part += char;
      }
      line = part;
    } else if (line && ctx.measureText(`${line} ${word}`).width > maxWidth) {
      lines.push(line); line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

// Solo recibe los tres nombres y sus posiciones: las notas y cuentas no llegan al dibujo.
export function getPodiumImageData(ranking, section = {}) {
  const sectionLabel = String(section.codigo || section.nombre_seccion || "Sección");
  return {
    winners: ranking.slice(0, 3).map((student, index) => ({ name: student.nombre, place: index + 1 })),
    section: /^secci[oó]n\b/i.test(sectionLabel) ? sectionLabel : `Sección ${sectionLabel}`,
    career: String(section.carrera || "Medicina")
  };
}

export function drawAwardsPodium(canvas, data) {
  if (!data.winners.length) throw new Error("No hay estudiantes para el podio.");
  canvas.width = SIZE.width;
  canvas.height = SIZE.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear la imagen.");
  const text = (value, x, y, size, color, weight = 400) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(String(value), x, y);
  };
  const rect = (x, y, width, height, radius, fill, stroke) => {
    ctx.beginPath(); ctx.roundRect(x, y, width, height, radius);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  };
  const line = (points, color, width = 3) => {
    ctx.beginPath(); ctx.moveTo(...points[0]);
    points.slice(1).forEach(point => ctx.lineTo(...point));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
  };
  const circle = (x, y, radius, fill, stroke) => {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  };
  ctx.font = `600 30px ${FONT}`;
  const sectionLines = linesFor(ctx,data.section,920);
  const sectionExtra = (sectionLines.length-1)*36;
  ctx.font = `400 25px ${FONT}`;
  const careerLines = linesFor(ctx,data.career,920);
  const panels = data.winners.map(winner => {
    const x = winner.place === 1 ? 600 : winner.place === 2 ? 245 : 955;
    const top = winner.place === 1 ? 760 : winner.place === 2 ? 850 : 900;
    ctx.font = `600 32px ${FONT}`;
    const names = linesFor(ctx, winner.name, 290);
    return { ...winner, x, top, names };
  });
  const longest = Math.max(...panels.map(panel=>panel.names.length));
  const offset = Math.max(0,(longest-3)*40) + Math.max(0,sectionExtra+(careerLines.length-1)*30);
  // Expandir en vertical permite nombres largos sin reducir la legibilidad.
  canvas.height = SIZE.height + offset;
  const gradient = ctx.createLinearGradient(0, 0, 1200, canvas.height);
  gradient.addColorStop(0, "#102e43"); gradient.addColorStop(.55, "#164a59"); gradient.addColorStop(1, "#092c3c");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, canvas.height);
  rect(30, 30, 1140, canvas.height-60, 28, null, "#51767b");

  // Células y enlaces moleculares en los bordes.
  [[75,380,38],[1130,460,50],[90,1070,30],[1090,1160,42]].forEach(([x,y,r]) => {
    circle(x,y,r,null,"#3b7077"); circle(x+5,y-3,r*.32,"#255d67",null);
    circle(x-9,y+12,4,"#5d9395",null); circle(x+15,y+10,3,"#5d9395",null);
  });
  for (const side of [0, 1]) {
    const x = side ? 1090 : 110;
    line([[x,120],[x-32,150],[x-25,195],[x+18,212],[x+50,181]],"#3c7079",2);
    [[x,120],[x-32,150],[x-25,195],[x+18,212],[x+50,181]].forEach(([cx,cy])=>circle(cx,cy,6,"#679a9d"));
  }
  // Icono de microscopio, trazado con líneas para mantener la imagen ligera.
  ctx.save(); ctx.translate(600, 104);
  line([[-38,40],[36,40]],"#e5ca88",5);
  line([[0,35],[-12,20],[-12,-1]],"#e5ca88",5);
  line([[-25,-9],[12,4]],"#e5ca88",5);
  line([[4,3],[15,-22],[29,-17],[18,9]],"#e5ca88",5);
  line([[18,-26],[31,-21]],"#e5ca88",5);
  ctx.beginPath();ctx.arc(7,12,25,-.15,1.6);ctx.strokeStyle="#e5ca88";ctx.lineWidth=5;ctx.stroke();
  ctx.restore();

  text("REGISTRO HISTOLAB",600,198,22,"#b8d6d6",600);
  text("Cuadro de honor",600,274,66,"#fff9e9",750);
  ctx.font = `600 30px ${FONT}`;

  sectionLines.forEach((value,i)=>text(value,600,326+i*36,30,"#ead39d",600));
  careerLines.forEach((value,i)=>text(value,600,369+sectionExtra+i*30,25,"#c6dfe0"));
  // La altura se adapta a los nombres: ninguno se corta ni se sustituye por puntos.
  const base = 1160 + offset;
  panels.forEach(panel => {
    const {x,names,place}=panel;
    const top = panel.top + offset;
    const medalY = top - 224 - Math.max(0,(names.length-3)*40);
    const gold = place === 1;
    const accent = gold ? "#ead093" : place === 2 ? "#c1d6e2" : "#d9ad8e";
    // Pedestales de vidrio, inspirados en recipientes de laboratorio.
    rect(x-160,top,320,base-top,20,gold?"#f6edd5":place===2?"#e6eef1":"#eedfd3",accent);
    line([[x-143,top+17],[x+143,top+17]],gold?"#ddc58c":"#becdd0",2);
    for(let tick=top+52;tick<base-40;tick+=32)line([[x-143,tick],[x-128,tick]],gold?"#ccba8d":"#a9bcc0",2);
    circle(x,medalY,44,"#173f50",accent);
    circle(x,medalY,35,null,accent);
    text(place,x,medalY+15,43,accent,750);
    names.forEach((name,i)=>text(name,x,medalY+86+i*40,32,"#ffffff",600));
    text(`${place}º`,x,top+102,78,gold?"#8e6821":place===2?"#4d6d7f":"#986948",750);
    text("LUGAR",x,top+142,18,gold?"#8e6821":place===2?"#4d6d7f":"#986948",600);
    // Burbujas decorativas dentro del pedestal.
    circle(x+104,base-42,13,null,gold?"#d1bd8e":"#b1c2c4");
    circle(x+119,base-70,6,null,gold?"#d1bd8e":"#b1c2c4");
  });
  line([[96,base+1],[1104,base+1]],"#739395",2);
  text("Reconocemos tu esfuerzo y dedicación",600,base+72,27,"#ead39d",600);
  text("UNAH · Laboratorio de Histología",600,base+125,22,"#c2dbdc");
  text("HISTOLAB",600,base+168,16,"#87b3b5",600);
  return canvas;
}

export async function downloadAwardsImage(ranking, section) {
  const data = getPodiumImageData(ranking,section);
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = drawAwardsPodium(document.createElement("canvas"),data);
  const blob = await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("No se pudo preparar la imagen.")),"image/png"));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const label = data.section.replace(/[^\p{L}\p{N}_-]+/gu,"_");
  link.href=url;link.download=`Podio_${label}.png`;
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
