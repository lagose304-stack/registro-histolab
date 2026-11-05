const academicDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Tegucigalpa",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function getAcademicDate(now = new Date()) {
  const parts = Object.fromEntries(academicDateFormatter.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getCurrentAcademicWeek(weeks, today = getAcademicDate()) {
  let current = null;
  for (const week of weeks) {
    if (!week.fecha_inicio || !week.fecha_fin || today < week.fecha_inicio || today > week.fecha_fin) continue;
    if (!current || week.fecha_inicio > current.fecha_inicio) current = week;
  }
  return current;
}
