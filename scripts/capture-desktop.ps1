param(
    [string]$outFile = "out/desktop.png",
    [int]$width = 1920,
    [int]$height = 1080,
    [switch]$keepMaximized
)

Add-Type @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Threading;
using System.Text;

public class NativeDesktopCapture {
    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll", SetLastError = true)]
    static extern IntPtr CreateCompatibleDC(IntPtr hDC);

    [DllImport("gdi32.dll", SetLastError = true)]
    static extern IntPtr CreateCompatibleBitmap(IntPtr hDC, int nWidth, int nHeight);

    [DllImport("gdi32.dll", SetLastError = true)]
    static extern IntPtr SelectObject(IntPtr hDC, IntPtr hObject);

    [DllImport("gdi32.dll", SetLastError = true)]
    static extern bool BitBlt(IntPtr hObject, int nXDest, int nYDest, int nWidth, int nHeight, IntPtr hObjectSource, int nXSrc, int nYSrc, int dwRop);

    [DllImport("gdi32.dll", SetLastError = true)]
    static extern bool DeleteDC(IntPtr hDC);

    [DllImport("gdi32.dll", SetLastError = true)]
    static extern bool DeleteObject(IntPtr hObject);

    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc f, IntPtr l);
    public delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int m);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);

    const int SRCCOPY = 0x00CC0020;
    const int CAPTUREBLT = 0x40000000;
    const uint DESKTOP_ALL = 0x01FF;

    public static string Capture(string outPath, int w, int h, bool keepMaximized) {
        string result = "";
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenInputDesktop(0, false, DESKTOP_ALL);
            if (hDesk != IntPtr.Zero) {
                SetThreadDesktop(hDesk);
            }

            IntPtr orbitoHwnd = IntPtr.Zero;

            // Minimize all non-Orbito windows so real wallpaper is exposed around Orbito
            EnumWindows((hWnd, lParam) => {
                if (IsWindowVisible(hWnd)) {
                    StringBuilder sb = new StringBuilder(256);
                    GetWindowText(hWnd, sb, 256);
                    string title = sb.ToString();
                    if (!string.IsNullOrWhiteSpace(title) && !title.Contains("Program Manager") && !title.Contains("Windows Input Experience")) {
                        if (title.StartsWith("Orbito", StringComparison.OrdinalIgnoreCase)) {
                            orbitoHwnd = hWnd;
                        } else {
                            ShowWindow(hWnd, 6); // SW_MINIMIZE
                        }
                    }
                }
                return true;
            }, IntPtr.Zero);

            if (orbitoHwnd != IntPtr.Zero) {
                if (keepMaximized) {
                    ShowWindow(orbitoHwnd, 3); // SW_MAXIMIZE
                } else {
                    ShowWindow(orbitoHwnd, 9); // SW_RESTORE
                    SetWindowPos(orbitoHwnd, new IntPtr(-1), 320, 140, 1280, 800, 0x0040);
                }
                SetForegroundWindow(orbitoHwnd);
                BringWindowToTop(orbitoHwnd);
            }

            Thread.Sleep(1200);

            IntPtr hDeskDC = GetDC(IntPtr.Zero);
            if (hDeskDC == IntPtr.Zero) {
                result = "GetDC failed: " + Marshal.GetLastWin32Error();
                if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
                return;
            }

            IntPtr hMemDC = CreateCompatibleDC(hDeskDC);
            IntPtr hBmp = CreateCompatibleBitmap(hDeskDC, w, h);
            IntPtr hOld = SelectObject(hMemDC, hBmp);

            bool blt = BitBlt(hMemDC, 0, 0, w, h, hDeskDC, 0, 0, SRCCOPY | CAPTUREBLT);
            int bltErr = Marshal.GetLastWin32Error();

            SelectObject(hMemDC, hOld);

            if (blt) {
                if (System.IO.File.Exists(outPath)) {
                    try { System.IO.File.Delete(outPath); } catch {}
                }
                using (Bitmap bmp = Image.FromHbitmap(hBmp)) {
                    bmp.Save(outPath, ImageFormat.Png);
                }
                result = "SUCCESS!";
            } else {
                result = "BitBlt failed: " + bltErr;
            }

            DeleteObject(hBmp);
            DeleteDC(hMemDC);
            ReleaseDC(IntPtr.Zero, hDeskDC);
            if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
        });

        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
        return result;
    }
}
'@ -ReferencedAssemblies System.Drawing

$dir = [System.IO.Path]::GetDirectoryName($outFile)
if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

$res = [NativeDesktopCapture]::Capture($outFile, $width, $height, [bool]$keepMaximized)
Write-Output $res
