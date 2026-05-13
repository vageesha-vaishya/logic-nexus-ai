import { workOrdersStream } from '../src/realtime/work-orders-stream';

describe('workOrdersStream', () => {
  it('publishes and receives work package events', () => {
    const received: string[] = [];
    const unsubscribe = workOrdersStream.subscribe((event) => {
      received.push(event.type);
    });

    workOrdersStream.publish({
      type: 'created',
      tenantId: 'tenant-1',
      userId: 'user-1',
      at: new Date().toISOString(),
      workOrder: { id: 'wp-1' },
    });

    unsubscribe();

    expect(received).toEqual(['created']);
  });
});
