# @ombrix/edge-sdk

Unified client-side cryptographic steganography and visual cryptanalysis SDK for Node.js, browsers, and edge runtimes.

Part of the **[OMBRIX](https://github.com/SanthaKumar-K-2004/OMBRIX)** zero-telemetry steganography suite.

## Installation

```bash
npm install @ombrix/edge-sdk
```

## Quickstart

```typescript
import { Ombrix } from '@ombrix/edge-sdk';

const ombrix = new Ombrix();

// 1. Inspect carrier image capacity
const capacity = await ombrix.inspectCapacity(carrierImage);
console.log('Max safe payload bytes:', capacity.usableCapacity.hyperMatrixBytes);

// 2. Embed passkey-encrypted secret into PNG
const stegoImage = await ombrix.embed(carrierImage, 'Confidential Coordinates', {
  method: 'hyper-matrix',
  passkey: 'velvet-matrix-falcon-orbit',
});

// 3. Extract hidden payload
const extracted = await ombrix.extract(stegoImage, {
  method: 'hyper-matrix',
  passkey: 'velvet-matrix-falcon-orbit',
});
console.log('Recovered secret:', extracted.text);
```

## Key Features

- **Adaptive Matrix Embedding**: Hamming-code based spatial dispersion to defeat statistical Chi-Square & RS steganalysis.
- **Robust Frequency Resilient**: Haar Discrete Wavelet Transform (DWT) embedding for social media and transit resilience.
- **Argon2id + AES-256-GCM**: Military-grade authenticated envelope protection.
- **Zero Telemetry**: Fully air-gapped, offline-first client execution.

## License

MIT © [SanthaKumar K](https://github.com/SanthaKumar-K-2004)

