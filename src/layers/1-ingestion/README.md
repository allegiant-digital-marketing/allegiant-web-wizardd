# Layer 1 — Ingestion

Parses the A.R.C. URL + intake form, validates both against their schemas, and produces a normalized `partnerRecord` for every downstream layer to read from.

See `docs/ARCHITECTURE.md` for the full layer specification.

## Inputs

- `arcUrl` (string, URL)
- `intakeForm` (object, conforms to `schemas/intake-form.schema.json`)

## Outputs

- `partnerRecord` (object, conforms to `schemas/arc-extraction.schema.json` + `schemas/intake-form.schema.json` + ingestion metadata)

## Status

**Not yet implemented.** Phase 1 work begins here.

## Notes

- The A.R.C. parser must be template-aware (current and recent past A.R.C. templates).
- Cross-validation rules (businessName match, serviceName ∈ targetServices) block on failure.
- Manual Override Mode triggers when either input is unavailable or validation fails non-recoverably.
