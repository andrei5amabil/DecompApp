export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  p1: Point;
  p2: Point;
}

export interface Polygon {
  id: string;
  vertices: Point[];
  isClosed: boolean;
}

/** Represents a triangular cell k_i produced by triangulation */
export interface TriangleCell {
  id: number; // Numeric label k_i (e.g., 1, 2, 3...)
  vertices: [Point, Point, Point];
  edges: [Segment, Segment, Segment];
  centroid: Point;
}

/** Represents a trapezoidal (or degenerate triangular) cell */
export interface TrapezoidCell {
  id: number;
  leftX: number;
  rightX: number;
  topSegment: Segment;
  bottomSegment: Segment;
  vertices: Point[]; // 3 or 4 bounding vertices in clockwise/counter-clockwise order
  centroid: Point;
}

export type Cell = TriangleCell | TrapezoidCell;