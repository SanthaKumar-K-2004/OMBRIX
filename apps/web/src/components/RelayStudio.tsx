import { generateEncryptionKeyPair, initCrypto, openSeal, seal } from '@ombrix/crypto-adapter';
import {
  LocalOpaqueRelayStore,
  RelayInvalidTokenError,
  RelayMessageExpiredError,
  RelayMessageNotFoundError,
} from '@ombrix/relay-core';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Eye,
  Flame,
  Key,
  KeyRound,
  Lock,
  RefreshCw,
  Send,
  Server,
  Shield,
  Unlock,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { type BusCiphertextPayload, studioDataBus } from '../services/studioDataBus.js';

// Global in-memory local relay store instance for the browser session
const sessionRelayStore = new LocalOpaqueRelayStore();

export const RelayStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'retrieve' | 'inspector'>('deposit');

  // Deposit State
  const [payloadText, setPayloadText] = useState<string>(
    'CONFIDENTIAL DISPATCH: Zero-knowledge relay active. Burn immediately after reception.',
  );
  const [ttlSeconds, setTtlSeconds] = useState<number>(3600);
  const [maxRetrievals, setMaxRetrievals] = useState<number>(1);
  const [encryptBeforeDeposit, setEncryptBeforeDeposit] = useState<boolean>(true);
  const [depositResult, setDepositResult] = useState<{
    messageId: string;
    bearerToken: string;
    expiresAt: number;
    maxRetrievals: number;
  } | null>(null);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Retrieve State
  const [retrieveMessageId, setRetrieveMessageId] = useState<string>('');
  const [retrieveToken, setRetrieveToken] = useState<string>('');
  const [retrievedCiphertext, setRetrievedCiphertext] = useState<Uint8Array | null>(null);
  const [retrievedDecrypted, setRetrievedDecrypted] = useState<string | null>(null);
  const [retrieveError, setRetrieveError] = useState<string | null>(null);
  const [remainingRetrievals, setRemainingRetrievals] = useState<number | null>(null);

  // Keypair for demo encryption
  const [demoKeypair, setDemoKeypair] = useState<{
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  } | null>(null);

  // Initialize Libsodium & Keypair
  useEffect(() => {
    initCrypto().then(() => {
      const pair = generateEncryptionKeyPair();
      setDemoKeypair(pair);
    });
  }, []);

  // Subscribe to studio data bus for incoming ciphertext handoffs
  useEffect(() => {
    const unsubscribe = studioDataBus.subscribeCiphertext((payload: BusCiphertextPayload) => {
      if (payload.ciphertext && payload.ciphertext.length > 0) {
        // Prepare for deposit
        try {
          const res = sessionRelayStore.deposit(payload.ciphertext, {
            maxRetrievals: 1,
            ttlSeconds: 3600,
          });
          setDepositResult({
            messageId: res.envelope.messageId,
            bearerToken: res.bearerToken,
            expiresAt: res.envelope.expiresAt,
            maxRetrievals: res.envelope.maxRetrievals,
          });
          setActiveTab('deposit');
        } catch (err) {
          console.error('Error auto-depositing bus ciphertext:', err);
        }
      }
    });
    return unsubscribe;
  }, []);

  // Handle Deposit Action
  const handleDeposit = async () => {
    try {
      await initCrypto();
      let ciphertext: Uint8Array;

      if (encryptBeforeDeposit && demoKeypair) {
        const raw = new TextEncoder().encode(payloadText);
        ciphertext = seal(raw, demoKeypair.publicKey);
      } else {
        ciphertext = new TextEncoder().encode(payloadText);
      }

      const res = sessionRelayStore.deposit(ciphertext, {
        ttlSeconds,
        maxRetrievals,
      });

      setDepositResult({
        messageId: res.envelope.messageId,
        bearerToken: res.bearerToken,
        expiresAt: res.envelope.expiresAt,
        maxRetrievals: res.envelope.maxRetrievals,
      });

      // Automatically fill retrieve inputs for convenient verification
      setRetrieveMessageId(res.envelope.messageId);
      setRetrieveToken(res.bearerToken);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Deposit error: ${msg}`);
    }
  };

  // Handle Retrieve Action
  const handleRetrieve = async () => {
    setRetrieveError(null);
    setRetrievedCiphertext(null);
    setRetrievedDecrypted(null);

    try {
      const result = sessionRelayStore.retrieve(retrieveMessageId.trim(), retrieveToken.trim());

      setRetrievedCiphertext(result.ciphertext);
      setRemainingRetrievals(result.remainingRetrievals);

      // Attempt decryption if encrypted with demoKeypair
      if (encryptBeforeDeposit && demoKeypair) {
        try {
          const decrypted = openSeal(
            result.ciphertext,
            demoKeypair.publicKey,
            demoKeypair.privateKey,
          );
          setRetrievedDecrypted(new TextDecoder().decode(decrypted));
        } catch {
          setRetrievedDecrypted(new TextDecoder().decode(result.ciphertext));
        }
      } else {
        setRetrievedDecrypted(new TextDecoder().decode(result.ciphertext));
      }
    } catch (err: unknown) {
      if (err instanceof RelayMessageNotFoundError) {
        setRetrieveError('Message not found or already consumed (burned-after-read).');
      } else if (err instanceof RelayInvalidTokenError) {
        setRetrieveError('Invalid capability bearer token. Access denied.');
      } else if (err instanceof RelayMessageExpiredError) {
        setRetrieveError('Relay envelope has expired and was purged.');
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setRetrieveError(`Retrieval failed: ${msg}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#111827] border border-[#1E293B]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-[#A855F7]">
              Transport Privacy Layer
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#14B8A6]/10 text-[#14B8A6] border border-[#14B8A6]/30">
              Zero-Knowledge Opaque Relay
            </span>
          </div>
          <h2 className="text-xl font-bold font-['Sora'] text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-[#A855F7]" />
            <span>OMBRIX Zero-Knowledge Relay Studio</span>
          </h2>
          <p className="text-xs text-[#94A3B8]">
            Deposit and retrieve blind encrypted payloads using single-use capability bearer tokens
            and cryptographic burn-after-read guarantees.
          </p>
        </div>

        {/* Studio Subtabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0B0F19] border border-[#1E293B] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('deposit')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'deposit'
                ? 'bg-[#7C3AED] text-white shadow-sm'
                : 'text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Deposit Secret</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('retrieve')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'retrieve'
                ? 'bg-[#7C3AED] text-white shadow-sm'
                : 'text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Retrieve & Burn</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inspector')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'inspector'
                ? 'bg-[#7C3AED] text-white shadow-sm'
                : 'text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Relay Inspector</span>
          </button>
        </div>
      </div>

      {activeTab === 'deposit' && (
        /* Deposit Tab */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#7C3AED]" />
                <span>Opaque Envelope Configuration</span>
              </h3>

              <div>
                <label
                  htmlFor="relay-deposit-payload"
                  className="block text-xs text-[#94A3B8] mb-1.5"
                >
                  Secret Payload or Ciphertext
                </label>
                <textarea
                  id="relay-deposit-payload"
                  rows={4}
                  value={payloadText}
                  onChange={(e) => setPayloadText(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-[#7C3AED] resize-none"
                  placeholder="Enter message to store in blind relay..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ttl-select" className="block text-xs text-[#94A3B8] mb-1.5">
                    Time-To-Live (TTL)
                  </label>
                  <select
                    id="ttl-select"
                    value={ttlSeconds}
                    onChange={(e) => setTtlSeconds(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-[#7C3AED]"
                  >
                    <option value={300}>5 Minutes</option>
                    <option value={3600}>1 Hour</option>
                    <option value={86400}>24 Hours</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="max-retrievals-select"
                    className="block text-xs text-[#94A3B8] mb-1.5"
                  >
                    Burn Boundary
                  </label>
                  <select
                    id="max-retrievals-select"
                    value={maxRetrievals}
                    onChange={(e) => setMaxRetrievals(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-[#7C3AED]"
                  >
                    <option value={1}>1 Use (Burn-After-Read)</option>
                    <option value={2}>2 Uses</option>
                    <option value={5}>5 Uses</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#94A3B8]">
                <input
                  type="checkbox"
                  checked={encryptBeforeDeposit}
                  onChange={(e) => setEncryptBeforeDeposit(e.target.checked)}
                  className="rounded accent-[#7C3AED]"
                />
                <span>Encrypt with Libsodium Box Seal prior to relay deposit</span>
              </label>

              <button
                type="button"
                onClick={handleDeposit}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold shadow-lg shadow-[#7C3AED]/20 transition-all"
              >
                <Lock className="w-4 h-4" />
                <span>Deposit to Zero-Knowledge Relay</span>
              </button>
            </div>
          </div>

          {/* Deposit Output Card */}
          <div className="lg:col-span-6 space-y-4">
            {depositResult ? (
              <div className="p-5 rounded-2xl bg-[#111827] border border-[#14B8A6]/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#14B8A6]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Secret Deposited in Blind Store</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#14B8A6]/10 text-[#14B8A6] border border-[#14B8A6]/30">
                    Active in Memory
                  </span>
                </div>

                {/* Message ID */}
                <div className="space-y-1">
                  <div className="text-[11px] text-[#94A3B8]">Message ID:</div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] font-mono text-xs text-white">
                    <span className="truncate">{depositResult.messageId}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(depositResult.messageId);
                        setCopiedId(true);
                        setTimeout(() => setCopiedId(false), 2000);
                      }}
                      className="text-[#3B82F6] hover:text-white ml-2"
                    >
                      {copiedId ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#14B8A6]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Bearer Token */}
                <div className="space-y-1">
                  <div className="text-[11px] text-[#94A3B8]">
                    Capability Bearer Token (Single-Use):
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] font-mono text-xs text-[#A855F7]">
                    <span className="truncate">{depositResult.bearerToken}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(depositResult.bearerToken);
                        setCopiedToken(true);
                        setTimeout(() => setCopiedToken(false), 2000);
                      }}
                      className="text-[#A855F7] hover:text-white ml-2"
                    >
                      {copiedToken ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#14B8A6]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-[#64748B]">
                    Give this token to the recipient over a secondary secure channel.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-1.5 text-xs">
                  <div className="flex justify-between text-[#94A3B8]">
                    <span>Burn Policy:</span>
                    <span className="text-white font-mono flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-500" />
                      <span>{depositResult.maxRetrievals} Retrieval Max</span>
                    </span>
                  </div>
                  <div className="flex justify-between text-[#94A3B8]">
                    <span>Expires At:</span>
                    <span className="text-white font-mono">
                      {new Date(depositResult.expiresAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('retrieve')}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-xs font-medium text-white transition-colors"
                >
                  <Key className="w-3.5 h-3.5 text-[#14B8A6]" />
                  <span>Switch to Receiver Tab to Claim</span>
                </button>
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-[#111827] border border-[#1E293B] flex flex-col items-center justify-center text-center space-y-3">
                <Server className="w-10 h-10 text-[#64748B]" />
                <div className="text-sm font-semibold text-white">No Secret Deposited Yet</div>
                <p className="text-xs text-[#94A3B8] max-w-sm">
                  Configure your secret payload and click deposit. The relay will produce a blind
                  envelope and capability token.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'retrieve' && (
        /* Retrieve Tab */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#14B8A6]" />
                <span>Claim Secret from Relay</span>
              </h3>

              <div>
                <label htmlFor="claim-message-id" className="block text-xs text-[#94A3B8] mb-1.5">
                  Message ID
                </label>
                <input
                  id="claim-message-id"
                  type="text"
                  value={retrieveMessageId}
                  onChange={(e) => setRetrieveMessageId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-[#14B8A6]"
                  placeholder="e.g. 3bfb7b4b28bae959..."
                />
              </div>

              <div>
                <label htmlFor="claim-bearer-token" className="block text-xs text-[#94A3B8] mb-1.5">
                  Capability Bearer Token
                </label>
                <input
                  id="claim-bearer-token"
                  type="text"
                  value={retrieveToken}
                  onChange={(e) => setRetrieveToken(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs font-mono text-[#A855F7] focus:outline-none focus:border-[#A855F7]"
                  placeholder="Base64 32-byte capability token..."
                />
              </div>

              {retrieveError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{retrieveError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleRetrieve}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-black text-xs font-semibold shadow-lg shadow-[#14B8A6]/20 transition-all"
              >
                <Unlock className="w-4 h-4" />
                <span>Retrieve & Verify Burn</span>
              </button>
            </div>
          </div>

          {/* Retrieve Result Card */}
          <div className="lg:col-span-6 space-y-4">
            {retrievedCiphertext ? (
              <div className="p-5 rounded-2xl bg-[#111827] border border-[#14B8A6]/40 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#14B8A6]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Secret Retrieved Successfully</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <Flame className="w-3 h-3" />
                    <span>
                      {remainingRetrievals === 0
                        ? 'BURNED FROM RELAY'
                        : `${remainingRetrievals} LEFT`}
                    </span>
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] text-[#94A3B8]">Decrypted / Plaintext Content:</div>
                  <div className="p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] font-mono text-xs text-white break-words">
                    {retrievedDecrypted}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-1.5 text-xs">
                  <div className="flex justify-between text-[#94A3B8]">
                    <span>Ciphertext Size:</span>
                    <span className="text-white font-mono">{retrievedCiphertext.length} bytes</span>
                  </div>
                  <div className="flex justify-between text-[#94A3B8]">
                    <span>Store State:</span>
                    <span className="text-[#14B8A6] font-mono">
                      {remainingRetrievals === 0
                        ? 'Purged & destroyed forever'
                        : 'Remaining usage active'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRetrieve}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-xs font-medium text-white transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Attempt Second Retrieval (Test Burn Invariant)</span>
                </button>
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-[#111827] border border-[#1E293B] flex flex-col items-center justify-center text-center space-y-3">
                <KeyRound className="w-10 h-10 text-[#64748B]" />
                <div className="text-sm font-semibold text-white">Awaiting Token & Claim</div>
                <p className="text-xs text-[#94A3B8] max-w-sm">
                  Enter the Message ID and Capability Bearer Token to redeem the ciphertext.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'inspector' && (
        /* Zero-Knowledge Relay Inspector Tab */
        <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#A855F7]" />
                <span>Zero-Knowledge Server Memory Inspector</span>
              </h3>
              <p className="text-xs text-[#94A3B8]">
                Demonstrates what an untrusted relay server actually observes in its memory space.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#14B8A6] px-2.5 py-1 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6]" />
              <span>Active Envelopes in Store: {sessionRelayStore.count()}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-1.5">
              <div className="text-xs font-semibold text-[#14B8A6]">0% Plaintext Leaks</div>
              <p className="text-[11px] text-[#94A3B8]">
                Payloads are completely opaque ciphertext buffers. Relays have zero knowledge of
                original contents.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-1.5">
              <div className="text-xs font-semibold text-[#3B82F6]">Zero Stored Keys</div>
              <p className="text-[11px] text-[#94A3B8]">
                Relays do not hold public, private, or symmetric keys. Bearer tokens are stored only
                as 32-byte BLAKE2b hashes.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-1.5">
              <div className="text-xs font-semibold text-[#A855F7]">Burn-After-Read Purging</div>
              <p className="text-[11px] text-[#94A3B8]">
                Envelopes are discarded from memory immediately once max retrievals or TTL
                expiration is reached.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
