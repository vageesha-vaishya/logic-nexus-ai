# Accessibility Audit Report

## Target Standard: WCAG 2.1 Level AA

## 1. Current Status Audit
*   **Keyboard Navigation**:
    *   *Finding*: `@dnd-kit` provides good keyboard support (Space to lift, Arrows to move, Space to drop).
    *   *Action*: Verify tab order in the new complex card designs.
*   **Screen Readers (NVDA / VoiceOver)**:
    *   *Finding*: Need to ensure drag operations announce destination.
    *   *Action*: Use `@dnd-kit`'s `Announcements` prop to customize screen reader feedback.
*   **Color Contrast**:
    *   *Finding*: Some "light" badge backgrounds might be too low contrast against white text.
    *   *Action*: Switch to "subtle" badges (light bg, dark text) for better contrast.

## 2. Kanban Specific Requirements
| Feature | Requirement | Implementation Plan |
| :--- | :--- | :--- |
| **Drag & Drop** | Must be performant without mouse. | Implement `KeyboardSensor` in `@dnd-kit`. |
| **Drop Zones** | Must be clearly identifiable. | Add high-contrast border on drag over. |
| **Status Changes** | Must be announced. | Use ARIA Live Regions. |

## 3. Testing Plan
1.  **Automated**: Run `axe-core` via Playwright tests.
2.  **Manual**: Navigate entire board using only Keyboard (Tab, Space, Arrows, Enter, Esc).
3.  **Zoom**: Verify layout holds up at 200% zoom.
