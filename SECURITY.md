# Security Policy & STRIDE Threat Model

This document outlines the security architecture, formal STRIDE threat model, threat actor profiles, cryptographic guarantees, and vulnerability disclosure policies for the **Secure Drop E2EE** platform.

---

## 1. System Security Overview

The system is designed with a **Zero-Trust / Zero-Knowledge** architecture for document storage and distribution. The server infrastructure acts as an untrusted ciphertext coordinator and storage vault; plaintext file data and unencrypted symmetric encryption keys are strictly isolated to client memory via the browser W3C Web Cryptography API (`window.crypto.subtle`).

### Cryptographic Primitives & Specifications

| Primitive | Standard / Parameter | Purpose | Implementation Layer |
| :--- | :--- | :--- | :--- |
| **Symmetric Payload Cipher** | `AES-256-GCM` (256-bit key, 96-bit IV, 128-bit Auth Tag) | File payload confidentiality and AEAD integrity | Client-Side (`crypto.subtle`) & Node.js `crypto` fallback |
| **Asymmetric Key Exchange** | `RSA-OAEP` (2048-bit modulus, SHA-256 MGF1 hash) | Asymmetric distribution of file AES keys to ACL recipients | Client-Side (`crypto.subtle`) & Node.js `crypto` |
| **Key Derivation (KDF)** | `PBKDF2-HMAC-SHA-512` (150,000 iterations, 128-bit salt) | Deriving master wrap key from user passphrase | Client-Side (`crypto.subtle`) & Node.js `crypto` |
| **Audit Ledger Hashing** | `SHA-256` canonical block chaining | Tamper-evident sequential audit log verification | Backend (`crypto.createHash`) & Client Inspector |
| **Ephemeral Key Transport** | RFC 3986 URI Hash Fragment (`#key=<raw_hex>`) | Transporting AES keys to unauthenticated recipients without leaking to server | Client-Side URL routing |

---

## 2. STRIDE Threat Model & Analysis

The system was formally modeled using Microsoft's **STRIDE** methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) across all architectural boundaries.

```
                      TRUST BOUNDARY (Network / TLS 1.3)
   ┌───────────────────────┐                    ┌─────────────────────────┐
   │ Client (Web Browser)  │                    │ Backend (Express / Node)│
   │ - WebCrypto Sandbox   │  JWT + Ciphertext  │ - Rate Limiters         │
   │ - #key isolated in URL│ ─────────────────> │ - JWT Authenticator     │
   │ - In-Memory Key Store │ <───────────────── │ - ACL Authorization     │
   └───────────────────────┘    Streams / IV    └───────────┬─────────────┘
                                                            │
                                        TRUST BOUNDARY      │ GridFS / BSON
                                                            ▼
                                                ┌─────────────────────────┐
                                                │ Database (MongoDB)      │
                                                │ - Ciphertext Blobs      │
                                                │ - Hash-Chained Logs     │
                                                └─────────────────────────┘
```

---

### S — Spoofing Identity

| Potential Threat | Threat Scenario | Architectural Mitigation | Status |
| :--- | :--- | :--- | :--- |
| **User Identity Spoofing** | Attacker crafts an artificial request claiming to be another user to read confidential files. | Cryptographically signed JSON Web Tokens (`HS256` with strong secret) verified on every API boundary via `requireAuth` middleware. Session expiration (`JWT_EXPIRES_IN`) limits token reuse. | **Mitigated** |
| **Public Key Masquerading** | Attacker substitutes recipient public key to intercept future shared files. | Public keys are bound to user accounts in the database during authenticated registration and retrieved directly from authenticated identity endpoints. | **Mitigated** |
| **Ephemeral Share Link Hijacking** | Attacker guesses high-entropy ephemeral access tokens to access burn-on-read links. | Ephemeral tokens are generated with 64 cryptographically secure pseudo-random bytes (`crypto.randomBytes(64).toString('hex')`, ~512 bits of entropy), rendering brute-force mathematically infeasible. | **Mitigated** |

---

### T — Tampering with Data

| Potential Threat | Threat Scenario | Architectural Mitigation | Status |
| :--- | :--- | :--- | :--- |
| **Ciphertext Payload Tampering** | Storage provider, DB attacker, or Man-in-the-Middle flips bits in the stored ciphertext file. | AES-256-GCM is an Authenticated Encryption with Associated Data (AEAD) cipher. Decryption strictly enforces the 16-byte authentication tag; any single-bit mutation throws a cryptographic operation failure before payload output. | **Mitigated** |
| **Audit Ledger Tampering** | Malicious DB administrator or SQL/NoSQL injector modifies access logs to hide unauthorized access. | Every audit entry contains a canonical `SHA-256` hash binding `(index, previousHash, timestamp, action, actorId, actorEmail, targetFileId, targetFilename, details)`. Verification endpoint recalculates the cryptographic chain from genesis block (0) to head, flagging any corrupted or deleted entry immediately. | **Mitigated** |
| **Client-Side Key Modification** | Client tampered payload uploaded with mismatched parameters. | Backend validates IV (12 bytes), Auth Tag (16 bytes), and encrypted key length constraints with strict Joi schemas before persisting metadata. | **Mitigated** |

---

### R — Repudiation

| Potential Threat | Threat Scenario | Architectural Mitigation | Status |
| :--- | :--- | :--- | :--- |
| **Action Deniability by Actor** | User shares, downloads, or modifies files and subsequently denies performing the action. | High-fidelity, immutable hash-chained audit logging captures `AUTH_LOGIN`, `FILE_UPLOAD_CLIENT_ZK`, `FILE_SHARE_CLIENT_ZK`, `EPHEMERAL_LINK_CREATED`, and `EPHEMERAL_DOWNLOAD` with actor IP address and timestamps. | **Mitigated** |
| **Server Log Erasure** | Compromised backend attempts to selectively erase log records. | Hash-chain break occurs whenever any sequential record is missing or index sequence is disrupted; `verifyAuditChain()` detects `CHAIN_BROKEN` or `HASH_MISMATCH` instantly. | **Mitigated** |

---

### I — Information Disclosure

| Potential Threat | Threat Scenario | Architectural Mitigation | Status |
| :--- | :--- | :--- | :--- |
| **Server-Side Plaintext Snooping** | Compromised backend server, cloud subpoena, or rogue sysadmin reads sensitive uploaded files. | **True Zero-Knowledge Architecture**: Files are encrypted with WebCrypto AES-256-GCM in the user's browser *before* transmission. The server receives only high-entropy ciphertext. The server never has access to the user's plaintext file or raw symmetric key. | **Mitigated** |
| **Ephemeral Link Key Leakage** | Symmetric key in shareable link appears in web server access logs or proxy logs. | **RFC 3986 URL Hash Fragment Isolation**: The decryption key is passed via `#key=<hex>` URL fragment. RFC 3986 specifies that browsers *never* transmit the URI fragment to the server in HTTP requests. Decryption occurs purely client-side. | **Mitigated** |
| **Private Key Exposure on Client Disk** | Attacker accesses browser local storage or cached session files to steal user private key. | RSA private keys are stored in `localStorage` strictly in encrypted form (PBKDF2 150k rounds + AES-256-GCM). Decrypted `CryptoKey` instances reside exclusively in volatile JavaScript runtime memory and are cleared on page reload or user logout. | **Mitigated** |
| **Burn-on-Read Premature Leakage** | Expired or already-burned ephemeral links accessed multiple times. | Atomic download counter decrement in MongoDB. When `downloadCount >= maxDownloads` or `Date.now() > expiresAt`, the link is marked inactive and permanently returns `HTTP 410 Gone`. | **Mitigated** |

---

### D — Denial of Service

| Potential Threat | Threat Scenario | Architectural Mitigation | Status |
| :--- | :--- | :--- | :--- |
| **Authentication & Upload Flooding** | Attacker floods login or upload endpoints with automated volumetric requests. | Express rate limiting (`express-rate-limit`): 20 requests/15min on login, 50 requests/15min on upload routes. | **Mitigated** |
| **Memory Exhaustion via Huge Uploads** | Large files exhaust Node.js server heap memory. | Multer memory threshold capped at 25MB (`maxFileSize`). Storage backend streams payloads into MongoDB GridFS via readable stream pipelines (`gridfsBucket.openUploadStream`). | **Mitigated** |
| **Algorithmic Complexity DoS (Hash Verification)** | Attacker triggers computationally expensive audit chain verification repeatedly. | Verification scans linearly in $O(N)$ with lightweight SHA-256 operations. Accessible only to authenticated administrators/users. | **Mitigated** |

---

### E — Elevation of Privilege

| Potential Threat | Threat Scenario | Architectural Mitigation | Status |
| :--- | :--- | :--- | :--- |
| **Horizontal Privilege Escalation (IDOR)** | Authenticated User A passes the file ID of User B to download or share User B's file. | Every file operation executes strict Access Control List (ACL) queries: downloads require `file.owner.equals(userId)` OR presence of caller in `file.acl[].user`. Sharing requires explicit ownership (`file.owner.equals(userId)`). | **Mitigated** |
| **BSON Injection / ID Malformation** | Attacker passes malformed ObjectIds or query selector objects (e.g., `{"$ne": null}`) to bypass checks. | Route parameter validator middleware checks `mongoose.Types.ObjectId.isValid(id)` and rejects invalid identifiers with `400 Bad Request` before invoking database queries. | **Mitigated** |
| **Administrative Bypass** | Standard user elevates role to `admin` in update payloads. | User role updates are restricted; role assignment occurs strictly on backend policy, not client-supplied request bodies. | **Mitigated** |

---

## 3. Threat Actor Profiles & Capabilities

```
+-----------------------------------+-----------------------------------+-----------------------------------+
| Actor                             | Capabilities                      | Threat Mitigation                 |
+-----------------------------------+-----------------------------------+-----------------------------------+
| Untrusted Server / Cloud Host     | Root server access, DB reads,     | Zero-Knowledge encryption: Server |
|                                   | network traffic observation       | holds only ciphertext and hashes  |
+-----------------------------------+-----------------------------------+-----------------------------------+
| Malicious Tenant / User           | Valid credentials, API access,    | Strict ACLs, BSON ID validation,  |
|                                   | attempts horizontal IDOR          | rate limits, no cross-tenant read |
+-----------------------------------+-----------------------------------+-----------------------------------+
| Network Eavesdropper (MitM)       | Intercepts transit traffic,       | TLS 1.3 in transit + AES-GCM      |
|                                   | proxies network packets           | AEAD authenticated ciphertext     |
+-----------------------------------+-----------------------------------+-----------------------------------+
| Rogue Database Administrator      | Direct access to MongoDB tables,  | Tamper-evident SHA-256 hash chain |
|                                   | attempts silent audit log editing | immediately flags log alterations |
+-----------------------------------+-----------------------------------+-----------------------------------+
```

---

## 4. Cryptographic Implementation Details

### Client-Side Zero-Knowledge Flow

```
[Sender Browser]
  1. Generate AES-256-GCM Key (WebCrypto)
  2. Encrypt File Bytes -> Ciphertext + 12B IV + 16B Tag
  3. Fetch Recipient RSA-OAEP Public Key (/api/auth/public-key)
  4. Encrypt AES Key with Recipient RSA-OAEP Public Key
  5. Upload { Ciphertext, IV, Tag, RecipientEncryptedKey } to Vault
          │
          ▼
[Untrusted Backend & Database]
  * Stores Ciphertext Blob & Encrypted Key Payload
  * Has ZERO access to Plaintext or AES Key
          │
          ▼
[Recipient Browser]
  1. Fetch Ciphertext + Encrypted AES Key
  2. Decrypt AES Key using Local RSA Private Key (WebCrypto)
  3. Decrypt Ciphertext with AES-256-GCM -> Authenticated Plaintext
```

### Ephemeral Link URI Fragment Mechanism (RFC 3986 §3.5)

The burn-on-read ephemeral sharing link structure:
```
https://vault.domain.com/share/9b106d37f...6a#key=4f9b8c2...10
                               └─────┬─────┘     └───┬───┘
                           Token (Backend)     AES Key (Client ONLY)
```
- **Token** is sent to `GET /api/public/share/:token` to verify validity, download quota, and expiry.
- **Key (`#key=...`)** is evaluated strictly in the recipient's browser runtime:
  ```typescript
  const hash = window.location.hash; // e.g. "#key=3c9f..."
  const keyHex = new URLSearchParams(hash.replace('#', '')).get('key');
  ```
- In accordance with standard HTTP protocol specifications (RFC 7230 / RFC 3986), HTTP user-agents **never** transmit the hash fragment to HTTP reverse proxies, CDN caches, or origin servers.

---

## 5. Security Assumptions & Residual Risk

1. **Client Endpoint Integrity**: The system assumes the user's host machine is free of active keystroke loggers or memory dumpers that could inspect runtime JavaScript memory while the vault is unlocked.
2. **TLS / HTTPS Deployment**: In production, the system requires strict transport security (TLS 1.3 / HSTS) to protect JWT credentials and public key exchanges in transit.
3. **Browser Cryptography Support**: Browsers must support standard W3C Web Cryptography API (`crypto.subtle`).

---

## 6. Reporting a Security Vulnerability

If you discover a security vulnerability within this project, please report it responsibly:
- **Do not** file a public GitHub issue.
- Please email the maintainer directly or submit a private security advisory through GitHub Security Advisories.
- All reports will be acknowledged within 24 hours, and security patches will be published promptly.
