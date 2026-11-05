<#
.SYNOPSIS
  Mints a Chrome Web Store API refresh token via the OAuth 2.0 loopback
  flow, and stores it alongside the other deploy secrets in
  chrome-extension\.env.

.DESCRIPTION
  Requires a Google Cloud OAuth client of type "Desktop app" (see
  docs\chrome-web-store-deploy.md for the one-time setup). Uses only
  built-in .NET types -- no extra modules needed.

.EXAMPLE
  cd chrome-extension
  .\scripts\get-refresh-token.ps1
#>

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Web

$EnvPath = Join-Path (Split-Path $PSScriptRoot -Parent) '.env'
$Scope = 'https://www.googleapis.com/auth/chromewebstore'
$AuthEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth'
$TokenEndpoint = 'https://oauth2.googleapis.com/token'
$RequiredKeys = @('CHROME_EXTENSION_ID', 'CHROME_CLIENT_ID', 'CHROME_CLIENT_SECRET')

function Read-EnvFile {
    param([string]$Path)
    $values = [ordered]@{}
    if (Test-Path $Path) {
        foreach ($line in Get-Content $Path) {
            $trimmed = $line.Trim()
            if (-not $trimmed -or $trimmed.StartsWith('#') -or ($trimmed -notmatch '=')) { continue }
            $idx = $trimmed.IndexOf('=')
            $key = $trimmed.Substring(0, $idx).Trim()
            $value = $trimmed.Substring($idx + 1).Trim()
            if ($value.Length -ge 2 -and $value[0] -eq $value[-1] -and ($value[0] -eq '"' -or $value[0] -eq "'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $values[$key] = $value
        }
    }
    return $values
}

function Write-EnvFile {
    param([string]$Path, [System.Collections.Specialized.OrderedDictionary]$Values)
    $lines = foreach ($key in $Values.Keys) { "$key=$($Values[$key])" }
    Set-Content -Path $Path -Value $lines -Encoding UTF8
}

function Read-ValueForKey {
    param([string]$Key, [string]$Current, [switch]$Secret)
    $label = $Key -replace '_', ' '
    if ($Current) {
        $shown = if ($Secret -and $Current.Length -gt 4) { ('*' * 6) + $Current.Substring($Current.Length - 4) } else { $Current }
        $answer = Read-Host "$label [$shown] (Enter to keep, or type a new value)"
        if ([string]::IsNullOrWhiteSpace($answer)) { return $Current }
        return $answer.Trim()
    }
    do {
        $answer = Read-Host "$label"
        if ([string]::IsNullOrWhiteSpace($answer)) { Write-Host '  This value is required.' }
    } while ([string]::IsNullOrWhiteSpace($answer))
    return $answer.Trim()
}

Write-Host "Reading/writing secrets in $EnvPath`n"
$values = Read-EnvFile -Path $EnvPath
foreach ($key in $RequiredKeys) {
    $isSecret = $key -like '*SECRET*'
    $current = if ($values.Contains($key)) { $values[$key] } else { '' }
    $values[$key] = Read-ValueForKey -Key $key -Current $current -Secret:$isSecret
}
Write-EnvFile -Path $EnvPath -Values $values

$clientId = $values['CHROME_CLIENT_ID']
$clientSecret = $values['CHROME_CLIENT_SECRET']

# Grab a free loopback port, then hand it to HttpListener
$tempListener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
$tempListener.Start()
$port = $tempListener.LocalEndpoint.Port
$tempListener.Stop()

$redirectUri = "http://127.0.0.1:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($redirectUri)
$listener.Start()

$authParams = [ordered]@{
    client_id     = $clientId
    redirect_uri  = $redirectUri
    response_type = 'code'
    scope         = $Scope
    access_type   = 'offline'
    prompt        = 'consent'
}
$queryString = ($authParams.GetEnumerator() | ForEach-Object {
    "$([uri]::EscapeDataString($_.Key))=$([uri]::EscapeDataString($_.Value))"
}) -join '&'
$authUrl = "$AuthEndpoint`?$queryString"

Write-Host "`nOpening your browser to authorize:`n$authUrl`n"
Write-Host 'If it does not open automatically, copy/paste that URL into a browser.'
Start-Process $authUrl

Write-Host 'Waiting for authorization (Ctrl+C to cancel)...'
$code = $null
$authError = $null
while (-not $code -and -not $authError) {
    $context = $listener.GetContext()
    $q = [System.Web.HttpUtility]::ParseQueryString($context.Request.Url.Query)
    $responseText = ''
    if ($q['code']) {
        $code = $q['code']
        $responseText = '<html><body>Authorized &mdash; you can close this tab.</body></html>'
    } elseif ($q['error']) {
        $authError = $q['error']
        $responseText = "<html><body>Authorization failed: $($q['error'])</body></html>"
    } else {
        $context.Response.StatusCode = 404
        $context.Response.Close()
        continue
    }
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseText)
    $context.Response.ContentType = 'text/html'
    $context.Response.OutputStream.Write($buffer, 0, $buffer.Length)
    $context.Response.Close()
}
$listener.Stop()

if ($authError) { throw "Google returned an error: $authError" }
if (-not $code) { throw 'No authorization code received. Run the script again.' }

$tokenBody = @{
    client_id     = $clientId
    client_secret = $clientSecret
    code          = $code
    grant_type    = 'authorization_code'
    redirect_uri  = $redirectUri
}
try {
    $tokenResponse = Invoke-RestMethod -Uri $TokenEndpoint -Method Post -Body $tokenBody
} catch {
    $errBody = $_.ErrorDetails.Message
    throw "Token exchange failed: $errBody"
}

if (-not $tokenResponse.refresh_token) {
    throw "No refresh_token in the response. This usually means you already authorized this app before -- go to https://myaccount.google.com/permissions, remove access for this app, and run the script again."
}

$values['CHROME_REFRESH_TOKEN'] = $tokenResponse.refresh_token
Write-EnvFile -Path $EnvPath -Values $values

Write-Host "`nSuccess! CHROME_REFRESH_TOKEN written to $EnvPath"
Write-Host "Now copy all four values from .env into your repo's GitHub Actions secrets"
Write-Host '(Settings -> Secrets and variables -> Actions):'
foreach ($key in ($RequiredKeys + 'CHROME_REFRESH_TOKEN')) { Write-Host "  - $key" }
