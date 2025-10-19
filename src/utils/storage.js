const STORAGE_TEST_KEY = 'astro:storage-test';

function canUseLocalStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const storage = window.localStorage;
    storage.setItem(STORAGE_TEST_KEY, '1');
    storage.removeItem(STORAGE_TEST_KEY);
    return true;
  } catch (error) {
    return false;
  }
}

const hasLocalStorage = canUseLocalStorage();

export function readStorage(key, options = {}) {
  const fallback = Object.prototype.hasOwnProperty.call(options, 'fallback') ? options.fallback ?? null : null;
  if (!hasLocalStorage || !key) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Lecture de la clé ${key} impossible :`, error);
    return fallback;
  }
}

export function writeStorage(key, value, options = {}) {
  if (!hasLocalStorage || !key) {
    return false;
  }
  try {
    if (value === null && options.removeOnNull) {
      window.localStorage.removeItem(key);
      return true;
    }
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Écriture de la clé ${key} impossible :`, error);
    return false;
  }
}

export function removeStorage(key) {
  if (!hasLocalStorage || !key) {
    return false;
  }
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Suppression de la clé ${key} impossible :`, error);
    return false;
  }
}

export function storageAvailable() {
  return hasLocalStorage;
}
