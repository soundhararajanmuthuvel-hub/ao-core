/**
 * Converts a numeric value from one unit of measure to another.
 * Supported categories:
 * - Weight: Kg, Gram (g), Ton, t
 * - Volume: Liter, L, ml
 * - Pieces: Piece, Box, Carton (no conversion factor, 1-to-1 fallback)
 */
export function convertUnit(value, fromUnit, toUnit) {
  if (value === undefined || value === null || isNaN(value)) return 0;
  const val = Number(value);
  const from = (fromUnit || '').toLowerCase().trim();
  const to = (toUnit || '').toLowerCase().trim();

  if (from === to || !from || !to) return val;

  // Weight conversions (base: kg)
  const weightFactors = {
    kg: 1,
    kilogram: 1,
    g: 0.001,
    gram: 0.001,
    grams: 0.001,
    ton: 1000,
    t: 1000,
  };

  // Volume conversions (base: liter)
  const volumeFactors = {
    liter: 1,
    l: 1,
    liters: 1,
    ml: 0.001,
    milliliter: 0.001,
    milliliters: 0.001,
  };

  const isWeightFrom = weightFactors[from] !== undefined;
  const isWeightTo = weightFactors[to] !== undefined;
  if (isWeightFrom && isWeightTo) {
    const valueInKg = val * weightFactors[from];
    return valueInKg / weightFactors[to];
  }

  const isVolumeFrom = volumeFactors[from] !== undefined;
  const isVolumeTo = volumeFactors[to] !== undefined;
  if (isVolumeFrom && isVolumeTo) {
    const valueInLiter = val * volumeFactors[from];
    return valueInLiter / volumeFactors[to];
  }

  return val; // Return original value if units are incompatible
}
