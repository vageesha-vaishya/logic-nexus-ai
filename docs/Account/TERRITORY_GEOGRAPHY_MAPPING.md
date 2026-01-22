1| # Territory Geography Mapping Documentation

## Overview

This document outlines the standardized territory definition system that leverages the existing geographical data schema (States -> Countries -> Continents). The system allows territories to be defined by mapping them to specific geographical entities, enabling precise lead assignment and management based on location.

## Geographical Hierarchy

The system utilizes the following hierarchical structure:
1.  **Continents** (Top Level)
2.  **Countries** (Child of Continent)
3.  **States** (Child of Country)
4.  **Cities** (Child of State or Country)

Territories can be mapped to any level of this hierarchy.

## Database Schema

### `territory_geographies` Table

This junction table links the `territories` table to the geographical entities.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `territory_id` | UUID | Foreign Key to `territories` |
| `continent_id` | UUID | Foreign Key to `continents` (Nullable) |
| `country_id` | UUID | Foreign Key to `countries` (Nullable) |
| `state_id` | UUID | Foreign Key to `states` (Nullable) |
| `city_id` | UUID | Foreign Key to `cities` (Nullable) |
| `created_at` | Timestamptz | Creation timestamp |

### Integrity Constraints

-   **Type Constraint**: A single row in `territory_geographies` must reference exactly **one** geographical entity (Continent OR Country OR State OR City). This is enforced via a CHECK constraint:
    ```sql
    CHECK (
      (continent_id IS NOT NULL)::int +
      (country_id IS NOT NULL)::int +
      (state_id IS NOT NULL)::int +
      (city_id IS NOT NULL)::int = 1
    )
    ```
-   **Referential Integrity**: Foreign keys ensure that if a territory or a geographical entity is deleted, the corresponding mapping is automatically removed (`ON DELETE CASCADE`).

## Mapping Logic & Inheritance

-   **Inclusion**: Mapping a territory to a geographical entity automatically includes all its children.
    -   Example: Mapping "North America" (Continent) implicitly includes "USA", "Canada", etc., and all their states.
    -   Example: Mapping "USA" (Country) implicitly includes "California", "Texas", etc.

## Validation Rules

To prevent inconsistent or redundant mappings, the following validation rules are enforced in the UI:

1.  **Duplicate Prevention**: A specific entity (e.g., "USA") cannot be added twice to the same territory.
2.  **Parent Redundancy**: You cannot add a child entity if its parent is already mapped.
    -   *Invalid*: Adding "California" if "USA" (or "North America") is already mapped.
    -   *Reasoning*: "California" is already covered by "USA".
3.  **Child Redundancy**: You cannot add a parent entity if one of its children is already mapped.
    -   *Invalid*: Adding "USA" if "California" is already mapped.
    -   *Reasoning*: This creates ambiguity. You must remove "California" first, then add "USA" (which will then cover all states including California).

## Best Practices

1.  **Define at the Highest Level**: Always try to define territories at the highest applicable geographical level. If a territory covers an entire country, map the Country rather than selecting all individual States.
2.  **Avoid Overlap**: While the system allows different territories to cover the same geography (unless specific business rules prevent it), try to keep territory definitions distinct to avoid lead assignment conflicts.
3.  **Clean Up**: When expanding a territory (e.g., from State to Country level), remove the State mapping and add the Country mapping.

## UI Components

### `TerritoryGeographyManager`

This React component provides the interface for managing these mappings. It handles:
-   Fetching hierarchical master data.
-   Validating user selections against the rules above.
-   Visualizing current mappings with icons.
-   Providing warnings about redundancy.
-   Supporting city-level mapping with optional country/state filters.

### Integration

The manager is integrated into the `TerritoryManagement` dialog. It becomes available only after a territory is initially created (saved), ensuring a valid `territory_id` exists for the mappings.
