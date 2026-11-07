export class ImageValidationError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ImageValidationError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TruncatedFileError extends ImageValidationError {
  constructor(message = 'Truncated file: buffer ends prematurely.') {
    super(message, 'TRUNCATED_FILE');
    this.name = 'TruncatedFileError';
  }
}

export class InvalidSignatureError extends ImageValidationError {
  constructor(
    message = 'Invalid PNG signature: buffer does not match standard 8-byte PNG magic header.',
  ) {
    super(message, 'INVALID_SIGNATURE');
    this.name = 'InvalidSignatureError';
  }
}

export class MissingIhdrError extends ImageValidationError {
  constructor(message = 'Missing IHDR chunk: first chunk in PNG stream must be IHDR.') {
    super(message, 'MISSING_IHDR');
    this.name = 'MissingIhdrError';
  }
}

export class MalformedIhdrError extends ImageValidationError {
  constructor(message: string, code = 'MALFORMED_IHDR') {
    super(message, code);
    this.name = 'MalformedIhdrError';
  }
}

export class DimensionOutOfBoundsError extends ImageValidationError {
  constructor(message: string) {
    super(message, 'DIMENSION_OUT_OF_BOUNDS');
    this.name = 'DimensionOutOfBoundsError';
  }
}

export class PixelCountLimitExceededError extends ImageValidationError {
  constructor(message: string) {
    super(message, 'PIXEL_COUNT_LIMIT_EXCEEDED');
    this.name = 'PixelCountLimitExceededError';
  }
}

export class FileSizeLimitExceededError extends ImageValidationError {
  constructor(message: string) {
    super(message, 'FILE_SIZE_LIMIT_EXCEEDED');
    this.name = 'FileSizeLimitExceededError';
  }
}

export class AnimatedPngDetectedError extends ImageValidationError {
  constructor(message = 'Animated PNG (APNG) detected: carrier must be a static PNG image.') {
    super(message, 'ANIMATED_PNG_DETECTED');
    this.name = 'AnimatedPngDetectedError';
  }
}

export class DecompressionBombDetectedError extends ImageValidationError {
  constructor(message: string) {
    super(message, 'DECOMPRESSION_BOMB_DETECTED');
    this.name = 'DecompressionBombDetectedError';
  }
}

export class MissingIdatChunkError extends ImageValidationError {
  constructor(message = 'Missing IDAT chunk: PNG stream contains no image data.') {
    super(message, 'MISSING_IDAT_CHUNK');
    this.name = 'MissingIdatChunkError';
  }
}

export class MalformedChunkError extends ImageValidationError {
  constructor(message: string) {
    super(message, 'MALFORMED_CHUNK');
    this.name = 'MalformedChunkError';
  }
}

export class MissingIendError extends ImageValidationError {
  constructor(message = 'Missing IEND chunk: PNG stream terminated without IEND chunk.') {
    super(message, 'MISSING_IEND');
    this.name = 'MissingIendError';
  }
}

export class TrailingDataError extends ImageValidationError {
  constructor(message = 'Trailing data: extraneous bytes detected after IEND chunk.') {
    super(message, 'TRAILING_DATA');
    this.name = 'TrailingDataError';
  }
}

export class UnsupportedColorTypeError extends MalformedIhdrError {
  constructor(message = 'Unsupported color type or bit depth combination.') {
    super(message, 'UNSUPPORTED_COLOR_TYPE');
    this.name = 'UnsupportedColorTypeError';
  }
}

// Backwards compatibility aliases
export {
  InvalidSignatureError as InvalidPngSignatureError,
  AnimatedPngDetectedError as AnimatedPngNotSupportedError,
  DecompressionBombDetectedError as DecompressionBombError,
  DimensionOutOfBoundsError as DimensionLimitExceededError,
  PixelCountLimitExceededError as PixelLimitExceededError,
  MalformedChunkError as CorruptPngChunkError,
};
