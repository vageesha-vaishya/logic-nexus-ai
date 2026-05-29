
export const getSafeName = (obj: any, fallback: string = '') => {
  if (obj === null || obj === undefined) return fallback;
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number') return String(obj);
  if (typeof obj === 'object') {
      return obj.name || obj.code || obj.details || obj.description || fallback;
  }
  return String(obj);
};

export const calculateLegChargesTotal = (leg: any, side: 'buy' | 'sell' = 'sell'): number => {
  if (!leg || !leg.charges) return 0;
  return leg.charges.reduce((acc: number, charge: any) => {
    const qty = charge[side]?.quantity || 0;
    const rate = charge[side]?.rate || 0;
    return acc + (qty * rate);
  }, 0);
};

export const calculateChargesTotal = (charges: any[], side: 'buy' | 'sell' = 'sell'): number => {
  if (!charges) return 0;
  return charges.reduce((acc: number, charge: any) => {
    const qty = charge[side]?.quantity || 0;
    const rate = charge[side]?.rate || 0;
    return acc + (qty * rate);
  }, 0);
};
