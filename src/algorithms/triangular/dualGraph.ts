import { type Point, type Segment, type TriangleCell } from '../../types/geometry';
import { type ConnectivityGraph, type GraphNode, type GraphEdge } from '../../types/graph';

const EPSILON = 1e-4;

function pointsEqual(a: Point | undefined, b: Point | undefined): boolean {
  if (!a || !b) return false;
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

function segmentsEqual(s1: Segment, s2: Segment): boolean {
  if (!s1 || !s2) return false;
  return (
    (pointsEqual(s1.p1, s2.p1) && pointsEqual(s1.p2, s2.p2)) ||
    (pointsEqual(s1.p1, s2.p2) && pointsEqual(s1.p2, s2.p1))
  );
}

function computeMidpoint(p1: Point, p2: Point): Point {
  return {
    x: Math.round(((p1.x + p2.x) / 2) * 10) / 10,
    y: Math.round(((p1.y + p2.y) / 2) * 10) / 10,
  };
}

/** Builds dual graph G where nodes = triangles and edges = shared free edges */
export function buildTriangularDualGraph(cells: TriangleCell[]): ConnectivityGraph {
  const nodes = new Map<number, GraphNode>();
  const adjacency = new Map<number, GraphEdge[]>();

  for (const cell of cells) {
    nodes.set(cell.id, {
      id: cell.id,
      cellId: cell.id,
      center: cell.centroid,
    });
    adjacency.set(cell.id, []);
  }

  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const cellA = cells[i];
      const cellB = cells[j];

      for (const edgeA of cellA.edges) {
        for (const edgeB of cellB.edges) {
          if (segmentsEqual(edgeA, edgeB)) {
            const midpoint = computeMidpoint(edgeA.p1, edgeA.p2);

            adjacency.get(cellA.id)?.push({
              fromNodeId: cellA.id,
              toNodeId: cellB.id,
              waypoint: midpoint,
              boundarySegment: edgeA,
            });

            adjacency.get(cellB.id)?.push({
              fromNodeId: cellB.id,
              toNodeId: cellA.id,
              waypoint: midpoint,
              boundarySegment: edgeA,
            });
          }
        }
      }
    }
  }

  return { nodes, adjacency };
}