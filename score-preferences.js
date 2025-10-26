import { getDefaultScoreWeights, getScoreWeights, setScoreWeightOverrides } from './src/core/astro.js';

const COOKIE_NAME = 'astroSoir:scoreWeights';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 an

function parseCookiePayload() {
  if (typeof document === 'undefined') {
    return null;
  }
  const cookies = document.cookie ? document.cookie.split(';') : [];
  const target = cookies
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`));
  if (!target) {
    return null;
  }
  const rawValue = target.substring(COOKIE_NAME.length + 1);
  try {
    return JSON.parse(decodeURIComponent(rawValue));
  } catch (error) {
    console.warn('Impossible de décoder les préférences de pondération', error);
    return null;
  }
}

export function persistScorePreferences(weights) {
  if (typeof document === 'undefined') {
    return;
  }
  try {
    const payload = JSON.stringify(weights);
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(payload)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch (error) {
    console.warn("Impossible d'enregistrer les préférences de pondération", error);
  }
}

export function loadScorePreferencesFromCookie() {
  const overrides = parseCookiePayload();
  if (overrides) {
    setScoreWeightOverrides(overrides);
  } else {
    setScoreWeightOverrides(null);
  }
  return getScoreWeights();
}

export function resetScorePreferences() {
  setScoreWeightOverrides(null);
  if (typeof document !== 'undefined') {
    document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  }
  return getDefaultScoreWeights();
}

export function getScorePreferenceSummary() {
  const weights = getScoreWeights();
  const total = Object.values(weights).reduce((sum, weight) => sum + Number(weight || 0), 0) || 1;
  return Object.entries(weights).map(([key, weight]) => ({
    key,
    weight,
    percent: (Number(weight || 0) / total) * 100
  }));
}
