/* ============================================================
   MAIN.JS – Orchestrates all modules, event wiring, UI updates
   requestAnimationFrame render loop separated from sim clock
   ============================================================ */

// ── Global helpers ──────────────────────────────────────────
let stepMode = false;
let isSpeaking = false;
let storedFiles = {};
let ttsUtterance = null;

// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  CanvasRenderer.init(document.getElementById('simCanvas'));
  MemoryGrid.init();
  buildRegisterDisplay();
  startRenderLoop();

  // Listen for OUT instruction events
  document.addEventListener('simOutput', e => {
    const display = document.getElementById('outputDisplay');
    if (!display) return;
    const val = e.detail;
    display.textContent = `Dec: ${val}  |  Hex: 0x${val.toString(16).toUpperCase().padStart(4,'0')}  |  Bin: ${val.toString(2).padStart(16,'0')}`;
    display.classList.add('flash');
    setTimeout(() => display.classList.remove('flash'), 600);
    logMicro(`OUTPUT → ${val}`, 'data');
  });
});

// ── Render Loop (60fps) ─────────────────────────────────────
function startRenderLoop() {
  function loop() {
    const state = Simulator.getState();
    CanvasRenderer.render(state, state.activeBlock);
    MemoryGrid.update(state.ram);
    updateRegisterDisplay(state.registers, state.flags);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// ── Status ──────────────────────────────────────────────────
function updateStatus(text) {
  const dot = document.getElementById('statusDot');
  const label = document.getElementById('statusText');
  if (!dot || !label) return;
  label.textContent = text;
  const colors = {
    'RUNNING': '#10D4A8',
    'HALTED':  '#C0202A',
    'STOPPED': '#D4AF37',
    'IDLE':    '#888'
  };
  dot.style.background = colors[text] || '#888';
  dot.style.boxShadow = `0 0 6px ${colors[text] || '#888'}`;
}

// ── Compile & Run ───────────────────────────────────────────
function compileAndRun() {
  const source = document.getElementById('codeEditor').value;
  const { instructions, errors } = Simulator.assemble(source);
  if (errors.length) {
    logMicro(`Compile errors: ${errors.map(e => `L${e.line}: ${e.msg}`).join(', ')}`, 'ctrl');
    return;
  }
  Simulator.load(instructions);
  logMicro(`Assembled ${instructions.length} instructions. Starting execution…`, 'addr');
  Simulator.run();
}

function stopSim() { Simulator.stop(); }

function resetSim() {
  Simulator.reset();
  document.getElementById('outputDisplay').textContent = '— awaiting input —';
  document.getElementById('logBody').innerHTML = '';
  updateStatus('IDLE');
}

function setClockSpeed(val) {
  Simulator.setClockSpeed(val);
  document.getElementById('clockDisplay').textContent = val;
}

function stepForward() { Simulator.stepForward(); }
function stepBack() { Simulator.stepBack(); }

function toggleStepView() {
  stepMode = !stepMode;
  const btn = document.getElementById('showStepsBtn');
  if (btn) {
    btn.textContent = stepMode ? '🔍 Hide Steps' : '🔍 Show Steps';
    btn.style.borderColor = stepMode ? '#D4AF37' : '';
    btn.style.color = stepMode ? '#D4AF37' : '';
  }
  logMicro(stepMode ? 'Step mode ON – manual stepping enabled' : 'Step mode OFF – auto clock resumed', 'ctrl');
  if (!stepMode) {
    const state = Simulator.getState();
    if (state.running && !state.halted) Simulator.run();
  }
}

// ── Quick Input ─────────────────────────────────────────────
function processInput() {
  const val = parseInt(document.getElementById('quickInput').value);
  if (isNaN(val)) { logMicro('Invalid input – enter a decimal number', 'ctrl'); return; }
  Simulator.pushInput(val);
  logMicro(`Input buffered: ${val} → FIFO queue`, 'data');
  // Also run a quick ADD/OUT demo if no program loaded
  const state = Simulator.getState();
  if (!state.program.length) {
    const demo = `LOAD R0, ${val & 0xFF}\nMUL R0, R0\nOUT R0\nHALT`;
    document.getElementById('codeEditor').value = demo;
    updateLineNums(document.getElementById('codeEditor'));
    compileAndRun();
  }
}

// ── Register Display ────────────────────────────────────────
function buildRegisterDisplay() {
  const grid = document.getElementById('regGrid');
  if (!grid) return;
  const names = ['R0','R1','R2','R3','R4','R5','R6','R7','PC','IR','ACC'];
  names.forEach(name => {
    const row = document.createElement('div');
    row.className = 'reg-row';
    row.id = 'reg-' + name;
    row.innerHTML = `<span class="reg-name">${name}</span><span class="reg-hex" id="regH-${name}">0x0000</span><span class="reg-bin" id="regB-${name}">0000000000000000</span><span class="reg-dec" id="regD-${name}">0</span>`;
    grid.appendChild(row);
  });
}

let prevRegs = {};
function updateRegisterDisplay(registers, flags) {
  Object.entries(registers).forEach(([name, val]) => {
    const hex = document.getElementById('regH-' + name);
    const bin = document.getElementById('regB-' + name);
    const dec = document.getElementById('regD-' + name);
    const row = document.getElementById('reg-' + name);
    if (!hex) return;
    const hexStr = '0x' + val.toString(16).toUpperCase().padStart(4, '0');
    const binStr = val.toString(2).padStart(16, '0');
    const decStr = String(val);
    if (prevRegs[name] !== val) {
      hex.textContent = hexStr;
      bin.textContent = binStr;
      dec.textContent = decStr;
      if (row) { row.classList.add('active'); setTimeout(() => row.classList.remove('active'), 400); }
      prevRegs[name] = val;
    }
  });
}

// ── Microop Log ─────────────────────────────────────────────
window.logMicro = function(msg, type = 'data') {
  const body = document.getElementById('logBody');
  if (!body) return;
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString('en-GB', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' })}] ${msg}`;
  body.appendChild(entry);
  // Keep max 80 entries
  while (body.children.length > 80) body.removeChild(body.firstChild);
  body.scrollTop = body.scrollHeight;
};

function clearLog() { const b = document.getElementById('logBody'); if (b) b.innerHTML = ''; }

// ── Component Sidebar ────────────────────────────────────────
function showComponent(id) {
  // Update sidebar highlight
  document.querySelectorAll('.comp-item').forEach(el => {
    el.classList.toggle('active', el.dataset.comp === id);
  });

  const data = ComponentData[id];
  if (!data) return;

  // Update detail panel (right sidebar)
  const title = document.getElementById('detailTitle');
  const body = document.getElementById('detailBody');
  if (title) title.textContent = data.title;
  if (body) {
    const tagsHtml = (data.tags || []).map(t => `<span class="tag ${t.cls}">${t.text}</span>`).join(' ');
    body.innerHTML = `<div style="margin-bottom:12px">${tagsHtml}</div>${data.body}`;
  }

  // Also read aloud the description if TTS active
  if (isSpeaking) startReading(data.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
}

function filterComponents(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('.comp-item').forEach(el => {
    el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ── File Upload ──────────────────────────────────────────────
function handleDragOver(e) { e.preventDefault(); e.currentTarget.style.borderColor = '#D4AF37'; }

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.style.borderColor = '';
  handleFiles(e.dataTransfer.files);
}

function handleFiles(files) {
  const list = document.getElementById('fileList');
  Array.from(files).forEach(file => {
    if (storedFiles[file.name]) return; // prevent duplicates
    const reader = new FileReader();
    reader.onload = e => {
      storedFiles[file.name] = e.target.result;
      const li = document.createElement('li');
      const size = file.size < 1024 ? `${file.size}B` : `${(file.size/1024).toFixed(1)}KB`;
      li.innerHTML = `<span>📄 ${file.name} <small style="opacity:.5">${size}</small></span><span class="file-remove" onclick="removeFile('${file.name}',this.parentElement)">✕</span>`;
      if (list) list.appendChild(li);
      logMicro(`File stored: "${file.name}" (${size})`, 'data');
    };
    reader.readAsDataURL(file);
  });
}

function removeFile(name, li) { delete storedFiles[name]; if (li) li.remove(); }

// ── Read Aloud (TTS) ─────────────────────────────────────────
function toggleReadAloud() {
  if (isSpeaking) stopReadAloud();
  else {
    const body = document.getElementById('detailBody');
    const text = body ? body.innerText.replace(/\s+/g, ' ') : 'No content selected.';
    startReading(text);
  }
}

function startReading(text) {
  if (!window.speechSynthesis) { alert('Text-to-speech not supported in your browser.'); return; }
  stopReadAloud();
  ttsUtterance = new SpeechSynthesisUtterance(text);
  ttsUtterance.rate = parseFloat(document.getElementById('ttsRate').value) || 1;
  ttsUtterance.pitch = 1;
  ttsUtterance.onend = () => {
    isSpeaking = false;
    const btn = document.getElementById('ttsPlayBtn');
    if (btn) btn.textContent = '▶ Play';
  };
  window.speechSynthesis.speak(ttsUtterance);
  isSpeaking = true;
  const btn = document.getElementById('ttsPlayBtn');
  if (btn) btn.textContent = '■ Speaking…';
}

function stopReadAloud() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  isSpeaking = false;
  const btn = document.getElementById('ttsPlayBtn');
  if (btn) btn.textContent = '▶ Play';
}

// ── Cache toggle ─────────────────────────────────────────────
function toggleCacheView() {
  const show = document.getElementById('showCacheChk').checked;
  MemoryGrid.setShowCache(show);
}

// ── Pipeline Modal ────────────────────────────────────────────
function showPipelineModal(program) {
  const modal = document.getElementById('pipelineModal');
  const content = document.getElementById('pipelineContent');
  if (!modal || !content) return;

  const stages = ['IF', 'ID', 'EX', 'MEM', 'WB'];
  const cycles = program.length + stages.length - 1;
  let html = '<div class="pipeline-grid"><table class="pipeline-table"><thead><tr><th>Instruction</th>';
  for (let c = 1; c <= cycles; c++) html += `<th>C${c}</th>`;
  html += '</tr></thead><tbody>';

  program.slice(0, 10).forEach((instr, i) => {
    html += `<tr><td style="text-align:left;color:var(--text)">${instr.raw || `I${i+1}`}</td>`;
    for (let c = 0; c < cycles; c++) {
      const stageIdx = c - i;
      if (stageIdx >= 0 && stageIdx < stages.length) {
        const s = stages[stageIdx].toLowerCase();
        html += `<td class="${s}">${stages[stageIdx]}</td>`;
      } else {
        html += '<td>–</td>';
      }
    }
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  content.innerHTML = html;
  modal.classList.add('open');
}

function closePipelineModal() { document.getElementById('pipelineModal').classList.remove('open'); }
function closeCompModal() { document.getElementById('compModal').classList.remove('open'); }

// ── Arch select ───────────────────────────────────────────────
document.getElementById('archSelect').addEventListener('change', function() {
  logMicro(`Architecture switched → ${this.options[this.selectedIndex].text}`, 'ctrl');
  resetSim();
});

// ── Init sidebar with first component ────────────────────────
showComponent('alu');
