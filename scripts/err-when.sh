echo "=== toutes les pages membres/auth ==="
for p in /connexion /compte /suivi /devis/suivi; do curl -s -o /dev/null -w "$p: %{http_code}\n" "http://127.0.0.1:3000$p"; done
echo "=== backoffice page ==="
curl -s -o /dev/null -w '/admin: %{http_code}\n' http://127.0.0.1:3000/admin
echo "=== erreur useSite: quand ? ==="
grep -n 'useSite' /root/.pm2/logs/palaciohotel-error.log | head -3
wc -l /root/.pm2/logs/palaciohotel-error.log
echo "=== derniere occurrence timestamp ==="
grep -B1 'useSite' /root/.pm2/logs/palaciohotel-error.log | tail -4
