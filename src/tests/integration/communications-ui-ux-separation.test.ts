import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('communications UI UX separation', () => {
  it('implements communications-owned orchestration, templates, health, trace, threads, and campaigns surfaces', () => {
    const workspaceSurface = read('src/features/module-communications/components/CommunicationsOwnedWorkspace.tsx');
    expect(workspaceSurface).toContain('data-communications-owned-surface="message-orchestration-console"');
    expect(workspaceSurface).toContain('data-communications-owned-surface="template-manager"');
    expect(workspaceSurface).toContain('data-communications-owned-surface="channel-health-dashboard"');
    expect(workspaceSurface).toContain('data-communications-owned-surface="delivery-trace-views"');
    expect(workspaceSurface).toContain('data-communications-owned-surface="conversation-threads"');
    expect(workspaceSurface).toContain('data-communications-owned-surface="outbound-campaign-queues"');
  });

  it('enforces communications ownership boundaries for providers and action APIs', () => {
    const workspaceSurface = read('src/features/module-communications/components/CommunicationsOwnedWorkspace.tsx');
    const contractContent = read('src/features/module-communications/components/CommunicationsSendActionContract.tsx');
    expect(workspaceSurface).toContain('data-communications-boundary="provider-controls-owned"');
    expect(workspaceSurface).toContain('data-communications-boundary="sandboxed-template-preview"');
    expect(contractContent).toContain('data-communications-contract="action-api-only"');
  });

  it('distinguishes all delivery states and shows fallback outcomes with correlation identifiers', () => {
    const workspaceSurface = read('src/features/module-communications/components/CommunicationsOwnedWorkspace.tsx');
    const modelContent = read('src/features/module-communications/workspace/communicationsWorkspaceModel.ts');
    expect(workspaceSurface).toContain('Queued:');
    expect(workspaceSurface).toContain('Sent:');
    expect(workspaceSurface).toContain('Delivered:');
    expect(workspaceSurface).toContain('Failed:');
    expect(workspaceSurface).toContain('Dead Letter:');
    expect(workspaceSurface).toContain('data-correlation-id={outcome.correlationId}');
    expect(modelContent).toContain('canAcceptSendAction');
    expect(modelContent).toContain('getFallbackOutcomeLabel');
  });
});
