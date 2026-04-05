import { uimApiRequest } from './uimApi';

export type UimCommandType = 'RECEIVE' | 'MOVE' | 'RESERVE' | 'CONSUME';

export type UimExecuteCommandInput = {
  command_type: UimCommandType;
  command_payload: Record<string, unknown>;
  idempotency_key?: string;
};

export type UimExecuteCommandOutput = {
  output: {
    command_id: string;
    command_type: UimCommandType;
    command_status: 'applied' | 'accepted' | 'failed';
    applied_output: Record<string, unknown>;
  };
};

export async function executeUimCommand(input: UimExecuteCommandInput): Promise<UimExecuteCommandOutput> {
  return uimApiRequest<UimExecuteCommandOutput, UimExecuteCommandInput>({
    method: 'POST',
    path: '/commands',
    body: input,
  });
}

export async function replayUimProjections(): Promise<{
  output: {
    replayed_events: number;
    updated_snapshots: number;
  };
}> {
  return uimApiRequest({
    method: 'POST',
    path: '/projections/replay',
    body: {},
  });
}

export async function queryUimProjectionItems(limit = 50, offset = 0): Promise<{
  output: {
    pagination: {
      limit: number;
      offset: number;
      total: number;
    };
    snapshots: Array<Record<string, unknown>>;
  };
}> {
  return uimApiRequest({
    method: 'GET',
    path: `/projections/items?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`,
  });
}
