# Dossier

Dossier is a document workflow and signing product.

## Architecture
Dossier combines:
- **Document Workspaces**: Core document sharing and analytics.
- **Documenso Engine**: Embedded document signing and execution.

## Local Setup

### 1. Prerequisites
- Node.js (v20+)
- PostgreSQL database
- Redis (optional, for rate limiting/queues)

### 2. Environment Variables
Create a `.env` file based on `.env.example`. Make sure the following critical variables are set:

#### Database
```env
DATABASE_URL="postgresql://user:password@localhost:5432/dossier"
```

#### Authentication (Google OAuth)
You must set up a Google Cloud project with OAuth Consent (External/Testing mode) and add your email to the Test Users list.
```env
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your_nextauth_secret"
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
```

#### Signing Integration (Documenso)
You need a running Documenso instance (or a hosted account) to process signatures.
```env
NEXT_PUBLIC_DOCUMENSO_URL="http://localhost:3002"
DOCUMENSO_API_KEY="your_documenso_api_key"
NEXT_PRIVATE_VERIFICATION_SECRET="a_secure_random_string_for_token_signing"
```

#### Webhooks
For local development, use tools like `ngrok` or `localtunnel` to expose your port `3000`, and configure Documenso to send webhooks to `https://<your-ngrok>/api/webhooks/signing`.
```env
DOCUMENSO_WEBHOOK_SECRET="your_documenso_webhook_secret"
```

### 3. Database Migration
Run Prisma migrations to set up the schema:
```bash
npx prisma migrate dev
```

### 4. Start Development Server
```bash
npm run dev
```

## Running Tests
Ensure your code changes pass all CI checks before opening a pull request.

- **Type Check**: `npx tsc --noEmit`
- **Unit Tests**: `npm run test`
- **Signing Unit Tests**: `npm run test:signing`
- **Integration Tests**: `npm run test:integration`

## Manual Signing Smoke Test
To verify the entire signing loop works locally:
1. Log in via Google OAuth at `http://localhost:3000`.
2. Upload a sample PDF document to a workspace.
3. Click "Request Signature" and add a recipient (e.g. your own email).
4. Place the signature fields in the embedded Documenso editor.
5. Create the request.
6. Open the secure recipient link in an incognito window.
7. Sign the document.
8. Verify that the webhook is received and the document status updates to `COMPLETED` in Dossier.
9. Download the signed artifact to confirm successful mirroring.
