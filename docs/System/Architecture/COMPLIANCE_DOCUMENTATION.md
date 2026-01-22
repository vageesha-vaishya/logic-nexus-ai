# Compliance Documentation

## International Logistics Compliance
- AES (US Export): ITN tracking; AESTIR format generation
- ISF 10+2 (US Import): data capture; filing placeholders
- AMS/ACI: future modules; message formats
- IATA: AWB standards; ULD safety; chargeable weight rules
- FMC: licensing references for forwarders

## Data Protection
- GDPR: data subject rights; retention policies; DSR workflows
- SOC 2: controls for access, change management, logging, backups
- Encryption: TLS in transit; AES-256 at rest

## Audit & Retention
- Append-only audit logs for sensitive changes
- Retention: shipment and financial records ≥ 7 years (configurable per tenant)

## Security Policies
- RLS enforcement; field-level restrictions
- Privilege Escalation: Super admins (Platform Admins) retain full operational control over import/audit logs
- Webhook authentication; replay protection
- Incident response: detection, triage, communication SLAs
