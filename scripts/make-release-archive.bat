@echo off
REM Archive de release : uniquement le code necessaire au staging
cd /d D:\PalacioHotela
tar -cf release-staging.tar ^
  --exclude=".env" ^
  --exclude=".next" ^
  --exclude="node_modules" ^
  --exclude=".kilo" ^
  --exclude="stripe_*" ^
  --exclude="audit-db.js" ^
  --exclude="audit-vps-results.txt" ^
  --exclude="build-output.txt" ^
  --exclude="lint-output.txt" ^
  --exclude="server-output.txt" ^
  --exclude="test-out.txt" ^
  --exclude="tsconfig.tsbuildinfo" ^
  --exclude="drizzle.config.json" ^
  --exclude="setup-server.sh" ^
  --exclude="test-flows.cjs" ^
  --exclude=".codaignore" ^
  --exclude=".gitignore" ^
  --exclude=".gitattributes" ^
  --exclude="scripts/caudit-*" ^
  --exclude="scripts/audit-*" ^
  --exclude="scripts/vps-deploy-*" ^
  --exclude="scripts/transfer-data.ps1" ^
  --exclude="scripts/check-restore.js" ^
  --exclude="drizzle/0016_site_settings_location.sql" ^
  --exclude="public/uploads" ^
  --exclude="release-staging.tar" ^
  src drizzle public scripts/ai-chat.test.ts next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs vercel.json deploy.sh package.json package-lock.json
dir release-staging.tar
