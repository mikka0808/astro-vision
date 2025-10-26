import { computeMoonPhase, approximateMoonEquatorial, horizontalCoordinates } from './astro.js';

const DEG_TO_RAD = Math.PI / 180;

function toISODate(date) {
  if (!(date instanceof Date)) return null;
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function computeMoonSession(dateInput, latitude, longitude) {
  const date = dateInput instanceof Date ? new Date(dateInput.getTime()) : new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const basePhase = computeMoonPhase(date);

  let altitude = null;
  let altitudeRad = null;
  let azimuth = null;
  let azimuthRad = null;
  let aboveHorizon = null;

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    try {
      const equatorial = approximateMoonEquatorial(date);
      if (equatorial && Number.isFinite(equatorial.raHours) && Number.isFinite(equatorial.decDeg)) {
        const horizontal = horizontalCoordinates(equatorial, { latitude, longitude }, date);
        if (horizontal && Number.isFinite(horizontal.altitude)) {
          altitude = horizontal.altitude;
          altitudeRad = altitude * DEG_TO_RAD;
          aboveHorizon = altitude >= 0;
        }
        if (horizontal && Number.isFinite(horizontal.azimuth)) {
          azimuth = horizontal.azimuth;
          azimuthRad = azimuth * DEG_TO_RAD;
        }
      }
    } catch (error) {
      console.warn('Calcul de la position lunaire impossible :', error);
    }
  }

  return {
    ...basePhase,
    altitude,
    altitudeRad: Number.isFinite(altitudeRad) ? altitudeRad : null,
    azimuth,
    azimuthRad: Number.isFinite(azimuthRad) ? azimuthRad : null,
    aboveHorizon,
    observationDate: toISODate(date)
  };
}
