// Utilidad para persistir y restaurar el estado de navegación de la aplicación
// Permite que al recargar la página (F5 o Ctrl+R) el usuario permanezca exactamente en la misma vista, sección, pestaña o parcial.
import { safeStorage } from "./safeStorage";

const STORAGE_KEY = "histolab_nav_state";

export function getNavState() {
  try {
    const raw = safeStorage.getSession(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (err) {
    console.warn("Aviso al leer estado de navegación:", err);
    return {};
  }
}

export function setNavState(updates = {}) {
  try {
    const current = getNavState();
    const merged = { ...current, ...updates };

    // Limpiar claves con valor null o undefined
    Object.keys(merged).forEach((key) => {
      if (merged[key] === null || merged[key] === undefined) {
        delete merged[key];
      }
    });

    safeStorage.setSession(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.warn("Aviso al guardar estado de navegación:", err);
    return {};
  }
}

export function clearNavState() {
  try {
    safeStorage.removeSession(STORAGE_KEY);
  } catch (err) {
    console.warn("Aviso al limpiar estado de navegación:", err);
  }
}
