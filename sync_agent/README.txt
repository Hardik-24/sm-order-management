========================================================================
   SM FLOW SYNC AGENT - PORTABLE EDITION
   Real-Time Background Synchronization for BUSY & SM Flow OMS
========================================================================

WHAT IS THIS?
This folder contains the standalone Windows background synchronizer for 
SM Flow Order Management System. It runs quietly in your Windows notification 
tray (next to the clock) and keeps your cloud system up to date with BUSY.

FILES IN THIS FOLDER:
* SMFlowSyncAgent.exe       : Standalone agent program (Native Windows GUI)
* config.json               : Configuration (Server name, paths, schedule)
* sync_history.log          : Persistent log of every sync operation
* scripts\                  : Automation scripts (database extraction & upload)
* node_modules\             : Embedded cloud database runtime engine
* build.bat                 : Optional source compiler (.NET Framework 4.8)

HOW TO RUN:
1. Double-click "SMFlowSyncAgent.exe" to open the dashboard.
2. The agent sits quietly in the notification tray (^ icon by the clock).
3. Automatic sync runs at exact half-hour marks (e.g., 9:00, 9:30, 10:00).
4. Click "Sync Now" anytime for an instant on-demand sync.

MOVING TO ANOTHER PC (e.g. THE MAIN BUSY SERVER):
1. Copy this entire "sync_agent" folder to the other PC (e.g. C:\SM_Sync_Agent).
2. Ensure Node.js is installed (or copy node.exe into this folder).
3. Open "SMFlowSyncAgent.exe".
4. Go to the "Settings" tab and click "Set Current PC as Primary".
5. Update the "BUSY Server Master Folder" if BUSY is on a local drive (e.g. F:\BusyWin\DATA\COMP0010).
6. Click "Save Settings".
That's it! The agent will now take over syncing on that PC.

SAFETY & RESILIENCE:
- Safe Stop: If you exit or shut down mid-sync, database integrity is 100% 
  protected because extraction uses a temporary read-only snapshot.
- Smart Standby: Only the designated Primary PC can trigger syncs. Any other 
  computer running the agent stays in Standby mode with "Sync Now" locked.
========================================================================