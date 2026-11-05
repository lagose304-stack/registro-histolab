const CAREER_SUFFIXES = { MEDICINA: "MED", ENFERMERIA: "ENF", ODONTOLOGIA: "ODO", MICROBIOLOGIA: "MIC", NUTRICION: "NUT" };
const automaticCodePattern = new RegExp(`^([A-Z]+\\d{4})-(?:${Object.values(CAREER_SUFFIXES).join("|")})$`);

export const displaySectionCode = (code) => code?.match(automaticCodePattern)?.[1] ?? code;

export const normalizeSectionCareer = (career) =>
  (career || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

// Mantiene el formato histórico cuando no se indica una carrera.
export const generateSectionCode = (dia = "Lunes", horaInicio = "13:00", carrera = "") => {
  const diaMap = {
    lunes: "LU",
    martes: "MA",
    miercoles: "MI",
    miércoles: "MI",
    jueves: "JU",
    viernes: "VI",
    sabado: "SA",
    sábado: "SA",
    domingo: "DO"
  };

  const normalizedDay = (dia || "Lunes").toLowerCase().trim();
  const dayPrefix = diaMap[normalizedDay] || "SEC";

  let hourStr = "13";
  let minStr = "00";

  if (horaInicio && horaInicio.includes(":")) {
    const parts = horaInicio.split(":");
    hourStr = (parts[0] || "00").trim().padStart(2, "0");
    minStr = (parts[1] || "00").trim().slice(0, 2).padStart(2, "0");
  } else if (horaInicio) {
    const digits = horaInicio.replace(/\D/g, "");
    if (digits.length >= 4) {
      hourStr = digits.slice(0, 2);
      minStr = digits.slice(2, 4);
    } else if (digits.length >= 1) {
      hourStr = digits.slice(0, 2).padStart(2, "0");
      minStr = "00";
    }
  }

  const base = `${dayPrefix}${hourStr}${minStr}`;
  const career = normalizeSectionCareer(carrera);
  return career ? `${base}-${CAREER_SUFFIXES[career] || career}` : base;
};
