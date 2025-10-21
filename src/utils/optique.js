const DEG_PER_RAD = 57.2958;
const ARCSEC_PER_RAD = 206;
function sanitizePositive(value, fallback = 0) {
    if (!Number.isFinite(value)) {
        return fallback;
    }
    if (value <= 0) {
        return fallback;
    }
    return value;
}
export function focaleEffective(focaleMm, reducteur = 1) {
    const focale = sanitizePositive(focaleMm);
    const ratio = sanitizePositive(reducteur, 1) || 1;
    return focale * ratio;
}
export function fovDeg(dimMm, focaleEffMm) {
    const dimension = sanitizePositive(dimMm);
    const focale = sanitizePositive(focaleEffMm);
    if (dimension === 0 || focale === 0) {
        return 0;
    }
    return (DEG_PER_RAD * dimension) / focale;
}
export function echantillonnage(pixelUm, focaleEffMm, bin = 1) {
    const pixel = sanitizePositive(pixelUm);
    const focale = sanitizePositive(focaleEffMm);
    const binning = sanitizePositive(bin, 1) || 1;
    if (pixel === 0 || focale === 0) {
        return 0;
    }
    return (ARCSEC_PER_RAD * (pixel * binning)) / focale;
}
