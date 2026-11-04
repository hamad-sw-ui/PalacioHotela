:
pm2 logs palaciohotel --lines 40 --nostream 2>/dev/null | grep -B3 -A8 'useSite' | head -40
echo "=== date des erreurs ==="
tail -2 /root/.pm2/logs/palaciohotel-error.log | head -c 300
echo
echo "=== pages qui 500 ==="
for p in / /contact /devis /catalogue /connexion /suivi; do code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000$p); echo "$p -> $code"; done