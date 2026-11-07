export class StegoError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'StegoError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InsufficientCapacityError extends StegoError {
  constructor(message: string) {
    super(message, 'INSUFFICIENT_CAPACITY');
    this.name = 'InsufficientCapacityError';
  }
}

export class InvalidCarrierError extends StegoError {
  constructor(message: string) {
    super(message, 'INVALID_CARRIER');
    this.name = 'InvalidCarrierError';
  }
}

export class ExtractionError extends StegoError {
  constructor(message: string) {
    super(message, 'EXTRACTION_ERROR');
    this.name = 'ExtractionError';
  }
}

export class StegoAbortError extends StegoError {
  constructor(message = 'Steganographic processing was aborted by caller.') {
    super(message, 'STEGO_ABORTED');
    this.name = 'StegoAbortError';
  }
}
