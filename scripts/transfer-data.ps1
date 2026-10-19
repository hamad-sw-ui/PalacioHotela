# Sauvegarde / restauration des donnees du site Palacio Hotel.
# Destination par defaut : D:\PalacioHotel-Backups (configurable via -Path ou BACKUP_DIR).
#
# Sauvegarder  : .\scripts\transfer-data.ps1 -Action backup
# Restaurer    : .\scripts\transfer-data.ps1 -Action restore -Path "D:\PalacioHotel-Backups\PalacioBackup-AAAAMMJJ-HHMMSS"
param(
    [ValidateSet("backup", "restore")]
    [string]$Action = "backup",
    [string]$Path = ""
)

$ErrorActionPreference = "Stop"

# --- Configuration -----------------------------------------------------------
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ManifestName = "manifest.json"
$DumpName = "database.dump"
$MediaDirName = "media"

# Base de donnees : lue depuis .env du projet (DATABASE_URL).
$EnvFile = Join-Path $ProjectRoot ".env"
$DatabaseUrl = $null
if (Test-Path $EnvFile) {
    foreach ($line in Get-Content $EnvFile) {
        if ($line -match '^\s*DATABASE_URL\s*=\s*(.+?)\s*$') { $DatabaseUrl = $Matches[1] }
    }
}
if (-not $DatabaseUrl) {
    Write-Error "DATABASE_URL introuvable dans $EnvFile"
}

# Repertoire de sauvegarde par defaut.
$BackupRoot = "D:\PalacioHotel-Backups"
foreach ($line in (Get-Content $EnvFile -ErrorAction SilentlyContinue)) {
    if ($line -match '^\s*BACKUP_DIR\s*=\s*(.+?)\s*$') { $BackupRoot = $Matches[1] }
}

# Analyse de DATABASE_URL : postgresql://user:password@host:port/dbname
$uri = [System.Uri]$DatabaseUrl
$DbName = $uri.AbsolutePath.TrimStart("/")
$DbUser = if ($uri.UserInfo) { $uri.UserInfo.Split(":")[0] } else { "postgres" }
$DbPassword = if ($uri.UserInfo -and $uri.UserInfo.Contains(":")) { $uri.UserInfo.Split(":", 2)[1] } else { "" }
$DbHost = if ($uri.Host) { $uri.Host } else { "127.0.0.1" }
$DbPort = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }

$env:PGPASSWORD = $DbPassword

# Localisation des outils PostgreSQL.
$PgTools = @(
    "C:\Program Files\PostgreSQL\17\bin",
    "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\PostgreSQL\15\bin"
) | Where-Object { Test-Path (Join-Path $_ "pg_dump.exe") } | Select-Object -First 1
if (-not $PgTools) { Write-Error "pg_dump/pg_restore introuvables (PostgreSQL 15-17 attendus)." }
$PgDump = Join-Path $PgTools "pg_dump.exe"
$PgRestore = Join-Path $PgTools "pg_restore.exe"
$Psql = Join-Path $PgTools "psql.exe"
$Createdb = Join-Path $PgTools "createdb.exe"

$MediaSource = Join-Path $ProjectRoot "public\uploads\media"

function Invoke-Backup {
    $Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $Dest = if ($Path) { $Path } else { Join-Path $BackupRoot "PalacioBackup-$Stamp" }
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null

    Write-Host "Sauvegarde de la base '$DbName' vers $Dest ..."
    & $PgDump -h $DbHost -p $DbPort -U $DbUser -Fc --no-owner `
        -f (Join-Path $Dest $DumpName) $DbName
    if ($LASTEXITCODE -ne 0) { Write-Error "pg_dump a echoue." }

    if (Test-Path $MediaSource) {
        $MediaDest = Join-Path $Dest $MediaDirName
        New-Item -ItemType Directory -Force -Path $MediaDest | Out-Null
        Copy-Item (Join-Path $MediaSource "*") $MediaDest -Recurse -Force
        $Count = (Get-ChildItem $MediaDest -File -Recurse).Count
        Write-Host "$Count fichier(s) media copie(s)."
    } else {
        Write-Host "Aucun dossier media a sauvegarder."
    }

    @{ CreatedAt = (Get-Date).ToString("s"); DatabaseName = $DbName; MediaIncluded = (Test-Path (Join-Path $Dest $MediaDirName)) } |
        ConvertTo-Json | Set-Content (Join-Path $Dest $ManifestName) -Encoding UTF8
    Write-Host "Sauvegarde terminee : $Dest"
}

function Invoke-Restore {
    $Src = $Path
    if (-not $Src -or -not (Test-Path (Join-Path $Src $DumpName))) {
        # Aucun chemin precise : reprendre la sauvegarde la plus recente.
        $Latest = Get-ChildItem $BackupRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { Test-Path (Join-Path $_.FullName $DumpName) } |
            Sort-Object Name -Descending | Select-Object -First 1
        if (-not $Latest) { Write-Error "Aucune sauvegarde trouvee dans $BackupRoot." }
        $Src = $Latest.FullName
        Write-Host "Sauvegarde la plus recente selectionnee : $Src"
    }

    # La base doit exister ; on la cree si besoin.
    $Exists = & $Psql -h $DbHost -p $DbPort -U $DbUser -d postgres -tAc `
        "SELECT 1 FROM pg_database WHERE datname='$DbName'"
    if ($Exists -ne "1") {
        & $Createdb -h $DbHost -p $DbPort -U $DbUser $DbName
        Write-Host "Base '$DbName' creee."
    } else {
        $Answer = Read-Host "La base '$DbName' existe. Vider ses donnees et restaurer ? (O/n)"
        if ($Answer -eq "n") { Write-Host "Restauration annulee."; return }
    }

    # Vider les tables applicatives pour eviter les conflits de cles.
    $Tables = @("activity_logs","bookings","catalog_items","contact_messages",
        "content_pages","notifications","quote_requests","site_settings","users")
    $TableList = ($Tables | ForEach-Object { "'$_'" }) -join ","
    & $Psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -c `
        "TRUNCATE TABLE $TableList CASCADE" 2>$null

    # Le schema 'drizzle' peut manquer sur une base fraichement poussee.
    & $Psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -c "CREATE SCHEMA IF NOT EXISTS drizzle" 2>$null

    Write-Host "Restauration de la base depuis $Src ..."
    & $PgRestore -h $DbHost -p $DbPort -U $DbUser -d $DbName `
        --data-only --disable-triggers --no-owner (Join-Path $Src $DumpName) 2>&1 |
        ForEach-Object { Write-Host $_ }
    Write-Host "Base restaurée."

    $MediaSrc = Join-Path $Src $MediaDirName
    if (Test-Path $MediaSrc) {
        New-Item -ItemType Directory -Force -Path $MediaSource | Out-Null
        Copy-Item (Join-Path $MediaSrc "*") $MediaSource -Recurse -Force
        Write-Host "Medias restaures dans $MediaSource"
    }
    Write-Host "Restauration terminee."
}

switch ($Action) {
    "backup"  { Invoke-Backup }
    "restore" { Invoke-Restore }
}
