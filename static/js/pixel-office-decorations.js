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

  function drawPlant(ctx, x, y) {
    // Pot
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(x, y + 12, 14, 10);
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(x - 1, y + 10, 16, 3);

    // Soil
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(x + 2, y + 10, 10, 2);

    // Leaves
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(x + 5, y, 4, 4);
    ctx.fillRect(x + 3, y + 3, 8, 3);
    ctx.fillRect(x + 1, y + 5, 12, 3);
    ctx.fillStyle = '#40916c';
    ctx.fillRect(x + 5, y + 1, 4, 2);
    ctx.fillRect(x + 4, y + 4, 6, 2);
    ctx.fillRect(x + 2, y + 6, 10, 2);

    // Stem
    ctx.fillStyle = '#52b788';
    ctx.fillRect(x + 6, y + 8, 2, 3);
  }

  function drawCoffeeMachine(ctx, x, y) {
    // Body
    ctx.fillStyle = '#374151';
    ctx.fillRect(x, y, 20, 28);
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(x + 1, y + 1, 18, 2);

    // Water tank (top)
    ctx.fillStyle = '#1e40af';
    ctx.globalAlpha = 0.4;
    ctx.fillRect(x + 3, y + 4, 14, 8);
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#60a5fa';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(x + 3, y + 8, 14, 4);
    ctx.globalAlpha = 1.0;

    // Drip area
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(x + 4, y + 14, 12, 8);

    // Cup
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(x + 7, y + 18, 6, 4);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(x + 8, y + 18, 4, 2);

    // Base
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(x - 1, y + 24, 22, 4);

    // Power light
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(x + 16, y + 6, 2, 2);
  }

  function drawCarpet(ctx, x, y, w, h) {
    ctx.fillStyle = '#1a1a3a';
    ctx.fillRect(x, y, w, h);

    // Border pattern
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(x, y, w, 2);
    ctx.fillRect(x, y + h - 2, w, 2);
    ctx.fillRect(x, y, 2, h);
    ctx.fillRect(x + w - 2, y, 2, h);

    // Inner pattern lines
    ctx.fillStyle = '#222244';
    for (var px = x + 8; px < x + w - 4; px += 12) {
      ctx.fillRect(px, y + 4, 2, h - 8);
    }
  }

  function drawAll(ctx, canvasW, canvasH, deskPositions) {
    // Carpet area in center
    var carpetW = Math.min(canvasW * 0.6, 400);
    var carpetH = 80;
    var carpetX = (canvasW - carpetW) / 2;
    var carpetY = canvasH - carpetH - 30;
    drawCarpet(ctx, carpetX, carpetY, carpetW, carpetH);

    // Place plants near edges
    if (canvasW > 300) {
      drawPlant(ctx, 20, canvasH - 60);
      drawPlant(ctx, canvasW - 36, canvasH - 60);
    }

    // Coffee machine on right wall area
    if (canvasW > 400) {
      drawCoffeeMachine(ctx, canvasW - 40, 70);
    }
  }

  return {
    drawPlant: drawPlant,
    drawCoffeeMachine: drawCoffeeMachine,
    drawCarpet: drawCarpet,
    drawAll: drawAll,
  };
})();


/* ── Wall Clock ──────────────────────────────────────────── */

var WallClock = (function () {
  var CLOCK_SIZE = 24;

  function draw(ctx, x, y, now) {
    var date = new Date(now);
    var hours = date.getHours();
    var minutes = date.getMinutes();

    var cx = x + CLOCK_SIZE / 2;
    var cy = y + CLOCK_SIZE / 2;
    var radius = CLOCK_SIZE / 2;

    // Clock face
    ctx.fillStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Hour markers
    ctx.fillStyle = '#374151';
    for (var i = 0; i < 12; i++) {
      var angle = (i * Math.PI * 2) / 12 - Math.PI / 2;
      var mx = cx + Math.cos(angle) * (radius - 3);
      var my = cy + Math.sin(angle) * (radius - 3);
      ctx.fillRect(mx - 1, my - 1, 2, 2);
    }

    // Hour hand
    var hourAngle = ((hours % 12) + minutes / 60) * (Math.PI * 2) / 12 - Math.PI / 2;
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(hourAngle) * (radius - 6), cy + Math.sin(hourAngle) * (radius - 6));
    ctx.stroke();

    // Minute hand
    var minAngle = (minutes / 60) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(minAngle) * (radius - 3), cy + Math.sin(minAngle) * (radius - 3));
    ctx.stroke();

    // Center dot
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
