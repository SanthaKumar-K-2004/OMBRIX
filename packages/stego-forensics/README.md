# @ombrix/stego-forensics

Statistical steganalysis and image tampering forensic detection suite.

Part of the **[OMBRIX](https://github.com/SanthaKumar-K-2004/OMBRIX)** zero-telemetry steganography suite.

## Installation

```bash
npm install @ombrix/stego-forensics
```

## Quickstart

```typescript
import { runRsSteganalysis, analyzeConsensus } from '@ombrix/stego-forensics';

// 1. Run Fridrich RS Steganalysis
const rsReport = runRsSteganalysis(imageData);
console.log('Estimated payload ratio:', rsReport.estimatedPayloadRatio);
console.log('Stego anomaly detected?', rsReport.classification !== 'clean');

// 2. Run multi-detector consensus (RS + SPA + Chi-Square + Laplacian Residuals)
const consensus = analyzeConsensus(imageData);
console.log('Overall forensic verdict:', consensus.verdict);
console.log('Confidence score:', consensus.confidenceScore);
```

## Supported Detectors

- **Fridrich RS Steganalysis**: Evaluates regular vs singular group flipping ratios across channel blocks.
- **Dumitrescu Sample Pair Analysis (SPA)**: Finite state machine analyzing pixel difference pairs.
- **Westfeld Chi-Square PoVs**: Detects histogram equalization and Pairs of Values anomalies.
- **Laplacian Residual Noise Variance**: Computes high-frequency perturbation indices (HFPI).

## License

MIT © [SanthaKumar K](https://github.com/SanthaKumar-K-2004)
