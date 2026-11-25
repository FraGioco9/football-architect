#requires -Version 7.0
[CmdletBinding()]
param(
 [Parameter(Mandatory)][ValidateSet('start','status','fit-preview','rebase','prepare','fund-preview','fund','populate','sign','publish','settle','reserve-next','refresh-values','roster-check')][string]$Action,
 [string]$ApprovedCommit,[string]$Seed,[string]$PlanPath,[string]$EvidencePath,[string]$ResetReceiptPath,
 [string]$FundingPath,[string]$ApprovalHash,
 [ValidateRange(1,2000)][int]$MaxRequests=400,
 [Microsoft.PowerShell.Commands.WebRequestSession]$Session
)
$ErrorActionPreference='Stop'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Origin='http://app.localhost:2000'
$Endpoint="$Origin/api/admin/dev-operator"
if($Action -eq 'start'){
 Push-Location $Root
 try{
  $head=(git rev-parse HEAD).Trim()
  if($LASTEXITCODE -ne 0 -or $head -cnotmatch '^[a-f0-9]{40}$' -or $ApprovedCommit -cne $head){throw 'Pass the exact separately approved commit in -ApprovedCommit.'}
  if(git status --porcelain --untracked-files=normal){throw 'Use a clean, reviewed checkout.'}
  $old=$env:FA_DEV_OPERATOR_SOURCE
  try{$env:FA_DEV_OPERATOR_SOURCE=$head;node tools/dev.mjs;if($LASTEXITCODE -ne 0){throw 'DEV launcher stopped.'}}
  finally{$env:FA_DEV_OPERATOR_SOURCE=$old}
 }finally{Pop-Location}
 return
}
function ReadPrivate([string]$Path){
 if(-not $Path){throw 'Required private file path missing.'}
 return [IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path).Path)
}
function SavePrivate([string]$Path,[string]$Value){
 if(-not $Path){throw 'Pass -PlanPath in a private directory outside the repository.'}
 $full=[IO.Path]::GetFullPath($Path)
 if($full.StartsWith($Root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Private plan must be outside the repository.'}
 $parent=Get-Item -LiteralPath ([IO.Path]::GetDirectoryName($full))
 if(-not $parent.PSIsContainer -or ($parent.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Use a private ordinary directory.'}
 $stream=[IO.File]::Open($full,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$bytes=[Text.Encoding]::UTF8.GetBytes($Value);$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
}
# Existing unified session only. Nothing is stored in scripts, repository, transcript or credential files.
if(-not $Session){
 $credential=Get-Credential -Message 'Existing DEV account (email and password)'
 if(-not $credential){throw 'Login cancelled.'}
 $loginBody=@{email=$credential.UserName;password=$credential.GetNetworkCredential().Password}|ConvertTo-Json -Compress
 try{
  $login=Invoke-RestMethod -Uri "$Origin/api/player/login" -Method Post -ContentType 'application/json' -Headers @{Origin=$Origin} -Body $loginBody -SessionVariable Session -MaximumRedirection 0 -TimeoutSec 90
 }finally{$loginBody=$null;$credential=$null}
}
$headers=@{Origin=$Origin}
$auth=Invoke-RestMethod -Uri "$Origin/api/admin/session" -WebSession $Session -Headers $headers -MaximumRedirection 0 -TimeoutSec 90
$headers['X-CSRF-Token']=$auth.csrfToken
$state=Invoke-RestMethod -Uri $Endpoint -WebSession $Session -Headers $headers -MaximumRedirection 0 -TimeoutSec 310
if($state.pool -cne 'dev-preview' -or $state.database -cne 'football-architect-dev' -or $state.source -cnotmatch '^[a-f0-9]{40}$'){throw 'Unverified DEV operator target.'}
if($Action -eq 'status'){$state|ConvertTo-Json -Depth 100;return}
if(-not $state.schema.ready -or $state.foreignKeyViolations -ne 0){throw 'Preflight blocked. Do not migrate or correct data from this script.'}
$data=[ordered]@{}
switch($Action){
 'fit-preview' {$data.seed=$Seed}
 {$_ -in @('rebase','prepare')} {
  $data.evidenceJson=ReadPrivate $EvidencePath
  $data.resetReceiptJson=ReadPrivate $ResetReceiptPath
  if($Action -eq 'prepare'){$data.seed=$Seed;if(-not $PlanPath -or (Test-Path -LiteralPath $PlanPath)){throw 'Choose a new private plan path.'}}
 }
 {$_ -in @('fund-preview','fund')} {
  $data.planJson=ReadPrivate $PlanPath
  $data.fundingJson=ReadPrivate $FundingPath
  if($Action -eq 'fund'){$data.approvalHash=$ApprovalHash}
 }
 {$_ -in @('populate','sign','publish')} {$data.planJson=ReadPrivate $PlanPath}
}
$w=$state.world
$readOnly=$Action -in @('fit-preview','prepare','fund-preview','roster-check')
$confirmation=''
if(-not $readOnly){
 $confirmation="DEV $Action $($w.generation) $($w.seasonNumber):$($w.day)"
 Write-Host "Source: $($state.source) | DEV only | One phase, at most $MaxRequests requests."
 if($Action -eq 'fund'){
  if($ApprovalHash -cnotmatch '^[a-f0-9]{64}$'){throw 'Run fund-preview and review the exact approval hash first.'}
  Write-Host "Approved funding hash: $ApprovalHash"
 }
 if((Read-Host "Type exactly: $confirmation") -cne $confirmation){throw 'Not authorized.'}
}
$body=@{action=$Action;expectedGeneration=$w.generation;expectedSeason=$w.seasonNumber;expectedDay=$w.day;confirmation=$confirmation;data=$data}|ConvertTo-Json -Depth 100 -Compress
$loop=$Action -in @('fund','populate','sign','settle','refresh-values')
for($i=1;$i -le $(if($loop){$MaxRequests}else{1});$i++){
 # No automatic replay after transport error: resume the same phase explicitly from durable receipts.
 $result=Invoke-RestMethod -Uri $Endpoint -Method Post -ContentType 'application/json' -Body $body -WebSession $Session -Headers $headers -MaximumRedirection 0 -TimeoutSec 310
 if($Action -eq 'prepare'){
  SavePrivate $PlanPath $result.planJson
  $result.summary|ConvertTo-Json -Depth 20
  return
 }
 $result|ConvertTo-Json -Depth 100 -Compress
 if(-not $loop -or $result.done -eq $true){return}
}
Write-Warning 'Request bound reached. Check status and explicitly resume the same phase; do not change the plan, source, funding file or payday.'
