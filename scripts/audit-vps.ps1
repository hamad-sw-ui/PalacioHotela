# =============================================================
#  PALACIO HOTEL - LOT 3 (3C) : AUDIT DU VPS A DISTANCE - LECTURE SEULE
#
#  Execute DEPUIS WINDOWS (PowerShell 5.1 + OpenSSH). Le VPS est
#  contacte en SSH et y recoit UNIQUEMENT des commandes de lecture :
#    - aucune ecriture, aucune donnee modifiee
#    - aucun push / migrate / build / restart
#    - aucun secret affiche (.env ET drizzle.config.* sont filtres)
#    - chaque controle isole peut echouer sans interrompre l'audit
#
#  Usage :
#    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\audit-vps.ps1 -HostVPS root@IP-DU-VPS
#
#  Prerequis :
#    - client OpenSSH dans le PATH (Windows 10/11)
#    - connexion SSH manuelle fonctionnelle au prealable : ssh root@IP "echo ok"
#    - sudo -n -u postgres psql operationnel sur le VPS (sinon les
#      sections SQL affichent une erreur explicite et l'audit continue)
# =============================================================

param(
    [Parameter(Mandatory = $true)]
    [string]$HostVPS,                        # ex: root@1.2.3.4

    [string]$AppDir = '/var/www/palacio',    # dossier de l application sur le VPS
    [string]$DbName = 'palacio',             # nom attendu de la base de production
    [string]$OutFile = 'audit-vps-results.txt',
    [int]$RemoteTimeoutSec = 90              # limite de duree par commande distante
)

$ErrorActionPreference = 'Continue'

# -------------------------------------------------------------
# 0-bis. Validation des parametres (refus des valeurs dangereuses)
# -------------------------------------------------------------
# $HostVPS : cible SSH. On refuse les options et les caracteres de shell.
if ($HostVPS -notmatch '^[A-Za-z0-9._@\-]+$' -or $HostVPS -match '^-') {
    Write-Output '!! Parametre -HostVPS invalide (format attendu : utilisateur@hote). Audit arrete.'
    exit 1
}
# $AppDir / $DbName : inserees dans des commandes bash. On refuse tout
# caractere pouvant casser le quoting bash ou injecter une commande.
foreach ($p in @(@('AppDir', $AppDir), @('DbName', $DbName))) {
    if ($p[1] -notmatch '^[A-Za-z0-9._/\-]+$') {
        Write-Output ("!! Parametre -$($p[0]) invalide (caracteres autorises : lettres, chiffres, . _ / -). Audit arrete.")
        exit 1
    }
}
# $OutFile : on refuse l'ecrasement accidentel d'un fichier important.
# Seuls les rapports d'audit precedents peuvent etre regeneres.
if (Test-Path -LiteralPath $OutFile) {
    $existing = (Get-Item -LiteralPath $OutFile).Name
    if ($existing -notmatch '^audit-vps-results') {
        Write-Output "!! -OutFile pointe vers un fichier existant non audit ('$existing'). Refus d'ecraser. Audit arrete."
        exit 1
    }
    Write-Output "(!) Le rapport precedent '$existing' sera remplace (fichier de rapport d'audit)."
}

$ErrorActionPreference = 'Continue'

# -------------------------------------------------------------
#  Helpers
# -------------------------------------------------------------
function Write-Section {
    param([string]$Title)
    $line = "`n" + ('=' * 70) + "`n== $Title`n" + ('=' * 70)
    Write-Output $line
    Add-Content -LiteralPath $OutFile -Value $line
}

function Write-Result {
    param([string]$Label, [string]$Text, [string]$Status = 'OK')
    $block = "`n--- $Label [$Status] ---`n"
    if ($Text) { $block += ($Text.TrimEnd() + "`n") } else { $block += "(sortie vide)`n" }
    Write-Output $block
    Add-Content -LiteralPath $OutFile -Value $block
}

# Echappe une chaine pour l'interieur de simple-quotes BASH ('...' bash).
# Compatible PowerShell 5.1 : le seul caractere special dans '...' bash
# est l'apostrophe, qui se code '\'' (fermer, apostrophe echappee, rouvrir).
function ConvertTo-BashSingleQuoted {
    param([string]$Value)
    return $Value.Replace("'", "'\''")
}

# Exécute une commande BASH sur le VPS via SSH. Ne leve jamais d'exception :
# les erreurs (y compris SSH) sont renvoyees dans le texte de sortie.
# Limite de duree : OpenSSH ne propose pas de timeout d'execution cote
# client fiable ; on documente donc la limite REELLE ci-dessous :
#   - ConnectTimeout=10  : limite la PHASE DE CONNEXION uniquement ;
#   - ServerAliveInterval/CountMax : coupe la session si le RESEAU meurt ;
#   - la duree d'execution de la commande distante elle-meme N'EST PAS
#     limitee par le client : si un processus distant reste actif sans
#     produire de sortie et sans couper le reseau, ssh peut rester
#     bloque. Limite technique documentee, contournable uniquement par
#     un job PowerShell ( hors perimetre ici pour rester simple et fiable).
function Invoke-Remote {
    param([string]$BashCommand)
    try {
        $quoted = ConvertTo-BashSingleQuoted $BashCommand
        $full = "bash -lc '$quoted'"
        $out = & ssh `
            -o ConnectTimeout=10 `
            -o ServerAliveInterval=10 `
            -o ServerAliveCountMax=6 `
            -o StrictHostKeyChecking=accept-new `
            $HostVPS $full 2>&1
        return (@($out) -join "`n")
    } catch {
        return ('ERREUR SSH : ' + $_.Exception.Message)
    }
}

# Execute une requete SQL en lecture seule via sudo -u postgres psql.
# Si sudo -n echoue, on retente en direct (utile si l'usager SSH EST
# l'utilisateur postgres ou a psql avec droits suffisants).
function Invoke-RemotePsql {
    param([string]$Sql)
    $sqlQ = ConvertTo-BashSingleQuoted $Sql
    $dbQ  = ConvertTo-BashSingleQuoted $DbName
    $cmd  = "sudo -n -u postgres psql -d '$dbQ' -Atc '$sqlQ' 2>&1"
    $out  = Invoke-Remote -BashCommand $cmd
    if ($out -match 'sudo: a password is required|sudo: no tty|sudo: impossible') {
        $cmd2 = "psql -d '$dbQ' -Atc '$sqlQ' 2>&1 || echo 'ECHEC SQL : ni sudo -n ni psql direct disponibles (droits insuffisants)'"
        return Invoke-Remote -BashCommand $cmd2
    }
    return $out
}

# Vide le fichier de rapport
Set-Content -LiteralPath $OutFile -Value ('AUDIT VPS PALACIO - ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' - cible : ' + $HostVPS)
Write-Output ('Audit demarre. Resultats affiches ci-dessous ET sauvegardes dans ' + $OutFile)

# -------------------------------------------------------------
# 0. Connexion SSH
# -------------------------------------------------------------
Write-Section '0. CONNECTIVITE SSH'
$conn = Invoke-Remote 'echo CONNECTED; whoami; hostname; date -u; uname -a; uptime'
Write-Result 'Connexion SSH + infos systeme' $conn
if ($conn -notmatch 'CONNECTED') {
    Write-Output ("`n!! Impossible de se connecter au VPS. Verifiez : ssh $HostVPS`nAudit arrete.")
    exit 1
}

# -------------------------------------------------------------
# 1. Configuration Drizzle presente sur le VPS
#    (SEULEMENT les metadonnees non sensibles : jamais le contenu
#     integral des drizzle.config.*, qui peuvent contenir des URL
#     avec identifiants)
# -------------------------------------------------------------
Write-Section '1. CONFIGURATION DRIZZLE SUR LE VPS (metadonnees non sensibles)'
$cfgCmd = @'
cd APPDIR 2>/dev/null || { echo 'APP_DIR introuvable'; exit 0; }
echo '--- fichiers de config drizzle presents ---'
ls -la drizzle.config.json drizzle.config.ts drizzle.config.js 2>/dev/null || echo 'aucun'
echo '--- schema declare (valeur de la cle "schema", sans les credentials) ---'
for f in drizzle.config.json drizzle.config.ts drizzle.config.js; do
  [ -f "$f" ] || continue
  echo "$f :"
  grep -oE '"schema"[[:space:]]*:[[:space:]]*"[^"]+"' "$f" 2>/dev/null || \
  grep -oE "schema:[[:space:]]*['\''\"][^'\''\"]+" "$f" 2>/dev/null || \
  echo '  (cle schema non detectee - non affiche: contenu potentiellement sensible)'
done
echo '--- dialect declare ---'
grep -oE '"dialect"[[:space:]]*:[[:space:]]*"[^"]+"' drizzle.config.json 2>/dev/null || \
grep -oE "dialect:[[:space:]]*['\''\"][^'\''\"]+" drizzle.config.ts drizzle.config.js 2>/dev/null || echo 'non detecte'
echo '--- URL presente ? (JAMAIS affichee, meme masquee : extraits structurels uniquement) ---'
for f in drizzle.config.json drizzle.config.ts drizzle.config.js; do
  [ -f "$f" ] || continue
  if grep -qE 'postgres(ql)?://' "$f" 2>/dev/null; then
    echo "$f : contient une URL postgres - host/user uniquement :"
    grep -oE 'postgres(ql)?://[^@/]+@[^/[:space:]]+/[^"'\''[:space:]]+' "$f" | sed -E 's#://[^@]+@#://<USER_MASQUE>?@#' || \
    echo '  (URL presente, format non reconnu - structure non extraite par securite)'
  fi
done
echo '--- .env : CLES uniquement (valeurs masquees) ---'
sed -E 's/=.*/=<masque>/' .env 2>/dev/null || echo ABSENT
echo '--- presence DATABASE_URL ---'
grep -q '^DATABASE_URL=' .env 2>/dev/null && echo 'DATABASE_URL presente' || echo 'DATABASE_URL ABSENTE'
echo '--- dossier drizzle/ ---'
ls -la drizzle 2>/dev/null
echo '--- drizzle/meta ---'
ls -la drizzle/meta 2>/dev/null
echo '--- journal _journal.json (ne contient pas de secret) ---'
cat drizzle/meta/_journal.json 2>/dev/null || echo ABSENT
'@.Replace('APPDIR', $AppDir)
$cfg = Invoke-Remote $cfgCmd
Write-Result 'Configs drizzle (metadonnees) + cles .env (masquees) + historique migrations' $cfg

# -------------------------------------------------------------
# 2. Base ciblee par le deploiement (mot de passe masque)
# -------------------------------------------------------------
Write-Section '2. BASE CIBLEE PAR LE DEPLOIEMENT (sans afficher le mot de passe)'
$dbCmd = @'
cd APPDIR 2>/dev/null || { echo 'APP_DIR introuvable'; exit 0; }
url=$(grep -E '^DATABASE_URL=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
if [ -z "$url" ]; then echo 'DATABASE_URL absente'; exit 0; fi
# Masquage du mot de passe : tout ce qui suit ':' jusqu'a '@' apres le scheme.
safe=$(echo "$url" | sed -E 's#://([^:@/]+):[^@]+@#://\1:<MOT_DE_PASSE_MASQUE>@#')
if [ "$safe" = "$url" ]; then
  # Format sans mot de passe (ex: postgres://user@host/db) : rien a masquer.
  echo "DATABASE_URL (format sans mot de passe) : $url"
else
  echo "DATABASE_URL (masquee) : $safe"
fi
echo 'host/database/user :'
echo "$url" | sed -E 's#^postgres(ql)?://##' | sed -E 's#:[^@]+@#@#' | awk -F'[@/]' '{print "user="$1"  host="$2"  db="$NF}'
'@.Replace('APPDIR', $AppDir)
$db = Invoke-Remote $dbCmd
Write-Result 'DATABASE_URL (mot de passe masque)' $db

# -------------------------------------------------------------
# 3. Versions et code sur le VPS (hashes comparables au depot local)
#    NB : aucun cd drizzle qui casserait les chemins relatifs suivants.
# -------------------------------------------------------------
Write-Section '3. VERSIONS ET CODE SUR LE VPS'
$verCmd = @'
cd APPDIR 2>/dev/null || { echo 'APP_DIR introuvable'; exit 0; }
echo '--- node / npm ---'
node -v
npm -v
echo '--- pm2 ---'
pm2 -v 2>/dev/null || echo 'pm2 absent du PATH'
echo '--- drizzle-kit / drizzle-orm / next installes ---'
node -e 'for (const p of ["drizzle-kit","drizzle-orm","next"]) { try { console.log(p + "=" + require(p + "/package.json").version) } catch (e) { console.log(p + "= absent") } }'
echo '--- package.json scripts ---'
node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync("package.json","utf8")).scripts,null,2))'
echo '--- hashes md5 (a comparer au depot local Windows, en insensible a la casse) ---'
md5sum src/db/schema.ts drizzle.config.json deploy.sh setup-server.sh package.json 2>&1
md5sum drizzle/*.sql drizzle/meta/*.json 2>&1
echo '--- dernier build (chemins absolus, robustes apres tout cd eventuel) ---'
ls -ld APPDIR/.next 2>/dev/null
cat APPDIR/.next/BUILD_ID 2>/dev/null
stat -c '%y %n' APPDIR/.next 2>/dev/null
'@.Replace('APPDIR', $AppDir)
$ver = Invoke-Remote $verCmd
Write-Result 'Versions, hashes, BUILD_ID' $ver

# -------------------------------------------------------------
# 4. PM2 : processus reellement execute
# -------------------------------------------------------------
Write-Section '4. PM2 - PROCESSUS EN COURS'
$pm2Cmd = @'
echo '--- pm2 status ---'
pm2 status 2>/dev/null || echo 'pm2 indisponible'
echo '--- pm2 describe palacio ---'
pm2 describe palacio 2>/dev/null || echo 'app palacio introuvable'
echo '--- pm2 jlist (resume) ---'
pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s);for(const p of a){console.log("name="+p.name+" status="+p.pm2_env.status+" uptime="+new Date(p.pm2_env.pm_uptime).toISOString()+" restarts="+p.pm2_env.restart_time+" script="+p.pm2_env.pm_exec_path+" cwd="+p.pm2_env.pm_cwd+" node="+p.pm2_env.node_version)}}catch(e){console.log("jlist indisponible: "+e.message)}})'
'@
$pm2 = Invoke-Remote $pm2Cmd
Write-Result 'Processus PM2, chemin execute, cwd, redemarrages' $pm2

# -------------------------------------------------------------
# 5. Bases PostgreSQL presentes
# -------------------------------------------------------------
Write-Section '5. BASES POSTGRESQL DISPONIBLES'
$dbs = Invoke-RemotePsql 'SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size FROM pg_database WHERE NOT datistemplate ORDER BY datname;'
Write-Result 'Liste des bases (nom + taille)' $dbs

$pgver = Invoke-RemotePsql 'SELECT version();'
Write-Result 'Version PostgreSQL' $pgver

# -------------------------------------------------------------
# 6. Schema complet de la base de production
# -------------------------------------------------------------
Write-Section '6. SCHEMA COMPLET DE LA BASE DE PRODUCTION'
$schema = Invoke-RemotePsql 'SELECT table_name, column_name, data_type, character_maximum_length, is_nullable, column_default FROM information_schema.columns WHERE table_schema=''public'' ORDER BY table_name, ordinal_position;'
Write-Result 'Toutes les colonnes de toutes les tables (public)' $schema

$idx = Invoke-RemotePsql 'SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname=''public'' ORDER BY tablename, indexname;'
Write-Result 'Tous les index' $idx

$fk = Invoke-RemotePsql 'SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name WHERE tc.constraint_type=''FOREIGN KEY'' AND tc.table_schema=''public'';'
Write-Result 'Cles etrangeres' $fk

$counts = Invoke-RemotePsql 'SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;'
Write-Result 'Nombre de lignes estime par table' $counts

# -------------------------------------------------------------
# 7. Historique __drizzle_migrations
#    ATTENTION : l'absence de cette table ne prouve PAS a elle seule
#    que la base est push-only. Conclusion a CROISER avec :
#      - la section 6 (structure reelle vs schema.ts) ;
#      - le contexte connu (setup-server.sh utilise push --force || true ;
#        deploy.sh utilise push --force) ;
#      - l'historique Git/WinSCP du depot.
# -------------------------------------------------------------
Write-Section '7. HISTORIQUE DRIZZLE (table __drizzle_migrations)'
$exists = Invoke-RemotePsql 'SELECT to_regclass(''public.__drizzle_migrations'') IS NOT NULL AS table_present;'
Write-Result 'La table existe-t-elle ? (t = oui, f = non)' $exists

$hist = Invoke-RemotePsql 'SELECT id, created_at, to_timestamp(created_at/1000) AS applied_date, hash FROM public.__drizzle_migrations ORDER BY id;'
Write-Result "Contenu de l'historique (id, hash, date)" $hist
if ($hist -match 'relation .* does not exist|does not exist') {
    Write-Result 'Interpretation (A CROISER avec sections 6 et contexte)' @'
La table __drizzle_migrations est ABSENTE. Cela signifie uniquement que
la base n'a jamais recu de migration via drizzle-kit migrate. CONCLUSION
POSSIBLE mais NON AUTOMATIQUE : historique push-only.
A confirmer en croisant :
  1. la section 6 (structure reelle comparee a src/db/schema.ts) ;
  2. le contexte connu : setup-server.sh (push --force || true) et
     deploy.sh (push --force) suggèrent une construction par push ;
  3. l'absence de table ne prejuge PAS de la correspondance structurelle :
     une base peut avoir la bonne structure sans avoir joué 0000-0014,
     ou une structure differente.
Ne PAS baser une decision de baseline sur ce seul indicateur.
'@ 'INFO'
}

# -------------------------------------------------------------
# 8. Sauvegardes disponibles et cron
# -------------------------------------------------------------
Write-Section '8. SAUVEGARDES DISPONIBLES (lecture seule)'
$bkCmd = @'
echo '--- /var/backups/palacio ---'
ls -lah /var/backups/palacio 2>/dev/null || echo 'dossier absent'
echo '--- /root/backups ---'
ls -lah /root/backups 2>/dev/null || echo 'dossier absent'
echo '--- /var/backups ---'
ls -lah /var/backups 2>/dev/null | head -20
echo '--- crontab root ---'
crontab -l 2>/dev/null || echo 'pas de crontab root (ou droits insuffisants)'
echo '--- /etc/cron.d ---'
ls /etc/cron.d 2>/dev/null || echo 'vide'
'@
$bk = Invoke-Remote $bkCmd
Write-Result 'Liste des sauvegardes + cron' $bk

# -------------------------------------------------------------
# 9. Integrite des sauvegardes (pg_restore --list, sans restauration)
#    Distinction explicite : corruption reelle vs droit sudo manquant.
# -------------------------------------------------------------
Write-Section '9. INTEGRITE DES SAUVEGARDES (pg_restore --list, sans restauration)'
$integCmd = @'
sudo_ok=1
sudo -n true 2>/dev/null || sudo_ok=0
if [ "$sudo_ok" -eq 0 ]; then
  echo 'NOTE : sudo -n indisponible pour ce compte SSH.'
  echo '      Les tests pg_restore sur .dump seront tentes en direct'
  echo '      (fonctionnent si pg_restore est installe et le fichier lisible).'
fi
for f in /var/backups/palacio/*.dump /var/backups/palacio/*.sql /root/backups/*.dump; do
  [ -f "$f" ] || continue
  echo "--- $f ($(du -h "$f" | cut -f1)) ---"
  if [ ! -r "$f" ]; then
    echo '  DROIT : fichier non lisible par ce compte (droits insuffisants, pas une corruption).'
    continue
  fi
  case "$f" in
    *.dump)
      if command -v pg_restore >/dev/null 2>&1; then
        if pg_restore --list "$f" >/dev/null 2>&1; then
          echo '  INTEGRITE OK (pg_restore --list)'
        else
          echo '  INTEGRITE KO : pg_restore --list a echoue = archive corrompue ou format invalide.'
        fi
      elif [ "$sudo_ok" -eq 1 ]; then
        if sudo -n -u postgres pg_restore --list "$f" >/dev/null 2>&1; then
          echo '  INTEGRITE OK (pg_restore --list, via sudo postgres)'
        else
          echo '  INTEGRITE KO ou droit sudo manquant : a verifier manuellement.'
        fi
      else
        echo '  INDERTERMINE : pg_restore absent et sudo -n indisponible.'
      fi
      ;;
    *.sql)
      head -c 200 "$f" >/dev/null 2>&1 && echo "  fichier SQL lisible ($(du -h "$f" | cut -f1))"
      ;;
  esac
done
echo 'verifications terminees'
'@
$integ = Invoke-Remote $integCmd
Write-Result 'Verification pg_restore --list sur chaque .dump' $integ

# -------------------------------------------------------------
# 10. Recapitulatif des hashes a comparer au depot local
# -------------------------------------------------------------
Write-Section '10. RECAPITULATIF DES HASHES A COMPARER AU DEPOT LOCAL'
$recCmd = @'
cd APPDIR 2>/dev/null || { echo 'APP_DIR introuvable'; exit 0; }
echo 'A comparer au depot local Windows (md5sum local, insensible a la casse) :'
echo '  src/db/schema.ts, drizzle.config.json, deploy.sh, setup-server.sh, package.json, drizzle/*.sql'
md5sum src/db/schema.ts drizzle.config.json deploy.sh setup-server.sh package.json 2>&1
md5sum drizzle/*.sql drizzle/meta/*.json 2>&1
'@.Replace('APPDIR', $AppDir)
$rec = Invoke-Remote $recCmd
Write-Result 'Hashes md5 a comparer manuellement au depot local' $rec

# -------------------------------------------------------------
# Fin
# -------------------------------------------------------------
Write-Section 'AUDIT TERMINE'
Write-Output ('Resultats complets sauvegardes dans : ' + $OutFile)
Write-Output 'Rapportez ce fichier pour la production du rapport final (decision baseline GO / NO-GO).'
