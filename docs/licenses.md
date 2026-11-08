# OMBRIX — Dependency & License Inventory

**Status:** Audited & Verified  
**Date:** November 2026  
**Zero Telemetry Guarantee:** Verified (0 tracking or network reporting packages)

---

## 1. Executive Summary

OMBRIX is committed to complete transparency, verifiable local-first execution, and permissive open-source licensing. This inventory records all runtime, cryptographic, and build dependencies across the monorepo.

- **Total Runtime Network Calls:** 0 (Enforced by browser CSP: `connect-src 'none'`)
- **Total Analytics / Telemetry SDKs:** 0
- **License Distribution:**
  - **MIT:** Primary UI and build ecosystem (React, Vite, Tailwind CSS, Biome, Vitest)
  - **ISC:** Cryptographic core (`libsodium-wrappers-sumo`, `libsodium-sumo`) & icons (`lucide-react`)
  - **BSD-3-Clause:** Source map utilities (`source-map-js`)
  - **MPL-2.0:** Build-time CSS compilation (`lightningcss`)

---

## 2. Core Cryptography & Security Dependencies

| Package | Version | License | Upstream Origin | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `libsodium-wrappers-sumo` | `^0.8.4` | **ISC** | Frank Denis / Jedisct1 | Vetted Libsodium WebAssembly Sumo build providing X25519, Ed25519, XSalsa20-Poly1305, Argon2id, and BLAKE2b |
| `libsodium-sumo` | `^0.8.4` | **ISC** | Frank Denis / Jedisct1 | Precompiled WebAssembly runtime binary for Libsodium |

> [!NOTE]
> All cryptographic algorithms execute entirely inside the local browser WebAssembly virtual machine. Private keys, passphrase salts, and plaintext payloads never exit local memory.

---

## 3. UI Framework & Visualization Dependencies

| Package | Version | License | Upstream Origin | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `react` | `^19.0.0` | **MIT** | Meta Platforms, Inc. | Declarative user interface runtime |
| `react-dom` | `^19.0.0` | **MIT** | Meta Platforms, Inc. | DOM renderer for React |
| `lucide-react` | `^1.68.0` | **ISC** | Lucide Project | Clean, accessible SVG iconography |
| `tailwindcss` | `^4.0.0` | **MIT** | Tailwind Labs | Zero-runtime CSS utility classes |

---

## 4. Developer Tooling & Verification Dependencies

| Package | Version | License | Upstream Origin | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `typescript` | `^5.7.3` | **Apache-2.0** | Microsoft Corp. | Strict static typechecking |
| `vite` | `^6.0.0` | **MIT** | VoidZero / Evan You | High-speed local development & bundling |
| `vitest` | `^3.0.0` | **MIT** | Vitest Team | Unit and integration test runner |
| `@biomejs/biome` | `^1.9.4` | **MIT** / **Apache-2.0** | Biomejs | Rust-based high performance linter & formatter |

---

## 5. Security & License Verification Checklist

- [x] No copyleft GPL/AGPL dependencies in client distribution bundles.
- [x] No third-party network analytics, bug reporting, or session replay trackers (Sentry, PostHog, Google Analytics, Mixpanel, Segment are strictly banned).
- [x] Content Security Policy meta header blocks all outbound network connections (`connect-src 'none'`).
- [x] All cryptographic implementations rely on vetted Libsodium WebAssembly binaries rather than untested custom primitives.

