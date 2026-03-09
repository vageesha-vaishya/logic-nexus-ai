import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { MglChargeRow, MglRateOption, MglTransportLeg } from '@/services/quotation/mgl';
import { MGL_DEFAULT_EQUIPMENT_COLUMNS, calculateMglRateOption } from '@/services/quotation/mgl';
import { MglMainTemplateService } from '@/services/quotation/MglMainTemplateService';

interface MglMainTemplateBuilderProps {
  tenantId: string;
  quoteId: string;
  quoteVersionId?: string;
  initialOption?: Partial<MglRateOption>;
  onSaved?: (rateOptionId: string) => void;
}

function createDefaultRow(rowName: string): MglChargeRow {
  const valuesByEquipment: Record<string, number> = {};
  MGL_DEFAULT_EQUIPMENT_COLUMNS.forEach((col) => {
    valuesByEquipment[col.key] = 0;
  });

  return {
    id: crypto.randomUUID(),
    rowCode: rowName.toUpperCase().replace(/\s+/g, '_'),
    rowName,
    currency: 'USD',
    includeInTotal: true,
    valuesByEquipment,
  };
}

function createDefaultLeg(): MglTransportLeg {
  return {
    id: crypto.randomUUID(),
    sequenceNo: 1,
    mode: 'ocean',
    originCode: '',
    destinationCode: '',
  };
}

export function MglMainTemplateBuilder({
  tenantId,
  quoteId,
  quoteVersionId,
  initialOption,
  onSaved,
}: MglMainTemplateBuilderProps) {
  const [saving, setSaving] = useState(false);

  const [option, setOption] = useState<MglRateOption>({
    id: initialOption?.id || crypto.randomUUID(),
    quoteId,
    quoteVersionId,
    optionName: initialOption?.optionName || 'MGL Matrix Option',
    carrierName: initialOption?.carrierName || 'ZIM',
    rateType: initialOption?.rateType || 'spot',
    rateValidUntil: initialOption?.rateValidUntil || '2099-01-01T00:00:00.000Z',
    transitTimeDays: initialOption?.transitTimeDays || 1,
    frequencyPerWeek: initialOption?.frequencyPerWeek || 1,
    mode: initialOption?.mode || 'multimodal',
    equipmentColumns: initialOption?.equipmentColumns || [...MGL_DEFAULT_EQUIPMENT_COLUMNS],
    legs: initialOption?.legs || [createDefaultLeg()],
    chargeRows:
      initialOption?.chargeRows || [createDefaultRow('Ocean Freight'), createDefaultRow('Trucking')],
    containerType: initialOption?.containerType || 'standard',
    containerSize: initialOption?.containerSize || "20'",
    commodityType: initialOption?.commodityType || 'general',
    originCode: initialOption?.originCode || 'USNYC',
    destinationCode: initialOption?.destinationCode || 'INDED',
    standaloneMode: initialOption?.standaloneMode ?? true,
    optionOrdinal: initialOption?.optionOrdinal || 1,
    remarks: initialOption?.remarks || 'All Inclusive rates from SD/Port basis',
  });

  const calculated = useMemo(() => calculateMglRateOption(option), [option]);

  const updateRowValue = (rowId: string, equipmentKey: string, amount: string) => {
    const numeric = Number(amount || 0);
    setOption((prev) => ({
      ...prev,
      chargeRows: prev.chargeRows.map((row) => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          valuesByEquipment: {
            ...row.valuesByEquipment,
            [equipmentKey]: Number.isFinite(numeric) ? numeric : 0,
          },
        };
      }),
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await MglMainTemplateService.upsertRateOption(tenantId, option);
      toast.success('MGL rate option saved');
      if (response?.id) {
        onSaved?.(response.id);
        setOption((prev) => ({ ...prev, id: response.id }));
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save MGL rate option');
    } finally {
      setSaving(false);
    }
  };

  const saveStandaloneSet = async () => {
    setSaving(true);
    try {
      const options = MglMainTemplateService.generateStandaloneOptions({
        quoteId,
        quoteVersionId,
        carrierName: option.carrierName,
        containerType: option.containerType || 'standard',
        containerSize: option.containerSize || "20'",
        commodityType: option.commodityType || 'general',
        originCode: option.originCode || 'USNYC',
        destinationCode: option.destinationCode || 'INDED',
        transitPoints: option.transitPoints,
        legConnections: option.legConnections,
        legs: option.legs,
        baseChargeRows: option.chargeRows,
        hsCode: option.hsCode,
        imdgClass: option.imdgClass,
        temperatureControlMinC: option.temperatureControlMinC,
        temperatureControlMaxC: option.temperatureControlMaxC,
        oversizedLengthCm: option.oversizedLengthCm,
        oversizedWidthCm: option.oversizedWidthCm,
        oversizedHeightCm: option.oversizedHeightCm,
        rateValidUntil: option.rateValidUntil,
        equipmentColumns: option.equipmentColumns,
      });
      const setValidation = MglMainTemplateService.validateStandaloneOptions(options);
      if (!setValidation.valid) {
        throw new Error(setValidation.errors.map((issue) => issue.message).join('; '));
      }
      const saved = await Promise.all(
        options.map((generatedOption) => MglMainTemplateService.upsertRateOption(tenantId, generatedOption)),
      );
      const firstSaved = saved.find((item) => item?.id);
      if (firstSaved?.id) {
        onSaved?.(firstSaved.id);
      }
      toast.success('Standalone 4-option set saved');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save standalone set');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        <CardTitle>MGL Main Template Builder</CardTitle>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Carrier</Label>
            <Input
              value={option.carrierName}
              onChange={(e) => setOption((prev) => ({ ...prev, carrierName: e.target.value }))}
            />
          </div>
          <div>
            <Label>Transit Time (Days)</Label>
            <Input
              type="number"
              value={option.transitTimeDays || 0}
              onChange={(e) =>
                setOption((prev) => ({ ...prev, transitTimeDays: Number(e.target.value || 0) }))
              }
            />
          </div>
          <div>
            <Label>Frequency / Week</Label>
            <Input
              type="number"
              value={option.frequencyPerWeek || 0}
              onChange={(e) =>
                setOption((prev) => ({ ...prev, frequencyPerWeek: Number(e.target.value || 0) }))
              }
            />
          </div>
          <div>
            <Label>Rate Type</Label>
            <Input
              value={option.rateType || 'spot'}
              onChange={(e) => setOption((prev) => ({ ...prev, rateType: (e.target.value || 'spot') as any }))}
            />
          </div>
          <div>
            <Label>Rate Valid Until</Label>
            <Input
              value={option.rateValidUntil || ''}
              onChange={(e) => setOption((prev) => ({ ...prev, rateValidUntil: e.target.value }))}
            />
          </div>
          <div>
            <Label>Remarks</Label>
            <Input
              value={option.remarks || ''}
              onChange={(e) => setOption((prev) => ({ ...prev, remarks: e.target.value }))}
            />
          </div>
          <div>
            <Label>Container Type</Label>
            <Input
              value={option.containerType || 'standard'}
              onChange={(e) =>
                setOption((prev) => ({ ...prev, containerType: (e.target.value || 'standard') as any }))
              }
            />
          </div>
          <div>
            <Label>Container Size</Label>
            <Input
              value={option.containerSize || "20'"}
              onChange={(e) =>
                setOption((prev) => ({ ...prev, containerSize: (e.target.value || "20'") as any }))
              }
            />
          </div>
          <div>
            <Label>Commodity Type</Label>
            <Input
              value={option.commodityType || 'general'}
              onChange={(e) =>
                setOption((prev) => ({ ...prev, commodityType: (e.target.value || 'general') as any }))
              }
            />
          </div>
          <div>
            <Label>Origin</Label>
            <Input
              value={option.originCode || ''}
              onChange={(e) => setOption((prev) => ({ ...prev, originCode: e.target.value }))}
            />
          </div>
          <div>
            <Label>Destination</Label>
            <Input
              value={option.destinationCode || ''}
              onChange={(e) => setOption((prev) => ({ ...prev, destinationCode: e.target.value }))}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="overflow-x-auto border rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60">
                <th className="text-left p-2 min-w-[180px]">Charges</th>
                {option.equipmentColumns.map((col) => (
                  <th key={col.key} className="text-left p-2 min-w-[130px]">
                    {col.label}
                  </th>
                ))}
                <th className="text-left p-2 min-w-[220px]">Remarks</th>
                <th className="p-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {option.chargeRows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-2">
                    <Input
                      value={row.rowName}
                      onChange={(e) =>
                        setOption((prev) => ({
                          ...prev,
                          chargeRows: prev.chargeRows.map((r) =>
                            r.id === row.id ? { ...r, rowName: e.target.value } : r,
                          ),
                        }))
                      }
                    />
                  </td>
                  {option.equipmentColumns.map((col) => (
                    <td key={`${row.id}:${col.key}`} className="p-2">
                      <Input
                        type="number"
                        value={Number(row.valuesByEquipment[col.key] || 0)}
                        onChange={(e) => updateRowValue(row.id, col.key, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="p-2">
                    <Input
                      value={row.remarks || ''}
                      onChange={(e) =>
                        setOption((prev) => ({
                          ...prev,
                          chargeRows: prev.chargeRows.map((r) =>
                            r.id === row.id ? { ...r, remarks: e.target.value } : r,
                          ),
                        }))
                      }
                    />
                  </td>
                  <td className="p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setOption((prev) => ({
                          ...prev,
                          chargeRows: prev.chargeRows.filter((r) => r.id !== row.id),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}

              <tr className="border-t bg-primary/10 font-semibold">
                <td className="p-2">Total</td>
                {option.equipmentColumns.map((col) => (
                  <td key={`total:${col.key}`} className="p-2">
                    {calculated.totalsByEquipment[col.key]?.toFixed(2) || '0.00'}
                  </td>
                ))}
                <td className="p-2">{option.remarks || ''}</td>
                <td className="p-2" />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setOption((prev) => ({
                ...prev,
                chargeRows: [...prev.chargeRows, createDefaultRow('New Charge')],
              }))
            }
          >
            <Plus className="w-4 h-4 mr-1" /> Add Charge Row
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Save Rate Option'}
          </Button>
          <Button type="button" variant="secondary" onClick={saveStandaloneSet} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Save 4 Standalone Options'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
