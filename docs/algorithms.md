# OMBRIX — Mathematical Algorithm Specifications

**Classification:** Technical Architecture & Algorithm Reference  
**Scope:** Steganography Engines, Forensic Steganalysis Detectors, and Quality Metrics  

---

## 1. Steganography Engines

### 1.1 Sequential RGB LSB Replacement (`@ombrix/stego-png-lsb`)
- **Principle:** Direct replacement of the least-significant bit of sequential RGB color channel bytes.
- **Bit Allocation:**
  $$p'(i) = (p(i) \ \& \ \sim 1) \ | \ b_k$$
  where $p(i)$ is the channel intensity ($i \not\equiv 3 \pmod 4$ to skip the alpha channel), and $b_k \in \{0, 1\}$ is the $k$-th payload bit.
- **Framing:** 32-bit big-endian length prefix prepended to payload bytes.
- **Vulnerability:** Introduces asymmetric pairing distortion in sample pair distributions, making it vulnerable to Chi-Square and RS attacks.

---

### 1.2 Sequential RGB LSB Matching ($\pm 1$) (`@ombrix/stego-lab`)
- **Principle:** Instead of overriding the LSB, if $p(i) \pmod 2 \neq b_k$, randomly add $+1$ or $-1$ to $p(i)$.
- **Embedding Rule:**
  $$p'(i) = \begin{cases}
  p(i) & \text{if } p(i) \pmod 2 = b_k \\
  p(i) + 1 & \text{if } p(i) = 0 \\
  p(i) - 1 & \text{if } p(i) = 255 \\
  p(i) + \Delta & \text{where } \Delta \in \{+1, -1\} \text{ chosen via deterministic PRNG}
  \end{cases}$$
- **Defense Property:** Eliminates the static Pairs-of-Values equalization artifact, evading standard Westfeld Chi-Square analysis while maintaining high visual quality.

---

### 1.3 Pixel Value Differencing (PVD — Wu & Tsai 2003) (`@ombrix/stego-advanced`)
- **Principle:** Explains human visual sensitivity: the human eye is sensitive to smooth regions but insensitive to sharp edge transitions.
- **Pixel Pairing:** Consecutive horizontal pairs $(p_i, p_{i+1})$ in each color channel.
- **Range Intervals ($R_k = [l_k, u_k]$):**
  $$R_1 = [0, 7] \ (3\text{ bits}), \ R_2 = [8, 15] \ (3\text{ bits}), \ R_3 = [16, 31] \ (4\text{ bits})$$
  $$R_4 = [32, 63] \ (5\text{ bits}), \ R_5 = [64, 127] \ (6\text{ bits}), \ R_6 = [128, 255] \ (7\text{ bits})$$
- **Capacity:** $m_k = \log_2(u_k - l_k + 1)$ bits extracted from payload as integer $b \in [0, u_k - l_k]$.
- **New Difference:**
  $$d' = \begin{cases} l_k + b & \text{if } p_{i+1} \ge p_i \\ -(l_k + b) & \text{if } p_{i+1} < p_i \end{cases}$$
- **Pixel Adjustment & Clamping:**
  Let $m = d' - (p_{i+1} - p_i)$. Adjust:
  $$p'_i = p_i - \lceil m / 2 \rceil, \quad p'_{i+1} = p_{i+1} + \lfloor m / 2 \rfloor$$
  If $p'_i$ or $p'_{i+1} \notin [0, 255]$, shift both by offset $\delta$ to preserve difference $|p'_{i+1} - p'_i| = |d'|$.

---

### 1.4 2D Haar Discrete Wavelet Transform (DWT) (`@ombrix/stego-advanced`)
- **Principle:** Frequency domain decomposition operating on $2 \times 2$ pixel blocks $\begin{pmatrix} p_{00} & p_{01} \\ p_{10} & p_{11} \end{pmatrix}$.
- **Reversible 1D Integer Haar Transform:**
  $$L = \lfloor (x_0 + x_1) / 2 \rfloor, \quad H = x_0 - x_1$$
  $$\text{Inverse: } x_0 = L + \lfloor (H + 1) / 2 \rfloor, \quad x_1 = x_0 - H$$
- **2D Block Decomposition:**
  $$\text{Rows: } L_0, H_0, L_1, H_1 \longrightarrow \text{Columns: } LL, LH, HL, HH$$
- **High-Frequency Detail Modulation:**
  The parity of the high-frequency diagonal coefficient $HH = H_0 - H_1$ is modulated:
  $$\text{Parity: } ((HH \pmod 2) + 2) \pmod 2 = b_k$$
  Reconstruction with boundary compensation preserves zero integer rounding drift.

---

### 1.5 JPEG 8×8 Block DCT Coefficient-Domain Engine (`@ombrix/stego-advanced`)
- **Forward 2D DCT:**
  $$F(u, v) = \frac{1}{4} C(u) C(v) \sum_{x=0}^7 \sum_{y=0}^7 (f(x, y) - 128) \cos\frac{(2x+1)u\pi}{16} \cos\frac{(2y+1)v\pi}{16}$$
- **$Q_{50}$ Quantization:**
  $$F_Q(u, v) = \text{round}\left( \frac{F(u, v)}{Q_{50}(u, v)} \right)$$
- **AC Coefficient Modulation:**
  Modulates quantized AC coefficients in zigzag scan order ($u, v > 0$), avoiding DC $(0,0)$ and zeros.
- **Orthogonal Basis Precision Alignment:**
  $$\Delta p(x, y) = \Delta F \cdot T(u, x) \cdot T(v, y)$$
  Ensures exact quantized recovery after spatial integer discretization.

---

## 2. Forensic Steganalysis Detectors

### 2.1 RS Steganalysis (Fridrich, Goljan, Du 2001)
- **Variation Function:** On groups of 4 consecutive pixels $G = (g_0, g_1, g_2, g_3)$:
  $$V(G) = \sum_{i=0}^2 |g_{i+1} - g_i|$$
- **Flipping Operations:**
  $F_1(x) = x \oplus 1$ (LSB inversion), $F_{-1}(x) = F_1(x+1) - 1$ (dual LSB inversion).
- **Masks:** $M = [0, 1, 1, 0]$ and $-M = [0, -1, -1, 0]$.
- **Regular vs Singular Count:**
  - Regular ($R$): $V(F_M(G)) > V(G)$
  - Singular ($S$): $V(F_M(G)) < V(G)$
- **Estimated Payload Ratio $\hat{\alpha}$:**
  Solves quadratic polynomial $A x^2 + B x + C = 0$ where:
  $$A = 2(d_1 + d_0), \ B = d_{-0} - d_{-1} - d_1 - 3d_0, \ C = d_0 - d_{-0}$$
  $$\hat{\alpha} = \left| \frac{x}{x - 0.5} \right| \in [0, 1]$$

---

### 2.2 Sample Pair Analysis (SPA / Dumitrescu, Wu, Wang 2003)
- **Primary Sets:**
  - $X$: adjacent pairs with $|u - v| = 1$ inside the same 2-bucket $(2k, 2k+1)$.
  - $Y$: adjacent pairs with $|u - v| = 1$ across 2-bucket boundaries $(2k-1, 2k)$.
  - $Z$: adjacent pairs with $u = v$.
- **Natural Symmetry:** In clean images, $X \approx Y$. Under LSB steganography, pairs in $Z$ convert into $X$, creating imbalance $X > Y$.
- **Closed-Form Payload Estimator:**
  $$\hat{p} = \frac{2 \cdot \max(0, X - Y)}{X + Y + \lfloor 0.5 \cdot Z \rfloor}$$

---

### 2.3 Westfeld Chi-Square ($\chi^2$) Analysis
- **Pairs of Values (PoVs):** Frequencies of even intensity $2k$ and odd intensity $2k+1$.
  $$n_k = \frac{\text{count}(2k) + \text{count}(2k+1)}{2}$$
  $$\chi^2 = \sum_{k=0}^{127} \frac{(\text{count}(2k) - n_k)^2}{n_k}$$
- **$p$-Value Calculation:**
  $$p = Q\left( \frac{\text{df}}{2}, \frac{\chi^2}{2} \right)$$
  where $Q(s, x)$ is the regularized upper incomplete gamma function. A $p$-value near $1.0$ indicates statistical equalization characteristic of LSB tampering.

---

### 2.4 Spatial Noise Residual Variance
- **2nd-Derivative Laplacian Filter:**
  $$R(x, y) = 4 I(x, y) - I(x-1, y) - I(x+1, y) - I(x, y-1) - I(x, y+1)$$
- **Residual Variance:**
  $$\sigma_R^2 = \frac{1}{N} \sum_{(x, y)} (R(x, y) - \mu_R)^2$$
- **High-Frequency Perturbation Index (HFPI):**
  $$\text{HFPI} = \min(100, 2.5 \times \sigma_R)$$

---

## 3. Quantitative Image Quality Metrics

| Metric | Mathematical Formula | Interpretation |
| :--- | :--- | :--- |
| **Mean Squared Error (MSE)** | $\text{MSE} = \frac{1}{3 W H} \sum_{c, x, y} (I_{\text{orig}} - I_{\text{stego}})^2$ | Lower is better ($0 = \text{identical}$). |
| **Peak Signal-to-Noise Ratio (PSNR)** | $\text{PSNR} = 10 \cdot \log_{10}\left( \frac{255^2}{\text{MSE}} \right)$ | Higher is better ($> 45\text{ dB}$ is imperceptible). |
| **Mean Absolute Error (MAE)** | $\text{MAE} = \frac{1}{3 W H} \sum |I_{\text{orig}} - I_{\text{stego}}|$ | Average per-channel pixel shift. |
| **Structural Similarity (SSIM)** | $\text{SSIM} \approx \frac{(2\mu_x\mu_y + c_1)(2\sigma_{xy} + c_2)}{(\mu_x^2 + \mu_y^2 + c_1)(\sigma_x^2 + \sigma_y^2 + c_2)}$ | Higher is better ($1.0 = \text{identical structure}$). |

