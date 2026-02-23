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
  // 6 diverse palettes — vibrant, lively colors
  var PALETTES = [
    { skin: '#ffe0c2', hair: '#5a3a28', shirt: '#4a9ff5', pants: '#2a4a7a' },
    { skin: '#f0c8a0', hair: '#1a1a1a', shirt: '#f06060', pants: '#404858' },
    { skin: '#fff0d8', hair: '#d4944a', shirt: '#30c090', pants: '#2a3848' },
    { skin: '#deb888', hair: '#3a2218', shirt: '#b870f0', pants: '#3a3878' },
    { skin: '#ffe8c8', hair: '#a07820', shirt: '#f89030', pants: '#504840' },
    { skin: '#d4944a', hair: '#0a0a0a', shirt: '#20c8e0', pants: '#1a5850' },
  ];

  // Color helper: lighten a hex color by fraction (0..1)
  function _lighten(hex, frac) {
    var num = parseInt(hex.replace('#', ''), 16);
    var r = (num >> 16) & 255;
    var g = (num >> 8) & 255;
    var b = num & 255;
    r = Math.min(255, Math.round(r + (255 - r) * frac));
    g = Math.min(255, Math.round(g + (255 - g) * frac));
    b = Math.min(255, Math.round(b + (255 - b) * frac));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Color helper: darken a hex color by fraction (0..1)
  function _darken(hex, frac) {
    var num = parseInt(hex.replace('#', ''), 16);
    var r = (num >> 16) & 255;
    var g = (num >> 8) & 255;
    var b = num & 255;
    r = Math.round(r * (1 - frac));
    g = Math.round(g * (1 - frac));
    b = Math.round(b * (1 - frac));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // 12x16 grid per frame.  null = transparent.
  // Legend:
  //   S=skin  H=hair  h=hair highlight  E=eye(pupil)
  //   W=white(eye sclera/highlight)  B=blush  M=mouth
  //   C=shirt  c=collar(light shirt)  D=dark shirt shadow
  //   P=pants  K=shoe
  function _buildFrame(grid, palette) {
    var map = {
      S: palette.skin,
      H: palette.hair,
      h: _lighten(palette.hair, 0.35),
      E: '#1a1a1a',
      W: '#ffffff',
      B: '#ffb0b0',
      M: '#d09080',
      C: palette.shirt,
      c: _lighten(palette.shirt, 0.3),
      D: _darken(palette.shirt, 0.2),
      P: palette.pants,
      K: '#2a2a2a',
    };
    return grid.map(function (row) {
      return row.split('').map(function (ch) {
        return map[ch] || null;
      });
    });
  }

  // ── Idle — cute SD standing pose ──────────────────────────
  // Big head (rows 0-7), small body (rows 8-15)
  // 2.5-head proportion: 8 rows head, 8 rows body
  // Eyes: 2-wide WE pairs with blush cheeks
  var IDLE_GRID = [
    '...HhHHhH...',  // row 0:  hair crown with highlights
    '..HHhHHHhH..',  // row 1:  hair wide
    '..HHHHHHHH..',  // row 2:  hair forehead
    '..HSSSSSSH..',  // row 3:  skin under bangs
    '..SWESSWES..',  // row 4:  eyes (W=sclera, E=pupil)
    '..BSSSSSSB..',  // row 5:  blush cheeks
    '...SS..SS...',  // row 6:  nose gap + mouth area
    '....SMMS....',  // row 7:  small mouth, chin
    '....cccC....',  // row 8:  collar
    '...DCCCCD...',  // row 9:  shirt body with shadow
    '..SDCCCDS...',  // row 10: arms (skin) + shirt
    '..S.CCCC.S..',  // row 11: hands at sides
    '....PPPP....',  // row 12: pants
    '....P..P....',  // row 13: legs
    '...KK..KK...',  // row 14: shoes
    '............',  // row 15: (empty)
  ];

  // ── Typing frame 1 — arms forward on keyboard ────────────
  var TYPE1_GRID = [
    '...HhHHhH...',
    '..HHhHHHhH..',
    '..HHHHHHHH..',
    '..HSSSSSSH..',
    '..SWESSWES..',
    '..BSSSSSSB..',
    '...SS..SS...',
    '....SMMS....',
    '....cccC....',
    '...DCCCCD...',
    '..SDCCCDS...',
    '...SCCCS....',
    '..S.PPPP.S..',  // hands reaching forward
    '....P..P....',
    '...KK..KK...',
    '............',
  ];

  // ── Typing frame 2 — hands shifted (finger wiggle) ───────
  var TYPE2_GRID = [
    '...HhHHhH...',
    '..HHhHHHhH..',
    '..HHHHHHHH..',
    '..HSSSSSSH..',
    '..SWESSWES..',
    '..BSSSSSSB..',
    '...SS..SS...',
    '....SMMS....',
    '....cccC....',
    '...DCCCCD...',
    '..SDCCCDS...',
    '...SCCCS....',
    '.S..PPPP..S.',  // hands wider apart
    '....P..P....',
    '...KK..KK...',
    '............',
  ];

  // ── Reading frame 1 — eyes looking left ───────────────────
  var READ1_GRID = [
    '...HhHHhH...',
    '..HHhHHHhH..',
    '..HHHHHHHH..',
    '..HSSSSSSH..',
    '..EWSSEEWS..',  // pupils shifted left
    '..BSSSSSSB..',
    '...SS..SS...',
    '....SMMS....',
    '....cccC....',
    '...DCCCCD...',
    '..SDCCCDS...',
    '..S.CCCC.S..',
    '....PPPP....',
    '....P..P....',
    '...KK..KK...',
    '............',
  ];

  // ── Reading frame 2 — eyes looking right ──────────────────
  var READ2_GRID = [
    '...HhHHhH...',
    '..HHhHHHhH..',
    '..HHHHHHHH..',
    '..HSSSSSSH..',
    '..SWEBSWEW..',  // pupils shifted right + highlight dot
    '..BSSSSSSB..',
    '...SS..SS...',
    '....SMMS....',
    '....cccC....',
    '...DCCCCD...',
    '..SDCCCDS...',
    '..S.CCCC.S..',
    '....PPPP....',
    '....P..P....',
    '...KK..KK...',
    '............',
  ];

  // ── Walk frame 1 — left foot forward, right arm forward ──
  var WALK1_GRID = [
    '...HhHHhH...',
    '..HHhHHHhH..',
    '..HHHHHHHH..',
    '..HSSSSSSH..',
    '..SWESSWES..',
    '..BSSSSSSB..',
    '...SS..SS...',
    '....SMMS....',
    '....cccC....',
    '...DCCCCD...',
    '.S.DCCCDS...',  // right arm forward
    '...SCCCC.S..',
    '....PPPP....',
    '...PP..P....',
    '..KK...KK...',
    '............',
  ];

  // ── Walk frame 2 — legs together (passing) ────────────────
  var WALK2_GRID = [
    '...HhHHhH...',
    '..HHhHHHhH..',
    '..HHHHHHHH..',
    '..HSSSSSSH..',
    '..SWESSWES..',
    '..BSSSSSSB..',
    '...SS..SS...',
    '....SMMS....',
    '....cccC....',
    '...DCCCCD...',
    '..SDCCCDS...',
    '..S.CCCC.S..',
    '....PPPP....',
    '....PPPP....',
    '...KK..KK...',
    '............',
  ];

  // ── Walk frame 3 — right foot forward, left arm forward ──
  var WALK3_GRID = [
    '...HhHHhH...',
    '..HHhHHHhH..',
    '..HHHHHHHH..',
    '..HSSSSSSH..',
    '..SWESSWES..',
    '..BSSSSSSB..',
    '...SS..SS...',
    '....SMMS....',
    '....cccC....',
    '...DCCCCD...',
    '..SDCCCD.S..',  // left arm forward
    '..S.CCCCS...',
    '....PPPP....',
    '....P..PP...',
    '..KK...KK...',
    '............',
  ];

  // Walk frame 4 — legs together (passing back)
  var WALK4_GRID = WALK2_GRID;

  // ── Waiting — sleepy face (half-closed eyes) ──────────────
  var WAIT_GRID = [
    '...HhHHhH...',
    '..HHhHHHhH..',
    '..HHHHHHHH..',
    '..HSSSSSSH..',
    '..SEESSEES..',  // squinting eyes — no white sclera
    '..BSSSSSSB..',
    '...SS..SS...',
    '....SMMS....',
    '....cccC....',
    '...DCCCCD...',
    '..SDCCCDS...',
    '..S.CCCC.S..',
    '....PPPP....',
    '....P..P....',
    '...KK..KK...',
    '............',
  ];

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
      waiting: [_buildFrame(WAIT_GRID, pal)],
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
  var PIXEL_SIZE = 4;
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

  var SUB_PIXEL_SIZE = 3;

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
  var DESK_WIDTH = 90;
  var DESK_HEIGHT = 42;
  var DESK_SPACING_X = 175;
  var DESK_SPACING_Y = 155;
  var DESK_START_X = 90;
  var DESK_START_Y = 100;
  var MONITOR_W = 28;
  var MONITOR_H = 20;

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
    // Warm wooden floor base
    ctx.fillStyle = '#d4b896';
    ctx.fillRect(0, 0, w, h);

    // Wooden plank pattern — alternating tones
    var plankH = 16;
    var plankColors = ['#d4b896', '#c9ad88', '#d0b48f', '#c4a882'];
    for (var py = 60; py < h; py += plankH) {
      var ci = Math.floor(py / plankH) % plankColors.length;
      ctx.fillStyle = plankColors[ci];
      ctx.fillRect(0, py, w, plankH);
    }

    // Plank separation lines (subtle horizontal)
    ctx.strokeStyle = '#b89b76';
    ctx.lineWidth = 1;
    for (var gy = 60 + plankH; gy < h; gy += plankH) {
      ctx.beginPath();
      ctx.moveTo(0, gy + 0.5);
      ctx.lineTo(w, gy + 0.5);
      ctx.stroke();
    }

    // Vertical plank joints (staggered)
    ctx.strokeStyle = '#c4a07a';
    ctx.lineWidth = 1;
    var jointSpacing = 64;
    for (var jy = 60; jy < h; jy += plankH) {
      var rowOffset = (Math.floor(jy / plankH) % 2 === 0) ? 0 : jointSpacing / 2;
      for (var jx = rowOffset; jx < w; jx += jointSpacing) {
        ctx.beginPath();
        ctx.moveTo(jx + 0.5, jy);
        ctx.lineTo(jx + 0.5, jy + plankH);
        ctx.stroke();
      }
    }

    // Cream-colored top wall
    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(0, 0, w, 56);

    // Subtle wall texture — very faint horizontal lines
    ctx.strokeStyle = '#ede6db';
    ctx.lineWidth = 1;
    for (var wy = 4; wy < 56; wy += 8) {
      ctx.beginPath();
      ctx.moveTo(0, wy + 0.5);
      ctx.lineTo(w, wy + 0.5);
      ctx.stroke();
    }

    // Wall-floor molding (wooden trim)
    ctx.fillStyle = '#b8956e';
    ctx.fillRect(0, 52, w, 4);
    ctx.fillStyle = '#c9a87c';
    ctx.fillRect(0, 52, w, 2);
    // Molding shadow
    ctx.fillStyle = '#a38260';
    ctx.fillRect(0, 56, w, 2);

    // Baseboard below molding
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(0, 58, w, 2);

    // Windows — bright sky with curtains
    var windowW = 44;
    var windowH = 32;
    var gap = 120;
    var startX = (w % gap) / 2 + 30;
    for (var wx = startX; wx < w - windowW; wx += gap) {
      // Window frame (light wood)
      ctx.fillStyle = '#c9a87c';
      ctx.fillRect(wx - 2, 8, windowW + 4, windowH + 4);
      ctx.fillStyle = '#b8956e';
      ctx.fillRect(wx - 1, 9, windowW + 2, windowH + 2);

      // Glass — bright sky gradient
      var skyGrd = ctx.createLinearGradient(wx, 10, wx, 10 + windowH);
      skyGrd.addColorStop(0, '#87ceeb');
      skyGrd.addColorStop(0.5, '#b0e0f0');
      skyGrd.addColorStop(1, '#e0f4ff');
      ctx.fillStyle = skyGrd;
      ctx.fillRect(wx, 10, windowW, windowH);

      // Window cross bar (wooden)
      ctx.fillStyle = '#c9a87c';
      ctx.fillRect(wx + windowW / 2 - 1, 10, 2, windowH);
      ctx.fillRect(wx, 10 + windowH / 2 - 1, windowW, 2);

      // Sunlight glow effect
      ctx.fillStyle = '#fffde0';
      ctx.globalAlpha = 0.25;
      ctx.fillRect(wx + 2, 12, windowW / 2 - 3, windowH / 2 - 3);
      ctx.globalAlpha = 0.12;
      ctx.fillRect(wx + windowW / 2 + 1, 12, windowW / 2 - 3, windowH - 4);
      ctx.globalAlpha = 1.0;

      // Small cloud pixels
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.6;
      ctx.fillRect(wx + 6, 15, 6, 2);
      ctx.fillRect(wx + 8, 13, 4, 2);
      ctx.fillRect(wx + windowW - 14, 20, 5, 2);
      ctx.fillRect(wx + windowW - 12, 18, 3, 2);
      ctx.globalAlpha = 1.0;

      // Curtain — left (short)
      ctx.fillStyle = '#f0e6d6';
      ctx.fillRect(wx - 1, 10, 5, windowH + 1);
      ctx.fillStyle = '#e8dcc8';
      ctx.fillRect(wx + 1, 10, 2, windowH + 1);

      // Curtain — right (short)
      ctx.fillStyle = '#f0e6d6';
      ctx.fillRect(wx + windowW - 4, 10, 5, windowH + 1);
      ctx.fillStyle = '#e8dcc8';
      ctx.fillRect(wx + windowW - 2, 10, 2, windowH + 1);

      // Curtain rod
      ctx.fillStyle = '#8b7355';
      ctx.fillRect(wx - 4, 8, windowW + 8, 2);
      // Rod knobs
      ctx.fillRect(wx - 5, 7, 3, 4);
      ctx.fillRect(wx + windowW + 2, 7, 3, 4);
    }

    // Warm ambient light on floor from windows
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#fff9e0';
    for (var lx = startX; lx < w - windowW; lx += gap) {
      ctx.fillRect(lx - 10, 58, windowW + 20, 40);
    }
    ctx.globalAlpha = 1.0;
  }

  function drawDesk(ctx, x, y, isActive, agentState, now) {
    // ── Chair (ergonomic office chair) ──
    // Chair legs (star base)
    ctx.fillStyle = '#888888';
    ctx.fillRect(x + 18, y + DESK_HEIGHT + 44, 3, 5);
    ctx.fillRect(x + DESK_WIDTH - 21, y + DESK_HEIGHT + 44, 3, 5);
    ctx.fillRect(x + DESK_WIDTH / 2 - 1, y + DESK_HEIGHT + 44, 3, 5);
    // Wheels
    ctx.fillStyle = '#555555';
    ctx.fillRect(x + 17, y + DESK_HEIGHT + 48, 5, 3);
    ctx.fillRect(x + DESK_WIDTH - 22, y + DESK_HEIGHT + 48, 5, 3);
    ctx.fillRect(x + DESK_WIDTH / 2 - 2, y + DESK_HEIGHT + 48, 5, 3);
    // Chair stem (pneumatic lift)
    ctx.fillStyle = '#999999';
    ctx.fillRect(x + DESK_WIDTH / 2 - 1, y + DESK_HEIGHT + 36, 3, 9);
    // Seat cushion
    var chairColor = isActive ? '#4a90d9' : '#6b8cae';
    ctx.fillStyle = chairColor;
    ctx.fillRect(x + 10, y + DESK_HEIGHT + 28, DESK_WIDTH - 20, 10);
    // Seat highlight
    ctx.fillStyle = isActive ? '#5aa0e9' : '#7b9cbe';
    ctx.fillRect(x + 10, y + DESK_HEIGHT + 28, DESK_WIDTH - 20, 3);
    // Backrest
    ctx.fillStyle = chairColor;
    ctx.fillRect(x + 16, y + DESK_HEIGHT + 18, DESK_WIDTH - 32, 12);
    // Backrest highlight
    ctx.fillStyle = isActive ? '#5aa0e9' : '#7b9cbe';
    ctx.fillRect(x + 16, y + DESK_HEIGHT + 18, DESK_WIDTH - 32, 3);
    // Armrests
    ctx.fillStyle = '#888888';
    ctx.fillRect(x + 8, y + DESK_HEIGHT + 26, 5, 4);
    ctx.fillRect(x + DESK_WIDTH - 13, y + DESK_HEIGHT + 26, 5, 4);

    // ── Desk ──
    // Desk legs (tapered modern style)
    ctx.fillStyle = '#a38260';
    ctx.fillRect(x + 5, y + DESK_HEIGHT, 4, 13);
    ctx.fillRect(x + DESK_WIDTH - 9, y + DESK_HEIGHT, 4, 13);
    // Leg feet
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(x + 4, y + DESK_HEIGHT + 12, 6, 3);
    ctx.fillRect(x + DESK_WIDTH - 10, y + DESK_HEIGHT + 12, 6, 3);

    // Desk surface (warm light wood)
    ctx.fillStyle = '#c9a87c';
    ctx.fillRect(x, y, DESK_WIDTH, DESK_HEIGHT);
    // Desktop wood grain hint
    ctx.fillStyle = '#c0a074';
    ctx.fillRect(x + 10, y + 8, 26, 1);
    ctx.fillRect(x + 46, y + 16, 24, 1);
    ctx.fillRect(x + 16, y + 26, 33, 1);
    // Desk front edge (rounded feel)
    ctx.fillStyle = '#d4b48f';
    ctx.fillRect(x, y, DESK_WIDTH, 4);
    // Desk bottom edge shadow
    ctx.fillStyle = '#b8956e';
    ctx.fillRect(x, y + DESK_HEIGHT - 3, DESK_WIDTH, 3);

    // ── Monitor ──
    var monX = x + (DESK_WIDTH - MONITOR_W) / 2;
    var monY = y - MONITOR_H - 8;
    // Monitor stand arm
    ctx.fillStyle = '#555555';
    ctx.fillRect(monX + MONITOR_W / 2 - 1, y - 8, 3, 8);
    // Monitor stand base
    ctx.fillStyle = '#666666';
    ctx.fillRect(monX + MONITOR_W / 2 - 7, y - 3, 14, 3);
    ctx.fillStyle = '#777777';
    ctx.fillRect(monX + MONITOR_W / 2 - 5, y - 3, 10, 1);

    // Monitor bezel (thin, dark)
    ctx.fillStyle = '#333333';
    ctx.fillRect(monX, monY, MONITOR_W, MONITOR_H);
    // Inner bezel highlight
    ctx.fillStyle = '#444444';
    ctx.fillRect(monX, monY, MONITOR_W, 1);

    // Monitor screen glow (active only)
    if (isActive) {
      var glowColors = { typing: '#22c55e', reading: '#3b82f6', waiting: '#eab308' };
      ctx.fillStyle = glowColors[agentState] || '#22c55e';
      ctx.globalAlpha = 0.10;
      ctx.fillRect(monX - 4, monY - 4, MONITOR_W + 8, MONITOR_H + 8);
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

    // ── Keyboard (always visible for equipped desks) ──
    // Keyboard body
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(x + DESK_WIDTH / 2 - 17, y + 13, 34, 12);
    // Keyboard border
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(x + DESK_WIDTH / 2 - 17, y + 13, 34, 1);
    ctx.fillRect(x + DESK_WIDTH / 2 - 17, y + 24, 34, 1);
    // Key rows
    ctx.fillStyle = '#f9fafb';
    for (var ki = 0; ki < 7; ki++) {
      ctx.fillRect(x + DESK_WIDTH / 2 - 14 + ki * 5, y + 16, 3, 2);
    }
    for (var ki2 = 0; ki2 < 6; ki2++) {
      ctx.fillRect(x + DESK_WIDTH / 2 - 12 + ki2 * 5, y + 20, 3, 2);
    }

    // ── Mouse (small, right side of keyboard) ──
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(x + DESK_WIDTH / 2 + 21, y + 16, 7, 8);
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(x + DESK_WIDTH / 2 + 22, y + 16, 2, 4);
  }

  function drawLabel(ctx, x, y, text, color) {
    var cx = x + DESK_WIDTH / 2;
    var cy = y + DESK_HEIGHT + 74;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';

    // Measure text for badge background
    var metrics = ctx.measureText(text);
    var padX = 7;
    var padY = 3;
    var badgeW = metrics.width + padX * 2;
    var badgeH = 13 + padY * 2;
    var badgeX = cx - badgeW / 2;
    var badgeY = cy - 13 + 1 - padY;

    // Rounded rectangle badge background
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
    ctx.stroke();

    // Text
    ctx.fillStyle = color || '#4b5563';
    ctx.fillText(text, cx, cy);
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
    var by = y - MONITOR_H - 38;

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
    var cy = y + DESK_HEIGHT + 84;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = colors[state] || colors.idle;
    ctx.fill();
  }

  function drawPartition(ctx, x, y, width, height, teamName) {
    ctx.fillStyle = 'rgba(230, 240, 255, 0.15)';
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    ctx.setLineDash([]);

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'left';
    ctx.fillText('\u26A1 ' + teamName, x + 8, y + 14);
  }

  return {
    drawBackground: drawBackground,
    drawDesk: drawDesk,
    drawLabel: drawLabel,
    drawBubble: drawBubble,
    drawStatusDot: drawStatusDot,
    drawHighlight: drawHighlight,
    drawPartition: drawPartition,
    getDeskPosition: getDeskPosition,
    getColumns: getColumns,
    DESK_WIDTH: DESK_WIDTH,
    DESK_HEIGHT: DESK_HEIGHT,
    DESK_SPACING_X: DESK_SPACING_X,
    DESK_SPACING_Y: DESK_SPACING_Y,
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
        isLead: data.is_lead || false,
        role: data.role || '',
        lastActivityTs: data.last_activity_ts || '',
        teamName: data.team_name || '',
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
        isLead: data.is_lead || false,
        role: data.role || '',
        lastActivityTs: data.last_activity_ts || '',
        teamName: data.team_name || '',
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
    var teamBadge = a.team_name
      ? '<span class="text-[10px] bg-indigo-900 text-indigo-300 px-1 rounded ml-1">' + _escapeHtml(a.team_name) + '</span>'
      : '';

    html += '<a href="' + _escapeHtml(sessionUrl) + '" '
      + 'class="bg-gray-800 rounded border border-gray-700 p-3 flex items-center gap-3 hover:border-gray-500 hover:bg-gray-750 transition-colors cursor-pointer no-underline">'
      + '<div class="w-2 h-2 rounded-full flex-shrink-0 ' + dotClass + '"></div>'
      + '<div class="min-w-0 flex-1">'
      + '<div class="text-sm text-white truncate">' + _escapeHtml(a.project_name) + subBadge + teamBadge + '</div>'
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

PixelOffice.prototype._drawTeamPartitions = function (ctx, canvasW, canvasH) {
  // Group agents by team_name
  var teams = {};
  this.agents.forEach(function (agent) {
    if (!agent.teamName) return;
    if (!teams[agent.teamName]) {
      teams[agent.teamName] = [];
    }
    teams[agent.teamName].push(agent.deskIndex);
  });

  var teamNames = Object.keys(teams);
  if (teamNames.length === 0) return;

  for (var i = 0; i < teamNames.length; i++) {
    var teamName = teamNames[i];
    var indices = teams[teamName];
    indices.sort(function (a, b) { return a - b; });

    // Calculate bounding box around all team desks
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var j = 0; j < indices.length; j++) {
      var pos = OfficeRenderer.getDeskPosition(indices[j], canvasW);
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      var right = pos.x + OfficeRenderer.DESK_WIDTH;
      var bottom = pos.y + OfficeRenderer.DESK_SPACING_Y;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }

    // Add padding around the bounding box
    var pad = 20;
    var partX = minX - pad;
    var partY = minY - OfficeRenderer.MONITOR_H - 10 - pad;
    var partW = maxX - minX + pad * 2;
    var partH = maxY - minY + OfficeRenderer.MONITOR_H + 10 + pad;

    OfficeRenderer.drawPartition(ctx, partX, partY, partW, partH, teamName);
  }
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

  // Draw team partitions (behind desks)
  this._drawTeamPartitions(ctx, w, h);

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

    // Label: role name for team members, project name for solo agents
    var labelText = agent.role || agent.projectName;
    var labelColor = agent.isLead ? '#b45309' : (agent.role ? '#1d4ed8' : '#c2410c');
    OfficeRenderer.drawLabel(ctx, pos.x, pos.y, labelText, labelColor);

    // Lead badge — star placed left of the label badge
    if (agent.isLead) {
      ctx.font = 'bold 13px monospace';
      var labelMetrics = ctx.measureText(labelText);
      var starX = pos.x + OfficeRenderer.DESK_WIDTH / 2 - labelMetrics.width / 2 - 16;
      var starY = pos.y + OfficeRenderer.DESK_HEIGHT + 80;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('\u2605', starX, starY);
    }

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
