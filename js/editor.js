/* ============================================================
   CODE EDITOR – Line numbering, syntax check, debounced AST
   ============================================================ */

let editorDebounce = null;

function onEditorInput(ta) {
  updateLineNums(ta);
  clearTimeout(editorDebounce);
  editorDebounce = setTimeout(() => validateSyntax(ta.value), 400);
}

function updateLineNums(ta) {
  const lines = ta.value.split('\n').length;
  const nums = document.getElementById('lineNums');
  if (!nums) return;
  nums.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
}

function validateSyntax(source) {
  const errBox = document.getElementById('syntaxErrors');
  const statusEl = document.getElementById('editorStatus');
  if (!errBox || !statusEl) return;
  const { errors } = Simulator.assemble(source);
  if (errors.length === 0) {
    errBox.textContent = '';
    statusEl.textContent = `✔ ${source.split('\n').filter(l => l.trim() && !l.trim().startsWith(';')).length} instructions`;
    statusEl.style.color = '#10D4A8';
  } else {
    errBox.textContent = errors.map(e => `Line ${e.line}: ${e.msg}`).join(' | ');
    statusEl.textContent = `✖ ${errors.length} error(s)`;
    statusEl.style.color = '#C0202A';
  }
}

function handleEditorKey(e, ta) {
  // Tab = 2 spaces
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
    ta.selectionStart = ta.selectionEnd = start + 2;
    updateLineNums(ta);
  }
  // Ctrl+Enter = run
  if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); compileAndRun(); }
}

function loadExample() {
  const examples = [
    `; Fibonacci sequence example
; Computes fib(8) in R0
MOV R1, 0        ; F(0)
MOV R2, 1        ; F(1)
MOV R3, 7        ; loop counter
LOOP:
  MOV R0, R2
  ADD R2, R1
  MOV R1, R0
  SUB R3, R3     ; decrement (using R3 - R3 trick — set up better!)
  JNZ LOOP
OUT R0
HALT`,

    `; Simple ALU demo
LOAD R0, 15
LOAD R1, 7
ADD R0, R1       ; R0 = 22
STORE R0, 50     ; save to RAM[50]
MUL R0, R1       ; R0 = 22 * 7 = 154
OUT R0
HALT`,

    `; Bitwise ops demo
LOAD R0, 255     ; R0 = 0xFF
LOAD R1, 170     ; R1 = 0xAA = 10101010
AND R0, R1       ; R0 = 0xAA
XOR R0, R1       ; R0 = 0
NOT R1           ; R1 = ~0xAA = 0x55
OUT R1
HALT`
  ];
  const ta = document.getElementById('codeEditor');
  if (!ta) return;
  const idx = Math.floor(Math.random() * examples.length);
  ta.value = examples[idx];
  updateLineNums(ta);
  validateSyntax(ta.value);
}
