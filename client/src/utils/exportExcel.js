import ExcelJS from "exceljs";
import { getStudentDerechoStatus } from "../components/SectionGradebookView";

/**
 * Exporta el Cuadro de Calificaciones o la Lista de Asistencia a un archivo .xlsx con diseño idéntico al sitio.
 */
export async function exportStyledExcel({
  viewType, // 'notas' | 'asistencia'
  seccion,
  estudiantes,
  currentParcialConfig,
  selectedParcial,
  semanasTemasMap = {}
}) {
  if (!estudiantes || estudiantes.length === 0) {
    throw new Error("No hay estudiantes para exportar.");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HistoLab Sistema Académico";
  workbook.lastModifiedBy = "HistoLab";
  workbook.created = new Date();
  workbook.modified = new Date();

  const isNotas = viewType === "notas";
  const sheetTitle = isNotas ? "Cuadro de Notas" : "Lista de Asistencias";
  const worksheet = workbook.addWorksheet(sheetTitle, {
    views: [{ showGridLines: true }]
  });

  const { semanas = [], examenes = [], temas = [], label = "Todo el Periodo", badge = "" } = currentParcialConfig;

  // =========================================================================
  // 1. CONSTRUCCIÓN DE LAS COLUMNAS DE LA TABLA
  // =========================================================================
  const columnsConfig = [
    { key: "num", header: "#", width: 6, align: "center", fill: "F1F5F9", fontColor: "475569", rotate: false },
    { key: "numero_cuenta", header: "No. Cuenta", width: 16, align: "center", fill: "F1F5F9", fontColor: "475569", rotate: false },
    { key: "nombre_completo", header: "Nombre Completo", width: 34, align: "left", fill: "F1F5F9", fontColor: "475569", rotate: false }
  ];

  if (isNotas) {
    // Total (solo en vista TODOS)
    if (selectedParcial === "TODOS") {
      columnsConfig.push({
        key: "total",
        header: "Total",
        width: 9,
        align: "center",
        fill: "DCFCE7",
        fontColor: "15803D",
        rotate: true,
        isNumber: true
      });
      columnsConfig.push({
        key: "nota_oro_manuales",
        header: "Nota Oro Manuales",
        width: 9.5,
        align: "center",
        fill: "EFF6FF",
        fontColor: "1D4ED8",
        rotate: true,
        isNumber: true
      });
      columnsConfig.push({
        key: "nota_oro_pruebas",
        header: "Nota Oro Pruebas",
        width: 9.5,
        align: "center",
        fill: "F0FDF4",
        fontColor: "15803D",
        rotate: true,
        isNumber: true
      });
    }

    // Exámenes
    examenes.forEach((ex) => {
      columnsConfig.push({
        key: ex.key,
        header: ex.label,
        width: 8.5,
        align: "center",
        fill: "F8FAFC",
        fontColor: "1E293B",
        rotate: true,
        isNumber: true,
        parcialKey: ex.parcialKey
      });
    });

    // Temas / Manuales
    temas.forEach((t, idx) => {
      const numPrefix = t.numero_tema ? `#${t.numero_tema} ` : "";
      const displayTitle = `${numPrefix}Manual - ${t.titulo}`;

      columnsConfig.push({
        key: `manual_${t.id}`,
        altKey: t.id ? undefined : `manual_tema_${t.numero_tema}`,
        secondAltKey: t.id,
        legacyKey: `Manual de ${t.titulo}`,
        header: displayTitle,
        width: 8.5,
        align: "center",
        fill: idx % 2 === 0 ? "F0F9FF" : "E0F2FE",
        fontColor: "0369A1",
        rotate: true,
        isNumber: true
      });
    });

    // Pruebas Semanales (solo semanas que no son de examen)
    const semanasParaPruebas = currentParcialConfig.semanasPruebas || semanas;
    semanasParaPruebas.forEach((sem) => {
      const fullTitle = `Prueba - ${semanasTemasMap[sem] || `Semana ${sem}`}`;
      columnsConfig.push({
        key: `prueba_${sem}`,
        altKey: `examencito_${sem}`,
        legacyKey: `Prueba de la semana ${sem}`,
        header: fullTitle,
        width: 8.5,
        align: "center",
        fill: "FAF5FF",
        fontColor: "7C3AED",
        rotate: true,
        isNumber: true
      });
    });
  } else {
    // ASISTENCIAS
    columnsConfig.push({
      key: "asist_total",
      header: selectedParcial === "TODOS" ? "Asistencias Totales" : `Asistencias (${semanas.length} Sem)`,
      width: 9.5,
      align: "center",
      fill: "FEF3C7",
      fontColor: "B45309",
      rotate: true
    });

    columnsConfig.push({
      key: "derecho_examen",
      header: "Derecho a Examen",
      width: 10,
      align: "center",
      fill: "F8FAFC",
      fontColor: "1E293B",
      rotate: true
    });

    // Asistencias a Exámenes del Parcial
    (currentParcialConfig.asistenciasExamenes || []).forEach((ae) => {
      columnsConfig.push({
        key: ae.key,
        header: ae.label,
        width: 8.5,
        align: "center",
        fill: "EFF6FF",
        fontColor: "1D4ED8",
        rotate: true
      });
    });

    // Semanas de Asistencia regulares (excluyendo semanas de examen porque ya tienen su columna de Asistencia de Examen)
    const regularSemanas =
      currentParcialConfig.semanasAsistencia ||
      semanas.filter((s) => !currentParcialConfig.asistenciasExamenes?.some((ae) => ae.key.endsWith(`_${s}`)));

    regularSemanas.forEach((sem) => {
      const topicTitle = (semanasTemasMap[sem] || "").trim();
      let fullTitle = `Semana ${sem}`;
      if (topicTitle && topicTitle.toLowerCase() !== `semana ${sem}`.toLowerCase()) {
        fullTitle = `Semana ${sem} - ${topicTitle}`;
      }

      columnsConfig.push({
        key: `asistencia_${sem}`,
        legacyKey: `Asistencia de la semana ${sem}`,
        header: fullTitle,
        width: 8.5,
        align: "center",
        fill: sem % 2 === 0 ? "F8FAFC" : "FFFFFF",
        fontColor: "475569",
        rotate: true
      });
    });
  }

  const totalCols = columnsConfig.length;

  // =========================================================================
  // 2. MEMBRETE Y ENCABEZADOS INSTITUCIONALES (Filas 1 a 4)
  // =========================================================================

  // Fila 1: Título Principal
  worksheet.mergeCells(1, 1, 1, totalCols);
  const row1 = worksheet.getRow(1);
  row1.height = 32;
  const cellTitle = worksheet.getCell(1, 1);
  cellTitle.value = isNotas
    ? `CUADRO DE CALIFICACIONES - SECCIÓN ${seccion?.codigo || ""}`
    : `LISTA DE ASISTENCIA - SECCIÓN ${seccion?.codigo || ""}`;
  cellTitle.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  cellTitle.alignment = { vertical: "middle", horizontal: "center" };
  cellTitle.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: isNotas ? "FF15803D" : "FFD97706" }
  };

  // Fila 2: Subtítulo con Carrera y Parcial
  worksheet.mergeCells(2, 1, 2, totalCols);
  const row2 = worksheet.getRow(2);
  row2.height = 22;
  const cellSub = worksheet.getCell(2, 1);
  cellSub.value = `DEPARTAMENTO DE HISTOLOGÍA  |  ${label.toUpperCase()} (${badge})  |  ${seccion?.carrera || "HISTOLOGÍA"}`;
  cellSub.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF334155" } };
  cellSub.alignment = { vertical: "middle", horizontal: "center" };
  cellSub.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" }
  };

  // Fila 3: Información de Docentes
  worksheet.mergeCells(3, 1, 3, Math.floor(totalCols / 2));
  const cellDoc = worksheet.getCell(3, 1);
  cellDoc.value = `Doctor Encargado: ${seccion?.doctor_encargado || "Dr. Rafael Perdomo Vaquero"}`;
  cellDoc.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF0F172A" } };
  cellDoc.alignment = { vertical: "middle", horizontal: "left" };
  cellDoc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

  worksheet.mergeCells(3, Math.floor(totalCols / 2) + 1, 3, totalCols);
  const cellCoord = worksheet.getCell(3, Math.floor(totalCols / 2) + 1);
  cellCoord.value = `Coordinador de Sección: ${seccion?.coordinador || "Sin asignar"}`;
  cellCoord.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF0369A1" } };
  cellCoord.alignment = { vertical: "middle", horizontal: "left" };
  cellCoord.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

  const row3 = worksheet.getRow(3);
  row3.height = 20;

  // Fila 4: Espacio
  const row4 = worksheet.getRow(4);
  row4.height = 8;

  // =========================================================================
  // 3. CABECERA DE LA TABLA (Fila 5) CON TEXTO VERTICAL ROTADO A 90°
  // =========================================================================
  const headerRowNum = 5;
  const headerRow = worksheet.getRow(headerRowNum);
  headerRow.height = 145;

  const thinBorder = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "medium", color: { argb: "FF94A3B8" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } }
  };

  columnsConfig.forEach((col, idx) => {
    const colNum = idx + 1;
    const cell = worksheet.getCell(headerRowNum, colNum);
    cell.value = col.header;
    cell.font = {
      name: "Arial",
      size: 8.5,
      bold: true,
      color: { argb: `FF${col.fontColor}` }
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${col.fill}` }
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
      textRotation: col.rotate ? 90 : 0
    };
    cell.border = thinBorder;
    worksheet.getColumn(colNum).width = col.width;
  });

  // =========================================================================
  // 4. REGISTROS DE ESTUDIANTES
  // =========================================================================
  const cellBorder = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } }
  };

  estudiantes.forEach((est, index) => {
    const rowNum = headerRowNum + 1 + index;
    const row = worksheet.getRow(rowNum);
    row.height = 20;

    const isEven = index % 2 === 0;
    const defaultBg = isEven ? "FFFFFFFF" : "FFF8FAFC";
    const derecho = getStudentDerechoStatus(est, selectedParcial, currentParcialConfig);

    // Calcular datos de asistencia sobre las semanas de clase regulares
    const regularSemanasForCount =
      currentParcialConfig.semanasAsistencia ||
      semanas.filter((s) => !currentParcialConfig.asistenciasExamenes?.some((ae) => ae.key.endsWith(`_${s}`)));

    let countAsist = 0;
    regularSemanasForCount.forEach((sem) => {
      const val = est.asistencias?.[`asistencia_${sem}`] ?? est[`Asistencia de la semana ${sem}`];
      if (val === "Asistio") {
        countAsist++;
      }
    });

    columnsConfig.forEach((col, colIdx) => {
      const colNum = colIdx + 1;
      const cell = worksheet.getCell(rowNum, colNum);
      cell.border = cellBorder;

      let cellValue = "";
      let bg = defaultBg;
      let fontColor = "FF334155";
      let bold = false;
      let numFormat = undefined;

      if (col.key === "num") {
        cellValue = index + 1;
        fontColor = "FF64748B";
        bold = true;
      } else if (col.key === "numero_cuenta") {
        cellValue = String(est.numero_cuenta || "");
        fontColor = "FF0F172A";
        bold = true;
      } else if (col.key === "nombre_completo") {
        cellValue = est.nombre_completo || "";
        fontColor = derecho.perdioDerecho ? "FFB91C1C" : "FF1E293B";
        bold = true;
      } else if (col.key === "total") {
        const val = Number(est.total ?? 0);
        cellValue = val;
        numFormat = "0.000";
        bold = true;
        bg = "FFF0FDF4";
        fontColor = val >= 65 ? "FF15803D" : "FFDC2626";
      } else if (col.key === "nota_oro_manuales") {
        const val = Number(est.nota_oro_manuales ?? 0);
        cellValue = val;
        numFormat = "0.000";
        bold = true;
        bg = "FFE0F2FE";
        fontColor = "FF1D4ED8";
      } else if (col.key === "nota_oro_pruebas") {
        const val = Number(est.nota_oro_pruebas ?? 0);
        cellValue = val;
        numFormat = "0.000";
        bold = true;
        bg = "FFDCFCE7";
        fontColor = "FF15803D";
      } else if (col.key === "asist_total") {
        cellValue = `${countAsist}/${regularSemanasForCount.length}`;
        bold = true;
        bg = "FFFEFCE8";
        fontColor = countAsist / (regularSemanasForCount.length || 1) >= 0.75 ? "FF15803D" : "FFB45309";
      } else if (col.key === "derecho_examen") {
        cellValue = derecho.perdioDerecho ? "🚨 SDE" : "✓ OK";
        bold = true;
        bg = derecho.perdioDerecho ? "FFFEE2E2" : "FFDCFCE7";
        fontColor = derecho.perdioDerecho ? "FFB91C1C" : "FF15803D";
      } else if (col.key.startsWith("asistencia_") || col.key.startsWith("Asistencia")) {
        const val =
          est.asistencias?.[col.key] ??
          est.asistencias?.[col.legacyKey] ??
          est[col.key] ??
          est[col.legacyKey];

        if (val === "Asistio") {
          cellValue = "✓";
          fontColor = "FF15803D";
          bold = true;
        } else if (val === "Falta justificada") {
          cellValue = "FJ";
          fontColor = "FFB45309";
          bold = true;
          bg = "FFFEF3C7";
        } else if (val === "Falta injustificada") {
          cellValue = "FI";
          fontColor = "FFDC2626";
          bold = true;
          bg = "FFFEE2E2";
        } else {
          cellValue = "—";
          fontColor = "FF94A3B8";
        }
      } else if (col.isNumber) {
        const val = Number(
          est.notas?.[col.key] ??
          est.notas?.[col.altKey] ??
          est.notas?.[col.secondAltKey] ??
          est.notas?.[col.legacyKey] ??
          est[col.key] ??
          est[col.legacyKey] ??
          0
        );
        cellValue = val;
        numFormat = "0.000";

        if (col.parcialKey) {
          const perdioEsteExamen =
            (col.parcialKey === "I" && derecho.perdioI) ||
            (col.parcialKey === "II" && derecho.perdioII) ||
            (col.parcialKey === "III" && derecho.perdioIII);

          if (perdioEsteExamen) {
            bg = "FFFEE2E2";
            fontColor = "FFDC2626";
            bold = true;
          }
        }
      }

      cell.value = cellValue;
      cell.font = { name: "Arial", size: 8.5, bold, color: { argb: fontColor } };
      cell.alignment = { vertical: "middle", horizontal: col.align || "center" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      if (numFormat) cell.numFmt = numFormat;
    });
  });

  // =========================================================================
  // 5. DESCARGA
  // =========================================================================
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const fileName = `${isNotas ? "Cuadro_Notas" : "Lista_Asistencia"}_${seccion?.codigo || "Seccion"}_${label.replace(/\s+/g, "_")}.xlsx`;

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
