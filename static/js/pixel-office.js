/**
 * Pixel Office — Canvas 2D agent visualization
 *
 * Classes:
 *   CharacterFactory  — procedural 16x16 pixel art characters (idle/type/read/walk)
 *   SpriteEngine      — frame-based animation
 *   OfficeRenderer    — background, desks, labels, bubbles
 *   PixelOffice       — main controller (SSE + game loop + movement)
 *
 * Depends on: pixel-office-movement.js (TileGrid, CharacterMovement)
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

  // Walk frame 1 — left foot forward
  var WALK1_GRID = [
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
    '...PP..P....',
    '....P..PP...',
    '...KK...KK..',
    '...KK...KK..',
  ];

  // Walk frame 2 — legs together (passing)
  var WALK2_GRID = [
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
    '....PPPP....',
    '....P..P....',
    '....KK.KK...',
    '....KK.KK...',
  ];

  // Walk frame 3 — right foot forward
  var WALK3_GRID = [
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
    '....P..PP...',
    '...PP..P....',
    '..KK...KK...',
    '..KK...KK...',
  ];

  // Walk frame 4 — legs together (passing back)
  var WALK4_GRID = WALK2_GRID;

  function _lightenColor(hex, amount) {
    var num = parseInt(hex.replace('#', ''), 16);
    var r = Math.min(255, ((num >> 16) & 255) + amount);
    var g = Math.min(255, ((num >> 8) & 255) + amount);
    var b = Math.min(255, (num & 255) + amount);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function _buildAllFrames(pal) {
    return {
      idle: [_buildFrame(IDLE_GRID, pal)],
      typing: [_buildFrame(TYPE1_GRID, pal), _buildFrame(TYPE2_GRID, pal)],
      reading: [_buildFrame(READ1_GRID, pal), _buildFrame(READ2_GRID, pal)],
      waiting: [_buildFrame(IDLE_GRID, pal)],
      walking: [
        _buildFrame(WALK1_GRID, pal),
        _buildFrame(WALK2_GRID, pal),
        _buildFrame(WALK3_GRID, pal),
        _buildFrame(WALK4_GRID, pal),
      ],
    };
  }

  function create(paletteIndex) {
    var pal = PALETTES[paletteIndex % PALETTES.length];
    return { palette: pal, frames: _buildAllFrames(pal), isSubagent: false };
  }

  function createSubagent(parentPaletteIndex) {
    var base = PALETTES[parentPaletteIndex % PALETTES.length];
    var pal = {
      skin: base.skin,
      hair: base.hair,
      shirt: _lightenColor(base.shirt, 50),
      pants: _lightenColor(base.pants, 30),
    };
    return { palette: pal, frames: _buildAllFrames(pal), isSubagent: true };
  }

  return { create: create, createSubagent: createSubagent, PALETTES: PALETTES };
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

  var SUB_PIXEL_SIZE = 2;

  function drawSpriteScaled(ctx, frame, x, y, pxSize) {
    for (var r = 0; r < frame.length; r++) {
      for (var c = 0; c < frame[r].length; c++) {
        var color = frame[r][c];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x + c * pxSize, y + r * pxSize, pxSize, pxSize);
        }
      }
    }
  }

  return {
    drawSprite: drawSprite,
    drawSpriteScaled: drawSpriteScaled,
    getFrame: getFrame,
    PIXEL_SIZE: PIXEL_SIZE,
    SUB_PIXEL_SIZE: SUB_PIXEL_SIZE,
    CHAR_WIDTH: 12 * PIXEL_SIZE,
    CHAR_HEIGHT: 16 * PIXEL_SIZE,
    SUB_CHAR_WIDTH: 12 * SUB_PIXEL_SIZE,
    SUB_CHAR_HEIGHT: 16 * SUB_PIXEL_SIZE,
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

  function drawDesk(ctx, x, y, isActive, agentState, now) {
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

    // Monitor screen glow (active only)
    if (isActive) {
      var glowColors = { typing: '#22c55e', reading: '#3b82f6', waiting: '#eab308' };
      ctx.fillStyle = glowColors[agentState] || '#22c55e';
      ctx.globalAlpha = 0.12;
      ctx.fillRect(monX - 3, monY - 3, MONITOR_W + 6, MONITOR_H + 6);
      ctx.globalAlpha = 1.0;
    }

    // Animated monitor screen
    var screenX = monX + 2;
    var screenY = monY + 2;
    var screenW = MONITOR_W - 4;
    var screenH = MONITOR_H - 4;
    if (typeof MonitorEffects !== 'undefined' && now) {
      MonitorEffects.drawScreen(ctx, screenX, screenY, screenW, screenH, agentState || 'idle', now);
    } else {
      ctx.fillStyle = isActive ? '#166534' : '#111827';
      ctx.fillRect(screenX, screenY, screenW, screenH);
    }

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

  function drawBubble(ctx, x, y, text, state, alpha) {
    var effectiveAlpha = typeof alpha === 'number' ? alpha : 1.0;
    if (effectiveAlpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = effectiveAlpha;

    var bgColors = {
      waiting: 'rgba(254,240,138,',   // yellow
      typing: 'rgba(255,255,255,',     // white
      reading: 'rgba(255,255,255,',    // white
    };
    var bgBase = bgColors[state] || 'rgba(255,255,255,';

    // Determine display content
    var displayText = text;
    var isQuestionMark = (state === 'waiting');
    if (isQuestionMark) {
      displayText = '?';
      ctx.font = 'bold 12px sans-serif';
    } else {
      ctx.font = '10px sans-serif';
    }

    var metrics = ctx.measureText(displayText);
    var pad = 6;
    var bw = metrics.width + pad * 2;
    var bh = 18;
    var bx = x + DESK_WIDTH / 2 - bw / 2;
    var by = y - MONITOR_H - 30;

    // Bubble background
    ctx.fillStyle = bgBase + '0.92)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 4);
    ctx.fill();

    // Arrow
    var ax = x + DESK_WIDTH / 2;
    ctx.fillStyle = bgBase + '0.92)';
    ctx.beginPath();
    ctx.moveTo(ax - 4, by + bh);
    ctx.lineTo(ax + 4, by + bh);
    ctx.lineTo(ax, by + bh + 5);
    ctx.closePath();
    ctx.fill();

    // Text
    ctx.fillStyle = isQuestionMark ? '#92400e' : '#111827';
    ctx.textAlign = 'center';
    ctx.fillText(displayText, x + DESK_WIDTH / 2, by + 13);

    ctx.restore();
  }

  function drawHighlight(ctx, x, y, charW, charH) {
    ctx.save();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x - 2, y - 2, charW + 4, charH + 4);
    ctx.restore();
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
    drawHighlight: drawHighlight,
    getDeskPosition: getDeskPosition,
    DESK_WIDTH: DESK_WIDTH,
    DESK_HEIGHT: DESK_HEIGHT,
    MONITOR_W: MONITOR_W,
    MONITOR_H: MONITOR_H,
  };
})();


/* ── PixelOffice Main Controller ──────────────────────────── */

var BUBBLE_FADE_IN_MS = 300;
var BUBBLE_FADE_OUT_MS = 400;
var BUBBLE_HOLD_MS = 3000;

function PixelOffice(canvasId, initialAgents) {
  this.canvas = document.getElementById(canvasId);
  this.ctx = this.canvas.getContext('2d');
  this.agents = new Map();
  this.characters = new Map();
  this.eventSource = null;
  this.running = false;
  this._rafId = null;
  this._paletteCounter = 0;
  this._grid = null;
  this._fadingAgents = [];
  this._hoveredAgentId = null;
  this._bubbleTimers = new Map();

  this._initCanvas();
  this._initInteraction();

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

PixelOffice.prototype._initInteraction = function () {
  var self = this;

  this.canvas.addEventListener('mousemove', function (e) {
    var rect = self.canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    var hit = self._getCharacterAt(mx, my);
    self._hoveredAgentId = hit ? hit.id : null;
    self.canvas.style.cursor = hit ? 'pointer' : 'default';
  });

  this.canvas.addEventListener('mouseleave', function () {
    self._hoveredAgentId = null;
    self.canvas.style.cursor = 'default';
  });

  this.canvas.addEventListener('click', function (e) {
    var rect = self.canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    var hit = self._getCharacterAt(mx, my);
    if (hit) {
      window.location.href = '/sessions/' + encodeURIComponent(hit.sessionId);
    }
  });
};

PixelOffice.prototype._getCharacterAt = function (mx, my) {
  var charW = SpriteEngine.CHAR_WIDTH;
  var charH = SpriteEngine.CHAR_HEIGHT;
  var hitPad = 4;
  var result = null;

  this.agents.forEach(function (agent) {
    var mv = agent.movement;
    if (mx >= mv.x - hitPad && mx <= mv.x + charW + hitPad &&
        my >= mv.y - hitPad && my <= mv.y + charH + hitPad) {
      result = { id: agent.id, sessionId: agent.id };
    }
  });

  return result;
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
  this._hoveredAgentId = null;
  this.canvas.style.cursor = 'default';
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
  var dpr = window.devicePixelRatio || 1;
  var canvasW = this.canvas.width / dpr;
  var canvasH = this.canvas.height / dpr;
  var now = Date.now();

  var incomingIds = {};
  var newAgents = new Map();

  for (var i = 0; i < agentDataList.length; i++) {
    var data = agentDataList[i];
    incomingIds[data.agent_id] = true;
    var existing = this.agents.get(data.agent_id);

    if (existing) {
      var existingSub = data.is_subagent || false;
      var updatedSeat = this._getSeatPosition(data.desk_index, canvasW, existingSub);
      var mv = existing.movement;
      if (mv.seatX !== updatedSeat.x || mv.seatY !== updatedSeat.y) {
        mv = Object.assign({}, mv, { seatX: updatedSeat.x, seatY: updatedSeat.y });
      }
      // Reset bubble timer when tool status changes
      if (data.tool_status && data.tool_status !== existing.toolStatus) {
        this._bubbleTimers.set(data.agent_id, now);
      }
      newAgents.set(data.agent_id, Object.assign({}, existing, {
        state: data.state,
        toolName: data.tool_name,
        toolStatus: data.tool_status,
        projectName: data.project_name,
        deskIndex: data.desk_index,
        model: data.model || '',
        isSubagent: existingSub,
        lastActivityTs: data.last_activity_ts || '',
        movement: mv,
      }));
    } else {
      var paletteIdx = this._paletteCounter++;
      var isSub = data.is_subagent || false;
      var seatPos = this._getSeatPosition(data.desk_index, canvasW, isSub);
      if (data.tool_status) {
        this._bubbleTimers.set(data.agent_id, now);
      }
      var character = isSub
        ? CharacterFactory.createSubagent(paletteIdx)
        : CharacterFactory.create(paletteIdx);
      newAgents.set(data.agent_id, {
        id: data.agent_id,
        state: data.state,
        toolName: data.tool_name,
        toolStatus: data.tool_status,
        projectName: data.project_name,
        deskIndex: data.desk_index,
        model: data.model || '',
        isSubagent: isSub,
        lastActivityTs: data.last_activity_ts || '',
        character: character,
        paletteIdx: paletteIdx,
        movement: CharacterMovement.createMovementState(seatPos.x, seatPos.y, true),
      });
    }
  }

  // Detect departing agents and start fadeout
  var self = this;
  this.agents.forEach(function (agent, agentId) {
    if (!incomingIds[agentId] && !CharacterMovement.isFading(agent.movement)) {
      self._fadingAgents.push(Object.assign({}, agent, {
        movement: CharacterMovement.startFadeout(agent.movement, now),
      }));
    }
  });

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

PixelOffice.prototype._getSeatPosition = function (deskIndex, canvasW, isSubagent) {
  var pos = OfficeRenderer.getDeskPosition(deskIndex, canvasW);
  var charW = isSubagent ? SpriteEngine.SUB_CHAR_WIDTH : SpriteEngine.CHAR_WIDTH;
  var charH = isSubagent ? SpriteEngine.SUB_CHAR_HEIGHT : SpriteEngine.CHAR_HEIGHT;
  var yOffset = isSubagent ? (SpriteEngine.CHAR_HEIGHT - charH) : 0;
  return {
    x: pos.x + (OfficeRenderer.DESK_WIDTH - charW) / 2,
    y: pos.y + OfficeRenderer.DESK_HEIGHT + 4 + yOffset,
  };
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
    var modelLabel = _getModelLabel(a.model || '');
    var sessionUrl = '/sessions/' + encodeURIComponent(a.agent_id);
    var subBadge = a.is_subagent
      ? '<span class="text-[10px] bg-blue-900 text-blue-300 px-1 rounded ml-1">sub</span>'
      : '';

    html += '<a href="' + _escapeHtml(sessionUrl) + '" '
      + 'class="bg-gray-800 rounded border border-gray-700 p-3 flex items-center gap-3 hover:border-gray-500 hover:bg-gray-750 transition-colors cursor-pointer no-underline">'
      + '<div class="w-2 h-2 rounded-full flex-shrink-0 ' + dotClass + '"></div>'
      + '<div class="min-w-0 flex-1">'
      + '<div class="text-sm text-white truncate">' + _escapeHtml(a.project_name) + subBadge + '</div>'
      + '<div class="text-xs text-gray-400 truncate">' + _escapeHtml(a.tool_status || '대기 중') + '</div>'
      + '</div>'
      + '<div class="flex flex-col items-end flex-shrink-0 gap-0.5">'
      + '<span class="text-[10px] text-gray-500">' + _escapeHtml(modelLabel) + '</span>'
      + (a.last_activity_ts ? '<span class="text-[10px] text-gray-600">' + _escapeHtml(a.last_activity_ts) + '</span>' : '')
      + '</div>'
      + '</a>';
  }
  panel.innerHTML = html;
};

PixelOffice.prototype._getBubbleAlpha = function (agentId, now) {
  var startTime = this._bubbleTimers.get(agentId);
  if (!startTime) return 0;

  var elapsed = now - startTime;

  // Fade in
  if (elapsed < BUBBLE_FADE_IN_MS) {
    return elapsed / BUBBLE_FADE_IN_MS;
  }

  // Hold
  if (elapsed < BUBBLE_FADE_IN_MS + BUBBLE_HOLD_MS) {
    return 1.0;
  }

  // Fade out
  var fadeOutElapsed = elapsed - BUBBLE_FADE_IN_MS - BUBBLE_HOLD_MS;
  if (fadeOutElapsed < BUBBLE_FADE_OUT_MS) {
    return 1.0 - fadeOutElapsed / BUBBLE_FADE_OUT_MS;
  }

  // Cycle: restart
  this._bubbleTimers.set(agentId, now);
  return 0;
};

PixelOffice.prototype._startLoop = function () {
  var self = this;

  function loop() {
    if (!self.running) return;
    var now = Date.now();
    self._updateMovement(now);
    self._render(now);
    self._rafId = requestAnimationFrame(loop);
  }
  self._rafId = requestAnimationFrame(loop);
};

PixelOffice.prototype._buildGrid = function (canvasW, canvasH) {
  var grid = TileGrid.createGrid(canvasW, canvasH);
  var self = this;
  this.agents.forEach(function (agent) {
    var pos = OfficeRenderer.getDeskPosition(agent.deskIndex, canvasW);
    TileGrid.markDeskBlocked(grid, pos.x, pos.y);
  });
  return grid;
};

PixelOffice.prototype._updateMovement = function (now) {
  var dpr = window.devicePixelRatio || 1;
  var canvasW = this.canvas.width / dpr;
  var canvasH = this.canvas.height / dpr;
  var grid = this._buildGrid(canvasW, canvasH);
  this._grid = grid;

  var updatedAgents = new Map();
  this.agents.forEach(function (agent, id) {
    var mv = CharacterMovement.update(agent.movement, grid, agent.state, now, canvasW, canvasH);
    updatedAgents.set(id, Object.assign({}, agent, { movement: mv }));
  });
  this.agents = updatedAgents;

  // Update fading agents
  var activeFading = [];
  for (var i = 0; i < this._fadingAgents.length; i++) {
    var fa = this._fadingAgents[i];
    var updatedMv = CharacterMovement.update(fa.movement, grid, fa.state, now, canvasW, canvasH);
    var updated = Object.assign({}, fa, { movement: updatedMv });
    if (updated.movement.fadeAlpha > 0) {
      activeFading.push(updated);
    }
  }
  this._fadingAgents = activeFading;
};

PixelOffice.prototype._render = function (now) {
  var ctx = this.ctx;
  var dpr = window.devicePixelRatio || 1;
  var w = this.canvas.width / dpr;
  var h = this.canvas.height / dpr;

  ctx.clearRect(0, 0, w, h);

  // Background
  OfficeRenderer.drawBackground(ctx, w, h);

  // Office decorations (carpet, plants, coffee machine)
  if (typeof OfficeDecorations !== 'undefined') {
    OfficeDecorations.drawAll(ctx, w, h);
  }

  // Wall clock
  if (typeof WallClock !== 'undefined') {
    WallClock.draw(ctx, w / 2 - WallClock.CLOCK_SIZE / 2, 16, now);
  }

  // Draw all desks with animated monitors (background layer)
  this.agents.forEach(function (agent) {
    var pos = OfficeRenderer.getDeskPosition(agent.deskIndex, w);
    var isActive = agent.state !== 'idle';
    OfficeRenderer.drawDesk(ctx, pos.x, pos.y, isActive, agent.state, now);
  });

  // Collect all characters for depth-sorted rendering
  var renderList = [];
  this.agents.forEach(function (agent) {
    renderList.push({ agent: agent, alpha: 1.0 });
  });
  for (var fi = 0; fi < this._fadingAgents.length; fi++) {
    renderList.push({ agent: this._fadingAgents[fi], alpha: this._fadingAgents[fi].movement.fadeAlpha });
  }

  // Sort by Y position for correct depth ordering
  renderList.sort(function (a, b) {
    return a.agent.movement.y - b.agent.movement.y;
  });

  // Draw characters
  for (var ri = 0; ri < renderList.length; ri++) {
    var item = renderList[ri];
    var agent = item.agent;
    var mv = agent.movement;
    var walking = CharacterMovement.isWalking(mv);
    var spriteState = walking ? 'walking' : agent.state;
    var frame = SpriteEngine.getFrame(agent.character, spriteState, now);

    if (item.alpha < 1.0) {
      ctx.globalAlpha = item.alpha;
    }

    if (agent.isSubagent) {
      SpriteEngine.drawSpriteScaled(ctx, frame, mv.x, mv.y, SpriteEngine.SUB_PIXEL_SIZE);
    } else {
      SpriteEngine.drawSprite(ctx, frame, mv.x, mv.y);
    }

    if (item.alpha < 1.0) {
      ctx.globalAlpha = 1.0;
    }
  }

  // Draw labels, dots, bubbles, highlights on top (only for active agents, not fading)
  var self = this;
  this.agents.forEach(function (agent) {
    var pos = OfficeRenderer.getDeskPosition(agent.deskIndex, w);

    // Label: project name (with "(sub)" suffix for subagents)
    var labelText = agent.isSubagent ? agent.projectName + ' (sub)' : agent.projectName;
    var labelColor = agent.isSubagent ? '#60a5fa' : '#f97316';
    OfficeRenderer.drawLabel(ctx, pos.x, pos.y, labelText, labelColor);

    // Status dot
    OfficeRenderer.drawStatusDot(ctx, pos.x, pos.y, agent.state);

    // Hover highlight
    if (self._hoveredAgentId === agent.id) {
      var hlW = agent.isSubagent ? SpriteEngine.SUB_CHAR_WIDTH : SpriteEngine.CHAR_WIDTH;
      var hlH = agent.isSubagent ? SpriteEngine.SUB_CHAR_HEIGHT : SpriteEngine.CHAR_HEIGHT;
      OfficeRenderer.drawHighlight(ctx, agent.movement.x, agent.movement.y, hlW, hlH);
    }

    // Speech bubble -- only when seated and active
    if (agent.state !== 'idle' && CharacterMovement.isSeated(agent.movement)) {
      var bubbleText = agent.toolStatus || '';
      var bubbleAlpha = self._getBubbleAlpha(agent.id, now);
      if (bubbleText && bubbleAlpha > 0) {
        OfficeRenderer.drawBubble(ctx, pos.x, pos.y, bubbleText, agent.state, bubbleAlpha);
      }
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

function _getModelLabel(modelId) {
  if (!modelId) return '';
  if (modelId.indexOf('opus') !== -1) return 'Opus';
  if (modelId.indexOf('sonnet') !== -1) return 'Sonnet';
  if (modelId.indexOf('haiku') !== -1) return 'Haiku';
  return modelId.split('-').slice(0, 2).join(' ');
}
