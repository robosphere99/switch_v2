<#
.SYNOPSIS
  SwitchNest API ke duplicate/stale instances cleanup - sirf EK canonical
  instance (port 4000 ka listener) rakhne ke liye.

.DESCRIPTION
  start-dev.bat / start-api.bat baar-baar chalane se kai npm/tsx/node
  processes bante hain. Port 4000 pe sirf EK bind ho pata hai; baaki
  instances EADDRINUSE ke bawajood zinda reh kar heartbeat / scheduler /
  leak-monitor chalaate rehte hain (memory xN, duplicate incidents, log
  bloat).

  Yeh script:
    * port 4000 ka listener (canonical) dhundhta hai
    * canonical ke ancestors (uske npm/cmd/tsx parents) ko PROTECT karta hai
    * baaki saare API-related processes (npm run dev:api / tsx watch /
      src/index.ts / dist/index.mjs) ko tree-sahit (CIM tree + Stop-Process)
      maar deta hai - taskkill /T hidden-console pe hang hota hai, isliye
      har PID individually
    * Web (vite/5173), MySQL, Apache ko kabhi nahi chhedta
    * Safety: kisi bhi target ke subtree me canonical mila to usse skip
      karta hai (galat parent map se canonical kabhi nahi marta)

.PARAMETER DryRun
  Sirf report karta hai - kuch kill nahi karta.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\fix-api-instances.ps1 -DryRun
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\fix-api-instances.ps1

.NOTES
  SwitchNest-specific patterns (dev:api / @robosphere/api / src|dist index)
  se match karta hai. Kanonical (port 4000) + uske parents kabhi nahi marte;
  baaki copies (xampp wale) ke stale instances bhi clean ho jate hain.
#>
param([switch]$DryRun)

$ErrorActionPreference = 'SilentlyContinue'

# API-related command-line patterns (normalized cmd ke against, literal match).
# Site-path check NAHI rakha — start-api.bat `node dist\index.mjs` RELATIVE path
# se chalta hai, isliye sirf patterns hi kaafi hain. Patterns SwitchNest-specific
# hain (dev:api / @robosphere/api / src|dist index). Web (vite/dev:web), MySQL,
# Apache kisi pattern se match nahi hote.
$apiPatterns = @(
  'site/apps/api',
  'src/index.ts',
  'dist/index.mjs',
  'dev:api',
  'dev -w @robosphere/api',
  'watch src/index.ts'
)

# ---- 1) Saare node + cmd processes + parent map ----
$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='cmd.exe'"
$pidMap = @{}
$childrenMap = @{}
foreach ($p in $procs) {
  $procId = [int]$p.ProcessId
  $ppid = [int]$p.ParentProcessId
  $pidMap[$procId] = $ppid
  if (-not $childrenMap.ContainsKey($ppid)) { $childrenMap[$ppid] = @() }
  $childrenMap[$ppid] += $procId
}

# ---- 2) API-related processes (pattern match) ----
$apiProcs = @()
foreach ($p in $procs) {
  $cmd = [string]$p.CommandLine
  if (-not $cmd) { continue }
  $norm = ($cmd -replace '\\', '/')
  $isApi = $false
  foreach ($pat in $apiPatterns) {
    if ($norm -match [regex]::Escape($pat)) { $isApi = $true; break }
  }
  if ($isApi) {
    $apiProcs += [pscustomobject]@{ Pid = [int]$p.ProcessId; PPid = [int]$p.ParentProcessId; Name = $p.Name; Cmd = $cmd }
  }
}

# ---- 3) Canonical = port 4000 ka listener ----
$canon = $null
$conn = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) { $canon = [int]$conn.OwningProcess }

if (-not $canon) {
  Write-Host "Port 4000 pe koi API listener nahi hai (canonical instance nahi mila)." -ForegroundColor Yellow
  Write-Host "Cleanup ke liye kuch nahi - pehle start-dev.bat / start-api.bat se API chalao." -ForegroundColor Yellow
  exit 0
}

if (-not ($apiProcs | Where-Object { $_.Pid -eq $canon })) {
  Write-Host "Port 4000 ka owner (PID $canon) is project ka API nahi lag raha - kuch nahi maarenge (safety)." -ForegroundColor Red
  exit 1
}

# ---- 4) Canonical ke ancestors protect (cmd/npm/tsx chain) ----
$protected = @{}
$cur = $canon
for ($i = 0; $i -lt 30 -and $cur -and $cur -ne 0; $i++) {
  $protected[$cur] = $true
  if (-not $pidMap.ContainsKey($cur)) { break }
  $cur = $pidMap[$cur]
}

# ---- 5) Kill targets (canonical + ancestors ko chhodkar) ----
$targets = @($apiProcs | Where-Object { $_.Pid -ne $canon -and -not $protected.ContainsKey($_.Pid) })

Write-Host ""
Write-Host ("Canonical API instance : PID {0} (port 4000 listener)" -f $canon) -ForegroundColor Green
$chain = @()
$cur = $canon
for ($i = 0; $i -lt 30 -and $cur -and $cur -ne 0; $i++) {
  $chain += $cur
  if (-not $pidMap.ContainsKey($cur)) { break }
  $cur = $pidMap[$cur]
}
Write-Host ("Protected chain (canonical + parents) : {0}" -f ($chain -join ' -> '))
Write-Host ""

if (-not $targets) {
  Write-Host "Koi duplicate/stale API instance nahi mila - sab saaf." -ForegroundColor Green
  exit 0
}

Write-Host ("Stale/duplicate API processes ({0}):" -f $targets.Count) -ForegroundColor Yellow
foreach ($t in ($targets | Sort-Object Pid)) {
  $cmd = $t.Cmd -replace '\s+', ' '
  if ($cmd.Length -gt 110) { $cmd = $cmd.Substring(0, 110) }
  Write-Host ("  PID {0,-7} [{1}] {2}" -f $t.Pid, $t.Name, $cmd)
}

if ($DryRun) {
  Write-Host ""
  Write-Host "DRY-RUN - kuch kill nahi kiya. Asli cleanup ke liye bina -DryRun chalao." -ForegroundColor Cyan
  exit 0
}

# Safety: kisi bhi target ke subtree me canonical ho to usse skip karo.
# Index-based BFS — $queue[1..0] descending-range dequeue infinite loop deta
# hai (PowerShell quirk), isliye i-index approach use karo.
function Test-SubtreeContainsCanonical($root) {
  $queue = @($root)
  $seen = @{}
  $i = 0
  while ($i -lt $queue.Count) {
    $n = $queue[$i]; $i++
    if ($n -eq $canon) { return $true }
    if ($seen.ContainsKey($n)) { continue }
    $seen[$n] = $true
    foreach ($c in @($childrenMap[$n])) {
      if ($c -eq $canon) { return $true }
      $queue += $c
    }
  }
  return $false
}

# Descendants (childrenMap se) + target ko individually kill karo.
# taskkill /T hidden-console processes pe hang ho jata hai - isliye apna
# CIM tree + Stop-Process (har PID alag, koi tree-mode nahi).
function Get-Descendants($rootPid) {
  $out = @()
  $queue = @($rootPid)
  $seen = @{}
  $i = 0
  while ($i -lt $queue.Count) {
    $n = $queue[$i]; $i++
    if ($seen.ContainsKey($n)) { continue }
    $seen[$n] = $true
    foreach ($c in @($childrenMap[$n])) {
      if (-not $seen.ContainsKey($c)) { $out += $c; $queue += $c }
    }
  }
  return $out
}

$killed = 0
$skipped = @()
foreach ($t in ($targets | Sort-Object Pid)) {
  if (Test-SubtreeContainsCanonical $t.Pid) {
    $skipped += $t.Pid
    Write-Host ("  SKIP PID {0} - subtree me canonical hai (safety guard)" -f $t.Pid) -ForegroundColor DarkYellow
    continue
  }
  $toKill = @(Get-Descendants $t.Pid) + @($t.Pid)
  [array]::Reverse($toKill) # children pehle, parent aakhri me
  Write-Host ("  Killing PID {0} + {1} child(ren) ..." -f $t.Pid, ($toKill.Count - 1)) -ForegroundColor Red
  foreach ($procId in $toKill) {
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }
  $killed++
  Start-Sleep -Milliseconds 300
  if (-not (Get-Process -Id $canon -ErrorAction SilentlyContinue)) {
    Write-Host "  !! Canonical PID $canon mar gaya - ruk raha hoon (watch out!)." -ForegroundColor Red
    exit 1
  }
}

# ---- 6) Verify ----
Start-Sleep -Milliseconds 800
Write-Host ""
if (Get-Process -Id $canon -ErrorAction SilentlyContinue) {
  Write-Host ("Killed: {0} | Skipped: {1}" -f $killed, $skipped.Count) -ForegroundColor Cyan
  Write-Host ("Canonical API (PID {0}) abhi bhi port 4000 pe zinda hai." -f $canon) -ForegroundColor Green
  $left = @($apiProcs | Where-Object { Get-Process -Id $_.Pid -ErrorAction SilentlyContinue })
  Write-Host ("Bache hue API processes: {0}" -f $left.Count)
} else {
  Write-Host "Canonical process gayab - watcher ne restart kiya hoga; port check karo." -ForegroundColor Yellow
}
