using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SMFlowSyncAgent
{
    // =========================================================================
    // CONFIGURATION MODEL
    // =========================================================================
    public class AgentConfig
    {
        public string ServerHost { get; set; }
        public string SourceDir { get; set; }
        public string DestDir { get; set; }
        public string ProjectDir { get; set; }
        public string LogFile { get; set; }
        public int IntervalMinutes { get; set; }
        public string PrimaryPcName { get; set; }
        public bool StartWithWindows { get; set; }
        public bool IsStandby { get; set; }

        public AgentConfig()
        {
            ServerHost = "Desktop-2pps0fa";
            SourceDir = @"\\Desktop-2pps0fa\f\BusyWin\DATA\COMP0010";
            DestDir = @"D:\BusyWin Data\SM\Clone";
            ProjectDir = @"D:\App Development\SM_order_management";
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            LogFile = Path.Combine(appDir, "sync_history.log");
            IntervalMinutes = 30;
            PrimaryPcName = "PRISM";
            StartWithWindows = true;
            IsStandby = false;
        }

        public static string GetConfigPath()
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            return Path.Combine(appDir, "config.json");
        }

        public static string GetConfigBackupPath()
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            return Path.Combine(appDir, "config.json.bak");
        }

        private static AgentConfig TryParseFile(string filePath)
        {
            if (!File.Exists(filePath)) return null;

            // Retry up to 3 times with exponential delay for Windows startup file locks
            for (int attempt = 1; attempt <= 3; attempt++)
            {
                try
                {
                    using (FileStream fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                    using (StreamReader reader = new StreamReader(fs, Encoding.UTF8))
                    {
                        string json = reader.ReadToEnd();
                        if (!string.IsNullOrEmpty(json) && json.Trim().Length > 2)
                        {
                            JavaScriptSerializer ser = new JavaScriptSerializer();
                            AgentConfig cfg = ser.Deserialize<AgentConfig>(json);
                            if (cfg != null) return cfg;
                        }
                    }
                }
                catch
                {
                    if (attempt < 3) Thread.Sleep(150 * attempt);
                }
            }
            return null;
        }

        public static AgentConfig Load()
        {
            string path = GetConfigPath();
            string bakPath = GetConfigBackupPath();

            // 1. Try loading primary config.json with sharing-safe retries
            AgentConfig cfg = TryParseFile(path);
            if (cfg != null) return cfg;

            // 2. Try loading from backup if primary failed or was corrupted
            cfg = TryParseFile(bakPath);
            if (cfg != null)
            {
                try { cfg.Save(); } catch { }
                return cfg;
            }

            // 3. If file does not exist at all (first-time installation), create default and save
            if (!File.Exists(path) && !File.Exists(bakPath))
            {
                AgentConfig def = new AgentConfig();
                def.Save();
                return def;
            }

            // 4. IMPORTANT: If config physically exists on disk but could not be read,
            // NEVER call def.Save()! Never overwrite the user's config file with factory defaults!
            return new AgentConfig();
        }

        public void Save()
        {
            try
            {
                string path = GetConfigPath();
                string bakPath = GetConfigBackupPath();
                string tmpPath = path + ".tmp";

                JavaScriptSerializer ser = new JavaScriptSerializer();
                string json = ser.Serialize(this);

                // Write atomically to temporary file first
                using (FileStream fs = new FileStream(tmpPath, FileMode.Create, FileAccess.Write, FileShare.None))
                using (StreamWriter writer = new StreamWriter(fs, Encoding.UTF8))
                {
                    writer.Write(json);
                    writer.Flush();
                }

                // If existing config is non-empty, back it up safely
                if (File.Exists(path))
                {
                    try { File.Copy(path, bakPath, true); } catch { }
                }

                // Atomically move/replace tmp to actual path
                File.Copy(tmpPath, path, true);
                try { File.Delete(tmpPath); } catch { }
            }
            catch { }
        }
    }

    // =========================================================================
    // APPLICATION ENTRY & SINGLE INSTANCE GUARD
    // =========================================================================
    static class Program
    {
        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

        [STAThread]
        static void Main(string[] args)
        {
            bool startInTray = false;
            if (args != null)
            {
                for (int i = 0; i < args.Length; i++)
                {
                    if (string.Equals(args[i], "/tray", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(args[i], "/minimized", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(args[i], "-tray", StringComparison.OrdinalIgnoreCase))
                    {
                        startInTray = true;
                        break;
                    }
                }
            }

            string dbgPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "debug.log");
            try
            {
                Process current = Process.GetCurrentProcess();
                Process[] processes = Process.GetProcessesByName(current.ProcessName);
                foreach (Process p in processes)
                {
                    if (p.Id != current.Id)
                    {
                        IntPtr hWnd = p.MainWindowHandle;
                        if (hWnd == IntPtr.Zero)
                        {
                            hWnd = FindWindow(null, "SM Flow Sync Agent");
                        }
                        if (hWnd != IntPtr.Zero)
                        {
                            ShowWindow(hWnd, 9); // SW_RESTORE
                            SetForegroundWindow(hWnd);
                        }
                        return;
                    }
                }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                MainForm form = new MainForm(startInTray);
                Application.Run(form);
            }
            catch (Exception ex)
            {
                File.AppendAllText(dbgPath, "FATAL EXCEPTION: " + ex.ToString() + "\n");
            }
        }
    }

    // =========================================================================
    // MAIN GUI FORM
    // =========================================================================
    public class MainForm : Form
    {
        // Colors from SM Order Management design system
        private static readonly Color ColorBrandNavy = Color.FromArgb(27, 59, 95);       // #1b3b5f
        private static readonly Color ColorBrandDark = Color.FromArgb(19, 44, 73);       // #132c49
        private static readonly Color ColorBgLight = Color.FromArgb(248, 250, 252);      // #f8fafc
        private static readonly Color ColorCard = Color.FromArgb(255, 255, 255);         // white
        private static readonly Color ColorBorder = Color.FromArgb(226, 232, 240);       // #e2e8f0
        private static readonly Color ColorTextPrimary = Color.FromArgb(15, 23, 42);     // #0f172a
        private static readonly Color ColorTextMuted = Color.FromArgb(100, 116, 139);    // #64748b
        private static readonly Color ColorTerminalBg = Color.FromArgb(15, 23, 42);     // #0f172a
        private static readonly Color ColorTerminalText = Color.FromArgb(226, 232, 240); // #e2e8f0
        private static readonly Color ColorCyan = Color.FromArgb(56, 189, 248);          // #38bdf8
        private static readonly Color ColorGreen = Color.FromArgb(74, 222, 128);         // #4ade80
        private static readonly Color ColorAmber = Color.FromArgb(251, 191, 36);         // #fbbf24
        private static readonly Color ColorRose = Color.FromArgb(248, 113, 113);         // #f87171

        private AgentConfig config;
        private NotifyIcon trayIcon;
        private ContextMenuStrip trayMenu;
        private System.Windows.Forms.Timer countdownTimer;

        private DateTime lastSyncTime = DateTime.MinValue;
        private DateTime nextSyncTime = DateTime.MinValue;
        private bool isSyncing = false;
        private bool hasShownTrayBalloon = false;

        // UI Controls
        private Panel headerPanel;
        private Label lblAppTitle;
        private Label lblAppSubtitle;
        private Label lblStatusPill;
        private Button btnSyncNow;
        private Label lblCountdown;

        private Panel statsPanel;
        private Label lblStatLastSync;
        private Label lblStatDuration;
        private Label lblStatPrimary;
        private Label lblStatInterval;

        private TabControl mainTabs;
        private TabPage tabTerminal;
        private TabPage tabHistory;
        private TabPage tabSettings;

        // Terminal controls
        private RichTextBox rtbTerminal;
        private Panel terminalToolbar;
        private Button btnClearTerminal;
        private Button btnCopyTerminal;
        private Button btnOpenLogFile;
        private Label lblTerminalStatus;

        // History controls
        private ListView lvHistory;
        private Button btnRefreshHistory;
        private Button btnOpenRawLog;

        // Settings controls
        private TextBox txtServerHost;
        private TextBox txtSourceDir;
        private TextBox txtDestDir;
        private TextBox txtProjectDir;
        private ComboBox cbInterval;
        private TextBox txtPrimaryPc;
        private Button btnClaimPrimary;
        private CheckBox chkStandbyMode;
        private CheckBox chkStartWithWindows;
        private Button btnSaveSettings;

        private bool startInTray = false;

        public MainForm(bool startInTray)
        {
            this.startInTray = startInTray;
            config = AgentConfig.Load();
            InitializeComponent();
            SetupTray();
            SetupTimers();
            UpdateStatsUI();
            LoadHistory();
            ResetTerminalWelcome();
        }

        private void ResetTerminalWelcome()
        {
            rtbTerminal.Clear();
            AppendLog("SM Flow Sync Agent active & listening...", ColorCyan);
            AppendLog(string.Format("Host PC: {0} | Primary Designated PC: {1}", Environment.MachineName, config.PrimaryPcName), ColorTerminalText);

            if (IsPrimary())
            {
                AppendLog(string.Format("Status: ACTIVE PRIMARY. Auto-sync scheduled for every {0} minutes (at :00, :30 sharp).", config.IntervalMinutes), ColorGreen);
            }
            else
            {
                string reason = config.IsStandby ? "Forced STANDBY setting enabled" : string.Format("Auto-sync is managed by primary PC: '{0}'", config.PrimaryPcName);
                AppendLog(string.Format("Status: STANDBY. {0}.", reason), ColorAmber);
            }
        }

        protected override void SetVisibleCore(bool value)
        {
            if (startInTray)
            {
                value = false;
                if (!this.IsHandleCreated) CreateHandle();
            }
            base.SetVisibleCore(value);
        }

        private bool IsPrimary()
        {
            if (config.IsStandby) return false;
            return string.Equals(Environment.MachineName, config.PrimaryPcName, StringComparison.OrdinalIgnoreCase);
        }

        // =====================================================================
        // UI INITIALIZATION
        // =========================================================================
        private void InitializeComponent()
        {
            this.Text = "SM Flow Sync Agent";
            this.Size = new Size(820, 620);
            this.MinimumSize = new Size(720, 500);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = ColorBgLight;
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);
            this.Icon = CreateAppIcon(ColorGreen);

            // 1. Header Panel
            headerPanel = new Panel();
            headerPanel.Dock = DockStyle.Top;
            headerPanel.Height = 68;
            headerPanel.BackColor = ColorBrandNavy;
            headerPanel.Padding = new Padding(16, 12, 16, 12);

            lblAppTitle = new Label();
            lblAppTitle.Text = "SM FLOW SYNC AGENT";
            lblAppTitle.ForeColor = Color.White;
            lblAppTitle.Font = new Font("Segoe UI", 12F, FontStyle.Bold);
            lblAppTitle.AutoSize = true;
            lblAppTitle.Location = new Point(16, 12);

            lblAppSubtitle = new Label();
            lblAppSubtitle.Text = "BusyWin 1-Way Clone to OMS Cloud Bridge • High-Speed Sync";
            lblAppSubtitle.ForeColor = Color.FromArgb(147, 197, 253);
            lblAppSubtitle.Font = new Font("Segoe UI", 8F);
            lblAppSubtitle.AutoSize = true;
            lblAppSubtitle.Location = new Point(17, 36);

            lblStatusPill = new Label();
            lblStatusPill.Text = "● PRIMARY (ACTIVE)";
            lblStatusPill.Font = new Font("Segoe UI", 8.5F, FontStyle.Bold);
            lblStatusPill.TextAlign = ContentAlignment.MiddleCenter;
            lblStatusPill.Size = new Size(160, 28);
            lblStatusPill.Location = new Point(360, 20);
            lblStatusPill.BackColor = Color.FromArgb(236, 253, 245);
            lblStatusPill.ForeColor = Color.FromArgb(4, 120, 87);

            btnSyncNow = new Button();
            btnSyncNow.Text = "⚡ Sync Now";
            btnSyncNow.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
            btnSyncNow.ForeColor = Color.White;
            btnSyncNow.BackColor = Color.FromArgb(37, 99, 235);
            btnSyncNow.FlatStyle = FlatStyle.Flat;
            btnSyncNow.FlatAppearance.BorderSize = 0;
            btnSyncNow.Size = new Size(110, 32);
            btnSyncNow.Location = new Point(540, 18);
            btnSyncNow.Cursor = Cursors.Hand;
            btnSyncNow.Click += (s, e) => TriggerManualSync();

            lblCountdown = new Label();
            lblCountdown.Text = "Next: 30m 00s";
            lblCountdown.ForeColor = Color.FromArgb(226, 232, 240);
            lblCountdown.Font = new Font("Segoe UI", 8F, FontStyle.Bold);
            lblCountdown.AutoSize = true;
            lblCountdown.Location = new Point(665, 26);

            headerPanel.Controls.Add(lblAppTitle);
            headerPanel.Controls.Add(lblAppSubtitle);
            headerPanel.Controls.Add(lblStatusPill);
            headerPanel.Controls.Add(btnSyncNow);
            headerPanel.Controls.Add(lblCountdown);
            this.Controls.Add(headerPanel);

            // 2. Stats Panel
            statsPanel = new Panel();
            statsPanel.Dock = DockStyle.Top;
            statsPanel.Height = 44;
            statsPanel.BackColor = ColorCard;
            statsPanel.Padding = new Padding(16, 12, 16, 12);
            statsPanel.Paint += (s, e) =>
            {
                using (Pen p = new Pen(ColorBorder))
                {
                    e.Graphics.DrawLine(p, 0, statsPanel.Height - 1, statsPanel.Width, statsPanel.Height - 1);
                }
            };

            lblStatLastSync = new Label();
            lblStatLastSync.Text = "Last Synced: Never";
            lblStatLastSync.ForeColor = ColorTextMuted;
            lblStatLastSync.Font = new Font("Segoe UI", 8.5F, FontStyle.Regular);
            lblStatLastSync.AutoSize = true;
            lblStatLastSync.Location = new Point(16, 12);

            lblStatDuration = new Label();
            lblStatDuration.Text = "Duration: --";
            lblStatDuration.ForeColor = ColorTextMuted;
            lblStatDuration.Font = new Font("Segoe UI", 8.5F, FontStyle.Regular);
            lblStatDuration.AutoSize = true;
            lblStatDuration.Location = new Point(220, 12);

            lblStatInterval = new Label();
            lblStatInterval.Text = "Interval: 30 Mins";
            lblStatInterval.ForeColor = ColorTextMuted;
            lblStatInterval.Font = new Font("Segoe UI", 8.5F, FontStyle.Regular);
            lblStatInterval.AutoSize = true;
            lblStatInterval.Location = new Point(380, 12);

            lblStatPrimary = new Label();
            lblStatPrimary.Text = "Host: " + Environment.MachineName;
            lblStatPrimary.ForeColor = ColorTextMuted;
            lblStatPrimary.Font = new Font("Segoe UI", 8.5F, FontStyle.Regular);
            lblStatPrimary.AutoSize = true;
            lblStatPrimary.Location = new Point(540, 12);

            statsPanel.Controls.Add(lblStatLastSync);
            statsPanel.Controls.Add(lblStatDuration);
            statsPanel.Controls.Add(lblStatInterval);
            statsPanel.Controls.Add(lblStatPrimary);
            this.Controls.Add(statsPanel);

            // 3. Tab Control
            mainTabs = new TabControl();
            mainTabs.Dock = DockStyle.Fill;
            mainTabs.Font = new Font("Segoe UI", 9F, FontStyle.Regular);
            mainTabs.Padding = new Point(14, 8);

            tabTerminal = new TabPage("📟 Live Terminal");
            tabTerminal.BackColor = ColorTerminalBg;
            SetupTerminalTab();

            tabHistory = new TabPage("📜 Sync History");
            tabHistory.BackColor = ColorCard;
            SetupHistoryTab();

            tabSettings = new TabPage("⚙️ Settings & Paths");
            tabSettings.BackColor = ColorCard;
            SetupSettingsTab();

            mainTabs.TabPages.Add(tabTerminal);
            mainTabs.TabPages.Add(tabHistory);
            mainTabs.TabPages.Add(tabSettings);

            this.Controls.Add(mainTabs);

            // Bring header and stats to front of dock stack
            headerPanel.BringToFront();
            statsPanel.BringToFront();
            mainTabs.BringToFront();

            this.FormClosing += MainForm_FormClosing;
            this.Resize += MainForm_Resize;
        }

        // =====================================================================
        // TAB 1: LIVE TERMINAL
        // =====================================================================
        private void SetupTerminalTab()
        {
            tabTerminal.Padding = new Padding(8);

            terminalToolbar = new Panel();
            terminalToolbar.Dock = DockStyle.Top;
            terminalToolbar.Height = 36;
            terminalToolbar.BackColor = Color.FromArgb(20, 30, 48);

            lblTerminalStatus = new Label();
            lblTerminalStatus.Text = "Ready";
            lblTerminalStatus.ForeColor = ColorCyan;
            lblTerminalStatus.Font = new Font("Consolas", 9F, FontStyle.Bold);
            lblTerminalStatus.AutoSize = true;
            lblTerminalStatus.Location = new Point(10, 10);

            btnClearTerminal = new Button();
            btnClearTerminal.Text = "Clear";
            btnClearTerminal.Font = new Font("Segoe UI", 8F);
            btnClearTerminal.ForeColor = Color.White;
            btnClearTerminal.BackColor = Color.FromArgb(30, 41, 59);
            btnClearTerminal.FlatStyle = FlatStyle.Flat;
            btnClearTerminal.FlatAppearance.BorderColor = Color.FromArgb(51, 65, 85);
            btnClearTerminal.Size = new Size(60, 24);
            btnClearTerminal.Location = new Point(560, 6);
            btnClearTerminal.Click += (s, e) => ResetTerminalWelcome();

            btnCopyTerminal = new Button();
            btnCopyTerminal.Text = "Copy";
            btnCopyTerminal.Font = new Font("Segoe UI", 8F);
            btnCopyTerminal.ForeColor = Color.White;
            btnCopyTerminal.BackColor = Color.FromArgb(30, 41, 59);
            btnCopyTerminal.FlatStyle = FlatStyle.Flat;
            btnCopyTerminal.FlatAppearance.BorderColor = Color.FromArgb(51, 65, 85);
            btnCopyTerminal.Size = new Size(60, 24);
            btnCopyTerminal.Location = new Point(625, 6);
            btnCopyTerminal.Click += (s, e) =>
            {
                if (!string.IsNullOrEmpty(rtbTerminal.Text))
                {
                    Clipboard.SetText(rtbTerminal.Text);
                    MessageBox.Show("Terminal output copied to clipboard!", "Copied", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            };

            btnOpenLogFile = new Button();
            btnOpenLogFile.Text = "Open Log";
            btnOpenLogFile.Font = new Font("Segoe UI", 8F);
            btnOpenLogFile.ForeColor = Color.White;
            btnOpenLogFile.BackColor = Color.FromArgb(30, 41, 59);
            btnOpenLogFile.FlatStyle = FlatStyle.Flat;
            btnOpenLogFile.FlatAppearance.BorderColor = Color.FromArgb(51, 65, 85);
            btnOpenLogFile.Size = new Size(75, 24);
            btnOpenLogFile.Location = new Point(690, 6);
            btnOpenLogFile.Click += (s, e) => OpenLogFile();

            terminalToolbar.Controls.Add(lblTerminalStatus);
            terminalToolbar.Controls.Add(btnClearTerminal);
            terminalToolbar.Controls.Add(btnCopyTerminal);
            terminalToolbar.Controls.Add(btnOpenLogFile);

            rtbTerminal = new RichTextBox();
            rtbTerminal.Dock = DockStyle.Fill;
            rtbTerminal.BackColor = ColorTerminalBg;
            rtbTerminal.ForeColor = ColorTerminalText;
            rtbTerminal.Font = new Font("Consolas", 9.5F, FontStyle.Regular);
            rtbTerminal.BorderStyle = BorderStyle.None;
            rtbTerminal.ReadOnly = true;

            tabTerminal.Controls.Add(rtbTerminal);
            tabTerminal.Controls.Add(terminalToolbar);
        }

        // =====================================================================
        // TAB 2: SYNC HISTORY
        // =====================================================================
        private void SetupHistoryTab()
        {
            tabHistory.Padding = new Padding(16);

            Panel topBar = new Panel();
            topBar.Dock = DockStyle.Top;
            topBar.Height = 40;

            btnRefreshHistory = new Button();
            btnRefreshHistory.Text = "🔄 Refresh History";
            btnRefreshHistory.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
            btnRefreshHistory.ForeColor = ColorBrandNavy;
            btnRefreshHistory.BackColor = Color.FromArgb(241, 245, 249);
            btnRefreshHistory.FlatStyle = FlatStyle.Flat;
            btnRefreshHistory.FlatAppearance.BorderColor = ColorBorder;
            btnRefreshHistory.Size = new Size(140, 30);
            btnRefreshHistory.Location = new Point(0, 4);
            btnRefreshHistory.Click += (s, e) => LoadHistory();

            btnOpenRawLog = new Button();
            btnOpenRawLog.Text = "📂 Open sync_history.log in Notepad";
            btnOpenRawLog.Font = new Font("Segoe UI", 9F);
            btnOpenRawLog.ForeColor = ColorTextMuted;
            btnOpenRawLog.BackColor = ColorCard;
            btnOpenRawLog.FlatStyle = FlatStyle.Flat;
            btnOpenRawLog.FlatAppearance.BorderColor = ColorBorder;
            btnOpenRawLog.Size = new Size(240, 30);
            btnOpenRawLog.Location = new Point(150, 4);
            btnOpenRawLog.Click += (s, e) => OpenLogFile();

            topBar.Controls.Add(btnRefreshHistory);
            topBar.Controls.Add(btnOpenRawLog);

            lvHistory = new ListView();
            lvHistory.Dock = DockStyle.Fill;
            lvHistory.View = View.Details;
            lvHistory.FullRowSelect = true;
            lvHistory.GridLines = true;
            lvHistory.BorderStyle = BorderStyle.FixedSingle;
            lvHistory.Font = new Font("Segoe UI", 9F);

            lvHistory.Columns.Add("Date & Time", 160);
            lvHistory.Columns.Add("Status", 100);
            lvHistory.Columns.Add("Duration", 100);
            lvHistory.Columns.Add("Details / Execution Summary", 400);

            tabHistory.Controls.Add(lvHistory);
            tabHistory.Controls.Add(topBar);
        }

        // =====================================================================
        // TAB 3: SETTINGS & PATHS
        // =====================================================================
        private void SetupSettingsTab()
        {
            tabSettings.AutoScroll = true;
            tabSettings.Padding = new Padding(24);

            int y = 16;

            // Section 1: Primary PC
            Label lblSecPrimary = CreateSectionHeader("1. Designated Primary Sync PC", ref y);
            tabSettings.Controls.Add(lblSecPrimary);

            Label lblPrimInfo = new Label();
            lblPrimInfo.Text = "Only the PC matching this computer name executes auto-syncs. Any other computer stays in safe Standby mode.";
            lblPrimInfo.ForeColor = ColorTextMuted;
            lblPrimInfo.Font = new Font("Segoe UI", 8.5F);
            lblPrimInfo.AutoSize = true;
            lblPrimInfo.Location = new Point(24, y);
            tabSettings.Controls.Add(lblPrimInfo);
            y += 24;

            txtPrimaryPc = new TextBox();
            txtPrimaryPc.Text = config.PrimaryPcName;
            txtPrimaryPc.Font = new Font("Segoe UI", 9.5F);
            txtPrimaryPc.Size = new Size(260, 28);
            txtPrimaryPc.Location = new Point(24, y);
            tabSettings.Controls.Add(txtPrimaryPc);

            btnClaimPrimary = new Button();
            btnClaimPrimary.Text = string.Format("Set Current PC ({0}) as Primary", Environment.MachineName);
            btnClaimPrimary.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
            btnClaimPrimary.ForeColor = Color.White;
            btnClaimPrimary.BackColor = ColorBrandNavy;
            btnClaimPrimary.FlatStyle = FlatStyle.Flat;
            btnClaimPrimary.FlatAppearance.BorderSize = 0;
            // Dynamic width so PC name is never truncated regardless of length
            int claimBtnWidth = Math.Max(260, TextRenderer.MeasureText(btnClaimPrimary.Text, btnClaimPrimary.Font).Width + 28);
            btnClaimPrimary.Size = new Size(claimBtnWidth, 28);
            btnClaimPrimary.Location = new Point(296, y - 1);
            btnClaimPrimary.Cursor = Cursors.Hand;
            btnClaimPrimary.Click += (s, e) =>
            {
                config.IsStandby = false;
                if (chkStandbyMode != null) chkStandbyMode.Checked = false;
                txtPrimaryPc.Text = Environment.MachineName;
                MessageBox.Show(string.Format("Designated Primary PC changed to '{0}'. Click 'Save Settings' to apply.", Environment.MachineName), "Primary Updated", MessageBoxButtons.OK, MessageBoxIcon.Information);
            };
            tabSettings.Controls.Add(btnClaimPrimary);
            y += 36;

            // Dedicated Standby toggle checkbox
            chkStandbyMode = new CheckBox();
            chkStandbyMode.Text = string.Format("Force STANDBY on this PC ({0}) - Ignore Primary designation and prevent all auto-syncs", Environment.MachineName);
            chkStandbyMode.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
            chkStandbyMode.ForeColor = ColorAmber;
            chkStandbyMode.Checked = config.IsStandby;
            chkStandbyMode.AutoSize = true;
            chkStandbyMode.Location = new Point(24, y);
            chkStandbyMode.Cursor = Cursors.Hand;
            tabSettings.Controls.Add(chkStandbyMode);
            y += 40;

            // Section 2: Source and Server
            Label lblSecPaths = CreateSectionHeader("2. Source & Destination Folders", ref y);
            tabSettings.Controls.Add(lblSecPaths);

            AddFolderSetting("Busy Server Hostname / IP (For Ping Check):", ref txtServerHost, config.ServerHost, false, ref y);
            AddFolderSetting("Master Busy Database Source Folder (Network Share):", ref txtSourceDir, config.SourceDir, true, ref y);
            AddFolderSetting("Local Clone Destination Folder:", ref txtDestDir, config.DestDir, true, ref y);
            AddFolderSetting("OMS Project Directory (Where scripts exist):", ref txtProjectDir, config.ProjectDir, true, ref y);

            // Section 3: Schedule & Startup
            Label lblSecSchedule = CreateSectionHeader("3. Schedule & Windows Startup", ref y);
            tabSettings.Controls.Add(lblSecSchedule);

            Label lblInt = new Label();
            lblInt.Text = "Auto-Sync Interval:";
            lblInt.AutoSize = true;
            lblInt.Location = new Point(24, y);
            tabSettings.Controls.Add(lblInt);

            cbInterval = new ComboBox();
            cbInterval.DropDownStyle = ComboBoxStyle.DropDownList;
            cbInterval.Font = new Font("Segoe UI", 9.5F);
            cbInterval.Items.AddRange(new object[] { 
                "15 minutes (:00, :15, :30, :45)", 
                "30 minutes (:00, :30 sharp - Default)", 
                "60 minutes (Top of every hour)", 
                "Manual Only (No Auto-Sync)" 
            });
            if (config.IntervalMinutes == 15) cbInterval.SelectedIndex = 0;
            else if (config.IntervalMinutes == 30) cbInterval.SelectedIndex = 1;
            else if (config.IntervalMinutes == 60) cbInterval.SelectedIndex = 2;
            else cbInterval.SelectedIndex = 3;
            cbInterval.Size = new Size(240, 26);
            cbInterval.Location = new Point(160, y - 3);
            tabSettings.Controls.Add(cbInterval);
            y += 36;

            chkStartWithWindows = new CheckBox();
            chkStartWithWindows.Text = "Start SM Flow Sync Agent automatically when Windows starts (Run in background tray)";
            chkStartWithWindows.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
            chkStartWithWindows.ForeColor = ColorTextPrimary;
            chkStartWithWindows.Checked = config.StartWithWindows;
            chkStartWithWindows.AutoSize = true;
            chkStartWithWindows.Location = new Point(24, y);
            tabSettings.Controls.Add(chkStartWithWindows);
            y += 44;

            btnSaveSettings = new Button();
            btnSaveSettings.Text = "💾 Save Settings";
            btnSaveSettings.Font = new Font("Segoe UI", 10F, FontStyle.Bold);
            btnSaveSettings.ForeColor = Color.White;
            btnSaveSettings.BackColor = Color.FromArgb(5, 150, 105);
            btnSaveSettings.FlatStyle = FlatStyle.Flat;
            btnSaveSettings.FlatAppearance.BorderSize = 0;
            btnSaveSettings.Size = new Size(180, 36);
            btnSaveSettings.Location = new Point(24, y);
            btnSaveSettings.Cursor = Cursors.Hand;
            btnSaveSettings.Click += (s, e) => SaveSettings();
            tabSettings.Controls.Add(btnSaveSettings);
            y += 50;
        }

        private Label CreateSectionHeader(string text, ref int y)
        {
            Label lbl = new Label();
            lbl.Text = text;
            lbl.Font = new Font("Segoe UI", 10.5F, FontStyle.Bold);
            lbl.ForeColor = ColorBrandNavy;
            lbl.AutoSize = true;
            lbl.Location = new Point(24, y);
            y += 26;
            return lbl;
        }

        private void AddFolderSetting(string title, ref TextBox tb, string initialVal, bool showBrowse, ref int y)
        {
            Label lbl = new Label();
            lbl.Text = title;
            lbl.ForeColor = ColorTextPrimary;
            lbl.AutoSize = true;
            lbl.Location = new Point(24, y);
            tabSettings.Controls.Add(lbl);
            y += 20;

            tb = new TextBox();
            tb.Text = initialVal;
            tb.Font = new Font("Segoe UI", 9.5F);
            tb.Size = new Size(showBrowse ? 560 : 660, 26);
            tb.Location = new Point(24, y);
            tabSettings.Controls.Add(tb);

            if (showBrowse)
            {
                Button btnBrowse = new Button();
                btnBrowse.Text = "Browse...";
                btnBrowse.Font = new Font("Segoe UI", 8.5F);
                btnBrowse.Size = new Size(90, 27);
                btnBrowse.Location = new Point(594, y - 1);
                TextBox targetTb = tb;
                btnBrowse.Click += (s, e) =>
                {
                    using (FolderBrowserDialog fbd = new FolderBrowserDialog())
                    {
                        fbd.SelectedPath = targetTb.Text;
                        if (fbd.ShowDialog() == DialogResult.OK)
                        {
                            targetTb.Text = fbd.SelectedPath;
                        }
                    }
                };
                tabSettings.Controls.Add(btnBrowse);
            }

            y += 36;
        }

        // =====================================================================
        // SAVE SETTINGS & STARTUP SHORTCUT
        // =========================================================================
        private void SaveSettings()
        {
            try
            {
                config.PrimaryPcName = txtPrimaryPc.Text.Trim();
                config.ServerHost = txtServerHost.Text.Trim();
                config.SourceDir = txtSourceDir.Text.Trim();
                config.DestDir = txtDestDir.Text.Trim();
                config.ProjectDir = txtProjectDir.Text.Trim();
                string appDir = AppDomain.CurrentDomain.BaseDirectory;
                config.LogFile = Path.Combine(appDir, "sync_history.log");

                if (cbInterval.SelectedIndex == 0) config.IntervalMinutes = 15;
                else if (cbInterval.SelectedIndex == 1) config.IntervalMinutes = 30;
                else if (cbInterval.SelectedIndex == 2) config.IntervalMinutes = 60;
                else config.IntervalMinutes = 0; // Manual only

                config.StartWithWindows = chkStartWithWindows.Checked;
                config.IsStandby = chkStandbyMode != null && chkStandbyMode.Checked;
                config.Save();

                UpdateStartupShortcut(config.StartWithWindows);
                SetupTimers();
                UpdateStatsUI();

                MessageBox.Show("Settings saved successfully!", "Success", MessageBoxButtons.OK, MessageBoxIcon.Information);
                AppendLog("Settings updated and saved to config.json.", ColorGreen);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Failed to save settings: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void UpdateStartupShortcut(bool enable)
        {
            try
            {
                string startupFolder = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
                string shortcutPath = Path.Combine(startupFolder, "SMFlowSyncAgent.lnk");

                if (!enable)
                {
                    if (File.Exists(shortcutPath)) File.Delete(shortcutPath);
                    return;
                }

                string exePath = Application.ExecutablePath;
                string vbsScript = string.Format(
                    "Set oWS = WScript.CreateObject(\"WScript.Shell\")\n" +
                    "Set oLink = oWS.CreateShortcut(\"{0}\")\n" +
                    "oLink.TargetPath = \"{1}\"\n" +
                    "oLink.Arguments = \"/tray\"\n" +
                    "oLink.WorkingDirectory = \"{2}\"\n" +
                    "oLink.Description = \"SM Flow Sync Agent - Background Tray Auto-Sync\"\n" +
                    "oLink.Save\n",
                    shortcutPath.Replace("\\", "\\\\"),
                    exePath.Replace("\\", "\\\\"),
                    Path.GetDirectoryName(exePath).Replace("\\", "\\\\")
                );

                string tmpVbs = Path.Combine(Path.GetTempPath(), "create_startup_shortcut.vbs");
                File.WriteAllText(tmpVbs, vbsScript);
                Process proc = Process.Start("cscript.exe", string.Format("//Nologo \"{0}\"", tmpVbs));
                if (proc != null) proc.WaitForExit(3000);
                if (File.Exists(tmpVbs)) File.Delete(tmpVbs);
            }
            catch { }
        }

        // =====================================================================
        // SYSTEM TRAY & STATUS NOTIFICATIONS
        // =========================================================================
        private void SetupTray()
        {
            trayMenu = new ContextMenuStrip();
            trayMenu.Font = new Font("Segoe UI", 9F);

            ToolStripMenuItem miSyncNow = new ToolStripMenuItem("⚡ Sync Now", null, (s, e) => TriggerManualSync());
            miSyncNow.Font = new Font("Segoe UI", 9F, FontStyle.Bold);

            ToolStripMenuItem miOpenTerminal = new ToolStripMenuItem("📟 Open Live Terminal", null, (s, e) => ShowAndRestore());
            ToolStripMenuItem miHistory = new ToolStripMenuItem("📜 View Sync History", null, (s, e) => { ShowAndRestore(); mainTabs.SelectedTab = tabHistory; });
            ToolStripMenuItem miSettings = new ToolStripMenuItem("⚙️ Settings", null, (s, e) => { ShowAndRestore(); mainTabs.SelectedTab = tabSettings; });
            ToolStripMenuItem miExit = new ToolStripMenuItem("❌ Exit Agent", null, (s, e) => ForceExit());

            trayMenu.Items.Add(miSyncNow);
            trayMenu.Items.Add(new ToolStripSeparator());
            trayMenu.Items.Add(miOpenTerminal);
            trayMenu.Items.Add(miHistory);
            trayMenu.Items.Add(miSettings);
            trayMenu.Items.Add(new ToolStripSeparator());
            trayMenu.Items.Add(miExit);

            trayIcon = new NotifyIcon();
            trayIcon.Text = "SM Flow Sync Agent: Idle";
            trayIcon.Icon = this.Icon;
            trayIcon.ContextMenuStrip = trayMenu;
            trayIcon.Visible = true;
            trayIcon.DoubleClick += (s, e) => ShowAndRestore();
        }

        private void ShowAndRestore()
        {
            startInTray = false;
            this.Show();
            this.WindowState = FormWindowState.Normal;
            this.BringToFront();
            this.Activate();
        }

        private void ForceExit()
        {
            if (isSyncing)
            {
                DialogResult dr = MessageBox.Show(
                    "A sync is currently in progress.\nExiting now will interrupt the database upload.\n\nAre you sure you want to stop and exit?",
                    "Sync in Progress",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning
                );
                if (dr != DialogResult.Yes) return;
            }

            trayIcon.Visible = false;
            trayIcon.Dispose();
            Application.Exit();
        }

        private void MainForm_FormClosing(object sender, FormClosingEventArgs e)
        {
            // Minimize to tray instead of quitting
            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                this.Hide();

                if (!hasShownTrayBalloon)
                {
                    hasShownTrayBalloon = true;
                    trayIcon.ShowBalloonTip(3000, "SM Flow Sync Agent", "Agent is running quietly in the background tray. Double-click the tray icon anytime to open.", ToolTipIcon.Info);
                }
            }
        }

        private void MainForm_Resize(object sender, EventArgs e)
        {
            if (this.WindowState == FormWindowState.Minimized)
            {
                this.Hide();
            }
        }

        // =====================================================================
        // TIMERS & SCHEDULING (CLOCK-ALIGNED 30-MIN BOUNDARIES)
        // =========================================================================
        private DateTime CalculateNextAlignedTime(int intervalMinutes)
        {
            if (intervalMinutes <= 0) return DateTime.MaxValue;
            DateTime now = DateTime.Now;
            int min = now.Minute;
            int nextMin = ((min / intervalMinutes) + 1) * intervalMinutes;
            DateTime aligned = new DateTime(now.Year, now.Month, now.Day, now.Hour, 0, 0, now.Kind).AddMinutes(nextMin);

            // If the aligned time is less than 60 seconds away, advance to next interval
            if ((aligned - now).TotalSeconds < 60)
            {
                aligned = aligned.AddMinutes(intervalMinutes);
            }
            return aligned;
        }

        private void SetupTimers()
        {
            if (countdownTimer != null)
            {
                countdownTimer.Stop();
                countdownTimer.Dispose();
            }

            if (config.IntervalMinutes > 0 && IsPrimary())
            {
                nextSyncTime = CalculateNextAlignedTime(config.IntervalMinutes);
            }
            else
            {
                nextSyncTime = DateTime.MinValue;
            }

            countdownTimer = new System.Windows.Forms.Timer();
            countdownTimer.Interval = 1000;
            countdownTimer.Tick += (s, e) => Ticker_Tick();
            countdownTimer.Start();
        }

        private void Ticker_Tick()
        {
            if (isSyncing)
            {
                lblCountdown.Text = "Syncing in progress...";
                return;
            }

            if (!IsPrimary())
            {
                lblCountdown.Text = "Standby (No Auto-Sync)";
                return;
            }

            if (config.IntervalMinutes <= 0)
            {
                lblCountdown.Text = "Manual Trigger Only";
                return;
            }

            // Check if clock-aligned boundary reached (e.g. 9:00, 9:30, 10:00)
            if (DateTime.Now >= nextSyncTime)
            {
                nextSyncTime = CalculateNextAlignedTime(config.IntervalMinutes);
                RunSyncPipeline(false);
                return;
            }

            TimeSpan diff = nextSyncTime - DateTime.Now;
            if (diff.TotalSeconds > 0)
            {
                lblCountdown.Text = string.Format("Next: {0:D2}m {1:D2}s ({2:hh:mm tt})", (int)diff.TotalMinutes, diff.Seconds, nextSyncTime);
            }
            else
            {
                lblCountdown.Text = "Next: Syncing now...";
            }
        }

        private void UpdateStatsUI()
        {
            bool prim = IsPrimary();
            if (prim)
            {
                btnSyncNow.Enabled = !isSyncing;
                btnSyncNow.Text = "⚡ Sync Now";
                btnSyncNow.BackColor = Color.FromArgb(37, 99, 235);
                lblStatusPill.Text = "● PRIMARY (ACTIVE)";
                lblStatusPill.BackColor = Color.FromArgb(236, 253, 245);
                lblStatusPill.ForeColor = Color.FromArgb(4, 120, 87);
                trayIcon.Text = "SM Flow Sync Agent: Primary (Active)";
            }
            else
            {
                btnSyncNow.Enabled = false;
                btnSyncNow.Text = "Standby (Locked)";
                btnSyncNow.BackColor = Color.FromArgb(148, 163, 184);
                lblStatusPill.Text = config.IsStandby ? "○ STANDBY (FORCED)" : string.Format("○ STANDBY ({0})", config.PrimaryPcName);
                lblStatusPill.BackColor = Color.FromArgb(241, 245, 249);
                lblStatusPill.ForeColor = Color.FromArgb(71, 85, 105);
                trayIcon.Text = config.IsStandby ? "SM Flow Sync Agent: Standby (Forced on this PC)" : string.Format("SM Flow Sync Agent: Standby (Primary is {0})", config.PrimaryPcName);
            }

            lblStatPrimary.Text = string.Format("Host: {0} ({1})", Environment.MachineName, prim ? "Primary" : (config.IsStandby ? "Standby - Forced" : "Standby"));
            lblStatInterval.Text = config.IntervalMinutes > 0 ? string.Format("Interval: {0} Mins", config.IntervalMinutes) : "Interval: Manual";

            if (lastSyncTime > DateTime.MinValue)
            {
                lblStatLastSync.Text = string.Format("Last Synced: {0:hh:mm:ss tt}", lastSyncTime);
            }
        }

        // =====================================================================
        // SYNC PIPELINE EXECUTION ENGINE
        // =========================================================================
        private void TriggerManualSync()
        {
            if (isSyncing)
            {
                MessageBox.Show("A sync is already in progress. Please wait for it to complete.", "Sync Busy", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            if (!IsPrimary())
            {
                string msg = config.IsStandby
                    ? string.Format("Sync is blocked on this PC.\n\nThis computer ({0}) is in FORCED STANDBY mode.\nTo make this PC primary, uncheck 'Force STANDBY' in the Settings tab and click 'Save Settings'.", Environment.MachineName)
                    : string.Format("Sync is blocked on this PC.\n\nThis computer ({0}) is in STANDBY mode.\nAll database sync operations are handled exclusively by the Primary PC: '{1}'.\n\nIf you want this PC to become the Primary, open the Settings tab and click 'Set Current PC as Primary'.", Environment.MachineName, config.PrimaryPcName);

                MessageBox.Show(
                    msg,
                    "Sync Blocked - Standby Mode",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
                return;
            }

            RunSyncPipeline(true);
        }

        private void RunSyncPipeline(bool manual)
        {
            if (isSyncing) return;
            if (!IsPrimary()) return;
            isSyncing = true;
            btnSyncNow.Enabled = false;

            lblStatusPill.Text = "⚡ SYNCING...";
            lblStatusPill.BackColor = Color.FromArgb(254, 243, 199);
            lblStatusPill.ForeColor = Color.FromArgb(180, 83, 9);
            lblTerminalStatus.Text = "Running Pipeline (0/5)...";
            trayIcon.Text = "SM Flow Sync Agent: Syncing now...";

            Task.Factory.StartNew(() =>
            {
                Stopwatch swTotal = Stopwatch.StartNew();
                string durationStr = "0.0s";
                bool isSuccess = false;
                string failedStepName = null;

                try
                {
                    InvokeAction(() =>
                    {
                        AppendLog("\n=======================================================", ColorBrandNavy);
                        AppendLog(string.Format("   BUSY One-Way Clone & OMS Cloud Synchronizer [{0}]", DateTime.Now.ToString("dd-MM-yyyy HH:mm:ss")), ColorCyan);
                        AppendLog("=======================================================", ColorBrandNavy);
                    });

                    // -------------------------------------------------------------
                    // STEP 1/5: Check Server & Network Connectivity
                    // -------------------------------------------------------------
                    InvokeAction(() => lblTerminalStatus.Text = "Step 1/5: Checking Connectivity...");
                    bool isLocalHost = false;
                    try
                    {
                        if (!string.IsNullOrEmpty(config.SourceDir) &&
                            !config.SourceDir.StartsWith(@"\\") &&
                            Path.IsPathRooted(config.SourceDir))
                        {
                            isLocalHost = true;
                        }
                    }
                    catch { }

                    if (isLocalHost)
                    {
                        InvokeAction(() =>
                        {
                            AppendLog("\n[1/5] Checking Local BUSY Installation...", ColorCyan);
                            AppendLog("      [v] Local BUSY installation detected on this PC.", ColorGreen);
                        });
                    }
                    else
                    {
                        InvokeAction(() => AppendLog(string.Format("\n[1/5] Pinging Server [{0}]...", config.ServerHost), ColorCyan));
                        bool isServerOnline = false;
                        try
                        {
                            using (Ping ping = new Ping())
                            {
                                PingReply reply = ping.Send(config.ServerHost, 1500);
                                isServerOnline = (reply != null && reply.Status == IPStatus.Success);
                            }
                        }
                        catch { }

                        // Fallback: If ICMP ping is blocked by Windows Firewall, test SMB share directly
                        if (!isServerOnline)
                        {
                            try
                            {
                                if (!string.IsNullOrEmpty(config.SourceDir) && Directory.Exists(config.SourceDir))
                                {
                                    isServerOnline = true;
                                }
                            }
                            catch { }
                        }

                        if (!isServerOnline)
                        {
                            failedStepName = "Step 1/5 (Server Offline)";
                            InvokeAction(() => AppendLog("      [x] Server is offline, sleeping, or unreachable.", ColorRose));
                            LogHistoryEntry(string.Format("ERROR: [Step 1/5 Failed] Server [{0}] is offline or unreachable.", config.ServerHost), swTotal.Elapsed);
                            return;
                        }
                        InvokeAction(() => AppendLog("      [v] Server is ONLINE and reachable.", ColorGreen));
                    }

                    // -------------------------------------------------------------
                    // STEP 2/5: BUSY Master Database Files Verification
                    // -------------------------------------------------------------
                    InvokeAction(() => lblTerminalStatus.Text = "Step 2/5: Verifying Master Database...");
                    InvokeAction(() => AppendLog("\n[2/5] Checking Shared Database Files...", ColorCyan));
                    string masterDb = Path.Combine(config.SourceDir, "db.bds");
                    if (!File.Exists(masterDb))
                    {
                        failedStepName = "Step 2/5 (Database Missing)";
                        InvokeAction(() => AppendLog("      [x] Master database file (db.bds) not found in: " + config.SourceDir, ColorRose));
                        LogHistoryEntry(string.Format("ERROR: [Step 2/5 Failed] db.bds not found in {0}", config.SourceDir), swTotal.Elapsed);
                        return;
                    }
                    InvokeAction(() => AppendLog("      [v] Found master database files on server.", ColorGreen));

                    // Ensure destination clone folder exists
                    if (!Directory.Exists(config.DestDir))
                    {
                        Directory.CreateDirectory(config.DestDir);
                    }

                    // -------------------------------------------------------------
                    // STEP 3/5: Robocopy One-Way Mirror
                    // -------------------------------------------------------------
                    InvokeAction(() => lblTerminalStatus.Text = "Step 3/5: Mirroring Local Clone...");
                    InvokeAction(() =>
                    {
                        AppendLog("\n[3/5] Mirroring to Local Clone (Robocopy):", ColorCyan);
                        AppendLog("-------------------------------------------------------", ColorBorder);
                    });

                    Stopwatch swRobo = Stopwatch.StartNew();
                    int copiedCount = 0;
                    int uptodateCount = 0;

                    ProcessStartInfo psiRobo = new ProcessStartInfo();
                    psiRobo.FileName = "robocopy.exe";
                    psiRobo.Arguments = string.Format("\"{0}\" \"{1}\" db*.bds /J /XO /R:2 /W:2 /NDL /NJH /NJS", config.SourceDir, config.DestDir);
                    psiRobo.UseShellExecute = false;
                    psiRobo.CreateNoWindow = true;
                    psiRobo.RedirectStandardOutput = true;
                    psiRobo.RedirectStandardError = true;

                    int roboExitCode = 0;
                    using (Process pRobo = Process.Start(psiRobo))
                    {
                        StringBuilder sb = new StringBuilder();
                        char[] buf = new char[128];
                        int read;
                        string currentFile = "database files";
                        int lastReportedPct = -1;

                        while ((read = pRobo.StandardOutput.Read(buf, 0, buf.Length)) > 0)
                        {
                            for (int ci = 0; ci < read; ci++)
                            {
                                char c = buf[ci];
                                if (c == '\r' || c == '\n')
                                {
                                    string token = sb.ToString().Trim();
                                    sb.Length = 0;
                                    if (string.IsNullOrEmpty(token)) continue;

                                    if (token.IndexOf("db", StringComparison.OrdinalIgnoreCase) >= 0)
                                    {
                                        int dbIdx = token.IndexOf("db", StringComparison.OrdinalIgnoreCase);
                                        string fName = token.Substring(dbIdx).Split(' ', '\t')[0];
                                        currentFile = Path.GetFileName(fName);
                                        lastReportedPct = -1;

                                        if (token.IndexOf("Newer", StringComparison.OrdinalIgnoreCase) >= 0 || token.IndexOf("New File", StringComparison.OrdinalIgnoreCase) >= 0)
                                        {
                                            copiedCount++;
                                            string t = token;
                                            InvokeAction(() => AppendLog("      [*] Transferring " + t + "...", ColorCyan));
                                        }
                                        else
                                        {
                                            uptodateCount++;
                                            string t = token;
                                            InvokeAction(() => AppendLog("      [v] " + t + " (Up to date)", ColorGreen));
                                        }
                                    }

                                    Match m = Regex.Match(token, @"(\d+(\.\d+)?)\s*%", RegexOptions.RightToLeft);
                                    if (m.Success)
                                    {
                                        double pVal;
                                        if (double.TryParse(m.Groups[1].Value, out pVal))
                                        {
                                            int intP = (int)pVal;
                                            if (intP != lastReportedPct && (intP % 20 == 0 || intP == 100))
                                            {
                                                lastReportedPct = intP;
                                                string f = currentFile;
                                                InvokeAction(() =>
                                                {
                                                    lblTerminalStatus.Text = string.Format("Mirroring {0}: {1}%", f, intP);
                                                    AppendLog(string.Format("      --> {0}: {1}% copied...", f, intP), ColorTerminalText);
                                                });
                                            }
                                        }
                                    }
                                }
                                else
                                {
                                    sb.Append(c);
                                }
                            }
                        }
                        pRobo.WaitForExit();
                        roboExitCode = pRobo.ExitCode;
                    }
                    swRobo.Stop();

                    // Robocopy exit code >= 8 means error occurred
                    if (roboExitCode >= 8)
                    {
                        failedStepName = "Step 3/5 (Robocopy Error)";
                        InvokeAction(() => AppendLog(string.Format("      [x] Robocopy mirroring failed with error code {0}.", roboExitCode), ColorRose));
                        LogHistoryEntry(string.Format("ERROR: [Step 3/5 Failed] Mirroring failed (Robocopy error code {0}).", roboExitCode), swTotal.Elapsed);
                        return;
                    }

                    InvokeAction(() =>
                    {
                        AppendLog("-------------------------------------------------------", ColorBorder);
                        AppendLog(string.Format("      [v] Mirror completed in {0:F1}s: {1} file(s) updated, {2} up to date.", swRobo.Elapsed.TotalSeconds, copiedCount, uptodateCount), ColorGreen);
                    });

                    // -------------------------------------------------------------
                    // STEP 4/5: Extract Operational Catalog from Local Clone
                    // -------------------------------------------------------------
                    InvokeAction(() => lblTerminalStatus.Text = "Step 4/5: Extracting Catalog...");
                    InvokeAction(() => AppendLog("\n[4/5] Extracting Operational Catalog from Local Clone...", ColorCyan));

                    Stopwatch swExt = Stopwatch.StartNew();
                    string extractScript = GetScriptPath("extract_busy_clone.ps1");
                    string workDir = GetScriptsWorkingDir();

                    // Determine optimal PowerShell engine (Auto-detect 64-bit vs 32-bit OLEDB environment)
                    string psExe = "powershell.exe";
                    string sysWow64Ps = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "SysWOW64", "WindowsPowerShell", "v1.0", "powershell.exe");

                    bool has64BitAce = false;
                    try
                    {
                        using (Microsoft.Win32.RegistryKey k = Microsoft.Win32.Registry.ClassesRoot.OpenSubKey("Microsoft.ACE.OLEDB.12.0") ?? 
                                                              Microsoft.Win32.Registry.ClassesRoot.OpenSubKey("Microsoft.ACE.OLEDB.16.0"))
                        {
                            if (k != null) has64BitAce = true;
                        }
                    }
                    catch { }

                    if (!has64BitAce && File.Exists(sysWow64Ps))
                    {
                        psExe = sysWow64Ps;
                        InvokeAction(() => AppendLog("      [i] 32-bit Office/Jet environment detected. Using 32-bit PowerShell engine.", ColorAmber));
                    }

                    ProcessStartInfo psiExt = new ProcessStartInfo();
                    psiExt.FileName = psExe;
                    psiExt.Arguments = string.Format("-ExecutionPolicy Bypass -File \"{0}\" -CloneDir \"{1}\"", extractScript, config.DestDir);
                    psiExt.WorkingDirectory = workDir;
                    psiExt.UseShellExecute = false;
                    psiExt.CreateNoWindow = true;
                    psiExt.RedirectStandardOutput = true;
                    psiExt.RedirectStandardError = true;

                    int extExitCode = 0;
                    string firstExtError = null;

                    using (Process pExt = Process.Start(psiExt))
                    {
                        string line;
                        while ((line = pExt.StandardOutput.ReadLine()) != null)
                        {
                            string l = line;
                            InvokeAction(() => AppendLog("      " + l, ColorTerminalText));
                        }
                        string errLine;
                        while ((errLine = pExt.StandardError.ReadLine()) != null)
                        {
                            string el = errLine;
                            if (string.IsNullOrEmpty(firstExtError) && !string.IsNullOrWhiteSpace(el))
                            {
                                firstExtError = el.Trim();
                            }
                            InvokeAction(() => AppendLog("      [!] " + el, ColorRose));
                        }
                        pExt.WaitForExit();
                        extExitCode = pExt.ExitCode;
                    }

                    // Seamless Fallback: If 64-bit failed with an OLEDB driver error, automatically retry in 32-bit PowerShell
                    if (extExitCode != 0 && psExe != sysWow64Ps && File.Exists(sysWow64Ps))
                    {
                        InvokeAction(() => AppendLog("      [!] 64-bit engine failed. Seamlessly retrying with 32-bit engine...", ColorAmber));
                        firstExtError = null;
                        ProcessStartInfo psiRetry = new ProcessStartInfo();
                        psiRetry.FileName = sysWow64Ps;
                        psiRetry.Arguments = string.Format("-ExecutionPolicy Bypass -File \"{0}\" -CloneDir \"{1}\"", extractScript, config.DestDir);
                        psiRetry.WorkingDirectory = workDir;
                        psiRetry.UseShellExecute = false;
                        psiRetry.CreateNoWindow = true;
                        psiRetry.RedirectStandardOutput = true;
                        psiRetry.RedirectStandardError = true;

                        using (Process pRetry = Process.Start(psiRetry))
                        {
                            string line;
                            while ((line = pRetry.StandardOutput.ReadLine()) != null)
                            {
                                string l = line;
                                InvokeAction(() => AppendLog("      " + l, ColorTerminalText));
                            }
                            string errLine;
                            while ((errLine = pRetry.StandardError.ReadLine()) != null)
                            {
                                string el = errLine;
                                if (string.IsNullOrEmpty(firstExtError) && !string.IsNullOrWhiteSpace(el))
                                {
                                    firstExtError = el.Trim();
                                }
                                InvokeAction(() => AppendLog("      [!] " + el, ColorRose));
                            }
                            pRetry.WaitForExit();
                            extExitCode = pRetry.ExitCode;
                        }
                    }

                    swExt.Stop();

                    if (extExitCode != 0)
                    {
                        failedStepName = "Step 4/5 (Extraction Error)";
                        string errMsg = firstExtError ?? string.Format("Exit code {0}", extExitCode);
                        InvokeAction(() => AppendLog("      [x] Extraction failed: " + errMsg, ColorRose));
                        LogHistoryEntry(string.Format("ERROR: [Step 4/5 Failed] Extraction failed: {0}", errMsg), swTotal.Elapsed);
                        return;
                    }

                    string payloadPath = Path.Combine(workDir, "busy_sync_payload.json");
                    if (!File.Exists(payloadPath))
                    {
                        failedStepName = "Step 4/5 (Payload Missing)";
                        InvokeAction(() => AppendLog("      [x] Extraction completed but busy_sync_payload.json was not generated.", ColorRose));
                        LogHistoryEntry("ERROR: [Step 4/5 Failed] busy_sync_payload.json missing.", swTotal.Elapsed);
                        return;
                    }
                    InvokeAction(() => AppendLog(string.Format("      [v] Catalog extracted in {0:F1}s", swExt.Elapsed.TotalSeconds), ColorGreen));

                    // -------------------------------------------------------------
                    // STEP 5/5: Upload Updates to OMS Cloud (Supabase PostgreSQL)
                    // -------------------------------------------------------------
                    InvokeAction(() => lblTerminalStatus.Text = "Step 5/5: Uploading to Cloud...");
                    InvokeAction(() => AppendLog("\n[5/5] Uploading Updates to OMS Cloud (Supabase)...", ColorCyan));

                    Stopwatch swSync = Stopwatch.StartNew();
                    string syncScript = GetScriptPath("sync_busy_to_supabase.cjs");
                    string appDir = AppDomain.CurrentDomain.BaseDirectory;
                    string nodeExe = "node.exe";
                    string localNode = Path.Combine(appDir, "node.exe");
                    if (File.Exists(localNode))
                    {
                        nodeExe = localNode;
                    }

                    ProcessStartInfo psiSync = new ProcessStartInfo();
                    psiSync.FileName = nodeExe;
                    psiSync.Arguments = string.Format("\"{0}\"", syncScript);
                    psiSync.WorkingDirectory = workDir;
                    psiSync.UseShellExecute = false;
                    psiSync.CreateNoWindow = true;
                    psiSync.RedirectStandardOutput = true;
                    psiSync.RedirectStandardError = true;

                    int syncExitCode = 0;
                    bool hasSyncError = false;
                    string firstSyncError = null;

                    try
                    {
                        using (Process pSync = Process.Start(psiSync))
                        {
                            string line;
                            while ((line = pSync.StandardOutput.ReadLine()) != null)
                            {
                                string l = line;
                                InvokeAction(() =>
                                {
                                    if (l.Contains("FINISH") || l.Contains("SUCCESS"))
                                    {
                                        AppendLog("      " + l, ColorGreen);
                                    }
                                    else if (l.Contains("ERROR") || l.Contains("Exception") || l.Contains("FAILED"))
                                    {
                                        hasSyncError = true;
                                        if (string.IsNullOrEmpty(firstSyncError)) firstSyncError = l.Trim();
                                        AppendLog("      " + l, ColorRose);
                                    }
                                    else
                                    {
                                        AppendLog("      " + l, ColorTerminalText);
                                    }
                                });
                            }

                            string errLine;
                            while ((errLine = pSync.StandardError.ReadLine()) != null)
                            {
                                string el = errLine;
                                hasSyncError = true;
                                if (string.IsNullOrEmpty(firstSyncError) && !string.IsNullOrWhiteSpace(el))
                                {
                                    firstSyncError = el.Trim();
                                }
                                InvokeAction(() => AppendLog("      [!] " + el, ColorRose));
                            }

                            pSync.WaitForExit();
                            syncExitCode = pSync.ExitCode;
                        }
                        swSync.Stop();

                        if (syncExitCode != 0 || hasSyncError)
                        {
                            failedStepName = "Step 5/5 (Cloud Upload Error)";
                            string errMsg = firstSyncError ?? string.Format("Exit code {0}", syncExitCode);
                            InvokeAction(() => AppendLog("      [x] OMS Cloud upload failed: " + errMsg, ColorRose));
                            LogHistoryEntry(string.Format("ERROR: [Step 5/5 Failed] Cloud upload failed: {0}", errMsg), swTotal.Elapsed);
                            return;
                        }

                        InvokeAction(() => AppendLog(string.Format("      [v] OMS Cloud updated in {0:F1}s", swSync.Elapsed.TotalSeconds), ColorGreen));
                    }
                    catch (System.ComponentModel.Win32Exception)
                    {
                        swSync.Stop();
                        failedStepName = "Step 5/5 (Node.js Missing)";
                        InvokeAction(() => AppendLog("      [x] Node.js runtime not found on this computer. Please install Node.js (https://nodejs.org) or place node.exe in this agent folder.", ColorRose));
                        LogHistoryEntry("ERROR: [Step 5/5 Failed] Node.js runtime not found on this computer.", swTotal.Elapsed);
                        return;
                    }

                    // -------------------------------------------------------------
                    // ALL 5/5 STEPS COMPLETED SUCCESSFULLY!
                    // -------------------------------------------------------------
                    isSuccess = true;
                    durationStr = string.Format("{0:F2}s", swTotal.Elapsed.TotalSeconds);

                    string successSummary = string.Format("SUCCESS: All 5/5 steps completed successfully. Local clone & OMS Cloud 100% synchronized. (Copied: {0}, Extract: {1:F1}s, Sync: {2:F1}s)", copiedCount, swExt.Elapsed.TotalSeconds, swSync.Elapsed.TotalSeconds);
                    LogHistoryEntry(successSummary, swTotal.Elapsed);

                    InvokeAction(() =>
                    {
                        AppendLog("\n=======================================================", ColorBrandNavy);
                        AppendLog("  [v] All 5/5 steps completed successfully!", ColorGreen);
                        AppendLog(string.Format("  Total Pipeline Execution Time: {0}", durationStr), ColorGreen);
                        AppendLog("=======================================================\n", ColorBrandNavy);
                    });
                }
                catch (Exception ex)
                {
                    failedStepName = "Pipeline Exception";
                    InvokeAction(() => AppendLog("\n[x] Pipeline Exception: " + ex.Message, ColorRose));
                    LogHistoryEntry("ERROR: Pipeline Exception: " + ex.Message, swTotal.Elapsed);
                }
                finally
                {
                    swTotal.Stop();
                    durationStr = string.Format("{0:F2}s", swTotal.Elapsed.TotalSeconds);
                    InvokeAction(() =>
                    {
                        isSyncing = false;
                        btnSyncNow.Enabled = true;

                        if (isSuccess)
                        {
                            lastSyncTime = DateTime.Now;
                            lblStatLastSync.Text = string.Format("Last Synced: {0:hh:mm:ss tt}", lastSyncTime);
                            lblStatusPill.Text = "● PRIMARY (ACTIVE)";
                            lblStatusPill.BackColor = Color.FromArgb(236, 253, 245);
                            lblStatusPill.ForeColor = Color.FromArgb(4, 120, 87);
                            lblTerminalStatus.Text = "Completed (5/5 Steps OK)";
                            trayIcon.Text = "SM Flow Sync Agent: All 5/5 Steps Synchronized";
                        }
                        else
                        {
                            lblStatusPill.Text = string.Format("● FAILED ({0})", failedStepName ?? "Error");
                            lblStatusPill.BackColor = Color.FromArgb(254, 226, 226);
                            lblStatusPill.ForeColor = Color.FromArgb(185, 28, 28);
                            lblTerminalStatus.Text = "Failed: " + (failedStepName ?? "Error");
                            trayIcon.Text = string.Format("SM Flow Sync Agent: Failed ({0})", failedStepName ?? "Error");
                        }

                        if (config.IntervalMinutes > 0 && IsPrimary())
                        {
                            nextSyncTime = CalculateNextAlignedTime(config.IntervalMinutes);
                        }
                        lblStatDuration.Text = "Duration: " + durationStr;
                        LoadHistory();
                    });
                }
            });
        }

        private string GetEffectiveLogFile()
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string localLog = Path.Combine(appDir, "sync_history.log");
            if (File.Exists(localLog)) return localLog;

            if (!string.IsNullOrEmpty(config.LogFile) && File.Exists(config.LogFile))
            {
                return config.LogFile;
            }

            return localLog;
        }

        private void LogHistoryEntry(string message, TimeSpan duration)
        {
            try
            {
                string entry = string.Format("[{0:dd-MM-yyyy HH:mm:ss.ff}] {1} (Execution time: {2:F2}s)\n", DateTime.Now, message, duration.TotalSeconds);
                string logPath = GetEffectiveLogFile();
                File.AppendAllText(logPath, entry, Encoding.UTF8);

                // Also keep a backup copy in Clone folder if exists
                try
                {
                    if (!string.IsNullOrEmpty(config.DestDir) && Directory.Exists(config.DestDir))
                    {
                        string cloneLog = Path.Combine(config.DestDir, "sync_history.log");
                        if (!string.Equals(Path.GetFullPath(logPath), Path.GetFullPath(cloneLog), StringComparison.OrdinalIgnoreCase))
                        {
                            File.AppendAllText(cloneLog, entry, Encoding.UTF8);
                        }
                    }
                }
                catch { }
            }
            catch { }
        }

        // =====================================================================
        // LOGGING & TERMINAL OUTPUT
        // =========================================================================
        private void AppendLog(string text, Color color)
        {
            if (rtbTerminal.IsDisposed) return;
            rtbTerminal.SelectionStart = rtbTerminal.TextLength;
            rtbTerminal.SelectionLength = 0;
            rtbTerminal.SelectionColor = color;
            rtbTerminal.AppendText(text + "\n");
            rtbTerminal.SelectionColor = rtbTerminal.ForeColor;
            rtbTerminal.ScrollToCaret();
        }

        private void LoadHistory()
        {
            try
            {
                string logPath = GetEffectiveLogFile();
                if (!File.Exists(logPath)) return;
                string[] lines = File.ReadAllLines(logPath, Encoding.UTF8);
                lvHistory.Items.Clear();

                // Read last 150 entries in reverse order
                for (int i = lines.Length - 1; i >= 0 && lvHistory.Items.Count < 100; i--)
                {
                    string l = lines[i].Trim();
                    if (string.IsNullOrEmpty(l) || !l.StartsWith("[")) continue;

                    int closeBracket = l.IndexOf(']');
                    if (closeBracket <= 1) continue;

                    string timestamp = l.Substring(1, closeBracket - 1);
                    string rest = l.Substring(closeBracket + 1).Trim();

                    string status = "INFO";
                    Color rowColor = ColorTextPrimary;

                    if (rest.StartsWith("SUCCESS", StringComparison.OrdinalIgnoreCase))
                    {
                        status = "5/5 OK";
                        rowColor = Color.FromArgb(4, 120, 87);
                    }
                    else if (rest.StartsWith("SKIP", StringComparison.OrdinalIgnoreCase))
                    {
                        status = "SKIPPED";
                        rowColor = Color.FromArgb(180, 83, 9);
                    }
                    else if (rest.StartsWith("ERROR", StringComparison.OrdinalIgnoreCase))
                    {
                        status = "FAILED";
                        rowColor = Color.FromArgb(190, 18, 60);
                    }

                    string duration = "--";
                    int durIdx = rest.LastIndexOf("(Execution time:", StringComparison.OrdinalIgnoreCase);
                    if (durIdx >= 0)
                    {
                        int endParen = rest.IndexOf(')', durIdx);
                        if (endParen > durIdx)
                        {
                            duration = rest.Substring(durIdx + 16, endParen - (durIdx + 16)).Trim();
                            rest = rest.Substring(0, durIdx).Trim();
                        }
                    }

                    ListViewItem item = new ListViewItem(timestamp);
                    item.ForeColor = rowColor;
                    item.UseItemStyleForSubItems = true;
                    item.SubItems.Add(status);
                    item.SubItems.Add(duration);
                    item.SubItems.Add(rest);
                    lvHistory.Items.Add(item);
                }
            }
            catch { }
        }

        private void OpenLogFile()
        {
            try
            {
                string logPath = GetEffectiveLogFile();
                if (File.Exists(logPath))
                {
                    Process.Start("notepad.exe", string.Format("\"{0}\"", logPath));
                }
                else
                {
                    MessageBox.Show("Log file does not exist yet at:\n" + logPath, "Log Not Found", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Could not open log file: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void InvokeAction(Action act)
        {
            if (this.IsDisposed) return;
            if (this.InvokeRequired) this.Invoke(act);
            else act();
        }

        private string GetScriptsWorkingDir()
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string localScripts = Path.Combine(appDir, "scripts");
            if (Directory.Exists(localScripts) && File.Exists(Path.Combine(localScripts, "extract_busy_clone.ps1")))
            {
                return appDir;
            }

            if (!string.IsNullOrEmpty(config.ProjectDir) && Directory.Exists(config.ProjectDir))
            {
                return config.ProjectDir;
            }

            return appDir;
        }

        private string GetScriptPath(string scriptName)
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string localScript = Path.Combine(appDir, "scripts", scriptName);
            if (File.Exists(localScript)) return localScript;

            if (!string.IsNullOrEmpty(config.ProjectDir))
            {
                string projScript = Path.Combine(config.ProjectDir, "scripts", scriptName);
                if (File.Exists(projScript)) return projScript;
            }

            return localScript;
        }

        // =====================================================================
        // ICON GENERATION (In-Memory Crisp Glyph Icon)
        // =========================================================================
        private static Icon CreateAppIcon(Color accentColor)
        {
            using (Bitmap bmp = new Bitmap(32, 32))
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.Clear(Color.Transparent);

                // Rounded navy background
                using (GraphicsPath path = new GraphicsPath())
                {
                    path.AddArc(1, 1, 8, 8, 180, 90);
                    path.AddArc(23, 1, 8, 8, 270, 90);
                    path.AddArc(23, 23, 8, 8, 0, 90);
                    path.AddArc(1, 23, 8, 8, 90, 90);
                    path.CloseFigure();

                    using (SolidBrush b = new SolidBrush(ColorBrandNavy))
                    {
                        g.FillPath(b, path);
                    }
                    using (Pen p = new Pen(Color.FromArgb(56, 189, 248), 1.5f))
                    {
                        g.DrawPath(p, path);
                    }
                }

                // Letters "SM"
                using (Font f = new Font("Segoe UI", 10F, FontStyle.Bold, GraphicsUnit.Point))
                using (SolidBrush textBrush = new SolidBrush(Color.White))
                {
                    StringFormat sf = new StringFormat();
                    sf.Alignment = StringAlignment.Center;
                    sf.LineAlignment = StringAlignment.Center;
                    g.DrawString("SM", f, textBrush, new RectangleF(1, 3, 30, 24), sf);
                }

                // Status dot at bottom right
                using (SolidBrush dotBrush = new SolidBrush(accentColor))
                {
                    g.FillEllipse(dotBrush, 21, 21, 8, 8);
                }
                using (Pen dotPen = new Pen(Color.White, 1.2f))
                {
                    g.DrawEllipse(dotPen, 21, 21, 8, 8);
                }

                return Icon.FromHandle(bmp.GetHicon());
            }
        }
    }
}
