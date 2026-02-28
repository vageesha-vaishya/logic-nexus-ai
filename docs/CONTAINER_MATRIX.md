# Container Matrix System

## Overview
The Container Matrix System provides a standardized, normalized way to manage container types and their physical specifications within the Logic Nexus-AI platform. It separates the "Identity" of a container (Type) from its "Physics" (Size/Specs).

## Database Schema

### `container_types`
Holds the high-level classification of containers.
- **id**: UUID (Primary Key)
- **code**: ISO 6346 Code (e.g., `22G1`, `45HC`) - Unique Identifier
- **name**: Human-readable name (e.g., "20' General Purpose")
- **category**: Enum (`Standard`, `Reefer`, `Specialized`, etc.)

### `container_sizes`
Holds the detailed physical specifications.
- **id**: UUID
- **container_type_id**: FK to `container_types`
- **length_ft**: Nominal length (20, 40, 45)
- **capacity_cbm**: Volume in cubic meters
- **max_payload_kg**: Maximum cargo weight
- **internal_dimensions**: `internal_length_mm`, `internal_width_mm`, `internal_height_mm`
- **door_dimensions**: `door_width_mm`, `door_height_mm`

## TypeScript Service (`ContainerService`)

The `ContainerService` is a singleton that manages data retrieval and caching.

### Usage

```typescript
import { ContainerService } from '@/services/logistics/ContainerService';
import { useCRM } from '@/hooks/useCRM';

// Inside a component or hook
const { scopedDb } = useCRM();
const containerService = ContainerService.getInstance();

// 1. Get all containers
const allContainers = await containerService.getAllContainers(scopedDb);

// 2. Get specific container
const container40HC = await containerService.getContainerByCode(scopedDb, '40HC');

// 3. Validate Cargo
const validation = containerService.validateCargoFit(
  container40HC, 
  25000, // weight kg
  70     // volume cbm
);

if (!validation.fits) {
  console.log(validation.reasons); // ['Weight exceeds limit...']
}
```

## Testing

Unit tests are located in `src/services/logistics/__tests__/ContainerService.test.ts`.
Run them using:

```bash
npm test src/services/logistics/__tests__/ContainerService.test.ts
```
