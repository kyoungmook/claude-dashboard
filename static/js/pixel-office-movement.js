/**
 * Pixel Office Movement — Tile grid, BFS pathfinding, character state machine
 *
 * Classes:
 *   TileGrid          — grid overlay, walkable tiles, BFS pathfinding
 *   CharacterMovement — per-agent state machine (IDLE/WALK_TO_DESK/WANDER/SEATED)
 */

/* ── Tile Grid + BFS Pathfinding ──────────────────────────── */

var TileGrid = (function () {
  var TILE_SIZE = 32;
  var WALL_HEIGHT = 60;

  function _createGrid(canvasW, canvasH) {
    var cols = Math.ceil(canvasW / TILE_SIZE);
    var rows = Math.ceil(canvasH / TILE_SIZE);
    var walkable = [];
    for (var r = 0; r < rows; r++) {
      walkable[r] = [];
      for (var c = 0; c < cols; c++) {
        walkable[r][c] = (r * TILE_SIZE) >= WALL_HEIGHT;
      }
    }
    return { walkable: walkable, cols: cols, rows: rows };
  }

  function _markDeskBlocked(grid, deskX, deskY) {
    var startCol = Math.floor(deskX / TILE_SIZE);
    var startRow = Math.floor(deskY / TILE_SIZE);
    var endCol = Math.ceil((deskX + 70) / TILE_SIZE);
    var endRow = Math.ceil((deskY + 32) / TILE_SIZE);
    for (var r = Math.max(0, startRow - 1); r <= Math.min(grid.rows - 1, endRow); r++) {
      for (var c = Math.max(0, startCol); c <= Math.min(grid.cols - 1, endCol); c++) {
        grid.walkable[r][c] = false;
      }
    }
  }

  function pixelToTile(px, py) {
    return {
      col: Math.floor(px / TILE_SIZE),
      row: Math.floor(py / TILE_SIZE),
    };
  }

  function tileToPixel(col, row) {
    return {
      x: col * TILE_SIZE + TILE_SIZE / 2,
      y: row * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  function _bfs(grid, startCol, startRow, endCol, endRow) {
    if (startCol === endCol && startRow === endRow) return [];
    if (!_inBounds(grid, startCol, startRow) || !_inBounds(grid, endCol, endRow)) return null;

    var queue = [[startCol, startRow]];
    var visited = {};
    var parent = {};
    var key = startCol + ',' + startRow;
    visited[key] = true;

    var dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

    while (queue.length > 0) {
      var cur = queue.shift();
      var cx = cur[0];
      var cy = cur[1];

      if (cx === endCol && cy === endRow) {
        return _reconstructPath(parent, startCol, startRow, endCol, endRow);
      }

      for (var d = 0; d < dirs.length; d++) {
        var nx = cx + dirs[d][0];
        var ny = cy + dirs[d][1];
        var nk = nx + ',' + ny;

        if (_inBounds(grid, nx, ny) && !visited[nk] && grid.walkable[ny][nx]) {
          visited[nk] = true;
          parent[nk] = cx + ',' + cy;
          queue.push([nx, ny]);
        }
      }
    }

    return null;
  }

  function _inBounds(grid, col, row) {
    return col >= 0 && col < grid.cols && row >= 0 && row < grid.rows;
  }

  function _reconstructPath(parent, sx, sy, ex, ey) {
    var path = [];
    var key = ex + ',' + ey;
    var startKey = sx + ',' + sy;

    while (key !== startKey) {
      var parts = key.split(',');
      path.push({ col: parseInt(parts[0], 10), row: parseInt(parts[1], 10) });
      key = parent[key];
      if (!key) return null;
    }

    path.reverse();
    return path;
  }

  function findNearestWalkable(grid, col, row) {
    if (_inBounds(grid, col, row) && grid.walkable[row][col]) {
      return { col: col, row: row };
    }
    for (var radius = 1; radius < Math.max(grid.cols, grid.rows); radius++) {
      for (var dr = -radius; dr <= radius; dr++) {
        for (var dc = -radius; dc <= radius; dc++) {
          if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
          var nr = row + dr;
          var nc = col + dc;
          if (_inBounds(grid, nc, nr) && grid.walkable[nr][nc]) {
            return { col: nc, row: nr };
          }
        }
      }
    }
    return { col: col, row: row };
  }

  return {
    TILE_SIZE: TILE_SIZE,
    createGrid: _createGrid,
    markDeskBlocked: _markDeskBlocked,
    pixelToTile: pixelToTile,
    tileToPixel: tileToPixel,
    findPath: _bfs,
    findNearestWalkable: findNearestWalkable,
  };
})();


/* ── Character Movement (State Machine) ──────────────────── */

var CharacterMovement = (function () {
  var STATE_SPAWN = 'spawn';
  var STATE_WALK_TO_DESK = 'walk_to_desk';
  var STATE_SEATED = 'seated';
  var STATE_WANDER = 'wander';
  var STATE_FADEOUT = 'fadeout';

  var WALK_SPEED = 1.5;
  var WANDER_INTERVAL_MIN = 3000;
  var WANDER_INTERVAL_MAX = 8000;
  var FADEOUT_DURATION = 800;
  var SPAWN_Y_OFFSET = 40;

  function _randomWanderDelay() {
    return WANDER_INTERVAL_MIN + Math.random() * (WANDER_INTERVAL_MAX - WANDER_INTERVAL_MIN);
  }

  function createMovementState(pixelX, pixelY, isNew) {
    return {
      phase: isNew ? STATE_SPAWN : STATE_SEATED,
      x: pixelX,
      y: isNew ? pixelY + SPAWN_Y_OFFSET : pixelY,
      targetX: pixelX,
      targetY: pixelY,
      path: [],
      pathIndex: 0,
      wanderTimer: Date.now() + _randomWanderDelay(),
      fadeAlpha: 1.0,
      fadeStart: 0,
      seatX: pixelX,
      seatY: pixelY,
    };
  }

  function update(mv, grid, agentState, now, canvasW, canvasH) {
    switch (mv.phase) {
      case STATE_SPAWN:
        return _updateSpawn(mv, grid);
      case STATE_WALK_TO_DESK:
        return _updateWalkToDesk(mv);
      case STATE_SEATED:
        return _updateSeated(mv, grid, agentState, now, canvasW, canvasH);
      case STATE_WANDER:
        return _updateWander(mv, grid, agentState, now);
      case STATE_FADEOUT:
        return _updateFadeout(mv, now);
      default:
        return mv;
    }
  }

  function _updateSpawn(mv, grid) {
    var tile = TileGrid.pixelToTile(mv.seatX, mv.seatY);
    var seatTile = TileGrid.findNearestWalkable(grid, tile.col, tile.row + 1);
    var startTile = TileGrid.pixelToTile(mv.x, mv.y);
    var walkableSrc = TileGrid.findNearestWalkable(grid, startTile.col, startTile.row);
    var path = TileGrid.findPath(grid, walkableSrc.col, walkableSrc.row, seatTile.col, seatTile.row);

    return Object.assign({}, mv, {
      phase: STATE_WALK_TO_DESK,
      path: path || [],
      pathIndex: 0,
    });
  }

  function _updateWalkToDesk(mv) {
    if (!mv.path || mv.pathIndex >= mv.path.length) {
      return Object.assign({}, mv, {
        phase: STATE_SEATED,
        x: mv.seatX,
        y: mv.seatY,
        path: [],
        wanderTimer: Date.now() + _randomWanderDelay(),
      });
    }

    var target = TileGrid.tileToPixel(mv.path[mv.pathIndex].col, mv.path[mv.pathIndex].row);
    var result = _moveToward(mv.x, mv.y, target.x, target.y, WALK_SPEED);

    if (result.arrived) {
      return Object.assign({}, mv, {
        x: result.x,
        y: result.y,
        pathIndex: mv.pathIndex + 1,
      });
    }

    return Object.assign({}, mv, { x: result.x, y: result.y });
  }

  function _updateSeated(mv, grid, agentState, now, canvasW, canvasH) {
    if (agentState === 'idle' && now > mv.wanderTimer) {
      var startTile = TileGrid.pixelToTile(mv.seatX, mv.seatY);
      var src = TileGrid.findNearestWalkable(grid, startTile.col, startTile.row + 1);
      var destCol = Math.floor(Math.random() * grid.cols * 0.6) + Math.floor(grid.cols * 0.2);
      var destRow = Math.floor(Math.random() * (grid.rows - 3)) + 3;
      var dest = TileGrid.findNearestWalkable(grid, destCol, destRow);
      var path = TileGrid.findPath(grid, src.col, src.row, dest.col, dest.row);

      if (path && path.length > 0) {
        return Object.assign({}, mv, {
          phase: STATE_WANDER,
          x: mv.seatX,
          y: mv.seatY,
          path: path,
          pathIndex: 0,
        });
      }

      return Object.assign({}, mv, {
        wanderTimer: now + _randomWanderDelay(),
      });
    }

    return Object.assign({}, mv, { x: mv.seatX, y: mv.seatY });
  }

  function _updateWander(mv, grid, agentState, now) {
    if (agentState !== 'idle') {
      var tile = TileGrid.pixelToTile(mv.x, mv.y);
      var src = TileGrid.findNearestWalkable(grid, tile.col, tile.row);
      var deskTile = TileGrid.pixelToTile(mv.seatX, mv.seatY);
      var deskTarget = TileGrid.findNearestWalkable(grid, deskTile.col, deskTile.row + 1);
      var path = TileGrid.findPath(grid, src.col, src.row, deskTarget.col, deskTarget.row);

      return Object.assign({}, mv, {
        phase: STATE_WALK_TO_DESK,
        path: path || [],
        pathIndex: 0,
      });
    }

    if (!mv.path || mv.pathIndex >= mv.path.length) {
      return Object.assign({}, mv, {
        phase: STATE_SEATED,
        x: mv.seatX,
        y: mv.seatY,
        path: [],
        wanderTimer: now + _randomWanderDelay(),
      });
    }

    var target = TileGrid.tileToPixel(mv.path[mv.pathIndex].col, mv.path[mv.pathIndex].row);
    var result = _moveToward(mv.x, mv.y, target.x, target.y, WALK_SPEED);

    if (result.arrived) {
      return Object.assign({}, mv, {
        x: result.x,
        y: result.y,
        pathIndex: mv.pathIndex + 1,
      });
    }

    return Object.assign({}, mv, { x: result.x, y: result.y });
  }

  function _updateFadeout(mv, now) {
    var elapsed = now - mv.fadeStart;
    var alpha = Math.max(0, 1 - elapsed / FADEOUT_DURATION);
    return Object.assign({}, mv, { fadeAlpha: alpha });
  }

  function startFadeout(mv, now) {
    return Object.assign({}, mv, {
      phase: STATE_FADEOUT,
      fadeStart: now,
      fadeAlpha: 1.0,
    });
  }

  function _moveToward(x, y, tx, ty, speed) {
    var dx = tx - x;
    var dy = ty - y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= speed) {
      return { x: tx, y: ty, arrived: true };
    }

    return {
      x: x + (dx / dist) * speed,
      y: y + (dy / dist) * speed,
      arrived: false,
    };
  }

  function isWalking(mv) {
    return mv.phase === STATE_WALK_TO_DESK || mv.phase === STATE_WANDER || mv.phase === STATE_SPAWN;
  }

  function isSeated(mv) {
    return mv.phase === STATE_SEATED;
  }

  function isFading(mv) {
    return mv.phase === STATE_FADEOUT;
  }

  return {
    STATE_SPAWN: STATE_SPAWN,
    STATE_WALK_TO_DESK: STATE_WALK_TO_DESK,
    STATE_SEATED: STATE_SEATED,
    STATE_WANDER: STATE_WANDER,
    STATE_FADEOUT: STATE_FADEOUT,
    FADEOUT_DURATION: FADEOUT_DURATION,
    createMovementState: createMovementState,
    update: update,
    startFadeout: startFadeout,
    isWalking: isWalking,
    isSeated: isSeated,
    isFading: isFading,
  };
})();
