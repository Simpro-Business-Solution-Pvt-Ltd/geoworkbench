# Reliance UAT Test Cases

Use these cases for internal testing and Reliance evaluation. Each failed case should become a GitHub issue with the borehole, display, template, browser/device, steps, expected result, actual result, and screenshot or log evidence.

## Smoke

| ID | Scenario | Expected Result |
| --- | --- | --- |
| UAT-SMOKE-01 | Open the deployed web URL and sign in with a local user. | Login succeeds and the dashboard opens. |
| UAT-SMOKE-02 | Open the deployed web URL and sign in with Entra ID. | Entra callback returns to the app and the profile menu shows the signed-in user. |
| UAT-SMOKE-03 | Open Wiki from the menu as a normal user. | User guidance pages are visible and developer-only pages are hidden. |
| UAT-SMOKE-04 | Open `/health` on the backend. | API and database health are reported. |

## Dashboard And Map

| ID | Scenario | Expected Result |
| --- | --- | --- |
| UAT-DASH-01 | Select a Reliance borehole from the dashboard grid. | Selected borehole is visually highlighted and persists after refresh. |
| UAT-DASH-02 | Change display choice between saved and default display. | Header and workbench open with the selected display mode. |
| UAT-DASH-03 | Switch map base layer between OpenStreetMap, OSM Humanitarian, and imagery. | Borehole markers stay in the correct geographic area. |
| UAT-DASH-04 | Use dashboard quick actions on a narrow/mobile viewport. | Capture/upload, review, correlate, and export actions are reachable without layout overlap. |

## Import

| ID | Scenario | Expected Result |
| --- | --- | --- |
| UAT-IMP-01 | Upload a Reliance-style Excel file and process it with the matching template. | Source file is stored, processed, and audit facts show row/interval counts. |
| UAT-IMP-02 | Import LAS curves for the same borehole. | Curves are created or appended and curve audit facts show mnemonic/sample counts. |
| UAT-IMP-03 | Merge a changed depth range into an existing borehole. | Merge decision is visible and only the selected range is replaced/appended. |
| UAT-IMP-04 | Try importing an unsupported file/template combination. | Clear error is shown and existing borehole data remains unchanged. |

## Workbench

| ID | Scenario | Expected Result |
| --- | --- | --- |
| UAT-WB-01 | Open a Reliance borehole workbench. | Log widget, interval details, validation, AI workflow, curve catalog, and KPI widgets render without overlap. |
| UAT-WB-02 | Scroll from top to bottom at full depth and after zoom. | Virtual depth is preserved and the bottom of the borehole remains reachable. |
| UAT-WB-03 | Click a lithology or depth track body. | Ruler and metadata show the clicked depth/interval; track header is excluded. |
| UAT-WB-04 | Use rubber-band zoom. | Visible depth changes, virtual depth stays intact, and all tracks remain synchronized. |
| UAT-WB-05 | Enable/disable tooltip from the context menu. | Tooltip visibility follows the setting without changing selection behavior. |
| UAT-WB-06 | Edit an interval field and save. | Data refreshes, audit record is created, and the change remains after reload. |

## AI And Validation

| ID | Scenario | Expected Result |
| --- | --- | --- |
| UAT-AI-01 | Check AI provider status. | Local OpenAI-compatible model status is visible when configured. |
| UAT-AI-02 | Run validation and generate suggestions. | Suggestions are bounded, actionable, and linked to rule evidence. |
| UAT-AI-03 | Accept or reject a supported suggestion. | Status changes and supported patches update the interval safely. |
| UAT-AI-04 | Disconnect local AI and retry summary. | Deterministic/rule fallback remains understandable. |

## Correlation

| ID | Scenario | Expected Result |
| --- | --- | --- |
| UAT-CORR-01 | Open correlation with 2, 5, and 10 boreholes. | Borehole columns use available width and do not draw lines outside the selected columns. |
| UAT-CORR-02 | Change focus seam. | Only the selected seam group is emphasized and present counts are clear. |
| UAT-CORR-03 | Switch depth/RL mode. | Labels make clear whether the view is depth-based or RL-estimated. |
| UAT-CORR-04 | Generate assistant narrative and save an interpretation note. | Narrative is generated on demand and saved note remains after reload. |

## Export

| ID | Scenario | Expected Result |
| --- | --- | --- |
| UAT-EXP-01 | Export corrected lithology/log to Excel or CSV. | File is generated and can be opened with the expected fields. |
| UAT-EXP-02 | Export curves to LAS or CSV. | Curve-compatible data is exported with mnemonic/unit/depth samples. |
| UAT-EXP-03 | Review export mapping before running export. | Included model fields and selected curves are visible. |
| UAT-EXP-04 | Open export history. | Format, template, stage, user, time, and generated artifact are visible. |

## Mobile And PWA

| ID | Scenario | Expected Result |
| --- | --- | --- |
| UAT-MOB-01 | Install/open the PWA on a mobile viewport/device. | Reliance branding appears, bottom navigation is usable, and main workflows are reachable. |
| UAT-MOB-02 | Open the Flutter Android app and sign in. | Reliance-branded login opens separately from the capture screen. |
| UAT-MOB-03 | Submit an interval with runtime parameters. | Backend receives interval and parameter name/value/unit data. |
| UAT-MOB-04 | Upload file or camera image from mobile. | Source file/image is associated with the selected borehole and visible from the web workflow. |

## Defect Evidence

Use this minimum evidence for GitHub issues:

- Test case ID
- Environment URL
- Commit or deployment date
- Browser/device
- Borehole and display
- Import/export template where relevant
- Steps to reproduce
- Expected result
- Actual result
- Screenshot, exported file, or log snippet
