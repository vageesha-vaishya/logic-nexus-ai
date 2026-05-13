import type { FranchiseContext } from '../../domain/types';
import type { FranchiseRepositoryPort } from '../ports';

export interface FranchiseServiceDependencies {
  franchiseRepository: FranchiseRepositoryPort;
}

export class FranchiseService {
  constructor(private readonly deps: FranchiseServiceDependencies) {}

  async getFranchiseHierarchy(franchiseId: string): Promise<{ root: FranchiseContext; descendants: FranchiseContext[] }> {
    const root = await this.deps.franchiseRepository.getById(franchiseId);
    if (!root) {
      throw new Error(`Franchise ${franchiseId} does not exist`);
    }

    const descendants = await this.collectDescendants(franchiseId);
    return { root, descendants };
  }

  private async collectDescendants(franchiseId: string): Promise<FranchiseContext[]> {
    const directChildren = await this.deps.franchiseRepository.listChildren(franchiseId);
    const nestedResults = await Promise.all(directChildren.map((child) => this.collectDescendants(child.franchiseId)));
    return [...directChildren, ...nestedResults.flat()];
  }
}
