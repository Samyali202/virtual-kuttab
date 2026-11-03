# Build .env.production for Next from .env.local (no echo of secrets)
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root ".env.local"
$dst = Join-Path $root "apps\web\.env.production"
$keys = @(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_ASR_URL",
  "NEXT_PUBLIC_R2_PUBLIC_BASE"
)
$map = @{}
Get-Content $src -Encoding UTF8 | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $k, $v = $_.Split('=', 2)
  $map[$k.Trim()] = $v.Trim()
}
# Same-origin ASR proxy (nginx /asr → uvicorn :8088) — works with HTTPS mic
$map["NEXT_PUBLIC_ASR_URL"] = "/asr"
$lines = foreach ($k in $keys) {
  if (-not $map.ContainsKey($k) -or -not $map[$k]) { throw "Missing $k in .env.local" }
  "$k=$($map[$k])"
}
Set-Content -Path $dst -Value ($lines -join "`n") -Encoding UTF8
Write-Host "Wrote apps/web/.env.production ($($keys.Count) keys)"
