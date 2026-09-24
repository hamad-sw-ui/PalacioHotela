# Palacio Hotel

Site hôtelier bilingue FR/EN avec réservations, devis PDF en XAF TTC, paiement sur place ou en ligne, espace client et backoffice.

## Démarrer

1. Configurer `DATABASE_URL` et les variables utiles depuis `.env.example`.
2. Installer les dépendances : `npm install`.
3. Créer les tables : `npx drizzle-kit push`.
4. Démarrer : `npm run dev` ou `npm run build && npm run start`.

Au premier démarrage, le catalogue, les pages et un compte administrateur sont initialisés. **Démo locale uniquement** : `admin@palaciohotel.com` / `Palacio2026!` si `ADMIN_EMAIL` et `ADMIN_PASSWORD` ne sont pas renseignés. Pour une installation réelle, définir ces variables **avant le premier démarrage** et définir impérativement `SESSION_SECRET` (un secret long et aléatoire). Le changement ultérieur du mot de passe d'un compte existant se fait dans le backoffice.

### Connexion (onglet normal et aperçu intégré)

La session fonctionne aussi lorsque le site est affiché dans l'iframe d'un autre site (aperçu d'un outil de création, par exemple), là où les navigateurs refusent les cookies `SameSite=Lax`. Trois supports portent le même jeton signé :

1. un cookie `SameSite=Lax` pour un onglet classique ;
2. un cookie `SameSite=None; Secure; Partitioned`, accepté dans un aperçu intégré ;
3. un jeton envoyé par la page (`Authorization: Bearer`) lorsque le navigateur bloque tous les cookies, comme Safari.

Les modifications effectuées dans l'administration exigent ce jeton ou une requête émise depuis le site lui-même, ce qui protège contre les attaques CSRF. L'écran de connexion propose aussi d'ouvrir le backoffice dans un nouvel onglet.

## Fonctionnement

- `/reservation` : sélection de prestation, contrôle de disponibilité, demande de réservation, paiement sur place ou redirection vers Stripe / PayPal si configurés. La confirmation de la réservation reste manuelle dans `/admin` même après un paiement reçu.
- `/devis` : panier multi-prestations en JSON `selected_items` (hébergement, restauration, salles, services), brouillon local persistant, configurations restaurant (repas, dates, heure et parent), demande enregistrée sous `DEV-YYYY-NNNNN` et accusé de réception PDF. Le backoffice renseigne le montant **global TTC en XAF**, les conditions, la signature et le cachet de l’hôtel, puis envoie le PDF de devis. Le lien privé du client permet de suivre, télécharger, signer et accepter le devis. Les devis finalisés utilisent le modèle PDF thématique version 2 ; les anciennes demandes restent lisibles avec leur modèle historique. Aucun devis n'est converti automatiquement en facture.
- `/admin` : gestion CRUD des réservations, devis, prestations, pages éditoriales, comptes et messages ; notifications, historique d'activité, contenu bilingue, images, logo, thèmes et géolocalisation GPS.
- `/compte` : inscription / connexion et consultation des demandes associées au compte.
- Assistant conversationnel : réponses locales sans clé, ou API OpenAI-compatible / Ollama selon la configuration. Le chatbot n'affirme jamais qu'une réservation est confirmée.
- Liens WhatsApp directs et messages de réservation préremplis.

## Configuration des services

### E-mails

Configurer `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` et `SMTP_FROM` ; `SMTP_SECURE=true` pour le port 465 ou TLS/STARTTLS pour 587. Les e-mails bilingues sont personnalisés et les devis comportent le PDF en pièce jointe. **Sans SMTP, les demandes et notifications du backoffice fonctionnent toujours, mais aucun e-mail externe n'est délivré.** Le backoffice indique l'état de la connexion.

### Carte bancaire (Stripe)

Configurer `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET`. Créer un endpoint Stripe pointant vers `https://votre-domaine/api/payments/stripe/webhook` et écouter `checkout.session.completed` et `checkout.session.async_payment_succeeded`. Les prix sont envoyés en **XAF, sans multiplication par 100**. Les signatures webhooks et les montants sont vérifiés avant de marquer la réservation comme payée.

### PayPal

Configurer `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=sandbox|live` et `PAYPAL_XAF_PER_EUR` avec le taux commercial que vous choisissez d'appliquer. L'API REST PayPal ne prend pas en charge le XAF : le prix hôtelier demeure en XAF et le client est informé que PayPal lui présentera le montant converti en EUR avant de payer. La capture vérifie l'identifiant et le montant de la commande.

### IA

Configurer `AI_API_KEY` / `OPENAI_API_KEY` et éventuellement `AI_BASE_URL`, `AI_MODEL`, `AI_PROVIDER` pour un fournisseur compatible OpenAI. Pour Ollama, choisir `ollama` dans le backoffice et indiquer son URL (par défaut `http://127.0.0.1:11434`) et son modèle. Le mode local FAQ reste toujours disponible en secours.

### Médias

Le backoffice permet d'importer des JPEG, PNG ou WebP (5 Mo maximum) via une route protégée. Les fichiers sont stockés localement dans `public/uploads/media/` et servis par `/api/media/`. Pour un déploiement avec stockage éphémère, raccorder cette route à un stockage persistant (S3 ou équivalent) avant production.

## Notes

- Données et montants du devis en XAF TTC ; pas de ventilation TVA ni génération de facture.
- Les réservations `pending` bloquent les disponibilités jusqu'à traitement manuel ; une demande de devis n'effectue pas de pré-réservation.
- Variables secrètes uniquement côté serveur. Ne jamais exposer les clés de paiement, SMTP et IA dans le navigateur.
