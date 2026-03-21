import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '@/pages/api/_utils/types';
import openApiHandler from './openapi-3.1';
import subgraphHandler from './amro-subgraph';
import protoHandler from './amro-v1';
import asyncApiHandler from './asyncapi-2.6';
import { serveAmroContractArtifact } from '../contract-artifact-handler';

vi.mock('../contract-artifact-handler', () => ({
  serveAmroContractArtifact: vi.fn(),
}));

describe('/api/v2/amro/contracts endpoints', () => {
  const req: ApiRequest = { method: 'GET', query: {}, headers: {} };
  const res = {} as ApiResponse;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes OpenAPI contract endpoint to openapi artifact', async () => {
    await openApiHandler(req, res);
    expect(serveAmroContractArtifact).toHaveBeenCalledWith(req, res, {
      fileName: 'openapi-3.1.yaml',
      contentType: 'application/yaml; charset=utf-8',
    });
  });

  it('routes GraphQL endpoint to subgraph artifact', async () => {
    await subgraphHandler(req, res);
    expect(serveAmroContractArtifact).toHaveBeenCalledWith(req, res, {
      fileName: 'amro-subgraph.graphql',
      contentType: 'application/graphql; charset=utf-8',
    });
  });

  it('routes gRPC endpoint to proto artifact', async () => {
    await protoHandler(req, res);
    expect(serveAmroContractArtifact).toHaveBeenCalledWith(req, res, {
      fileName: 'amro-v1.proto',
      contentType: 'application/protobuf; charset=utf-8',
    });
  });

  it('routes AsyncAPI endpoint to asyncapi artifact', async () => {
    await asyncApiHandler(req, res);
    expect(serveAmroContractArtifact).toHaveBeenCalledWith(req, res, {
      fileName: 'asyncapi-2.6.yaml',
      contentType: 'application/yaml; charset=utf-8',
    });
  });
});
