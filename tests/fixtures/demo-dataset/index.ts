import type { CarrierImage } from '@ombrix/stego-interface';

export interface DemoKeypair {
  readonly publicKeyHex: string;
  readonly privateKeyHex: string;
  readonly keyId: string;
  readonly fingerprint: string;
}

export interface DemoDataset {
  readonly referenceCarriers: {
    readonly gradientCarrier64: CarrierImage;
    readonly flatCarrier32: CarrierImage;
  };
  readonly samplePayloads: {
    readonly shortText: Uint8Array;
    readonly mediumText: Uint8Array;
    readonly binaryBlob: Uint8Array;
  };
  readonly cryptographicKeys: {
    readonly aliceEncryption: DemoKeypair;
    readonly bobEncryption: DemoKeypair;
    readonly charlieSigning: DemoKeypair;
  };
  readonly malformedVectors: {
    readonly invalidPngSignature: Uint8Array;
    readonly truncatedBuffer: Uint8Array;
    readonly negativeLengthPrefix: Uint8Array;
  };
}

// Generate Reference Carriers
function makeGradientCarrier(width: number, height: number): CarrierImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = Math.round((x / width) * 200 + 20);
      data[idx + 1] = Math.round((y / height) * 200 + 20);
      data[idx + 2] = Math.round(((x + y) / (width + height)) * 200 + 20);
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

function makeFlatCarrier(width: number, height: number): CarrierImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;
    data[i + 1] = 128;
    data[i + 2] = 128;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

export const demoDataset: DemoDataset = {
  referenceCarriers: {
    gradientCarrier64: makeGradientCarrier(64, 64),
    flatCarrier32: makeFlatCarrier(32, 32),
  },
  samplePayloads: {
    shortText: new TextEncoder().encode('OMBRIX Top Secret Demo Payload'),
    mediumText: new TextEncoder().encode(
      'OMBRIX is a local-first privacy research framework engineered to study steganography, digital image forensics, and robust transmission channels.',
    ),
    binaryBlob: new Uint8Array([
      0x4f, 0x4d, 0x42, 0x31, 0x01, 0x02, 0x03, 0x04, 0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba,
      0xbe,
    ]),
  },
  cryptographicKeys: {
    aliceEncryption: {
      publicKeyHex: 'e0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde',
      privateKeyHex: 'f0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde',
      keyId: 'E0123456789ABCDE',
      fingerprint:
        'E012 3456 789A BCDE F012 3456 789A BCDE F012 3456 789A BCDE F012 3456 789A BCDE',
    },
    bobEncryption: {
      publicKeyHex: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
      privateKeyHex: 'b1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
      keyId: 'A1B2C3D4E5F60718',
      fingerprint:
        'A1B2 C3D4 E5F6 0718 293A 4B5C 6D7E 8F90 A1B2 C3D4 E5F6 0718 293A 4B5C 6D7E 8F90',
    },
    charlieSigning: {
      publicKeyHex: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
      privateKeyHex: '99887766554433221100ffeeddccbbaa99887766554433221100ffeeddccbbaa',
      keyId: '1122334455667788',
      fingerprint:
        '1122 3344 5566 7788 9900 AABB CCDD EEFF 1122 3344 5566 7788 9900 AABB CCDD EEFF',
    },
  },
  malformedVectors: {
    invalidPngSignature: new Uint8Array([0x89, 0x50, 0x4e, 0x00, 0x0d, 0x0a, 0x1a, 0x0a]),
    truncatedBuffer: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    negativeLengthPrefix: new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x01, 0x02, 0x03]),
  },
};
