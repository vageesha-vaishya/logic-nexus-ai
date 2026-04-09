# AMRO Parts Navigation Wireframes

## Desktop Wireframe
```text
+-----------------------------------------------------------------------------------+
| AMRO Parts Navigation         [Nav Response 38ms] [role] [Mobile Menu hidden]    |
| AMRO > Parts Inventory > Stock Ledger                                             |
| Quick Access: [Overview] [Item Master] [Stock Ledger] [Reservations]              |
+--------------------------------+--------------------------------------------------+
| Module Menu                    | Active Module Surface                            |
| Inventory Core                 | +----------------------------------------------+ |
|  > Overview                    | | Stock Ledger                                 | |
|  > Item Master                 | | Search/Filter/Actions                        | |
|  > Stock Ledger (active)       | | Reports / Reconciliation / Period Controls   | |
| Operations                     | +----------------------------------------------+ |
|  > Reservations                |                                                  |
|  > Issue & Consume             |                                                  |
|  > Restock                     |                                                  |
|  > Locations                   |                                                  |
| Insights                       |                                                  |
|  > Analytics                   |                                                  |
+--------------------------------+--------------------------------------------------+
```

## Tablet Wireframe
```text
+------------------------------------------------------------------------+
| AMRO > Parts Inventory > Overview            [Nav Response] [Menu btn] |
| Quick Access chips                                                    |
+------------------------------------------------------------------------+
| Module list (narrow rail) | Active module content                     |
+------------------------------------------------------------------------+
```

## Mobile Wireframe
```text
+--------------------------------------------------------------+
| AMRO Parts Navigation                         [Menu Drawer]  |
| AMRO > Parts Inventory > Reservations                       |
| Quick Access (scrollable chips)                             |
+--------------------------------------------------------------+
| Active module content                                       |
| (full width)                                                |
+--------------------------------------------------------------+

Drawer:
+------------------------------------------+
| Parts Modules                            |
| Inventory Core                           |
|  - Overview                              |
|  - Item Master                           |
|  - Stock Ledger                          |
| Operations                               |
|  - Reservations                          |
|  - Issue & Consume                       |
|  - Restock                               |
|  - Locations                             |
| Insights                                 |
|  - Analytics                             |
+------------------------------------------+
```

## Flow Notes
- User opens Parts workspace.
- Role-filtered modules are rendered.
- User selects module from rail, shortcut chips, or mobile drawer.
- Breadcrumb and active-state update immediately.
- Module response benchmark badge updates after switch.
