# Reliance: End-to-End Value Demo and Developer Sanity Check

Prepared: 19 November 2026. Intended meeting: 20 November 2026.

Audience: presenter, developer checking the deployed build, product team, and IT discussion lead.
This is a separate meeting runbook; it does not replace the existing user manuals or architecture pack.
Baseline reviewed: branch `feature/map-pwa-uat`, commit `553e666`. Record the actual server release below before rehearsal.
Source review and a read-only local data inventory informed this script. The server and its UI have **not** been validated by preparing this document.

## 1. The Story to Tell

> A site geologist records what was observed. The central team brings the supporting files into the same borehole record, checks their quality, compares the evidence, and saves an interpretation with a reason. The team then compares that interpretation with surrounding boreholes and hands the reviewed data to its existing geological tools. GeoWorkbench connects these steps; the geologist remains responsible for the geological decision.

Keep one question visible throughout: **What does the geologist need to inspect or decide next, and how does this screen make that easier?**

```text
Site observations and operational parameters
  -> Field PWA: create/select borehole, capture intervals, attach evidence
  -> Central Import: inspect source, apply mapping, choose merge behavior
  -> Workbench: inspect aligned evidence, run checks, correct and explain
  -> Correlation: compare named markers and save a review conclusion
  -> Export: choose output scope and mapping, generate and inspect the file
```

Two deliberate data contexts keep the demonstration credible:

- **Controlled workflow record:** a clearly named test borehole for writes, corrections, file arrivals and exports. Its values are synthetic demonstration observations.
- **Received-data review:** the actual MGCA boreholes for realistic scale, curve variety and correlation. They are reviewed without changing their geological interpretation during the meeting.

Do not join unrelated borehole files and describe them as aligned evidence. A completed or already interpreted source log remains useful for quality review and comparison, but does not prove that this application produced its original corrections.

## 2. What Each Person Gets

| Person | Current workflow benefit | Evidence to demonstrate | Outcome to discuss with Reliance |
| --- | --- | --- | --- |
| Site geologist | Capture intervals and changing operational parameters without preparing a workbook first | Submitted interval plus named parameter/value/unit and its associated borehole | Less duplicate entry; earlier central visibility |
| Central geologist | Inspect intervals, measured curves and review findings in a common depth context | One selected depth, its interval, surrounding curve response, and saved correction | Faster evidence gathering and more explainable corrections |
| Senior reviewer | Compare named markers and investigate inconsistent or absent picks | Selected boreholes, focus marker, top/bottom ties, saved observation | A recorded review decision rather than an unrecorded visual comparison |
| Data administrator | Bring different source layouts into a consistent model and create usable outputs | Template test, explicit merge choice, generated Excel and LAS | Less repeated file reshaping and clearer source-to-output responsibility |
| IT/operations | Operate one backend for web and field clients with controlled releases | Identity settings, diagnostics, deployment and rollback instructions | An evaluable platform with a clear path for operational hardening |

Treat these as benefits to validate, not measured savings already achieved. Ask Reliance to baseline time spent per import, per corrected interval and per export so a subsequent pilot can measure improvement.

## 3. Presenter and Developer Setup

### URLs and sessions

- Central web: `https://geowb.simproapps.in/`
- Field PWA: `https://geowb.simproapps.in/field`
- Use `geologist` for the central demonstration and `field` for site capture. Use existing authorized credentials; do not put passwords in shared slides or this runbook.
- Use a phone for the field role and a desktop for the central role, or separate browser profiles/browsers. Two tabs in the same browser profile share the stored login token and can interfere with a two-role demonstration.
- Keep the architecture pack open separately at `D:\SimproArchitectureCenter\GeoWorkbench-Architecture`.
- Choose the server as the rehearsal target. A local pass alone does not establish that the server has the same release, database, assets or model connection.

### Record the exact demonstration choices

| Item | Developer to complete before rehearsal |
| --- | --- |
| Server release/commit | ____________________ |
| Central and field browsers/devices | ____________________ |
| Workflow borehole | `REL-UAT-20261120-01`, or an unused clearly marked suffix |
| Saved display to clone | ____________________ |
| Received-data review borehole | Prefer `MGCA-08`, after checking server content |
| Correlation subset, in display order | Start with three suitable received boreholes, e.g. `MGCA-08`, `MGCA-09`, `MGCA-11` |
| Focus marker and its actual depths | ____________________ |
| One useful rule finding and its evidence | ____________________ |
| LLM provider/model; actual generated response confirmed | ____________________ |
| Prepared Excel/LAS files and template names | ____________________ |
| Completed exports to keep as backup evidence | ____________________ |
| Tester, date, result and blocking GitHub issues | ____________________ |

### Local received-data inventory, checked 19 November

This is a rehearsal reference, not a claim about what is currently on the server. Counts are stored records, not counts of independently correlated geological units.

| Borehole | Total depth, m | Lithology rows | Seam records/bands | Curves |
| --- | ---: | ---: | ---: | ---: |
| MGCA-08 | 801 | 781 | 50 | 7 |
| MGCA-09 | 996 | 946 | 47 | 9 |
| MGCA-11 | 1052 | 1004 | 60 | 6 |
| MGCA-12 | 843 | 819 | 52 | 4 |
| MGCA-16 | 906 | 927 | 52 | 8 |
| MGCA-18 | 1146 | 1099 | 57 | 7 |
| MGCA-19 | 954 | 956 | 47 | 5 |
| MGCA-21 | 771 | 759 | 38 | 6 |
| MGCA-22 | 909 | 920 | 52 | 7 |
| MGCA-23 | 834 | 874 | 53 | 7 |

All ten local records have zero core-image records and zero linked `SourceFile` records. Imported data/import-batch metadata can exist without a retained original-file attachment. Demonstrate attachment retention through the new workflow record instead of implying the historical import has all original files linked.

The local collars include coal-grid and UTM coordinates, but the inspected collar objects do not contain measured RL or water level. Inspect other source metadata on the server before claiming these are available. Default or estimated RL is not a surveyed elevation.

Curve coverage varies. For example, MGCA-08 includes gamma, resistivity, point resistance, SP, caliper and two density-related curves; MGCA-09 also has inclination and azimuth. A curve in the LAS does not by itself establish a supported 3D borehole trajectory workflow.

## 4. Prepare One Reproducible Workflow Record

The developer should prepare these inputs before the meeting and run the workflow once with a rehearsal borehole code. Use a different unused code for the live run; repeated submission is not a reset operation.

### Field form values

Create a test borehole in a clearly identified test project/site. Set total depth to 3 m and initial current depth to 0 m. Leave coordinates, RL and water level blank unless using explicitly labelled test values; do not fabricate a real site location.

Submit the following two intervals, separately:

| From, m | To, m | Lithology | Recovery, m | Recovery % | RQD % | Seam name | Remark |
| ---: | ---: | --- | ---: | ---: | ---: | --- | --- |
| 0 | 1 | SANDSTONE | 0.95 | 95 | 80 | blank | Demo site observation: grey sandstone |
| 1 | 2 | COAL | 0.90 | 90 | 60 | DEMO-A | Demo site observation: coal, central review pending |

Set current depth to the submitted interval's end. Add a sample operational parameter such as `Drilling rate`, value `2.5`, unit `m/h`. Explain that this demonstrates flexible capture, not a validated operational analytics formula. Re-enter or change the form values for the second submission; do not assume the form resets automatically.

Attach one harmless test photo. This proves camera/file capture and borehole association; it is not a processed or depth-calibrated core image.

### Excel correction/batch example

Prepare `REL-UAT-20261120-correction.xlsx`, sheet `Intervals`, header on row 1:

| Hole | From | To | Rock | Recovery % | RQD % | Seam | Comment |
| --- | ---: | ---: | --- | ---: | ---: | --- | --- |
| REL-UAT-20261120-01 | 1 | 2 | COAL | 90 | 65 | DEMO-A | Demo workbook review: RQD revised from 60 to 65 percent |
| REL-UAT-20261120-01 | 2 | 3 | SHALE | 95 | 70 | blank | Demo additional interval from the next field batch |

Adjust `Hole` to the live borehole code, or explicitly choose the file's source borehole when the merge UI offers it. These corrections are invented test inputs, not a geological interpretation of Reliance's records.

Prepare a **new custom tabular template**, with borehole from `Hole`, interval depths from `From` and `To`, lithology from `Rock`, and the remaining columns mapped to their corresponding fields. Set RQD input units to percent. Test the sample before saving. Built-in descriptive-workbook adapters are read-only; do not try to turn a specialized built-in layout into a general flat-table template.

For this example, replacement over 1-3 m should preserve 0-1 m, replace the earlier 1-2 m row, and add 2-3 m. An append-only merge should skip overlapping existing intervals. The developer must verify these exact outcomes before the live run.

### LAS and controlled finding

Prepare a small valid LAS 2.0 file for the same test borehole, spanning 0-3 m, with depth, gamma and optionally density/resistivity. Use metres for depth and explicit units for each curve. Verify mnemonics are recognized and values are synthetic. Avoid the older curve CSV fixture as the primary ingestion proof: use the tested LAS path.

If a deterministic curve-versus-lithology finding is needed, use a separate clearly labelled test interval/file with a deliberate disagreement. Record the exact rule, depth and expected finding in the setup table. Do not alter received geology or tune thresholds during the meeting to manufacture an apparent discovery.

Prepare one already working full-size Excel/LAS import pair as a fallback. The existing helper [create_import_demo_fixtures.py](../../../backend/scripts/create_import_demo_fixtures.py) generates descriptive-workbook examples, but not this flat-table example or a LAS file; a developer must supply those inputs explicitly.

## 5. Live Script: One Connected Journey

Allow approximately 30-35 minutes for the product walkthrough and 10 minutes for the architecture/future-work discussion. Keep setup, credentials and fixture creation outside the meeting.

### Scene 1: Establish the decision, not the menu tour - 1 minute

**Say:**

> We will follow one borehole from a site observation to a reviewed export, then use the received MGCA data to show comparison at realistic scale. At each step we will show the evidence, the geologist's decision and what is saved.

**Do:** Open the central dashboard. Briefly identify project/site, selected borehole and selected display. Show the map only if the coordinate reference system has been verified.

**Value:** A common borehole context reduces the chance of reviewing or importing into the wrong record.

**Proof:** The selected code is clear and survives refresh. Map position alone is not evidence that the CRS was correctly interpreted.

### Scene 2: Capture observations at the site - 4 minutes

**Say:**

> The site user can record an interval and operational context as work progresses. They do not need to create a completed Excel workbook before central geology can see the observation.

**Do:** In `/field`, sign in as `field`, create the workflow borehole, enter the two prepared intervals and parameter, and submit each once. Show visible sync status. Take or choose the test photo and show its uploaded status.

**Value:** Earlier information, less transcription, and files attached to a known borehole rather than exchanged without context.

**Proof:** Retain the borehole code and submission/upload evidence. Confirm RQD entered as 60% is treated as a percentage in the UI; the backend stores a fraction, 0.60.

**Explain if asked:** The PWA is the immediate browser/installable field path for iPhone and Android; Flutter remains a separate native client using the same backend. Native push/OTP/MSAL behavior should not be presented as identical to the PWA's username/password and configured Entra web flow.

**Optional, only after rehearsal:** Disconnect briefly, queue a different interval once, reconnect, and verify one successful submission. Offline interval storage is browser local storage. Do not claim offline file/camera upload, offline sign-in, conflict-free multi-device sync, or guaranteed duplicate-proof retries. Do not clear browser storage or switch users while observations are queued.

### Scene 3: Close the field-to-central handoff - 2 minutes

**Say:**

> These are two clients working on the same borehole, not separate applications that need an additional spreadsheet handoff.

**Do:** On the desktop, select the exact new borehole. Show the intervals and the incoming uploaded photo/source file. Locate the field submission and operational parameter in the UI if exposed; otherwise have the developer verify the stored payload and describe its current capture-only status.

**Value:** The central team receives field observations and associated evidence sooner.

**Proof:** Demonstrate another field update while the central workbench is open, if the realtime path passed rehearsal. Field form submissions currently apply to the log directly. Uploaded Excel/LAS files remain source files until processed/merged; upload does not itself mean the data is interpreted or approved. If a new borehole is not listed automatically, refresh the list explicitly and do not describe it as a live list subscription.

### Scene 4: Bring a corrected batch into the same model - 5 minutes

**Say:**

> We expect mixed arrivals: some observations from forms, some from corrected spreadsheets, and measured curves from LAS. A mapping translates source columns into our model; a separate merge decision controls what existing data can change.

**Do:** In Import Center, confirm the target borehole. Show the prepared custom template, sample headers, field mapping, dry-run results and version. In the field PWA, upload the correction workbook to that borehole; process it centrally, then choose the reviewed 1-3 m replacement. Show the outcome and import/source history. Upload/process/merge the same-borehole LAS through the central Import Center and identify its mnemonics, units and depth coverage.

**Value:** New batches and corrections can be brought together without replacing unrelated data or rebuilding the entire log by hand.

**Proof:** 0-1 m remains; 1-2 m has 65% RQD from the batch; 2-3 m appears; curves are attached to the same borehole. The selected registry mapping/version used during preview is retained for that merge. A template save version is not a complete version of the borehole dataset.

**Boundary:** General tabular Excel mapping and the supported descriptive-workbook adapters are different import paths. Current curve merge choices include replacement by curve key and the implemented append behavior; confirm overlap/deduplication semantics in rehearsal. Do not promise an arbitrary depth-range curve overwrite or every possible workbook layout solely because a mapping editor exists.

### Scene 5: Inspect evidence and record an interpretation - 5 minutes

**Say:**

> The productivity gain is having the interval, measured response, remarks and quality findings in a shared depth context. The geologist can inspect the evidence and record a correction while it is in view.

**Do:** Show the short workflow borehole, then switch to MGCA-08 for realistic log scale. Identify depth, lithology patterns, seams, recovery/RQD when present, curves, remarks and findings. Show Evidence Coverage and Curve Catalog. Select a depth in the track body, inspect the interval, and compare the curve response. Demonstrate one rubber-band zoom, scrolling to both ends, tooltip toggle and runtime curve show/hide.

Return to the test borehole. Add a remark such as `Demo central review: compared with source batch; further geological confirmation pending`, save, refresh, and inspect the correction history. Show an RQD/recovery edit only after the developer verifies both the saved number and corresponding track rendering.

**Value:** Less navigation between disconnected files; a persisted explanation of what was changed and why.

**Proof:** Ruler depth matches the clicked depth; an interval's From/To are its boundaries, not the exact clicked point. Zoom changes the visible range, not the full virtual range. Curves remain visible immediately after zoom, and the full borehole remains reachable by scroll. Current lithology patterns are display conventions; confirm Reliance's preferred pattern dictionary rather than claiming an approved industry/customer standard.

**Editing boundary:** Interval patches support depths, lithology code/label, seam name, recovery, recovery percentage, RQD, logged color, structures and remark. Confirm the deployed editor exposes each field before showing it. Changes to interval seam names/depths must be checked against the separate seam records used in correlation; do not assume automatic synchronization. Arbitrary curve-sample editing and marker dragging are not established by this interval editor.

### Scene 6: Turn findings into a review action - 3 minutes

**Say:**

> Deterministic checks identify conditions to review. The language model can explain the supplied facts and suggest a review order. We distinguish that explanation from the calculations and from the geologist's final decision.

**Do:** Run validation and Generate AI review on the rehearsed record. Open one useful depth-linked finding, show its evidence and recommended action, and navigate to the relevant interval. Demonstrate Accept only for a finding with a supported patch and a reviewed before/after value; otherwise edit manually or reject. Show the saved result/history.

**Value:** A practical review queue tells the geologist where to look and why, instead of requiring a complete manual scan to find every inconsistency.

**Proof:** Know the rule code, source values and expected result. A warning or confidence number is not a calibrated geological probability. An accepted review-only item is not an automatic geological correction; the current Accept control requires an available patch. Regenerate/revalidate after correction as needed; do not promise that every dependent result updates automatically.

For a live LLM claim, verify `metrics.ai_provider.used_for_summary` on the actual response, not only that the model endpoint is reachable. If generation falls back, say: `These are the rule findings and calculated review facts; the language-model explanation is unavailable in this session.`

### Scene 7: Compare boreholes and save a geological review conclusion - 5 minutes

**Say:**

> Correlation helps us ask whether a named marker is consistently recorded, how its top, bottom and thickness vary, and where a geologist should return to the individual evidence before accepting a correlation.

**Do:** Choose the rehearsed three MGCA boreholes. Confirm their order and reference. Select a meaningful named focus marker and read its presence count. Zoom to a useful window, show top and bottom ties, then open insights. Point to one specific comparison with actual depths or thicknesses and its recommended investigation. Open the relevant individual workbench for detailed review, then return and save a correlation interpretation note. Reopen the same borehole set and verify persistence.

Suggested note, filled with actual evidence:

> `[Marker] is recorded in [N of M] selected boreholes. The top/bottom or thickness difference between [codes] requires review of [depth range and evidence]. This is a review hypothesis; [missing curve/RL/source information] is required before confirming the correlation.`

**Value:** The comparison produces a specific follow-up and a saved interpretation, not just a row of log pictures.

**Proof and interpretation:**

- Presence count refers to the selected boreholes. A marker need not occur in all of them. Missing means not recorded/matched in the loaded evidence; it does not prove geological absence.
- Both marker tops and bottoms are tied. Matching currently depends on normalized marker names and depth-ordered occurrences, not learned geological identification.
- Same-name adjacent bands are grouped using a current 1 m gap heuristic. Explain its need for Reliance validation, especially for partings and gross versus net thickness.
- The tie-line color is a depth-offset review heuristic, not geological confidence or proof of continuity. Do not diagnose a fault from it.
- Depth view aligns depth below each collar. RL view uses `collar RL - depth` against a shared vertical datum; it is not relative depth from the reference borehole. Missing RL uses a labelled default estimate. Use depth mode for the primary demo if RL is unverified.
- The reference provides comparison/distance context. Screen column spacing is not a surveyed section or a true-distance geological cross-section. Distance comparisons require compatible coordinate systems.
- Save observations in correlation; perform established interval corrections in the individual workbench. Do not claim interactive tie picking, bulk correlation editing, or automatic creation of a new borehole's geology from neighbors.
- Frontend correlation groups nearby bands, while the backend narrative currently aggregates stored seam records separately. If their thickness/count figures differ, the developer must resolve or explicitly exclude that comparison from the demo. Top/bottom rendering does not imply the model ranks both boundaries identically.

### Scene 8: Hand reviewed data to existing tools - 3 minutes

**Say:**

> The output should be useful beyond this application. We choose the data scope and mapping, inspect the generated result, and let Reliance confirm the exact downstream import contract.

**Do:** On the test borehole, open Export Center. Select Corrected Lithology Excel, inspect its template and supported depth/field options, generate, download and open the workbook. Locate the saved remark and RQD value. Switch to Curve LAS, explicitly choose a nonempty subset of available curves if demonstrating filtering, generate and inspect headers and samples. Show export history and actual output facts.

**Value:** A repeatable handoff of reviewed values and curve data reduces manual output reshaping.

**Proof:** Lithology Excel/CSV and curve LAS/CSV are distinct outputs. A LAS curve export is not an interval/seam export. In the current curve template UI, an empty curve list means **all curves**, not zero curves. Export template editing currently includes JSON and a curve picker; do not describe it as the same visual builder as the new tabular import template.

**Boundary:** Exports operate on the current stored interpretation. A correction-stage label is not a historical snapshot selector. Check generated columns, curve subset, units and depth scope in the actual artifact. Do not assume every displayed section toggle is implemented by every export writer. Readiness is informative; a complete multi-person approval/export gate is not demonstrated. Minex compatibility requires testing against Reliance's actual target import templates; PDF and WITSML are not promised as generic interchange here.

### Scene 9: Show why the workspace is configurable - 3 minutes

**Say:**

> Different geologists need different evidence together. We separate the data from its presentation so a reviewer can adapt the workspace without duplicating or changing geological measurements.

**Do:** Clone a display for the demo. Add a widget from the library, resize/reposition it, and open its floating settings. In Log Settings, show the track/object tree, add a curve from the borehole's catalog, change its scale/color or visibility, and remove it again. Show Undo, Save and Cancel using a disposable layout. Reopen the saved layout in runtime. If rehearsed, show a runtime Explorer drop, followed by Save/Save as/Discard.

**Value:** A site-capture review layout, a geophysical review layout and a reporting layout can use the same underlying borehole. Users can put the information needed for their role together instead of requesting a new fixed screen for every workflow.

**Proof:** Undo reverses one recorded layout operation; Cancel discards the whole unsaved edit; Save persists the nested configuration. Visual curve normalization maps different value ranges into a common track width and does not alter measured values. Runtime show/hide is an appearance choice, distinct from deleting a source curve. Saving a display does not save a geological correction, and vice versa.

### Close the product story - 1 minute

> We have followed capture, controlled data arrival, evidence review, recorded correction, comparison and export. The next step is to agree which decisions Reliance wants to accelerate, confirm the input/output contracts, and measure the pilot on those workflows. Further AI assistants will use the same evidence and review process rather than bypassing it.

## 6. Discuss Raw Data, Correction History and Approval Precisely

| Question from Reliance | Current, supportable answer | Refinement to agree |
| --- | --- | --- |
| Is their supplied spreadsheet raw or corrected? | We cannot infer this reliably from formatting or completion status. Capture the origin and declared stage; distinguish measured LAS data, source descriptions and imported interpretations. | Label source provenance and correction stage with their geologists. |
| What happens when a geologist edits? | The current interval changes and a correction audit records changed fields before/after, actor and time. Manual edits receive geologist-corrected stage metadata. | Version comparison, complete snapshots, restore and formal release numbering. |
| Can we recover every historical borehole after an import? | Not established. Source files, field payloads, import summaries and interval correction audits provide different forms of evidence; an import replacement is not a guaranteed whole-dataset version or undo. | Immutable raw datasets, versioned merge revisions, retention and rollback rules. |
| Does an accepted AI suggestion become final geology? | A supported patch can change an interval and create an audit. The geologist must inspect the actual change. Acceptance is not independent reviewer approval. | Consistent actor attribution, stage propagation, dependent-record refresh and reviewer signoff. |
| Is export approval mandatory? | The demonstration does not require a second user. Workflow/status/readiness elements do not establish a full approval orchestration. | Decide which outputs need a reviewer, notifications, signoff, locking or expiry. |
| Do operational parameters drive analytics now? | Flexible name/value/unit capture is stored in the field payload. Do not imply all parameters are typed, unit-normalized, visualized or available in arbitrary export mappings. | Promote agreed parameters into supported metadata/series definitions and widgets. |
| Are updates continuous? | Forms and uploaded batches arrive as discrete submissions. Server events notify clients to refresh relevant data. | Device integrations, frequency, ordering, retries and streaming contracts if required. |

## 7. AI Discussion: Current Value and the Next Assistants

### What is actually happening now

1. Rules inspect structured data: interval ranges/coverage, recovery/RQD, seam labels, curve coverage, supported curve-versus-lithology checks and other configured checks.
2. The application calculates review facts and creates depth-linked suggestions. Some suggestions include a limited supported patch; others require manual investigation.
3. An OpenAI-compatible local model can receive selected structured facts, rule findings, coverage and review context to produce an explanation and recommended review sequence.
4. The geologist inspects evidence, edits or applies a supported patch, and saves a decision. The LLM is not autonomously reading every raw curve sample, interpreting a photograph or predicting a missing seam in this workflow.

In correlation, the model receives selected-borehole facts, a focus marker, selected comparisons and readiness information. The strongest current value is explaining and prioritizing calculated review points. It is not independently calculating a geological model or discovering continuity from raw signal shapes.

Current example curve/lithology rules contain fixed heuristics; caliper units and tool calibration matter. Do not describe these as Reliance-validated geophysical signatures. Agree calibration, mnemonic mapping, unit handling and labelled examples before using them as geological conclusions.

### Candidate assistants, tied to specific decisions

| Assistant | Practical question/action | Evidence and controls needed | Status |
| --- | --- | --- | --- |
| Import mapping assistant | Suggest likely source columns, units and borehole identity; explain ambiguity before import | Workbook sample, schema, saved templates; user confirms mapping and merge | Next extension of the current template workflow; automatic mapping suggestions already have deterministic elements |
| Geophysical review assistant | Flag and explain disagreement between logged lithology/seam boundaries and measured responses | Reliance signatures, calibrated tools/units, depth alignment and interpreted examples; no silent boundary edits | Priority refinement of current rule findings |
| Correlation review assistant | Propose candidate marker equivalence and explain why a new borehole needs a particular comparison | Verified marker aliases, top/bottom picks, collar/RL/CRS, curves; save a reviewed proposal | Current comparison/narrative exists; automatic correlation proposals are future work |
| Geological knowledge assistant | Find comparable reviewed intervals or cite a procedure/report supporting a review step | Permission-scoped approved documents and metadata; retrieval citations and evaluation | Future retrieval-assisted workflow, not implemented RAG merely because an LLM is connected |
| Core image assistant | Propose tray/lane crops, reading direction, scale and depth mapping | Original labelled images, confirmed lane lengths, recovery gaps and geologist confirmation | Image processing workflow to validate with their image package |
| Handover assistant | Explain export readiness and recommend a target template/checklist | Confirmed downstream contract and actual artifact checks; user chooses generation | Future guided workflow around existing exports |
| Predictive models | Estimate a defined geological/quality target with uncertainty | Labelled history, spatial/borehole-separated validation and agreed acceptance criteria | Deferred; ten local boreholes do not establish predictive reliability |

Start with a few bounded assistant actions, typed results and explicit review. Agent orchestration becomes useful when a confirmed workflow needs several tools; it is not necessary to call the present narrative generation an autonomous agent. Retrieval can supply reference material, but does not replace image segmentation or a validated numerical interpretation method.

Corrections may later supply curated training examples, but there is no automatic learning or retraining pipeline demonstrated today. Evaluate extraction accuracy, false review flags, accepted/rejected recommendations and time saved before expanding authority.

## 8. IT and Extensibility Discussion

### Explain the design through change scenarios

| Design choice | Explain it through this request | Current basis and limit |
| --- | --- | --- |
| Shared domain model | A field update and an Excel correction describe the same borehole/interval | Borehole-linked intervals, separate seam records, curves/samples, submissions, source records and audits; JSON metadata allows selected extensions |
| Source adapters and templates | A new site sends different headers | Supported tabular templates can map fields without a code change; structurally different files or new data families can require a new adapter |
| Registry-based widgets and tracks | A geophysicist needs a different layout or another available mnemonic | Widget/track registries and nested settings separate source binding, presentation and rendering; new widget behavior still requires implementation |
| Shared log control plane | A zoom must preserve correct depths for every track and mouse action | Domain/viewport transforms, track-body geometry, header separation and common interactions; performance and correctness still need device/browser validation |
| Data availability discovery | A LAS adds neutron or another mnemonic | Catalogs expose available curves with units/source metadata; generic display does not automatically give the curve a geological interpretation |
| Unified update path | Someone submits an interval while the workbench is open | SSE invalidates/refetches relevant queries; optional Redis helps event distribution across processes, not sensor acquisition or collaborative edit conflict resolution |
| Provider boundary | Customer requires an on-premise model | Current local OpenAI-compatible HTTP integration; confirm each additional vendor's authentication/protocol and data policy rather than claiming every provider is plug-and-play |
| Deployment separation | Customer hosts the application with its own PostgreSQL | Existing IIS static frontend/reverse proxy, WinSW FastAPI service, PostgreSQL and configured file roots; AI endpoint independently configured |

Metadata flexibility does not mean unlimited automatic behavior. A new attribute also needs agreed type, units, validation, editing, discovery, visualization and export support. Maintain this contract when deciding whether it belongs in a typed field, metadata, interval family or depth/time series.

The display hierarchy is `Display -> Widget -> Track -> Track object/Curve -> Settings`. This supports tailored user journeys without embedding borehole-specific mnemonics into every screen. Distinguish layout configuration from changing source data. Units and timezone preferences are a foundation; confirm supported conversions rather than implying every curve or operational parameter is automatically converted.

### Use the architecture pack as a target discussion, not a shipped-feature checklist

Start with `00_GeoWorkbench_Architecture_Blueprint.md`: system context, ingestion, interpretation and information model. Use `02_GeoWorkbench_Detailed_Logical_Architecture.md` for component and extension discussion. The documents label themselves conceptual/target architecture, and several detailed statements go beyond current source behavior.

| Topic in the architecture pack | Clarification for this meeting |
| --- | --- |
| WebSocket presence, live cursors, conflict resolution | Current updates use SSE. Shared notifications do not establish collaborative editing, locks, presence or CRDT behavior. |
| Any SAML/OIDC IdP without code changes; SimproIdP; ABAC/MFA | Current code has local password hashes, database sessions and Entra integration. Additional identity providers and policy systems are separate integration work. Do not claim the application never stores password hashes. |
| Short-lived JWT plus refresh-token architecture | Current app session tokens are database-backed opaque tokens with configured expiry/refresh behavior. Do not quote a 15-minute JWT model as deployed. |
| Fine-grained permissions and compliance | Role/access configuration exists, but some API routes lack explicit user/permission dependencies. Route-level and data-level enforcement need review before any production-security claim. Configurable roles do not prove every endpoint enforces the matrix. |
| Offline IndexedDB sync, background file queue | Current PWA interval outbox uses local storage; offline files, durable deduplication and multi-device conflict handling are not established. |
| Approval routing, signed exports, CAB | Target governance concepts; not this demo's geology approval/export workflow. |
| Formula engine, coal-quality library, kriging, true-thickness/geostatistical calculations | Do not present as available product functions without implementation and validation evidence. Current displayed interval/seam thickness is depth-based; it is not automatically true thickness. |
| PostGIS, mandatory Redis/MinIO, Kubernetes/cloud topology | Do not infer deployed components or exact versions from the blueprint. Current Windows UAT uses external PostgreSQL and configured local file roots; Redis can be disabled. |
| Learned geophysical signatures and training/feedback pipeline | Current heuristic review and model narrative are distinct from a trained signature classifier or an operating ML pipeline. |

Keep these clarifications in the presenter/developer briefing. If an IT attendee asks for a committed design, agree an as-deployed inventory and a separately approved target architecture. Do not alter the external architecture pack as part of this demo-script task.

### Questions to settle with IT

- Which tenant, users, project/site permissions and data-export boundaries must be enforced?
- Where will PostgreSQL, uploads, images, exports and the local model run, and who owns backup/restore tests?
- What are the retention, RPO/RTO, concurrent-user, curve-volume and network requirements?
- Which URLs and proxy settings must support SSE, phone camera/uploads and model calls?
- Which data may reach a model, and what prompt/output logging and document-access rules apply?
- What must be measured before requiring workers, object storage, Redis distribution or additional rendering optimization?

## 9. Core Images: Explain the Contract Before the Rendering

The received local MGCA data contains no core images. Show missing evidence honestly; an uploaded site photo is not yet a depth-indexed core image strip.

For the intended workflow, retain the original box photograph and create separate derived lane assets with source-image ID, crop geometry, row order/direction, depth start/end, physical scale, recovery/gap information and confirmation status. Store image assets outside Git; keep searchable metadata in the database.

A 1 m lane / four-lane 4 m box is only an assumption for an explicitly labelled test package. Production mapping must come from the scale, labels and confirmed handling procedure. A tape measuring 100 cm does not prove that every photographed lane has a complete metre of recovered core.

At close zoom, inspect original detail; at broader zoom, use suitable image levels/tiles for performance. Representative texture selection or skipping repeated tiles can obscure exact crack position or gap length. Any future such overview needs a clear distinction from a calibrated depth-faithful view and access to the original photograph. Do not claim fractures are reliably visible at every zoom or that the current build has validated AI extraction.

Ask Reliance for several original images with labelled depths, scale, orientation, lane ordering, recovered/missing lengths and a geologist-verified reference. Agree extraction and mapping accuracy before treating image-derived measurements as facts.

## 10. Developer Sanity: Run the Actual Story Once

Use `PASS`, `FAIL`, `NOT RUN`, or `CONDITIONAL` for each row. None is pre-marked passed. Record the deployed release; source tests from a previous package do not prove today's server workflow.

Allow 45-60 minutes with the files prepared. First complete the connected capture/import/correction/export path and the log zoom checks; then verify correlation, saved layouts and actual model generation. The optional offline sequence comes last. Return the exact successful borehole, depth windows, template and export artifacts to the presenter so the demo repeats the tested path.

| ID | Priority | Rehearsal action and pass evidence | Result / issue |
| --- | --- | --- | --- |
| DEMO-01 | P0 | Web `geologist` and `/field` `field` sign in in separate sessions; navigation and roles make sense; no unexpected logout during the full rehearsal. | |
| DEMO-02 | P0 | Create an empty borehole from field. Confirm code, initial state and absence of cloned geology on web. Check web Dashboard/Import create dialog is above the map. | |
| DEMO-03 | P0 | Submit two distinct intervals and one parameter; verify persisted values, borehole association and RQD percent/fraction handling. Locate parameter payload if no dedicated viewer exists. | |
| DEMO-04 | P0 | Upload Excel/LAS and a test photo using the field app; check success/failure feedback and server file association. Test camera on the actual HTTPS device, or mark camera conditional and use a labelled file upload. | |
| DEMO-05 | P0 | Central source queue shows uploads. Form data appears in the log without requiring a file import; source uploads are not mistaken for merged data. | |
| DEMO-06 | P0 | Custom flat-table template: inspect sample, choose sheet/header, map fields, test, save and reload. Required-field errors are understandable. Built-ins remain intact. | |
| DEMO-07 | P0 | Replace Excel range 1-3 m: 0-1 m unchanged, revised RQD retained, new 2-3 m present. Separately rehearse append-only and source-borehole mismatch behavior. | |
| DEMO-08 | P0 | LAS creates available curve catalog entries with correct units, samples and coverage. Reimport choice behaves as reported; no unexplained duplicate depths or loss of unrelated curves. | |
| DEMO-09 | P0 | On MGCA-08, select a known ruler depth and drag a range such as 300-350 m. Visible range matches to normal display precision; all tracks stay aligned. Header clicks do not become body-depth clicks. | |
| DEMO-10 | P0 | Curves draw immediately after zoom without needing scroll. Scroll reaches 0 and approximately 801 m after zoom; full virtual depth remains intact. Reset Full depth and repeat. | |
| DEMO-11 | P0 | Click/hover different tracks; metadata identifies the correct enclosing interval. Toggle tooltip and runtime curve visibility; no data changes. Inspect gaps and window-boundary curve continuity. | |
| DEMO-12 | P0 | Save an interval remark and one supported numerical edit on the test borehole. Refresh; values, quantitative track and before/after history agree. Separately check interval seam edits against correlation seam records. | |
| DEMO-13 | P0 | Run rules on the controlled finding. Record rule/evidence/depth. Apply a supported patch or manual correction, inspect result and history, and revalidate. No empty Accept action represented as a correction. | |
| DEMO-14 | P0 for AI claim | Generate a real workbench and correlation LLM response. Verify `used_for_summary`, actual response time and evidence consistency; the summary does not repeatedly regenerate on ordinary view interaction. Otherwise explicitly mark rules-only. | |
| DEMO-15 | P0 | Correlation with 3 then 5 boreholes: columns fill/scroll sensibly; top/bottom ties stay inside selected columns; focused labels are readable at the rehearsed zoom; presence counts and units agree. | |
| DEMO-16 | P0 | Confirm focus-marker facts against raw records. Compare frontend grouped thickness with backend narrative; check RL source and CRS before using elevation/distance statements. | |
| DEMO-17 | P0 | Open an individual borehole from correlation, return, save an observation and reopen the same selected set. Text, author/time and context persist. | |
| DEMO-18 | P0 | Generate/download/open Excel and LAS. Verify saved remark/RQD, target borehole, depth scope, curve subset and units against stored data; verify supported output options in the artifact. | |
| DEMO-19 | P0 | Clone/edit display; add/remove widget and curve, drag/resize, undo, cancel, save, refresh and reopen runtime. Original layout is retained and floating windows close correctly. | |
| DEMO-20 | P0 | Borehole/display selection survives refresh and switching menus. Test at the actual demo resolution/browser zoom, plus one smaller desktop; no clipped primary actions or unreadable theme text. | |
| DEMO-21 | Conditional | Queue one new interval offline and reconnect once; exactly one intended observation reaches central. File-upload/retry limits are correctly explained; no pending outbox at handover. | |
| DEMO-22 | P0 for IT claim | Run authorized/unauthorized API checks for the actual role matrix. Record missing enforcement as a security gap; never infer enforcement from hidden buttons alone. | |
| DEMO-23 | P0 | Public server smoke passes, current assets/routes load, wiki works, and selected real borehole/data are present. Record results and known limits for the presenter. | |

P0 means required for the associated live claim, not an assertion that the underlying feature is already UAT-approved. If it fails, either fix and retest, or explicitly remove that live claim and show a labelled recorded artifact. Broken core capture, merge, depth interactions, correction persistence or exports should be reported immediately rather than disguised as a model or network limitation.

### Server smoke and evidence

Run the existing server script with an authorized local account; it prompts for the password:

```powershell
& 'C:\GeoWorkbench\release\<active-release>\scripts\uat-smoke.ps1' `
  -BaseUrl 'https://geowb.simproapps.in' -Username 'geologist' -CheckFrontend
```

Add `-RequireAi` when provider availability is mandatory, then separately check actual generation. Use the real release path from the service XML; do not assume the placeholder is the active folder. The smoke script is a starting point, not proof of every item above or a full security audit.

For any failure, record: demo ID, release, role, device/browser, borehole, display, source/template, depth range, steps, expected/actual result, screenshot, and relevant request/status/log evidence. Redact credentials and session tokens. Link the issue to the appropriate existing GitHub project item.

Suggested developer handback:

```text
Target URL and release:
Tester and time:
Workflow borehole / prepared files / template:
Real-data boreholes / focus marker / depth window:
P0 results and blocking issues:
LLM genuinely used / rules-only / not tested:
Export artifacts checked:
Conditional steps to omit:
Known limits the presenter must explain:
Decision: ready for this script / ready with stated omissions / not ready
```

## 11. Questions That Move the Engagement Forward

1. Which decisions take the central geologist the most time today: correction, curve reconciliation, correlation, or downstream export preparation?
2. Which site fields are mandatory, and which operational parameters must become typed, unit-aware and reportable?
3. Which supplied Excel sheets are original descriptions versus approved corrections? What is the authoritative depth reference and collar datum?
4. What should happen when a new batch overlaps a reviewed interval: append, replace, propose a correction, or require a reviewer?
5. How are named seams, bands, partings, aliases, split seams and top/bottom picks defined? Is the important quantity gross interval thickness, net coal thickness, or both?
6. Can Reliance supply calibrated geophysical signatures, tool/bit-size metadata, units and a few manually interpreted examples for each expected curve family?
7. Which exact Minex import template/version and example output file should be treated as the acceptance contract?
8. What must be signed off, by whom, and when should a reviewed interpretation be frozen?
9. Which two assistant workflows should the next pilot measure, and what would constitute a useful, trustworthy recommendation?

## 12. Supporting References

- [Existing story and demo script](reliance-uat-story-and-demo-script.md)
- [Lifecycle user manual](lifecycle-management.md)
- [Field PWA guidance](field-pwa.md)
- [Existing UAT test cases](uat-test-cases.md)
- [Log widget architecture](../architecture/log-widget.md) and [control plane](../architecture/log-widget-control-plane.md)
- [Windows UAT update and rollback](../deployment/uat-server-package.md)
- External IT pack: `D:\SimproArchitectureCenter\GeoWorkbench-Architecture\00_GeoWorkbench_Architecture_Blueprint.md`
- External technical detail: `D:\SimproArchitectureCenter\GeoWorkbench-Architecture\02_GeoWorkbench_Detailed_Logical_Architecture.md`

Implementation anchors for developer verification:

- Field entry/outbox: `frontend/src/field/FieldPwaApp.tsx`, `frontend/src/field/fieldOutbox.ts`, `backend/app/domains/mobile/service.py`.
- Template mapping/merge: `frontend/src/workbench/imports/TemplateEditorDialog.tsx`, `backend/app/services/template_import.py`, `backend/app/domains/imports/service.py`.
- Corrections and audits: `backend/app/domains/boreholes/service.py`, `backend/app/db/models.py`, `backend/app/services/data_stage.py`.
- Rule evidence/model context: `backend/app/services/validation/borehole_validation.py`, `backend/app/domains/ai/service.py`, `backend/app/services/ai_provider.py`.
- Correlation matching: `frontend/src/workbench/correlation/seamOccurrences.ts`, `correlationTieLines.ts`, `correlationInsights.ts`, and backend correlation summary in `backend/app/domains/ai/service.py`.
- Output semantics: `frontend/src/workbench/exports/ExportCenter.tsx`, `backend/app/domains/exports/service.py`.
- Identity/realtime: `backend/app/domains/auth/service.py`, `backend/app/domains/realtime/router.py`.
