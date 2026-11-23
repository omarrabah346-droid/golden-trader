param(
    [string]$PgBin = 'C:\Program Files\PostgreSQL\17\bin',
    [switch]$SkipPostgres
)
$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$env:NO_PROXY = '127.0.0.1,localhost,::1'
$env:VX_SUB_RUN_POSTGRES = '0'
$env:VX_SUB_RUN_LOCAL_HTTP = '0'
function Run([string]$Exe, [string[]]$Arguments) {
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Exe failed (exit $LASTEXITCODE)." }
}
function Invoke-Supabase([string[]]$Arguments, [switch]$CaptureOutput) {
    # Invoke the .cmd shim through cmd.exe so PowerShell 5.1 never interprets
    # native stderr as an ErrorRecord. Drain both streams concurrently to avoid
    # pipe deadlocks while Supabase starts its local services.
    $npxPath = (Get-Command 'npx.cmd' -ErrorAction Stop).Source
    foreach ($argument in $Arguments) {
        if ($argument -match '[\r\n"&|<>^%!()]') {
            throw 'Unsafe shell character in Supabase CLI argument.'
        }
    }
    $commandArgs = @('supabase') + @($Arguments) | ForEach-Object { '"' + $_ + '"' }
    $commandLine = '"' + $npxPath + '" ' + ($commandArgs -join ' ')

    $startInfo = New-Object Diagnostics.ProcessStartInfo
    $startInfo.FileName = $env:ComSpec
    $startInfo.Arguments = '/d /s /c "' + $commandLine + '"'
    $startInfo.WorkingDirectory = (Get-Location).Path
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.EnvironmentVariables['npm_config_offline'] = 'true'

    $process = New-Object Diagnostics.Process
    $process.StartInfo = $startInfo
    try {
        if (!$process.Start()) { throw 'Could not start Supabase CLI process.' }
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        $stdout = $stdoutTask.Result
        $stderr = $stderrTask.Result
        $exitCode = $process.ExitCode
        if ($exitCode -ne 0) {
            $details = @(
                if ($stdout) { "stdout:`r`n$stdout" }
                if ($stderr) { "stderr:`r`n$stderr" }
            ) -join "`r`n"
            throw "npx.cmd supabase $($Arguments[0]) failed (exit $exitCode).`r`n$details"
        }
        if ($CaptureOutput) { return $stdout }
    } finally {
        $process.Dispose()
    }
}
function Wait-ForApi([Uri]$ApiUrl, [int]$Attempts = 30) {
    if ($ApiUrl.Scheme -ne 'http' -or $ApiUrl.Host -notin @('127.0.0.1','localhost')) {
        throw 'Refusing readiness check: API URL is not loopback HTTP.'
    }
    $healthUrl = $ApiUrl.GetLeftPart([UriPartial]::Authority) + '/auth/v1/health'
    $lastError = 'No response received.'
    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        $stdoutFile = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString('N') + '.out')
        $stderrFile = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString('N') + '.err')
        $process = $null
        try {
            $process = Start-Process -FilePath 'curl.exe' -ArgumentList @(
                '--noproxy','*','--fail','--silent','--show-error','--output','NUL',
                '--connect-timeout','2','--max-time','4',$healthUrl
            ) -PassThru -Wait -WindowStyle Hidden -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
            if ($process.ExitCode -eq 0) { return }
            $stderr = if (Test-Path -LiteralPath $stderrFile) { (Get-Content -LiteralPath $stderrFile -Raw).Trim() } else { '' }
            $lastError = "curl exit $($process.ExitCode)" + $(if ($stderr) { ": $stderr" } else { '.' })
        } catch {
            $lastError = $_.Exception.Message
        } finally {
            if ($process) { $process.Dispose() }
            Remove-Item -LiteralPath $stdoutFile,$stderrFile -Force -ErrorAction SilentlyContinue
        }
        if ($attempt -lt $Attempts) { Start-Sleep -Seconds 2 }
    }
    throw "Supabase API was not ready after $Attempts bounded checks (phase: isolated API readiness; URL: $healthUrl). Last result: $lastError"
}
function Show-IsolatedContainerHealth([string]$ProjectTag) {
    # Restrict inspection to this run's random project tag; do not inspect or
    # alter containers belonging to any other Supabase project.
    try {
        $names = @(& docker ps --all --filter "name=$ProjectTag" --format '{{.Names}}' 2>$null)
        if ($LASTEXITCODE -ne 0 -or !$names.Count) {
            Write-Warning "No containers found for isolated project $ProjectTag."
            return
        }
        foreach ($name in $names) {
            $state = & docker inspect --format '{{json .State}}' $name 2>$null
            if ($LASTEXITCODE -eq 0 -and $state) {
                Write-Host "Isolated container health ($name): $state"
            } else {
                Write-Warning "Could not inspect isolated container $name."
            }
        }
    } catch {
        Write-Warning "Could not collect health state for isolated project ${ProjectTag}: $($_.Exception.Message)"
    }
}
foreach ($tool in @('node','docker','npx.cmd','curl.exe')) {
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
    if ($SkipPostgres) {
        Write-Host 'Skipping PostgreSQL/RLS/concurrency by request.'
    } else {
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
    }
    try {
        Invoke-Supabase @('init')
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
            $sourceSql = Join-Path $sqlDir $sequence[$i]
            $destinationSql = Join-Path $migrations ('202601010000{0:00}_fixture.sql' -f $i)
            $sqlText = Get-Content -LiteralPath $sourceSql -Raw
            if ($i -eq 0) {
                # Supabase's migration role can create this NOINHERIT role but may
                # not be a member of it. PostgreSQL requires SET ROLE membership
                # before ALTER FUNCTION ... OWNER TO vx_sub_v2_executor.
                $createRole = 'create role vx_sub_v2_executor nologin noinherit;'
                if ([regex]::Matches($sqlText, [regex]::Escape($createRole), 'IgnoreCase').Count -ne 1) {
                    throw 'Expected exactly one V2 executor role creation in the isolated fixture migration.'
                }
                $membershipFixture = (Get-Content -LiteralPath (Join-Path $repo 'tests/subscriptions-v2/supabase-executor-membership.fixture.sql') -Raw).Trim()
                $sqlText = $sqlText.Replace($createRole, $createRole + "`r`n" + $membershipFixture)
            }
            [IO.File]::WriteAllText($destinationSql, $sqlText)
        }
        $functions = Join-Path $work 'supabase/functions'
        New-Item -ItemType Directory -Path $functions | Out-Null
        Copy-Item -LiteralPath (Join-Path $repo 'supabase/functions/vexora-v2-receipts') -Destination $functions -Recurse
        $stackAttempted = $true
        try {
            # Storage and Edge Functions are required by receipt tests. Analytics
            # (Logflare/Vector), Studio, imgproxy, Realtime, and Supavisor are not.
            Invoke-Supabase @('start','-x','studio,imgproxy,realtime,logflare,vector,supavisor')
        } catch {
            Write-Warning "Supabase start failed for isolated project ${tag}; collecting only its container health state."
            Show-IsolatedContainerHealth $tag
            throw
        }
        $statusText = Invoke-Supabase @('status','-o','json') -CaptureOutput
        $status = $statusText | ConvertFrom-Json
        $api = [Uri]$status.API_URL
        if ($api.Scheme -ne 'http' -or $api.Host -notin @('127.0.0.1','localhost') -or $api.Port -ne $apiPort) {
            throw 'Unexpected isolated API URL.'
        }
        Wait-ForApi $api
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
            try { Invoke-Supabase @('stop','--project-id',$tag,'--no-backup') }
            catch { $failures.Add("Cleanup failed for isolated project ${tag}: $($_.Exception.Message)") }
        }
    }
} finally {
    Pop-Location
}
if ($failures.Count) { throw ($failures -join [Environment]::NewLine) }
if ($SkipPostgres) { Write-Host 'Supabase HTTP/Storage integration group completed.' }
else { Write-Host 'Both local integration groups completed.' }
