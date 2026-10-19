# HushArc — Living Signal

> **Some things belong in the moment.**
>
> *"No accounts. No archives. Just your people, here and now."*

HushArc is an anonymous, ephemeral, end-to-end encrypted messaging web application designed for fleeting, private conversations. It runs as a self-contained, single-service application engineered specifically for the **Render Free Web Service** tier, maintaining **zero persistent storage** and **zero application databases**.

---

## Table of Contents

1. [Architectural Philosophy](#architectural-philosophy)
2. [Security & Cryptographic Construction](#security--cryptographic-construction)
3. [Ephemeral Room & Invitation Design](#ephemeral-room--invitation-design)
4. [Real-Time WebSocket Protocol](#real-time-websocket-protocol)
5. [Visual Identity: Living Signal](#visual-identity-living-signal)
6. [Local Development](#local-development)
7. [Running Tests & Quality Checks](#running-tests--quality-checks)
8. [Production Deployment on Render](#production-deployment-on-render)
9. [Progressive Web App (PWA) Policy](#progressive-web-app-pwa-policy)
10. [Honest Security Boundaries & Limitations](#honest-security-boundaries--limitations)

---

## 1. Architectural Philosophy

HushArc strictly adheres to a **No-Persistence Policy**:

- **No Permanent Accounts:** No email addresses, phone numbers, passwords, or usernames are required or recorded.
- **No Database:** No PostgreSQL, SQLite, Redis, MongoDB, or local filesystem databases exist in the codebase.
- **No Message History:** Messages are held in ephemeral RAM only while being actively relayed over WebSockets to currently connected participants.
- **No Offline Queues:** Messages are never held on the server waiting for an offline participant to reconnect. Both participants must be simultaneously present in the moment.
- **Immediate Room Destruction:** When all participants leave a room or disconnect, the room object, participant tables, and associated routing metadata are destroyed immediately from memory.
- **Single-Service Architecture:** A single Node.js Express process hosts the static Vite React production build, REST endpoints, and the WebSocket server sharing the same origin and port.

---

## 2. Security & Cryptographic Construction

All message privacy guarantees are enforced via genuine cryptographic primitives implemented with **Libsodium** (`libsodium-wrappers`):

### 2.1 Symmetric Message Encryption (AEAD)
- **Algorithm:** **XChaCha20-Poly1305** (IETF authenticated encryption with 192-bit nonce and 256-bit key).
- **Nonce Strategy:** A fresh, cryptographically secure 24-byte nonce (`randombytes_buf`) is generated for every single message.
- **Authenticated Additional Data (AAD):** Each message binds the current cryptographic epoch (`epoch-N`) to prevent replay or cross-epoch tampering.
- **Tamper Resistance:** Any bit modification to ciphertext, nonce, or metadata causes decryption to immediately fail with an authentication error; plaintext fallback is strictly prohibited.

### 2.2 Public-Key Key Exchange & Epoch Rotation
- **Keypairs:** Each participant generates an ephemeral **X25519** keypair (`crypto_box_keypair`) upon entering the room.
- **Epoch Rotation:** When participants change or a group rotation is triggered, a fresh symmetric key is generated. The initiator encrypts the new key individually for each connected peer's public key using `crypto_box_seal` (anonymous public-key encryption).

### 2.3 URL Hash Fragment Isolation
- Invitation URLs use the format:
  ```
  https://<domain>/r/<RANDOM_ROOM_ID>#access=<ACCESS_TOKEN>&key=<ENCRYPTION_SECRET>
  ```
- **The URL fragment (`#...`) is NEVER transmitted by web browsers to the Express server.**
- On page load, HushArc's client immediately reads the fragment, isolates the secret into closure memory, and executes `window.history.replaceState(null, '', cleanUrl)` to strip the keys from browser history and prevent referrer leakage.

---

## 3. Ephemeral Room & Invitation Design

| Component | Responsibility | Stored On Server? |
| :--- | :--- | :--- |
| **Room ID** | 128-bit random token identifying the ephemeral room session | Yes (in-memory Map only) |
| **Access Secret** | Bearer authorization capability required to join | Salted SHA-256 hash in memory |
| **Room Key** | 256-bit symmetric XChaCha20-Poly1305 encryption key | **NEVER** (Client browser only) |
| **Participant ID** | Random identifier generated per session | Yes (active socket mapping) |
| **Public Key** | Ephemeral X25519 public key | Yes (relayed to room peers) |

When an instance restarts on Render, all process RAM is discarded. Users must create a fresh room or generate a new invitation.

---

## 4. Real-Time WebSocket Protocol

WebSocket traffic is routed through `/ws` with strict runtime validation via **Zod**:

### Client -> Server Events
1. `join`: `{ roomId, participantId, nickname, publicKey, accessSecret }`
2. `encrypted_message`: `{ roomId, messageId, epoch, nonce, ciphertext, replyToId? }`
3. `reaction`: `{ roomId, messageId, epoch, nonce, ciphertext }`
4. `typing`: `{ roomId, isTyping }`
5. `key_rotation_epoch`: `{ roomId, newEpoch, encryptedKeys }`
6. `leave`: `{ roomId }`
7. `end_room`: `{ roomId }`
8. `ping`: `{}`

### Server -> Client Events
1. `join_accepted`: `{ roomId, participantId, epoch, participants }`
2. `join_rejected`: `{ reason }`
3. `participant_joined`: `{ participant }`
4. `participant_left`: `{ participantId, reason }`
5. `encrypted_message_relayed`: Relayed ciphertext directly to authorized peers (zero server storage)
6. `message_delivered_receipt`: Exact count of delivered recipients
7. `reaction_relayed`: Relayed encrypted emoji reaction
8. `typing_relayed`: Ephemeral typing status
9. `key_rotation_relayed`: Relayed epoch key sealed specifically for each recipient
10. `room_ended`: Room terminated by member or server shutdown

---

## 5. Visual Identity: Living Signal

HushArc features an art-directed **Living Signal** interface inspired by astronomical radio signals, orbital telemetry, and quiet night skies:

- **HushArcMark:** Custom vector mark with interrupted orbital strokes and a central living signal point with breathing aura.
- **Palette:**
  - Ink Background: `#0A0E0D`
  - Elevated Surfaces: `#141A16`
  - Primary Text: `#F0F0E8`
  - Secondary Text: `#A7B3AA`
  - Signal Lime: `#D5FF70`
  - Muted Sage: `#53645A`
  - Error Coral: `#FF795E`
- **SignalField:** Low-CPU ambient orbital backdrop.
- **Accessibility:** Full `prefers-reduced-motion` support, accessible contrast ratios, and keyboard navigation.

---

## 6. Local Development

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

### Installation
```bash
git clone <your-repo-url>
cd Hush_Arc
npm install
```

### Starting Development Servers
To run both the Express/WebSocket backend and the Vite React frontend concurrently:
```bash
npm run dev
```
- Frontend UI: `http://localhost:5173` (with live HMR and proxy to backend)
- Backend API & WebSocket: `http://localhost:10000`

---

## 7. Running Tests & Quality Checks

HushArc includes unit and end-to-end integration tests using **Vitest**:

```bash
# Run complete test suite (unit + integration)
npm test

# Type checking (Client & Server TypeScript)
npm run typecheck

# Code verification
npm run lint

# Production build test
npm run build
```

### What Tests Verify:
- Cryptographic keypair generation and symmetric room key entropy
- Authenticated XChaCha20-Poly1305 encryption & decryption
- Modified/tampered ciphertext rejection
- Ephemeral sealed key rotation for peer public keys
- Ephemeral room capacity limits and constant-time access token verification
- Immediate in-memory destruction of rooms when the last participant departs
- Full two-client WebSocket integration: join, encrypted relay, delivery receipts, typing indicators, encrypted reactions, and clean teardown.

---

## 8. Production Deployment on Render

HushArc is pre-configured for a **Render Free Web Service**:

### Step-by-Step Render Setup:
1. Push this repository to GitHub or GitLab.
2. Log in to [Render](https://dashboard.render.com/) and click **New +** -> **Web Service**.
3. Connect your repository.
4. Configure the service settings:
   - **Name:** `husharc`
   - **Environment:** `Node`
   - **Branch:** `main` (or default branch)
   - **Build Command:**
     ```bash
     npm ci && npm run build
     ```
   - **Start Command:**
     ```bash
     npm start
     ```
   - **Plan:** `Free`
5. Under **Advanced**:
   - **Health Check Path:** `/health`
   - **Environment Variables:**
     - `NODE_ENV`: `production`
6. Click **Create Web Service**.

When Render provisions the container, Express will serve the pre-built React SPA from `dist/` and attach the WebSocket listener to `process.env.PORT`.

---

## 9. Progressive Web App (PWA) Policy

HushArc can be installed on iOS, Android, and Desktop:
- **Manifest:** Standalone display mode with custom orbital icons.
- **Service Worker (`public/sw.js`):** Caches only the immutable static application shell (`/index.html`, scripts, CSS, icons).
- **Strict Privacy Guarantee:** The Service Worker is explicitly prohibited from caching API responses, WebSocket packets, room secrets, or transcripts.

---

## 10. Honest Security Boundaries & Limitations

HushArc is built with honest cryptography and engineering discipline:
1. **Bearer Invitations:** Anyone possessing the full URL including the `#key=...` fragment can enter the room. Users must share invitation links over trusted channels.
2. **Participant Integrity:** Any authorized member in a room can view messages and could copy or screenshot plaintext content while connected.
3. **Network Intermediaries:** While message payloads are fully end-to-end encrypted, network providers (ISPs, Render, Cloudflare) may observe connection timestamps and IP addresses.
4. **Memory Residuals:** In JavaScript environments, memory garbage collection is non-deterministic; physical zeroization of RAM cannot be guaranteed after process termination.

---

*HushArc — Living Signal. Some things belong in the moment.*
