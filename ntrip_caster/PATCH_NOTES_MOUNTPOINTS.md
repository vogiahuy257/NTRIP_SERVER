# Mountpoints single-screen workspace

## Layout
- Removed the separate page title card and the Topology / Mountpoints / Rover Accounts tabs.
- Topology is now the main full-screen workspace.
- Added a collapsible operations rail on the left for Mountpoint search, status filtering, access mode, and Rover Account management.
- Moved network metrics into a compact bottom-left dock.
- Moved selected topology details into a compact bottom-right inspector.
- Added fixed column labels for Source stations, Mountpoints, and Rover clients.

## Rover management
- Rover Accounts remain fully manageable from the left rail: create, edit access, change password, enable/disable, copy username, delete, and refresh.
- Existing dialogs and the existing `useRoverAccounts` store are reused.
- Account forms always receive the complete Mountpoint list even while the topology is filtered.

## AUTO Mountpoint
- Added frontend session fields for `requested_mountpoint`, `auto_mountpoint`, `auto_state`, `mountpoint_switch_count`, and `last_mountpoint_switch_at`.
- Assigned AUTO Rovers are marked directly on their resolved Base/Mountpoint node.
- Unassigned AUTO Rovers are shown under a virtual `AUTO Router -> AUTO -> Rover` branch instead of disappearing from topology.
- The left rail shows a compact AUTO waiting row and the realtime badge shows the number of AUTO Rovers waiting for a Base.

## Changed files
- resources/js/pages/mountpoints/index.tsx
- resources/js/pages/mountpoints/components/mountpoint-operations-panel.tsx (new)
- resources/js/pages/mountpoints/components/mountpoint-topology-panel.tsx
- resources/js/pages/mountpoints/components/mountpoint-topology-nodes.tsx
- resources/js/pages/mountpoints/lib/mountpoint-realtime.ts
- resources/js/pages/mountpoints/types.ts
- resources/js/realtime/dashboard-session-normalizer.ts
- resources/js/types/ntrip-dashboard.ts
