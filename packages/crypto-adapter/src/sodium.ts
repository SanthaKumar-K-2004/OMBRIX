import sodium from 'libsodium-wrappers-sumo';
import { SodiumNotReadyError } from './errors.js';

let isInitialized = false;

export async function initCrypto(): Promise<typeof sodium> {
  if (!isInitialized) {
    await sodium.ready;
    isInitialized = true;
  }
  return sodium;
}

export function getSodium(): typeof sodium {
  if (!isInitialized) {
    throw new SodiumNotReadyError();
  }
  return sodium;
}

export function isCryptoReady(): boolean {
  return isInitialized;
}
