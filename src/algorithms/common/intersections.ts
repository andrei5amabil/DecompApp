import { type Point, type Segment } from '../../types/geometry';

const EPSILON = 1e-9;

/** Converts an ordered vertex array into individual closed polygon segments */
export function getPolygonSegments(vertices: Point[]): Segment[] {
  if (vertices.length < 2) return [];
  const segments: Segment[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const nextIdx = (i + 1) % vertices.length;
    segments.push({ p1: vertices[i], p2: vertices[nextIdx] });
  }
  return segments;
}

/** 0 -> Collinear, 1 -> Clockwise, 2 -> Counterclockwise */
function orientation(p: Point, q: Point, r: Point): number {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(val) < EPSILON) return 0;
  return val > 0 ? 1 : 2;
}

/** Checks if point q lies on segment pr (assuming p, q, r are collinear) */
function onSegment(p: Point, q: Point, r: Point): boolean {
  return (
    q.x <= Math.max(p.x, r.x) + EPSILON &&
    q.x >= Math.min(p.x, r.x) - EPSILON &&
    q.y <= Math.max(p.y, r.y) + EPSILON &&
    q.y >= Math.min(p.y, r.y) - EPSILON
  );
}

/**
 * Returns true if segment s1 (p1-p2) intersects segment s2 (p3-p4).
 * If allowEndpointsTouch is false, sharing a single endpoint will NOT be counted as an intersection.
 */
export function doSegmentsIntersect(
  s1: Segment,
  s2: Segment,
  allowEndpointsTouch: boolean = true
): boolean {
  const { p1, p2 } = s1;
  const { p1: p3, p2: p4 } = s2;

  // Check if endpoints are identical
  const pointsMatch = (a: Point, b: Point) =>
    Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;

  const sharesEndpoint =
    pointsMatch(p1, p3) || pointsMatch(p1, p4) || pointsMatch(p2, p3) || pointsMatch(p2, p4);

  if (sharesEndpoint && !allowEndpointsTouch) {
    return false;
  }

  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);

  // General intersection case
  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  // Collinear overlap cases
  if (o1 === 0 && onSegment(p1, p3, p2)) return true;
  if (o2 === 0 && onSegment(p1, p4, p2)) return true;
  if (o3 === 0 && onSegment(p3, p1, p4)) return true;
  if (o4 === 0 && onSegment(p3, p2, p4)) return true;

  return false;
}