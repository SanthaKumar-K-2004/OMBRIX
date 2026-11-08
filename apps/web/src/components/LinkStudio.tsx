import {
  type LinkContainer,
  type OpenedLink,
  createLinkContainer,
  deserializeLinkUri,
  exportLinkBundle,
  importLinkBundle,
  openLinkContainer,
  serializeLinkUri,
} from '@ombrix/link-sharing';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileCheck,
  FileWarning,
  Key,
  Link as LinkIcon,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

export const LinkStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'open'>('create');

  // Create state
  const [carrierFile, setCarrierFile] = useState<File | null>(null);
  const [carrierBytes, setCarrierBytes] = useState<Uint8Array | null>(null);
  const [secretMessage, setSecretMessage] = useState(
    'Top secret rendezvous coordinates: 37.7749° N, 122.4194° W. Verification code: OMBRIX-LINK-99.',
  );
  const [ttlSeconds, setTtlSeconds] = useState<number>(86400); // default 24h
  const [passphrase, setPassphrase] = useState<string>('');
  const [burnAfterReading, setBurnAfterReading] = useState<boolean>(false);
  const [createdContainer, setCreatedContainer] = useState<LinkContainer | null>(null);
  const [generatedUri, setGeneratedUri] = useState<string>('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Open state
  const [inputUri, setInputUri] = useState<string>('');
  const [verifyCarrierFile, setVerifyCarrierFile] = useState<File | null>(null);
  const [verifyCarrierBytes, setVerifyCarrierBytes] = useState<Uint8Array | null>(null);
  const [openPassphrase, setOpenPassphrase] = useState<string>('');
  const [openedResult, setOpenedResult] = useState<OpenedLink | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  // Handle carrier upload for create
  const handleCarrierUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCarrierFile(file);
    const buf = await file.arrayBuffer();
    setCarrierBytes(new Uint8Array(buf));
    setCreateError(null);
  };

  // Handle carrier upload for verify
  const handleVerifyCarrierUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVerifyCarrierFile(file);
    const buf = await file.arrayBuffer();
    setVerifyCarrierBytes(new Uint8Array(buf));
    setOpenError(null);
  };

  // Create OMBRIX Link
  const handleCreateLink = async () => {
    try {
      setCreateError(null);
      if (!carrierBytes) {
        // Create dummy carrier bytes if none provided (for demo/quick testing)
        const dummy = new Uint8Array([
          137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
        ]);
        setCarrierBytes(dummy);
      }

      const activeCarrier = carrierBytes ?? new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
      const payloadBytes = new TextEncoder().encode(secretMessage);

      const container = await createLinkContainer({
        expiresInSeconds: ttlSeconds,
        carrierBytes: activeCarrier,
        payloadBytes,
        carrierName: carrierFile?.name ?? 'carrier-image.png',
        passphrase: passphrase.trim() ? passphrase : undefined,
        burnAfterReading,
      });

      const uri = serializeLinkUri(container, window.location.origin);
      setCreatedContainer(container);
      setGeneratedUri(uri);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    }
  };

  // Open & Verify Link
  const handleOpenLink = async () => {
    try {
      setOpenError(null);
      setOpenedResult(null);

      if (!inputUri.trim()) {
        throw new Error('Please enter an OMBRIX Link URI or container JSON.');
      }

      let container: LinkContainer;
      if (inputUri.trim().startsWith('{')) {
        container = importLinkBundle(inputUri.trim());
      } else {
        container = deserializeLinkUri(inputUri.trim());
      }

      const opened = await openLinkContainer(container, {
        passphrase: openPassphrase.trim() ? openPassphrase : undefined,
        carrierBytes: verifyCarrierBytes ?? undefined,
      });

      setOpenedResult(opened);
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : String(err));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const downloadBundle = (container: LinkContainer) => {
    const json = exportLinkBundle(container);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ombrix-link-${container.metadata.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#111827] via-[#1E1B4B]/30 to-[#111827] border border-[#1E293B] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#7C3AED]/20 text-[#A855F7] border border-[#7C3AED]/40">
              MILESTONE 13 ACTIVE
            </span>
            <span className="text-xs text-[#64748B]">• Local-First Ephemeral Sharing</span>
          </div>
          <h2 className="text-2xl font-bold font-['Sora'] text-white mt-1">
            OMBRIX Link — Ephemeral Steganographic Sharing
          </h2>
          <p className="text-xs text-[#94A3B8] max-w-2xl mt-1">
            Package steganographic secrets into self-verifying, time-bounded containers protected by
            BLAKE2b carrier hash rings and optional Argon2id password encryption with zero server
            dependencies.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-[#0B0F19] border border-[#1E293B]">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'create'
                ? 'bg-[#7C3AED] text-white shadow-md'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>Create Link</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('open')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'open'
                ? 'bg-[#7C3AED] text-white shadow-md'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Open & Verify</span>
          </button>
        </div>
      </div>

      {/* Threat Model & Architectural Disclosure */}
      <div className="p-4 rounded-xl bg-[#0B0F19]/60 border border-[#1E293B] flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#14B8A6] shrink-0 mt-0.5" />
        <div className="text-xs text-[#94A3B8] leading-relaxed">
          <span className="font-semibold text-[#E2E8F0]">
            Client-Side Integrity & TTL Disclosure:
          </span>{' '}
          OMBRIX Link operates entirely within your browser sandbox. The container hash ring
          cryptographically binds the carrier image to the envelope, rejecting tampered or
          re-encoded carriers. Expiration is enforced client-side; because OMBRIX has zero servers,
          data cannot be deleted from a recipient&apos;s local storage once downloaded.
        </div>
      </div>

      {activeTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create Form */}
          <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
            <h3 className="text-base font-bold font-['Sora'] text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#A855F7]" />
              <span>Container Configuration</span>
            </h3>

            {/* Carrier Image Input */}
            <div className="space-y-2">
              <label
                htmlFor="carrier-upload"
                className="block text-xs font-semibold text-[#E2E8F0]"
              >
                Carrier Image (PNG) for Hash Ring
              </label>
              <div className="relative border border-dashed border-[#334155] rounded-xl p-4 text-center hover:border-[#7C3AED] transition-colors cursor-pointer bg-[#0B0F19]/50">
                <input
                  id="carrier-upload"
                  type="file"
                  accept="image/png"
                  onChange={handleCarrierUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                  <Upload className="w-5 h-5 text-[#94A3B8]" />
                  <span className="text-xs text-[#E2E8F0]">
                    {carrierFile ? carrierFile.name : 'Drop carrier PNG or click to select'}
                  </span>
                  <span className="text-[10px] text-[#64748B]">
                    {carrierFile
                      ? `${(carrierFile.size / 1024).toFixed(1)} KB`
                      : 'Used for BLAKE2b hash ring binding'}
                  </span>
                </div>
              </div>
            </div>

            {/* Payload Content */}
            <div className="space-y-2">
              <label
                htmlFor="secret-message"
                className="block text-xs font-semibold text-[#E2E8F0]"
              >
                Steganographic Secret Payload
              </label>
              <textarea
                id="secret-message"
                value={secretMessage}
                onChange={(e) => setSecretMessage(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs text-white font-mono focus:border-[#7C3AED] focus:outline-none resize-none"
                placeholder="Enter secret text payload to package..."
              />
            </div>

            {/* TTL Expiration Selector */}
            <div className="space-y-2">
              <label
                htmlFor="ttl-selector"
                className="block text-xs font-semibold text-[#E2E8F0] flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span>Time-to-Live (TTL) Policy</span>
              </label>
              <div id="ttl-selector" className="grid grid-cols-4 gap-2">
                {[
                  { label: '1 Hour', seconds: 3600 },
                  { label: '24 Hours', seconds: 86400 },
                  { label: '7 Days', seconds: 604800 },
                  { label: '30 Days', seconds: 2592000 },
                ].map((item) => (
                  <button
                    key={item.seconds}
                    type="button"
                    onClick={() => setTtlSeconds(item.seconds)}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                      ttlSeconds === item.seconds
                        ? 'bg-[#7C3AED]/20 border-[#7C3AED] text-white shadow-sm'
                        : 'bg-[#0B0F19] border-[#1E293B] text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Passphrase */}
            <div className="space-y-2">
              <label
                htmlFor="passphrase-input"
                className="block text-xs font-semibold text-[#E2E8F0] flex items-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5 text-[#14B8A6]" />
                <span>Access Passphrase (Optional Argon2id Encryption)</span>
              </label>
              <input
                id="passphrase-input"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Leave blank for open link, or enter passphrase..."
                className="w-full p-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs text-white focus:border-[#7C3AED] focus:outline-none"
              />
            </div>

            {/* Burn Policy */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="burn"
                checked={burnAfterReading}
                onChange={(e) => setBurnAfterReading(e.target.checked)}
                className="w-4 h-4 rounded bg-[#0B0F19] border-[#1E293B] text-[#7C3AED] focus:ring-0"
              />
              <label htmlFor="burn" className="text-xs text-[#94A3B8] cursor-pointer">
                Flag container as Single-Access (&ldquo;Burn After Reading&rdquo;)
              </label>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleCreateLink}
              className="w-full py-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold transition-all shadow-lg shadow-[#7C3AED]/20 flex items-center justify-center gap-2"
            >
              <LinkIcon className="w-4 h-4" />
              <span>Generate OMBRIX Link Container</span>
            </button>
          </div>

          {/* Result Output Panel */}
          <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <h3 className="text-base font-bold font-['Sora'] text-white flex items-center justify-between">
                <span>Generated Ephemeral Package</span>
                {createdContainer && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#14B8A6]/10 text-[#14B8A6] border border-[#14B8A6]/30">
                    READY TO SHARE
                  </span>
                )}
              </h3>

              {createdContainer ? (
                <div className="space-y-4">
                  {/* Metadata Card */}
                  <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-2 text-xs font-mono">
                    <div className="flex justify-between items-center text-[#94A3B8]">
                      <span>Link ID:</span>
                      <span className="text-white">{createdContainer.metadata.id}</span>
                    </div>
                    <div className="flex justify-between items-center text-[#94A3B8]">
                      <span>Expires At:</span>
                      <span className="text-[#3B82F6]">
                        {new Date(createdContainer.metadata.expiresAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[#94A3B8]">
                      <span>Carrier BLAKE2b Hash:</span>
                      <span
                        className="text-[#14B8A6] truncate max-w-[200px]"
                        title={createdContainer.metadata.carrierHash}
                      >
                        {createdContainer.metadata.carrierHash.slice(0, 16)}...
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[#94A3B8]">
                      <span>Passphrase Protection:</span>
                      <span
                        className={
                          createdContainer.metadata.hasPassphrase
                            ? 'text-[#14B8A6]'
                            : 'text-[#64748B]'
                        }
                      >
                        {createdContainer.metadata.hasPassphrase
                          ? 'Enabled (Argon2id + SecretBox)'
                          : 'Disabled'}
                      </span>
                    </div>
                  </div>

                  {/* Shareable URL */}
                  <div className="space-y-2">
                    <label
                      htmlFor="shareable-link-url"
                      className="block text-xs font-semibold text-[#E2E8F0]"
                    >
                      Shareable URL Fragment
                    </label>
                    <div className="relative">
                      <input
                        id="shareable-link-url"
                        readOnly
                        value={generatedUri}
                        className="w-full p-2.5 pr-20 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-[11px] font-mono text-[#94A3B8] focus:outline-none select-all"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(generatedUri)}
                        className="absolute right-1 top-1 bottom-1 px-3 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[10px] font-bold transition-all flex items-center gap-1.5"
                      >
                        {copiedLink ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Download Bundle */}
                  <button
                    type="button"
                    onClick={() => downloadBundle(createdContainer)}
                    className="w-full py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 border border-[#334155]"
                  >
                    <Download className="w-4 h-4 text-[#3B82F6]" />
                    <span>Download .ombrix-link Container File</span>
                  </button>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#1E293B] rounded-xl text-[#64748B] space-y-2">
                  <LinkIcon className="w-8 h-8 opacity-40 text-[#7C3AED]" />
                  <p className="text-xs">
                    Configure parameters on the left and click Generate to create an ephemeral link.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Open & Verify Tab */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
            <h3 className="text-base font-bold font-['Sora'] text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#14B8A6]" />
              <span>Provide Link or Bundle</span>
            </h3>

            {/* URI or JSON Input */}
            <div className="space-y-2">
              <label
                htmlFor="link-uri-input"
                className="block text-xs font-semibold text-[#E2E8F0]"
              >
                OMBRIX Link URI or Container JSON
              </label>
              <textarea
                id="link-uri-input"
                value={inputUri}
                onChange={(e) => setInputUri(e.target.value)}
                rows={4}
                placeholder="Paste https://ombrix.local/#link=... or container JSON..."
                className="w-full p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs text-white font-mono focus:border-[#7C3AED] focus:outline-none resize-none"
              />
            </div>

            {/* Carrier Image Verification */}
            <div className="space-y-2">
              <label
                htmlFor="verify-carrier-upload"
                className="block text-xs font-semibold text-[#E2E8F0]"
              >
                Carrier Image (PNG) for Tamper Detection (Optional but Recommended)
              </label>
              <div className="relative border border-dashed border-[#334155] rounded-xl p-3 text-center hover:border-[#14B8A6] transition-colors cursor-pointer bg-[#0B0F19]/50">
                <input
                  id="verify-carrier-upload"
                  type="file"
                  accept="image/png"
                  onChange={handleVerifyCarrierUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-1 pointer-events-none">
                  <Upload className="w-4 h-4 text-[#94A3B8]" />
                  <span className="text-xs text-[#E2E8F0]">
                    {verifyCarrierFile
                      ? verifyCarrierFile.name
                      : 'Select carrier image to verify integrity'}
                  </span>
                </div>
              </div>
            </div>

            {/* Passphrase Input */}
            <div className="space-y-2">
              <label
                htmlFor="open-passphrase-input"
                className="block text-xs font-semibold text-[#E2E8F0]"
              >
                Passphrase (if container was encrypted)
              </label>
              <input
                id="open-passphrase-input"
                type="password"
                value={openPassphrase}
                onChange={(e) => setOpenPassphrase(e.target.value)}
                placeholder="Enter container passphrase..."
                className="w-full p-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs text-white focus:border-[#7C3AED] focus:outline-none"
              />
            </div>

            {openError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{openError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleOpenLink}
              className="w-full py-3 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-white text-xs font-bold transition-all shadow-lg shadow-[#14B8A6]/20 flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>Verify & Unpack Secret Container</span>
            </button>
          </div>

          {/* Verification Results Panel */}
          <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <h3 className="text-base font-bold font-['Sora'] text-white">
                Verification & Extracted Secret
              </h3>

              {openedResult ? (
                <div className="space-y-4">
                  {/* Status Badges */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-[#14B8A6]" />
                      <div>
                        <div className="text-[10px] text-[#64748B]">TTL Policy</div>
                        <div className="text-xs font-bold text-[#14B8A6]">Valid Window</div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] flex items-center gap-2.5">
                      {openedResult.carrierVerified ? (
                        <FileCheck className="w-4 h-4 text-[#14B8A6]" />
                      ) : (
                        <FileWarning className="w-4 h-4 text-[#EAB308]" />
                      )}
                      <div>
                        <div className="text-[10px] text-[#64748B]">Carrier Integrity</div>
                        <div
                          className={`text-xs font-bold ${openedResult.carrierVerified ? 'text-[#14B8A6]' : 'text-[#EAB308]'}`}
                        >
                          {openedResult.carrierVerified
                            ? 'BLAKE2b Verified'
                            : 'Carrier Not Supplied'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Secret Payload Viewer */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="unpacked-secret-payload"
                        className="text-xs font-semibold text-[#E2E8F0]"
                      >
                        Unpacked Secret Payload
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(new TextDecoder().decode(openedResult.payloadBytes))
                        }
                        className="text-[10px] text-[#A855F7] hover:underline flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy Secret</span>
                      </button>
                    </div>
                    <textarea
                      id="unpacked-secret-payload"
                      readOnly
                      rows={5}
                      value={new TextDecoder().decode(openedResult.payloadBytes)}
                      className="w-full p-3 rounded-xl bg-[#0B0F19] border border-[#14B8A6]/40 text-xs font-mono text-[#E2E8F0] focus:outline-none resize-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#1E293B] rounded-xl text-[#64748B] space-y-2">
                  <ShieldAlert className="w-8 h-8 opacity-40 text-[#14B8A6]" />
                  <p className="text-xs">
                    Paste an OMBRIX Link or container JSON and click Verify & Unpack to inspect.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
