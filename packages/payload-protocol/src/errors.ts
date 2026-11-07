export class PayloadProtocolError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'PayloadProtocolError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidMagicBytesError extends PayloadProtocolError {
  constructor(message = 'Invalid envelope magic bytes: expected ASCII "OMB1" header.') {
    super(message, 'INVALID_MAGIC_BYTES');
    this.name = 'InvalidMagicBytesError';
  }
}

export class UnsupportedVersionError extends PayloadProtocolError {
  constructor(message: string) {
    super(message, 'UNSUPPORTED_VERSION');
    this.name = 'UnsupportedVersionError';
  }
}

export class HeaderChecksumMismatchError extends PayloadProtocolError {
  constructor(message = 'Header CRC32 checksum mismatch: envelope header is corrupted.') {
    super(message, 'HEADER_CHECKSUM_MISMATCH');
    this.name = 'HeaderChecksumMismatchError';
  }
}

export class TruncatedEnvelopeError extends PayloadProtocolError {
  constructor(message: string) {
    super(message, 'TRUNCATED_ENVELOPE');
    this.name = 'TruncatedEnvelopeError';
  }
}

export class PayloadLengthExceededError extends PayloadProtocolError {
  constructor(message: string) {
    super(message, 'PAYLOAD_LENGTH_EXCEEDED');
    this.name = 'PayloadLengthExceededError';
  }
}

export class MalformedEnvelopeError extends PayloadProtocolError {
  constructor(message: string) {
    super(message, 'MALFORMED_ENVELOPE');
    this.name = 'MalformedEnvelopeError';
  }
}
