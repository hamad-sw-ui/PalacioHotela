cd /var/www/palacio-release
node --import tsx --test scripts/quote-regression.test.ts scripts/quote-draft.test.ts > /tmp/t-quote.txt 2>&1
echo "QUOTE_EXIT=$?"
grep -E '^ℹ (tests|pass|fail)' /tmp/t-quote.txt
node --import tsx --test scripts/payments.test.ts scripts/booking-refund.test.ts > /tmp/t-pay.txt 2>&1
echo "PAY_EXIT=$?"
grep -E '^ℹ (tests|pass|fail)' /tmp/t-pay.txt
node --import tsx --test scripts/availability-search.test.ts scripts/catalog-gallery.test.ts scripts/catalog-features.test.ts > /tmp/t-cat.txt 2>&1
echo "CAT_EXIT=$?"
grep -E '^ℹ (tests|pass|fail)' /tmp/t-cat.txt
node --import tsx --test scripts/smtp.test.ts scripts/integration-settings.test.ts > /tmp/t-smtp.txt 2>&1
echo "SMTP_EXIT=$?"
grep -E '^ℹ (tests|pass|fail)' /tmp/t-smtp.txt
