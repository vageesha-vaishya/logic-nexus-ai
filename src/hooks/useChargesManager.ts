import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { RateOption, TransportLeg, Charge } from '@/types/quote-breakdown';

export interface ManagedCharge {
  id: string;
  legId: string | null; // null = combined/global
  category_id: string;
  categoryName: string;
  basis_id: string;
  basisName: string;
  unit: string;
  currency_id: string;
  currencyCode: string;
  buy: { quantity: number; rate: number; amount: number };
  sell: { quantity: number; rate: number; amount: number };
  note: string;
  basisDetails?: { tradeDirection: string; containerType: string; containerSize: string; quantity: number };
}

interface ReferenceData {
  chargeCategories: { id: string; code: string; name: string }[];
  chargeBases: { id: string; code: string; name: string }[];
  currencies: { id: string; code: string; name: string }[];
  chargeSides: { id: string; code: string; name: string }[];
}

export interface UseChargesManagerParams {
  selectedOption: RateOption;
  referenceData: ReferenceData;
  defaultMarginPercent?: number;
  initialCharges?: ManagedCharge[];
  initialLegs?: TransportLeg[];
  initialAutoMargin?: boolean;
  initialMarginPercent?: number;
  resetKey?: string;
  onStateChange?: (state: {
    legs: TransportLeg[];
    charges: ManagedCharge[];
    autoMargin: boolean;
    marginPercent: number;
  }) => void;
}

export interface UseChargesManagerReturn {
  legs: TransportLeg[];
  setLegs: (legs: TransportLeg[]) => void;
  chargesByLeg: Record<string, ManagedCharge[]>;
  allCharges: ManagedCharge[];
  addCharge: (legId: string | null) => void;
  updateCharge: (chargeId: string, field: string, value: any) => void;
  removeCharge: (chargeId: string) => void;
  autoMargin: boolean;
  setAutoMargin: (v: boolean) => void;
  marginPercent: number;
  setMarginPercent: (v: number) => void;
  totals: { totalSell: number; totalBuy: number; marginAmount: number };
  getChargesForSave: () => { charges: ManagedCharge[]; marginPercent: number };
}

let idCounter = 0;
function generateId(): string {
  return `mc-${Date.now()}-${++idCounter}`;
}

function findRefId(
  items: { id: string; code: string; name: string }[],
  nameOrCode: string
): string {
  if (!nameOrCode || !items.length) return items[0]?.id || '';
  const lower = nameOrCode.toLowerCase();
  const match =
    items.find((i) => i.code?.toLowerCase() === lower) ||
    items.find((i) => i.name?.toLowerCase() === lower) ||
    items.find((i) => i.name?.toLowerCase().includes(lower)) ||
    items.find((i) => lower.includes(i.name?.toLowerCase()));
  return match?.id || items[0]?.id || '';
}

function findRefName(items: { id: string; name: string }[], id: string): string {
  return items.find((i) => i.id === id)?.name || '';
}

function buildManagedCharge(
  charge: Charge,
  legId: string | null,
  refData: ReferenceData,
  marginPercent: number,
  autoMargin: boolean
): ManagedCharge {
  const categoryId = findRefId(refData.chargeCategories, charge.category || '');
  const basisId = findRefId(refData.chargeBases, charge.basis || 'shipment');
  const currencyId = findRefId(refData.currencies, charge.currency || 'USD');

  const sellQty = Number(charge?.sell?.quantity ?? charge.quantity ?? 1) || 1;
  const sellRate = Number(charge?.sell?.rate ?? charge.rate ?? charge.amount ?? 0) || 0;
  const rawSellAmount = Number(charge?.sell?.amount ?? (sellQty * sellRate)) || 0;
  const sellAmount = Number(rawSellAmount.toFixed(2));

  const buyQty = Number(charge?.buy?.quantity ?? sellQty) || 1;
  const computedBuyRate = autoMargin ? Number((sellRate / (1 + marginPercent / 100)).toFixed(2)) : sellRate;
  const buyRate = Number(charge?.buy?.rate ?? computedBuyRate) || 0;
  const rawBuyAmount = Number(charge?.buy?.amount ?? (buyQty * buyRate)) || 0;
  const buyAmount = Number(rawBuyAmount.toFixed(2));

  return {
    id: charge.id || generateId(),
    legId,
    category_id: categoryId,
    categoryName: findRefName(refData.chargeCategories, categoryId),
    basis_id: basisId,
    basisName: findRefName(refData.chargeBases, basisId),
    unit: charge.unit || '',
    currency_id: currencyId,
    currencyCode: findRefName(refData.currencies, currencyId) || charge.currency || 'USD',
    buy: { quantity: buyQty, rate: buyRate, amount: Number(buyAmount) },
    sell: { quantity: sellQty, rate: sellRate, amount: Number(sellAmount) },
    note: charge.note || '',
  };
}

function resolveLegId(charge: any): string | null {
  return charge?.legId || charge?.leg_id || null;
}

function chargeSignature(charge: ManagedCharge): string {
  const category = String(charge.category_id || charge.categoryName || '').toLowerCase().trim();
  const basis = String(charge.basis_id || charge.basisName || '').toLowerCase().trim();
  const currency = String(charge.currency_id || charge.currencyCode || '').toLowerCase().trim();
  const note = String(charge.note || '').trim().toLowerCase();
  const leg = charge.legId || 'combined';
  const bq = Number(charge.buy.quantity || 0).toFixed(4);
  const br = Number(charge.buy.rate || 0).toFixed(4);
  const ba = Number(charge.buy.amount || 0).toFixed(4);
  const sq = Number(charge.sell.quantity || 0).toFixed(4);
  const sr = Number(charge.sell.rate || 0).toFixed(4);
  const sa = Number(charge.sell.amount || 0).toFixed(4);
  return `${leg}|${category}|${basis}|${currency}|${bq}|${br}|${ba}|${sq}|${sr}|${sa}|${note}`;
}

function initCharges(
  option: RateOption,
  refData: ReferenceData,
  marginPercent: number,
  autoMargin: boolean
): ManagedCharge[] {
  const charges: ManagedCharge[] = [];
  const seen = new Set<string>();
  const pushUnique = (rawCharge: any, legId: string | null) => {
    const managed = buildManagedCharge(rawCharge, legId, refData, marginPercent, autoMargin);
    const sig = chargeSignature(managed);
    if (seen.has(sig)) return;
    seen.add(sig);
    charges.push(managed);
  };

  // Leg-specific charges
  if (option.legs) {
    option.legs.forEach((leg) => {
      if (leg.charges) {
        leg.charges.forEach((c) => {
          pushUnique(c, leg.id);
        });
      }
    });
  }

  // Global/combined charges
  if (option.charges) {
    option.charges.forEach((c) => {
      pushUnique(c, resolveLegId(c));
    });
  }

  // Fallback: create one charge from total price
  if (charges.length === 0 && option.price > 0) {
    const fallback: Charge = {
      category: 'Freight',
      name: 'Base Freight',
      amount: option.price,
      currency: option.currency || 'USD',
    };
    pushUnique(fallback, null);
  }

  return charges;
}

export function useChargesManager({
  selectedOption,
  referenceData,
  defaultMarginPercent = 15,
  initialCharges,
  initialLegs,
  initialAutoMargin,
  initialMarginPercent,
  resetKey,
  onStateChange,
}: UseChargesManagerParams): UseChargesManagerReturn {
  const [autoMargin, setAutoMargin] = useState<boolean>(initialAutoMargin ?? true);
  const [marginPercent, setMarginPercent] = useState<number>(initialMarginPercent ?? defaultMarginPercent);
  
  // Use refs to access latest state in callbacks without re-creating them
  const autoMarginRef = useRef(autoMargin);
  const marginPercentRef = useRef(marginPercent);

  useEffect(() => {
    autoMarginRef.current = autoMargin;
    marginPercentRef.current = marginPercent;
  }, [autoMargin, marginPercent]);

  const [charges, setCharges] = useState<ManagedCharge[]>(() =>
    initialCharges ?? initCharges(selectedOption, referenceData, initialMarginPercent ?? defaultMarginPercent, initialAutoMargin ?? true)
  );

  // Allow internal management of legs for manual creation 
  const [internalLegs, setInternalLegs] = useState<TransportLeg[]>((initialLegs ?? selectedOption.legs) || []);

  // Sync internal legs if selectedOption.legs changes externally (e.g. AI regeneration), 
  // but only if it's not a manual option (manual options are managed internally).
  // Actually, we should just init state from props and then let user edit.
  // But if props change (AI run), we want to update.
  // For now, let's trust that manual mode sets selectedOption once.
  // If we switch back to AI, selectedOption changes completely.
  
  // Actually, useEffect to sync is safer for transitions.
  // But we want to edit 'legs' in manual mode.
  // So we expose setInternalLegs as setLegs.
  
  // Note: We need to be careful not to overwrite manual edits if the parent re-renders.
  // If selectedOption.id changes, we reset.
  useEffect(() => {
    setAutoMargin(initialAutoMargin ?? true);
    setMarginPercent(initialMarginPercent ?? defaultMarginPercent);
    setCharges(initialCharges ?? initCharges(selectedOption, referenceData, initialMarginPercent ?? defaultMarginPercent, initialAutoMargin ?? true));
    setInternalLegs((initialLegs ?? selectedOption.legs) || []);
  }, [
    resetKey,
    selectedOption.id,
    // defaultMarginPercent,
    // initialAutoMargin,
    // initialMarginPercent,
    // initialCharges,
    // initialLegs,
  ]);

  useEffect(() => {
    onStateChange?.({
      legs: internalLegs,
      charges,
      autoMargin,
      marginPercent,
    });
  }, [charges, internalLegs, autoMargin, marginPercent, onStateChange]);

  const chargesByLeg = useMemo(() => {
    const grouped: Record<string, ManagedCharge[]> = {};
    charges.forEach((c) => {
      const key = c.legId || 'combined';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    });
    return grouped;
  }, [charges]);

  const addCharge = useCallback(
    (legId: string | null) => {
      const defaultCatId = referenceData.chargeCategories.find((c) => c.code === 'fee')?.id || referenceData.chargeCategories[0]?.id || '';
      const defaultBasisId = referenceData.chargeBases.find((b) => b.code === 'shipment')?.id || referenceData.chargeBases[0]?.id || '';
      const defaultCurrId = referenceData.currencies.find((c) => c.code === 'USD')?.id || referenceData.currencies[0]?.id || '';

      const newCharge: ManagedCharge = {
        id: generateId(),
        legId,
        category_id: defaultCatId,
        categoryName: findRefName(referenceData.chargeCategories, defaultCatId),
        basis_id: defaultBasisId,
        basisName: findRefName(referenceData.chargeBases, defaultBasisId),
        unit: '',
        currency_id: defaultCurrId,
        currencyCode: referenceData.currencies.find((c) => c.id === defaultCurrId)?.code || 'USD',
        buy: { quantity: 1, rate: 0, amount: 0 },
        sell: { quantity: 1, rate: 0, amount: 0 },
        note: '',
      };
      setCharges((prev) => [...prev, newCharge]);
    },
    [referenceData]
  );

  const updateCharge = useCallback(
    (chargeId: string, field: string, value: any) => {
      setCharges((prev) =>
        prev.map((c) => {
          if (c.id !== chargeId) return c;

          const updated = { ...c };

          // Handle nested fields like 'buy.rate', 'sell.quantity'
          if (field.includes('.')) {
            const [parent, child] = field.split('.') as ['buy' | 'sell', string];
            updated[parent] = { ...updated[parent], [child]: value };
            // Recalculate amount
            updated[parent].amount = Number((updated[parent].quantity * updated[parent].rate).toFixed(2));

            // Auto-margin: if buy rate changes, recalculate sell
            if (autoMarginRef.current && parent === 'buy' && child === 'rate') {
              const newSellRate = Number((value * (1 + marginPercentRef.current / 100)).toFixed(2));
              updated.sell = {
                ...updated.sell,
                rate: newSellRate,
                amount: Number((updated.sell.quantity * newSellRate).toFixed(2)),
              };
            }
            // Auto-margin: if buy quantity changes, sync sell quantity
            if (autoMarginRef.current && parent === 'buy' && child === 'quantity') {
              updated.sell = {
                ...updated.sell,
                quantity: value,
                amount: Number((value * updated.sell.rate).toFixed(2)),
              };
            }
          } else if (field === 'category_id') {
            updated.category_id = value;
            updated.categoryName = findRefName(referenceData.chargeCategories, value);
          } else if (field === 'basis_id') {
            updated.basis_id = value;
            updated.basisName = findRefName(referenceData.chargeBases, value);
          } else if (field === 'currency_id') {
            updated.currency_id = value;
            updated.currencyCode = referenceData.currencies.find((c) => c.id === value)?.code || '';
          } else {
            (updated as any)[field] = value;
          }

          return updated;
        })
      );
    },
    [referenceData]
  );

  const removeCharge = useCallback((chargeId: string) => {
    setCharges((prev) => prev.filter((c) => c.id !== chargeId));
  }, []);

  const totals = useMemo(() => {
    const totalSell = charges.reduce((sum, c) => sum + c.sell.amount, 0);
    const totalBuy = charges.reduce((sum, c) => sum + c.buy.amount, 0);
    return {
      totalSell: Number(totalSell.toFixed(2)),
      totalBuy: Number(totalBuy.toFixed(2)),
      marginAmount: Number((totalSell - totalBuy).toFixed(2)),
    };
  }, [charges]);

  const getChargesForSave = useCallback(() => {
    return { charges, marginPercent };
  }, [charges, marginPercent]);

  return {
    legs: internalLegs,
    setLegs: setInternalLegs,
    chargesByLeg,
    allCharges: charges,
    addCharge,
    updateCharge,
    removeCharge,
    autoMargin,
    setAutoMargin,
    marginPercent,
    setMarginPercent,
    totals,
    getChargesForSave,
  };
}
