$ErrorActionPreference = "Stop"
$key = "$env:USERPROFILE\.ssh\palacio_audit_ed25519"
$host_vps = "root@2.24.49.223"

Write-Output "=== 1. Build ID + date du build ==="
ssh -i $key -o StrictHostKeyChecking=no -o ConnectTimeout=10 $host_vps "cat /var/www/palacio/.next/BUILD_ID; echo; stat -c '%y' /var/www/palacio/.next/BUILD_ID"

Write-Output "=== 2. Verification du bundle : plus de memberHref sur /reservation ==="
ssh -i $key -o StrictHostKeyChecking=no $host_vps "grep -rl 'memberHref' /var/www/palacio/.next/static/chunks 2>/dev/null | head -5; echo '--- occurences reservation-to-compte dans le chunk home ---'; grep -o 'compte?next=' /var/www/palacio/.next/static/chunks/*.js 2>/dev/null | wc -l"

Write-Output "=== 3. Page d'accueil publique : contient un lien direct /reservation ==="
ssh -i $key -o StrictHostKeyChecking=no $host_vps "curl -s http://localhost:3000/ > /tmp/home.html; grep -c '002Freservation' /tmp/home.html"

Write-Output "=== 4. /reservation sert bien le formulaire invitu (NOM COMPLET sans session) ==="
ssh -i $key -o StrictHostKeyChecking=no $host_vps "curl -s http://localhost:3000/reservation > /tmp/res.html; grep -o 'NOM COMPLET' /tmp/res.html | head -1; grep -o '002Fcompte' /tmp/res.html | head -1; echo '(vide = aucune redirection vers compte)'"

Write-Output "=== 5. Header : bouton nav-book absent ==="
ssh -i $key -o StrictHostKeyChecking=no $host_vps "grep -o 'nav-book' /tmp/home.html | wc -l"

Write-Output "=== 6. Routes publiques = 200 ==="
ssh -i $key -o StrictHostKeyChecking=no $host_vps "for p in / /hebergements /reservation /devis /compte /contact /pages/notre-histoire /api/health; do printf '%s -> ' `$p; curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000`$p; done"
