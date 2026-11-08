# OMBRIX — Reproducible Build & Release Verification Process

**Classification:** Release Engineering & Supply Chain Integrity  
**Target:** Deterministic, Reproducible Client Builds  

---

## 1. Prerequisites

- **Node.js:** `>= 20.0.0` (LTS recommended)
- **Package Manager:** `pnpm >= 9.0.0` (Corepack enabled or native)
- **Git:** Standard distribution

---

## 2. Reproducible Build Steps

To deterministically build OMBRIX from clean source:

```bash
# 1. Clone repository
git clone https://github.com/ombrix/ombrix.git
cd ombrix

# 2. Strict frozen installation of locked dependencies
pnpm install --frozen-lockfile

# 3. Static type check across all 16 monorepo packages
pnpm -r run typecheck

# 4. Strict Biome linter and format validation
pnpm run lint

# 5. Full automated unit and integration test suite execution
pnpm test

# 6. Production build compilation
pnpm -r run build
```

Production web distribution bundle will be generated in `apps/web/dist/`.

---

## 3. Subresource Integrity & Checksum Generation

Prior to releasing release tarballs or static site distributions, generate cryptographic SHA-256 digests of all output files:

```bash
cd apps/web/dist
sha256sum index.html assets/* > SHA256SUMS
```

The `SHA256SUMS` file should be signed using the OMBRIX release Ed25519 or GPG signing key:
```bash
gpg --armor --detach-sign SHA256SUMS
```

---

## 4. Release Checklist

- [ ] All 38 test suites (208+ tests) pass with exit code 0.
- [ ] TypeScript recursive typecheck passes with 0 errors (`pnpm -r run typecheck`).
- [ ] Biome linter passes with 0 errors (`pnpm run lint`).
- [ ] Content Security Policy meta header verified in `apps/web/dist/index.html`.
- [ ] Verify zero external network calls in developer tools network panel (`connect-src 'none'`).
- [ ] Commit tagged with signed git tag: `git tag -s v0.1.0 -m "Release v0.1.0"`.

