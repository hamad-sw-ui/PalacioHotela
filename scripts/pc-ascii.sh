:
for p in / /contact /devis /hebergements /notre-histoire /connexion /compte /reservation; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3000$p")
  echo "$p -> $code"
done
echo "=== erreurs recentes uniquement ==="
tail -30 /root/.pm2/logs/palaciohotel-error.log | grep -E 'TypeError|Error' | sort -u | head -5
