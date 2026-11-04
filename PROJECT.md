# Project: HushArc Mobile Compatibility and Runtime Performance Optimization

## Architecture
HushArc is a zero-knowledge, zero-database ephemeral messaging application built with React 18, Vite, Tailwind CSS, Libsodium (XChaCha20-Poly1305 AEAD + X25519 sealed box), and a stateless Node.js WebSocket relay server.

### Architecture Boundaries & Data Flow
- **Client Root & Routing**: `src/app/App.tsx` routes between `WelcomeScreen` and `ChatRoom`, hosting modal overlays (`CreateRoomModal`, `JoinRoomModal`, `InvitationModal`). Code-splitting decouples the heavy 736 KB `libsodium-wrappers` crypto vendor bundle from the landing page.
- **Crypto Subsystem**: `src/lib/crypto/e2ee.ts` provides Libsodium primitives (XChaCha20-Poly1305 AEAD, X25519 sealed box, memory zeroization). URL hash isolation (`src/lib/ephemeral-session/session.ts`) purges invitation keys from browser history immediately upon loading.
- **Room Hook & Ephemeral State**: `src/hooks/useHushArcRoom.ts` manages WebSocket signaling, encryption/decryption, binary chunk streaming, participant presence, and ephemeral in-memory state. Teardown lifecycles guarantee Blob URL revocation, timer unregistration, and abandoned chunk buffer eviction.
- **Messaging UI & Mobile Subsystem**: `src/features/messaging/` (`ChatRoom.tsx`, `MessageList.tsx`, `EphemeralComposer.tsx`, `ReactionPicker.tsx`) provides the chat interface. Upgraded with dynamic viewports (`100dvh`), `visualViewport` keyboard awareness, safe-area insets (`env(safe-area-inset-*)`), >=44x44px touch targets, mobile touch-accessible action toolbars, and `React.memo` message item rendering.
- **Stateless Server Relay**: `server/room-manager.ts` and `server/websocket.ts` maintain transient in-memory maps only; zero database, zero disk logging, instant teardown on empty rooms.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Lazy Loading & Suspense | Decouple modals and ChatRoom via React.lazy in App.tsx | M1 | Survey 2 |
| F2 | Vendor Chunk Optimization | Vite build chunking separating vendor-crypto from initial page load | M1 | Survey 2 |
| F3 | Message Item Memoization | Extract MessageItem with React.memo and stable callbacks | M1 | Survey 2 |
| F4 | O(1) Quoted Reply Lookup | Memoized Map lookup for quoted messages | M1 | Survey 2 |
| F5 | Throttled Chunk Renders | Throttle attachment chunk progress updates to prevent re-render thrashing | M1 | Survey 2 |
| F6 | Blob URL & Buffer Cleanup | Revoke Blob URLs and clear incoming chunk buffers on leave/end | M2 | Survey 2, 3 |
| F7 | Orphan Timer Teardown | Cancel typing timeouts and modal/composer timeouts on unmount | M2 | Survey 2, 3 |
| F8 | Abandoned Chunk Buffer TTL | Add TTL eviction for incomplete chunk transmissions | M2 | Survey 2, 3 |
| F9 | Memory Zeroization | Call bestEffortZeroize on decrypted chunk buffers and discarded keys | M2 | Survey 2, 3 |
| F10 | Dynamic Viewport & Keyboard | Use 100dvh, interactive-widget=resizes-content, and visualViewport handling | M3 | Survey 1, 3 |
| F11 | 16px Mobile Input Scaling | Prevent iOS Safari auto-zoom with text-base on mobile inputs | M3 | Survey 1 |
| F12 | Comprehensive Safe Areas | Apply safe-top, safe-bottom, and horizontal safe area padding | M3 | Survey 1 |
| F13 | Accessible Touch Targets | Ensure >=44x44px minimum touch targets across all interactive controls | M3 | Survey 1 |
| F14 | Mobile Touch Message Toolbar | Tap/touch-accessible message actions without hover dependency or 320px overflow | M3 | Survey 1 |
| F15 | Zero-Knowledge Security Invariants | Strictly preserve all 7 core Libsodium zero-knowledge/zero-db invariants | M4 | Survey 3 |
| F16 | Automated E2E Test Suite | Comprehensive Tiers 1-4 automated tests covering mobile, memory, and crypto | M4 / E2E Track | Survey 3 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Performance Optimization & Code-Splitting | F1, F2, F3, F4, F5 in App.tsx, MessageList.tsx, ChatRoom.tsx, vite.config.ts | none | PLANNED |
| M2 | Ephemeral Memory Hygiene & Lifecycle Cleanup | F6, F7, F8, F9 in useHushArcRoom.ts, modals, and composers | none | PLANNED |
| M3 | Mobile Responsiveness, Virtual Keyboard & Touch Targets | F10, F11, F12, F13, F14 in index.html, globals.css, ChatRoom.tsx, MessageList.tsx, EphemeralComposer.tsx, ReactionPicker.tsx, ParticipantDrawer.tsx | none | PLANNED |
| M4 | Final Integration, E2E Test Pass & Hardening | Phase 1: Pass 100% E2E tests (Tiers 1-4); Phase 2: Adversarial Hardening (Tier 5) with Challenger & Auditor | M1, M2, M3, E2E Track | PLANNED |

### Parallel Track: E2E Testing Track
- **Owner**: E2E Testing Track Orchestrator
- **Scope**: Requirement-driven opaque-box test harness & test cases (Tiers 1-4) covering mobile responsive layout, memory lifecycle & cleanup, bundle chunking & performance, cryptographic invariants.
- **Deliverable**: `TEST_INFRA.md` and `TEST_READY.md`.

---

## Interface Contracts

### App.tsx ↔ Lazy Loaded Features
- `ChatRoom`: `({ roomCode, initialNickname, onLeaveRoom }: ChatRoomProps) => JSX.Element`
- `CreateRoomModal`: `({ isOpen, onClose, onRoomCreated }: CreateRoomModalProps) => JSX.Element`
- `JoinRoomModal`: `({ isOpen, onClose, onJoinRoom }: JoinRoomModalProps) => JSX.Element`
- `InvitationModal`: `({ isOpen, onClose, roomCode, shortCode, roomKey }: InvitationModalProps) => JSX.Element`

### ChatRoom.tsx ↔ MessageList.tsx
- `MessageItem`: `React.memo(({ message, isMine, quotedMessage, onReply, onReact, onOpenLightbox }: MessageItemProps) => JSX.Element)`
- Stable callbacks: `onReply: (msg: DecryptedMessage) => void`, `onReact: (messageId: string, emoji: string) => void` wrapped in `useCallback`.

### useHushArcRoom.ts ↔ Lifecycle Cleanup
- `leaveRoom()` / `endRoom()`: must synchronously revoke all `createdBlobUrlsRef.current`, clear `incomingAttachmentsRef.current`, clear `typingTimeoutRef.current`, and purge session.
- `unmount`: clear timers, detach WebSocket handlers (`ws.onmessage = null`, etc.), revoke blob URLs, zeroize memory buffers.

---

## Code Layout
- `src/app/`: Root component, dynamic lazy loading boundaries.
- `src/features/messaging/`: ChatRoom, MessageList, MessageItem, EphemeralComposer, ReactionPicker.
- `src/features/participants/`: ParticipantDrawer.
- `src/features/rooms/`: CreateRoomModal, JoinRoomModal.
- `src/features/invitations/`: InvitationModal.
- `src/hooks/`: useHushArcRoom (WebSockets, E2EE, ephemeral memory lifecycle).
- `src/lib/crypto/`: e2ee.ts (Libsodium cryptographic primitives).
- `src/lib/ephemeral-session/`: session.ts (URL hash secrets, room code encoding).
- `src/styles/`: globals.css (safe areas, responsive utilities).
- `index.html`: Viewport configuration, meta tags.
- `tests/`: Vitest test suites (unit, integration, e2e).
