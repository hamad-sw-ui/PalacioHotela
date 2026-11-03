:
echo "=== timestamps des 7 erreurs useSite ==="
grep -n 'useSite' /root/.pm2/logs/palaciohotel-error.log
echo "=== total lignes ==="
wc -l /root/.pm2/logs/palaciohotel-error.log
echo "=== erreurs apres ligne 840 (post-restart) ==="
tail -n 44 /root/.pm2/logs/palaciohotel-error.log | grep -c 'useSite'
