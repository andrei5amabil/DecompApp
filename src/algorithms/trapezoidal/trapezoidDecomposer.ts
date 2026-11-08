import { type Point, type Segment, type TrapezoidCell } from '../../types/geometry';
import { isPointInPolygon } from '../common/pointInPolygon';

interface SpanningSegment {
  p1: Point;
  p2: Point;
  yMid: number;
  yLeft: number;
  yRight: number;
}

/** Computes the exact geometric centroid of an arbitrary simple polygon */
export function computePolygonCentroid(vertices: Point[]): Point {
  const n = vertices.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return { ...vertices[0] };
  if (n === 2) {
    return {
      x: Math.round(((vertices[0].x + vertices[1].x) / 2) * 10) / 10,
      y: Math.round(((vertices[0].y + vertices[1].y) / 2) * 10) / 10,
    };
  }

  let signedArea = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < n; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % n];
    const a = p1.x * p2.y - p2.x * p1.y;
    signedArea += a;
    cx += (p1.x + p2.x) * a;
    cy += (p1.y + p2.y) * a;
  }

  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-4) {
    const avgX = vertices.reduce((sum, p) => sum + p.x, 0) / n;
    const avgY = vertices.reduce((sum, p) => sum + p.y, 0) / n;
    return { x: Math.round(avgX * 10) / 10, y: Math.round(avgY * 10) / 10 };
  }

  cx = cx / (6 * signedArea);
  cy = cy / (6 * signedArea);

  return {
    x: Math.round(cx * 10) / 10,
    y: Math.round(cy * 10) / 10,
  };
}

/** Evaluates the y-coordinate on a non-vertical segment at a given x */
function getYAtX(p1: Point, p2: Point, x: number): number {
  const dx = p2.x - p1.x;
  if (Math.abs(dx) < 1e-9) return p1.y;
  return p1.y + ((p2.y - p1.y) / dx) * (x - p1.x);
}

/** Tests if a query point is strictly in free space (inside field, outside all obstacles) */
export function isFreeSpacePoint(
  p: Point,
  field: Point[],
  obstacles: Point[][]
): boolean {
  if (!isPointInPolygon(p, field)) return false;
  for (const obs of obstacles) {
    if (isPointInPolygon(p, obs)) return false;
  }
  return true;
}

/** Tests if a query point lies inside a trapezoid cell */
export function isPointInTrapezoid(
  p: Point,
  cell: TrapezoidCell,
  tolerance: number = 0.5
): boolean {
  if (p.x < cell.leftX - tolerance || p.x > cell.rightX + tolerance) {
    return false;
  }

  const clampedX = Math.max(cell.leftX, Math.min(cell.rightX, p.x));
  const yTop = getYAtX(cell.topSegment.p1, cell.topSegment.p2, clampedX);
  const yBot = getYAtX(cell.bottomSegment.p1, cell.bottomSegment.p2, clampedX);

  const minY = Math.min(yTop, yBot) - tolerance;
  const maxY = Math.max(yTop, yBot) + tolerance;

  if (p.y >= minY && p.y <= maxY) {
    return true;
  }

  return isPointInPolygon(p, cell.vertices);
}

/**
 * Locates the ID of the trapezoid cell containing point p.
 * Uses progressively relaxed tolerances so a point strictly inside one cell
 * is never claimed by an adjacent cell across a shared boundary.
 */
export function locatePointInTrapezoids(
  p: Point,
  cells: TrapezoidCell[]
): number | null {
  for (const tol of [1e-2, 0.5, 1.5]) {
    for (const cell of cells) {
      if (isPointInTrapezoid(p, cell, tol)) {
        return cell.id;
      }
    }
  }
  return null;
}

/**
 * Computes exact vertical ray cuts cast from every vertex into C_free.
 * Rays stop at the first obstacle boundary or field boundary they encounter.
 * Each cut is guaranteed to lie 100% in C_free and never penetrates any obstacle.
 */
export function computeVerticalCuts(
  rawField: Point[],
  rawObstacles: Point[][]
): Segment[] {
  if (!rawField || rawField.length < 3) return [];

  const allVertices: Point[] = [...rawField];
  for (const obs of rawObstacles) {
    for (const p of obs) allVertices.push(p);
  }

  const allSegments: Segment[] = [];
  const fieldLen = rawField.length;
  for (let i = 0; i < fieldLen; i++) {
    allSegments.push({ p1: rawField[i], p2: rawField[(i + 1) % fieldLen] });
  }
  for (const obs of rawObstacles) {
    const obsLen = obs.length;
    for (let i = 0; i < obsLen; i++) {
      allSegments.push({ p1: obs[i], p2: obs[(i + 1) % obsLen] });
    }
  }

  const isCutInFreeSpace = (p1: Point, p2: Point): boolean => {
    const x = p1.x;
    const delta = 0.05;
    // A vertical decomposition cut must lie strictly in C_free and separate free space on left and right
    for (const t of [0.25, 0.5, 0.75]) {
      const y = p1.y + (p2.y - p1.y) * t;
      if (!isFreeSpacePoint({ x, y }, rawField, rawObstacles)) {
        return false;
      }
      if (!isFreeSpacePoint({ x: x - delta, y }, rawField, rawObstacles)) {
        return false;
      }
      if (!isFreeSpacePoint({ x: x + delta, y }, rawField, rawObstacles)) {
        return false;
      }
    }
    return true;
  };

  const candidateCuts: Segment[] = [];

  for (const v of allVertices) {
    // 1. Upward Ray (towards smaller y)
    let closestYUp = -Infinity;
    for (const seg of allSegments) {
      const dx = seg.p2.x - seg.p1.x;
      if (Math.abs(dx) <= 1e-4) {
        // Vertical segment at seg.p1.x
        if (Math.abs(v.x - seg.p1.x) <= 1e-4) {
          const segMinY = Math.min(seg.p1.y, seg.p2.y);
          const segMaxY = Math.max(seg.p1.y, seg.p2.y);
          if (v.y > segMinY + 1e-3 && v.y <= segMaxY + 1e-3) {
            closestYUp = v.y; // Blocked immediately by vertical edge
          } else if (segMaxY < v.y - 1e-3 && segMaxY > closestYUp) {
            closestYUp = segMaxY;
          }
        }
        continue;
      }

      const minX = Math.min(seg.p1.x, seg.p2.x);
      const maxX = Math.max(seg.p1.x, seg.p2.x);
      if (v.x >= minX - 1e-4 && v.x <= maxX + 1e-4) {
        const slope = (seg.p2.y - seg.p1.y) / dx;
        const yAtX = seg.p1.y + slope * (v.x - seg.p1.x);
        if (yAtX < v.y - 1e-3 && yAtX > closestYUp) {
          closestYUp = yAtX;
        }
      }
    }

    if (closestYUp > -Infinity && v.y - closestYUp > 0.5) {
      const cutUp: Segment = {
        p1: { x: v.x, y: closestYUp },
        p2: { x: v.x, y: v.y },
      };
      if (isCutInFreeSpace(cutUp.p1, cutUp.p2)) {
        candidateCuts.push(cutUp);
      }
    }

    // 2. Downward Ray (towards larger y)
    let closestYDown = Infinity;
    for (const seg of allSegments) {
      const dx = seg.p2.x - seg.p1.x;
      if (Math.abs(dx) <= 1e-4) {
        // Vertical segment at seg.p1.x
        if (Math.abs(v.x - seg.p1.x) <= 1e-4) {
          const segMinY = Math.min(seg.p1.y, seg.p2.y);
          const segMaxY = Math.max(seg.p1.y, seg.p2.y);
          if (v.y < segMaxY - 1e-3 && v.y >= segMinY - 1e-3) {
            closestYDown = v.y; // Blocked immediately by vertical edge
          } else if (segMinY > v.y + 1e-3 && segMinY < closestYDown) {
            closestYDown = segMinY;
          }
        }
        continue;
      }

      const minX = Math.min(seg.p1.x, seg.p2.x);
      const maxX = Math.max(seg.p1.x, seg.p2.x);
      if (v.x >= minX - 1e-4 && v.x <= maxX + 1e-4) {
        const slope = (seg.p2.y - seg.p1.y) / dx;
        const yAtX = seg.p1.y + slope * (v.x - seg.p1.x);
        if (yAtX > v.y + 1e-3 && yAtX < closestYDown) {
          closestYDown = yAtX;
        }
      }
    }

    if (closestYDown < Infinity && closestYDown - v.y > 0.5) {
      const cutDown: Segment = {
        p1: { x: v.x, y: v.y },
        p2: { x: v.x, y: closestYDown },
      };
      if (isCutInFreeSpace(cutDown.p1, cutDown.p2)) {
        candidateCuts.push(cutDown);
      }
    }
  }

  // Deduplicate cuts
  const uniqueCuts: Segment[] = [];
  for (const c of candidateCuts) {
    const yMin = Math.min(c.p1.y, c.p2.y);
    const yMax = Math.max(c.p1.y, c.p2.y);
    const exists = uniqueCuts.some(
      (u) =>
        Math.abs(u.p1.x - c.p1.x) < 1e-2 &&
        Math.abs(u.p1.y - yMin) < 0.5 &&
        Math.abs(u.p2.y - yMax) < 0.5
    );
    if (!exists) {
      uniqueCuts.push({
        p1: { x: c.p1.x, y: Math.round(yMin * 10) / 10 },
        p2: { x: c.p1.x, y: Math.round(yMax * 10) / 10 },
      });
    }
  }

  return uniqueCuts;
}

function areSegmentsCollinear(s1: Segment, s2: Segment): boolean {
  const dx1 = s1.p2.x - s1.p1.x;
  const dy1 = s1.p2.y - s1.p1.y;
  const dx2 = s2.p2.x - s2.p1.x;
  const dy2 = s2.p2.y - s2.p1.y;
  if (Math.abs(dx1) < 1e-4 || Math.abs(dx2) < 1e-4) return false;
  // Ensure segments actually meet continuously at their shared boundary
  if (Math.abs(s1.p2.x - s2.p1.x) > 1e-2 || Math.abs(s1.p2.y - s2.p1.y) > 0.5) {
    return false;
  }
  const slope1 = dy1 / dx1;
  const slope2 = dy2 / dx2;
  return Math.abs(slope1 - slope2) < 1e-2;
}

/**
 * Computes exact vertical trapezoidal cell decomposition of the free space C_free.
 * Merges adjacent slab pieces that share continuous top and bottom segments and have
 * no vertical cut between them, eliminating artificial split lines.
 */
export function computeTrapezoidalDecomposition(
  rawField: Point[],
  rawObstacles: Point[][]
): { cells: TrapezoidCell[]; verticalCuts: Segment[] } {
  if (!rawField || rawField.length < 3) {
    return { cells: [], verticalCuts: [] };
  }

  // 1. Compute exact vertical cuts in C_free
  const verticalCuts = computeVerticalCuts(rawField, rawObstacles);

  // 2. Collect all boundary segments
  const segments: Segment[] = [];
  const fieldLen = rawField.length;
  for (let i = 0; i < fieldLen; i++) {
    segments.push({ p1: rawField[i], p2: rawField[(i + 1) % fieldLen] });
  }

  for (const obs of rawObstacles) {
    const obsLen = obs.length;
    if (obsLen >= 3) {
      for (let i = 0; i < obsLen; i++) {
        segments.push({ p1: obs[i], p2: obs[(i + 1) % obsLen] });
      }
    }
  }

  // 3. Collect unique x-coordinates of all vertices and cuts
  const rawXCoords: number[] = [];
  for (const p of rawField) rawXCoords.push(p.x);
  for (const obs of rawObstacles) {
    for (const p of obs) rawXCoords.push(p.x);
  }
  for (const cut of verticalCuts) {
    rawXCoords.push(cut.p1.x);
  }

  rawXCoords.sort((a, b) => a - b);
  const uniqueX: number[] = [];
  for (const x of rawXCoords) {
    if (uniqueX.length === 0 || Math.abs(x - uniqueX[uniqueX.length - 1]) > 1e-3) {
      uniqueX.push(x);
    }
  }

  const slabCells: TrapezoidCell[] = [];
  let nextCellId = 1;

  // 4. Process each slab [xLeft, xRight]
  for (let k = 0; k < uniqueX.length - 1; k++) {
    const xLeft = uniqueX[k];
    const xRight = uniqueX[k + 1];
    if (xRight - xLeft < 1e-3) continue;

    const xMid = (xLeft + xRight) / 2;

    const spanning: SpanningSegment[] = [];
    for (const seg of segments) {
      const minX = Math.min(seg.p1.x, seg.p2.x);
      const maxX = Math.max(seg.p1.x, seg.p2.x);

      if (maxX - minX > 1e-4 && minX <= xLeft + 1e-3 && maxX >= xRight - 1e-3) {
        spanning.push({
          p1: seg.p1,
          p2: seg.p2,
          yMid: getYAtX(seg.p1, seg.p2, xMid),
          yLeft: getYAtX(seg.p1, seg.p2, xLeft),
          yRight: getYAtX(seg.p1, seg.p2, xRight),
        });
      }
    }

    spanning.sort((a, b) => a.yMid - b.yMid);

    const filteredSpanning: SpanningSegment[] = [];
    for (const seg of spanning) {
      if (
        filteredSpanning.length === 0 ||
        Math.abs(seg.yLeft - filteredSpanning[filteredSpanning.length - 1].yLeft) > 1e-4 ||
        Math.abs(seg.yRight - filteredSpanning[filteredSpanning.length - 1].yRight) > 1e-4
      ) {
        filteredSpanning.push(seg);
      }
    }

    for (let i = 0; i < filteredSpanning.length - 1; i++) {
      const top = filteredSpanning[i];
      const bot = filteredSpanning[i + 1];

      const slabHeightAtMid = bot.yMid - top.yMid;
      if (slabHeightAtMid < 1e-2) continue;

      const testPoint: Point = {
        x: xMid,
        y: (top.yMid + bot.yMid) / 2,
      };

      if (!isFreeSpacePoint(testPoint, rawField, rawObstacles)) continue;

      const yTL = top.yLeft;
      const yBL = bot.yLeft;
      const yTR = top.yRight;
      const yBR = bot.yRight;

      // Keep exact floating-point coordinates during slab construction and merging
      // to prevent rounding-induced slope distortion on narrow slabs
      const pTL: Point = { x: xLeft, y: yTL };
      const pBL: Point = { x: xLeft, y: yBL };
      const pTR: Point = { x: xRight, y: yTR };
      const pBR: Point = { x: xRight, y: yBR };

      const leftDegenerate = Math.abs(yBL - yTL) < 1e-2;
      const rightDegenerate = Math.abs(yBR - yTR) < 1e-2;

      let cellVertices: Point[];
      if (leftDegenerate && !rightDegenerate) {
        const pLeft: Point = {
          x: xLeft,
          y: (yTL + yBL) / 2,
        };
        cellVertices = [pLeft, pTR, pBR];
      } else if (rightDegenerate && !leftDegenerate) {
        const pRight: Point = {
          x: xRight,
          y: (yTR + yBR) / 2,
        };
        cellVertices = [pTL, pRight, pBL];
      } else if (leftDegenerate && rightDegenerate) {
        continue;
      } else {
        cellVertices = [pTL, pTR, pBR, pBL];
      }

      const centroid = computePolygonCentroid(cellVertices);

      slabCells.push({
        id: nextCellId++,
        leftX: xLeft,
        rightX: xRight,
        topSegment: { p1: pTL, p2: pTR },
        bottomSegment: { p1: pBL, p2: pBR },
        vertices: cellVertices,
        centroid,
      });
    }
  }

  // 5. Merge adjacent slab pieces that are not separated by an actual vertical cut
  const hasCutBetween = (x: number, y1: number, y2: number): boolean => {
    const yMin = Math.min(y1, y2);
    const yMax = Math.max(y1, y2);
    return verticalCuts.some(
      (c) =>
        Math.abs(c.p1.x - x) < 1e-2 &&
        Math.min(c.p1.y, c.p2.y) < yMax - 0.1 &&
        Math.max(c.p1.y, c.p2.y) > yMin + 0.1
    );
  };

  const mergedCells: TrapezoidCell[] = [...slabCells];
  let mergedAny = true;
  while (mergedAny) {
    mergedAny = false;
    for (let i = 0; i < mergedCells.length; i++) {
      for (let j = 0; j < mergedCells.length; j++) {
        if (i === j) continue;
        const cA = mergedCells[i];
        const cB = mergedCells[j];
        if (Math.abs(cA.rightX - cB.leftX) < 1e-2) {
          const x = cA.rightX;
          const yTop = cA.topSegment.p2.y;
          const yBot = cA.bottomSegment.p2.y;
          if (
            areSegmentsCollinear(cA.topSegment, cB.topSegment) &&
            areSegmentsCollinear(cA.bottomSegment, cB.bottomSegment) &&
            !hasCutBetween(x, yTop, yBot)
          ) {
            const pTL = cA.topSegment.p1;
            const pTR = cB.topSegment.p2;
            const pBR = cB.bottomSegment.p2;
            const pBL = cA.bottomSegment.p1;

            const leftDegen = Math.abs(pBL.y - pTL.y) < 1e-2;
            const rightDegen = Math.abs(pBR.y - pTR.y) < 1e-2;

            let vertices: Point[];
            if (leftDegen && !rightDegen) {
              vertices = [{ x: pTL.x, y: (pTL.y + pBL.y) / 2 }, pTR, pBR];
            } else if (rightDegen && !leftDegen) {
              vertices = [pTL, { x: pTR.x, y: (pTR.y + pBR.y) / 2 }, pBL];
            } else {
              vertices = [pTL, pTR, pBR, pBL];
            }

            const merged: TrapezoidCell = {
              id: cA.id,
              leftX: cA.leftX,
              rightX: cB.rightX,
              topSegment: { p1: pTL, p2: pTR },
              bottomSegment: { p1: pBL, p2: pBR },
              vertices,
              centroid: computePolygonCentroid(vertices),
            };

            mergedCells.splice(Math.max(i, j), 1);
            mergedCells.splice(Math.min(i, j), 1, merged);
            mergedAny = true;
            break;
          }
        }
      }
      if (mergedAny) break;
    }
  }

  // Round final cell coordinates cleanly and renumber sequentially from left to right, top to bottom
  const roundPoint = (p: Point): Point => ({
    x: Math.round(p.x * 10) / 10,
    y: Math.round(p.y * 10) / 10,
  });

  mergedCells.sort((a, b) => a.leftX - b.leftX || a.centroid.y - b.centroid.y);
  mergedCells.forEach((c, idx) => {
    c.id = idx + 1;
    c.topSegment = { p1: roundPoint(c.topSegment.p1), p2: roundPoint(c.topSegment.p2) };
    c.bottomSegment = { p1: roundPoint(c.bottomSegment.p1), p2: roundPoint(c.bottomSegment.p2) };
    c.vertices = c.vertices.map(roundPoint);
    c.centroid = computePolygonCentroid(c.vertices);
  });

  return { cells: mergedCells, verticalCuts };
}
