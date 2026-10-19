# HushArc

> **Some things belong in the moment.**
>
> *"No accounts. No archives. Just your people, here and now."*

HushArc is an anonymous, ephemeral, end-to-end encrypted messaging web application designed for private, transient conversations. Built with a zero-persistence architecture, HushArc ensures messages and attachments exist only in volatile memory while participants are connected.

---

## Key Features

- **No Permanent Accounts:** No phone numbers, email addresses, passwords, or persistent profiles required.
- **End-to-End Encrypted (E2EE):** All communications are encrypted on-device using authenticated **XChaCha20-Poly1305** via Libsodium.
- **Zero Server-Side Storage:** No database or message buffers. Transmissions are relayed strictly to currently connected participants and discarded.
- **Ephemeral Binary Attachments:** Files and media (up to 5 MB) are streamed in 32 KB encrypted binary chunks and assembled strictly in transient browser memory.
- **Isolated Cryptographic Material:** Encryption keys remain exclusively on client devices and are never transmitted to the application server.
- **Dynamic Key Rotation:** Ephemeral X25519 public-key exchange enables instant forward secrecy and re-keying across conversation epochs.
- **Self-Destructing Rooms:** When conversation participants leave, active session state and routing metadata are purged immediately.
- **Single-Service Architecture:** Lightweight, unified Node.js/Express server and React SPA designed for easy single-container or cloud hosting.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend:** Node.js, Express, `ws` (WebSockets)
- **Cryptography:** Libsodium (`libsodium-wrappers`), XChaCha20-Poly1305 AEAD, X25519 sealed box
- **Testing:** Vitest

---

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0

### Installation

```bash
# Clone the repository
git clone https://github.com/Frost730/HushArc.git
cd HushArc

# Install dependencies
npm install
```

### Running Locally

To run the development backend and frontend concurrently with hot-reloading:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend / WebSocket: `http://localhost:10000`

---

## Testing & Quality Checks

```bash
# Run unit and integration tests
npm test

# Type checking
npm run typecheck

# Production build
npm run build
```

---

## Production Deployment

HushArc is designed to run seamlessly as a single web service on platforms like Render, Railway, Fly.io, or any standard container host:

1. **Build Command:**
   ```bash
   npm run build
   ```
2. **Start Command:**
   ```bash
   npm start
   ```
3. **Environment:**
   - `NODE_ENV=production`
   - `PORT=10000` (or host-assigned port)
4. **Health Check Path:** `/health`

---

## Privacy & Security Model

- **Device-Side Encryption:** Plaintext never leaves user devices unencrypted.
- **Link Responsibility:** Invitation links contain the client decryption key in the URL hash fragment (`#`), which browsers do not send to servers. Anyone with the invitation link can participate; share links through secure channels.
- **Transient Memory:** All in-memory state is cleared immediately when exiting a room or closing the browser session.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
