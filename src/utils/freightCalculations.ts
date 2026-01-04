
export interface WeightVolume {
  weight: number; // in kg
  volume: number; // in cbm
}

export type TransportMode = 'air' | 'sea' | 'road' | 'rail' | 'courier' | 'trucking' | 'ocean' | 'railway';

/**
 * Calculates the chargeable weight based on the transport mode and dimensions/weight.
 * 
 * Standard conversion factors (approximate industry standards):
 * - Air: 1 CBM = 167 KG (1:6)
 * - Sea: 1 CBM = 1000 KG (1:1) - usually w/m (weight or measure)
 * - Road: 1 CBM = 333 KG (1:3) - varies by region/carrier
 * - Courier: 1 CBM = 200 KG (1:5) - varies
 * - Rail: 1 CBM = 500 KG (1:2) - varies
 */
export const calculateChargeableWeight = (
  weight: number,
  volume: number,
  mode: TransportMode = 'sea'
): number => {
  if (!weight && !volume) return 0;

  const actualWeight = Number(weight) || 0;
  const vol = Number(volume) || 0;
  
  let volumetricWeight = 0;

  switch (mode.toLowerCase()) {
    case 'air':
      // Standard Air Freight: 1 CBM = 166.67 KG
      volumetricWeight = vol * 167;
      break;
    case 'road':
    case 'trucking':
      // Standard Road Freight: 1 CBM = 333 KG
      volumetricWeight = vol * 333;
      break;
    case 'courier':
      // Standard Courier: 1 CBM = 200 KG
      volumetricWeight = vol * 200;
      break;
    case 'rail':
    case 'railway':
      // Standard Rail: 1 CBM = 500 KG
      volumetricWeight = vol * 500;
      break;
    case 'sea':
    case 'ocean':
    default:
      // Sea Freight: 1 CBM = 1000 KG (usually billed per ton or per CBM, whichever is higher revenue)
      // For chargeable weight in KG context:
      volumetricWeight = vol * 1000;
      break;
  }

  // Chargeable weight is the greater of Actual Weight vs Volumetric Weight
  return Math.max(actualWeight, volumetricWeight);
};

export const formatWeight = (weight: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(weight);
};
