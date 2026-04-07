import { GRID_COLS, GRID_ROWS, PATH_WAYPOINTS } from './constants.js';

// Tile types
export const TILE = {
  EMPTY:   'empty',
  PATH:    'path',
  TOWER:   'tower',
  BLOCKED: 'blocked',
};

export class Grid {
  constructor() {
    this.cols = GRID_COLS;
    this.rows = GRID_ROWS;
    this.tileSize = 0;        // set by resize()
    this.offsetX  = 0;        // canvas x offset to center grid
    this.offsetY  = 0;        // canvas y offset to center grid

    // 2D array of tile objects
    this.tiles = [];
    // Pre-computed pixel center-points for each path segment (for enemy movement)
    this.pathPixels = [];

    this._initTiles();
    this._buildPath();
  }

  // ----------------------------------------------------------------
  // Initialisation
  // ----------------------------------------------------------------

  _initTiles() {
    this.tiles = [];
    for (let r = 0; r < this.rows; r++) {
      this.tiles[r] = [];
      for (let c = 0; c < this.cols; c++) {
        this.tiles[r][c] = { type: TILE.EMPTY, tower: null };
      }
    }
  }

  _buildPath() {
    // Expand PATH_WAYPOINTS into individual tile coordinates
    const pathCoords = [];
    for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
      const a = PATH_WAYPOINTS[i];
      const b = PATH_WAYPOINTS[i + 1];
      const dr = Math.sign(b.row - a.row);
      const dc = Math.sign(b.col - a.col);
      let r = a.row;
      let c = a.col;
      while (r !== b.row || c !== b.col) {
        pathCoords.push({ col: c, row: r });
        r += dr;
        c += dc;
      }
    }
    // Push final waypoint
    const last = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
    pathCoords.push({ col: last.col, row: last.row });

    // Mark tiles
    for (const { col, row } of pathCoords) {
      if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
        this.tiles[row][col].type = TILE.PATH;
      }
    }

    this._pathCoords = pathCoords;
  }

  // ----------------------------------------------------------------
  // Resize — call whenever canvas dimensions change
  // ----------------------------------------------------------------

  resize(canvasWidth, canvasHeight) {
    const tileW = canvasWidth  / this.cols;
    const tileH = canvasHeight / this.rows;
    this.tileSize = Math.floor(Math.min(tileW, tileH));

    // Center the grid on the canvas
    this.offsetX = Math.floor((canvasWidth  - this.tileSize * this.cols)  / 2);
    this.offsetY = Math.floor((canvasHeight - this.tileSize * this.rows) / 2);

    // Recompute pixel path (center of each path tile)
    this.pathPixels = this._pathCoords.map(({ col, row }) => ({
      x: this.offsetX + col * this.tileSize + this.tileSize / 2,
      y: this.offsetY + row * this.tileSize + this.tileSize / 2,
    }));
  }

  // ----------------------------------------------------------------
  // Coordinate transforms
  // ----------------------------------------------------------------

  /** Canvas pixel → grid {col, row}. Returns null if out of bounds. */
  screenToGrid(x, y) {
    const col = Math.floor((x - this.offsetX) / this.tileSize);
    const row = Math.floor((y - this.offsetY) / this.tileSize);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
    return { col, row };
  }

  /** Grid {col, row} → pixel center point {x, y} */
  gridToScreen(col, row) {
    return {
      x: this.offsetX + col * this.tileSize + this.tileSize / 2,
      y: this.offsetY + row * this.tileSize + this.tileSize / 2,
    };
  }

  /** Top-left pixel of a grid tile */
  gridToScreenTopLeft(col, row) {
    return {
      x: this.offsetX + col * this.tileSize,
      y: this.offsetY + row * this.tileSize,
    };
  }

  // ----------------------------------------------------------------
  // Tower placement
  // ----------------------------------------------------------------

  canPlaceTower(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
    return this.tiles[row][col].type === TILE.EMPTY;
  }

  placeTower(col, row, tower) {
    this.tiles[row][col].type  = TILE.TOWER;
    this.tiles[row][col].tower = tower;
  }

  removeTower(col, row) {
    this.tiles[row][col].type  = TILE.EMPTY;
    this.tiles[row][col].tower = null;
  }

  getTower(col, row) {
    return this.tiles[row]?.[col]?.tower ?? null;
  }

  getAllTowers() {
    const towers = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.tiles[r][c].type === TILE.TOWER) {
          towers.push(this.tiles[r][c].tower);
        }
      }
    }
    return towers;
  }

  // ----------------------------------------------------------------
  // Utility
  // ----------------------------------------------------------------

  getTileType(col, row) {
    return this.tiles[row]?.[col]?.type ?? null;
  }

  isPath(col, row) {
    return this.getTileType(col, row) === TILE.PATH;
  }
}
