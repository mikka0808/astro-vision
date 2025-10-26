import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { horizontalCoordinates, localSiderealTime } from '../src/core/astro.js';

function closeTo(actual, expected, delta = 0.5) {
  assert.ok(Math.abs(actual - expected) <= delta, `Expected ${actual} to be within ${delta} of ${expected}`);
}

describe('horizontalCoordinates', () => {
  it('places an equatorial object at zenith when RA matches local sidereal time', () => {
    const location = { latitude: 0, longitude: 0 };
    const date = new Date('2024-01-01T00:00:00Z');
    const ra = localSiderealTime(date, location.longitude);
    const coords = horizontalCoordinates({ raHours: ra, decDeg: 0 }, location, date);
    closeTo(coords.altitude, 90, 0.01);
    closeTo(coords.azimuth, 180, 1);
  });

  it('computes sensible altitude and azimuth for offset hour angles', () => {
    const location = { latitude: 45.0, longitude: 2.0 };
    const date = new Date('2024-02-12T21:00:00Z');
    const lst = localSiderealTime(date, location.longitude);
    const ra = (lst - 6 + 24) % 24;
    const dec = 20;
    const coords = horizontalCoordinates({ raHours: ra, decDeg: dec }, location, date);
    // Expected altitude using spherical astronomy formula.
    const hourAngleHours = ((lst - ra + 24) % 24) > 12 ? ((lst - ra + 24) % 24) - 24 : (lst - ra + 24) % 24;
    const hourAngleRad = (hourAngleHours * 15 * Math.PI) / 180;
    const latRad = (location.latitude * Math.PI) / 180;
    const decRad = (dec * Math.PI) / 180;
    const expectedAltRad = Math.asin(
      Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(hourAngleRad)
    );
    const expectedAlt = (expectedAltRad * 180) / Math.PI;
    closeTo(coords.altitude, expectedAlt, 0.2);
    assert.ok(coords.azimuth >= 0 && coords.azimuth <= 360, 'Azimuth should be normalized');
  });
});
