# OMBRIX — Browser Compatibility & Platform Support

**Classification:** Platform Engineering Matrix  
**Deployment Target:** Modern Evergreen Web Browsers (Local-First, Offline Capable)  

---

## 1. Supported Browser Matrix

| Browser Engine | Minimum Version | WebAssembly (Sumo) | Web Workers | Canvas 2D / TypedArrays | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Google Chrome / Chromium** | 110+ | Supported | Supported | Supported | **Tier 1 Verified** |
| **Brave / Edge / Opera** | Current | Supported | Supported | Supported | **Tier 1 Verified** |
| **Mozilla Firefox** | 115+ ESR | Supported | Supported | Supported | **Tier 1 Verified** |
| **Apple Safari (macOS)** | 16.4+ | Supported | Supported | Supported | **Tier 1 Verified** |
| **Apple Safari (iOS / iPadOS)** | 16.4+ | Supported | Supported | Supported | **Tier 1 Verified** |

---

## 2. Core Web Platform APIs Utilized

1. **WebAssembly (WASM):**
   - Required for `libsodium-wrappers-sumo`.
   - Executes X25519, Ed25519, Argon2id, and BLAKE2b at near-native C speed.
2. **Dedicated Web Workers & Transferable Objects:**
   - Moves CPU-intensive steganographic raster manipulation off the main UI thread.
   - Zero-copy buffer transfer using `ArrayBuffer` transfer semantics (`postMessage(msg, [buffer])`).
3. **HTML5 Canvas 2D API (`ImageData` & `CanvasRenderingContext2D`):**
   - Used for raster pixel extraction, bitplane visualization, difference map generation, and noise residual heatmaps.
4. **Typed Arrays (`Uint8Array`, `Uint8ClampedArray`, `DataView`):**
   - High-performance binary protocol parsing and bitwise manipulation.
5. **URL & Blob APIs:**
   - Client-side zero-server file download generation (`URL.createObjectURL(blob)`).

---

## 3. Offline & Air-Gapped Operation

OMBRIX contains **zero network dependencies**. Once the static assets (`index.html`, `index.js`, `index.css`, `stego.worker.js`) are loaded into the browser:
- All operations execute 100% offline.
- Users can disconnect from the internet or run OMBRIX inside an air-gapped forensic workstation without loss of functionality.

