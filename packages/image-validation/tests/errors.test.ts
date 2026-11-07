import { describe, expect, it } from 'vitest';
import {
  AnimatedPngDetectedError,
  AnimatedPngNotSupportedError,
  CorruptPngChunkError,
  DecompressionBombDetectedError,
  DecompressionBombError,
  DimensionLimitExceededError,
  DimensionOutOfBoundsError,
  FileSizeLimitExceededError,
  ImageValidationError,
  InvalidPngSignatureError,
  InvalidSignatureError,
  MalformedChunkError,
  MalformedIhdrError,
  MissingIdatChunkError,
  MissingIendError,
  MissingIhdrError,
  PixelCountLimitExceededError,
  PixelLimitExceededError,
  TrailingDataError,
  TruncatedFileError,
  UnsupportedColorTypeError,
} from '../src/index.js';

describe('errors test suite', () => {
  it('ImageValidationError base class properties', () => {
    const err = new ImageValidationError('Custom error', 'CUSTOM_CODE');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ImageValidationError);
    expect(err.name).toBe('ImageValidationError');
    expect(err.message).toBe('Custom error');
    expect(err.code).toBe('CUSTOM_CODE');
  });

  it('TruncatedFileError instantiation', () => {
    const err = new TruncatedFileError();
    expect(err).toBeInstanceOf(ImageValidationError);
    expect(err.name).toBe('TruncatedFileError');
    expect(err.code).toBe('TRUNCATED_FILE');
  });

  it('InvalidSignatureError and InvalidPngSignatureError instantiation', () => {
    const err = new InvalidSignatureError();
    expect(err).toBeInstanceOf(ImageValidationError);
    expect(err).toBeInstanceOf(InvalidPngSignatureError);
    expect(err.name).toBe('InvalidSignatureError');
    expect(err.code).toBe('INVALID_SIGNATURE');
  });

  it('MissingIhdrError instantiation', () => {
    const err = new MissingIhdrError();
    expect(err).toBeInstanceOf(ImageValidationError);
    expect(err.name).toBe('MissingIhdrError');
    expect(err.code).toBe('MISSING_IHDR');
  });

  it('MalformedIhdrError instantiation', () => {
    const err = new MalformedIhdrError('Invalid IHDR');
    expect(err).toBeInstanceOf(ImageValidationError);
    expect(err.name).toBe('MalformedIhdrError');
    expect(err.code).toBe('MALFORMED_IHDR');
  });

  it('DimensionOutOfBoundsError and DimensionLimitExceededError instantiation', () => {
    const err = new DimensionOutOfBoundsError('Dims out of bounds');
    expect(err).toBeInstanceOf(ImageValidationError);
    expect(err).toBeInstanceOf(DimensionLimitExceededError);
    expect(err.name).toBe('DimensionOutOfBoundsError');
    expect(err.code).toBe('DIMENSION_OUT_OF_BOUNDS');
  });

  it('PixelCountLimitExceededError and PixelLimitExceededError instantiation', () => {
    const err = new PixelCountLimitExceededError('Pixel limit exceeded');
    expect(err).toBeInstanceOf(ImageValidationError);
    expect(err).toBeInstanceOf(PixelLimitExceededError);
    expect(err.name).toBe('PixelCountLimitExceededError');
    expect(err.code).toBe('PIXEL_COUNT_LIMIT_EXCEEDED');
  });

  it('FileSizeLimitExceededError instantiation', () => {
    const err = new FileSizeLimitExceededError('File size limit exceeded');
    expect(err).toBeInstanceOf(ImageValidationError);
    expect(err.name).toBe('FileSizeLimitExceededError');
    expect(err.code).toBe('FILE_SIZE_LIMIT_EXCEEDED');
  });

  it('AnimatedPngDetectedError and AnimatedPngNotSupportedError instantiation', () => {
    const err = new AnimatedPngDetectedError();
    expect(err).toBeInstanceOf(ImageValidationError);
    expect(err).toBeInstanceOf(AnimatedPngNotSupportedError);
    expect(err.name).toBe('AnimatedPngDetectedError');
    expect(err.code).toBe('ANIMATED_PNG_DETECTED');
  });

  it('DecompressionBombDetectedError and DecompressionBombError instantiation', () => {
    const err = new DecompressionBombDetectedError('Bomb detected');
    expect(err).toBeInstanceOf(ImageValidationError);
    expect(err).toBeInstanceOf(DecompressionBombError);
    expect(err.name).toBe('DecompressionBombDetectedError');
    expect(err.code).toBe('DECOMPRESSION_BOMB_DETECTED');
  });

  it('MissingIdatChunkError instantiation', () => {
    const err = new MissingIdatChunkError();
    expect(err).toBeInstanceOf(ImageValidationError);
    expect(err.name).toBe('MissingIdatChunkError');
    expect(err.code).toBe('MISSING_IDAT_CHUNK');
  });

  it('MalformedChunkError and CorruptPngChunkError instantiation', () => {
    const err = new MalformedChunkError('Malformed chunk');
    expect(err).toBeInstanceOf(ImageValidationError);
    expect(err).toBeInstanceOf(CorruptPngChunkError);
    expect(err.name).toBe('MalformedChunkError');
    expect(err.code).toBe('MALFORMED_CHUNK');
  });

  it('MissingIendError instantiation', () => {
    const err = new MissingIendError();
    expect(err).toBeInstanceOf(ImageValidationError);
    expect(err.name).toBe('MissingIendError');
    expect(err.code).toBe('MISSING_IEND');
  });

  it('TrailingDataError instantiation', () => {
    const err = new TrailingDataError();
    expect(err).toBeInstanceOf(ImageValidationError);
    expect(err.name).toBe('TrailingDataError');
    expect(err.code).toBe('TRAILING_DATA');
  });

  it('UnsupportedColorTypeError instantiation', () => {
    const err = new UnsupportedColorTypeError('Color unsupported');
    expect(err).toBeInstanceOf(ImageValidationError);
    expect(err).toBeInstanceOf(MalformedIhdrError);
    expect(err.name).toBe('UnsupportedColorTypeError');
    expect(err.code).toBe('UNSUPPORTED_COLOR_TYPE');
  });
});
