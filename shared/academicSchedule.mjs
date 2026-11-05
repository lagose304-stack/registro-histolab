const DAY_MS = 86_400_000;
const DAY_NAMES = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];

export const LAB_START = 7 * 60;
export const LAB_END = 17 * 60;

export function parseScheduleDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function addScheduleDays(date, days) {
  return new Date(parseScheduleDate(date).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function scheduleWeekday(date) {
  return DAY_NAMES[parseScheduleDate(date).getUTCDay()];
}

export function getPracticeDate(week, weekday) {
  const start = parseScheduleDate(week.fecha_inicio);
  const day = DAY_NAMES.indexOf(weekday);
  if (!start || !parseScheduleDate(week.fecha_fin) || day < 0 || week.es_examen) return null;
  const date = addScheduleDays(week.fecha_inicio, (day - start.getUTCDay() + 7) % 7);
  return date <= week.fecha_fin ? date : null;
}

export function generateScheduleDates(weeks, firstMonday, skippedMondays) {
  const skipped = new Set(skippedMondays);
  let monday = firstMonday;
  return weeks.map(week => {
    while (skipped.has(monday)) monday = addScheduleDays(monday, 7);
    const start = monday;
    monday = addScheduleDays(monday, 7);
    return { ...week, fecha_inicio: start, fecha_fin: addScheduleDays(start, 6) };
  });
}

export function getScheduleBreaks(weeks) {
  const starts = [...new Set(weeks.filter(week => {
    const start = parseScheduleDate(week.fecha_inicio);
    return start?.getUTCDay() === 1 && week.fecha_fin === addScheduleDays(week.fecha_inicio, 6);
  }).map(week => week.fecha_inicio))].sort();
  const breaks = [];
  for (let index = 1; index < starts.length; index++) {
    for (let monday = addScheduleDays(starts[index - 1], 7); monday < starts[index]; monday = addScheduleDays(monday, 7)) {
      const sunday = addScheduleDays(monday, 6);
      if (!weeks.some(week => week.fecha_inicio && week.fecha_fin && week.fecha_inicio <= sunday && week.fecha_fin >= monday)) {
        breaks.push(monday);
      }
    }
  }
  return breaks;
}

export function scheduleTimeMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(time || "").trim());
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function scheduleTimeLabel(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function sectionTimeRange(section) {
  const start = scheduleTimeMinutes(section.hora_inicio);
  if (start === null) return null;
  const end = scheduleTimeMinutes(section.hora_fin);
  return [start, end > start ? end : start + 120];
}

export function scheduleOverlaps([start, end], [otherStart, otherEnd]) {
  return start < otherEnd && otherStart < end;
}

export function findFreeScheduleSlots(duration, busy) {
  if (!Number.isInteger(duration) || duration <= 0) return [];
  const slots = [];
  for (let start = LAB_START; start + duration <= LAB_END; start += 60) {
    const end = start + duration;
    if (!busy.some(range => scheduleOverlaps([start, end], range))) {
      slots.push({ hora_inicio: scheduleTimeLabel(start), hora_fin: scheduleTimeLabel(end) });
    }
  }
  return slots;
}
