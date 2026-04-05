# UIM Standard Form Template

## Purpose
`UimStandardFormTemplate` standardizes UIM module list + form layout so all modules share the same UX contract while changing only configuration.

## Consume Via Config Only
Each UIM module should pass configuration into the template, not fork layout.

- `moduleTitle`, `moduleKey`, `breadcrumbs`, `statusBadge`
- `mode` (`create|edit|readonly`) and `state` (`ready|loading|empty|error`)
- `validation` (`ok|warning|error` + messages)
- `list.records`, `list.columns`, `list.defaultVisibleColumnKeys` (exactly 6 business defaults)
- `list.showFieldSelector` (enable user field add/remove)
- `formSlot`, `sidePanelSlot`, `headerActionsSlot`, `footerSlot`

## Required Standard Rules
- Use exactly 6 business-critical default visible columns per module.
- Keep field selector enabled so users can add/remove optional detail columns.
- Keep API/field mapping in config and adapters; do not change template layout per module.
- Preserve common states: loading, empty, error, validation warning/error.

## Storybook
- Component story: `UIM/Templates/UimStandardFormTemplate`
- Includes 8 module variants + `FormStandardContract` reference story.
