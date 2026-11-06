// Helper: Calcula si el estudiante perdió derecho a examen por acumular 2 o más faltas injustificadas en un parcial
export const getStudentDerechoStatus = (est, parcialId = "TODOS", dynamicParcialesList = []) => {
  const getAsistVal = (sem) => {
    return (
      est?.asistencias?.[`asistencia_${sem}`] ??
      est?.asistencias?.[`semana_${sem}`] ??
      est?.[`Asistencia de la semana ${sem}`] ??
      null
    );
  };

  // Extraer lista de parciales reales (excluyendo 'TODOS')
  const realParciales = (Array.isArray(dynamicParcialesList) ? dynamicParcialesList : [dynamicParcialesList]).filter(
    (p) => p.id !== "TODOS"
  );

  const parcialesStatus = {};
  const parcialesPerdidos = [];

  realParciales.forEach((p) => {
    const faltas = (p.semanas || []).filter(
      (sem) => getAsistVal(sem) === "Falta injustificada"
    ).length;
    const perdio = faltas >= 2;

    const statusObj = { perdio, faltas, label: p.label, semanas: p.semanas };
    parcialesStatus[p.id] = statusObj;
    parcialesStatus[p.label] = statusObj;
    if (p.rawParcialName) parcialesStatus[p.rawParcialName] = statusObj;
    if (p.parcialKey) parcialesStatus[p.parcialKey] = statusObj;

    if (perdio) {
      parcialesPerdidos.push(`${p.label} (${faltas} faltas)`);
    }
  });

  // Si se consulta un parcial específico
  if (parcialId !== "TODOS" && parcialesStatus[parcialId]) {
    const curr = parcialesStatus[parcialId];
    return {
      perdioDerecho: curr.perdio,
      faltasInjustificadas: curr.faltas,
      parcialesStatus,
      motivo: curr.perdio
        ? `Perdió derecho en ${curr.label} (${curr.faltas} faltas injustificadas)`
        : "Habilitado",
      badgeText: curr.perdio
        ? `🚨 Perdió Derecho (${curr.faltas} Faltas Injust.)`
        : "✓ Habilitado",
      perdioI: parcialesStatus["PARCIAL_I_PARCIAL"]?.perdio || parcialesStatus["I"]?.perdio || false,
      perdioII: parcialesStatus["PARCIAL_II_PARCIAL"]?.perdio || parcialesStatus["II"]?.perdio || false,
      perdioIII: parcialesStatus["PARCIAL_III_PARCIAL"]?.perdio || parcialesStatus["III"]?.perdio || false
    };
  }

  const perdioAlguno = parcialesPerdidos.length > 0;

  return {
    perdioDerecho: perdioAlguno,
    parcialesStatus,
    parcialesPerdidos,
    motivo: perdioAlguno
      ? `Perdió derecho en: ${parcialesPerdidos.join(", ")}`
      : "Habilitado en todos los parciales",
    badgeText: perdioAlguno
      ? `🚨 Perdió Derecho en ${parcialesPerdidos.length} parcial(es)`
      : "✓ Habilitado",
    perdioI: parcialesStatus["PARCIAL_I_PARCIAL"]?.perdio || parcialesStatus["I"]?.perdio || false,
    perdioII: parcialesStatus["PARCIAL_II_PARCIAL"]?.perdio || parcialesStatus["II"]?.perdio || false,
    perdioIII: parcialesStatus["PARCIAL_III_PARCIAL"]?.perdio || parcialesStatus["III"]?.perdio || false
  };
};

