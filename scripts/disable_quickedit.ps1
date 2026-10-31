Add-Type @"
using System;
using System.Runtime.InteropServices;
public class QuickEditHelper {
    [DllImport("kernel32.dll")] public static extern IntPtr GetStdHandle(int n);
    [DllImport("kernel32.dll")] public static extern bool GetConsoleMode(IntPtr h, out uint m);
    [DllImport("kernel32.dll")] public static extern bool SetConsoleMode(IntPtr h, uint m);
    public static void Disable() {
        IntPtr h = GetStdHandle(-10);
        uint m;
        if (GetConsoleMode(h, out m)) {
            m &= ~0x0040u;
            m |= 0x0080u;
            SetConsoleMode(h, m);
        }
    }
}
"@
try {
    [QuickEditHelper]::Disable()
} catch {}
