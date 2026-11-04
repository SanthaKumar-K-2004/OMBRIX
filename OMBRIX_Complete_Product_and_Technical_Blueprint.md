# OMBRIX --- Complete Product, Technical & Development Blueprint

**Brand:** OMBRIX\
**Tagline:** *Beyond what the eye can see.*\
**Brand personality:** Premium, precise, discreet, trustworthy,
research-driven\
**Document status:** Product vision and implementation blueprint ---
v1.0\
**Project type:** Local-first secure media messaging, steganography
research, image analysis and transmission-resilience laboratory\
**Primary principle:** Privacy by design. Evidence over claims. No
invented cryptography.

------------------------------------------------------------------------

## 1. Executive summary

OMBRIX is a privacy-first, browser-based platform for **encrypting
information, embedding encrypted payloads inside supported images,
extracting and decrypting payloads for intended recipients, and
experimentally studying how image transformations affect hidden data**.

It combines three related products in one coherent workspace:

1.  **Secure image messaging** --- prepare a message or file, encrypt it
    for a recipient, embed the ciphertext in a supported carrier image,
    export the resulting image, and let the recipient extract and
    decrypt it.
2.  **Steganography research laboratory** --- compare embedding
    algorithms, carrier characteristics, payload rates, image-quality
    changes and extraction performance using repeatable experiments.
3.  **Image transmission and forensics laboratory** --- apply real
    transformations such as re-encoding, resizing, cropping and colour
    conversion, then measure whether payload recovery and cryptographic
    verification still succeed. Explore image statistics and
    known-method detection without claiming universal detection.

OMBRIX is not simply an "image password app", a generic file-sharing
service, or an AI chatbot. Its strongest differentiator is a
transparent, reproducible workflow that joins **cryptographic
protection, media embedding, carrier analysis and real transformation
testing**.

The first release should be deliberately narrow and dependable: static
PNG support, a well-defined binary payload format, vetted cryptographic
libraries, basic LSB embedding as an educational baseline, recipient key
management, and rigorous validation. More advanced algorithms should be
added only when their implementations and evaluation methods are
understood.

### What OMBRIX promises

-   Core operations can run locally in the user's browser.
-   Message contents are encrypted before embedding.
-   The recipient's private key is required to decrypt
    recipient-encrypted content.
-   The app explains supported formats, limits and known failure modes.
-   Users can test actual transformations and see measured recovery
    results.
-   Research results are reproducible and labelled with their exact
    method and test conditions.

### What OMBRIX must never promise

-   "100% undetectable" or "invisible to every detector".
-   "Unbreakable encryption".
-   Recovery after every social-media upload, screenshot, crop or lossy
    conversion.
-   Protection from a compromised device, malicious browser extension or
    malicious app update.
-   Sender identity merely because a payload can be decrypted.
-   An algorithm's security or robustness based only on a visual demo.

------------------------------------------------------------------------

## 2. Product definition

### 2.1 The problem

People need to protect the **contents** of sensitive messages and files.
In some situations, they may also want to avoid making the presence of a
message immediately obvious. Conventional encryption protects content
but does not normally conceal that encrypted data exists. Steganography
attempts to conceal the presence of data in an ordinary-looking carrier,
but it does not provide confidentiality by itself.

OMBRIX combines these layers:

-   **Encryption** protects the payload's contents.
-   **Steganographic embedding** attempts to conceal the payload inside
    a supported carrier.
-   **Digital signatures** can authenticate a sender's signing key,
    provided the recipient has independently verified that public key.
-   **Transmission simulation** measures how specific transformations
    affect recovery.
-   **Forensics tools** help users understand image properties and the
    limits of detection methods.

### 2.2 Intended users

-   People learning about privacy, cryptography and steganography.
-   Developers and security students who need a practical research
    environment.
-   Researchers comparing image embedding and detection methods.
-   Users who want local-first encrypted image-payload workflows.
-   Educators demonstrating the difference between encryption,
    steganography and steganalysis.

### 2.3 Product boundaries

**In scope for v1** - Browser-based application. - Local processing for
core workflows. - Static PNG carrier images. - Text and bounded file
payloads. - Recipient public-key encryption. - Optional sender
signatures. - Key generation, import/export and fingerprint
verification. - Basic LSB embed/extract. - Carrier inspection and
capacity estimation. - Transformation simulator. - Basic image
statistics and bit-plane inspection. - Clear error handling and security
documentation.

**Out of scope for v1** - Guaranteed anonymity or deniability. -
Guaranteed survival through arbitrary image transformations. - Automatic
recovery from severe crop, resize or recompression. - Full peer-to-peer
networking, accounts or cloud storage. - A proprietary cryptographic
protocol. - Training large AI models locally. - Claims of universal
steganalysis or universal detection. - JPEG coefficient-domain embedding
until a proper codec-domain implementation is available and tested.

------------------------------------------------------------------------

## 3. Core concepts explained

  -----------------------------------------------------------------------
  Concept                 Meaning                 OMBRIX use
  ----------------------- ----------------------- -----------------------
  Cryptography            Mathematical protection Encrypt payload before
                          of information          embedding

  Public-key encryption   Encrypt for a recipient Only the matching
                          using their public key  private key can decrypt

  Digital signature       Evidence that data was  Optional sender
                          signed by a particular  authentication
                          private key             

  Steganography           Hiding data inside      Embed ciphertext into
                          another medium          supported image data

  Steganalysis            Analysing media for     Research and
                          signs of hidden data    educational detection
                                                  tools

  Carrier image           The image that holds    PNG image selected by
                          the embedded payload    sender

  Payload                 The encrypted data and  Versioned binary
                          its required metadata   envelope

  Capacity                Amount of data an       Report theoretical and
                          algorithm could         configured limits
                          theoretically embed     separately

  Robustness              Ability to recover      Measured by simulator,
                          after a defined         never assumed
                          transformation          
  -----------------------------------------------------------------------

**Important:** Encryption and steganography solve different problems.
Encrypt first, then embed. Hiding unencrypted text is not an acceptable
secure-messaging design.

------------------------------------------------------------------------

## 4. Brand identity

### 4.1 Brand foundation

**Name:** OMBRIX\
**Tagline:** *Beyond what the eye can see.*

**Brand idea:** Information has layers. OMBRIX helps people protect,
place, inspect and understand information beneath the visible surface of
digital media.

**Brand attributes** - Premium, not flashy. - Technical, not
intimidating. - Discreet, not deceptive in its marketing. -
Research-led, not hype-led. - Transparent about limits. - Privacy-first
by default.

### 4.2 Brand voice

Use precise, calm language. Explain what a feature does and what it does
not do.

Good: - "Encrypted before embedding." - "Recovery tested against this
transformation." - "This carrier has limited configured capacity." -
"Signature verified against the saved public key."

Avoid: - "Military-grade invisible messages." - "Impossible to
detect." - "100% secure." - "AI makes your data invisible."

### 4.3 Visual direction

Recommended visual direction: - Deep obsidian backgrounds. - Violet as
the primary brand accent. - Electric blue for technical information and
interaction. - Teal reserved for success or verified states. - Cool
slate neutrals for surfaces and secondary text. - Subtle layered
gradients, fine grid patterns and restrained glow. - High contrast and
clear focus states; effects must never reduce readability.

Suggested initial palette:

  Token           Hex         Use
  --------------- ----------- -----------------------------
  Obsidian        `#0B0F19`   Main dark background
  Violet Core     `#7C3AED`   Primary brand/action accent
  Aurora Purple   `#A855F7`   Secondary highlight
  Neon Blue       `#3B82F6`   Technical accent
  Teal Accent     `#14B8A6`   Success/verified states
  Slate           `#94A3B8`   Secondary text
  Mist            `#E2E8F0`   Light surfaces/text
  White           `#FFFFFF`   High-contrast text

These are starting tokens, not a mandate to use every accent at once.
Keep the interface restrained.

### 4.4 Logo concept

The proposed symbol is a continuous, folded loop / angular ring. It can
represent: - A hidden layer within a visible surface. - A path that
passes behind and in front. - A protected information loop. - The
letterform "O" in OMBRIX.

Logo deliverables: - Primary horizontal logo: symbol + OMBRIX
wordmark. - Symbol-only app icon. - Light and dark variants. -
One-colour monochrome variant. - Small-size simplified mark. -
Clear-space and minimum-size rules.

Do not use a glow effect in every context. The symbol must remain
recognisable in flat monochrome at small sizes.

### 4.5 Typography

Suggested pairing: - **Sora** for display headings and brand wordmark
direction. - **Inter** for interface, forms, labels, tables and body
text. - **JetBrains Mono** for byte counts, hashes, fingerprints,
algorithm IDs and diagnostic output.

Use a consistent type scale, readable line lengths and accessible
contrast. Load fonts locally or self-host them; avoid third-party font
requests from the sensitive application origin if privacy minimisation
is a priority.

### 4.6 Motion and interaction

-   Use subtle transitions for state changes, not constant decorative
    movement.
-   Prefer CSS transitions for simple effects.
-   Use SVG for lightweight abstract line/mesh details.
-   Use GSAP only for a small number of carefully controlled hero
    animations if needed.
-   Respect `prefers-reduced-motion`.
-   Avoid large animated backgrounds on low-end devices.
-   Do not animate sensitive payload data or create fake "decrypting"
    progress.

------------------------------------------------------------------------

## 5. Product naming system

Use **OMBRIX + a short functional noun**. Keep names understandable and
consistent.

  -----------------------------------------------------------------------
  Product/module          Purpose                 Release
  ----------------------- ----------------------- -----------------------
  **OMBRIX Studio**       Main workspace and      v1
                          guided user experience  

  **OMBRIX Core**         Steganography engine    v1
                          and common algorithm    
                          interface               

  **OMBRIX Vault**        Key manager and         v1
                          encrypted key-backup    
                          workflow                

  **OMBRIX Lens**         Carrier inspection,     v1
                          image metrics and       
                          visual analysis         

  **OMBRIX Transit**      Transformation and      v1
                          recovery simulator      

  **OMBRIX Trace**        Forensics and           v1 / staged
                          steganalysis            
                          experiments             

  **OMBRIX Lab**          Algorithm experiments   v1
                          and reproducible        
                          benchmarks              

  **OMBRIX Edge**         Developer SDK, CLI and  later
                          integration interfaces  

  **OMBRIX Relay**        Optional future         later
                          transport/discovery     
                          service; no secret      
                          storage by default      
  -----------------------------------------------------------------------

Suggested navigation: - Studio - Vault - Lens - Lab - Transit - Trace -
Settings

Avoid shipping many separate products on day one. These are product
modules within one application until user demand justifies separate
packages.

------------------------------------------------------------------------

## 6. Feature catalogue and capabilities

### 6.1 OMBRIX Studio --- secure message workflow

**Sender flow** 1. Open Studio. 2. Select text or a file. 3. Select a
recipient contact or import their public encryption key. 4. Verify the
recipient fingerprint through a trusted independent channel. 5. Choose
whether to sign the message. 6. Encrypt the payload. 7. Select a
supported PNG carrier. 8. Inspect dimensions, format and configured
capacity. 9. Embed encrypted bytes. 10. Export the resulting PNG and
share it using a channel of the user's choice.

**Recipient flow** 1. Open the image in OMBRIX. 2. Validate the file and
supported format. 3. Extract the envelope. 4. Validate envelope version,
lengths and structural fields. 5. Decrypt using the recipient's private
key. 6. If a signature is present, verify it against a previously
trusted sender signing key. 7. Display the recovered text or offer a
safe file download. 8. Show a clear result: decrypted, signature
verified, signature absent, or signature invalid.

Never auto-execute extracted files. Treat extracted content as
untrusted.

### 6.2 OMBRIX Vault --- identity and key management

Capabilities: - Generate separate encryption and signing key pairs. -
Import/export public keys. - Display a stable public-key fingerprint. -
Verify and mark trusted contacts. - Export private keys only through an
explicit encrypted backup process. - Import encrypted backups after
password-based key derivation using a vetted library. - Support key
rotation and contact-key replacement warnings. - Show key creation date,
key ID and backup status. - Warn that loss of the private key can make
old messages unrecoverable.

Security rules: - Never reuse one private key for encryption and
signing. - Do not label a public key "trusted" just because it was
imported. - A fingerprint is useful only when compared through an
independent trusted channel. - Do not treat IndexedDB as a secure
vault. - Keep private key material in memory where practical; minimise
lifetime and copies. - Explain that JavaScript memory clearing is
best-effort, not guaranteed secure erasure.

### 6.3 OMBRIX Core --- steganography engine

Responsibilities: - Validate supported image buffers. - Calculate
theoretical and configured capacity. - Encode a versioned payload
envelope. - Embed bytes using a selected algorithm. - Extract bytes
using the matching algorithm and parameters. - Validate headers and
bounds. - Return typed errors. - Support cancellation and resource
limits. - Produce deterministic test fixtures where appropriate.

Initial algorithm: - Basic LSB for static PNG as an educational
baseline.

Later research candidates: - LSB matching. - PVD (Pixel Value
Differencing). - JPEG coefficient-domain DCT methods. - DWT methods. -
Adaptive embedding strategies.

Every method must implement a shared interface and include test vectors,
documented assumptions, capacity calculation, failure cases and
benchmark results.

### 6.4 OMBRIX Lens --- carrier analysis

Display: - File format and validated decoder result. - Width, height,
pixel count and colour model. - Compressed file size. - Estimated
theoretical capacity. - Configured usable capacity after
headers/overhead. - Payload size and utilisation. - Basic colour/channel
statistics. - Histogram and bit-plane views. - Basic texture/edge
indicators. - Image-quality comparison after embedding.

Use cautious wording: - "Estimated capacity" rather than "safe
capacity". - "Texture heuristic" rather than "stealth score". - "No
anomaly detected by this test" rather than "clean image".

### 6.5 OMBRIX Lab --- algorithm laboratory

Capabilities: - Choose a method and parameters. - Use the same carrier
fixtures across methods. - Compare payload rates. - Run repeatable
embedding/extraction tests. - Compare pixel difference, PSNR and SSIM. -
Record extraction success and exact recovered bytes. - Compare runtime
and memory use. - Export experiment results as JSON or CSV. - Display
method version, browser, device profile and experiment seed.

### 6.6 OMBRIX Transit --- transformation simulator

Apply real transformations: - PNG lossless re-encode. - JPEG conversion
at configurable quality. - Resize using selectable interpolation. - Crop
at selected coordinates. - Colour-space or bit-depth conversion where
supported. - Rotation and metadata changes. - Simulated platform-like
compression profiles, clearly labelled as simulations rather than exact
replicas of a platform's current pipeline.

For each transformation: 1. Save transformation parameters. 2. Apply the
transformation to a copy. 3. Attempt extraction. 4. Compare recovered
bytes. 5. Verify envelope authentication/decryption if possible. 6.
Record success/failure and exact conditions.

A result applies only to the tested image, method, payload and
parameters. Do not generalise one result to all images or services.

### 6.7 OMBRIX Trace --- image forensics and steganalysis

Initial tools: - Channel histograms. - Bit-plane visualisation. - LSB
distribution inspection. - Basic chi-square-style educational analysis
where correctly implemented. - Image metadata inspection. - Difference
maps between original and processed images. - Known-method extraction
when the algorithm and parameters are known.

Research-stage tools: - More advanced statistical detectors. -
Classifiers trained and evaluated on carefully controlled datasets. -
Comparative steganalysis benchmarks.

Every detector result must show: - Detector name and version. -
Supported image type. - Dataset or test conditions. - False-positive and
false-negative rates when measured. - Limitations and confidence
caveats.

A statistical test is not a universal steganography detector. False
positives and false negatives are expected.

### 6.8 OMBRIX Edge --- future developer interface

Potential future deliverables: - TypeScript SDK for supported browser
workflows. - Rust library for image-processing primitives. - CLI for
batch experiments. - Documented payload-format reader/writer. - JSON
experiment format. - API for local integration.

Do not expose an unstable binary protocol as a public SDK before the
format is versioned and tested.

------------------------------------------------------------------------

## 7. Recommended technology stack

### 7.1 Frontend

  -----------------------------------------------------------------------
  Layer                   Recommended technology  Reason
  ----------------------- ----------------------- -----------------------
  Language                TypeScript              Safer contracts for
                                                  complex binary and UI
                                                  workflows

  Framework               React                   Mature component
                                                  ecosystem

  Build tool              Vite                    Fast local development
                                                  and static output

  Styling                 Tailwind CSS            Consistent design
                                                  tokens and rapid UI
                                                  implementation

  Components              shadcn/ui + Radix       Accessible,
                          primitives              customisable UI
                                                  foundations

  Icons                   Lucide                  Consistent line-icon
                                                  system

  Charts                  Lightweight chart       Keep metrics readable
                          library or custom SVG   and bundle lean

  State                   React state/context;    Avoid unnecessary
                          add Zustand only if     dependencies
                          complexity requires it  

  Validation              Zod or equivalent       Validate imported
                          runtime schema          metadata and user
                          validation              inputs

  Tests                   Vitest + React Testing  Unit, component and
                          Library + Playwright    end-to-end coverage
  -----------------------------------------------------------------------

### 7.2 Image processing

**Start with TypeScript and browser primitives.** - `Uint8Array` for
binary payloads. - `ImageBitmap` / controlled decoding for supported
raster input. - Canvas/ImageData for pixel-level PNG operations. - Web
Workers for CPU-heavy tasks. - OffscreenCanvas where browser support and
tests justify it.

Use a dedicated image validation layer. Do not trust file extensions or
MIME strings alone.

**Rust + WebAssembly is an optimisation path, not a requirement for the
first prototype.** Adopt it when profiling identifies a real bottleneck
or when a shared native/WASM core is justified. Keep the TypeScript
interface stable so the implementation can be swapped later.

### 7.3 Cryptography

Use a maintained, reviewed cryptographic library such as libsodium
through a suitable browser build, or a vetted HPKE implementation if the
protocol explicitly adopts HPKE.

Recommended v1 choice for simplicity: - Recipient encryption: libsodium
sealed boxes, after validating the chosen library build and its
supported browser behaviour. - Sender authentication: separate Ed25519
signing key and signature over a canonical envelope representation. -
Key derivation for encrypted backups: a vetted password KDF supported by
the selected library, with documented parameters and versioning.

Important sealed-box property: sealed boxes provide recipient
confidentiality but do not identify the sender. The optional independent
signature supplies sender-key authentication. The sender public key must
already be trusted by the recipient.

Alternative: - HPKE according to RFC 9180 with a specified suite, plus a
separate signature system. - Do not casually combine algorithms or
invent a custom HPKE wire format.

Do not implement encryption primitives yourself. Do not use home-grown
XOR, custom AES, homemade key exchange or password hashing.

### 7.4 Research and benchmarking

  Purpose                Technology
  ---------------------- ---------------------------------------------
  Research scripts       Python
  Image analysis         OpenCV, Pillow
  Numerical work         NumPy, SciPy
  Data analysis          pandas
  Charts                 Matplotlib
  Experiments            Jupyter notebooks
  Optional ML research   scikit-learn / PyTorch, only when justified

Python is for offline research and evaluation initially, not required
for the browser's core secure-message path.

### 7.5 Storage and hosting

-   No backend is required for core encryption, embedding, extraction or
    local analysis.
-   IndexedDB may store public contacts, non-secret preferences and
    optional local experiment history.
-   Do not store plaintext messages or private keys persistently by
    default.
-   Private-key backups should be explicit, encrypted and
    user-controlled.
-   Deploy static assets to a static HTTPS host. Review current
    free-tier terms before selecting a provider.
-   Consider separate origins for the public marketing site and
    sensitive application.
-   Avoid third-party analytics, advertising scripts and unnecessary
    remote dependencies on the sensitive app origin.

### 7.6 Quality and security tooling

-   GitHub Actions --- CI.
-   Vitest --- unit tests.
-   Playwright --- browser tests.
-   OWASP ZAP --- web security testing.
-   Semgrep --- static analysis.
-   OSV-Scanner --- dependency vulnerability checks.
-   Grype --- image/package vulnerability scanning where relevant.
-   cargo-fuzz --- Rust fuzzing if Rust is introduced.
-   Dependabot or equivalent --- dependency update alerts.
-   ESLint + TypeScript strict mode --- code quality.

All listed tools have free/open-source usage paths, but hosted services
may impose plan limits. Verify current terms.

------------------------------------------------------------------------

## 8. High-level architecture

``` text
                         OMBRIX STUDIO (React + TypeScript)
                                      |
              +-----------------------+-----------------------+
              |                       |                       |
        Secure Messaging          Research Workspace       Settings
              |                       |                       |
        +-----+------+          +-----+------+           Key Manager
        |            |          |            |           Preferences
     Encrypt      Decrypt     Lens          Lab
        |            |          |            |
        +------ Payload Protocol +------ Transit / Trace
                       |
                 OMBRIX Core API
                       |
              +--------+---------+
              |                  |
        Crypto Adapter      Stego Adapter
              |                  |
       Vetted crypto lib    TypeScript PNG engine
                                 |
                         Web Worker boundary
                                 |
                       Optional Rust/WASM core
                       (only after profiling)

     Local storage: public contacts / preferences / opt-in experiment data
     No required server-side secret or message storage
```

### 8.1 Main boundaries

-   UI components do not implement cryptographic primitives.
-   The crypto adapter does not know about image pixels.
-   The steganography engine does not decrypt content.
-   The payload protocol validates structure and versioning.
-   Workers receive bounded inputs and return typed results.
-   Research scripts do not silently become production runtime
    dependencies.

### 8.2 Suggested monorepo

``` text
ombrix/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── features/
│       │   │   ├── studio/
│       │   │   ├── vault/
│       │   │   ├── lens/
│       │   │   ├── lab/
│       │   │   ├── transit/
│       │   │   └── trace/
│       │   ├── components/
│       │   ├── workers/
│       │   ├── hooks/
│       │   ├── security/
│       │   └── styles/
│       └── tests/
├── packages/
│   ├── crypto-adapter/
│   ├── payload-protocol/
│   ├── image-validation/
│   ├── stego-interface/
│   ├── stego-png-lsb/
│   ├── metrics/
│   └── shared-types/
├── crates/
│   └── ombrix-stego/              # optional future Rust/WASM engine
├── research/
│   ├── notebooks/
│   ├── datasets/
│   ├── steganalysis/
│   └── benchmarks/
├── tests/
│   ├── vectors/
│   ├── fixtures/
│   ├── malformed-images/
│   ├── crypto/
│   └── protocol/
├── docs/
│   ├── product-spec.md
│   ├── architecture.md
│   ├── threat-model.md
│   ├── protocol-v1.md
│   ├── key-management.md
│   ├── privacy.md
│   ├── algorithms.md
│   ├── benchmark-methodology.md
│   └── limitations.md
└── .github/
    └── workflows/
        ├── ci.yml
        ├── security.yml
        └── release.yml
```

------------------------------------------------------------------------

## 9. Secure message data flow

### 9.1 Sender

``` text
Plaintext / file
      |
      v
Input validation + size limit
      |
      v
Optional compression (only if beneficial)
      |
      v
Construct versioned message metadata
      |
      v
Recipient encryption using vetted library
      |
      v
Optional sender signature over canonical envelope
      |
      v
Serialize bounded binary envelope
      |
      v
Check carrier format and configured capacity
      |
      v
Embed envelope bytes into supported PNG
      |
      v
Validate output and export PNG
```

### 9.2 Recipient

``` text
PNG file
   |
   v
Validate signature, dimensions, pixel limits and format
   |
   v
Extract bounded envelope
   |
   v
Validate protocol version, lengths and fields
   |
   v
Decrypt using recipient private key
   |
   v
Verify sender signature if present and trusted key available
   |
   v
Display text or offer safe file download
```

The UI must distinguish: - Decryption succeeded. - Signature verified. -
Signature missing. - Signature invalid. - Sender key not trusted. -
Unsupported protocol version. - Corrupted or incomplete payload. - Wrong
recipient key. - Extraction failed.

Do not collapse these into a generic "secure" success badge.

------------------------------------------------------------------------

## 10. Payload protocol design

Define and document a versioned binary envelope before supporting
multiple algorithms.

Possible conceptual fields: - Magic bytes / format identifier. -
Protocol version. - Cryptographic suite identifier. - Embedding method
identifier. - Flags. - Recipient key identifier or fingerprint. - Random
message identifier. - Creation timestamp (informational, not proof of
freshness). - Encapsulation data where required by the chosen encryption
scheme. - Ciphertext length. - Ciphertext. - Optional sender signing-key
identifier. - Optional signature.

The exact format depends on the selected cryptographic scheme. A
sealed-box format and an HPKE format are not interchangeable. Finalise
byte-level details in `protocol-v1.md`.

Protocol requirements: - Define byte order and field lengths. - Define
canonical signature input. - Authenticate security-critical metadata. -
Validate every length before allocation. - Set strict maximum envelope
sizes. - Reject truncated or malformed payloads. - Reject unknown
mandatory versions. - Define how optional fields are handled. - Include
test vectors for valid and invalid messages. - Do not use timestamps
alone as replay protection. - Maintain local message-ID history if
duplicate warnings are useful. - Never auto-execute extracted files.

------------------------------------------------------------------------

## 11. Steganography method plan

### 11.1 LSB --- first implementation

For a supported RGB pixel, each channel has a least significant bit. A
simple educational implementation can encode one payload bit in the
least significant bit of a selected channel.

Example: - ASCII `A` is decimal 65. - Its 8-bit representation is
`01000001`. - Those bits can be placed in selected channel LSBs
according to a documented traversal order.

The actual production implementation must also handle: - Header and
envelope format. - Payload length. - Channel order. - Pixel traversal
order. - Bounds checks. - Capacity calculation. - Deterministic
extraction. - Invalid or truncated input. - Output validation.

LSB is useful as a baseline, but it is vulnerable to statistical
analysis and lossy transformations. It must not be marketed as
undetectable.

### 11.2 Method roadmap

  -----------------------------------------------------------------------
  Method                  Role                    Key caveat
  ----------------------- ----------------------- -----------------------
  Basic LSB               First educational       Simple and fragile;
                          baseline                statistical detection
                                                  risk

  LSB matching            Comparative             Not automatically
                          spatial-domain method   undetectable

  PVD                     Research candidate      Parameter choices
                                                  affect distortion and
                                                  detectability

  DCT                     JPEG-domain research    Must operate on proper
                                                  JPEG coefficients, not
                                                  pretend Canvas pixels
                                                  are DCT

  DWT                     Transform-domain        More complex;
                          research                robustness is not
                                                  guaranteed

  Adaptive methods        Advanced research       Must demonstrate gains
                                                  on controlled
                                                  benchmarks
  -----------------------------------------------------------------------

### 11.3 Capacity example

For a 1920 × 1080 RGB image using one bit per channel:

`1920 × 1080 × 3 ÷ 8 = 777,600 bytes`

That is approximately 759 KiB before headers and other overhead. This is
a theoretical upper bound for that simple scheme, not a recommended
payload target and not a "safe" amount. Higher payload utilisation can
increase distortion and detection risk.

Always report: - Theoretical capacity. - Configured maximum. - Envelope
overhead. - Actual payload size. - Payload utilisation. - Any
method-specific restrictions.

------------------------------------------------------------------------

## 12. Image validation and resource safety

Treat every uploaded file as hostile.

### v1 supported input

-   Static PNG only.
-   Reject SVG, GIF, animated formats and unsupported raster formats.
-   Do not trust extension or browser MIME type alone.
-   Validate file signature and decode through a controlled path.
-   Reject malformed files.

### Initial conservative limits

These are starting defaults and must be profiled on target devices: -
Compressed input file: 15 MiB maximum. - Width or height: 4096 pixels
maximum. - Total pixels: 12 million maximum. - Plaintext text message: 1
MiB maximum. - File payload: 2 MiB maximum for initial release. - One
active image-processing job. - Configurable processing timeout,
initially around 15 seconds.

The actual decoded image can consume far more memory than the compressed
file. Decoded pixels, canvas buffers, WASM memory and output buffers can
coexist. Reuse buffers where possible and avoid unnecessary copies.

### Safe processing sequence

1.  Check compressed file size.
2.  Inspect file signature.
3.  Confirm supported format.
4.  Decode with controlled handling.
5.  Check width, height and pixel count before large processing
    allocations where possible.
6.  Validate colour model and supported channels.
7.  Calculate capacity before embedding.
8.  Process inside a Web Worker.
9.  Support cancellation and timeout.
10. Validate generated output.
11. Revoke temporary object URLs.
12. Release references and clear temporary buffers where practical.

JavaScript garbage collection means secure memory erasure cannot be
guaranteed.

------------------------------------------------------------------------

## 13. Threat model and security design

### 13.1 Assets to protect

-   Message and file contents.
-   Recipient private encryption key.
-   Sender private signing key.
-   Contact trust records.
-   Local experiment data if it contains sensitive material.
-   Integrity of the application and protocol.

### 13.2 Threats and mitigations

  -----------------------------------------------------------------------
  Threat                  Impact                  Mitigation / limitation
  ----------------------- ----------------------- -----------------------
  Image intercepted       Attacker obtains        Encryption protects
                          carrier and embedded    contents; concealment
                          bytes                   is not guaranteed

  Payload extracted       Ciphertext becomes      Recipient private key
                          visible                 still required

  Ciphertext modified     Corruption or tampering Authenticated
                                                  encryption rejects
                                                  invalid ciphertext

  Sender impersonation    False sender identity   Signature plus
                                                  independently verified
                                                  sender public key

  Public-key substitution Attacker tricks sender  Fingerprint
                          into encrypting to      verification through
                          wrong key               trusted independent
                                                  channel

  Image recompressed      Payload may be damaged  Simulator measures
                                                  known transformations;
                                                  no universal recovery
                                                  promise

  Private key stolen      Attacker may decrypt    Device security,
                          messages for that key   encrypted backups,
                                                  rotation; old-message
                                                  exposure may remain

  XSS or malicious        Secrets can be accessed CSP, minimal
  dependency              while app is running    dependencies, audits,
                                                  no unsafe HTML, strict
                                                  review

  Malicious app update    New code can access     Protected releases,
                          data during use         signed artifacts,
                                                  reproducible builds and
                                                  independent review

  Oversized/malformed     Memory exhaustion or    File validation, pixel
  image                   decoder issues          limits, worker
                                                  isolation, fuzzing

  Replay                  Same valid message      Random message IDs and
                          processed again         local duplicate
                                                  tracking; timestamp
                                                  alone is insufficient

  Lost private key        Permanent loss of       User-controlled
                          decryptability          encrypted backups and
                                                  clear warnings
  -----------------------------------------------------------------------

### 13.3 Browser security limitations

A browser-only app reduces server-side exposure, but it is not a magic
secure enclave: - A compromised OS can inspect the app. - A malicious
browser extension may access page content. - Malicious JavaScript served
by a compromised deployment can steal secrets while they are in use. -
IndexedDB is accessible to same-origin JavaScript; it is not a secure
vault. - Non-extractable WebCrypto keys do not stop malicious
same-origin code from invoking permitted operations. - Memory clearing
in JavaScript is best-effort.

### 13.4 Required controls

-   HTTPS deployment.
-   Strong Content Security Policy.
-   No inline script where avoidable.
-   No third-party analytics or advertising scripts in the sensitive
    app.
-   Dependency pinning, review and vulnerability scanning.
-   Strict TypeScript and runtime input validation.
-   Safe DOM rendering; no unsanitised HTML.
-   No secret values in logs, telemetry or crash reports.
-   Protected main branch and reviewed release workflow.
-   Signed release artifacts where practical.
-   Clear security and limitations documentation.

------------------------------------------------------------------------

## 14. UX and interface structure

### 14.1 Main application navigation

**Studio** - Create hidden message. - Extract message. - Recent local
activity (opt-in, no plaintext history by default).

**Vault** - My keys. - Contacts. - Verify fingerprint. - Backup and
restore.

**Lens** - Inspect image. - Capacity estimate. - Image quality and
channel analysis.

**Lab** - Algorithm selection. - Experiment setup. - Comparison results.

**Transit** - Transformation presets. - Custom transformation. -
Recovery report.

**Trace** - Histograms. - Bit planes. - Statistical tests. -
Known-method extraction.

### 14.2 Key UX principles

-   Make the secure workflow understandable to a beginner.
-   Keep advanced controls inside Lab and Trace.
-   Explain why a carrier is unsuitable instead of only showing an
    error.
-   Show exact file size and payload utilisation.
-   Never use colour alone to communicate security state.
-   Show explicit labels for unverified sender keys.
-   Provide cancellation for long-running work.
-   Keep the application usable on low-memory laptops and mobile
    browsers.
-   Provide keyboard navigation, focus visibility and accessible labels.

### 14.3 Example result states

-   `Encrypted — recipient key: verified fingerprint`
-   `Embedded — 18% of configured capacity used`
-   `Extraction complete — envelope valid`
-   `Decryption failed — this key may not match the recipient`
-   `Signature valid — matches trusted contact key`
-   `Signature present, but sender key is not trusted`
-   `Recovery failed after JPEG conversion at quality 70`

Do not label an image "safe" merely because a simple detector found no
anomaly.

------------------------------------------------------------------------

## 15. Testing and validation strategy

### 15.1 Unit tests

-   Binary serialization and parsing.
-   Length and bounds checks.
-   Capacity calculation.
-   Pixel/channel traversal.
-   Embed/extract round trip.
-   Wrong-key decryption.
-   Ciphertext tampering.
-   Signature verification.
-   Key import/export.
-   Image format validation.

### 15.2 Integration tests

-   Encrypt → serialize → embed → export → import → extract → decrypt.
-   Fresh browser session round trip.
-   Key backup and restore.
-   Invalid and unsupported envelope versions.
-   Cancellation and timeout behaviour.
-   Large but allowed payload.
-   Corrupt and truncated image files.

### 15.3 End-to-end tests

-   First-time user creates keys.
-   Sender imports and verifies recipient public key.
-   Sender encrypts and embeds a message.
-   Recipient extracts and decrypts.
-   Recipient sees correct signature status.
-   Wrong recipient key fails safely.
-   User tests transformations in Transit.

### 15.4 Fuzzing

Fuzz: - PNG validation and decoding boundaries. - Envelope parser. -
Length fields. - Algorithm options. - Malformed pixel buffers. -
Rust/WASM interfaces if added.

### 15.5 Security acceptance tests

-   Altered ciphertext must fail authentication.
-   Wrong private key must not reveal plaintext.
-   Invalid signature must never display as verified.
-   Untrusted public keys must be visibly labelled.
-   Oversized images must be rejected before unsafe allocation.
-   Unsupported formats must be rejected.
-   No secret payload or private key may appear in logs.
-   No automatic execution of extracted content.
-   CSP and dependency audit must pass defined release checks.

------------------------------------------------------------------------

## 16. Research benchmark methodology

OMBRIX should distinguish image quality from steganalysis performance.

### 16.1 Quality metrics

-   Pixel difference.
-   Mean squared error (MSE).
-   Peak signal-to-noise ratio (PSNR).
-   Structural Similarity Index (SSIM).

These metrics describe aspects of image distortion. They do not prove
that hidden data cannot be detected.

### 16.2 Robustness metrics

-   Exact extraction success.
-   Percentage of recovered bytes.
-   Envelope validity.
-   Decryption success.
-   Signature verification result.
-   Processing time.
-   Peak memory estimate where measurable.

### 16.3 Detection metrics

-   True-positive rate.
-   False-positive rate.
-   False-negative rate.
-   Precision and recall where meaningful.
-   ROC-AUC where the dataset and protocol support it.

### 16.4 Dataset discipline

-   Document image sources and licences.
-   Use varied natural, synthetic, smooth and textured images.
-   Separate training and test data.
-   Avoid image-level leakage between splits.
-   Fix random seeds where applicable.
-   Record method version and parameters.
-   Publish raw results and scripts.
-   Include negative controls and baseline methods.

### 16.5 Reproducibility record

Each experiment should capture: - Experiment ID. - Timestamp. - OMBRIX
version. - Algorithm ID and version. - Carrier dimensions and format. -
Payload size and rate. - Parameters and seed. - Transformation
sequence. - Browser and runtime version. - Metrics and raw outcomes.

------------------------------------------------------------------------

## 17. Development roadmap

### Phase 0 --- Product and protocol foundation

Deliver: - Product requirements. - Threat model. - Architecture decision
records. - Protocol v1 draft. - Brand tokens and interface skeleton. -
Supported formats and limits.

Exit criteria: - Team agrees on threat model and exact v1 scope. -
Crypto and payload design reviewed before implementation.

### Phase 1 --- Reliable PNG steganography core

Build: - Static PNG validation. - Pixel buffer pipeline. - LSB
embed/extract. - Versioned envelope framing. - Worker-based
processing. - Round-trip test suite.

Exit criteria: - Exported PNG opens correctly. - Fresh session can
extract exact payload bytes. - Invalid and oversized files fail safely.

### Phase 2 --- Cryptographic messaging

Build: - Vetted crypto library integration. - Encryption and signing key
generation. - Recipient encryption. - Optional signatures. - Fingerprint
verification. - Encrypted key backup and restore. - Clear result states.

Exit criteria: - Only intended recipient key decrypts. - Tampering fails
authentication. - Invalid signatures never show as valid. - Sender
identity is not assumed without trusted key verification.

### Phase 3 --- Lens and user experience

Build: - Carrier inspection. - Capacity and utilisation report. - Image
metrics. - Guided Studio workflow. - Accessible interface and responsive
layout.

Exit criteria: - Capacity calculations match independent test vectors. -
User can understand why a carrier is accepted or rejected.

### Phase 4 --- Lab and algorithm comparisons

Build: - Shared algorithm interface. - LSB matching or PVD as the next
candidate. - Repeatable fixtures. - Benchmark export. - Method
comparison UI.

Exit criteria: - Same fixtures and test conditions used across
methods. - Results include method version and parameters.

### Phase 5 --- Transit and Trace

Build: - Actual PNG/JPEG transformations. - Resize and crop tests. -
Extraction and decryption checks. - Bit-plane and histogram tools. -
Basic statistical experiments. - Clear false-positive/false-negative
caveats.

Exit criteria: - Simulator records exact transformation settings. -
Reports distinguish extraction failure from decryption/signature
failure.

### Phase 6 --- Research-grade engines

Explore: - Proper JPEG coefficient-domain DCT. - DWT. - Adaptive
methods. - Advanced steganalysis. - Optional ML research.

Exit criteria: - Independent benchmark evidence justifies inclusion. -
No unsupported robustness or invisibility claims.

### Phase 7 --- Release hardening

Deliver: - Security review. - Dependency and licence inventory. -
Fuzzing results. - Browser compatibility report. - Reproducible
build/release process. - Documentation and demo dataset. - Signed
releases where practical.

------------------------------------------------------------------------

## 18. Suggested development order and team responsibilities

For a small student team, avoid parallelising unstable protocol work.
Suggested ownership:

  -----------------------------------------------------------------------
  Workstream                          Responsibilities
  ----------------------------------- -----------------------------------
  Product/UI                          Information architecture, design
                                      system, accessibility, Studio
                                      workflow

  Crypto/protocol                     Library integration, envelope
                                      format, keys, signatures, test
                                      vectors

  Image engine                        PNG validation, LSB, workers,
                                      capacity, performance

  Research                            Metrics, transformations,
                                      steganalysis, datasets and
                                      benchmarks

  QA/security                         Threat-model checks, fuzzing, E2E
                                      tests, dependency audits and
                                      release checklist
  -----------------------------------------------------------------------

If one developer is building the MVP, implement in this order: 1.
Protocol and image tests. 2. PNG LSB round trip. 3. Crypto adapter. 4.
Studio flow. 5. Vault. 6. Lens. 7. Transit. 8. Lab and Trace.

Do not start with advanced AI, cloud accounts, a backend, multiple
algorithms or elaborate animations. First prove the core round trip and
security properties.

------------------------------------------------------------------------

## 19. Deployment and operations

### Initial deployment

-   Static frontend hosting over HTTPS.
-   No required backend.
-   No user account requirement.
-   No server-side plaintext or private-key storage.
-   Release version visible in the app.
-   Clear privacy notice and security limitations.

### Release engineering

-   Protected main branch.
-   CI on every pull request.
-   Type checks, lint, unit tests and browser tests.
-   Dependency and licence checks.
-   Security scans.
-   Build artifact checksums.
-   Release notes and versioned protocol documentation.
-   Rollback plan.

### Future optional services

If a relay or cloud service is ever added: - It should transport opaque
encrypted data only. - Do not store private keys. - Define retention and
deletion rules. - Minimise metadata. - Make server use optional. -
Publish a clear data-flow diagram. - Threat-model the new service
independently.

------------------------------------------------------------------------

## 20. Performance strategy for modest devices

The application should run acceptably on entry-level laptops and mobile
devices.

-   Keep the initial JavaScript bundle small.
-   Lazy-load Lab and Trace modules.
-   Process images in Web Workers.
-   Limit decoded pixel count.
-   Avoid multiple simultaneous image buffers.
-   Use typed arrays and reuse buffers.
-   Avoid large in-memory histories.
-   Provide cancellation and progress stages.
-   Benchmark on 8 GB RAM systems and mid-range phones.
-   Introduce Rust/WASM only after profiling.
-   Avoid running local AI models in the core workflow.

A fast and predictable TypeScript implementation is better than a
complicated Rust/WASM stack that adds build and debugging overhead
without measured benefit.

------------------------------------------------------------------------

## 21. Risks, flaws and mitigations

  -----------------------------------------------------------------------
  Risk                    Why it matters          Response
  ----------------------- ----------------------- -----------------------
  LSB is detectable       Simple statistical      Present as baseline;
                          patterns may reveal     research alternatives
                          embedding               and measure detectors

  Lossy transforms        JPEG/social processing  PNG-first workflow;
  destroy payload         may alter bits          Transit tests; explain
                                                  fragility

  Public-key substitution User encrypts to an     Fingerprint
                          attacker's key          verification and
                                                  trusted-contact state

  Key loss                Messages become         Encrypted backups and
                          unrecoverable           explicit warnings

  Browser compromise      App code can access     CSP, minimal
                          secrets in use          dependencies, signed
                                                  releases and review

  Image decoder           Malformed media can     Strict limits,
  vulnerabilities         attack processing stack supported-format
                                                  restriction, fuzzing

  Memory exhaustion       Decoded images are      Pixel limits, worker
                          large                   isolation, bounded
                                                  concurrency

  Overstated AI claims    Damages trust and       Evidence-based metrics
                          scientific validity     and transparent
                                                  methodology

  Scope creep             Too many algorithms     Ship a reliable v1
                          delay a usable product  before advanced
                                                  research

  Protocol                Different versions      Versioned format, test
  incompatibility         cannot interoperate     vectors and migration
                                                  policy
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 22. Definition of done for v1

OMBRIX v1 is ready for a controlled public beta only when all of these
are true:

### Product

-   [ ] A user can create keys and understand their purpose.
-   [ ] A sender can encrypt and embed a text payload in a supported
    PNG.
-   [ ] A recipient can extract and decrypt in a fresh browser session.
-   [ ] File payloads are bounded and never auto-executed.
-   [ ] The app clearly explains unsupported formats and
    transformations.

### Cryptography

-   [ ] A vetted library is used.
-   [ ] Encryption and signing keys are separate.
-   [ ] Wrong-key decryption fails.
-   [ ] Tampered ciphertext fails authentication.
-   [ ] Signature verification is bound to a trusted sender public key.
-   [ ] Key backup/restore has tests and clear warnings.

### Image engine

-   [ ] PNG validation is tested.
-   [ ] Capacity calculation has independent test vectors.
-   [ ] Malformed and oversized inputs fail safely.
-   [ ] Embed/extract round trips are exact.
-   [ ] Worker cancellation works.

### UX and accessibility

-   [ ] Responsive layout.
-   [ ] Keyboard navigation.
-   [ ] Visible focus.
-   [ ] Reduced-motion support.
-   [ ] Security states are not communicated by colour alone.
-   [ ] Errors explain a safe next step.

### Security and release

-   [ ] Threat model published.
-   [ ] Protocol documentation published.
-   [ ] Dependency and licence inventory reviewed.
-   [ ] CSP configured.
-   [ ] No secret logging.
-   [ ] Automated tests and security scans pass.
-   [ ] Limitations are visible to users.
-   [ ] Independent review is planned before high-trust use.

------------------------------------------------------------------------

## 23. Suggested repository milestones

1.  `chore: initialise OMBRIX workspace and CI`
2.  `docs: add product scope and threat model`
3.  `feat(protocol): define versioned envelope parser and serializer`
4.  `feat(image): validate static PNG inputs and resource limits`
5.  `feat(stego): implement baseline LSB round trip`
6.  `feat(worker): move image processing into cancellable worker`
7.  `feat(crypto): integrate vetted recipient encryption`
8.  `feat(vault): add key generation and fingerprint verification`
9.  `feat(signatures): add optional sender signing and verification`
10. `feat(studio): complete encrypt-embed-extract-decrypt workflow`
11. `feat(lens): add carrier analysis and capacity reporting`
12. `feat(transit): add transformation and recovery tests`
13. `feat(lab): add reproducible experiment exports`
14. `feat(trace): add initial image forensics tools`
15. `security: add fuzzing, dependency scanning and release checks`

------------------------------------------------------------------------

## 24. Useful technical references

Use primary documentation and standards as the source of truth. Re-check
versions and browser support during implementation.

-   RFC 9180 --- Hybrid Public Key Encryption (HPKE):
    https://www.rfc-editor.org/rfc/rfc9180
-   Libsodium documentation: https://doc.libsodium.org/
-   OWASP File Upload Cheat Sheet:
    https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
-   OWASP HTML5 Security Cheat Sheet:
    https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html
-   OWASP Content Security Policy Cheat Sheet:
    https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
-   OWASP ZAP: https://owasp.org/www-project-zap/
-   Semgrep: https://github.com/semgrep/semgrep
-   OSV-Scanner: https://github.com/google/osv-scanner
-   Grype: https://github.com/anchore/grype
-   Vitest: https://vitest.dev/
-   Playwright: https://playwright.dev/
-   cargo-fuzz: https://github.com/rust-fuzz/cargo-fuzz
-   OpenCV: https://opencv.org/
-   NumPy: https://numpy.org/
-   SciPy: https://scipy.org/

------------------------------------------------------------------------

## 25. Final product statement

**OMBRIX is a local-first secure media and steganography research
platform. It encrypts messages for intended recipients, embeds encrypted
payloads in supported images, and provides transparent tools to inspect
carriers, compare algorithms, test real-world transformations and study
image forensics.**

Its value is not a promise that every hidden message is invisible or
survives every transformation. Its value is a carefully engineered,
privacy-conscious workflow with measurable behaviour, understandable
limitations and reproducible research.

**OMBRIX --- Beyond what the eye can see.**
