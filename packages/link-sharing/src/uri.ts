import { InvalidLinkFormatError } from './errors.js';
import type { LinkContainer } from './types.js';

function toUrlSafeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromUrlSafeBase64(base64url: string): string {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function serializeLinkUri(
  container: LinkContainer,
  baseUrl = 'https://ombrix.local',
): string {
  const json = JSON.stringify(container);
  const encoded = toUrlSafeBase64(json);
  const cleanBase = baseUrl.split('#')[0] ?? baseUrl;
  return `${cleanBase}#link=${encoded}`;
}

export function deserializeLinkUri(uri: string): LinkContainer {
  let rawFragment = uri;
  if (uri.includes('#')) {
    const parts = uri.split('#');
    rawFragment = parts[1] ?? '';
  }

  if (rawFragment.startsWith('link=')) {
    rawFragment = rawFragment.slice(5);
  }

  if (!rawFragment) {
    throw new InvalidLinkFormatError('URI contains no #link fragment or payload data.');
  }

  try {
    const json = fromUrlSafeBase64(rawFragment);
    const parsed = JSON.parse(json) as LinkContainer;

    if (parsed.magic !== 'OMBRIX_LINK' || parsed.version !== 1 || !parsed.metadata) {
      throw new InvalidLinkFormatError('Invalid container schema or magic header.');
    }

    return parsed;
  } catch (err) {
    if (err instanceof InvalidLinkFormatError) throw err;
    throw new InvalidLinkFormatError(
      `Failed to decode URL safe base64 link: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function exportLinkBundle(container: LinkContainer): string {
  return JSON.stringify(container, null, 2);
}

export function importLinkBundle(jsonStr: string): LinkContainer {
  try {
    const parsed = JSON.parse(jsonStr) as LinkContainer;
    if (parsed.magic !== 'OMBRIX_LINK' || parsed.version !== 1 || !parsed.metadata) {
      throw new InvalidLinkFormatError('Invalid link container JSON format.');
    }
    return parsed;
  } catch (err) {
    if (err instanceof InvalidLinkFormatError) throw err;
    throw new InvalidLinkFormatError(
      `Failed to parse link container bundle: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
