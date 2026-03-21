import { EventEmitter } from 'events';
import { WorkPackage } from '../types/amro.types';

export type WorkPackageStreamEventType = 'created' | 'updated' | 'deleted';

export type WorkPackageStreamEvent = {
  type: WorkPackageStreamEventType;
  tenantId: string;
  userId: string;
  at: string;
  workPackage: Partial<WorkPackage> & { id: string };
};

class WorkPackagesStream {
  private emitter = new EventEmitter();

  subscribe(listener: (event: WorkPackageStreamEvent) => void) {
    this.emitter.on('work-package-change', listener);
    return () => {
      this.emitter.off('work-package-change', listener);
    };
  }

  publish(event: WorkPackageStreamEvent) {
    this.emitter.emit('work-package-change', event);
  }
}

export const workPackagesStream = new WorkPackagesStream();
