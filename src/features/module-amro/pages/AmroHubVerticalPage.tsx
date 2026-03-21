import { PlatformWidgetSlot } from '@/components/ui/enterprise';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDomain } from '@/contexts/DomainContext';
import {
  AMRO_ASYNCAPI_SPEC_PATH,
  AMRO_GRAPHQL_SUBGRAPH_PATH,
  AMRO_GRPC_PROTO_PATH,
  AMRO_MIGRATION_PLAN_PATH,
  AMRO_OPENAPI_SPEC_PATH,
  AMRO_PHASE_PLAN_PATH,
} from '@/pages/api/v2/amro/integration-contracts';
import { AMRO_PHASE_PLAN_MATRIX } from '@/pages/api/v2/amro/phase-plan-model';
import type { ReactNode } from 'react';
import { AmroOwnedWorkspace } from '../components/AmroOwnedWorkspace';

type AmroModuleShellProps = {
  children: ReactNode;
};

function AmroModuleShell({ children }: AmroModuleShellProps) {
  return (
    <section data-module-shell="module-amro" className="h-full w-full">
      {children}
    </section>
  );
}

function AmroWorkspaceSurface() {
  return <AmroOwnedWorkspace />;
}

export default function AmroHubVerticalPage() {
  const { currentDomain } = useDomain();
  const isAmroDomainActive = currentDomain?.code === 'AMRO';

  return (
    <DashboardLayout>
      <AmroModuleShell>
        <div className="flex-1 space-y-4 p-6" data-amro-uiux="base-preserved">
          <Card data-amro-base-surface="operations-overview">
            <CardHeader className="pb-2">
              <CardTitle>AMRO Operations Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Core dashboard shell, navigation, and platform look-and-feel remain unchanged while AMRO capabilities
                are layered as module-owned enhancements.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Base Platform UI Preserved</Badge>
                <Badge variant={isAmroDomainActive ? 'secondary' : 'destructive'}>
                  {isAmroDomainActive ? 'AMRO Domain Context Active' : 'AMRO Domain Context Required'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Accordion type="single" collapsible className="w-full" defaultValue="amro-enhancement-workspace">
            <AccordionItem value="amro-enhancement-workspace" className="rounded-md border px-3">
              <AccordionTrigger>Open AMRO Domain Workspace Enhancements</AccordionTrigger>
              <AccordionContent className="space-y-4 pb-2">
                <Card data-amro-contracts-surface="integration-contracts">
                  <CardHeader className="pb-2">
                    <CardTitle>AMRO Integration Contracts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Contract artifacts are published for REST, GraphQL, gRPC, and AsyncAPI to support coexistence and migration validation.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Dual-Read Deterministic Comparison</Badge>
                      <Badge variant="outline">Dual-Write Idempotency + Reconciliation</Badge>
                      <Badge variant="outline">Tenant/Franchise Cohort Flags</Badge>
                      <Badge variant="outline">Legacy Fallback with Queue Drain</Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                      <a className="rounded-md border p-2 hover:bg-muted/30" href={AMRO_OPENAPI_SPEC_PATH} target="_blank" rel="noreferrer">
                        OpenAPI 3.1 Contract
                      </a>
                      <a className="rounded-md border p-2 hover:bg-muted/30" href={AMRO_GRAPHQL_SUBGRAPH_PATH} target="_blank" rel="noreferrer">
                        GraphQL Subgraph Contract
                      </a>
                      <a className="rounded-md border p-2 hover:bg-muted/30" href={AMRO_GRPC_PROTO_PATH} target="_blank" rel="noreferrer">
                        gRPC Proto Contract
                      </a>
                      <a className="rounded-md border p-2 hover:bg-muted/30" href={AMRO_ASYNCAPI_SPEC_PATH} target="_blank" rel="noreferrer">
                        AsyncAPI Event Contract
                      </a>
                      <a className="rounded-md border p-2 hover:bg-muted/30" href={AMRO_PHASE_PLAN_PATH} target="_blank" rel="noreferrer">
                        Phase-Wise Plan API
                      </a>
                      <a className="rounded-md border p-2 hover:bg-muted/30" href={AMRO_MIGRATION_PLAN_PATH} target="_blank" rel="noreferrer">
                        Migration Plan API
                      </a>
                    </div>
                  </CardContent>
                </Card>
                <Card data-amro-phase-plan-surface="phase-plan">
                  <CardHeader className="pb-2">
                    <CardTitle>AMRO Phase-Wise Implementation Plan</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Delivery is sequenced by phases to preserve backward compatibility and controlled tenant/franchise rollout.
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {AMRO_PHASE_PLAN_MATRIX.map((phase) => (
                        <div key={phase.id} className="rounded-md border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{phase.label}</p>
                            <Badge variant="outline">{phase.duration}</Badge>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{phase.primaryFocus}</p>
                          <p className="mt-2 text-xs font-medium">Deliverables</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {phase.deliverables.map((deliverable) => (
                              <Badge key={`${phase.id}-${deliverable}`} variant="secondary">
                                {deliverable}
                              </Badge>
                            ))}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{phase.exitCriteria}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <PlatformWidgetSlot
                  widgets={[
                    {
                      id: 'amro-asset-contract',
                      title: 'AMRO Asset Contract',
                      content: 'Asset registry and configuration states are AMRO-owned and tenant/franchise scoped.',
                    },
                    {
                      id: 'amro-work-package-contract',
                      title: 'AMRO Work Package Contract',
                      content:
                        'Work package lifecycle transitions run through AMRO policy stages create-plan-schedule-execute-close.',
                    },
                    {
                      id: 'amro-compliance-contract',
                      title: 'AMRO Compliance Contract',
                      content: 'Compliance evidence and authority sign-off controls remain AMRO-owned with immutable chain records.',
                    },
                    {
                      id: 'amro-service-boundaries',
                      title: 'AMRO Service Boundaries',
                      content:
                        'Work-order, scheduling, compliance, materials, and audit-ledger services stay AMRO-bounded with scoped ownership.',
                    },
                  ]}
                >
                  <AmroWorkspaceSurface />
                </PlatformWidgetSlot>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </AmroModuleShell>
    </DashboardLayout>
  );
}
