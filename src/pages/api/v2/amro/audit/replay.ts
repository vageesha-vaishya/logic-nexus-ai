import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import auditLedgerReplayHandler from '../audit-ledger-replay';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const forwardedReq = {
    ...req,
    method: 'GET',
  } as ApiRequest;
  return auditLedgerReplayHandler(forwardedReq, res);
}
