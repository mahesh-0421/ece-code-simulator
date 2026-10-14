# ECE Code Simulator ⚡
### Online MATLAB & Verilog Simulation Platform

An open-source, full-stack educational simulation platform designed for Electrical and Computer Engineering (ECE) students, educators, and researchers worldwide. Run IEEE-standard **Verilog HDL** digital simulations and **MATLAB-compatible GNU Octave** scientific computing scripts directly in your browser with zero local installation.

---

## 🚀 Key Features

- **Double Simulation Engines**:
  - **Verilog HDL**: Compiled with `iverilog -g2012` and simulated via `vvp`. Automatically parses and renders digital timing waveforms (`.vcd`), bus transitions, clock edges, and RTL gate-level schematics.
  - **MATLAB-Compatible**: Powered by GNU Octave for matrix algebra, linear systems, Fourier spectral analysis (FFT), transfer functions (Bode plots), step responses, and numerical ODE integration.
- **Professional Online IDE**:
  - Embedded CodeMirror editor with custom syntax highlighting for Verilog and Octave.
  - Line numbers, bracket matching, code folding, auto-closing brackets, and `Ctrl+Enter` execution shortcut.
  - Light and Dark scientific theme modes with persistent local storage.
- **Comprehensive Visualization**:
  - **Terminal Output**: Real-time console with color-coded success/error traces and execution time metrics.
  - **Digital Waveform Viewer**: Scalable SVG timing diagram with 1-bit logic and multi-bit hexadecimal bus envelopes, zoom in/out/reset, and SVG export.
  - **Interactive 2D Plots**: High-resolution chart rendering with grid lines, axes labels, legends, and PNG download.
  - **Gate-Level Schematic**: Synthesized block visualization for continuous assignments and logic gates.
- **Production-Grade Sandbox Security**:
  - Non-root containerized execution (`USER node`).
  - Strict execution timeouts (Verilog: 10s, Octave: 15s) and buffer size caps.
  - Per-execution isolated temporary workspaces in `os.tmpdir()` cleaned up automatically.
  - Blocking of operating-system command injection (e.g., `system()`, `unix()`, `dos()`, `popen()`).
  - IP-based sliding window rate limiter (max 40 requests/min).
  - Health check endpoint at `/health`.

---

## 📁 Project Structure

```
ECE/
├── backend/
│   ├── server.js              # Express REST API, rate limiter, static file server, health check
│   └── simulator.js           # Engine discovery, sandboxing, VCD & plot parsers, runners
├── frontend/
│   ├── index.html             # Main responsive web interface (Navbar, IDE, Output tabs, Examples, Docs)
│   ├── style.css              # Dark & light design system, responsive styles, terminal & SVG styles
│   └── script.js              # CodeMirror editor controller, waveform & plot visualizers, templates
├── Dockerfile                 # Debian Bookworm slim with Node 22, Octave, Gnuplot, Icarus Verilog
├── .dockerignore              # Excludes node_modules, temp files, and build artifacts from Docker
├── .gitignore                 # Excludes local artifacts and binaries from Git repository
├── render.yaml                # Infrastructure blueprint for automated 1-click Render cloud deployment
├── README-DEPLOY.md           # Step-by-step cloud deployment & hosting instructions
├── package.json               # Project manifest, start scripts, and dependencies
└── tb.v, test.v               # Standalone test files for local CLI testing
```

---

## 🛠️ Local Development & Quick Start

### Prerequisites
1. **Node.js**: Version 18+ (tested on Node 22 / 24).
2. **Icarus Verilog** (`iverilog` & `vvp`):
   - Windows: Download installer from [bleyer.org/icarus](https://bleyer.org/icarus/) or add `C:\iverilog\bin` to PATH.
   - Linux: `sudo apt-get install iverilog`
   - macOS: `brew install icarus-verilog`
3. **GNU Octave** (`octave-cli`):
   - Windows: Download from [octave.org](https://octave.org/download) or install in `C:\Program Files\GNU Octave`.
   - Linux: `sudo apt-get install octave gnuplot`
   - macOS: `brew install octave`

### Run Locally (Node.js)

```bash
# 1. Clone or navigate to the project directory
cd ECE

# 2. Install dependencies
npm install

# 3. Start the application
npm start
```

Open your browser at:
- **Web Platform**: [http://localhost:3000/](http://localhost:3000/)
- **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)

---

## 🐳 Docker Deployment

The application includes an optimized, non-root Docker configuration:

```bash
# 1. Build the Docker image
docker build -t ece-code-simulator .

# 2. Run the container
docker run --rm -p 10000:10000 ece-code-simulator

# 3. Access in browser
# http://localhost:10000/
# http://localhost:10000/health
```

---

## ☁️ Free Cloud Deployment (Render)

### Step 1: Push to GitHub
1. Create a new repository on GitHub (e.g., `ece-code-simulator`).
2. Initialize and push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: ECE Code Simulator platform"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/ece-code-simulator.git
   git push -u origin main
   ```

### Step 2: Deploy on Render
1. Sign in to [Render](https://render.com/).
2. Click **New +** → **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your repository.
4. Set the following options:
   - **Environment**: `Docker`
   - **Branch**: `main`
   - **Plan**: `Free`
   - **Health Check Path**: `/health`
5. Click **Create Web Service**.
6. Render builds the Docker image (installs Octave and Icarus Verilog) and assigns a public URL:
   `https://ece-code-simulator-xxxx.onrender.com`

---

## 🧪 Built-In Example Library

### Verilog HDL
1. **2-Input AND Gate**: Continuous assignment logic with 4-combination truth-table stimulus.
2. **2-Input OR Gate**: Combinational OR verification.
3. **1-Bit Half Adder**: Sum (XOR) and Carry (AND) outputs.
4. **1-Bit Full Adder**: Full binary addition with carry-in propagation.
5. **4-to-1 Multiplexer**: Select lines and bus routing using case statements.
6. **D Flip-Flop with Reset**: Sequential clocked logic with asynchronous reset.
7. **4-Bit Binary Counter**: Up-counter with enable, clear, and rollover.

### MATLAB / GNU Octave
1. **Matrix Algebra & Inversion**: Determinants, eigenvalues, inverse, and linear systems ($Ax = b$).
2. **Sine Wave & Harmonics**: Fundamental and 3rd harmonic superposition with 2D curve plotting.
3. **Fast Fourier Transform (FFT)**: Frequency-domain amplitude spectrum of noisy dual-tone signal.
4. **RC Low-Pass Filter**: Frequency response ($H(j\omega)$) and Bode magnitude curve.
5. **Second-Order Step Response**: Underdamped, critically damped, and overdamped system dynamics.
6. **Numerical ODE Simulation**: Mass-Spring-Damper Euler-Cromer integration.

---

## 🛡️ Security & Sandbox Notes

- **Untrusted Code Handling**: Every simulation is treated as untrusted. Submissions execute in isolated, cryptographically named temporary directories that are forcibly unlinked upon completion.
- **No System Execution**: GNU Octave functions such as `system()`, `unix()`, `dos()`, and `popen()` are intercepted and rejected before execution.
- **Strict Timeouts**: Verilog executions time out at 10 seconds; Octave executions time out at 15 seconds.
- **Resource Protection**: Maximum code length is capped at 250 KB, and API requests are rate-limited to 40 per minute per IP.

---

## 📜 License & Acknowledgments

- **GNU Octave**: Copyright © The Octave Project Developers (GPLv3).
- **Icarus Verilog**: Copyright © Stephen Williams (GPLv2).
- **ECE Code Simulator**: Created for educational purposes to advance digital design and scientific computing accessibility.
