#!/usr/bin/env bash
set -e
cd /var/www/palacio
f=src/components/admin/admin-settings.tsx
cp "$f" /tmp/admin-settings.tsx.bak2
python3 - <<'EOF'
import io
p = "src/components/admin/admin-settings.tsx"
s = io.open(p, encoding="utf-8").read()
old = '"quoteStampUrl", "quoteSignerName"'
new = '"quoteStampUrl", "pageHeroImage", "galleryImage2", "galleryImage3", "fallbackImage", "quoteSignerName"'
assert s.count(old) == 1, "motif introuvable ou multiple"
io.open(p, "w", encoding="utf-8", newline="").write(s.replace(old, new))
print("patched")
EOF
grep -c pageHeroImage "$f"
md5sum "$f"
