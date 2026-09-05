/**
 * 🛡️ HISTOLAB - UTILIDAD UNIVERSAL DE ALMACENAMIENTO SEGURO
 * Compatible con todos los navegadores: Safari (incluyendo Modo Privado iOS/macOS),
 * Firefox (Protección estricta contra rastreo), Microsoft Edge, Brave y Google Chrome.
 * 
 * Si el navegador bloquea o restringe localStorage/sessionStorage, conmuta automáticamente
 * a memoria RAM transparente evitando cualquier SecurityError o pantalla blanca.
 */

const memoryStore = new Map();

function testStorage(type) {
  try {
    if (typeof window === "undefined" || !window[type]) return false;
    const storage = window[type];
    const testKey = "__histolab_storage_check__";
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const isLocalAvailable = testStorage("localStorage");
const isSessionAvailable = testStorage("sessionStorage");

export const safeStorage = {
  getItem(key) {
    try {
      if (isLocalAvailable) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`Aviso: Lectura en localStorage bloqueada para "${key}". Usando fallback en memoria.`, e);
    }
    return memoryStore.get(`local_${key}`) ?? null;
  },

  setItem(key, value) {
    const valStr = String(value);
    try {
      if (isLocalAvailable) {
        window.localStorage.setItem(key, valStr);
        return;
      }
    } catch (e) {
      console.warn(`Aviso: Escritura en localStorage bloqueada para "${key}". Guardando en memoria.`, e);
    }
    memoryStore.set(`local_${key}`, valStr);
  },

  removeItem(key) {
    try {
      if (isLocalAvailable) {
        window.localStorage.removeItem(key);
      }
    } catch (_) {}
    memoryStore.delete(`local_${key}`);
  },

  // Métodos de SessionStorage
  getSession(key) {
    try {
      if (isSessionAvailable) {
        return window.sessionStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`Aviso: Lectura en sessionStorage bloqueada para "${key}". Usando fallback en memoria.`, e);
    }
    return memoryStore.get(`session_${key}`) ?? null;
  },

  setSession(key, value) {
    const valStr = String(value);
    try {
      if (isSessionAvailable) {
        window.sessionStorage.setItem(key, valStr);
        return;
      }
    } catch (e) {
      console.warn(`Aviso: Escritura en sessionStorage bloqueada para "${key}". Guardando en memoria.`, e);
    }
    memoryStore.set(`session_${key}`, valStr);
  },

  removeSession(key) {
    try {
      if (isSessionAvailable) {
        window.sessionStorage.removeItem(key);
      }
    } catch (_) {}
    memoryStore.delete(`session_${key}`);
  }
};
