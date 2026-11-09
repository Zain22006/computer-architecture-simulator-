# Functional Units of a Computer – Interactive Simulation Platform

> *A fully interactive, GPU-accelerated browser simulation of all functional units of a computer — built for education, designed for elegance.*

---

## 🌐 Live Demo

**GitHub Pages URL:**  
`https://<your-github-username>.github.io/computer-architecture-simulator/`

---

## ✨ Features

| Feature | Description |
|---|---|
| 🖥️ Welcome Page | Gold & red glassmorphic landing with animated particles |
| ⚙️ ALU Simulation | Real-time ADD, SUB, MUL, DIV, AND, OR, XOR, NOT, SHL, SHR |
| 🧠 Control Unit | Full Fetch-Decode-Execute cycle visualized |
| 📋 Register File | Live binary/hex/decimal display for R0–R7, PC, IR, ACC |
| 💾 Memory Grid | 256-byte interactive RAM with read/write flash animations |
| 🔥 Cache Heatmap | Access frequency coloring for spatial/temporal locality |
| 🎨 Animated Buses | GPU-accelerated particle flow for data, address, control buses |
| 📝 Assembly Editor | Custom ISA code editor with live syntax checking |
| 🔊 Read Aloud | Text-to-speech for every component explanation |
| 📁 File Upload | Store any file type in simulated memory |
| 🏗️ Pipeline View | Instruction pipeline hazard spreadsheet matrix |
| ⏮ State Rollback | Step backward through CPU execution history |
| 🎛 Clock Control | Smooth 1–20Hz clock speed slider |

---

## 📁 Project Structure

```
computer-architecture-simulator/
├── index.html              ← Welcome page (entry point)
├── README.md
├── .nojekyll               ← Required for GitHub Pages
├── css/
│   ├── welcome.css         ← Welcome page styles
│   └── main.css            ← Simulator dashboard styles
├── js/
│   ├── particles.js        ← Welcome page particle system
│   ├── simulator.js        ← CPU simulation engine (ISA, ALU, memory)
│   ├── canvas-renderer.js  ← WebGL-ready canvas drawing engine
│   ├── component-data.js   ← Detailed hardware explanations
│   ├── editor.js           ← Assembly code editor logic
│   ├── memory-grid.js      ← Windowed memory cell renderer
│   └── main.js             ← Orchestration & UI wiring
└── pages/
    └── main.html           ← Main simulator dashboard
```

---

## 🚀 Deployment to GitHub Pages (Step-by-Step)

### Step 1 — Create a GitHub Account
Go to [github.com](https://github.com) and sign up for a free account if you don't have one.

### Step 2 — Create a New Repository
1. Click the **+** button (top-right) → **New repository**
2. Repository name: `computer-architecture-simulator`
3. Set visibility to **Public**
4. Click **Create repository**

### Step 3 — Upload Files
**Option A – GitHub Web Interface (Easiest for beginners):**
1. On your new repository page, click **"uploading an existing file"**
2. Drag and drop ALL the project files and folders
3. Keep the same folder structure shown above
4. Click **Commit changes**

**Option B – GitHub Desktop App:**
1. Download [GitHub Desktop](https://desktop.github.com/)
2. Clone your repository to your computer
3. Copy all project files into the cloned folder
4. Click **Commit to main** → **Push origin**

**Option C – Git Command Line:**
```bash
git init
git add .
git commit -m "Initial commit: Computer Architecture Simulator"
git remote add origin https://github.com/YOUR_USERNAME/computer-architecture-simulator.git
git push -u origin main
```

### Step 4 — Enable GitHub Pages
1. Go to your repository → **Settings** tab
2. Scroll to **Pages** (left sidebar)
3. Under **Source**, select **Deploy from a branch**
4. Branch: **main**, Folder: **/ (root)**
5. Click **Save**
6. Wait 2–3 minutes, then visit:  
   `https://YOUR_USERNAME.github.io/computer-architecture-simulator/`

---

## 🎓 How to Use the Simulator

### Welcome Page
- Click **ENTER** or press **Enter** key to enter the simulator

### Writing Assembly Code
Use the **Code Editor** panel. Example instructions:
```asm
; Load values and compute
LOAD R0, 10      ; R0 = 10
LOAD R1, 5       ; R1 = 5
ADD  R0, R1      ; R0 = 15 (ALU fires!)
STORE R0, 100    ; Save to RAM[100]
OUT  R0          ; Display result
HALT             ; Stop execution
```
- Click **▶ Run** to execute
- Click **■ Stop** to pause
- Click **↺ Reset** to clear everything
- Use **Step ⟶** for instruction-by-instruction stepping

### Supported Instructions

| Instruction | Syntax | Description |
|---|---|---|
| `NOP` | `NOP` | No operation |
| `LOAD` | `LOAD Rd, value` | Load immediate value into register |
| `STORE` | `STORE Rs, address` | Save register to RAM address |
| `MOV` | `MOV Rd, Rs` or `MOV Rd, value` | Copy value or register |
| `ADD` | `ADD Rd, Rs` | Rd = Rd + Rs |
| `SUB` | `SUB Rd, Rs` | Rd = Rd - Rs |
| `MUL` | `MUL Rd, Rs` | Rd = Rd × Rs |
| `AND` | `AND Rd, Rs` | Bitwise AND |
| `OR` | `OR Rd, Rs` | Bitwise OR |
| `XOR` | `XOR Rd, Rs` | Bitwise XOR |
| `NOT` | `NOT Rd` | Bitwise NOT |
| `SHL` | `SHL Rd, n` | Shift left by n bits |
| `JMP` | `JMP addr` | Unconditional jump |
| `JZ` | `JZ addr` | Jump if Zero flag set |
| `JNZ` | `JNZ addr` | Jump if Zero flag NOT set |
| `IN` | `IN Rd` | Read from input buffer |
| `OUT` | `OUT Rs` | Write to output display |
| `HALT` | `HALT` | Stop execution |

---

## 🎨 Color-Coded Bus Guide

| Color | Signal Type |
|---|---|
| 🔴 Dark Red particles | Control signals (CU → components) |
| 🟢 Emerald Green particles | Data bus (register ↔ ALU ↔ RAM) |
| 🟡 Metallic Gold particles | Address bus (PC/ALU → RAM) |

---

## 🔧 Tech Stack

- **Frontend:** Pure HTML5, CSS3, Vanilla JavaScript (no build tools needed!)
- **Rendering:** HTML5 Canvas with `requestAnimationFrame` (60fps)
- **Audio:** Web Speech API (built into all modern browsers)
- **Hosting:** GitHub Pages (free, forever, no server needed)
- **Fonts:** Google Fonts (Cinzel, Crimson Text, Share Tech Mono)

---

## 🛡️ Security

- No external JavaScript libraries loaded (zero CDN attack surface)
- No backend server (purely static — cannot be hacked via SQL injection, etc.)
- `X-Content-Type-Options: nosniff` and `X-Frame-Options: SAMEORIGIN` headers set
- No cookies, no tracking, no data collection
- All file uploads remain **in-browser only** (never uploaded to any server)

---

## 📱 Browser Support

| Browser | Support |
|---|---|
| Chrome 90+ | ✅ Full support |
| Firefox 88+ | ✅ Full support |
| Edge 90+ | ✅ Full support |
| Safari 14+ | ✅ Full support (TTS may vary) |
| Mobile Chrome | ✅ Responsive layout |

---

*Designed with precision. Built for learning. Rendered at 60fps.*
