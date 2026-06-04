// AogDeclareDialog — minimal 5-field declare form. Per design slice S6.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Siren } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

import {
  useCreateAogAlert,
  type AogReporterRole,
} from '../../hooks/useAogAlerts';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REPORTER_ROLES: AogReporterRole[] = [
  'flight_crew', 'maintenance', 'ground_ops', 'engineering', 'other',
];

const REPORTER_ROLE_LABEL: Record<AogReporterRole, string> = {
  flight_crew: 'Flight crew',
  maintenance: 'Maintenance',
  ground_ops: 'Ground ops',
  engineering: 'Engineering',
  other: 'Other',
};

export function AogDeclareDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const create = useCreateAogAlert();

  const [registration, setRegistration] = useState('');
  const [airport, setAirport] = useState('');
  const [defect, setDefect] = useState('');
  const [reporterRole, setReporterRole] = useState<AogReporterRole>('maintenance');
  const [severity, setSeverity] = useState('');

  const reset = () => {
    setRegistration('');
    setAirport('');
    setDefect('');
    setReporterRole('maintenance');
    setSeverity('');
  };

  const handleSubmit = async () => {
    const a = airport.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(a)) {
      toast.error('Airport must be a 3-letter IATA code (e.g. DEL)');
      return;
    }
    if (!defect.trim()) {
      toast.error('Defect summary is required');
      return;
    }
    const alert = await create.mutateAsync({
      aircraft_registration: registration.trim() || null,
      airport_iata: a,
      defect_summary: defect.trim(),
      reporter_role: reporterRole,
      severity_signal: severity.trim() || null,
    });
    reset();
    onOpenChange(false);
    navigate(`/dashboard/amro/aog/${alert.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Siren className="h-5 w-5 text-rose-600" />
            Declare AOG
          </DialogTitle>
          <DialogDescription>
            Minimum five fields. AI triage fires automatically on the next screen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="reg" className="text-xs">Aircraft registration</Label>
              <Input
                id="reg"
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
                placeholder="VT-INK"
              />
            </div>
            <div>
              <Label htmlFor="airport" className="text-xs">Airport (IATA)</Label>
              <Input
                id="airport"
                value={airport}
                onChange={(e) => setAirport(e.target.value.toUpperCase())}
                placeholder="DEL"
                maxLength={3}
                className="font-mono"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="defect" className="text-xs">Defect summary *</Label>
            <Textarea
              id="defect"
              value={defect}
              onChange={(e) => setDefect(e.target.value)}
              rows={3}
              placeholder="Left main gear door stuck on retract — multiple GEAR DOORS warnings on takeoff"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="role" className="text-xs">Reporter</Label>
              <Select
                value={reporterRole}
                onValueChange={(v) => setReporterRole(v as AogReporterRole)}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORTER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{REPORTER_ROLE_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="severity" className="text-xs">Severity signal</Label>
              <Input
                id="severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                placeholder="Cannot dispatch revenue"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleSubmit()}
            disabled={create.isPending}
          >
            {create.isPending ? 'Declaring…' : 'Declare AOG'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AogDeclareDialog;
