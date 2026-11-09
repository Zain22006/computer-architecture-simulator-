/* ============================================================
   COMPONENT DATA – Detailed info for each hardware component
   Used by sidebar clicks and canvas hover → modal content
   ============================================================ */

const ComponentData = {

  alu: {
    title: 'Arithmetic Logic Unit (ALU)',
    tags: [
      { text: 'ARITHMETIC', cls: 'tag-red' },
      { text: 'LOGIC', cls: 'tag-green' },
      { text: 'FLAGS', cls: 'tag-gold' }
    ],
    body: `
      <h3>What is the ALU?</h3>
      <p>The <em>Arithmetic Logic Unit</em> is the core computational engine inside every CPU. It is a combinational digital circuit that performs all mathematical calculations and logical comparisons requested by the program.</p>

      <h3>Key Operations</h3>
      <ul>
        <li><strong>Arithmetic:</strong> ADD, SUB, MUL, DIV — integer number crunching.</li>
        <li><strong>Logic:</strong> AND, OR, XOR, NOT — bitwise Boolean operations.</li>
        <li><strong>Shift:</strong> SHL, SHR — multiply/divide by powers of 2 at warp speed.</li>
        <li><strong>Compare:</strong> Sets status flags (Z, S, C, O) for conditional branching.</li>
      </ul>

      <h3>Status Flags</h3>
      <ul>
        <li><span class="tag tag-green">Z (Zero)</span> — Result was exactly zero.</li>
        <li><span class="tag tag-gold">S (Sign)</span> — Result's most significant bit is 1 (negative).</li>
        <li><span class="tag tag-red">C (Carry)</span> — Unsigned overflow: result > 0xFFFF.</li>
        <li><span class="tag tag-red">O (Overflow)</span> — Signed overflow: sign changed unexpectedly.</li>
      </ul>

      <h3>How it Connects</h3>
      <p>The ALU receives two operands from the <em>Register File</em> via the internal data bus. The Control Unit tells it which operation to perform. The result is written back to a register and the flags register is updated simultaneously.</p>
    `
  },

  cu: {
    title: 'Control Unit (CU)',
    tags: [
      { text: 'FETCH', cls: 'tag-red' },
      { text: 'DECODE', cls: 'tag-gold' },
      { text: 'CONTROL SIGNALS', cls: 'tag-red' }
    ],
    body: `
      <h3>What is the Control Unit?</h3>
      <p>The <em>Control Unit</em> is the brain's manager — it does not do any calculations itself. Instead, it orchestrates every other component, telling them exactly what to do and when to do it.</p>

      <h3>The Fetch-Decode-Execute Cycle</h3>
      <ul>
        <li><strong>FETCH:</strong> Read the next instruction from RAM at the address in the Program Counter (PC). Copy it into the Instruction Register (IR). Increment PC.</li>
        <li><strong>DECODE:</strong> Interpret the opcode bits. Determine which operation is needed, which registers are involved, and what addressing mode is used.</li>
        <li><strong>EXECUTE:</strong> Issue control signals to the ALU, registers, or memory to carry out the instruction.</li>
        <li><strong>WRITEBACK:</strong> Store the result back to a register or memory location.</li>
      </ul>

      <h3>Control Signals Generated</h3>
      <ul>
        <li>ALU operation selector (which arithmetic/logic function)</li>
        <li>Register read/write enable lines</li>
        <li>Memory read/write enable + address bus control</li>
        <li>Program Counter update (normal increment or jump)</li>
        <li>I/O enable and direction</li>
      </ul>
    `
  },

  registers: {
    title: 'Register File',
    tags: [
      { text: 'HIGH SPEED', cls: 'tag-green' },
      { text: 'ON-CHIP', cls: 'tag-gold' },
      { text: 'VOLATILE', cls: 'tag-red' }
    ],
    body: `
      <h3>What are Registers?</h3>
      <p>Registers are the fastest storage locations in a computer — they live directly on the CPU die, right next to the ALU. Access time is a single clock cycle (< 1 nanosecond on modern hardware).</p>

      <h3>Register Types in this Simulation</h3>
      <ul>
        <li><strong>R0–R7:</strong> General-purpose registers — store any integer value during computation.</li>
        <li><strong>PC (Program Counter):</strong> Always holds the memory address of the <em>next</em> instruction to execute.</li>
        <li><strong>IR (Instruction Register):</strong> Holds the <em>current</em> instruction being decoded/executed.</li>
        <li><strong>ACC (Accumulator):</strong> Special register that many operations implicitly write their result to.</li>
      </ul>

      <h3>Why Registers Matter</h3>
      <p>Using registers avoids expensive RAM accesses. Good programs keep "hot" values in registers as long as possible — this is what compilers do when they perform <em>register allocation optimisation</em>.</p>
    `
  },

  memory: {
    title: 'Main Memory (RAM)',
    tags: [
      { text: 'READ/WRITE', cls: 'tag-green' },
      { text: 'VOLATILE', cls: 'tag-red' },
      { text: 'BYTE ADDRESSABLE', cls: 'tag-gold' }
    ],
    body: `
      <h3>What is Main Memory (RAM)?</h3>
      <p><em>Random Access Memory</em> stores both program instructions and data values while the computer is running. Any byte can be accessed in roughly the same time regardless of its address — hence "random access".</p>

      <h3>Key Characteristics</h3>
      <ul>
        <li><strong>Volatile:</strong> All data is lost when power is switched off.</li>
        <li><strong>Byte-Addressable:</strong> Each location stores 8 bits (1 byte) and has a unique numeric address.</li>
        <li><strong>Hierarchy:</strong> Slower than registers/cache but far larger capacity.</li>
      </ul>

      <h3>How it Works in the Simulation</h3>
      <p>This simulation models 256 bytes of RAM displayed as an interactive coloured grid. Green flashes = read operations; Red flashes = write operations. Access frequency is tracked to demonstrate the cache heatmap.</p>
    `
  },

  cache: {
    title: 'Cache Memory (L1)',
    tags: [
      { text: 'L1 CACHE', cls: 'tag-green' },
      { text: 'SPATIAL LOCALITY', cls: 'tag-gold' },
      { text: 'TEMPORAL LOCALITY', cls: 'tag-gold' }
    ],
    body: `
      <h3>What is Cache Memory?</h3>
      <p>Cache is a small, ultra-fast buffer that sits between the CPU and the slower main RAM. The CPU always checks the cache first. If the data is there (a <em>cache hit</em>), it avoids a slow RAM access.</p>

      <h3>Cache Principles</h3>
      <ul>
        <li><strong>Temporal Locality:</strong> If a memory location was accessed recently, it will likely be accessed again soon → keep it in cache.</li>
        <li><strong>Spatial Locality:</strong> If location X was accessed, nearby locations X+1, X+2… are likely to be needed soon → load a full cache line (block of bytes).</li>
      </ul>

      <h3>Cache Heatmap</h3>
      <p>The coloured memory grid shows access frequency: cooler colours (dark) = rarely accessed; warmer/brighter = frequently accessed. This visualises spatial and temporal locality in real time.</p>
    `
  },

  ir: {
    title: 'Instruction Register (IR)',
    tags: [
      { text: 'DECODE INPUT', cls: 'tag-gold' },
      { text: '16-BIT', cls: 'tag-green' }
    ],
    body: `
      <h3>What is the Instruction Register?</h3>
      <p>During the FETCH phase, the Control Unit copies the instruction at the current PC address from RAM into the <em>Instruction Register</em>. The IR then holds that instruction steady while the Control Unit decodes it.</p>

      <h3>Instruction Encoding</h3>
      <p>Each 16-bit instruction word is split into fields:</p>
      <ul>
        <li><strong>Bits [15:8]:</strong> Opcode (operation code — what to do)</li>
        <li><strong>Bits [7:4]:</strong> Destination register (Rd)</li>
        <li><strong>Bits [3:0]:</strong> Source register (Rs) or immediate value</li>
      </ul>
      <p>The Control Unit's decoder inspects these bit fields to generate the correct control signals for that cycle.</p>
    `
  },

  pc: {
    title: 'Program Counter (PC)',
    tags: [
      { text: 'ADDRESS REGISTER', cls: 'tag-gold' },
      { text: 'SEQUENTIAL FLOW', cls: 'tag-green' }
    ],
    body: `
      <h3>What is the Program Counter?</h3>
      <p>The <em>Program Counter</em> is a special-purpose register that always contains the memory address of the <em>next</em> instruction to be fetched. It is the CPU's bookmark in the program.</p>

      <h3>How it Updates</h3>
      <ul>
        <li><strong>Normal execution:</strong> PC is incremented by 1 (or instruction width) after each fetch.</li>
        <li><strong>Jump instruction:</strong> PC is overwritten with the jump target address, redirecting program flow.</li>
        <li><strong>Function call (CALL):</strong> Current PC is pushed to a stack (return address), then PC = function address.</li>
        <li><strong>Return (RET):</strong> PC is restored from the stack.</li>
      </ul>
    `
  },

  bus: {
    title: 'System Bus',
    tags: [
      { text: 'DATA BUS', cls: 'tag-green' },
      { text: 'ADDRESS BUS', cls: 'tag-gold' },
      { text: 'CONTROL BUS', cls: 'tag-red' }
    ],
    body: `
      <h3>What is the System Bus?</h3>
      <p>The system bus is a shared communication channel — a collection of parallel electrical wires — that connects the CPU, memory, and I/O devices. Data travels along it as electrical signals every clock cycle.</p>

      <h3>Three Bus Types</h3>
      <ul>
        <li><span class="tag tag-green">DATA BUS</span> Carries the actual data values being transferred (bidirectional).</li>
        <li><span class="tag tag-gold">ADDRESS BUS</span> Carries the memory or I/O address being targeted (unidirectional, CPU→memory).</li>
        <li><span class="tag tag-red">CONTROL BUS</span> Carries control signals: read/write enable, clock, interrupt lines (bidirectional).</li>
      </ul>

      <h3>Animated Bus Lines</h3>
      <p>In this simulation, moving glowing particles trace data flowing along each bus type. <span style="color:#10D4A8">Green particles</span> = data, <span style="color:#D4AF37">gold particles</span> = address, <span style="color:#C0202A">red particles</span> = control signals.</p>
    `
  },

  io: {
    title: 'Input / Output Unit',
    tags: [
      { text: 'PERIPHERAL', cls: 'tag-gold' },
      { text: 'IN/OUT', cls: 'tag-green' },
      { text: 'INTERRUPT', cls: 'tag-red' }
    ],
    body: `
      <h3>What is the I/O Unit?</h3>
      <p>The <em>Input/Output Unit</em> manages all communication between the CPU and the outside world — keyboard, screen, disk drives, network cards, sensors, and more.</p>

      <h3>Key Concepts</h3>
      <ul>
        <li><strong>Programmed I/O:</strong> CPU actively polls a device register to check if data is ready (simple but wastes CPU cycles).</li>
        <li><strong>Interrupt-Driven I/O:</strong> Device sends an interrupt signal when ready; CPU pauses current task, handles the data, resumes.</li>
        <li><strong>DMA (Direct Memory Access):</strong> A dedicated controller transfers data between device and RAM without CPU involvement — maximum efficiency.</li>
      </ul>

      <h3>In this Simulation</h3>
      <p>The <code>IN</code> instruction reads from a FIFO input buffer (simulating keyboard input). The <code>OUT</code> instruction writes to an output buffer (simulating a screen/terminal). Values appear in the Output panel below the canvas.</p>
    `
  },

  pipeline: {
    title: 'Pipeline Hazard Visualizer',
    tags: [
      { text: 'STRUCTURAL', cls: 'tag-red' },
      { text: 'DATA HAZARD', cls: 'tag-gold' },
      { text: 'CONTROL HAZARD', cls: 'tag-red' }
    ],
    body: `
      <h3>What is Pipelining?</h3>
      <p>Instead of completing one instruction fully before starting the next, a pipelined CPU <em>overlaps</em> multiple instructions — like an assembly line. A 5-stage pipeline (IF→ID→EX→MEM→WB) can theoretically execute one instruction per clock cycle.</p>

      <h3>Pipeline Hazards</h3>
      <ul>
        <li><strong>Structural Hazard:</strong> Two instructions need the same hardware resource at the same time (e.g., one memory port, two simultaneous accesses). Solution: stall one, or add hardware.</li>
        <li><strong>Data Hazard (RAW):</strong> Instruction 2 needs a result that Instruction 1 hasn't finished computing yet. Solution: data forwarding or pipeline stalls (bubbles).</li>
        <li><strong>Control Hazard:</strong> A branch/jump changes the PC — the instructions already in the pipeline behind it may be wrong. Solution: branch prediction, speculative execution, or flush.</li>
      </ul>

      <h3>Reading the Visualizer</h3>
      <p>Each row is one instruction; each column is one clock cycle. Stage labels (IF, ID, EX, MEM, WB) show progress. <span style="color:#f44">STALL</span> cells indicate pipeline bubbles inserted to resolve hazards.</p>
    `
  }
};
