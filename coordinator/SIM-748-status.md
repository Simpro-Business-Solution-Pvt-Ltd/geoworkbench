# SIM-748 Coordination Status

GeoWorkbench Reliance POC — local delivery coordination. Updated by GeoWorkbench CEO (2cb15518).

## Heartbeat record — 2026-11-23 ~14:10 UTC (run 3fec30a7)

Wake: user comment ee1352e8 (SSH PATH/wrapper repaired; Platform already running SIM-749; resume same root, inspect, exit while it works; no second platform task) and 75b745f0 (GW1 is supervised work, not a blocker; root self-blocking child relation removed; preflight passed 14:01:54 UTC; `geoctl start` next).

Verified this heartbeat:

- SIM-748 root: in_progress, no blockers (`blockedBy=[]`), assigned to GeoWorkbench CEO.
- SIM-749 (GW1 baseline) — Platform b32c4846 — running (run 566389c6, started 13:55 UTC).
- Host repo /home/simproadmin/workspaces/geoworkbench-local/repository: strategy/reliance-enterprise-poc-20261123 at d8111cb4bbf27bdd4e3a765f83677e8b1287ea60, clean, in sync with origin. No feature worktrees yet.
- Runtime dir: geoctl.py, database-restored.json, filter_fixture.py, nginx.conf, tailscale-serve-before.json, bootstrap.lock present.
- project-input.json confirms root SIM-748, baseline SIM-749, team IDs, and that SIM-712 (Reporting) is done with no live run.

Capacity (company-wide local sessions, max 2):

1. SIM-748 coordinator (this run)
2. SIM-749 Platform (GW1, in flight)

No new worker dispatched. QA baseline preparation is the next candidate, capacity-gated until SIM-749 frees a session.

Anomaly: this run's Paperclip API bridge (127.0.0.1:36487) is refusing connections mid-run, so issue-thread writes failed; status recorded here on the coordinator branch instead. Runtime status channel is the fallback.

## Owners / next steps

| Step | Owner | State |
| --- | --- | --- |
| GW1: `geoctl start`, verify real Reliance data (10 MGCA boreholes 08/09/11/12/16/18/19/21/22/23; 9085 lithology intervals; resettable copies only), publish baseline report + exact strategy pin | Platform (SIM-749) | in flight |
| Verify GW1 baseline against project input (hashes, snapshot-manifest.json, no seed_demo/sample geology/PBH-62/smoke boreholes) | CEO | waiting on SIM-749 result |
| Independent QA baseline prepared and checked against the exact integrated strategy pin | QA be96e71a | capacity-wait |
| GW2: visual import/export template creation (extend existing flat-table builder; replace required export JSON editing) | Engineering 9f435a7b | waiting on GW1 + QA baseline |

Roadmap after GW2: offline forms/photos with safe replay + automatic capture/sync timestamps; evidence-linked corrections/version history and correct exports; enterprise operations with runtime logging (dynamic diagnostics temporary, audit history on); final real-data acceptance and illustrated manuals. Entra sign-in only; roles/permissions remain in GeoWorkbench; AI optional, no predictive lithology or trained-seam claims.
