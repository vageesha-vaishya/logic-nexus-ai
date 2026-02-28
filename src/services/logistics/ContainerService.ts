import { ContainerConfiguration, ContainerType, ContainerSize } from '@/types/container';
import { useCRM } from '@/hooks/useCRM';

/**
 * Service for managing container configurations and retrieving specifications.
 * This service interacts with the `container_types` and `container_sizes` tables.
 */
export class ContainerService {
  private static instance: ContainerService;
  
  // Cache for performance optimization (could be moved to React Query or similar)
  private containerCache: ContainerConfiguration[] | null = null;

  private constructor() {}

  public static getInstance(): ContainerService {
    if (!ContainerService.instance) {
      ContainerService.instance = new ContainerService();
    }
    return ContainerService.instance;
  }

  /**
   * Retrieves all available container configurations, including type details and size specifications.
   * Joins `container_types` and `container_sizes`.
   */
  public async getAllContainers(db: any): Promise<ContainerConfiguration[]> {
    if (this.containerCache) {
      return this.containerCache;
    }

    try {
      // Fetch types and sizes. In a real app, we might join these in one query.
      // Here we simulate a join or do two fetches if Supabase join syntax is verbose.
      const { data: types, error: typesError } = await db
        .from('container_types')
        .select('*');

      if (typesError) throw typesError;

      const { data: sizes, error: sizesError } = await db
        .from('container_sizes')
        .select('*');

      if (sizesError) throw sizesError;

      // Map and join in memory
      const configurations: ContainerConfiguration[] = types.map((type: any) => {
        // Find the matching size. For simplicity, we assume one primary size per type for now,
        // or we pick the default/first one if multiple exist.
        // The schema allows multiple sizes per type (e.g. High Cube vs Standard for same type code if needed),
        // but typically the type code (40HC) implies the size.
        const size = sizes.find((s: any) => s.container_type_id === type.id);
        
        // If no size found (data integrity issue), return a partial or skip
        if (!size) {
            console.warn(`No size specification found for container type: ${type.code}`);
            // Return a safe fallback or filtered out later
            return null;
        }

        return {
          ...type,
          specifications: size
        };
      }).filter(Boolean) as ContainerConfiguration[];

      this.containerCache = configurations;
      return configurations;

    } catch (error) {
      console.error('Error fetching container configurations:', error);
      throw error;
    }
  }

  /**
   * Retrieves a specific container configuration by its ISO code (e.g., "40HC").
   */
  public async getContainerByCode(db: any, code: string): Promise<ContainerConfiguration | null> {
    // If cache exists, look there first
    if (this.containerCache) {
      return this.containerCache.find(c => c.code === code) || null;
    }

    // Otherwise query DB
    try {
        const { data: type, error: typeError } = await db
            .from('container_types')
            .select('*')
            .eq('code', code)
            .single();
        
        if (typeError || !type) return null;

        const { data: size, error: sizeError } = await db
            .from('container_sizes')
            .select('*')
            .eq('container_type_id', type.id)
            .single(); // Assuming 1:1 mapping for code -> spec for now

        if (sizeError || !size) return null;

        return {
            ...type,
            specifications: size
        };

    } catch (error) {
        console.error(`Error fetching container ${code}:`, error);
        return null;
    }
  }

  /**
   * Validates if a cargo fits within a specific container type.
   * Simple check based on volume and weight.
   */
  public validateCargoFit(container: ContainerConfiguration, totalWeightKg: number, totalVolumeCbm: number): { fits: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const specs = container.specifications;

    if (totalWeightKg > specs.max_payload_kg) {
      reasons.push(`Weight exceeds limit (${totalWeightKg}kg > ${specs.max_payload_kg}kg)`);
    }

    if (totalVolumeCbm > specs.capacity_cbm) {
      reasons.push(`Volume exceeds capacity (${totalVolumeCbm}m³ > ${specs.capacity_cbm}m³)`);
    }

    return {
      fits: reasons.length === 0,
      reasons
    };
  }
}
