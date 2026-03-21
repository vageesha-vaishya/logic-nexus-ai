import { workPackagesStream } from '../src/realtime/work-packages-stream';

describe('workPackagesStream', () => {
  it('publishes and receives work package events', () => {
    const received: string[] = [];
    const unsubscribe = workPackagesStream.subscribe((event) => {
      received.push(event.type);
    });

    workPackagesStream.publish({
      type: 'created',
      tenantId: 'tenant-1',
      userId: 'user-1',
      at: new Date().toISOString(),
      workPackage: { id: 'wp-1' },
    });

    unsubscribe();

    expect(received).toEqual(['created']);
  });
});
