# Gửi nguyên dữ liệu ESC/POS (không qua driver) tới một máy in đã cài trong Windows, ví dụ "Uniwell".
# Dùng: powershell -NoProfile -ExecutionPolicy Bypass -File raw-print.ps1 -Printer "Uniwell" -File "C:\...\bill.bin"
param([string]$Printer, [string]$File)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFOW {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)] public static extern bool OpenPrinter(string src, out IntPtr h, IntPtr pd);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)] public static extern bool StartDocPrinter(IntPtr h, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW di);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool WritePrinter(IntPtr h, IntPtr pBytes, int count, out int written);
  public static bool SendBytes(string printer, byte[] bytes) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) return false;
    bool ok = false;
    var di = new DOCINFOW { pDocName = "Bill", pDataType = "RAW" };
    if (StartDocPrinter(h, 1, di)) {
      if (StartPagePrinter(h)) {
        IntPtr p = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, p, bytes.Length);
        int written;
        ok = WritePrinter(h, p, bytes.Length, out written) && written == bytes.Length;
        Marshal.FreeCoTaskMem(p);
        EndPagePrinter(h);
      }
      EndDocPrinter(h);
    }
    ClosePrinter(h);
    return ok;
  }
}
"@

if (-not [RawPrinterHelper]::SendBytes($Printer, [IO.File]::ReadAllBytes($File))) {
  Write-Error "Không gửi được tới máy in '$Printer'"
  exit 1
}
