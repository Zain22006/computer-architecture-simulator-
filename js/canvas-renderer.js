/* ============================================================
   CANVAS RENDERER – GPU-accelerated simulation drawing
   Uses requestAnimationFrame for 60fps rendering
   Simulation state updated independently at clock speed
   ============================================================ */

const CanvasRenderer = (() => {
  let canvas, ctx, W, H;
  let hoveredBlock = null;
  let tooltipText = '';
  let animFrame = 0;

  // Bus particle system
  const BUS_PARTICLES = [];
  const MAX_PARTICLES = 120;

  // Functional block definitions
  const BLOCKS = [
    {
      id: 'cu', label: 'Control Unit', abbr: 'CU',
      x: 0.08, y: 0.12, w: 0.18, h: 0.22,
      color: '#3D1015', glow: '#E03040', textColor: '#F0C040',
      desc: 'Decodes instructions & generates control signals'
    },
    {
      id: 'alu', label: 'Arithmetic Logic Unit', abbr: 'ALU',
      x: 0.38, y: 0.12, w: 0.22, h: 0.28,
      color: '#2E1515', glow: '#E03040', textColor: '#F0E0B0',
      desc: 'Performs arithmetic & logical operations'
    },
    {
      id: 'registers', label: 'Register File', abbr: 'REG',
      x: 0.08, y: 0.44, w: 0.18, h: 0.30,
      color: '#0E2E20', glow: '#12C898', textColor: '#20F0C0',
      desc: 'High-speed temporary storage (R0–R7, PC, IR, ACC)'
    },
    {
      id: 'memory', label: 'Main Memory (RAM)', abbr: 'RAM',
      x: 0.72, y: 0.12, w: 0.22, h: 0.52,
      color: '#1C1C30', glow: '#E0C040', textColor: '#E8C840',
      desc: '64KB RAM – stores instructions & data'
    },
    {
      id: 'cache', label: 'Cache Memory', abbr: 'L1$',
      x: 0.72, y: 0.70, w: 0.22, h: 0.22,
      color: '#0E2228', glow: '#12C898', textColor: '#20D8B0',
      desc: 'L1 Cache – fast buffer between CPU & RAM'
    },
    {
      id: 'ir', label: 'Instruction Register', abbr: 'IR',
      x: 0.38, y: 0.52, w: 0.10, h: 0.14,
      color: '#281216', glow: '#E03040', textColor: '#F0E0B0',
      desc: 'Holds the currently-executing instruction'
    },
    {
      id: 'pc', label: 'Program Counter', abbr: 'PC',
      x: 0.50, y: 0.52, w: 0.10, h: 0.14,
      color: '#28200E', glow: '#E0C040', textColor: '#E8C840',
      desc: 'Tracks address of next instruction to execute'
    },
    {
      id: 'io', label: 'I/O Unit', abbr: 'I/O',
      x: 0.38, y: 0.72, w: 0.22, h: 0.18,
      color: '#1A1A30', glow: '#7070E8', textColor: '#A8A8FF',
      desc: 'Manages data transfer between CPU & peripherals'
    }
  ];

  // Bus routes: [fromId, toId, type] type: 'data'|'addr'|'ctrl'
  const BUSES = [
    { from: 'cu', to: 'alu', type: 'ctrl' },
    { from: 'cu', to: 'registers', type: 'ctrl' },
    { from: 'registers', to: 'alu', type: 'data' },
    { from: 'alu', to: 'registers', type: 'data' },
    { from: 'alu', to: 'memory', type: 'addr' },
    { from: 'memory', to: 'cache', type: 'data' },
    { from: 'cache', to: 'alu', type: 'data' },
    { from: 'cu', to: 'ir', type: 'ctrl' },
    { from: 'ir', to: 'cu', type: 'ctrl' },
    { from: 'pc', to: 'memory', type: 'addr' },
    { from: 'registers', to: 'io', type: 'data' },
    { from: 'io', to: 'memory', type: 'addr' }
  ];

  const BUS_COLORS = {
    data: '#097969',
    addr: '#D4AF37',
    ctrl: '#C0202A'
  };

  function getBlockRect(b) {
    return {
      x: b.x * W, y: b.y * H,
      w: b.w * W, h: b.h * H
    };
  }

  function getBlockCenter(id) {
    const b = BLOCKS.find(b => b.id === id);
    if (!b) return { x: 0, y: 0 };
    return { x: (b.x + b.w / 2) * W, y: (b.y + b.h / 2) * H };
  }

  function spawnParticle(fromId, toId, type) {
    if (BUS_PARTICLES.length >= MAX_PARTICLES) return;
    const from = getBlockCenter(fromId);
    const to = getBlockCenter(toId);
    BUS_PARTICLES.push({
      x: from.x, y: from.y,
      tx: to.x, ty: to.y,
      progress: 0,
      speed: 0.004 + Math.random() * 0.006,
      color: BUS_COLORS[type] || '#fff',
      size: 2 + Math.random() * 2,
      alpha: 1,
      type
    });
  }

  function drawBlock(b, isActive, simState) {
    const r = getBlockRect(b);
    const isHovered = (hoveredBlock === b.id);

    // Shadow glow
    if (isActive || isHovered) {
      ctx.shadowColor = b.glow;
      ctx.shadowBlur = isHovered ? 30 : 20;
    } else {
      ctx.shadowBlur = 0;
    }

    // Background
    const gradient = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    gradient.addColorStop(0, b.color);
    gradient.addColorStop(1, isActive ? b.glow + '44' : b.color);
    ctx.fillStyle = gradient;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    // Border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = isActive ? b.glow : (isHovered ? b.textColor : 'rgba(212,175,55,0.2)');
    ctx.lineWidth = isHovered ? 2 : 1;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    // Corner marks
    const cs = 8;
    ctx.strokeStyle = b.glow + (isActive ? 'CC' : '44');
    ctx.lineWidth = 1;
    // TL
    ctx.beginPath(); ctx.moveTo(r.x + cs, r.y); ctx.lineTo(r.x, r.y); ctx.lineTo(r.x, r.y + cs); ctx.stroke();
    // TR
    ctx.beginPath(); ctx.moveTo(r.x + r.w - cs, r.y); ctx.lineTo(r.x + r.w, r.y); ctx.lineTo(r.x + r.w, r.y + cs); ctx.stroke();
    // BL
    ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h - cs); ctx.lineTo(r.x, r.y + r.h); ctx.lineTo(r.x + cs, r.y + r.h); ctx.stroke();
    // BR
    ctx.beginPath(); ctx.moveTo(r.x + r.w - cs, r.y + r.h); ctx.lineTo(r.x + r.w, r.y + r.h); ctx.lineTo(r.x + r.w, r.y + r.h - cs); ctx.stroke();

    // Label (abbreviation)
    ctx.font = `bold ${Math.min(r.w * 0.28, 22)}px 'Share Tech Mono', monospace`;
    ctx.fillStyle = isActive ? '#fff' : (isHovered ? b.textColor : b.textColor + 'CC');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = b.glow;
    ctx.shadowBlur = isActive ? 10 : 0;
    ctx.fillText(b.abbr, r.x + r.w / 2, r.y + r.h * 0.42);
    ctx.shadowBlur = 0;

    // Sub label
    ctx.font = `${Math.min(r.w * 0.12, 10)}px 'Crimson Text', serif`;
    ctx.fillStyle = 'rgba(232,221,181,0.5)';
    ctx.fillText(b.label, r.x + r.w / 2, r.y + r.h * 0.68);

    // Active state: show live value
    if (simState && simState.registers) {
      let val = '';
      if (b.id === 'alu') val = '0x' + (simState.aluOut || 0).toString(16).toUpperCase().padStart(4, '0');
      if (b.id === 'pc')  val = '0x' + (simState.registers.PC || 0).toString(16).toUpperCase().padStart(4, '0');
      if (b.id === 'ir')  val = '0x' + (simState.registers.IR || 0).toString(16).toUpperCase().padStart(4, '0');
      if (val) {
        ctx.font = `10px 'Share Tech Mono', monospace`;
        ctx.fillStyle = b.textColor;
        ctx.fillText(val, r.x + r.w / 2, r.y + r.h * 0.86);
      }
    }
  }

  function drawBusLine(bus) {
    const from = getBlockCenter(bus.from);
    const to   = getBlockCenter(bus.to);
    const color = BUS_COLORS[bus.type] || '#888';

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    // Bezier curve for elegance
    const cp1x = from.x + (to.x - from.x) * 0.4;
    const cp1y = from.y;
    const cp2x = from.x + (to.x - from.x) * 0.6;
    const cp2y = to.y;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, to.x, to.y);
    ctx.strokeStyle = color + '33';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawParticles() {
    for (let i = BUS_PARTICLES.length - 1; i >= 0; i--) {
      const p = BUS_PARTICLES[i];
      p.progress += p.speed;
      if (p.progress >= 1) { BUS_PARTICLES.splice(i, 1); continue; }

      const t = p.progress;
      // Simple lerp (approximation)
      p.x = p.x + (p.tx - p.x) * p.speed * 2;
      p.y = p.y + (p.ty - p.y) * p.speed * 2;

      const alpha = Math.sin(t * Math.PI) * 0.9;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      // Glow trail
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(212,175,55,0.08)';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function drawALUDetail(simState) {
    if (!simState) return;
    const b = BLOCKS.find(b => b.id === 'alu');
    if (!b) return;
    const r = getBlockRect(b);
    // Flags display inside ALU block
    const flags = simState.flags || { Z: 0, S: 0, C: 0, O: 0 };
    const flagNames = ['Z', 'S', 'C', 'O'];
    const fColors = { Z: '#10D4A8', S: '#D4AF37', C: '#C0202A', O: '#8080F0' };
    flagNames.forEach((f, i) => {
      const fx = r.x + 6 + i * (r.w / 4 - 2);
      const fy = r.y + r.h * 0.86;
      ctx.fillStyle = flags[f] ? fColors[f] : 'rgba(255,255,255,0.1)';
      ctx.fillRect(fx, fy, r.w / 4 - 8, 8);
      ctx.font = '8px monospace';
      ctx.fillStyle = flags[f] ? '#000' : '#666';
      ctx.textAlign = 'center';
      ctx.fillText(f, fx + (r.w / 4 - 8) / 2, fy + 7);
    });
  }

  function drawTooltip() {
    if (!hoveredBlock || !tooltipText) return;
    const b = BLOCKS.find(b => b.id === hoveredBlock);
    if (!b) return;
    const r = getBlockRect(b);
    const tx = r.x + r.w / 2;
    const ty = r.y - 14;
    ctx.font = '11px Crimson Text, serif';
    const tw = ctx.measureText(tooltipText).width + 16;
    ctx.fillStyle = 'rgba(10,10,12,0.9)';
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(tx - tw / 2, ty - 18, tw, 20);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#D4AF37';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tooltipText, tx, ty - 8);
  }

  function render(simState, activeBlock) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    // Draw bus lines
    BUSES.forEach(bus => drawBusLine(bus));
    // Draw particles
    drawParticles();
    // Draw blocks
    BLOCKS.forEach(b => {
      const isActive = b.id === activeBlock;
      if (!isActive) ctx.globalAlpha = 0.85; // slightly dim inactive blocks
      drawBlock(b, isActive, simState);
      if (!isActive) ctx.globalAlpha = 1;
    });
    // Always draw active block on top at full brightness
    if (activeBlock) {
      const ab = BLOCKS.find(b => b.id === activeBlock);
      if (ab) drawBlock(ab, true, simState);
    }
    drawALUDetail(simState);
    drawTooltip();
    animFrame++;
    // Auto-spawn particles based on active block
    if (simState && simState.running && animFrame % 8 === 0) {
      const activeBuses = BUSES.filter(b => b.from === activeBlock || b.to === activeBlock);
      if (activeBuses.length) {
        const bus = activeBuses[Math.floor(Math.random() * activeBuses.length)];
        spawnParticle(bus.from, bus.to, bus.type);
      }
    }
  }

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    function resize() {
      W = canvas.width = canvas.clientWidth * devicePixelRatio;
      H = canvas.height = canvas.clientHeight * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
    }
    resize();
    new ResizeObserver(resize).observe(canvas);

    // Mouse interactions
    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      hoveredBlock = null;
      tooltipText = '';
      BLOCKS.forEach(b => {
        const r = getBlockRect(b);
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
          hoveredBlock = b.id;
          tooltipText = b.desc;
        }
      });
      canvas.style.cursor = hoveredBlock ? 'pointer' : 'crosshair';
    });

    canvas.addEventListener('click', e => {
      if (hoveredBlock) {
        showComponent(hoveredBlock);
      }
    });

    canvas.addEventListener('mouseleave', () => {
      hoveredBlock = null;
      tooltipText = '';
    });
  }

  function spawnBurst(fromId, toId, type, count = 5) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => spawnParticle(fromId, toId, type), i * 80);
    }
  }

  return { init, render, spawnBurst, BLOCKS, BUSES };
})();
