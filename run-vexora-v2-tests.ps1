param([string]$PgBin = 'C:\Program Files\PostgreSQL\17\bin')
$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$env:NO_PROXY = '127.0.0.1,localhost,::1'
$env:VX_SUB_RUN_POSTGRES = '0'
$env:VX_SUB_RUN_LOCAL_HTTP = '0'
function Run([string]$Exe, [string[]]$Arguments) {
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Exe failed (exit $LASTEXITCODE)." }
}
function Check-Api([int]$Port) {
    Run 'curl.exe' @('--noproxy','*','--fail','--silent','--show-error','--output','NUL',
        '--max-time','5',"http://127.0.0.1:$Port/auth/v1/health")
}
foreach ($tool in @('node','docker','supabase','curl.exe')) {
    if (!(Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing command: $tool" }
}
foreach ($name in @('pg_isready.exe','initdb.exe','pg_ctl.exe','createdb.exe','psql.exe')) {
    if (!(Test-Path -LiteralPath (Join-Path $PgBin $name) -PathType Leaf)) { throw "Missing PostgreSQL tool: $name" }
}
Get-ChildItem Env: | Where-Object Name -Match '^PG' | ForEach-Object {
    [Environment]::SetEnvironmentVariable($_.Name, $null, 'Process')
}
if ($env:DOCKER_HOST -and $env:DOCKER_HOST -notmatch '^npipe://') { throw 'Docker host must be a Windows named pipe.' }
if ((Run 'docker' @('context','inspect','--format','{{.Endpoints.docker.Host}}')) -notmatch '^npipe://') {
    throw 'Docker context must use a Windows named pipe.'
}
Check-Api 55321
Run (Join-Path $PgBin 'pg_isready.exe') @('-h','127.0.0.1','-p','55322','-t','4')
Run 'docker' @('info','--format','{{.ServerVersion}}')

$tag = 'vxv2-' + [guid]::NewGuid().ToString('N').Substring(0,12)
$work = Join-Path ([IO.Path]::GetTempPath()) $tag
New-Item -ItemType Directory -Path $work | Out-Null
$pgData = Join-Path $work 'pg'
$pgCtl = Join-Path $PgBin 'pg_ctl.exe'
$pgPort = 56981
$apiPort = 56881
$dbPort = 56882
$failures = [Collections.Generic.List[string]]::new()
$pgStarted = $false
$stackAttempted = $false

Push-Location $work
try {
    try {
        Run (Join-Path $PgBin 'initdb.exe') @('-D',$pgData,'-U','vx_test_admin',
            '--auth=trust','--encoding=UTF8','--no-locale')
        Add-Content -LiteralPath (Join-Path $pgData 'postgresql.conf') -Encoding ascii -Value @(
            "listen_addresses = '127.0.0.1'","port = $pgPort","cluster_name = 'vexora-subscriptions-fixture'")
        Run $pgCtl @('-D',$pgData,'-l',(Join-Path $work 'postgres.log'),'-w','start')
        $pgStarted = $true
        Run (Join-Path $PgBin 'createdb.exe') @('-h','127.0.0.1','-p',"$pgPort",'-U','vx_test_admin','vx_sub_test')
        $env:VX_SUB_TEST_SOCKET = '127.0.0.1'
        $env:VX_SUB_TEST_PORT = "$pgPort"
        $env:VX_SUB_TEST_PSQL = Join-Path $PgBin 'psql.exe'
        $env:VX_SUB_RUN_POSTGRES = '1'
        Run 'node' @('--test',(Join-Path $repo 'tests/subscriptions-v2/postgres.test.mjs'))
    } catch {
        $failures.Add("PostgreSQL/RLS/concurrency: $($_.Exception.Message)")
        Write-Warning $failures[$failures.Count - 1]
    } finally {
        $env:VX_SUB_RUN_POSTGRES = '0'
        if ($pgStarted) {
            & $pgCtl -D $pgData -m fast -w stop
            if ($LASTEXITCODE) { $failures.Add('Isolated PostgreSQL cleanup failed.') }
        }
    }
    try {
        Run 'supabase' @('init')
        $cfg = Join-Path $work 'supabase/config.toml'
        $config = Get-Content -LiteralPath $cfg -Raw
        if ($config -notmatch '(?m)^project_id\s*=') { throw 'Generated configuration has no project ID.' }
        $config = $config -replace '(?m)^project_id\s*=.*$', ('project_id = "' + $tag + '"')
        $script:portCounter = 56880
        $config = [regex]::Replace($config, '(?m)^(?<key>(?:port|shadow_port|inspector_port)\s*=\s*)\d+', {
            param($match)
            $script:portCounter++
            $match.Groups['key'].Value + $script:portCounter
        })
        foreach ($section in @('api','db')) {
            $block = [regex]::Match($config, "(?ms)^\[$section\]\s*(?<body>.*?)(?=^\[|\z)").Groups['body'].Value
            $port = if ($section -eq 'api') { $apiPort } else { $dbPort }
            if ($block -notmatch "(?m)^port\s*=\s*$port\b") { throw "Unexpected $section port mapping." }
        }
        [IO.File]::WriteAllText($cfg,$config)
        $migrations = Join-Path $work 'supabase/migrations'
        New-Item -ItemType Directory -Force -Path $migrations | Out-Null
        $sqlDir = Join-Path $repo 'docs/security/subscriptions-v2'
        $sequence = @('001-core.review.sql','002-review-and-provider-work.review.sql',
            '003-feature-access.review.sql','007-private-receipts.review.sql','008-receipt-intake.review.sql')
        for ($i=0; $i -lt $sequence.Count; $i++) {
            Copy-Item -LiteralPath (Join-Path $sqlDir $sequence[$i]) -Destination (Join-Path $migrations ('202601010000{0:00}_fixture.sql' -f $i))
        }
        $functions = Join-Path $work 'supabase/functions'
        New-Item -ItemType Directory -Path $functions | Out-Null
        Copy-Item -LiteralPath (Join-Path $repo 'supabase/functions/vexora-v2-receipts') -Destination $functions -Recurse
        $stackAttempted = $true
        $startOutput = & supabase start -x studio,imgproxy,realtime,logflare,vector,supavisor
        if ($LASTEXITCODE) { throw 'Isolated Supabase start failed. Check local Docker logs.' }
        $statusText = & supabase status -o json
        if ($LASTEXITCODE) { throw 'Isolated Supabase status failed.' }
        $status = ($statusText -join [Environment]::NewLine) | ConvertFrom-Json
        $api = [Uri]$status.API_URL
        if ($api.Scheme -ne 'http' -or $api.Host -notin @('127.0.0.1','localhost') -or $api.Port -ne $apiPort) {
            throw 'Unexpected isolated API URL.'
        }
        Check-Api $apiPort
        $env:VX_SUB_LOCAL_URL = $api.GetLeftPart([UriPartial]::Authority)
        $env:VX_SUB_TEST_ANON_KEY = $status.ANON_KEY
        $env:VX_SUB_LOCAL_SERVICE_KEY = $status.SERVICE_ROLE_KEY
        $env:VX_SUB_LOCAL_DOCKER_DB = "supabase_db_$tag"
        Run 'node' @((Join-Path $repo 'tests/subscriptions-v2/windows-http-fixture.mjs'))
    } catch {
        $failures.Add("Supabase HTTP/Storage: $($_.Exception.Message)")
        Write-Warning $failures[$failures.Count - 1]
    } finally {
        Remove-Item Env:VX_SUB_LOCAL_SERVICE_KEY,Env:VX_SUB_TEST_ANON_KEY -ErrorAction SilentlyContinue
        if ($stackAttempted) {
            $stopOutput = & supabase stop --project-id $tag --no-backup
            if ($LASTEXITCODE) { $failures.Add("Cleanup failed for isolated project $tag.") }
        }
    }
} finally {
    Pop-Location
}
if ($failures.Count) { throw ($failures -join [Environment]::NewLine) }
Write-Host 'Both local integration groups completed.'
