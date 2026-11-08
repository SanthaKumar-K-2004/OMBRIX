import { describe, expect, it } from 'vitest';
import {
  isChameleonContainer,
  packChameleonContainer,
  unpackChameleonContainer,
} from './chameleon.js';

describe('OMBRIX Chameleon: Dual-Layer Plausible Deniability', () => {
  const masterSecret = new TextEncoder().encode('Top Secret Nuclear Launch Codes: 0xDEADBEEF');
  const masterKey = 'omega-master-passkey-9999';

  const decoySecret = new TextEncoder().encode('Innocuous Company Holiday Schedule 2026');
  const decoyKey = 'picnic-holiday-2026';

  it('packs and identifies chameleon container', () => {
    const container = packChameleonContainer(masterSecret, masterKey, decoySecret, decoyKey);
    expect(isChameleonContainer(container)).toBe(true);
    expect(container.length).toBeGreaterThan(masterSecret.length + decoySecret.length);
  });

  it('reveals ONLY decoy payload when decoy passkey is supplied (anti-coercion)', () => {
    const container = packChameleonContainer(masterSecret, masterKey, decoySecret, decoyKey);

    const result = unpackChameleonContainer(container, decoyKey);
    expect(result.isChameleon).toBe(true);
    expect(result.layer).toBe('decoy');
    expect(new TextDecoder().decode(result.data)).toBe('Innocuous Company Holiday Schedule 2026');
  });

  it('reveals real confidential payload when master passkey is supplied', () => {
    const container = packChameleonContainer(masterSecret, masterKey, decoySecret, decoyKey);

    const result = unpackChameleonContainer(container, masterKey);
    expect(result.isChameleon).toBe(true);
    expect(result.layer).toBe('master');
    expect(new TextDecoder().decode(result.data)).toBe(
      'Top Secret Nuclear Launch Codes: 0xDEADBEEF',
    );
  });

  it('rejects wrong passkey matching neither layer', () => {
    const container = packChameleonContainer(masterSecret, masterKey, decoySecret, decoyKey);

    expect(() => unpackChameleonContainer(container, 'adversary-guessed-wrong')).toThrow(
      /Chameleon authentication failed/,
    );
  });
});
