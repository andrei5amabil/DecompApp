import earcut from 'earcut';
import { type Point, type Segment, type TriangleCell } from '../../types/geometry';

/** Computes signed area using the Shoelace formula */
function getSignedArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return area / 2;
}

/** In screen coordinates (y downward): CCW area < 0, CW area > 0 */
function normalizeWinding(points: Point[], clockwise: boolean): Point[] {
  const isClockwise = getSignedArea(points) > 0;
  return isClockwise === clockwise ? [...points] : [...points].reverse();
}

/** Computes the geometric center of a triangle */
function getTriangleCentroid(p1: Point, p2: Point, p3: Point): Point {
  return {
    x: Math.round(((p1.x + p2.x + p3.x) / 3) * 10) / 10,
    y: Math.round(((p1.y + p2.y + p3.y) / 3) * 10) / 10,
  };
}

/** Tests if a point lies inside a triangle via barycentric coordinates */
export function isPointInTriangle(p: Point, p1: Point, p2: Point, p3: Point): boolean {
  const dX = p.x - p3.x;
  const dY = p.y - p3.y;
  const dX21 = p3.x - p2.x;
  const dY12 = p2.y - p3.y;
  const D = dY12 * (p1.x - p3.x) + dX21 * (p1.y - p3.y);
  const s = dY12 * dX + dX21 * dY;
  const t = (p3.y - p1.y) * dX + (p1.x - p3.x) * dY;

  if (D < 0) return s <= 0 && t <= 0 && s + t >= D;
  return s >= 0 && t >= 0 && s + t <= D;
}

/** Triangulates the free space of a field containing arbitrary concave obstacles */
export function computeTriangulation(
  rawField: Point[],
  rawObstacles: Point[][]
): TriangleCell[] {
  // Earcut requires outer boundary in one direction and holes in reverse
  const field = normalizeWinding(rawField, false);
  const obstacles = rawObstacles.map((obs) => normalizeWinding(obs, true));

  const flatCoords: number[] = [];
  const holeIndices: number[] = [];

  // 1. Flatten field perimeter
  for (const p of field) {
    flatCoords.push(p.x, p.y);
  }

  // 2. Flatten obstacle holes
  for (const obs of obstacles) {
    holeIndices.push(flatCoords.length / 2);
    for (const p of obs) {
      flatCoords.push(p.x, p.y);
    }
  }

  // Run constrained triangulation
  const indices = earcut(flatCoords, holeIndices, 2);
  const cells: TriangleCell[] = [];

  // Group into triplets and generate 1-indexed triangle cells k_i
  for (let i = 0; i < indices.length; i += 3) {
    const idx1 = indices[i];
    const idx2 = indices[i + 1];
    const idx3 = indices[i + 2];

    const p1: Point = { x: flatCoords[idx1 * 2], y: flatCoords[idx1 * 2 + 1] };
    const p2: Point = { x: flatCoords[idx2 * 2], y: flatCoords[idx2 * 2 + 1] };
    const p3: Point = { x: flatCoords[idx3 * 2], y: flatCoords[idx3 * 2 + 1] };

    const edges: [Segment, Segment, Segment] = [
      { p1: p1, p2: p2 },
      { p1: p2, p2: p3 },
      { p1: p3, p2: p1 },
    ];

    cells.push({
      id: Math.floor(i / 3) + 1, // Matches 1..k labeling from the slides
      vertices: [p1, p2, p3],
      edges,
      centroid: getTriangleCentroid(p1, p2, p3),
    });
  }

  return cells;
}