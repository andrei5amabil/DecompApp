import { type Point, type Segment } from '../../types/geometry';
import { type DrawingTool } from '../../types/planner';
import { doSegmentsIntersect, getPolygonSegments } from './intersections';
import { isPointInPolygon } from './pointInPolygon';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

const MIN_VERTEX_DISTANCE = 8; // Disallow micro-clicks / duplicate vertices

export function getDistance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Validates a single click before appending it as a new vertex to activePoints.
 */
export function validateNextVertex(
  newPoint: Point,
  activePoints: Point[],
  tool: DrawingTool,
  field: Point[] | null,
  obstacles: Point[][]
): ValidationResult {
  // 1. Initial vertex of an obstacle
  if (activePoints.length === 0) {
    if (tool === 'DRAW_OBSTACLE') {
      if (!field) {
        return { isValid: false, error: 'Draw the field boundary first.' };
      }
      if (!isPointInPolygon(newPoint, field)) {
        return { isValid: false, error: 'Obstacle must start inside the field.' };
      }
      for (let idx = 0; idx < obstacles.length; idx++) {
        if (isPointInPolygon(newPoint, obstacles[idx])) {
          return { isValid: false, error: `Cannot place point inside obstacle #${idx + 1}.` };
        }
      }
    }
    return { isValid: true };
  }

  // 2. Prevent micro-clicks / duplicate vertices
  const lastPoint = activePoints[activePoints.length - 1];
  if (getDistance(lastPoint, newPoint) < MIN_VERTEX_DISTANCE) {
    return { isValid: false, error: 'Point is too close to the previous vertex.' };
  }

  const candidateSegment: Segment = { p1: lastPoint, p2: newPoint };

  // 3. Self-intersection check against active polygon segments
  for (let i = 0; i < activePoints.length - 2; i++) {
    const activeSeg: Segment = {
      p1: activePoints[i],
      p2: activePoints[i + 1],
    };
    if (doSegmentsIntersect(candidateSegment, activeSeg, false)) {
      return { isValid: false, error: 'Line intersects an earlier edge of this polygon.' };
    }
  }

  // 4. Obstacle-specific boundary and containment constraints
  if (tool === 'DRAW_OBSTACLE') {
    if (!field) {
      return { isValid: false, error: 'Draw the field boundary first.' };
    }

    // New vertex must remain inside field
    if (!isPointInPolygon(newPoint, field)) {
      return { isValid: false, error: 'Cannot place vertex outside the field boundary.' };
    }

    // New vertex cannot be placed inside an existing obstacle
    for (let idx = 0; idx < obstacles.length; idx++) {
      if (isPointInPolygon(newPoint, obstacles[idx])) {
        return { isValid: false, error: `Vertex lies inside obstacle #${idx + 1}.` };
      }
    }

    // Candidate segment cannot cross the field boundary
    const fieldSegments = getPolygonSegments(field);
    for (const fSeg of fieldSegments) {
      if (doSegmentsIntersect(candidateSegment, fSeg, true)) {
        return { isValid: false, error: 'Edge crosses the field boundary.' };
      }
    }

    // Candidate segment cannot cross any existing obstacle edges
    for (let idx = 0; idx < obstacles.length; idx++) {
      const obsSegments = getPolygonSegments(obstacles[idx]);
      for (const oSeg of obsSegments) {
        if (doSegmentsIntersect(candidateSegment, oSeg, true)) {
          return { isValid: false, error: `Edge crosses obstacle #${idx + 1}.` };
        }
      }
    }
  }

  return { isValid: true };
}

/**
 * Validates the closing edge (from last vertex back to P0) and final polygon topology.
 */
export function validatePolygonClosure(
  vertices: Point[],
  tool: DrawingTool,
  field: Point[] | null,
  obstacles: Point[][]
): ValidationResult {
  if (vertices.length < 3) {
    return { isValid: false, error: 'A polygon must have at least 3 vertices.' };
  }

  // 1. Check closing segment (P_last -> P0) against intermediate segments
  const closingSegment: Segment = {
    p1: vertices[vertices.length - 1],
    p2: vertices[0],
  };

  // It cannot intersect any edge except the ones sharing P_last or P0
  for (let i = 1; i < vertices.length - 2; i++) {
    const seg: Segment = { p1: vertices[i], p2: vertices[i + 1] };
    if (doSegmentsIntersect(closingSegment, seg, false)) {
      return { isValid: false, error: 'Closing edge creates a self-intersection.' };
    }
  }

  // 2. Obstacle-specific closure checks
  if (tool === 'DRAW_OBSTACLE') {
    if (!field) {
      return { isValid: false, error: 'Field does not exist.' };
    }

    const fieldSegments = getPolygonSegments(field);
    for (const fSeg of fieldSegments) {
      if (doSegmentsIntersect(closingSegment, fSeg, true)) {
        return { isValid: false, error: 'Closing edge crosses the field boundary.' };
      }
    }

    for (let idx = 0; idx < obstacles.length; idx++) {
      const obsSegments = getPolygonSegments(obstacles[idx]);
      for (const oSeg of obsSegments) {
        if (doSegmentsIntersect(closingSegment, oSeg, true)) {
          return { isValid: false, error: `Closing edge crosses obstacle #${idx + 1}.` };
        }
      }
      if (isPointInPolygon(vertices[0], obstacles[idx])) {
        return { isValid: false, error: `Obstacle cannot be nested inside obstacle #${idx + 1}.` };
      }
      if (isPointInPolygon(obstacles[idx][0], vertices)) {
        return { isValid: false, error: `Obstacle cannot envelop obstacle #${idx + 1}.` };
      }
    }
  }

  return { isValid: true };
}

/** Validates that C_initial or C_final is in free space */
export function validatePointInFreeSpace(
  point: Point,
  field: Point[] | null,
  obstacles: Point[][]
): ValidationResult {
  if (!field) {
    return { isValid: false, error: 'Draw the field boundary first.' };
  }

  if (!isPointInPolygon(point, field)) {
    return { isValid: false, error: 'Point must be placed inside the field boundary.' };
  }

  for (let idx = 0; idx < obstacles.length; idx++) {
    if (isPointInPolygon(point, obstacles[idx])) {
      return {
        isValid: false,
        error: `Point cannot be placed inside obstacle #${idx + 1}.`,
      };
    }
  }

  return { isValid: true };
}