:
cd /var/www/palacio-release
npx eslint . > /tmp/lint-out.txt 2>&1
echo "LINT_EXIT=$?"
wc -l /tmp/lint-out.txt
tail -2 /tmp/lint-out.txt
