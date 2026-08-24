$dir = 'c:\Users\robos\OneDrive\Documents\SwitchNest\documentation\'
$files = @(
  @('api','1-API-DOCUMENTATION.md'),
  @('hardware','2-HARDWARE-DOCUMENTATION.md'),
  @('mobile','3-MOBILE-APP-DOCUMENTATION.md'),
  @('git','4-GIT-LOG-HISTORY.md'),
  @('flasher','5-FLASHER-GUI-DOCUMENTATION.md'),
  @('admin','6-ADMIN-FEATURES-DOCUMENTATION.md'),
  @('user','7-USER-FEATURES-DOCUMENTATION.md'),
  @('promo','8-FEATURES-PROMOTION.md'),
  @('report','9-PROJECT-STATUS-REPORT.md')
)

$out = "// Auto-generated`nwindow.DOCS = {`n"
foreach ($pair in $files) {
  $key = $pair[0]
  $content = Get-Content -Raw -Encoding UTF8 ($dir + $pair[1])
  $escaped = $content | ConvertTo-Json -Compress
  $out += "  `"$key`": $escaped,`n"
}
$out += "};`n"
Set-Content -Path ($dir + 'docs-data.js') -Value $out -Encoding UTF8
Write-Host ('Done: ' + (Get-Item ($dir + 'docs-data.js')).Length + ' bytes')
