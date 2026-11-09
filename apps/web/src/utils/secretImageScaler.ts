/**
 * OMBRIX Secret Image Scaler & Capacity Optimizer
 * Intelligently scales and optimizes high-resolution covert secret photos
 * to fit comfortably within carrier steganographic capacities.
 */

export interface OptimizedSecretImageResult {
  file: File;
  bytes: Uint8Array;
  width: number;
  height: number;
  isOptimized: boolean;
  originalSize: number;
  newSize: number;
}

/**
 * Optimizes an uploaded secret photo to fit within the carrier's usable payload capacity.
 * If the image already fits within the safe budget, it is preserved uncompressed.
 * If it exceeds capacity, it is smoothly resized keeping aspect ratio.
 */
export async function optimizeSecretPhoto(
  file: File,
  maxAllowedBytes: number,
  forceFit = true,
): Promise<OptimizedSecretImageResult> {
  const originalBuf = await file.arrayBuffer();
  const originalBytes = new Uint8Array(originalBuf);
  const originalSize = originalBytes.length;

  // If already fits with safety buffer (leaving 2KB for headers/envelope) and not forced, return original
  if (originalSize <= maxAllowedBytes - 2048 && !forceFit) {
    const dims = await getImageDimensions(file);
    return {
      file,
      bytes: originalBytes,
      width: dims.width,
      height: dims.height,
      isOptimized: false,
      originalSize,
      newSize: originalSize,
    };
  }

  // Load image into HTMLImageElement or ImageBitmap
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;

    // Target payload size: up to 80% of max allowed bytes to guarantee comfortable headroom
    const targetPayloadBytes = Math.max(16 * 1024, Math.floor(maxAllowedBytes * 0.82));

    // If original already fits comfortably
    if (originalSize <= targetPayloadBytes) {
      return {
        file,
        bytes: originalBytes,
        width: origW,
        height: origH,
        isOptimized: false,
        originalSize,
        newSize: originalSize,
      };
    }

    // Determine target dimension based on size reduction ratio
    // File size scales roughly quadratically with dimension
    const sizeRatio = Math.min(1.0, Math.sqrt(targetPayloadBytes / originalSize));
    let targetW = Math.max(200, Math.round(origW * sizeRatio));
    let targetH = Math.max(200, Math.round(origH * sizeRatio));

    // Cap max dimension to reasonable covert size (e.g. 1024px)
    const maxDim = 1024;
    if (targetW > maxDim || targetH > maxDim) {
      if (targetW >= targetH) {
        targetH = Math.round((targetH * maxDim) / targetW);
        targetW = maxDim;
      } else {
        targetW = Math.round((targetW * maxDim) / targetH);
        targetH = maxDim;
      }
    }

    // Canvas scaling with high-quality bicubic interpolation
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D context creation failed.');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Prefer WebP if supported for high compression density, fallback to JPEG
    let outputBlob: Blob | null = null;
    let format = 'image/webp';
    let quality = 0.85;

    // Progressive quality / dimension fitting loop
    for (let attempt = 0; attempt < 4; attempt++) {
      outputBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), format, quality);
      });

      if (!outputBlob && format === 'image/webp') {
        format = 'image/jpeg';
        continue;
      }

      if (outputBlob && outputBlob.size <= targetPayloadBytes) {
        break;
      }

      // If still too large, reduce quality or dimensions
      quality = Math.max(0.65, quality - 0.1);
      if (attempt >= 1) {
        targetW = Math.round(targetW * 0.8);
        targetH = Math.round(targetH * 0.8);
        canvas.width = targetW;
        canvas.height = targetH;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);
      }
    }

    if (!outputBlob) {
      throw new Error('Failed to encode optimized secret image.');
    }

    const optBuf = await outputBlob.arrayBuffer();
    const optBytes = new Uint8Array(optBuf);
    const ext = format === 'image/webp' ? 'webp' : 'jpg';
    const optFileName = `${file.name.replace(/\.[^/.]+$/, '')}_covert.${ext}`;
    const optFile = new File([outputBlob], optFileName, { type: format });

    return {
      file: optFile,
      bytes: optBytes,
      width: targetW,
      height: targetH,
      isOptimized: true,
      originalSize,
      newSize: optBytes.length,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Optimizes a covert photo payload specifically for Robust Messaging Steganography mode.
 * Robust mode modulates 16x16 luminance blocks with 5x FEC to survive social media recompression,
 * giving a usable budget of ~1KB - 2KB. This function scales the covert secret image down
 * to a micro-thumbnail (e.g. 48x48 or 64x64 WebP/JPEG) so it can fit cleanly into the carrier.
 */
export async function optimizeCovertPhotoForRobustMessaging(
  file: File,
  maxAllowedBytes = 1400,
): Promise<OptimizedSecretImageResult> {
  const originalBuf = await file.arrayBuffer();
  const originalBytes = new Uint8Array(originalBuf);
  const originalSize = originalBytes.length;

  if (originalSize <= maxAllowedBytes) {
    const dims = await getImageDimensions(file);
    return {
      file,
      bytes: originalBytes,
      width: dims.width,
      height: dims.height,
      isOptimized: false,
      originalSize,
      newSize: originalSize,
    };
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;

    // Start with 64x64 micro-thumbnail, keeping aspect ratio
    let targetW = 64;
    let targetH = 64;
    if (origW >= origH) {
      targetH = Math.max(32, Math.round((origH / origW) * 64));
    } else {
      targetW = Math.max(32, Math.round((origW / origH) * 64));
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D context creation failed.');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    let outputBlob: Blob | null = null;
    let quality = 0.7;

    for (let attempt = 0; attempt < 5; attempt++) {
      outputBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/webp', quality);
      });

      if (!outputBlob) {
        outputBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
        });
      }

      if (outputBlob && outputBlob.size <= maxAllowedBytes) {
        break;
      }

      // Progressively reduce dimensions or quality
      quality = Math.max(0.4, quality - 0.15);
      targetW = Math.max(32, Math.round(targetW * 0.85));
      targetH = Math.max(32, Math.round(targetH * 0.85));
      canvas.width = targetW;
      canvas.height = targetH;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetW, targetH);
    }

    if (!outputBlob) {
      throw new Error('Failed to encode robust micro-thumbnail image.');
    }

    const optBuf = await outputBlob.arrayBuffer();
    const optBytes = new Uint8Array(optBuf);
    const format = outputBlob.type.includes('webp') ? 'webp' : 'jpg';
    const optFileName = `${file.name.replace(/\.[^/.]+$/, '')}_robust_micro.${format}`;
    const optFile = new File([outputBlob], optFileName, { type: outputBlob.type });

    return {
      file: optFile,
      bytes: optBytes,
      width: targetW,
      height: targetH,
      isOptimized: true,
      originalSize,
      newSize: optBytes.length,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Helper to get natural dimensions of an image file.
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    img.onload = () => {
      resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
  });
}
