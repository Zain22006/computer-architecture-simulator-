/* ============================================================
   MAIN.JS – Orchestrates all modules, event wiring, UI updates
   requestAnimationFrame render loop separated from sim clock
   ============================================================ */

let stepMode = false;
let isSpeaking = false;
let storedFiles = {};   // filename → { dataURL, size, type, content }
let activeTab = 'decimal';
let ttsUtterance = null;

// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  CanvasRenderer.init(document.getElementById('simCanvas'));
  startRenderLoop();

  // Listen for OUT instruction events from simulator
  document.addEventListener('simOutput', e => {
    const val = e.detail;
    showOutput(val, 'number');
    logMicro(`OUTPUT → ${val}`, 'data');
  });

  showComponent('alu');
});

// ── Render Loop (60fps, canvas only) ───────────────────────
function startRenderLoop() {
  function loop() {
    const state = Simulator.getState();
    CanvasRenderer.render(state, state.activeBlock);
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
  const colors = { 'RUNNING':'#10D4A8', 'HALTED':'#C0202A', 'STOPPED':'#D4AF37', 'IDLE':'#888' };
  dot.style.background = colors[text] || '#888';
  dot.style.boxShadow = `0 0 6px ${colors[text] || '#888'}`;
}

function resetSim() {
  Simulator.reset();
  document.getElementById('outputDisplay').textContent = '— awaiting input —';
  const conv = document.getElementById('outputConversions');
  if (conv) conv.innerHTML = '';
  document.getElementById('logBody').innerHTML = '';
  updateStatus('IDLE');
}

function setClockSpeed(val) {
  Simulator.setClockSpeed(val);
  document.getElementById('clockDisplay').textContent = val;
}

function stepForward() { Simulator.stepForward(); }
function stepBack()    { Simulator.stepBack(); }

function toggleStepView() {
  stepMode = !stepMode;
  const btn = document.getElementById('showStepsBtn');
  if (btn) {
    btn.textContent = stepMode ? '🔍 Hide Steps' : '🔍 Show Steps';
    btn.style.borderColor = stepMode ? '#D4AF37' : '';
    btn.style.color       = stepMode ? '#D4AF37' : '';
  }
  logMicro(stepMode ? 'Step mode ON' : 'Step mode OFF', 'ctrl');
}

// ── Tab Switching ────────────────────────────────────────────
function switchTab(tabName, btn) {
  activeTab = tabName;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('tab-' + tabName);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');
}

// ── Universal Input Processor ────────────────────────────────
function processInput() {
  let raw = '';
  let numericVal = null;
  let displayVal = '';
  let inputType = activeTab;

  switch (activeTab) {

    case 'decimal': {
      raw = document.getElementById('inp-decimal').value.trim();
      if (raw === '') { showError('Please enter a decimal number.'); return; }
      numericVal = parseInt(raw, 10);
      if (isNaN(numericVal)) { showError('Invalid decimal number.'); return; }
      displayVal = `Decimal input: ${numericVal}`;
      break;
    }

    case 'hex': {
      raw = document.getElementById('inp-hex').value.trim().replace(/^0x/i, '');
      if (raw === '') { showError('Please enter a hexadecimal value.'); return; }
      if (!/^[0-9A-Fa-f]+$/.test(raw)) { showError('Invalid hex — use digits 0-9 and letters A-F only.'); return; }
      numericVal = parseInt(raw, 16);
      displayVal = `Hex input: 0x${raw.toUpperCase()}`;
      break;
    }

    case 'binary': {
      raw = document.getElementById('inp-binary').value.trim();
      if (raw === '') { showError('Please enter a binary number.'); return; }
      if (!/^[01]+$/.test(raw)) { showError('Invalid binary — use only 0 and 1.'); return; }
      numericVal = parseInt(raw, 2);
      displayVal = `Binary input: ${raw}`;
      break;
    }

    case 'text': {
      raw = document.getElementById('inp-text').value;
      if (raw === '') { showError('Please enter some text.'); return; }
      // Convert to ASCII codes
      const codes = Array.from(raw).map(c => c.charCodeAt(0));
      numericVal = codes[0]; // push first char into input buffer
      codes.forEach(c => Simulator.pushInput(c));
      displayVal = `Text input: "${raw}"`;
      showOutput(codes, 'text', raw);
      logMicro(`Text "${raw}" → ASCII [${codes.join(', ')}] buffered`, 'data');
      return;
    }

    case 'file': {
      const info = document.getElementById('filePickInfo').textContent;
      if (info === 'No file selected') { showError('Please browse and select a file first.'); return; }
      // Already handled by handleInputFile — just show confirmation
      logMicro(`File "${info}" processed from memory store`, 'data');
      return;
    }
  }

  // Push to simulator input buffer
  Simulator.pushInput(numericVal & 0xFFFF);
  showOutput(numericVal, 'number');
  logMicro(`${displayVal} → buffered (dec=${numericVal}, hex=0x${(numericVal & 0xFFFF).toString(16).toUpperCase()})`, 'data');

  // Run a quick demo if no program is loaded
  const state = Simulator.getState();
  if (!state.program.length) {
    const { instructions } = Simulator.assemble(
      `LOAD R0, ${numericVal & 0xFF}\nMUL R0, R0\nOUT R0\nHALT`
    );
    Simulator.load(instructions);
    Simulator.run();
  }
}

// ── Output Display ────────────────────────────────────────────
function showOutput(val, type, rawText) {
  const display = document.getElementById('outputDisplay');
  const conv    = document.getElementById('outputConversions');
  if (!display) return;

  if (type === 'text') {
    display.textContent = `"${rawText}"  →  ASCII bytes: [${val.join(', ')}]`;
    if (conv) conv.innerHTML = val.map((c, i) =>
      `<span class="conv-pill asc">'${rawText[i]}' = ${c}</span>`
    ).slice(0, 20).join('') + (val.length > 20 ? '…' : '');
  } else {
    const n = Number(val) & 0xFFFF;
    const hex = n.toString(16).toUpperCase().padStart(4, '0');
    const bin = n.toString(2).padStart(16, '0');
    display.textContent = `Dec: ${n}  |  Hex: 0x${hex}  |  Bin: ${bin}`;
    if (conv) conv.innerHTML =
      `<span class="conv-pill dec">DEC: ${n}</span>` +
      `<span class="conv-pill hex">HEX: 0x${hex}</span>` +
      `<span class="conv-pill bin">BIN: ${bin}</span>`;
  }

  display.classList.add('flash');
  setTimeout(() => display.classList.remove('flash'), 600);
}

function showError(msg) {
  const display = document.getElementById('outputDisplay');
  if (display) {
    display.textContent = '⚠ ' + msg;
    display.style.color = '#C0202A';
    setTimeout(() => { display.style.color = ''; }, 3000);
  }
  logMicro('Input error: ' + msg, 'ctrl');
}

// ── File Input Handler ────────────────────────────────────────
function handleInputFile(file) {
  if (!file) return;
  const info = document.getElementById('filePickInfo');
  if (info) info.textContent = `${file.name}  (${formatSize(file.size)})`;

  const reader = new FileReader();
  reader.onload = e => {
    const data = e.target.result;
    // Store in memory
    storedFiles[file.name] = { dataURL: data, size: file.size, type: file.type };
    // Add to sidebar list too
    addFileToSidebar(file.name, file.size);

    // Convert first 256 bytes to numeric for simulation
    if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
      // Text file — show ASCII
      const text = data;
      const codes = Array.from(text.slice(0, 64)).map(c => c.charCodeAt(0));
      codes.forEach(c => Simulator.pushInput(c));
      showOutput(codes, 'text', text.slice(0, 64));
      logMicro(`File "${file.name}" → ${codes.length} ASCII bytes buffered`, 'data');
    } else {
      // Binary file — read as array buffer
      const arr = new Uint8Array(data instanceof ArrayBuffer ? data : new TextEncoder().encode(data));
      const preview = Array.from(arr.slice(0, 16));
      preview.forEach(b => Simulator.pushInput(b));
      const display = document.getElementById('outputDisplay');
      const conv    = document.getElementById('outputConversions');
      if (display) display.textContent = `File: "${file.name}" | Type: ${file.type || 'unknown'} | Size: ${formatSize(file.size)} | First bytes: [${preview.map(b => '0x' + b.toString(16).toUpperCase()).join(', ')}]`;
      if (conv) conv.innerHTML = preview.map(b =>
        `<span class="conv-pill hex">0x${b.toString(16).toUpperCase()}</span>`
      ).join('');
      logMicro(`File "${file.name}" → ${preview.length} bytes buffered`, 'data');
    }
  };

  if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
}

// ── Stored File Search ────────────────────────────────────────
function searchStoredFiles(query) {
  const results = document.getElementById('storedResults');
  if (!results) return;
  results.innerHTML = '';
  if (!query.trim()) return;
  const q = query.toLowerCase();
  const matches = Object.keys(storedFiles).filter(name => name.toLowerCase().includes(q));
  if (!matches.length) {
    const li = document.createElement('li');
    li.textContent = 'No matching files found';
    li.style.color = 'var(--text-dim)';
    li.style.cursor = 'default';
    results.appendChild(li);
    return;
  }
  matches.forEach(name => {
    const li = document.createElement('li');
    li.textContent = `📄 ${name}  (${formatSize(storedFiles[name].size)})`;
    li.onclick = () => {
      document.getElementById('filePickInfo').textContent = name;
      results.innerHTML = '';
      document.getElementById('storedFileSearch').value = '';
      logMicro(`Selected stored file: "${name}"`, 'data');
      // Simulate loading from memory
      const display = document.getElementById('outputDisplay');
      if (display) {
        display.textContent = `✔ Loaded "${name}" from simulated memory — Size: ${formatSize(storedFiles[name].size)} — Type: ${storedFiles[name].type || 'unknown'}`;
        display.classList.add('flash');
        setTimeout(() => display.classList.remove('flash'), 600);
      }
    };
    results.appendChild(li);
  });
}

// ── Sidebar File Upload (drop zone) ──────────────────────────
function handleDragOver(e) { e.preventDefault(); e.currentTarget.style.borderColor = '#D4AF37'; }

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.style.borderColor = '';
  handleFiles(e.dataTransfer.files);
}

function handleFiles(files) {
  Array.from(files).forEach(file => {
    if (storedFiles[file.name]) return;
    const reader = new FileReader();
    reader.onload = e => {
      storedFiles[file.name] = { dataURL: e.target.result, size: file.size, type: file.type };
      addFileToSidebar(file.name, file.size);
      logMicro(`File stored: "${file.name}" (${formatSize(file.size)})`, 'data');
    };
    reader.readAsDataURL(file);
  });
}

function addFileToSidebar(name, size) {
  const list = document.getElementById('fileList');
  if (!list) return;
  // Avoid duplicates in sidebar
  if (list.querySelector(`[data-fname="${name}"]`)) return;
  const li = document.createElement('li');
  li.dataset.fname = name;
  li.innerHTML = `<span>📄 ${name} <small style="opacity:.5">${formatSize(size)}</small></span><span class="file-remove" onclick="removeFile('${name}',this.parentElement)">✕</span>`;
  list.appendChild(li);
}

function removeFile(name, li) { delete storedFiles[name]; if (li) li.remove(); }

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

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

// ── Component Sidebar ─────────────────────────────────────────
function showComponent(id) {
  document.querySelectorAll('.comp-item').forEach(el => {
    el.classList.toggle('active', el.dataset.comp === id);
  });
  const data = ComponentData[id];
  if (!data) return;

  const title = document.getElementById('detailTitle');
  const body  = document.getElementById('detailBody');
  if (title) title.textContent = data.title;
  if (body) {
    const tagsHtml = (data.tags || []).map(t => `<span class="tag ${t.cls}">${t.text}</span>`).join(' ');
    body.innerHTML = `<div style="margin-bottom:12px">${tagsHtml}</div>${data.body}`;
  }
  if (isSpeaking) startReading(data.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
}

function filterComponents(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('.comp-item').forEach(el => {
    el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ── Microop Log ───────────────────────────────────────────────
window.logMicro = function(msg, type = 'data') {
  const body = document.getElementById('logBody');
  if (!body) return;
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  const t = new Date().toLocaleTimeString('en-GB', { hour12:false });
  entry.textContent = `[${t}] ${msg}`;
  body.appendChild(entry);
  while (body.children.length > 80) body.removeChild(body.firstChild);
  body.scrollTop = body.scrollHeight;
};

function clearLog() { const b = document.getElementById('logBody'); if (b) b.innerHTML = ''; }
function closeCompModal() { document.getElementById('compModal').classList.remove('open'); }

// ── Arch select ───────────────────────────────────────────────
document.getElementById('archSelect').addEventListener('change', function() {
  logMicro(`Architecture → ${this.options[this.selectedIndex].text}`, 'ctrl');
  resetSim();
});
