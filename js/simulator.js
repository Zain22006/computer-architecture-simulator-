/* ============================================================
   SIMULATOR ENGINE – CPU simulation core
   Runs on a separate tick from rendering (requestAnimationFrame)
   Implements: Fetch-Decode-Execute cycle, registers, ALU, memory
   ============================================================ */

const Simulator = (() => {

  // ── State ──────────────────────────────────────────────────
  const RAM_SIZE = 256; // 256 bytes for demo (shows full grid)

  let state = {
    running: false,
    halted: false,
    clockHz: 5,
    cycleCount: 0,
    registers: { R0:0, R1:0, R2:0, R3:0, R4:0, R5:0, R6:0, R7:0, PC:0, IR:0, ACC:0 },
    flags: { Z:0, S:0, C:0, O:0 },
    ram: new Uint8Array(RAM_SIZE),
    aluOut: 0,
    activeBlock: 'cu',
    phase: 'FETCH',   // FETCH | DECODE | EXECUTE | WRITEBACK
    program: [],       // array of { op, r1, r2, imm }
    history: [],       // for state rollback
    maxHistory: 50,
    inputBuffer: [],   // FIFO ring buffer for I/O
    outputBuffer: []
  };

  // ── ISA Definition ─────────────────────────────────────────
  const OPCODES = {
    'NOP':   0x00,
    'LOAD':  0x01,  // LOAD Rd, imm
    'STORE': 0x02,  // STORE Rs, addr
    'MOV':   0x03,  // MOV Rd, Rs | MOV Rd, imm
    'ADD':   0x04,  // ADD Rd, Rs
    'SUB':   0x05,
    'MUL':   0x06,
    'DIV':   0x07,
    'AND':   0x08,
    'OR':    0x09,
    'XOR':   0x0A,
    'NOT':   0x0B,
    'SHL':   0x0C,  // SHL Rd, imm
    'SHR':   0x0D,
    'JMP':   0x10,  // JMP addr
    'JZ':    0x11,
    'JNZ':   0x12,
    'JN':    0x13,
    'CALL':  0x14,
    'RET':   0x15,
    'IN':    0x20,  // IN Rd
    'OUT':   0x21,  // OUT Rs
    'HALT':  0xFF
  };

  // ── Assembler / Compiler ───────────────────────────────────
  function assemble(source) {
    const lines = source.split('\n');
    const instructions = [];
    const errors = [];
    const labels = {};

    // First pass: collect labels
    let addr = 0;
    lines.forEach((rawLine, lineNum) => {
      const line = rawLine.split(';')[0].trim();
      if (!line) return;
      if (line.endsWith(':')) {
        labels[line.slice(0, -1).toUpperCase()] = addr;
      } else {
        addr++;
      }
    });

    // Second pass: assemble
    lines.forEach((rawLine, lineNum) => {
      const line = rawLine.split(';')[0].trim();
      if (!line || line.endsWith(':')) return;

      const parts = line.split(/[\s,]+/).filter(Boolean);
      const mnemonic = parts[0].toUpperCase();

      if (!(mnemonic in OPCODES)) {
        errors.push({ line: lineNum + 1, msg: `Unknown mnemonic: ${mnemonic}` });
        instructions.push({ op: 0x00, r1: 0, r2: 0, imm: 0 });
        return;
      }

      const parseReg = s => {
        if (!s) return 0;
        const r = s.toUpperCase().replace('R', '');
        return parseInt(r) || 0;
      };
      const parseImm = s => {
        if (!s) return 0;
        if (s.toUpperCase() in labels) return labels[s.toUpperCase()];
        if (s.startsWith('0x') || s.startsWith('0X')) return parseInt(s, 16);
        return parseInt(s) || 0;
      };

      const isReg = s => s && /^[Rr][0-7]$/i.test(s);

      let instr = { op: OPCODES[mnemonic], r1: 0, r2: 0, imm: 0, raw: line };
      switch (mnemonic) {
        case 'NOP': case 'HALT': case 'RET': break;
        case 'LOAD':  instr.r1 = parseReg(parts[1]); instr.imm = parseImm(parts[2]); break;
        case 'STORE': instr.r1 = parseReg(parts[1]); instr.imm = parseImm(parts[2]); break;
        case 'MOV':
          instr.r1 = parseReg(parts[1]);
          if (isReg(parts[2])) { instr.r2 = parseReg(parts[2]); instr.imm = -1; }
          else { instr.imm = parseImm(parts[2]); }
          break;
        case 'ADD': case 'SUB': case 'MUL': case 'DIV':
        case 'AND': case 'OR': case 'XOR':
          instr.r1 = parseReg(parts[1]); instr.r2 = parseReg(parts[2]); break;
        case 'NOT': case 'IN': case 'OUT':
          instr.r1 = parseReg(parts[1]); break;
        case 'SHL': case 'SHR':
          instr.r1 = parseReg(parts[1]); instr.imm = parseImm(parts[2]); break;
        case 'JMP': case 'JZ': case 'JNZ': case 'JN': case 'CALL':
          instr.imm = parseImm(parts[1]); break;
      }
      instructions.push(instr);
    });

    return { instructions, errors };
  }

  // ── ALU Operations ─────────────────────────────────────────
  function aluOp(op, a, b) {
    let result = 0;
    switch (op) {
      case 'ADD': result = (a + b) & 0xFFFF; break;
      case 'SUB': result = ((a - b) + 0x10000) & 0xFFFF; break;
      case 'MUL': result = (a * b) & 0xFFFF; break;
      case 'DIV': result = b !== 0 ? Math.floor(a / b) & 0xFFFF : 0; break;
      case 'AND': result = (a & b) & 0xFFFF; break;
      case 'OR':  result = (a | b) & 0xFFFF; break;
      case 'XOR': result = (a ^ b) & 0xFFFF; break;
      case 'NOT': result = (~a) & 0xFFFF; break;
      case 'SHL': result = (a << b) & 0xFFFF; break;
      case 'SHR': result = (a >> b) & 0xFFFF; break;
    }
    // Update flags
    state.flags.Z = result === 0 ? 1 : 0;
    state.flags.S = (result & 0x8000) ? 1 : 0;
    state.flags.C = result > 0xFFFF ? 1 : 0;
    state.flags.O = ((a ^ result) & (b ^ result) & 0x8000) ? 1 : 0;
    return result;
  }

  // ── Execution Step ─────────────────────────────────────────
  function executeStep() {
    if (state.halted || !state.program.length) return;

    const pc = state.registers.PC;
    if (pc >= state.program.length) { state.halted = true; logMicro('HALT – program end', 'ctrl'); return; }

    const instr = state.program[pc];
    if (!instr) { state.halted = true; return; }

    // Save history for rollback
    if (state.history.length >= state.maxHistory) state.history.shift();
    state.history.push(JSON.parse(JSON.stringify({ registers: state.registers, flags: state.flags, aluOut: state.aluOut })));

    // FETCH
    state.activeBlock = 'cu';
    state.registers.PC = pc + 1;
    state.registers.IR = instr.op;
    logMicro(`FETCH: PC=${pc} → IR=0x${instr.op.toString(16).toUpperCase()}`, 'addr');
    CanvasRenderer.spawnBurst('memory', 'cu', 'ctrl', 3);

    // DECODE
    state.activeBlock = 'cu';
    logMicro(`DECODE: ${instr.raw || '---'} → op=0x${instr.op.toString(16)}`, 'ctrl');

    // EXECUTE
    const reg = s => state.registers[s] || 0;
    const setReg = (n, v) => { state.registers[n] = v & 0xFFFF; };
    const getReg = n => `R${n}`;

    switch (instr.op) {
      case OPCODES.NOP:
        state.activeBlock = 'cu';
        logMicro('NOP – no operation', 'ctrl');
        break;

      case OPCODES.LOAD:
        state.activeBlock = 'memory';
        logMicro(`LOAD R${instr.r1} ← ${instr.imm}`, 'data');
        setReg(getReg(instr.r1), instr.imm);
        flashMemCell(instr.imm, 'read');
        CanvasRenderer.spawnBurst('memory', 'registers', 'data', 4);
        break;

      case OPCODES.STORE:
        state.activeBlock = 'memory';
        logMicro(`STORE [${instr.imm}] ← R${instr.r1}=${reg(getReg(instr.r1))}`, 'addr');
        if (instr.imm < RAM_SIZE) state.ram[instr.imm] = reg(getReg(instr.r1)) & 0xFF;
        flashMemCell(instr.imm, 'write');
        CanvasRenderer.spawnBurst('registers', 'memory', 'addr', 4);
        break;

      case OPCODES.MOV:
        state.activeBlock = 'registers';
        if (instr.imm === -1) {
          setReg(getReg(instr.r1), reg(getReg(instr.r2)));
          logMicro(`MOV R${instr.r1} ← R${instr.r2}`, 'data');
        } else {
          setReg(getReg(instr.r1), instr.imm);
          logMicro(`MOV R${instr.r1} ← #${instr.imm}`, 'data');
        }
        CanvasRenderer.spawnBurst('cu', 'registers', 'ctrl', 3);
        break;

      case OPCODES.ADD:
        state.activeBlock = 'alu';
        { const a = reg(getReg(instr.r1)), b = reg(getReg(instr.r2));
          const r = aluOp('ADD', a, b);
          state.aluOut = r;
          setReg(getReg(instr.r1), r);
          logMicro(`ADD R${instr.r1}=${a} + R${instr.r2}=${b} → ${r} [Z=${state.flags.Z}]`, 'data');
          CanvasRenderer.spawnBurst('registers', 'alu', 'data', 5);
          CanvasRenderer.spawnBurst('alu', 'registers', 'data', 4);
        }
        break;

      case OPCODES.SUB:
        state.activeBlock = 'alu';
        { const a = reg(getReg(instr.r1)), b = reg(getReg(instr.r2));
          const r = aluOp('SUB', a, b);
          state.aluOut = r;
          setReg(getReg(instr.r1), r);
          logMicro(`SUB R${instr.r1}=${a} - R${instr.r2}=${b} → ${r}`, 'data');
          CanvasRenderer.spawnBurst('registers', 'alu', 'data', 5);
        }
        break;

      case OPCODES.MUL:
        state.activeBlock = 'alu';
        { const a = reg(getReg(instr.r1)), b = reg(getReg(instr.r2));
          const r = aluOp('MUL', a, b);
          state.aluOut = r;
          setReg(getReg(instr.r1), r);
          logMicro(`MUL R${instr.r1}=${a} × R${instr.r2}=${b} → ${r}`, 'data');
        }
        break;

      case OPCODES.AND: case OPCODES.OR: case OPCODES.XOR:
        state.activeBlock = 'alu';
        { const opName = Object.keys(OPCODES).find(k => OPCODES[k] === instr.op);
          const a = reg(getReg(instr.r1)), b = reg(getReg(instr.r2));
          const r = aluOp(opName, a, b);
          state.aluOut = r;
          setReg(getReg(instr.r1), r);
          logMicro(`${opName} R${instr.r1} ← ${r}`, 'data');
        }
        break;

      case OPCODES.NOT:
        state.activeBlock = 'alu';
        { const a = reg(getReg(instr.r1));
          const r = aluOp('NOT', a, 0);
          state.aluOut = r;
          setReg(getReg(instr.r1), r);
          logMicro(`NOT R${instr.r1}=${a} → ${r}`, 'data');
        }
        break;

      case OPCODES.SHL: case OPCODES.SHR:
        state.activeBlock = 'alu';
        { const opName = instr.op === OPCODES.SHL ? 'SHL' : 'SHR';
          const a = reg(getReg(instr.r1));
          const r = aluOp(opName, a, instr.imm);
          state.aluOut = r;
          setReg(getReg(instr.r1), r);
          logMicro(`${opName} R${instr.r1} by ${instr.imm} → ${r}`, 'data');
        }
        break;

      case OPCODES.JMP:
        state.activeBlock = 'cu';
        state.registers.PC = instr.imm;
        logMicro(`JMP → ${instr.imm}`, 'ctrl');
        CanvasRenderer.spawnBurst('cu', 'memory', 'ctrl', 4);
        break;

      case OPCODES.JZ:
        state.activeBlock = 'cu';
        if (state.flags.Z) { state.registers.PC = instr.imm; logMicro(`JZ taken → ${instr.imm}`, 'ctrl'); }
        else { logMicro(`JZ not taken (Z=0)`, 'ctrl'); }
        break;

      case OPCODES.JNZ:
        state.activeBlock = 'cu';
        if (!state.flags.Z) { state.registers.PC = instr.imm; logMicro(`JNZ taken → ${instr.imm}`, 'ctrl'); }
        else { logMicro(`JNZ not taken (Z=1)`, 'ctrl'); }
        break;

      case OPCODES.IN:
        state.activeBlock = 'io';
        { const val = state.inputBuffer.length ? state.inputBuffer.shift() : 0;
          setReg(getReg(instr.r1), val);
          logMicro(`IN R${instr.r1} ← ${val}`, 'data');
          CanvasRenderer.spawnBurst('io', 'registers', 'data', 4);
        }
        break;

      case OPCODES.OUT:
        state.activeBlock = 'io';
        { const val = reg(getReg(instr.r1));
          state.outputBuffer.push(val);
          logMicro(`OUT ← R${instr.r1}=${val}`, 'data');
          CanvasRenderer.spawnBurst('registers', 'io', 'data', 4);
          document.dispatchEvent(new CustomEvent('simOutput', { detail: val }));
        }
        break;

      case OPCODES.HALT:
        state.halted = true;
        state.running = false;
        state.activeBlock = 'cu';
        logMicro('HALT – execution complete', 'ctrl');
        updateStatus('HALTED');
        break;
    }

    state.cycleCount++;
    updateStatus(state.halted ? 'HALTED' : 'RUNNING');
  }

  // ── Clock loop ─────────────────────────────────────────────
  let clockInterval = null;

  function startClock() {
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(() => {
      if (!state.running || state.halted) { stopClock(); return; }
      executeStep();
    }, 1000 / state.clockHz);
  }

  function stopClock() {
    if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
    state.running = false;
  }

  // ── Public API ─────────────────────────────────────────────
  function load(program) {
    state.program = program;
    state.registers.PC = 0;
    state.halted = false;
    state.cycleCount = 0;
    state.history = [];
    logMicro(`Program loaded: ${program.length} instructions`, 'addr');
  }

  function run() {
    if (state.halted) return;
    state.running = true;
    updateStatus('RUNNING');
    startClock();
  }

  function stop() { stopClock(); updateStatus('STOPPED'); }

  function reset() {
    stopClock();
    state.running = false;
    state.halted = false;
    state.cycleCount = 0;
    state.history = [];
    state.registers = { R0:0, R1:0, R2:0, R3:0, R4:0, R5:0, R6:0, R7:0, PC:0, IR:0, ACC:0 };
    state.flags = { Z:0, S:0, C:0, O:0 };
    state.ram.fill(0);
    state.aluOut = 0;
    state.activeBlock = 'cu';
    state.program = [];
    state.outputBuffer = [];
    state.inputBuffer = [];
    updateStatus('IDLE');
    logMicro('CPU RESET', 'ctrl');
  }

  function stepForward() {
    if (!state.program.length) { logMicro('No program loaded. Run code first.', 'ctrl'); return; }
    if (!state.halted) executeStep();
  }

  function stepBack() {
    if (!state.history.length) { logMicro('No history to roll back', 'ctrl'); return; }
    const prev = state.history.pop();
    state.registers = prev.registers;
    state.flags = prev.flags;
    state.aluOut = prev.aluOut;
    logMicro(`ROLLBACK → PC=${state.registers.PC}`, 'addr');
  }

  function setClockSpeed(hz) {
    state.clockHz = Number(hz);
    if (state.running) startClock();
  }

  function pushInput(val) {
    state.inputBuffer.push(val & 0xFFFF);
  }

  function getState() { return state; }

  return { load, run, stop, reset, stepForward, stepBack, setClockSpeed, pushInput, getState, assemble };
})();
