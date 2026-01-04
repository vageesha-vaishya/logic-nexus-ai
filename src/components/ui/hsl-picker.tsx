import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type HslPickerProps = {
  label?: string;
  value: string; // e.g., "217 91% 60%"
  onChange: (v: string) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseHslString(str: string) {
  const parts = str.trim().split(/\s+/);
  const h = clamp(parseFloat(parts[0] ?? '0') || 0, 0, 360);
  const s = clamp(parseFloat((parts[1] ?? '0').replace('%', '')) || 0, 0, 100);
  const l = clamp(parseFloat((parts[2] ?? '0').replace('%', '')) || 0, 0, 100);
  return { h, s, l };
}

function composeHslString(h: number, s: number, l: number) {
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

function hslToHexString(h: number, s: number, l: number) {
  s = s / 100; l = l / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHslString(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h = h * 60;
  }
  return composeHslString(h, s * 100, l * 100);
}

export function HslPicker({ label, value, onChange }: HslPickerProps) {
  const { h, s, l } = useMemo(() => parseHslString(value), [value]);
  const hex = useMemo(() => hslToHexString(h, s, l), [h, s, l]);

  return (
    <div className="space-y-2">
      {label && <Label className="text-sm">{label} (HSL)</Label>}
      <div className="flex items-center gap-2">
        <Label className="text-xs">Pick</Label>
        <Input type="color" value={hex} onChange={(e) => onChange(hexToHslString(e.target.value))} />
        <div className="h-6 w-6 rounded" style={{ backgroundColor: hex }} />
      </div>
      <div className="space-y-1">
        <div className="grid grid-cols-5 items-center gap-2">
          <Label className="text-xs">Hue</Label>
          <input className="col-span-3" type="range" min={0} max={360} value={h} onChange={(e) => onChange(composeHslString(Number(e.target.value), s, l))} />
          <Input className="text-xs" type="number" min={0} max={360} value={h} onChange={(e) => onChange(composeHslString(Number(e.target.value), s, l))} />
        </div>
        <div className="grid grid-cols-5 items-center gap-2">
          <Label className="text-xs">Sat</Label>
          <input className="col-span-3" type="range" min={0} max={100} value={s} onChange={(e) => onChange(composeHslString(h, Number(e.target.value), l))} />
          <Input className="text-xs" type="number" min={0} max={100} value={s} onChange={(e) => onChange(composeHslString(h, Number(e.target.value), l))} />
        </div>
        <div className="grid grid-cols-5 items-center gap-2">
          <Label className="text-xs">Light</Label>
          <input className="col-span-3" type="range" min={0} max={100} value={l} onChange={(e) => onChange(composeHslString(h, s, Number(e.target.value))) } />
          <Input className="text-xs" type="number" min={0} max={100} value={l} onChange={(e) => onChange(composeHslString(h, s, Number(e.target.value))) } />
        </div>
      </div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g., 217 91% 60%" />
    </div>
  );
}