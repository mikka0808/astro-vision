const STORAGE_PREFIX = "astro-vision";
const CONSENT_COOKIE_NAME = "astro-vision-consent";

function getScopedKey(key: string) {
  return `${STORAGE_PREFIX}:${key}`;
}

export function getLocalValue<T>(key: string, defaultValue: T): T {
  try {
    const item = window.localStorage.getItem(getScopedKey(key));
    if (!item) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn("Lecture localStorage impossible", error);
    return defaultValue;
  }
}

export function setLocalValue<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(getScopedKey(key), JSON.stringify(value));
  } catch (error) {
    console.warn("Écriture localStorage impossible", error);
  }
}

export function removeLocalValue(key: string) {
  try {
    window.localStorage.removeItem(getScopedKey(key));
  } catch (error) {
    console.warn("Suppression localStorage impossible", error);
  }
}

export function hasCookieConsent(): boolean {
  return document.cookie.split(";").some((cookie) => cookie.trim().startsWith(`${CONSENT_COOKIE_NAME}=`));
}

export function setCookieConsent(days = 365) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${CONSENT_COOKIE_NAME}=granted; path=/; max-age=${days * 24 * 60 * 60}; expires=${expires.toUTCString()}`;
}

export function revokeCookieConsent() {
  document.cookie = `${CONSENT_COOKIE_NAME}=; Max-Age=0; path=/;`;
}
