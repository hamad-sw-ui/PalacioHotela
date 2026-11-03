# =============================================================
#  PALACIO HOTEL - AUDIT VPS SUPPLÉMENT (sections défaillantes)
#  Exécute DES COMMANDES DE LECTURE SEULE sur le VPS pour
#  compléter les sections 1, 2, 3, 4, 9 du rapport principal.
#  Aucune écriture sur le VPS. Aucun secret affiché.
#  Usage :
#    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\audit-vps-supplement.ps1
# =============================================================

$HostVPS = 'root@2.24.49.223'
$OutFile = 'audit-vps-results.txt'
$ErrorActionPreference = 'Continue'

function Invoke-Remote {
    param([string]$BashCommand)
    try {
        $out = & ssh -o ConnectTimeout=15 -o ServerAliveInterval=10 -o ServerAliveCountMax=6 -o StrictHostKeyChecking=accept-new $HostVPS $BashCommand 2>&1
        return (@($out) -join "`n")
    } catch {
        return ('ERREUR SSH : ' + $_.Exception.Message)
    }
}

function Write-Block {
    param([string]$Title, [string]$Text)
    $line = "`n--- $Title ---`n"
    if ($Text) { $line += ($Text.TrimEnd() + "`n") } else { $line += "(sortie vide)`n" }
    Write-Output $line
    Add-Content -LiteralPath $OutFile -Value $line
}

# -------------------------------------------------------------
# 1a. Fichiers de config drizzle + contenu (non sensible)
# -------------------------------------------------------------
Write-Block '1a. FICHIERS CONFIG DRIZZLE (lecture seule)' (Invoke-Remote "bash -lc 'cd /var/www/palacio && echo \"--- ls drizzle.config.* ---\" && ls -la drizzle.config.* 2>/dev/null || echo AUCUN && echo && echo \"--- drizzle.config.ts ---\" && cat drizzle.config.ts 2>/dev/null || echo ABSENT'")

# -------------------------------------------------------------
# 1b. Cles .env (valeurs masquees)
# -------------------------------------------------------------
Write-Block '1b. CLES .env (valeurs masquees)' (Invoke-Remote "bash -lc 'cd /var/www/palacio && echo \"--- .env (cles, valeurs masquees) ---\" && sed \"s/=.*/=<MASQUE>/.\" .env 2>/dev/null || echo ABSENT'")

# -------------------------------------------------------------
# 1c. Presence DATABASE_URL
# -------------------------------------------------------------
Write-Block '1c. PRESENCE DATABASE_URL' (Invoke-Remote "bash -lc 'cd /var/www/palacio && grep -c \"^DATABASE_URL=\" .env 2>/dev/null && echo PRESENTE || echo ABSENTE'")

# -------------------------------------------------------------
# 2. DATABASE_URL (mot de passe masque)
# -------------------------------------------------------------
$sec2 = Invoke-Remote "bash -lc 'cd /var/www/palacio && url=\$(grep -E \"^DATABASE_URL=\" .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d \"\x27\"); if [ -z \"\$url\" ]; then echo DATABASE_URL_ABSENTE; exit 0; fi; safe=\$(echo \"\$url\" | sed -E \"s#://([^:@/]+):[^@]+@#://\\1:<MOT_DE_PASSE_MASQUE>@#\"); if [ \"\$safe\" = \"\$url\" ]; then echo \"DATABASE_URL (sans mot de passe) : \$url\"; else echo \"DATABASE_URL (masquee) : \$safe\"; fi; echo \"host/database/user :\"; echo \"\$url\" | sed -E \"s#^postgres(ql)?://##\" | sed -E \"s#:[^@]+@#@#\" | awk -F\"[@/]\" \"{print \\\"user=\\\"\\$1\\\"  host=\\\"\\$2\\\"  db=\\\"\\$NF}\"'"
Write-Block '2. DATABASE_URL (mot de passe masque)' $sec2

# -------------------------------------------------------------
# 3a. Versions drizzle-kit / drizzle-orm / next
# -------------------------------------------------------------
$sec3a = Invoke-Remote "bash -lc 'cd /var/www/palacio && node -e \"for (const p of [\"drizzle-kit\",\"drizzle-orm\",\"next\"]) { try { console.log(p + \"=\" + require(p + \"/package.json\").version) } catch (e) { console.log(p + \"= absent\") } }\"'"
Write-Block '3a. VERSIONS drizzle-kit / drizzle-orm / next' $sec3a

# -------------------------------------------------------------
# 3b. package.json scripts
# -------------------------------------------------------------
$sec3b = Invoke-Remote "bash -lc 'cd /var/www/palacio && node -e \"const s = JSON.parse(require(\"fs\").readFileSync(\"package.json\",\"utf8\")).scripts; console.log(JSON.stringify(s,null,2))\"'"
Write-Block '3b. PACKAGE.JSON SCRIPTS' $sec3b

# -------------------------------------------------------------
# 4a. pm2 jlist detaille
# -------------------------------------------------------------
$sec4a = Invoke-Remote "bash -lc 'pm2 jlist 2>/dev/null | node -e \"let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{const a=JSON.parse(s);for(const p of a){console.log(\"name=\"+p.name+\" status=\"+p.pm2_env.status+\" uptime=\"+new Date(p.pm2_env.pm_uptime).toISOString()+\" restarts=\"+p.pm2_env.restart_time+\" script=\"+p.pm2_env.pm_exec_path+\" cwd=\"+p.pm2_env.pm_cwd+\" node=\"+p.pm2_env.node_version)}}catch(e){console.log(\"jlist indisponible: \"+e.message)}})\"'"
Write-Block '4a. PM2 JLIST (details)' $sec4a

# -------------------------------------------------------------
# 4b. pm2 describe palaciohotel
# -------------------------------------------------------------
Write-Block '4b. PM2 DESCRIBE palaciohotel' (Invoke-Remote "bash -lc 'pm2 describe palaciohotel 2>/dev/null || echo introuvable'")

# -------------------------------------------------------------
# 9. Integrite des sauvegardes (pg_restore --list)
# -------------------------------------------------------------
$sec9 = Invoke-Remote "bash -lc 'for f in /var/backups/palacio/*.dump /var/backups/palacio/*.sql /root/backups/*.dump; do [ -f \"\$f\" ] || continue; echo \"--- \$f \$(du -h \"\$f\" | cut -f1) ---\"; if [ ! -r \"\$f\" ]; then echo \"  DROIT : non lisible\"; continue; fi; case \"\$f\" in *.dump) if command -v pg_restore >/dev/null 2>&1; then if pg_restore --list \"\$f\" >/dev/null 2>&1; then echo \"  INTEGRITE OK\"; else echo \"  INTEGRITE KO\"; fi; else echo \"  pg_restore absent\"; fi;; *.sql) head -c 200 \"\$f\" >/dev/null 2>&1 && echo \"  SQL lisible\";; esac; done; echo termine'"
Write-Block '9. INTEGRITE DES SAUVEGARDES' $sec9

Write-Output "`nSupplement termine."