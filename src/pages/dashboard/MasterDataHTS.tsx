import { DashboardLayout } from '@/components/layout/DashboardLayout';
import AESHTSCodeManager from '@/components/aes-hts-code-manager';

export default function MasterDataHTS() {
  return (
    <DashboardLayout>
      <AESHTSCodeManager />
    </DashboardLayout>
  );
}