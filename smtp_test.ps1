param([string]$TargetIP = "117.240.74.196", [int]$TargetPort = 25)

Write-Host "=== SMTP Banner Test: $TargetIP`:$TargetPort ===" -ForegroundColor Cyan
$tcp = New-Object System.Net.Sockets.TcpClient
$tcp.ReceiveTimeout = 20000
$tcp.SendTimeout = 20000
$startTime = Get-Date
try {
    $tcp.Connect($TargetIP, $TargetPort)
    $connectTime = ((Get-Date) - $startTime).TotalMilliseconds
    Write-Host "TCP connected in $connectTime ms" -ForegroundColor Green
    $stream = $tcp.GetStream()
    $stream.ReadTimeout = 20000
    $buf = New-Object byte[] 4096
    try {
        $n = $stream.Read($buf, 0, 4096)
        if ($n -gt 0) {
            $banner = [System.Text.Encoding]::ASCII.GetString($buf, 0, $n)
            Write-Host "BANNER RECEIVED ($n bytes):" -ForegroundColor Green
            Write-Host $banner
        } else {
            Write-Host "Connection closed, 0 bytes received (TARPIT behavior)" -ForegroundColor Red
        }
    } catch [System.IO.IOException] {
        Write-Host "Read timeout - no banner within 20 seconds" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)"
    }
    $tcp.Close()
} catch {
    Write-Host "Connection FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
