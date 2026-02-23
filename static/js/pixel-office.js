/**
 * Pixel Office — Canvas 2D agent visualization
 *
 * Classes:
 *   CharacterFactory  — procedural 16x16 pixel art characters
 *   SpriteEngine      — frame-based animation
 *   OfficeRenderer    — background, desks, labels, bubbles
 *   PixelOffice       — main controller (SSE + game loop)
 */

/* ── Character Factory ─────────────────────────────────────── */

var CharacterFactory = (function () {
  // 6 diverse palettes: skin, hair, shirt, pants
  var PALETTES = [
    { skin: '#ffd5b4', hair: '#4a3728', shirt: '#3b82f6', pants: '#1e3a5f' },
    { skin: '#e8b88a', hair: '#1a1a1a', shirt: '#ef4444', pants: '#374151' },
    { skin: '#fce4c4', hair: '#c68642', shirt: '#10b981', pants: '#1f2937' },
    { skin: '#d4a574', hair: '#2d1810', shirt: '#a855f7', pants: '#312e81' },
    { skin: '#ffe0bd', hair: '#8b6914', shirt: '#f97316', pants: '#44403c' },
    { skin: '#c68642', hair: '#0a0a0a', shirt: '#06b6d4', pants: '#134e4a' },
  ];

  // Each frame is a 12x16 grid. null = transparent.
  // Legend: S=skin, H=hair, C=shirt, P=pants, E=eye, K=shoe
  function _buildFrame(grid, palette) {
    var map = {
      S: palette.skin,
      H: palette.hair,
      C: palette.shirt,
      P: palette.pants,
      E: '#1a1a1a',
      K: '#2a2a2a',
      W: '#ffffff',
    };
    return grid.map(function (row) {
      return row.split('').map(function (c) {
        return map[c] || null;
      });
    });
  }

  // Idle frame — standing front view
  var IDLE_GRID = [
    '....HHHH....',
    '...HHHHHH...',
    '...HSSEHS...',
    '...SSSSSS...',
    '....SSSS....',
    '....CCCC....',
    '...CCCCCC...',
    '...CCCCCC...',
    '...SCCCCS...',
    '....CCCC....',
    '....PPPP....',
    '....PPPP....',
    '....P..P....',
    '....P..P....',
    '....KK.KK...',
    '....KK.KK...',
  ];

  // Type frame 1 — arms forward (typing)
  var TYPE1_GRID = [
    '....HHHH....',
    '...HHHHHH...',
    '...HSSEHS...',
    '...SSSSSS...',
    '....SSSS....',
    '....CCCC....',
    '..SCCCCCS...',
    '..SCCCCCS...',
    '...SCCCCS...',
    '....CCCC....',
    '....PPPP....',
    '....PPPP....',
    '....P..P....',
    '....P..P....',
    '....KK.KK...',
    '....KK.KK...',
  ];

  // Type frame 2 — arms slightly shifted
  var TYPE2_GRID = [
    '....HHHH....',
    '...HHHHHH...',
    '...HSSEHS...',
    '...SSSSSS...',
    '....SSSS....',
    '....CCCC....',
    '.SSCCCCCS...',
    '..SCCCCSS...',
    '...SCCCCS...',
    '....CCCC....',
    '....PPPP....',
    '....PPPP....',
    '....P..P....',
    '....P..P....',
    '....KK.KK...',
    '....KK.KK...',
  ];

  // Read frame 1 — head tilted with W (paper/screen glow)
  var READ1_GRID = [
    '....HHHH....',
    '...HHHHHH...',
    '...HWWEHS...',
    '...SSSSSS...',
    '....SSSS....',
    '....CCCC....',
    '...CCCCCC...',
    '...CCCCCC...',
    '...SCCCCS...',
    '....CCCC....',
    '....PPPP....',
    '....PPPP....',
    '....P..P....',
    '....P..P....',
    '....KK.KK...',
    '....KK.KK...',
  ];

  // Read frame 2 — eyes shift
  var READ2_GRID = [
    '....HHHH....',
    '...HHHHHH...',
    '...HEWWHS...',
    '...SSSSSS...',
    '....SSSS....',
    '....CCCC....',
    '...CCCCCC...',
    '...CCCCCC...',
    '...SCCCCS...',
    '....CCCC....',
    '....PPPP....',
    '....PPPP....',
    '....P..P....',
    '....P..P....',
    '....KK.KK...',
    '....KK.KK...',
  ];

  function create(paletteIndex) {
    var pal = PALETTES[paletteIndex % PALETTES.length];
    return {
      palette: pal,
      frames: {
        idle: [_buildFrame(IDLE_GRID, pal)],
        typing: [_buildFrame(TYPE1_GRID, pal), _buildFrame(TYPE2_GRID, pal)],
        reading: [_buildFrame(READ1_GRID, pal), _buildFrame(READ2_GRID, pal)],
        waiting: [_buildFrame(IDLE_GRID, pal)],
      },
    };
  }

  return { create: create, PALETTES: PALETTES };
})();


/* ── Sprite Engine ──────────────────────────────────────────── */

var SpriteEngine = (function () {
  var PIXEL_SIZE = 3;
  var FRAME_DURATION_MS = 350;

  function drawSprite(ctx, frame, x, y) {
    for (var r = 0; r < frame.length; r++) {
      for (var c = 0; c < frame[r].length; c++) {
        var color = frame[r][c];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(
            x + c * PIXEL_SIZE,
            y + r * PIXEL_SIZE,
            PIXEL_SIZE,
            PIXEL_SIZE
          );
        }
      }
    }
  }

  function getFrame(character, state, now) {
    var frames = character.frames[state] || character.frames.idle;
    var idx = Math.floor(now / FRAME_DURATION_MS) % frames.length;
    return frames[idx];
  }

  return {
    drawSprite: drawSprite,
    getFrame: getFrame,
    PIXEL_SIZE: PIXEL_SIZE,
    CHAR_WIDTH: 12 * PIXEL_SIZE,
    CHAR_HEIGHT: 16 * PIXEL_SIZE,
  };
})();


/* ── Office Renderer ────────────────────────────────────────── */

var OfficeRenderer = (function () {
  var DESK_WIDTH = 70;
  var DESK_HEIGHT = 32;
  var DESK_SPACING_X = 140;
  var DESK_SPACING_Y = 120;
  var DESK_START_X = 90;
  var DESK_START_Y = 110;
  var MONITOR_W = 22;
  var MONITOR_H = 16;

  function getColumns(canvasWidth) {
    if (canvasWidth < 500) return 2;
    if (canvasWidth < 800) return 3;
    return 4;
  }

  function getDeskPosition(index, canvasWidth) {
    var cols = getColumns(canvasWidth);
    var totalWidth = cols * DESK_SPACING_X;
    var offsetX = Math.max(DESK_START_X, (canvasWidth - totalWidth) / 2 + DESK_SPACING_X / 2);
    var col = index % cols;
    var row = Math.floor(index / cols);
    return {
      x: offsetX + col * DESK_SPACING_X,
      y: DESK_START_Y + row * DESK_SPACING_Y,
    };
  }

  function drawBackground(ctx, w, h) {
    // Floor
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1;
    for (var x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();
    }
    for (var y = 0; y < h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }

    // Top wall
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, w, 60);

    // Wall edge
    ctx.fillStyle = '#0f3460';
    ctx.fillRect(0, 56, w, 4);

    // Windows
    var windowW = 40;
    var windowH = 30;
    var gap = 120;
    var startX = (w % gap) / 2 + 30;
    for (var wx = startX; wx < w - windowW; wx += gap) {
      // Window frame
      ctx.fillStyle = '#1a1a3e';
      ctx.fillRect(wx, 10, windowW, windowH);
      // Glass
      var grd = ctx.createLinearGradient(wx, 10, wx, 10 + windowH);
      grd.addColorStop(0, '#1e3a5f');
      grd.addColorStop(1, '#0d1b2a');
      ctx.fillStyle = grd;
      ctx.fillRect(wx + 2, 12, windowW - 4, windowH - 4);
      // Star/light
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(wx + 12, 18, 2, 2);
      ctx.fillRect(wx + 26, 22, 2, 2);
    }
  }

  function drawDesk(ctx, x, y, isActive) {
    // Chair
    ctx.fillStyle = '#2a1a0e';
    ctx.fillRect(x - 8, y + DESK_HEIGHT + 30, 16, 4);
    ctx.fillRect(x + DESK_WIDTH - 8, y + DESK_HEIGHT + 30, 16, 4);
    ctx.fillStyle = '#3d2817';
    ctx.fillRect(x + 5, y + DESK_HEIGHT + 20, DESK_WIDTH - 10, 14);

    // Desk surface
    ctx.fillStyle = '#533e2d';
    ctx.fillRect(x, y, DESK_WIDTH, DESK_HEIGHT);
    // Desk edge highlight
    ctx.fillStyle = '#6b4e37';
    ctx.fillRect(x, y, DESK_WIDTH, 3);
    // Desk legs
    ctx.fillStyle = '#3d2817';
    ctx.fillRect(x + 2, y + DESK_HEIGHT, 4, 8);
    ctx.fillRect(x + DESK_WIDTH - 6, y + DESK_HEIGHT, 4, 8);

    // Monitor stand
    var monX = x + (DESK_WIDTH - MONITOR_W) / 2;
    var monY = y - MONITOR_H - 4;
    ctx.fillStyle = '#1f1f2e';
    ctx.fillRect(monX + MONITOR_W / 2 - 2, y - 4, 4, 4);

    // Monitor frame
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(monX, monY, MONITOR_W, MONITOR_H);

    // Monitor screen
    if (isActive) {
      ctx.fillStyle = '#22c55e';
      ctx.globalAlpha = 0.15;
      ctx.fillRect(monX - 3, monY - 3, MONITOR_W + 6, MONITOR_H + 6);
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = '#166534';
    } else {
      ctx.fillStyle = '#111827';
    }
    ctx.fillRect(monX + 2, monY + 2, MONITOR_W - 4, MONITOR_H - 4);

    // Keyboard on desk (if active)
    if (isActive) {
      ctx.fillStyle = '#374151';
      ctx.fillRect(x + DESK_WIDTH / 2 - 12, y + 10, 24, 8);
      ctx.fillStyle = '#4b5563';
      for (var ki = 0; ki < 5; ki++) {
        ctx.fillRect(x + DESK_WIDTH / 2 - 10 + ki * 5, y + 12, 3, 2);
      }
    }
  }

  function drawLabel(ctx, x, y, text, color) {
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = color || '#9ca3af';
    ctx.fillText(text, x + DESK_WIDTH / 2, y + DESK_HEIGHT + 52);
  }

  function drawBubble(ctx, x, y, text) {
    ctx.font = '10px sans-serif';
    var metrics = ctx.measureText(text);
    var pad = 6;
    var bw = metrics.width + pad * 2;
    var bh = 18;
    var bx = x + DESK_WIDTH / 2 - bw / 2;
    var by = y - MONITOR_H - 30;

    // Bubble background
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 4);
    ctx.fill();

    // Arrow
    var ax = x + DESK_WIDTH / 2;
    ctx.beginPath();
    ctx.moveTo(ax - 4, by + bh);
    ctx.lineTo(ax + 4, by + bh);
    ctx.lineTo(ax, by + bh + 5);
    ctx.closePath();
    ctx.fill();

    // Text
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'center';
    ctx.fillText(text, x + DESK_WIDTH / 2, by + 13);
  }

  function drawStatusDot(ctx, x, y, state) {
    var colors = {
      typing: '#22c55e',
      reading: '#3b82f6',
      waiting: '#eab308',
      idle: '#6b7280',
    };
    var cx = x + DESK_WIDTH / 2;
    var cy = y + DESK_HEIGHT + 58;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = colors[state] || colors.idle;
    ctx.fill();
  }

  return {
    drawBackground: drawBackground,
    drawDesk: drawDesk,
    drawLabel: drawLabel,
    drawBubble: drawBubble,
    drawStatusDot: drawStatusDot,
    getDeskPosition: getDeskPosition,
    DESK_WIDTH: DESK_WIDTH,
    DESK_HEIGHT: DESK_HEIGHT,
  };
})();


/* ── PixelOffice Main Controller ──────────────────────────── */

function PixelOffice(canvasId, initialAgents) {
  this.canvas = document.getElementById(canvasId);
  this.ctx = this.canvas.getContext('2d');
  this.agents = new Map();
  this.characters = new Map();
  this.eventSource = null;
  this.running = false;
  this._rafId = null;
  this._paletteCounter = 0;

  this._initCanvas();

  if (initialAgents && initialAgents.length) {
    this._updateAgents(initialAgents);
  }
}

PixelOffice.prototype._initCanvas = function () {
  var container = this.canvas.parentElement;
  var dpr = window.devicePixelRatio || 1;

  var resize = function () {
    var w = container.clientWidth;
    var h = container.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }.bind(this);

  resize();
  this._resizeHandler = resize;
  window.addEventListener('resize', resize);
};

PixelOffice.prototype.start = function () {
  this.running = true;
  this._connectSSE();
  this._startLoop();
};

PixelOffice.prototype.stop = function () {
  this.running = false;
  if (this.eventSource) {
    this.eventSource.close();
    this.eventSource = null;
  }
  if (this._rafId) {
    cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }
  if (this._resizeHandler) {
    window.removeEventListener('resize', this._resizeHandler);
    this._resizeHandler = null;
  }
};

PixelOffice.prototype.toggle = function () {
  if (this.running) {
    this.stop();
    var btn = document.getElementById('toggleBtn');
    if (btn) {
      btn.className = 'px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm text-white font-medium transition-colors';
      btn.innerHTML = '<span class="inline-block w-2 h-2 rounded-full bg-gray-400 mr-1.5"></span>일시정지';
    }
  } else {
    this.start();
    var btn2 = document.getElementById('toggleBtn');
    if (btn2) {
      btn2.className = 'px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm text-white font-medium transition-colors';
      btn2.innerHTML = '<span class="inline-block w-2 h-2 rounded-full bg-green-300 mr-1.5 animate-pulse"></span>실시간';
    }
  }
};

PixelOffice.prototype._connectSSE = function () {
  if (this.eventSource) {
    this.eventSource.close();
  }
  this.eventSource = new EventSource('/pixel-office/stream');
  var self = this;
  this.eventSource.onmessage = function (e) {
    try {
      var agents = JSON.parse(e.data);
      self._updateAgents(agents);
      self._updatePanel(agents);
    } catch (err) {
      // ignore parse errors
    }
  };
  this.eventSource.onerror = function () {
    // Reconnect handled automatically by EventSource
  };
};

PixelOffice.prototype._updateAgents = function (agentDataList) {
  var newAgents = new Map();
  for (var i = 0; i < agentDataList.length; i++) {
    var data = agentDataList[i];
    var existing = this.agents.get(data.agent_id);
    if (existing) {
      newAgents.set(data.agent_id, Object.assign({}, existing, {
        state: data.state,
        toolName: data.tool_name,
        toolStatus: data.tool_status,
        projectName: data.project_name,
        deskIndex: data.desk_index,
        model: data.model,
      }));
    } else {
      var paletteIdx = this._paletteCounter++;
      newAgents.set(data.agent_id, {
        id: data.agent_id,
        state: data.state,
        toolName: data.tool_name,
        toolStatus: data.tool_status,
        projectName: data.project_name,
        deskIndex: data.desk_index,
        model: data.model,
        character: CharacterFactory.create(paletteIdx),
        paletteIdx: paletteIdx,
      });
    }
  }
  this.agents = newAgents;

  // Update empty state
  var emptyEl = document.getElementById('emptyState');
  if (emptyEl) {
    emptyEl.classList.toggle('hidden', this.agents.size > 0);
  }
  var countEl = document.getElementById('agentCount');
  if (countEl) {
    countEl.textContent = this.agents.size + '명 활동 중';
  }
};

PixelOffice.prototype._updatePanel = function (agentDataList) {
  var panel = document.getElementById('agentPanel');
  if (!panel) return;

  var stateColors = {
    typing: 'bg-green-400',
    reading: 'bg-blue-400',
    waiting: 'bg-yellow-400',
    idle: 'bg-gray-500',
  };

  var html = '';
  for (var i = 0; i < agentDataList.length; i++) {
    var a = agentDataList[i];
    var dotClass = stateColors[a.state] || stateColors.idle;
    html += '<div class="bg-gray-800 rounded border border-gray-700 p-3 flex items-center gap-3">'
      + '<div class="w-2 h-2 rounded-full ' + dotClass + '"></div>'
      + '<div class="min-w-0">'
      + '<div class="text-sm text-white truncate">' + _escapeHtml(a.project_name) + '</div>'
      + '<div class="text-xs text-gray-400 truncate">' + _escapeHtml(a.tool_status || '대기 중') + '</div>'
      + '</div></div>';
  }
  panel.innerHTML = html;
};

PixelOffice.prototype._startLoop = function () {
  var self = this;
  var now = Date.now();

  function loop() {
    if (!self.running) return;
    now = Date.now();
    self._render(now);
    self._rafId = requestAnimationFrame(loop);
  }
  self._rafId = requestAnimationFrame(loop);
};

PixelOffice.prototype._render = function (now) {
  var ctx = this.ctx;
  var dpr = window.devicePixelRatio || 1;
  var w = this.canvas.width / dpr;
  var h = this.canvas.height / dpr;

  ctx.clearRect(0, 0, w, h);

  // Background
  OfficeRenderer.drawBackground(ctx, w, h);

  // Draw desks and characters
  var self = this;
  this.agents.forEach(function (agent) {
    var pos = OfficeRenderer.getDeskPosition(agent.deskIndex, w);
    var isActive = agent.state !== 'idle';

    // Desk
    OfficeRenderer.drawDesk(ctx, pos.x, pos.y, isActive);

    // Character (seated position)
    var charX = pos.x + (OfficeRenderer.DESK_WIDTH - SpriteEngine.CHAR_WIDTH) / 2;
    var charY = pos.y + OfficeRenderer.DESK_HEIGHT + 4;
    var frame = SpriteEngine.getFrame(agent.character, agent.state, now);
    SpriteEngine.drawSprite(ctx, frame, charX, charY);

    // Label: project name
    OfficeRenderer.drawLabel(ctx, pos.x, pos.y, agent.projectName, '#f97316');

    // Status dot
    OfficeRenderer.drawStatusDot(ctx, pos.x, pos.y, agent.state);

    // Speech bubble (tool status)
    if (agent.toolStatus && agent.state !== 'idle') {
      OfficeRenderer.drawBubble(ctx, pos.x, pos.y, agent.toolStatus);
    }
  });
};


/* ── Utilities ──────────────────────────────────────────────── */

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
