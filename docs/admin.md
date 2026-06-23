# VakilAI — Admin Dashboard Guide

## How to Access

1. **Start the services**
   ```bash
   cd backend  && uvicorn main:app --reload --port 8000
   cd frontend && npm run dev
   ```

2. **Open** `http://localhost:3000/admin`

3. **You must be logged in as a user with `role = "admin"`.**
   The edge middleware (`src/middleware.ts`) blocks unauthenticated visits and
   redirects to `/`. The backend enforces `require_admin` on every API call — a
   non-admin JWT returns `403 Forbidden`.

---

## Bootstrap: Creating the First Admin

There is no self-registration path for admin accounts.
Promote an existing user directly in MongoDB:

```bash
# Connect to the running MongoDB container
docker exec -it vakilai-mongo mongosh vakilai \
  -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin

# Inside mongosh — replace the email below
db.users.updateOne(
  { email: "yourname@example.com" },
  { $set: { role: "admin", updated_at: new Date() } }
)
```

Log out and log back in so the new role is encoded into the JWT cookie.

---

## Navigation

Once logged in as admin you see a dedicated sidebar:

| Sidebar entry | Destination |
|---|---|
| Admin Dashboard | `/admin` (Overview tab) |
| User Management | `/admin` → Users tab |
| AI Metrics | `/admin` → AI Metrics tab |
| Security Log | `/admin` → Security tab |
| System Health | `/admin` → Health tab |

---

## Tabs & Capabilities

### 1. Overview

**URL:** `GET /api/v1/admin/overview`

Shows real-time KPI cards:

| Section | Metrics |
|---|---|
| Users | Total, lawyers/firms, new today, new this week |
| Consultations | Total, currently active (pending + confirmed) |
| AI Usage | Queries today, queries last 7 days, token estimate, cost estimate (USD) |
| Revenue | Month-to-date captured payments (INR) |
| Security | Active locked accounts, active blacklisted tokens |

---

### 2. Users

**URLs:** `GET /api/v1/admin/users`, `PATCH /api/v1/admin/users/{id}`, `DELETE /api/v1/admin/users/{id}`

#### List & Filter

| Filter | Options |
|---|---|
| Search | Name or email (case-insensitive substring) |
| Role | consumer, lawyer, firm_admin, client_portal, admin |
| Status | Active / Inactive |
| Pagination | 20 per page, prev/next controls |

#### Edit User (via modal)

Click **Edit** on any row to open the edit modal. You can change:

- **Role** — any of the 5 valid roles
- **Subscription Plan** — free, starter, plus, advocate_starter, advocate_pro, advocate_firm, basic, business, pro
- **Status** — Active or Inactive

All changes are validated server-side. The backend rejects invalid roles/plans with `400 Bad Request`.

#### Deactivate User

Click **Deactivate** to soft-delete a user (`is_active = false`). This:
- Immediately blocks login for that user
- Does NOT delete data

You **cannot** deactivate your own admin account (the backend rejects it with `400`).

To re-activate, open the Edit modal and set Status → Active.

---

### 3. AI Metrics

**URL:** `GET /api/v1/admin/ai-metrics?days={7|14|30|90}`

#### Daily Usage Table

Shows per-day breakdown for the selected period:

| Column | Description |
|---|---|
| Date | UTC date |
| Queries | Total AI consultation requests |
| Tokens | Estimated total tokens (input + output) |
| Cost (USD) | Estimated cost at Claude Sonnet pricing ($3/$15 per MTok) |

#### Top 10 Users by Query Count

Lists the 10 highest-usage users with email (if resolvable), query count, and token count.
Use this to spot abuse or heavy users who might need plan upgrades.

#### By Endpoint

Breakdown of query volume per AI endpoint (e.g. `/ai/consult`, `/ai/documents/generate`).

---

### 4. Security Log

**URL:** `GET /api/v1/admin/security-log?limit={50|100|200}`

#### Locked Accounts

Lists accounts currently locked out due to ≥5 failed login attempts within 15 minutes.

| Column | Description |
|---|---|
| Email | The locked account |
| Attempts | Number of failed attempts |
| Locked Until | When the lockout expires automatically |
| Last Attempt | Timestamp of the last failed attempt |
| Action | **Unlock** — immediately clears the lockout |

Click **Unlock** to restore access without waiting for the 15-minute window to expire.
The action is logged at `WARNING` level with the admin's user_id.

#### Active Revoked Tokens

Lists JWT tokens that were explicitly revoked (logout, security incident).
These remain in the blacklist until their natural expiry.
Useful to confirm that a compromised token has been invalidated.

---

### 5. System Health

**URL:** `GET /api/v1/admin/health`

Performs live connectivity checks against all services:

| Service | What is checked |
|---|---|
| `mongodb` | `db.admin.command("ping")` |
| `redis` | `PING` command via aioredis |
| `ai_service` | `GET {AI_SERVICE_URL}/health` (HTTP 200) |

**Overall status**: `ok` (all green) or `degraded` (any failure).

Click **Check Now** to re-run the checks on demand.

---

### 6. Config & Keys

**URLs:** `GET /api/v1/admin/config`, `PUT /api/v1/admin/config/{key}`, `DELETE /api/v1/admin/config/{key}`

Manage all platform API keys and secrets from the UI. Values are encrypted before storage and the database never holds plaintext.

#### Encryption design

| Layer | Detail |
|---|---|
| KDF | PBKDF2-HMAC-SHA256, 100 000 iterations |
| Input | `CONFIG_ENCRYPTION_KEY` env-var + per-entry 16-byte random salt |
| Cipher | AES-256-GCM (authenticated — tampering is detected on decrypt) |
| Per write | Fresh salt + fresh 12-byte nonce → identical values produce different ciphertexts |
| Stored | `nonce ‖ ciphertext` as base64, salt as base64, no plaintext |

> **Set `CONFIG_ENCRYPTION_KEY`** in your `.env` before storing any values.
> Generate one with: `python -c "import secrets; print(secrets.token_hex(32))"`
> If the var is absent, an ephemeral key is used and DB values will be unreadable after restart.

#### Lookup order

```
DB (decrypted) → os.environ → None
```

#### Source badges

| Badge | Meaning |
|---|---|
| **DB** (green) | Value stored encrypted in MongoDB — takes precedence |
| **ENV** (blue) | Value present in environment variable only |
| **NOT SET** (red) | Not configured anywhere |

#### Known key categories

| Category | Keys |
|---|---|
| AI | ANTHROPIC_API_KEY, PINECONE_API_KEY |
| Payments | RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET |
| Storage | AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET |
| Communication | TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, WHATSAPP_API_TOKEN, WHATSAPP_PHONE_ID |
| Monitoring | SENTRY_DSN, METRICS_TOKEN |
| Internal | INTERNAL_SERVICE_KEY, REDIS_URL |
| Custom | Any key you add manually |

#### Operations

- **Set / Update** — click the button next to any key, enter the value (show/hide toggle), click *Save Encrypted*
- **Remove from DB** — available only for DB-sourced keys; after removal the system falls back to the env-var
- **Custom Key** — click *+ Custom Key*, enter an uppercase key name and value

#### Security notes

- Values are never sent back to the client in plaintext — the API only returns masked values (`ABCD****WXYZ`)
- All write/delete operations are logged with admin user ID
- Key names are validated: uppercase letters, digits, underscores only

---

## Backend API Reference

All endpoints require a valid `role=admin` JWT (httpOnly cookie `vk_session` or `Authorization: Bearer` header).
All return `403 Forbidden` for non-admin callers.

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/admin/overview` | KPI snapshot |
| GET | `/api/v1/admin/users` | Paginated user list |
| PATCH | `/api/v1/admin/users/{id}` | Edit role / plan / status |
| DELETE | `/api/v1/admin/users/{id}` | Soft-deactivate user |
| DELETE | `/api/v1/admin/security/lockout/{email}` | Unlock a locked account |
| GET | `/api/v1/admin/ai-metrics?days=7` | AI usage metrics |
| GET | `/api/v1/admin/security-log?limit=50` | Security events |
| GET | `/api/v1/admin/health` | Live service health |
| GET | `/api/v1/admin/config` | List all config keys (masked) |
| PUT | `/api/v1/admin/config/{key}` | Set / update a config key |
| DELETE | `/api/v1/admin/config/{key}` | Remove key from DB (env fallback) |

---

## Security Notes

- **Server-side enforcement**: every admin route calls `require_admin` which validates the JWT and checks `role === "admin"`. Frontend role checks are a UX convenience only.
- **Audit logging**: all write actions (user patch, deactivate, unlock) are logged with `admin_user_id` and `target` at `WARNING` level.
- **Self-protection**: admins cannot deactivate their own account.
- **Sensitive fields stripped**: `hashed_password`, `mfa_secret`, `mfa_pending_secret` are removed from all user responses.
- **Edge guard**: `src/middleware.ts` redirects unauthenticated requests to `/admin/*` before they reach the app.

---

## Known Limitations / Future Work

| Gap | Workaround |
|---|---|
| No hard-delete for users | Deactivate; purge manually from MongoDB if needed (DPDP right-to-erasure) |
| No payment / transaction history tab | Query `db.payments` directly or add a future `/api/v1/admin/payments` endpoint |
| No consultation management tab | Query `db.consultations` directly |
| No CSV export | Use MongoDB Compass or `mongoexport` for bulk exports |
| AI cost estimate is approximate | Based on token count ÷ 4 heuristic; integrate Anthropic billing API for exact figures |
