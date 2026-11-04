========================================================================
   SM FLOW SYNC AGENT - UNIVERSAL SELF-ADAPTING EDITION
   Real-Time Background Synchronization for BUSY & SM Flow OMS
========================================================================

WHAT IS THIS?
This folder contains the universal Windows background synchronizer for 
SM Flow Order Management System. It runs quietly in your Windows notification 
tray (next to the clock) and keeps your cloud system up to date with BUSY.

DYNAMIC SELF-ADAPTING ARCHITECTURE:
* Works automatically on ANY machine (64-bit or 32-bit Office / Access 2007).
* Automatically detects if 64-bit Access Database Engine is missing and 
  seamlessly routes through 32-bit SysWOW64 PowerShell to connect to existing 
  Access 2007 or Jet drivers with ZERO manual driver installations!
* 100% SAFE: Does NOT require installing 64-bit Access Engine on the server, 
  leaving Office Enterprise 2007 completely untouched and safe.
* Self-Contained: Includes portable node.exe and C++ runtime DLLs. No external 
  Node.js or Visual C++ installations required!

FILES IN THIS FOLDER:
* SMFlowSyncAgent.exe       : Standalone agent program (Native Windows GUI)
* node.exe & DLLs           : Embedded portable cloud upload runtime
* config.json               : Configuration (Server name, paths, schedule)
* sync_history.log          : Persistent log of every sync operation
* scripts\                  : Automation scripts (database extraction & upload)
* node_modules\             : Embedded cloud database runtime engine
* build.bat                 : Optional source compiler (.NET Framework 4.8)

HOW TO RUN ON ANY PC (DEV PC OR MAIN BUSY SERVER):
1. Copy this entire "sync_agent" folder to the target PC (e.g. C:\SM_Sync_Agent).
2. Open "SMFlowSyncAgent.exe".
3. Go to the "Settings" tab and click "Set Current PC as Primary".
4. Update paths:
   - For Server PC: Master Folder = F:\BusyWin\DATA\COMP0010, Clone = C:\BusyWin_Clone, Project = C:\SM_Sync_Agent
   - For Network Client PC: Master Folder = \\Desktop-2pps0fa\f\BusyWin\DATA\COMP0010
5. Click "Save Settings".
6. Click "Sync Now". The agent will auto-detect the database driver and complete the sync!
========================================================================