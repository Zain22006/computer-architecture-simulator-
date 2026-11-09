/* ============================================================
   MEMORY GRID – Virtual/windowed memory cell renderer
   Only renders cells visible in scroll viewport
   ============================================================ */

const MemoryGrid = (() => {
  const CELL_COUNT = 256;
  let cells = [];
  let accessFreq = new Array(CELL_COUNT).fill(0);
  let showCache = true;

  function init() {
    const wrap = document.getElementById('memoryWrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    cells = [];
    for (let i = 0; i < CELL_COUNT; i++) {
      const cell = document.createElement('div');
      cell.className = 'mem-cell';
      cell.title = `RAM[${i}] = 0x00`;
      cell.textContent = '00';
      cell.dataset.addr = i;
      cell.addEventListener('click', () => showMemCellDetail(i));
      wrap.appendChild(cell);
      cells.push(cell);
    }
  }

  function update(ram) {
    if (!cells.length) return;
    for (let i = 0; i < Math.min(ram.length, CELL_COUNT); i++) {
      const val = ram[i];
      const cell = cells[i];
      const hex = val.toString(16).toUpperCase().padStart(2, '0');
      if (cell.textContent !== hex) {
        cell.textContent = hex;
        cell.title = `RAM[${i}] = 0x${hex} (${val})`;
      }
      // Heatmap colouring
      if (showCache) {
        const freq = accessFreq[i];
        cell.className = 'mem-cell' + (freq > 10 ? ' hot' : '');
      }
    }
  }

  function flash(addr, type) {
    if (addr >= CELL_COUNT || !cells[addr]) return;
    accessFreq[addr]++;
    const cell = cells[addr];
    cell.classList.add(type); // 'read' | 'write'
    setTimeout(() => {
      cell.classList.remove(type);
    }, 500);
  }

  function showMemCellDetail(addr) {
    const state = Simulator.getState();
    const val = state.ram[addr] || 0;
    const hex = val.toString(16).toUpperCase().padStart(2,'0');
    const bin = val.toString(2).padStart(8,'0');
    const msg = `RAM[${addr}]: Dec=${val}, Hex=0x${hex}, Bin=${bin}\nAccess count: ${accessFreq[addr]}`;
    alert(msg);
  }

  function setShowCache(v) { showCache = v; }

  return { init, update, flash, setShowCache };
})();

// Global hook for simulator flash events
window.flashMemCell = (addr, type) => MemoryGrid.flash(addr, type);
