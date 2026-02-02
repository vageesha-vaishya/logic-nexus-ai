# Enterprise Commodity/Cargo API Specification

**Version:** 1.0.0
**Date:** 2026-02-05
**Base URL:** `/functions/v1/logistics-engine`

---

## 1. Overview
This API provides services for commodity classification, HTS validation, duty calculation, and compliance screening. It is designed to be consumed by the Logic Nexus UI and external ERP integrations.

## 2. Authentication
All endpoints require a valid Supabase JWT in the `Authorization` header.
`Authorization: Bearer <token>`

---

## 3. Endpoints

### 3.1 Commodity Classification & Search

#### `GET /search-hts`
Performs a full-text search against the HTS database using ranked vector search.

**Parameters:**
- `q` (string, required): Search query (e.g., "frozen fish").
- `limit` (int, optional): Max results (default 20).
- `country` (string, optional): ISO code (default 'US').

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "hts_code": "0303.11.0000",
      "description": "Sockeye salmon (red salmon) (Oncorhynchus nerka)",
      "rank": 0.85,
      "chapter": "03",
      "duty_rate_general": "Free"
    }
  ]
}
```

#### `GET /validate-hts`
Validates a specific HTS code for a given date and country.

**Parameters:**
- `code` (string, required): The HTS code to validate.
- `date` (string, optional): ISO date (default: today).

**Response:**
```json
{
  "valid": true,
  "exists": true,
  "details": {
    "description": "...",
    "unit_of_measure": "kg"
  }
}
```

### 3.2 Duty & Landed Cost

#### `POST /calculate-duty`
Calculates estimated duty and fees.

**Request Body:**
```json
{
  "origin_country": "CN",
  "destination_country": "US",
  "items": [
    {
      "hts_code": "6404.11.9020",
      "value": 5000.00,
      "currency": "USD",
      "quantity": 100
    }
  ]
}
```

**Response:**
```json
{
  "total_duty": 1250.00,
  "currency": "USD",
  "breakdown": [
    {
      "hts_code": "6404.11.9020",
      "duty_amount": 1250.00,
      "rate_applied": "25%",
      "rate_type": "Section 301"
    }
  ]
}
```

### 3.3 Master Commodity Catalog

#### `GET /master-commodities`
Retrieves the tenant's product catalog.

**Parameters:**
- `sku` (string, optional): Filter by SKU.
- `page` (int, optional): Pagination.

#### `POST /master-commodities`
Creates or updates a master commodity.

**Request Body:**
```json
{
  "sku": "NIKE-AIR-001",
  "name": "Air Max Runner",
  "aes_hts_id": "uuid",
  "unit_value": 45.00,
  "hazmat_class": null
}
```

### 3.4 Compliance Screening

#### `POST /screen-parties`
Screens involved parties against denied party lists (DPL).

**Request Body:**
```json
{
  "entities": [
    {
      "name": "Bad Actor Corp",
      "address": "123 Evil Lane, Pyongyang"
    }
  ]
}
```

**Response:**
```json
{
  "status": "FLAGGED",
  "matches": [
    {
      "entity": "Bad Actor Corp",
      "list": "OFAC SDN",
      "score": 0.98
    }
  ]
}
```

---

## 4. Error Handling
- **400 Bad Request:** Invalid parameters or format.
- **401 Unauthorized:** Missing/Invalid JWT.
- **404 Not Found:** Resource does not exist.
- **500 Internal Error:** Server-side processing failure.

---

## 5. Implementation Notes
- **Search:** Uses PostgreSQL `websearch_to_tsquery`.
- **Duty Logic:** Currently supports Flat Rate and Ad Valorem. Complex compound rates (e.g., "$0.50/kg + 3%") are planned for Phase 3.
