/**
 * Pixel Office Decorations — furniture, plants, wall clock, animated monitors
 *
 * Modules:
 *   OfficeDecorations  — static props (plants, coffee machine, carpet)
 *   WallClock          — pixel art clock showing real time
 *   MonitorEffects     — per-state animated monitor screens
 */

/* ── Office Decorations ──────────────────────────────────── */

var OfficeDecorations = (function () {

  // ── Round-leaf plant (monstera style) ──
  function drawPlant(ctx, x, y) {
    // Ceramic pot (white/cream)
    ctx.fillStyle = '#f0e6d6';
    ctx.fillRect(x + 1, y + 16, 16, 13);
    ctx.fillStyle = '#e8dcc8';
    ctx.fillRect(x, y + 13, 18, 4);
    // Pot rim highlight
    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(x, y + 13, 18, 1);

    // Soil
    ctx.fillStyle = '#6b4e37';
    ctx.fillRect(x + 3, y + 13, 13, 3);

    // Leaves — bright green monstera
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(x + 7, y - 1, 5, 5);
    ctx.fillRect(x + 4, y + 3, 11, 4);
    ctx.fillRect(x + 1, y + 5, 16, 5);
    // Lighter leaf accents
    ctx.fillStyle = '#86efac';
    ctx.fillRect(x + 7, y, 5, 3);
    ctx.fillRect(x + 5, y + 4, 8, 3);
    // Leaf vein
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(x + 8, y + 1, 3, 9);

    // Stem
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(x + 8, y + 10, 3, 4);
  }

  // ── Cactus plant (small desk cactus) ──
  function drawCactus(ctx, x, y) {
    // Small terracotta pot
    ctx.fillStyle = '#d4836b';
    ctx.fillRect(x + 3, y + 13, 13, 11);
    ctx.fillStyle = '#e09a82';
    ctx.fillRect(x + 1, y + 11, 16, 4);
    ctx.fillStyle = '#eab09c';
    ctx.fillRect(x + 1, y + 11, 16, 1);

    // Soil
    ctx.fillStyle = '#8b6e5a';
    ctx.fillRect(x + 4, y + 11, 11, 3);

    // Cactus body
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(x + 5, y, 8, 12);
    // Cactus highlight
    ctx.fillStyle = '#86efac';
    ctx.fillRect(x + 7, y + 1, 3, 9);
    // Cactus arms
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(x + 3, y + 3, 3, 5);
    ctx.fillRect(x + 13, y + 4, 3, 4);
    // Spines (tiny dots)
    ctx.fillStyle = '#f0fdf4';
    ctx.fillRect(x + 5, y + 3, 1, 1);
    ctx.fillRect(x + 12, y + 5, 1, 1);
    ctx.fillRect(x + 8, y + 8, 1, 1);
    // Little flower on top
    ctx.fillStyle = '#fb7185';
    ctx.fillRect(x + 7, y - 3, 5, 3);
    ctx.fillStyle = '#fda4af';
    ctx.fillRect(x + 8, y - 3, 3, 1);
  }

  // ── Coffee machine (modern) ──
  function drawCoffeeMachine(ctx, x, y) {
    // Body (sleek silver)
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(x, y, 26, 37);
    // Top highlight
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(x + 1, y + 1, 24, 3);

    // Water tank (top, translucent blue)
    ctx.fillStyle = '#93c5fd';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x + 4, y + 5, 18, 11);
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#60a5fa';
    ctx.globalAlpha = 0.4;
    ctx.fillRect(x + 4, y + 11, 18, 5);
    ctx.globalAlpha = 1.0;

    // Drip area (dark recess)
    ctx.fillStyle = '#374151';
    ctx.fillRect(x + 5, y + 18, 16, 11);

    // Cup (cute coffee mug)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 8, y + 24, 10, 5);
    // Coffee surface
    ctx.fillStyle = '#92400e';
    ctx.fillRect(x + 9, y + 24, 8, 3);
    // Mug handle
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 18, y + 25, 3, 3);

    // Base
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(x - 1, y + 32, 28, 5);

    // Power light
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(x + 21, y + 8, 3, 3);

    // Button
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(x + 21, y + 13, 3, 3);
  }

  // ── Carpet (warm woven rug) ──
  function drawCarpet(ctx, x, y, w, h) {
    // Main rug body (warm cream)
    ctx.fillStyle = '#f5e6d3';
    ctx.fillRect(x, y, w, h);

    // Border (warm accent)
    ctx.fillStyle = '#d4956b';
    ctx.fillRect(x, y, w, 4);
    ctx.fillRect(x, y + h - 4, w, 4);
    ctx.fillRect(x, y, 4, h);
    ctx.fillRect(x + w - 4, y, 4, h);

    // Inner border
    ctx.fillStyle = '#e8c4a8';
    ctx.fillRect(x + 4, y + 4, w - 8, 1);
    ctx.fillRect(x + 4, y + h - 5, w - 8, 1);
    ctx.fillRect(x + 4, y + 4, 1, h - 8);
    ctx.fillRect(x + w - 5, y + 4, 1, h - 8);

    // Woven diamond pattern
    ctx.fillStyle = '#e8c4a8';
    ctx.globalAlpha = 0.4;
    for (var px = x + 13; px < x + w - 8; px += 21) {
      for (var py2 = y + 11; py2 < y + h - 8; py2 += 16) {
        // Diamond shape
        ctx.fillRect(px + 3, py2, 5, 1);
        ctx.fillRect(px + 1, py2 + 1, 8, 1);
        ctx.fillRect(px, py2 + 2, 10, 2);
        ctx.fillRect(px + 1, py2 + 4, 8, 1);
        ctx.fillRect(px + 3, py2 + 5, 5, 1);
      }
    }
    ctx.globalAlpha = 1.0;

    // Fringe on short edges
    ctx.fillStyle = '#d4956b';
    for (var fx = x + 5; fx < x + w - 3; fx += 5) {
      ctx.fillRect(fx, y - 3, 3, 3);
      ctx.fillRect(fx, y + h, 3, 3);
    }
  }

  // ── Whiteboard (on wall) ──
  function drawWhiteboard(ctx, x, y) {
    // Frame
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(x - 3, y - 3, 58, 37);
    // Board surface
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, 52, 32);

    // Scribbles on board (colored markers)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x + 5, y + 5, 16, 1);
    ctx.fillRect(x + 5, y + 8, 11, 1);

    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(x + 5, y + 13, 21, 1);
    ctx.fillRect(x + 5, y + 16, 13, 1);

    ctx.fillStyle = '#22c55e';
    ctx.fillRect(x + 5, y + 21, 19, 1);

    // Sticky note on board
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(x + 34, y + 5, 13, 13);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x + 36, y + 8, 8, 1);
    ctx.fillRect(x + 36, y + 11, 10, 1);

    // Marker tray
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(x + 3, y + 32, 48, 4);
    // Markers
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x + 8, y + 32, 8, 3);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(x + 19, y + 32, 8, 3);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(x + 29, y + 32, 8, 3);
  }

  // ── Coffee cup on desk (standalone decoration) ──
  function drawCoffeeCup(ctx, x, y) {
    // Saucer
    ctx.fillStyle = '#f0e6d6';
    ctx.fillRect(x - 1, y + 8, 13, 3);
    // Cup body
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, 11, 9);
    // Coffee
    ctx.fillStyle = '#92400e';
    ctx.fillRect(x + 1, y + 1, 8, 4);
    // Handle
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 11, y + 3, 3, 4);
    // Steam
    ctx.fillStyle = '#d1d5db';
    ctx.globalAlpha = 0.4;
    ctx.fillRect(x + 3, y - 4, 2, 3);
    ctx.fillRect(x + 7, y - 5, 2, 4);
    ctx.globalAlpha = 1.0;
  }

  // ── Photo frame on wall ──
  function drawPhotoFrame(ctx, x, y) {
    // Frame
    ctx.fillStyle = '#b8956e';
    ctx.fillRect(x, y, 21, 19);
    // Inner matte
    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(x + 2, y + 2, 17, 15);
    // Photo (landscape scene)
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(x + 3, y + 3, 15, 7);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(x + 3, y + 10, 15, 6);
    // Sun
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x + 13, y + 4, 4, 4);
  }

  function drawAll(ctx, canvasW, canvasH) {
    // Carpet area in center
    var carpetW = Math.min(canvasW * 0.6, 530);
    var carpetH = 106;
    var carpetX = (canvasW - carpetW) / 2;
    var carpetY = canvasH - carpetH - 40;
    drawCarpet(ctx, carpetX, carpetY, carpetW, carpetH);

    // Plants near edges (varied species)
    if (canvasW > 300) {
      drawPlant(ctx, 20, canvasH - 78);
      drawCactus(ctx, canvasW - 44, canvasH - 76);
    }
    if (canvasW > 600) {
      drawCactus(ctx, 22, 70);
      drawPlant(ctx, canvasW - 44, 72);
    }

    // Coffee machine on right wall area
    if (canvasW > 400) {
      drawCoffeeMachine(ctx, canvasW - 48, 64);
    }

    // Whiteboard on wall (left side)
    if (canvasW > 500) {
      drawWhiteboard(ctx, 20, 10);
    }

    // Photo frame on wall (right of center)
    if (canvasW > 450) {
      drawPhotoFrame(ctx, canvasW - 90, 18);
    }

    // Coffee cup near bottom left
    if (canvasW > 350) {
      drawCoffeeCup(ctx, 50, canvasH - 40);
    }
  }

  return {
    drawPlant: drawPlant,
    drawCactus: drawCactus,
    drawCoffeeMachine: drawCoffeeMachine,
    drawCarpet: drawCarpet,
    drawWhiteboard: drawWhiteboard,
    drawCoffeeCup: drawCoffeeCup,
    drawPhotoFrame: drawPhotoFrame,
    drawAll: drawAll,
  };
})();


/* ── Wall Clock ──────────────────────────────────────────── */

var WallClock = (function () {
  var CLOCK_SIZE = 34;

  function draw(ctx, x, y, now) {
    var date = new Date(now);
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var seconds = date.getSeconds();

    var cx = x + CLOCK_SIZE / 2;
    var cy = y + CLOCK_SIZE / 2;
    var radius = CLOCK_SIZE / 2;

    // Shadow behind clock
    ctx.fillStyle = '#c4a882';
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(cx + 1, cy + 1, radius + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Clock face (warm white)
    ctx.fillStyle = '#fffef7';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Wooden border (cute frame)
    ctx.strokeStyle = '#b8956e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    // Inner ring
    ctx.strokeStyle = '#c9a87c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Hour markers (bigger at 12/3/6/9)
    for (var i = 0; i < 12; i++) {
      var angle = (i * Math.PI * 2) / 12 - Math.PI / 2;
      var isMajor = (i % 3 === 0);
      var markerR = isMajor ? radius - 5 : radius - 4;
      var mx = cx + Math.cos(angle) * markerR;
      var my = cy + Math.sin(angle) * markerR;
      var mSize = isMajor ? 2 : 1;
      ctx.fillStyle = isMajor ? '#8b7355' : '#b8956e';
      ctx.fillRect(mx - mSize / 2, my - mSize / 2, mSize, mSize);
    }

    // Hour hand (thick, dark wood)
    var hourAngle = ((hours % 12) + minutes / 60) * (Math.PI * 2) / 12 - Math.PI / 2;
    ctx.strokeStyle = '#5c4a3a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(hourAngle) * (radius - 7), cy + Math.sin(hourAngle) * (radius - 7));
    ctx.stroke();

    // Minute hand (thinner)
    var minAngle = (minutes / 60) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(minAngle) * (radius - 4), cy + Math.sin(minAngle) * (radius - 4));
    ctx.stroke();

    // Second hand (red, thin)
    var secAngle = (seconds / 60) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(secAngle) * (radius - 3), cy + Math.sin(secAngle) * (radius - 3));
    ctx.stroke();

    // Center dot (cute red)
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  return { draw: draw, CLOCK_SIZE: CLOCK_SIZE };
})();


/* ── Monitor Effects ─────────────────────────────────────── */

var MonitorEffects = (function () {

  function drawScreen(ctx, monX, monY, screenW, screenH, state, now) {
    switch (state) {
      case 'typing':
        _drawTypingScreen(ctx, monX, monY, screenW, screenH, now);
        break;
      case 'reading':
        _drawReadingScreen(ctx, monX, monY, screenW, screenH, now);
        break;
      case 'waiting':
        _drawWaitingScreen(ctx, monX, monY, screenW, screenH, now);
        break;
      default:
        _drawIdleScreen(ctx, monX, monY, screenW, screenH);
        break;
    }
  }

  function _drawTypingScreen(ctx, mx, my, sw, sh, now) {
    // Dark terminal background
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(mx, my, sw, sh);

    // Scrolling green text lines
    var lineH = 3;
    var offset = Math.floor(now / 200) % (sh + lineH);
    ctx.fillStyle = '#22c55e';

    for (var ly = -lineH; ly < sh; ly += lineH + 1) {
      var adjustedY = (ly + offset) % (sh + lineH);
      if (adjustedY < 0) adjustedY += sh + lineH;
      if (adjustedY >= sh) continue;

      var lineW = ((ly * 7 + 3) % (sw - 4)) + 2;
      if (lineW < 2) lineW = 2;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 300 + ly);
      ctx.fillRect(mx + 1, my + adjustedY, Math.min(lineW, sw - 2), 2);
    }
    ctx.globalAlpha = 1.0;

    // Cursor blink
    if (Math.floor(now / 500) % 2 === 0) {
      ctx.fillStyle = '#4ade80';
      var cursorY = (offset + 2) % sh;
      ctx.fillRect(mx + 2, my + Math.min(cursorY, sh - 3), 2, 2);
    }
  }

  function _drawReadingScreen(ctx, mx, my, sw, sh, now) {
    // Blue-tinted background
    ctx.fillStyle = '#0c1929';
    ctx.fillRect(mx, my, sw, sh);

    // Scrolling blue document lines
    var scrollOffset = Math.floor(now / 400) % sh;
    ctx.fillStyle = '#3b82f6';

    for (var ly = 0; ly < sh; ly += 3) {
      var adjustedY = (ly + scrollOffset) % sh;
      var lineW = ((ly * 5 + 7) % (sw - 6)) + 3;
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(ly * 0.5);
      ctx.fillRect(mx + 1, my + adjustedY, Math.min(lineW, sw - 2), 1);
    }
    ctx.globalAlpha = 1.0;

    // Scrollbar
    ctx.fillStyle = '#60a5fa';
    ctx.globalAlpha = 0.5;
    var barY = my + (scrollOffset % (sh - 4));
    ctx.fillRect(mx + sw - 2, barY, 1, 3);
    ctx.globalAlpha = 1.0;
  }

  function _drawWaitingScreen(ctx, mx, my, sw, sh, now) {
    // Dark background
    ctx.fillStyle = '#1a1500';
    ctx.fillRect(mx, my, sw, sh);

    // Pulsing yellow glow
    var pulse = 0.3 + 0.4 * Math.abs(Math.sin(now / 600));
    ctx.fillStyle = '#eab308';
    ctx.globalAlpha = pulse;
    ctx.fillRect(mx + 1, my + 1, sw - 2, sh - 2);
    ctx.globalAlpha = 1.0;

    // Question mark or hourglass dots
    ctx.fillStyle = '#fbbf24';
    var dotPhase = Math.floor(now / 400) % 3;
    for (var di = 0; di <= dotPhase; di++) {
      ctx.fillRect(mx + sw / 2 - 3 + di * 3, my + sh / 2, 2, 2);
    }
  }

  function _drawIdleScreen(ctx, mx, my, sw, sh) {
    ctx.fillStyle = '#111827';
    ctx.fillRect(mx, my, sw, sh);
  }

  return { drawScreen: drawScreen };
})();
