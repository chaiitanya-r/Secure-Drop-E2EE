# Secure Drop E2EE — Zero-Knowledge Cryptographic File Sharing & Access Control

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg?logo=react)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.x-black.svg?logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-GridFS-green.svg?logo=mongodb)](https://www.mongodb.com/)
[![WebCrypto](https://img.shields.io/badge/Security-W3C_WebCrypto_E2EE-red.svg)](https://w3c.github.io/webcrypto/)
[![AEAD](https://img.shields.io/badge/Cipher-AES--256--GCM-orange.svg)]()
[![STRIDE](https://img.shields.io/badge/Threat_Model-STRIDE_Compliant-purple.svg)](./SECURITY.md)

An enterprise-grade, **Zero-Knowledge End-to-End Encrypted (E2EE)** file storage and sharing platform. Built with a defense-in-depth architecture where the server operates as an **untrusted ciphertext coordinator**: file payloads are encrypted client-side in the browser via the W3C Web Cryptography API (`crypto.subtle`) before transit, keys are transported via RFC 3986 URI hash fragment isolation, and all file operations are recorded in an append-only, tamper-evident SHA-256 hash-chained audit ledger.

---

## Key Features & Security Architecture

### 1. True Zero-Knowledge Client-Side E2EE
- **Browser-Native Encryption**: Files are encrypted directly in the user's browser runtime using **AES-256-GCM** (256-bit symmetric key, 96-bit random IV, 128-bit authentication tag) via `window.crypto.subtle`.
- **Hybrid Key Wrapping**: Per-file symmetric AES keys are encrypted under the recipient's **RSA-OAEP-2048** public key (`SHA-256` MGF1) *before* reaching the network. The backend server never possesses plaintext file data or unencrypted file keys.
- **Volatile Master Key Lifecycle**: User private keys are protected at rest with **PBKDF2-HMAC-SHA-512** (150,000 iterations + salt) and AES-256-GCM. Unlocked `CryptoKey` instances reside exclusively in browser volatile memory and are purged on tab close or session lock.

### 2. Ephemeral Burn-on-Read Share Links (RFC 3986 `#key` Isolation)
- **Zero-Knowledge Public Distribution**: Generate shareable links for unauthenticated recipients with configurable TTL expiration and download quotas (`maxDownloads: 1` for burn-on-read).
- **Client-Side Key Isolation**: The symmetric AES decryption key is encapsulated in the **URI hash fragment** (`https://domain.com/#/share/<token>#key=<raw_hex>`). Per RFC 3986 §3.5 and HTTP standards, URI fragments are **never sent to HTTP servers**, guaranteeing server logs and reverse proxies remain zero-knowledge.
- **Atomic Quota Enforcement**: Once the download threshold is reached or TTL expires, backend returns `HTTP 410 Gone` and deactivates the link permanently.

### 3. Tamper-Evident SHA-256 Hash-Chained Audit Ledger
- **Cryptographic Chaining**: Every system event (`AUTH_LOGIN`, `FILE_UPLOAD_CLIENT_ZK`, `FILE_SHARE_CLIENT_ZK`, `EPHEMERAL_DOWNLOAD`) is hashed into a sequential blockchain-inspired ledger:
  $$\text{Hash}_i = \text{SHA-256}(i \parallel \text{Hash}_{i-1} \parallel \text{Timestamp} \parallel \text{Action} \parallel \text{Actor} \parallel \text{FileID} \parallel \text{Details})$$
- **Mathematical Integrity Verification**: An integrated verification engine recalculates the hash chain from genesis block ($i=0$) to the head; any unauthorized modification, deletion, or bit-flip in the database is detected instantly with specific entry corruption attribution.

### 4. Interactive Cryptographic Pipeline Visualizer
- **Real-Time Cryptographic Sandbox**: An embedded interactive inspector allowing users to simulate WebCrypto AES-GCM and RSA-OAEP operations in real-time, inspect IV byte distributions, AEAD auth tags, and observe payload entropy transitions.
- **Vault File Inspector**: Inspect encrypted chunks, GridFS storage metadata, recipient public key encryptions, and verify AEAD integrity tags directly from the dashboard.
- **Clean Cyber Interface**: Designed with custom CSS design tokens, radiant accents, and typography optimized with `Inter` and `JetBrains Mono` with crisp SVG iconography.

---

## Architecture & Cryptographic Data Flows

### A. Zero-Knowledge Client-Side Upload Flow

```
[User Browser (WebCrypto API)]              [Express Backend]             [MongoDB GridFS]
             │                                       │                             │
  1. Generate AES-256-GCM Key (256-bit)              │                             │
  2. Encrypt File Bytes ─────────────┐               │                             │
     (Ciphertext + 12B IV + 16B Tag) │               │                             │
  3. Fetch Recipient RSA Public Key  │               │                             │
  4. Encrypt AES Key (RSA-OAEP-2048) │               │                             │
             │                                       │                             │
             │ POST /api/files/upload                │                             │
             │ Multipart: { Ciphertext Stream,       │                             │
             │   IV, Tag, EncryptedKey, ACL }        │                             │
             └──────────────────────────────────────>│                             │
                                                     │ Stream raw ciphertext       │
                                                     ├────────────────────────────>│
                                                     │ Store BSON File Metadata    │
                                                     │ (Owner, ACL, IV, Tag)       │
                                                     ├────────────────────────────>│
                                                     │ Append Audit Log            │
                                                     │ (Chain Hash update)         │
                                                     ├────────────────────────────>│
                                                     │                             │
                                      201 Created    │                             │
             <───────────────────────────────────────┤                             │
```

---

### B. Ephemeral Burn-on-Read Share Flow (`#key` Isolation)

```
[Sender Browser]                   [Recipient Browser]                  [Backend API]
       │                                    │                                 │
  Generate Link:                            │                                 │
  POST /api/files/:id/ephemeral-link        │                                 │
  (expiresInHours, maxDownloads)            │                                 │
       ├─────────────────────────────────────────────────────────────────────>│
       │<─────────────────────────────────────────────────────────────────────┤ Returns { token }
       │                                    │                                 │
  Format Link:                              │                                 │
  https://app.com/#/share/<token>#key=<aes> │                                 │
  (Delivered out-of-band via chat/email)    │                                 │
       │                                    │                                 │
       └───────────────────────────────────>│ User opens link                 │
                                            │ Extract #key from window.hash   │
                                            │ (Key NEVER sent over network)   │
                                            │                                 │
                                            │ GET /api/public/share/<token>   │
                                            ├────────────────────────────────>│ Verify quota
                                            │<────────────────────────────────┤ Return metadata
                                            │                                 │
                                            │ GET .../download                │
                                            ├────────────────────────────────>│ Atomic quota -1
                                            │<────────────────────────────────┤ Stream ciphertext
                                            │ Decrypt in WebCrypto with #key  │ (Mark 410 if burned)
                                            │ Verified plaintext download     │
```

---

### C. Tamper-Evident Audit Ledger Structure

```
 ┌─────────────────────────┐       ┌─────────────────────────┐       ┌─────────────────────────┐
 │ Entry #0 (Genesis)      │       │ Entry #1                │       │ Entry #2 (Head)         │
 ├─────────────────────────┤       ├─────────────────────────┤       ├─────────────────────────┤
 │ Action: SYSTEM_INIT     │       │ Action: FILE_UPLOAD_ZK  │       │ Action: EPHEMERAL_READ  │
 │ PrevHash: "0"           │  ┌───>│ PrevHash: Hash(#0)      │  ┌───>│ PrevHash: Hash(#1)      │
 │ Data: { ... }           │  │    │ Data: { ... }           │  │    │ Data: { ... }           │
 │ CurrHash: SHA-256(...)  ├──┘    │ CurrHash: SHA-256(...)  ├──┘    │ CurrHash: SHA-256(...)  │
 └─────────────────────────┘       └─────────────────────────┘       └─────────────────────────┘
```

---

## Repository Structure

```
secure-file-sharing/
├── backend/
│   ├── src/
│   │   ├── app.ts                     # Express application wiring, CORS, rate limits
│   │   ├── controllers/
│   │   │   ├── authController.ts      # User registration, keypair storage, JWT auth
│   │   │   ├── fileController.ts      # Zero-Knowledge upload/download & ACL sharing
│   │   │   ├── ephemeralController.ts # Burn-on-read link generation & public download
│   │   │   └── auditController.ts     # Audit ledger retrieval & verify controller
│   │   ├── middleware/
│   │   │   ├── auth.ts                # JWT authentication guard
│   │   │   └── validate.ts            # Joi schema & BSON ObjectId validators
│   │   ├── models/
│   │   │   ├── User.ts                # User schema + PBKDF2-encrypted RSA private key
│   │   │   ├── File.ts                # File schema + ACL encrypted keys, IV, tag
│   │   │   ├── EphemeralLink.ts       # Burn-on-read token schema with download counts
│   │   │   └── AuditLog.ts            # Sequential tamper-evident hash-chained model
│   │   ├── routes/
│   │   │   ├── auth.ts                # /api/auth routes
│   │   │   ├── files.ts               # /api/files routes (rate-limited)
│   │   │   ├── publicShare.ts         # /api/public/share unauthenticated endpoints
│   │   │   └── audit.ts               # /api/audit retrieval & chain verification
│   │   ├── security/
│   │   │   ├── crypto.ts              # Node.js cryptographic primitives
│   │   │   ├── keyWrap.ts             # AES key-wrap helpers
│   │   │   └── auditChain.ts          # SHA-256 canonical hashing & verification
│   │   └── storage/gridfs.ts          # MongoDB GridFS bucket streaming factory
│   └── tests/
│       ├── setup.ts                   # In-memory MongoDB testing environment
│       ├── auth.test.ts               # Registration and authentication test suite
│       ├── files.test.ts              # Hybrid upload & download test suite
│       ├── zk-files.test.ts           # True client-side E2EE integration suite
│       ├── ephemeral.test.ts          # Burn-on-read & RFC 3986 key isolation tests
│       └── audit.test.ts              # Hash chain verification & tamper detection
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts              # Strongly typed API client with binary fetch
│   │   │   ├── auth.ts                # Auth API bindings
│   │   │   ├── files.ts               # File & ephemeral link API bindings
│   │   │   └── audit.ts               # Audit ledger API bindings
│   │   ├── components/
│   │   │   ├── icons.tsx              # Clean inline SVG icon system
│   │   │   ├── FileUpload.tsx         # Drag-and-drop client WebCrypto encryptor
│   │   │   ├── FileList.tsx           # File list with security badges & inspect triggers
│   │   │   ├── ShareModal.tsx         # User-to-user RSA sharing + Ephemeral link generator
│   │   │   ├── PublicShareView.tsx    # Ephemeral burn-on-read recipient download portal
│   │   │   ├── AuditLogModal.tsx      # Live cryptographic audit ledger & verifier
│   │   │   ├── CryptoVisualizerModal.tsx # Interactive WebCrypto pipeline sandbox
│   │   │   └── UnlockKeyModal.tsx     # In-memory WebCrypto private key unlocker
│   │   ├── contexts/AuthContext.tsx   # Auth state and encrypted key management
│   │   ├── hooks/usePrivateKey.ts     # Ephemeral in-memory CryptoKey store
│   │   ├── lib/crypto.ts              # Browser WebCrypto API primitives (W3C standard)
│   │   └── App.tsx                    # Primary dashboard orchestration
├── SECURITY.md                        # Formal STRIDE Threat Model & Security Policy
└── README.md                          # Technical architecture & engineering manual
```

---

## Quick Start & Local Execution

### Prerequisites
- Node.js (v18+)
- MongoDB (v6+) or MongoDB Atlas

### 1. Backend Setup

```bash
cd backend
cp env.example .env    # Configure your environment secrets
npm install

# Run automated test suites (5 suites, 100% passing)
npm test

# Launch development server with hot-reload
npm run dev
```

#### Backend Environment Variables (`.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `MONGO_URI` | MongoDB Connection String (GridFS enabled) | `mongodb://localhost:27017/secure-files` |
| `PORT` | API Server Port | `4000` |
| `JWT_SECRET` | Secret key for JWT signing | `super-secret-jwt-key-min-32-chars` |
| `JWT_EXPIRES_IN` | JWT TTL token duration | `24h` |
| `KEY_WRAP_SECRET` | 256-bit secret used for server-side key wrapping | `super-secret-wrap-key-min-32-chars` |
| `CORS_ORIGIN` | Allowed client origin(s) | `http://localhost:3000,http://127.0.0.1:3000` |

### 2. Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install

# Start Vite development server
npm run dev
```

Visit `http://localhost:3000` (or `http://127.0.0.1:3000`) in your browser.

---

## Test Suite Coverage

The project features automated integration tests executing against an isolated in-memory MongoDB engine (`mongodb-memory-server`):

```bash
cd backend
npm test
```

```
 PASS  tests/auth.test.ts
 PASS  tests/files.test.ts
 PASS  tests/zk-files.test.ts
 PASS  tests/ephemeral.test.ts
 PASS  tests/audit.test.ts

Test Suites: 5 passed, 5 total
Tests:       6 passed, 6 total
Snapshots:   0 total
Time:        15.18 s
Ran all test suites.
```

---

## API Reference

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register user; generates RSA-2048 keypair, stores encrypted private key | Public |
| `POST` | `/api/auth/login` | Authenticate user; returns signed JWT + encrypted private key | Public |
| `GET` | `/api/auth/me` | Fetch active user profile and public key | `JWT` |
| `GET` | `/api/auth/public-key?email=:email` | Retrieve recipient's RSA public key for client-side encryption | `JWT` |

### Zero-Knowledge File Management (`/api/files`)
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/files/upload` | Upload client-encrypted ciphertext stream + IV + tag | `JWT` |
| `GET` | `/api/files` | List files owned or shared with the authenticated user | `JWT` |
| `GET` | `/api/files/:id` | Fetch file metadata & user's encrypted AES key | `JWT + ACL` |
| `GET` | `/api/files/:id/download` | Stream encrypted binary ciphertext + crypto headers | `JWT + ACL` |
| `POST` | `/api/files/:id/share` | Add user to ACL with client-re-encrypted AES key | `JWT + Owner` |
| `POST` | `/api/files/:id/ephemeral-link` | Create burn-on-read ephemeral share link with TTL | `JWT + Owner` |

### Ephemeral Public Sharing (`/api/public/share`)
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/public/share/:token` | Fetch ephemeral share metadata, download quota & expiry | Public |
| `GET` | `/api/public/share/:token/download` | Stream encrypted file; decrements quota, burns link on max | Public |

### Tamper-Evident Audit Ledger (`/api/audit`)
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/audit` | Retrieve historical audit entries | `JWT` |
| `GET` | `/api/audit/verify` | Recalculate genesis-to-head SHA-256 chain and return validation report | `JWT` |

---

## Security Policy & STRIDE Compliance

A comprehensive, formal **STRIDE Threat Model** covering Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege is documented in [`SECURITY.md`](./SECURITY.md).
