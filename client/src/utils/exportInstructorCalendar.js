import { getAcademicDate } from "../../../shared/academicWeek.mjs";

export async function downloadInstructorCalendar(table, careerLabel) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas no disponible");

  const columnWidths = Array.from(table.rows[0].cells, (_, index) => index === 0 ? 106 : 188);
  const lineHeight = 19;
  const font = bold => `${bold ? 700 : 400} 13px system-ui, sans-serif`;
  const wrap = (text, width, bold) => {
    context.font = font(bold);
    const lines = [""];
    for (const word of text.trim().split(/\s+/)) {
      const last = lines.length - 1;
      const next = lines[last] ? `${lines[last]} ${word}` : word;
      if (context.measureText(next).width <= width) {
        lines[last] = next;
      } else {
        if (lines[last]) lines.push("");
        for (const character of word) {
          if (context.measureText(lines.at(-1) + character).width > width) lines.push("");
          lines[lines.length - 1] += character;
        }
      }
    }
    return lines.map(value => ({ value, bold }));
  };

  const rows = Array.from(table.rows, row => {
    const cells = Array.from(row.cells, (cell, column) => {
      const width = columnWidths[column];
      if (cell.tagName === "TH") {
        const header = wrap(cell.textContent, width - 20, true);
        return { header, height: header.length * lineHeight + 16 };
      }
      const cards = Array.from(cell.querySelectorAll(".section-admin__card"), card => {
        const lines = wrap(card.querySelector("h4").textContent, width - 36, true);
        for (const item of card.querySelectorAll(".section-admin__facts p, .section-admin__instructor-list li")) {
          const text = item.tagName === "LI" ? `• ${item.textContent}` : item.textContent;
          lines.push(...wrap(text, width - 36, Boolean(item.querySelector("strong"))));
        }
        return lines;
      });
      const height = cards.reduce((total, lines) => total + lines.length * lineHeight + 24, 0) + 6;
      return { cards, height };
    });
    return { cells, height: Math.max(...cells.map(cell => cell.height)) };
  });

  const padding = 28;
  const top = 166;
  canvas.width = columnWidths.reduce((total, width) => total + width, 0) + padding * 2;
  canvas.height = rows.reduce((total, row) => total + row.height, top + padding);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const center = canvas.width / 2;
  context.fillStyle = "#f2f7fa";
  context.fillRect(padding, padding, canvas.width - padding * 2, 120);
  context.fillStyle = "#25485f";
  context.fillRect(padding, padding, canvas.width - padding * 2, 4);
  context.textAlign = "center";
  context.font = "600 14px system-ui, sans-serif";
  context.fillText(`Laboratorio de Histología · ${getAcademicDate().slice(0, 4)}`, center, 58);
  context.fillStyle = "#18354a";
  context.font = "700 30px system-ui, sans-serif";
  context.fillText("Calendario de instructores", center, 93);
  context.fillStyle = "#a37b36";
  context.fillRect(center - 24, 105, 48, 2);
  context.fillStyle = "#25485f";
  context.font = "600 14px system-ui, sans-serif";
  context.fillText(careerLabel, center, 130);
  context.strokeStyle = "#c3d2dc";
  context.strokeRect(12.5, 12.5, canvas.width - 25, canvas.height - 25);
  context.textAlign = "left";

  const drawLines = (lines, x, y) => {
    context.fillStyle = "#18354a";
    lines.forEach(({ value, bold }, index) => {
      context.font = font(bold);
      context.fillText(value, x, y + index * lineHeight);
    });
  };

  let y = top;
  for (const row of rows) {
    let x = padding;
    row.cells.forEach(({ header, cards }, column) => {
      const width = columnWidths[column];
      context.fillStyle = header ? "#e8f2f8" : "#fff";
      context.fillRect(x, y, width, row.height);
      context.strokeStyle = "#aabfcd";
      context.strokeRect(x, y, width, row.height);
      if (header) drawLines(header, x + 10, y + 24);
      let cardY = y + 8;
      for (const lines of cards || []) {
        const height = lines.length * lineHeight + 16;
        context.fillStyle = "#f0f7fb";
        context.fillRect(x + 8, cardY, width - 16, height);
        context.strokeRect(x + 8, cardY, width - 16, height);
        drawLines(lines, x + 17, cardY + 19);
        cardY += height + 8;
      }
      x += width;
    });
    y += row.height;
  }

  const image = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!image) throw new Error("No se pudo generar la imagen");
  const url = URL.createObjectURL(image);
  const link = document.createElement("a");
  link.href = url;
  link.download = "calendario-de-instructores.png";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
