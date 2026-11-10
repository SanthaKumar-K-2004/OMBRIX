import { ArrowDownToLine, ArrowLeftRight, CheckCircle2, ImagePlus, Link2, LockKeyhole, ScanLine, ShieldCheck, Upload, XCircle } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

const MAGIC = new Uint8Array([0x4f, 0x4d, 0x42, 0x52, 0x58, 0x55, 0x52, 0x4c]); // OMBRXURL
const DEFAULT_URL = 'https://ombrix-stego.vercel.app/';

function bytesToBits(bytes: Uint8Array): number[] {
  const bits: number[] = [];
  for (const byte of bytes) {
    for (let bit = 7; bit >= 0; bit--) bits.push((byte >> bit) & 1);
  }
  return bits;
}

function makePacket(url: string): Uint8Array {
  const payload = new TextEncoder().encode(url);
  const packet = new Uint8Array(MAGIC.length + 4 + payload.length);
  packet.set(MAGIC, 0);
  new DataView(packet.buffer).setUint32(MAGIC.length, payload.length, false);
  packet.set(payload, MAGIC.length + 4);
  return packet;
}

function embedUrl(imageData: ImageData, url: string): void {
  const packet = makePacket(url);
  const bits = bytesToBits(packet);
  const capacity = imageData.width * imageData.height * 3;
  if (bits.length > capacity) throw new Error('This image is too small to hold the URL. Choose a larger image.');
  let bitIndex = 0;
  for (let pixel = 0; pixel < imageData.width * imageData.height && bitIndex < bits.length; pixel++) {
    const offset = pixel * 4;
    for (let channel = 0; channel < 3 && bitIndex < bits.length; channel++) {
      imageData.data[offset + channel] = (imageData.data[offset + channel] & 0xfe) | bits[bitIndex++];
    }
  }
}

function readBits(data: Uint8ClampedArray, count: number): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(count / 8));
  let bitIndex = 0;
  for (let pixel = 0; pixel < data.length / 4 && bitIndex < count; pixel++) {
    const offset = pixel * 4;
    for (let channel = 0; channel < 3 && bitIndex < count; channel++) {
      bytes[bitIndex >> 3] |= (data[offset + channel] & 1) << (7 - (bitIndex & 7));
      bitIndex++;
    }
  }
  return bytes;
}

function extractUrl(imageData: ImageData): string {
  const header = readBits(imageData.data, (MAGIC.length + 4) * 8);
  if (!MAGIC.every((value, index) => header[index] === value)) {
    throw new Error('No OMBRIX hidden URL was found in this image.');
  }
  const length = new DataView(header.buffer).getUint32(MAGIC.length, false);
  if (!length || length > 4096 || (MAGIC.length + 4 + length) * 8 > imageData.width * imageData.height * 3) {
    throw new Error('The hidden URL payload is invalid or damaged.');
  }
  const packet = readBits(imageData.data, (MAGIC.length + 4 + length) * 8);
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(packet.slice(MAGIC.length + 4));
  const parsed = new URL(decoded);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only HTTP and HTTPS destinations are allowed.');
  }
  return parsed.toString();
}

function loadImage(file: File): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read this image. Try a PNG, JPG, or WebP file.'));
    };
    image.src = objectUrl;
  });
}

export const InvisibleLinkStudio: React.FC = () => {
  const [mode, setMode] = useState<'embed' | 'scan'>('embed');
  const [url, setUrl] = useState(DEFAULT_URL);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoRedirect, setAutoRedirect] = useState(true);
  const redirectTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (redirectTimer.current !== null) window.clearTimeout(redirectTimer.current);
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
  }, [preview]);

  const chooseFile = (next: File | undefined) => {
    if (!next) return;
    setFile(next);
    setResultUrl(null);
    setError(null);
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(next));
  };

  const encode = async () => {
    if (!file) { setError('Choose a carrier image first.'); return; }
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error();
    } catch {
      setError('Enter a valid HTTP or HTTPS URL.');
      return;
    }
    setBusy(true); setError(null); setResultUrl(null);
    let objectUrl: string | null = null;
    try {
      const loaded = await loadImage(file);
      objectUrl = loaded.objectUrl;
      const canvas = document.createElement('canvas');
      canvas.width = loaded.image.naturalWidth;
      canvas.height = loaded.image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas is unavailable in this browser.');
      context.drawImage(loaded.image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      embedUrl(pixels, parsed.toString());
      context.putImageData(pixels, 0, 0);
      const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png'));
      const downloadUrl = URL.createObjectURL(png);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `ombrix-hidden-link-${Date.now()}.png`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
      setResultUrl(parsed.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not embed the URL.');
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setBusy(false);
    }
  };

  const scan = async () => {
    if (!file) { setError('Choose an image to scan.'); return; }
    setBusy(true); setError(null); setResultUrl(null);
    let objectUrl: string | null = null;
    try {
      const loaded = await loadImage(file);
      objectUrl = loaded.objectUrl;
      const canvas = document.createElement('canvas');
      canvas.width = loaded.image.naturalWidth;
      canvas.height = loaded.image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas is unavailable in this browser.');
      context.drawImage(loaded.image, 0, 0);
      const decoded = extractUrl(context.getImageData(0, 0, canvas.width, canvas.height));
      setResultUrl(decoded);
      if (autoRedirect) {
        redirectTimer.current = window.setTimeout(() => window.location.assign(decoded), 1800);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not decode this image.');
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setBusy(false);
    }
  };

  const cancelRedirect = () => {
    if (redirectTimer.current !== null) window.clearTimeout(redirectTimer.current);
    redirectTimer.current = null;
    setAutoRedirect(false);
  };

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-[#17152B] via-[#101827] to-[#0B0F19] p-6 sm:p-8">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-violet-200">
              <LockKeyhole className="h-3.5 w-3.5" /> Pixel-level URL concealment
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Invisible Link Studio</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
              Hide a web address inside an ordinary image. The picture has no visible QR pattern, logo, or added text. Decode it here with the OMBRIX scanner.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300">
            <ShieldCheck className="h-4 w-4" /> Local processing · No upload
          </div>
        </div>
      </div>

      <div className="flex w-fit rounded-xl border border-white/10 bg-[#0F172A] p-1">
        <button type="button" onClick={() => { setMode('embed'); setError(null); setResultUrl(null); }} className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${mode === 'embed' ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/40' : 'text-slate-400 hover:text-white'}`}>
          <span className="inline-flex items-center gap-2"><ImagePlus className="h-4 w-4" /> Hide URL</span>
        </button>
        <button type="button" onClick={() => { setMode('scan'); setError(null); setResultUrl(null); }} className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${mode === 'scan' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950/40' : 'text-slate-400 hover:text-white'}`}>
          <span className="inline-flex items-center gap-2"><ScanLine className="h-4 w-4" /> Scan image</span>
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#111827]/80 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">{mode === 'embed' ? '1. Choose a carrier image' : 'Choose an encoded image'}</h3>
            <span className="text-[10px] font-mono text-slate-500">PNG · JPG · WEBP input</span>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()} className="group flex min-h-56 w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-700 bg-[#0B0F19] p-4 text-center transition hover:border-violet-400/60">
            {preview ? <img src={preview} alt="Selected carrier preview" className="max-h-64 max-w-full rounded-lg object-contain" /> : <><Upload className="mb-3 h-9 w-9 text-slate-500 transition group-hover:text-violet-300" /><span className="text-sm font-medium text-slate-200">Select an image</span><span className="mt-1 text-xs text-slate-500">The original appearance is preserved</span></>}
          </button>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
          {file && <div className="flex items-center justify-between gap-3 text-xs text-slate-400"><span className="truncate">{file.name}</span><button type="button" onClick={() => { setFile(null); setPreview(null); setResultUrl(null); }} className="text-slate-500 hover:text-white" aria-label="Remove image"><XCircle className="h-4 w-4" /></button></div>}

          {mode === 'embed' ? (
            <div className="space-y-2">
              <label htmlFor="invisible-link-url" className="text-xs font-medium text-slate-300">Destination URL</label>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0B0F19] px-3">
                <Link2 className="h-4 w-4 shrink-0 text-violet-300" />
                <input id="invisible-link-url" value={url} onChange={(event) => setUrl(event.target.value)} className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-600" placeholder="https://example.com" />
              </div>
              <p className="text-[11px] leading-5 text-slate-500">The address is encoded into RGB least-significant bits. Export is always lossless PNG; JPEG recompression or resizing may destroy the hidden data.</p>
            </div>
          ) : (
            <label className="flex items-start gap-2 text-xs leading-5 text-slate-400">
              <input type="checkbox" checked={autoRedirect} onChange={(event) => setAutoRedirect(event.target.checked)} className="mt-0.5 accent-cyan-500" />
              Automatically open the recovered website after decoding
            </label>
          )}

          <button type="button" disabled={busy || !file} onClick={mode === 'embed' ? encode : scan} className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${mode === 'embed' ? 'bg-violet-600 hover:bg-violet-500' : 'bg-cyan-600 hover:bg-cyan-500'}`}>
            {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : mode === 'embed' ? <ArrowDownToLine className="h-4 w-4" /> : <ScanLine className="h-4 w-4" />}
            {busy ? 'Processing locally…' : mode === 'embed' ? 'Embed URL & Download PNG' : 'Decode hidden URL'}
          </button>
          {error && <div role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#111827]/80 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><ArrowLeftRight className="h-4 w-4 text-violet-300" /> How it works</div>
            <ol className="space-y-3 text-xs leading-5 text-slate-400">
              <li className="flex gap-3"><span className="font-mono text-violet-300">01</span><span>Encode the URL into tiny RGB pixel-bit changes. No QR graphic is drawn.</span></li>
              <li className="flex gap-3"><span className="font-mono text-violet-300">02</span><span>Download and share the resulting PNG as a file/document to preserve pixel data.</span></li>
              <li className="flex gap-3"><span className="font-mono text-violet-300">03</span><span>Open OMBRIX, choose Scan image, and select the PNG to recover the URL.</span></li>
            </ol>
          </div>
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-xs leading-5 text-amber-100/80">
            <strong className="text-amber-200">Scanner compatibility:</strong> This is invisible image steganography, not an optical QR code. A normal phone camera cannot decode invisible pixel data; the OMBRIX scanner must read the image file. Keep the PNG lossless—social apps that recompress images can erase the payload.
          </div>
          {resultUrl && (
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-300"><CheckCircle2 className="h-4 w-4" /> {mode === 'embed' ? 'Hidden URL embedded' : 'URL recovered'}</div>
              <a href={resultUrl} target="_blank" rel="noreferrer" className="break-all text-sm text-white underline decoration-emerald-400/50 underline-offset-4">{resultUrl}</a>
              {mode === 'scan' && autoRedirect && <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-emerald-200/80"><span>Opening website in a moment…</span><button type="button" onClick={cancelRedirect} className="rounded-md border border-emerald-300/20 px-2 py-1 hover:bg-emerald-300/10">Cancel</button></div>}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};
