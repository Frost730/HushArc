# HushArc Automated Test Infrastructure

## 1. Overview & Architectural Philosophy
HushArc is an anonymous, ephemeral, zero-database, end-to-end encrypted messaging application. Because the architecture mandates zero database persistence, zero disk logging, and strict client-side cryptography (XChaCha20-Poly1305 AEAD, X25519 sealed-box key exchange), the test harness is designed around **opaque-box requirement verification** across four formal tiers:
1. **Tier 1 — Feature Coverage**: Verification of discrete features in isolation (mobile layout math, memory zeroization, bundle code-splitting, Libsodium cryptographic primitives).
2. **Tier 2 — Boundary & Corner Cases**: Stressing extreme parameters (320px minimum viewport width, 0px safe-area insets, notch safe-area bounds, zero-size binary attachments, dropped sockets midway through chunk streams, rapid join/leave cycles).
3. **Tier 3 — Cross-Feature Combinations**: Pairwise interaction testing (virtual keyboard resize while streaming binary attachments, key rotation during active message bursts, emoji reactions under virtual keyboard offsets, room termination during in-flight uploads).
4. **Tier 4 — Real-World Application Scenarios**: Multi-participant encrypted sessions (4+ participants), complete room lifecycles from creation to teardown, dynamic participant join/leave churn, and post-session memory hygiene audits.

---

## 2. Directory Layout & Test Suite Organization
```
tests/
├── helpers/                           # Shared test harnesses, ephemeral servers, and math oracles
│   ├── ephemeral-test-server.ts       # Dynamic port (port 0) HTTP + WebSocket relay test harness
│   └── mobile-viewport-oracle.ts      # Viewport geometry, keyboard offset, and touch target oracles
├── unit/                              # Isolated unit tests
│   ├── crypto.test.ts                 # [Existing] Libsodium AEAD, sealed box, random ID tests
│   ├── crypto-invariants.test.ts      # [New] The 7 Core Zero-Knowledge Security Invariants
│   ├── session.test.ts                # [Existing] URL fragment parsing & nickname tests
│   ├── room-manager.test.ts           # [Existing] EphemeralRoomManager unit tests
│   ├── mobile-layout.test.ts          # [New] Mobile layout math, safe areas, virtual keyboard, touch targets
│   ├── memory-lifecycle.test.ts       # [New] Ephemeral memory cleanup, blob URL revocation, buffer zeroization
│   └── bundle-chunking.test.ts        # [New] Vite chunk splitting, dynamic lazy import decoupling
├── integration/                       # Component integration tests
│   └── websocket.test.ts              # [Existing] 2-party WebSocket E2EE conversation flow
└── e2e/                               # End-to-end multi-feature & scenario tests
    ├── chat-lifecycle.e2e.test.ts     # [New] Full conversation lifecycle: join, chat, reply, reaction, leave
    ├── network-edge-cases.e2e.test.ts # [New] Chunk stream interruptions, capacity limits, invalid secrets
    └── multi-participant-scenarios.e2e.test.ts # [New] 4-party mesh, concurrent messaging, key rotation, teardown
```

---

## 3. Test Runner & Environment Configuration
- **Test Runner**: Vitest 5.x (`npm test` / `vitest run`)
- **Execution Environment**: Node.js (`environment: 'node'`)
- **TypeScript Compiler**: TypeScript 5.7+ (`npm run typecheck`)
- **Resolution Aliases**:
  - `@/` -> `./src/`
  - `libsodium-wrappers` -> `./node_modules/libsodium-wrappers/dist/modules/libsodium-wrappers.js`
- **Timeout Baseline**: 10,000ms default test timeout to accommodate asynchronous cryptographic operations and real WebSocket handshakes.

---

## 4. Execution Commands

### Run Full Test Suite
```bash
npm test
```

### Run Test Suite in Watch Mode (Interactive Development)
```bash
npm run test:watch
```

### Run Specific Test Suites
```bash
# Unit tests only
npx vitest run tests/unit

# E2E suites only
npx vitest run tests/e2e

# Specific file
npx vitest run tests/unit/mobile-layout.test.ts
```

### Run Build & Typecheck Verifications
```bash
# Typecheck client and server
npm run typecheck

# Full production build
npm run build
```

---

## 5. Authoritative Expected Output Oracles
Every test derives its expected outcome from authoritative, non-facade sources:
1. **Cryptographic Invariants**: Derived from RFC 8439 (ChaCha20-Poly1305), RFC 7748 (Curve25519/X25519), and Libsodium core documentation.
2. **Mobile Layout & Touch Targets**: Derived from W3C CSS Values and Units Module Level 4 (`100dvh`, `env(safe-area-inset-*)`), W3C Visual Viewport API, and WCAG 2.1 Success Criterion 2.5.5 (Target Size minimum 44×44 CSS pixels).
3. **Memory Lifecycle**: Derived from W3C File API specification for `URL.createObjectURL` / `URL.revokeObjectURL` and POSIX memory zeroization contracts (`Uint8Array.fill(0)`).
4. **WebSocket Protocol**: Derived from RFC 6455 and HushArc ephemeral signaling wire format specifications.

---

## 6. Isolation & Concurrency Principles
- **Dynamic Port Binding**: Every E2E / integration test server binds to port `0` (`server.listen(0, '127.0.0.1')`), preventing port contention during parallel test execution.
- **Independent Room Scopes**: Each test generates fresh, random room IDs, access secrets, and cryptographic keys. No shared global state exists between test cases.
- **Teardown Determinism**: All test fixtures register explicit `afterEach` or `afterAll` hooks to close WebSocket connections, terminate HTTP listeners, invoke `roomManager.shutdown()`, and cancel all active timers.
