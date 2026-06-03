// Phase 7 UIM Step 8.1 — schema assembly.
//
// Importing the type + query modules has the side effect of
// registering them on the shared SchemaBuilder. The toSchema()
// call at the end is what yoga binds to.
//
// New modules add an import here as they ship.

import { builder } from './builder.js';

// Types
import './types/health.js';
import './types/projection-snapshot.js';
import './types/catalog-item.js';
import './types/inventory-item.js';
import './types/page-info.js';
import './types/inventory-item-connection.js';
import './types/reservation.js';
import './types/reservation-connection.js';
import './types/ledger-entry.js';
import './types/ledger-entry-connection.js';

// Queries
import './queries/health.queries.js';
import './queries/inventory.queries.js';
import './queries/reservation.queries.js';

export const schema = builder.toSchema();
