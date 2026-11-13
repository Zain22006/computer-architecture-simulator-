/* ============================================================
   MAIN.JS – Full orchestration with persistent file storage,
   rich media preview, and universal input handling
   ============================================================ */

let stepMode    = false;
let isSpeaking  = false;
let activeTab   = 'decimal';
let ttsUtterance = null;

// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  CanvasRenderer.init(document.getElementById('simCanvas'));
  startRenderLoop();

  // Load all previously stored files from IndexedDB
  await loadStoredFilesFromDB();

  // Listen for OUT instruction events
  document.addEventListener('simOutput', e => {
    const val = e.detail;
    showOutput(val, 'number');
    logMicro(`OUTPUT → ${val}`, 'data');
  });

  showComponent('alu');
});

// ── Render Loop (60fps) ─────────────────────────────────────
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
  const dot   = document.getElementById('statusDot');
  const label = document.getElementById('statusText');
  if (!dot || !label) return;
  label.textContent = text;
  const colors = { RUNNING:'#10D4A8', HALTED:'#C0202A', STOPPED:'#D4AF37', IDLE:'#888' };
  dot.style.background = colors[text] || '#888';
  dot.style.boxShadow  = `0 0 6px ${colors[text] || '#888'}`;
}

function resetSim() {
  Simulator.reset();
  document.getElementById('outputDisplay').textContent = '— awaiting input —';
  const conv = document.getElementById('outputConversions');
  if (conv) conv.innerHTML = '';
  clearMediaPreview();
  document.getElementById('logBody').innerHTML = '';
  updateStatus('IDLE');
}

function setClockSpeed(val) {
  Simulator.setClockSpeed(val);
  document.getElementById('clockDisplay').textContent = val;
}

function stepForward() { Simulator.stepForward(); }
function stepBack()    { Simulator.stepBack(); }

// ── Tab Switching ────────────────────────────────────────────
function switchTab(tabName, btn) {
  activeTab = tabName;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tabName)?.classList.add('active');
  if (btn) btn.classList.add('active');
}

// ── Universal Input Processor ────────────────────────────────
function processInput() {
  let numericVal = null;
  let displayStr = '';

  switch (activeTab) {
    case 'decimal': {
      const raw = document.getElementById('inp-decimal').value.trim();
      if (!raw) { showError('Please enter a decimal number.'); return; }
      numericVal = parseInt(raw, 10);
      if (isNaN(numericVal)) { showError('Invalid decimal number.'); return; }
      displayStr = `Decimal: ${numericVal}`;
      break;
    }
    case 'hex': {
      const raw = document.getElementById('inp-hex').value.trim().replace(/^0x/i, '');
      if (!raw) { showError('Please enter a hexadecimal value.'); return; }
      if (!/^[0-9A-Fa-f]+$/.test(raw)) { showError('Invalid hex — use 0-9 and A-F only.'); return; }
      numericVal = parseInt(raw, 16);
      displayStr = `Hex: 0x${raw.toUpperCase()}`;
      break;
    }
    case 'binary': {
      const raw = document.getElementById('inp-binary').value.trim();
      if (!raw) { showError('Please enter a binary number.'); return; }
      if (!/^[01]+$/.test(raw)) { showError('Invalid binary — use only 0 and 1.'); return; }
      numericVal = parseInt(raw, 2);
      displayStr = `Binary: ${raw}`;
      break;
    }
    case 'text': {
      const raw = document.getElementById('inp-text').value;
      if (!raw) { showError('Please enter some text.'); return; }
      const codes = Array.from(raw).map(c => c.charCodeAt(0));
      codes.forEach(c => Simulator.pushInput(c));
      showOutput(codes, 'text', raw);
      logMicro(`Text "${raw}" → ASCII [${codes.join(', ')}]`, 'data');
      return;
    }
    case 'file': {
      const info = document.getElementById('filePickInfo').textContent;
      if (info === 'No file selected') { showError('Please browse and select a file first.'); return; }
      logMicro(`File "${info}" loaded from persistent memory`, 'data');
      return;
    }
  }
  const val16 = numericVal & 0xFFFF;
  Simulator.reset();
  Simulator.pushInput(val16);
  showOutput(numericVal, 'number');
  logMicro(`${displayStr} → buffered (hex=0x${val16.toString(16).toUpperCase().padStart(4, '0')})`, 'data');
  const { instructions } = Simulator.assemble(
    `LOAD R0, ${val16}\nOUT R0\nHALT`
  );
  Simulator.load(instructions);
  Simulator.run();
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
    const n   = Number(val) & 0xFFFF;
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

// ── Rich Media Preview ─────────────────────────────────────────
function showMediaPreview(fileObj) {
  const wrap = document.getElementById('mediaPreview');
  if (!wrap) return;

  const { name, type, dataURL } = fileObj;
  const cat = getFileCategory(type, name);

  let contentHtml = '';
  switch (cat) {
    case 'image':
      contentHtml = `<img src="${dataURL}" alt="${name}" />`;
      break;
    case 'audio':
      contentHtml = `<audio controls autoplay style="padding:12px;background:#0B0C0E;width:calc(100% - 24px)">
        <source src="${dataURL}" type="${type}" />
        Your browser does not support this audio format.
      </audio>`;
      break;
    case 'video':
      contentHtml = `<video controls autoplay style="max-height:400px">
        <source src="${dataURL}" type="${type}" />
        Your browser does not support this video format.
      </video>`;
      break;
    case 'pdf':
      contentHtml = `<iframe src="${dataURL}" title="${name}"></iframe>`;
      break;
    case 'text':
      // dataURL is base64 — decode and show first 2KB
      try {
        const b64 = dataURL.split(',')[1];
        const decoded = atob(b64).slice(0, 2048);
        contentHtml = `<div class="text-preview">${escapeHtml(decoded)}${fileObj.size > 2048 ? '\n\n… (truncated)' : ''}</div>`;
      } catch {
        contentHtml = `<div class="text-preview">Cannot preview this file.</div>`;
      }
      break;
    default:
      contentHtml = `<div class="text-preview">📄 Binary file — no visual preview available.\nSize: ${formatSize(fileObj.size)}\nType: ${type || 'unknown'}</div>`;
  }

  wrap.innerHTML = `
    <div class="media-header">
      <span>📂 ${name}  <span style="color:var(--text-dim);font-size:10px">${type || 'unknown'} · ${formatSize(fileObj.size)}</span></span>
      <button class="media-close" onclick="clearMediaPreview()" title="Close preview">✕</button>
    </div>
    ${contentHtml}
  `;
  wrap.classList.add('visible');
}

function clearMediaPreview() {
  const wrap = document.getElementById('mediaPreview');
  if (wrap) { wrap.innerHTML = ''; wrap.classList.remove('visible'); }
}

function getFileCategory(mime, name) {
  if (!mime) mime = '';
  const ext = (name || '').split('.').pop().toLowerCase();
  if (mime.startsWith('image/') || ['jpg','jpeg','png','gif','bmp','webp','svg','ico'].includes(ext)) return 'image';
  if (mime.startsWith('audio/') || ['mp3','wav','ogg','flac','aac','m4a','wma'].includes(ext))          return 'audio';
  if (mime.startsWith('video/') || ['mp4','webm','mkv','avi','mov','wmv','flv'].includes(ext))          return 'video';
  if (mime === 'application/pdf' || ext === 'pdf')                                                       return 'pdf';
  if (mime.startsWith('text/') || ['txt','csv','json','xml','html','md','js','css','py'].includes(ext))  return 'text';
  return 'binary';
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── File Input Handler (browse button) ────────────────────────
function handleInputFile(file) {
  if (!file) return;
  const info = document.getElementById('filePickInfo');
  if (info) info.textContent = `${file.name}  (${formatSize(file.size)})`;

  const reader = new FileReader();
  reader.onload = async e => {
    const dataURL = e.target.result;
    const fileObj = { name: file.name, type: file.type, size: file.size, dataURL };

    // Persist to IndexedDB
    await FileStore.save(fileObj);
    addFileToSidebar(file.name, file.size, file.type);

    // Show in output
    const display = document.getElementById('outputDisplay');
    if (display) {
      display.textContent = `✔ File "${file.name}" loaded & saved permanently.\nType: ${file.type || 'unknown'} | Size: ${formatSize(file.size)}`;
      display.classList.add('flash');
      setTimeout(() => display.classList.remove('flash'), 600);
    }

    // Show media preview
    showMediaPreview(fileObj);
    logMicro(`File "${file.name}" stored permanently (IndexedDB)`, 'data');
  };
  reader.readAsDataURL(file);
}

// ── Sidebar File Upload (drop zone) ──────────────────────────
function handleDragOver(e) { e.preventDefault(); e.currentTarget.style.borderColor = '#D4AF37'; }

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.style.borderColor = '';
  handleSidebarFiles(e.dataTransfer.files);
}

function handleFiles(files) { handleSidebarFiles(files); }

function handleSidebarFiles(files) {
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = async e => {
      const fileObj = { name: file.name, type: file.type, size: file.size, dataURL: e.target.result };
      await FileStore.save(fileObj);
      addFileToSidebar(file.name, file.size, file.type);
      logMicro(`File stored: "${file.name}" (${formatSize(file.size)})`, 'data');
    };
    reader.readAsDataURL(file);
  });
}

// ── Load Stored Files on Page Load ───────────────────────────
async function loadStoredFilesFromDB() {
  try {
    const files = await FileStore.getAll();
    files.forEach(f => addFileToSidebar(f.name, f.size, f.type));
    if (files.length) logMicro(`Loaded ${files.length} file(s) from persistent memory`, 'addr');
  } catch (err) {
    logMicro('Could not load stored files: ' + err.message, 'ctrl');
  }
}

function addFileToSidebar(name, size, type) {
  const list = document.getElementById('fileList');
  if (!list) return;
  if (list.querySelector(`[data-fname="${CSS.escape(name)}"]`)) return; // no duplicate
  const li = document.createElement('li');
  li.dataset.fname = name;
  const cat = getFileCategory(type, name);
  const icon = { image:'🖼', audio:'🎵', video:'🎬', pdf:'📕', text:'📄', binary:'📦' }[cat] || '📄';
  li.innerHTML = `<span>${icon} ${name} <small style="opacity:.5">${formatSize(size)}</small></span>
    <span class="file-remove" onclick="removeFile('${name.replace(/'/g,"\\'")}',this.parentElement)" title="Delete file">✕</span>`;
  list.appendChild(li);
}

async function removeFile(name, li) {
  await FileStore.remove(name);
  if (li) li.remove();
  logMicro(`File deleted: "${name}"`, 'ctrl');
}

// ── Stored File Search (with preview + delete) ────────────────
async function searchStoredFiles(query) {
  const results = document.getElementById('storedResults');
  if (!results) return;
  results.innerHTML = '';
  if (!query.trim()) return;

  const q     = query.toLowerCase();
  let   files = [];
  try { files = await FileStore.getAll(); } catch { return; }

  const matches = files.filter(f => f.name.toLowerCase().includes(q));
  if (!matches.length) {
    const li = document.createElement('li');
    li.textContent = 'No matching files found';
    li.style.color  = 'var(--text-dim)';
    li.style.cursor = 'default';
    results.appendChild(li);
    return;
  }

  matches.forEach(fileObj => {
    const li  = document.createElement('li');
    const cat = getFileCategory(fileObj.type, fileObj.name);
    const icon = { image:'🖼', audio:'🎵', video:'🎬', pdf:'📕', text:'📄', binary:'📦' }[cat] || '📄';
    li.innerHTML =
      `<span>${icon} ${fileObj.name} <small style="opacity:.5">${formatSize(fileObj.size)}</small></span>
       <button class="file-del-btn" title="Delete this file from memory">🗑 Delete</button>`;

    // Click file name → preview it
    li.querySelector('span').addEventListener('click', () => {
      document.getElementById('filePickInfo').textContent = fileObj.name;
      showMediaPreview(fileObj);
      const display = document.getElementById('outputDisplay');
      if (display) {
        display.textContent = `✔ File "${fileObj.name}" retrieved from permanent memory.\nType: ${fileObj.type || 'unknown'} | Size: ${formatSize(fileObj.size)}`;
        display.classList.add('flash');
        setTimeout(() => display.classList.remove('flash'), 600);
      }
      logMicro(`File "${fileObj.name}" retrieved from persistent storage`, 'data');
    });

    // Click delete button → remove from DB and sidebar
    li.querySelector('.file-del-btn').addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm(`Delete "${fileObj.name}" permanently from memory?`)) return;
      await FileStore.remove(fileObj.name);
      li.remove();
      // Also remove from sidebar list
      const sidebarItem = document.querySelector(`#fileList [data-fname="${CSS.escape(fileObj.name)}"]`);
      if (sidebarItem) sidebarItem.remove();
      logMicro(`File "${fileObj.name}" permanently deleted`, 'ctrl');
    });

    results.appendChild(li);
  });
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
  ttsUtterance.rate = parseFloat(document.getElementById('ttsRate')?.value) || 1;
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
function closeCompModal() { document.getElementById('compModal')?.classList.remove('open'); }

// ── Utilities ─────────────────────────────────────────────────
function formatSize(bytes) {
  if (!bytes) return '0B';
  if (bytes < 1024)        return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// ── Arch select ───────────────────────────────────────────────
document.getElementById('archSelect')?.addEventListener('change', function() {
  logMicro(`Architecture → ${this.options[this.selectedIndex].text}`, 'ctrl');
  resetSim();
});
