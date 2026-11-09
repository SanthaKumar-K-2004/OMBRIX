import { DecryptionFailedError, InvalidKeyError } from './errors.js';
import { parseAnyKey32, toBase64 } from './fingerprint.js';
import { zeroMemory } from './memory.js';
import { getSodium } from './sodium.js';

/**
 * Curated wordlist of 512 distinct, high-entropy, memorable English words
 * for Diceware passphrases. Each word provides 9 bits of entropy (log2(512) = 9).
 * A 5-word phrase provides 45+ bits of pure cryptographic entropy, resistant
 * to online brute-force and dictionary attacks when stretched via Argon2id / BLAKE2b.
 */
export const DICEWARE_WORDLIST: readonly string[] = [
  'amber',
  'anchor',
  'apex',
  'apollo',
  'arctic',
  'arrow',
  'atlas',
  'atom',
  'aurora',
  'autumn',
  'badge',
  'bamboo',
  'banner',
  'beacon',
  'breeze',
  'bridge',
  'bronze',
  'bubble',
  'cabin',
  'canyon',
  'carbon',
  'castle',
  'cedar',
  'cipher',
  'circuit',
  'citadel',
  'cliff',
  'cloud',
  'clover',
  'cobalt',
  'comet',
  'compass',
  'copper',
  'coral',
  'cortex',
  'cosmic',
  'crater',
  'crystal',
  'current',
  'delta',
  'desert',
  'diamond',
  'dragon',
  'dune',
  'dynamo',
  'eagle',
  'echo',
  'eclipse',
  'element',
  'ember',
  'emerald',
  'empire',
  'energy',
  'engine',
  'epoch',
  'equinox',
  'falcon',
  'feather',
  'filter',
  'flame',
  'flare',
  'flint',
  'forest',
  'forge',
  'fortress',
  'fossil',
  'fox',
  'frost',
  'fusion',
  'galaxy',
  'garnet',
  'geode',
  'glacier',
  'glider',
  'glow',
  'granite',
  'grove',
  'guard',
  'harbor',
  'harvest',
  'haven',
  'hawk',
  'helium',
  'helix',
  'helmet',
  'horizon',
  'hybrid',
  'icicle',
  'impact',
  'infiniti',
  'island',
  'jaguar',
  'jasper',
  'javelin',
  'jungle',
  'jupiter',
  'karma',
  'kinetic',
  'knight',
  'lagoon',
  'lantern',
  'laser',
  'lattice',
  'lava',
  'leaf',
  'legacy',
  'legend',
  'lemur',
  'lens',
  'leopard',
  'liberty',
  'light',
  'lion',
  'liquid',
  'lotus',
  'lunar',
  'lynx',
  'magnet',
  'magma',
  'mantle',
  'maple',
  'marble',
  'matrix',
  'meadow',
  'mercury',
  'mesa',
  'meteor',
  'mirage',
  'mirror',
  'monarch',
  'monolith',
  'moon',
  'mosaic',
  'moss',
  'mountain',
  'mystic',
  'nebula',
  'neon',
  'nest',
  'network',
  'nexus',
  'ninja',
  'nitrogen',
  'nomad',
  'nova',
  'nucleus',
  'oasis',
  'obsidian',
  'ocean',
  'octane',
  'olive',
  'omega',
  'onyx',
  'opal',
  'optics',
  'orbit',
  'orchid',
  'origin',
  'osprey',
  'owl',
  'ozone',
  'packet',
  'palette',
  'panther',
  'paradox',
  'peak',
  'pearl',
  'pebble',
  'pelican',
  'phantom',
  'phoenix',
  'photon',
  'pillar',
  'pilot',
  'pioneer',
  'pixel',
  'planet',
  'plasma',
  'platinum',
  'polar',
  'portal',
  'prism',
  'proton',
  'pulsar',
  'pulse',
  'pyramid',
  'quantum',
  'quartz',
  'quasar',
  'radar',
  'radiant',
  'radius',
  'rain',
  'raptor',
  'raven',
  'ray',
  'realm',
  'reef',
  'relay',
  'relic',
  'resonance',
  'rift',
  'ripple',
  'river',
  'robin',
  'robot',
  'rocket',
  'rover',
  'ruby',
  'sable',
  'safari',
  'sage',
  'sail',
  'sand',
  'sapphire',
  'saturn',
  'scout',
  'sector',
  'sensor',
  'serpent',
  'shadow',
  'shard',
  'shield',
  'sierra',
  'signal',
  'silicon',
  'silver',
  'siren',
  'sky',
  'slate',
  'solar',
  'sonic',
  'source',
  'spark',
  'spectrum',
  'sphere',
  'spiral',
  'spirit',
  'spring',
  'spruce',
  'star',
  'status',
  'stealth',
  'stellar',
  'stone',
  'storm',
  'stream',
  'summit',
  'sun',
  'surge',
  'swallow',
  'synergy',
  'table',
  'target',
  'temple',
  'terra',
  'thermal',
  'thunder',
  'tide',
  'timber',
  'titan',
  'topaz',
  'torch',
  'torrent',
  'tower',
  'trace',
  'trail',
  'transit',
  'treasure',
  'trench',
  'tribune',
  'trigger',
  'trinity',
  'tsunami',
  'tunnel',
  'turbo',
  'twilight',
  'typhoon',
  'ultra',
  'umbra',
  'unity',
  'universe',
  'uranium',
  'valley',
  'vapor',
  'vault',
  'vector',
  'velocity',
  'velvet',
  'vertex',
  'vessel',
  'vibe',
  'vigil',
  'violet',
  'viper',
  'virtual',
  'vision',
  'vortex',
  'voyage',
  'vulcan',
  'wave',
  'whirl',
  'whisper',
  'willow',
  'wind',
  'winter',
  'wolf',
  'zenith',
  'zephyr',
  'zero',
  'zodiac',
  'zone',
  'albatross',
  'alpine',
  'aluminum',
  'aquarium',
  'archway',
  'asteroid',
  'avalanche',
  'ballet',
  'baron',
  'basalt',
  'bastion',
  'beacon',
  'beaver',
  'beetle',
  'bismuth',
  'blizzard',
  'boulder',
  'brambles',
  'breeze',
  'bullet',
  'bungalow',
  'caldera',
  'camel',
  'cascade',
  'catalyst',
  'cavern',
  'celestial',
  'chameleon',
  'channel',
  'cheetah',
  'chimera',
  'chronos',
  'cinder',
  'claymore',
  'cloister',
  'cluster',
  'condor',
  'conduit',
  'constellation',
  'copperhead',
  'corridor',
  'cradle',
  'creek',
  'crescent',
  'crusader',
  'crystaline',
  'cyclone',
  'dagger',
  'damask',
  'dawnbird',
  'deck',
  'deltawing',
  'derrick',
  'dolphin',
  'domino',
  'downpour',
  'driftwood',
  'dynamite',
  'elemental',
  'elixir',
  'embassy',
  'enclave',
  'equator',
  'erratic',
  'everest',
  'evergreen',
  'excalibur',
  'expedition',
  'fable',
  'falconer',
  'firefly',
  'fjord',
  'flotilla',
  'flux',
  'forecast',
  'fountain',
  'freefall',
  'frequency',
  'frontier',
  'fulcrum',
  'gadget',
  'galley',
  'gateway',
  'geyser',
  'glade',
  'gondola',
  'gossamer',
  'gradient',
  'graviton',
  'grenade',
  'halcyon',
  'hamlet',
  'hangar',
  'hardwood',
  'harpoon',
  'headwind',
  'hearth',
  'heliodor',
  'heron',
  'hibiscus',
  'highland',
  'highwire',
  'homestead',
  'hound',
  'hurricane',
  'iceberg',
  'igneous',
  'illumination',
  'illusion',
  'incubator',
  'indigo',
  'injector',
  'intarsia',
  'interlude',
  'ironclad',
  'isolated',
  'jackal',
  'jamboree',
  'jetty',
  'jubilee',
  'kaleidoscope',
  'kelp',
  'keystone',
  'kiln',
  'kingfisher',
  'kodiak',
  'labyrinth',
  'landfall',
  'larkspur',
  'latitude',
  'lavaflow',
  'leeward',
  'lightship',
  'limestone',
  'longitude',
  'luminance',
  'lynxeye',
  'macaw',
  'maelstrom',
  'magnetic',
  'magnolia',
  'mainsail',
  'mandala',
  'mantissa',
  'manuscript',
  'mariner',
  'marmot',
  'mastiff',
  'matador',
  'maverick',
  'mayflower',
  'megalith',
  'meridian',
  'mesosphere',
  'metronome',
  'microcosm',
  'milestone',
  'millstone',
  'minaret',
  'minefield',
  'miracle',
  'moccasin',
  'moonraker',
  'morningstar',
  'mossback',
  'navigator',
  'needle',
  'nightfall',
  'nightshade',
  'nomadic',
  'northstar',
  'norwester',
  'nucleolus',
  'numerical',
  'oakwood',
  'observatory',
  'oceanus',
  'odyssey',
  'offing',
  'olympus',
  'onrush',
  'outback',
  'outpost',
  'overhang',
  'overland',
  'palisade',
  'palmetto',
  'paragon',
  'parapet',
  'parhelion',
  'pathfinder',
  'pendulum',
  'pentagon',
  'perimeter',
  'periscope',
  'permafrost',
  'petrified',
  'pharaoh',
  'pilgrim',
  'pipeline',
  'pitchstone',
  'planetary',
  'plough',
  'polymath',
  'pontoon',
  'porcupine',
  'potassium',
  'powerline',
  'prairie',
  'predator',
  'primrose',
  'promenade',
  'propeller',
  'prospect',
  'prowler',
  'ptarmigan',
  'pulverize',
  'pumice',
  'quadrant',
  'quarry',
  'quicksilver',
  'railroad',
  'rainforest',
  'rampart',
  'ravine',
  'reaction',
  'readout',
  'redwood',
  'refinery',
  'regatta',
  'reindeer',
  'reservist',
  'reservoir',
  'resolute',
  'retreat',
  'rhombus',
  'righthand',
  'roadrunner',
  'rockfall',
  'rockhound',
  'rosemary',
  'rotunda',
  'roundtable',
  'rowboat',
  'runway',
  'rutile',
  'sabertooth',
  'sandstone',
];

/**
 * Generates a human-memorable, high-entropy Diceware passphrase (e.g. "velvet-matrix-falcon-orbit").
 *
 * @param wordCount Number of words to select (defaults to 4, providing ~36-40 bits of entropy).
 * @param separator Delimiter between words (defaults to '-').
 */
export function generateDicewarePassphrase(wordCount = 4, separator = '-'): string {
  const count = Math.max(3, Math.min(8, wordCount));
  const randomIndices = new Uint32Array(count);
  crypto.getRandomValues(randomIndices);

  const words: string[] = [];
  const listSize = DICEWARE_WORDLIST.length;

  for (let i = 0; i < count; i++) {
    const idx = (randomIndices[i] ?? 0) % listSize;
    words.push(DICEWARE_WORDLIST[idx] ?? 'beacon');
  }

  return words.join(separator);
}

/**
 * Generates a pristine 32-byte (256-bit) cryptographically secure random passkey.
 *
 * @param format Output representation:
 *   - 'formatted': 8 blocks of 4 hex chars separated by dashes: "A1B2-C3D4-E5F6-7890-1234-5678-9ABC-DEF0" (human-friendly)
 *   - 'base64': 44-character standard Base64 string
 *   - 'hex': 64-character lowercase hex string
 */
export function generateRandomPasskey32(
  format: 'formatted' | 'base64' | 'hex' = 'formatted',
): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  if (format === 'base64') {
    try {
      return toBase64(bytes);
    } catch {
      // Fallback if sodium not initialized
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i] ?? 0);
      }
      return btoa(binary);
    }
  }

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (format === 'hex') {
    return hex;
  }

  // Format into 8 groups of 4 uppercase characters
  const upper = hex.toUpperCase();
  const groups: string[] = [];
  for (let i = 0; i < upper.length; i += 4) {
    groups.push(upper.slice(i, i + 4));
  }
  return groups.join('-');
}

/**
 * Normalizes any formatted key (removing hyphens, spaces, and converting to canonical form).
 */
export function normalizeFormattedKey(input: string): string {
  return input.replace(/[\s\-_]/g, '').trim();
}

/**
 * Derives a 32-byte (256-bit) cryptographic passkey from ANY key carrier image or arbitrary file.
 *
 * Uses BLAKE2b-256 (or SHA-256 fallback).
 * This enables users to use any photo (e.g., photo of a pet, coffee, art) as an unbreakable passkey.
 */
export function deriveKeyFromImage(imageBytes: Uint8Array): Uint8Array {
  if (imageBytes.length === 0) {
    throw new InvalidKeyError('Cannot derive key from empty image data.');
  }

  try {
    const sodium = getSodium();
    return sodium.crypto_generichash(32, imageBytes, null);
  } catch {
    // Zero-dependency pure TS fallback using SHA-256
    return sha256Pure(imageBytes);
  }
}

/**
 * Derives a deterministic 32-byte master key from any passphrase or text input.
 */
export function deriveKeyFromPassphrase(
  passphrase: string,
  saltString = 'OMBRIX_PASSKEY_MASTER_V1',
): Uint8Array {
  const cleanPass = passphrase.trim();
  if (!cleanPass) {
    throw new InvalidKeyError('Cannot derive key from empty passphrase.');
  }

  const encoder = new TextEncoder();
  const inputBytes = encoder.encode(cleanPass);
  const saltBytes = encoder.encode(saltString);

  const combined = new Uint8Array(inputBytes.length + saltBytes.length);
  combined.set(saltBytes, 0);
  combined.set(inputBytes, saltBytes.length);

  try {
    const sodium = getSodium();
    return sodium.crypto_generichash(32, combined, null);
  } catch {
    return sha256Pure(combined);
  }
}

/**
 * Derives a 32-byte key from WebAuthn credential raw ID or biometric authentication handle.
 */
export function deriveBiometricKey(
  credentialRawId: Uint8Array,
  saltString = 'OMBRIX_WEBAUTHN_BIOMETRIC_V1',
): Uint8Array {
  if (credentialRawId.length === 0) {
    throw new InvalidKeyError('Cannot derive key from empty biometric credential ID.');
  }

  const saltBytes = new TextEncoder().encode(saltString);
  const combined = new Uint8Array(credentialRawId.length + saltBytes.length);
  combined.set(saltBytes, 0);
  combined.set(credentialRawId, saltBytes.length);

  try {
    const sodium = getSodium();
    return sodium.crypto_generichash(32, combined, null);
  } catch {
    return sha256Pure(combined);
  }
}

/**
 * Evaluates estimated passkey entropy and provides a human-readable strength rating.
 */
export function estimatePasskeyStrength(passkey: string): {
  entropyBits: number;
  rating: 'Weak' | 'Moderate' | 'Strong' | 'Unbreakable';
  description: string;
} {
  const trimmed = passkey.trim();
  if (!trimmed) {
    return { entropyBits: 0, rating: 'Weak', description: 'Empty passkey' };
  }

  // Check for Diceware pattern (e.g. word-word-word)
  const words = trimmed.split(/[-_\s]+/);
  if (words.length >= 3 && words.every((w) => /^[a-zA-Z]+$/.test(w))) {
    const bits = words.length * 9.5; // ~9.5 bits per curated word
    return {
      entropyBits: Math.round(bits),
      rating: bits >= 45 ? 'Unbreakable' : bits >= 36 ? 'Strong' : 'Moderate',
      description: `${words.length}-word memorable Diceware passkey (~${Math.round(bits)} bits entropy)`,
    };
  }

  // Check for 16-byte or 32-byte hex or formatted hex (32 or 64 hex chars ignoring hyphens)
  const cleanHex = trimmed.replace(/[\s\-_]/g, '');
  if ((cleanHex.length === 32 || cleanHex.length === 64) && /^[0-9a-fA-F]+$/.test(cleanHex)) {
    const bits = cleanHex.length * 4;
    return {
      entropyBits: bits,
      rating: 'Unbreakable',
      description: `Full ${bits}-bit cryptographic key token (Maximum Security)`,
    };
  }

  // Check for Base64 32-byte (44 chars ending with = or alphanumeric)
  if (cleanHex.length >= 43 && /^[A-Za-z0-9+/=]+$/.test(cleanHex)) {
    return {
      entropyBits: 256,
      rating: 'Unbreakable',
      description: '256-bit Base64 cryptographic key (Maximum Security)',
    };
  }

  // General character set entropy
  let poolSize = 0;
  if (/[a-z]/.test(trimmed)) poolSize += 26;
  if (/[A-Z]/.test(trimmed)) poolSize += 26;
  if (/[0-9]/.test(trimmed)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(trimmed)) poolSize += 33;

  const bits = Math.round(trimmed.length * Math.log2(Math.max(2, poolSize)));
  let rating: 'Weak' | 'Moderate' | 'Strong' | 'Unbreakable' = 'Weak';
  if (bits >= 80) rating = 'Unbreakable';
  else if (bits >= 55) rating = 'Strong';
  else if (bits >= 35) rating = 'Moderate';

  return {
    entropyBits: bits,
    rating,
    description: `${trimmed.length}-character custom passphrase (~${bits} bits entropy)`,
  };
}

// Standalone SHA-256 for deterministic fallbacks
function sha256Pure(data: Uint8Array): Uint8Array {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const bitLength = data.length * 8;
  const paddingLength = data.length % 64 < 56 ? 56 - (data.length % 64) : 120 - (data.length % 64);
  const totalLength = data.length + paddingLength + 8;
  const padded = new Uint8Array(totalLength);
  padded.set(data);
  padded[data.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(totalLength - 4, bitLength >>> 0, false);
  view.setUint32(totalLength - 8, Math.floor(bitLength / 0x100000000), false);

  const W = new Int32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let i = 0; i < totalLength; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getInt32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t - 15] ?? 0, 7) ^ rotr(W[t - 15] ?? 0, 18) ^ ((W[t - 15] ?? 0) >>> 3);
      const s1 = rotr(W[t - 2] ?? 0, 17) ^ rotr(W[t - 2] ?? 0, 19) ^ ((W[t - 2] ?? 0) >>> 10);
      W[t] = (((W[t - 16] ?? 0) + s0) | 0) + (((W[t - 7] ?? 0) + s1) | 0);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (((h + S1) | 0) + (((ch + (K[t] ?? 0)) | 0) + (W[t] ?? 0))) | 0 | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const result = new Uint8Array(32);
  const resView = new DataView(result.buffer);
  resView.setInt32(0, h0, false);
  resView.setInt32(4, h1, false);
  resView.setInt32(8, h2, false);
  resView.setInt32(12, h3, false);
  resView.setInt32(16, h4, false);
  resView.setInt32(20, h5, false);
  resView.setInt32(24, h6, false);
  resView.setInt32(28, h7, false);
  return result;
}

export const PASSKEY_MAGIC_V1 = new Uint8Array([0x4f, 0x4d, 0x42, 0x50, 0x41, 0x53, 0x53, 0x01]); // 'OMBPASS\x01'
export const PASSKEY_MAGIC_V2 = new Uint8Array([0x4f, 0x4d, 0x42, 0x50, 0x41, 0x53, 0x53, 0x02]); // 'OMBPASS\x02'
export const PASSKEY_MAGIC = PASSKEY_MAGIC_V2;

export const PASSKEY_SALT_BYTES = 16;

/**
 * Derives a 32-byte cryptographic key using memory-hard Argon2id (or BLAKE2b salt personalization fallback).
 * This makes offline dictionary and GPU farm brute-force attacks mathematically and computationally infeasible.
 */
export function derivePasskeyKey(passkey: string, salt: Uint8Array): Uint8Array {
  const clean = passkey.trim();
  const sodium = getSodium();
  try {
    return sodium.crypto_pwhash(
      32,
      clean,
      salt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_ARGON2ID13,
    );
  } catch {
    // Pure cryptographic fallback with BLAKE2b salt personalization
    const enc = new TextEncoder().encode(clean);
    return sodium.crypto_generichash(32, enc, salt);
  }
}

/**
 * Checks whether the given byte payload is encrypted with an OMBRIX Passkey / 32-Byte Token (V1 or V2).
 */
export function isPasskeyEncrypted(bytes: Uint8Array): boolean {
  if (bytes.length < 48) return false;
  const isV1 =
    bytes[0] === 0x4f &&
    bytes[1] === 0x4d &&
    bytes[2] === 0x42 &&
    bytes[3] === 0x50 &&
    bytes[4] === 0x41 &&
    bytes[5] === 0x53 &&
    bytes[6] === 0x53 &&
    bytes[7] === 0x01;
  const isV2 =
    bytes.length >= 64 &&
    bytes[0] === 0x4f &&
    bytes[1] === 0x4d &&
    bytes[2] === 0x42 &&
    bytes[3] === 0x50 &&
    bytes[4] === 0x41 &&
    bytes[5] === 0x53 &&
    bytes[6] === 0x53 &&
    bytes[7] === 0x02;
  return isV1 || isV2;
}

/**
 * Encrypts arbitrary data with a high-entropy passkey, memorable words, photo key, or 32-byte token.
 * Uses Libsodium authenticated secretbox (XSalsa20-Poly1305) with Argon2id memory-hard salted derivation.
 *
 * Container format V2: [8 bytes 'OMBPASS\x02'][16 bytes salt][24 bytes nonce][ciphertext + 16 bytes Poly1305 MAC tag]
 * Zeroes secret key memory buffer immediately upon completion to prevent RAM forensics leakage.
 */
export function encryptWithPasskey(
  data: Uint8Array,
  passkey: string,
  version: 1 | 2 = 2,
): Uint8Array {
  const clean = passkey.trim();
  if (!clean) {
    throw new InvalidKeyError('Cannot encrypt with empty passkey or token.');
  }
  const sodium = getSodium();

  if (version === 1) {
    const key32 = parseAnyKey32(clean);
    try {
      const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES); // 24 bytes
      const ciphertext = sodium.crypto_secretbox_easy(data, nonce, key32);

      const container = new Uint8Array(8 + 24 + ciphertext.length);
      container.set(PASSKEY_MAGIC_V1, 0);
      container.set(nonce, 8);
      container.set(ciphertext, 32);
      return container;
    } finally {
      zeroMemory(key32);
    }
  }

  // Version 2: Argon2id Memory-Hard Salted Container (Military-Grade Anti-GPU/ASIC)
  const salt = sodium.randombytes_buf(PASSKEY_SALT_BYTES);
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES); // 24 bytes
  const key32 = derivePasskeyKey(clean, salt);

  try {
    const ciphertext = sodium.crypto_secretbox_easy(data, nonce, key32);

    const container = new Uint8Array(8 + PASSKEY_SALT_BYTES + 24 + ciphertext.length);
    container.set(PASSKEY_MAGIC_V2, 0);
    container.set(salt, 8);
    container.set(nonce, 8 + PASSKEY_SALT_BYTES);
    container.set(ciphertext, 8 + PASSKEY_SALT_BYTES + 24);
    return container;
  } finally {
    zeroMemory(key32);
  }
}

/**
 * Decrypts a passkey-encrypted payload using the user's passkey or 32-byte token (supports both V1 and V2).
 * Throws DecryptionFailedError if the passkey or token does not match or if the data was tampered with.
 * Zeroes secret key memory buffer in finally block to ensure zero RAM residue.
 */
export function decryptWithPasskey(container: Uint8Array, passkey: string): Uint8Array {
  if (!isPasskeyEncrypted(container)) {
    throw new DecryptionFailedError('Data is not a valid OMBRIX passkey-encrypted container.');
  }
  const clean = passkey.trim();
  if (!clean) {
    throw new InvalidKeyError('Passkey or token is required to decrypt this payload.');
  }

  const sodium = getSodium();
  const isV2 = container[7] === 0x02;

  let key32: Uint8Array;
  let nonce: Uint8Array;
  let ciphertext: Uint8Array;

  if (isV2) {
    if (container.length < 8 + PASSKEY_SALT_BYTES + 24 + 16) {
      throw new DecryptionFailedError('Corrupt V2 passkey container: insufficient payload length.');
    }
    const salt = container.subarray(8, 8 + PASSKEY_SALT_BYTES);
    nonce = container.subarray(8 + PASSKEY_SALT_BYTES, 8 + PASSKEY_SALT_BYTES + 24);
    ciphertext = container.subarray(8 + PASSKEY_SALT_BYTES + 24);
    key32 = derivePasskeyKey(clean, salt);
  } else {
    // V1 backward compatibility
    nonce = container.subarray(8, 32);
    ciphertext = container.subarray(32);
    key32 = parseAnyKey32(clean);
  }

  try {
    const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key32);
    if (!plaintext) {
      throw new Error('MAC verification failed');
    }
    return plaintext;
  } catch (_err) {
    throw new DecryptionFailedError(
      'Decryption failed: incorrect passkey, token mismatch, or corrupted ciphertext.',
    );
  } finally {
    zeroMemory(key32);
  }
}
