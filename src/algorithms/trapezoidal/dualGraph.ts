import { type Point, type Segment, type TrapezoidCell } from '../../types/geometry';
import { type ConnectivityGraph, type GraphNode, type GraphEdge } from '../../types/graph';

const MIN_OVERLAP_PX = 1.0;

/**
 * Builds the dual connectivity graph G for trapezoidal decomposition.
 * Each cell is a node at its centroid.
 * An edge connects two adjacent cells that share a vertical boundary segment in C_free.
 * The waypoint Q_j is the midpoint of the shared vertical boundary.
 */
export function buildTrapezoidalDualGraph(cells: TrapezoidCell[]): ConnectivityGraph {
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

  const n = cells.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const cellA = cells[i];
      const cellB = cells[j];

      // Check if cellA's right boundary matches cellB's left boundary
      let leftCell: TrapezoidCell | null = null;
      let rightCell: TrapezoidCell | null = null;

      if (Math.abs(cellA.rightX - cellB.leftX) < 1.0) {
        leftCell = cellA;
        rightCell = cellB;
      } else if (Math.abs(cellB.rightX - cellA.leftX) < 1.0) {
        leftCell = cellB;
        rightCell = cellA;
      }

      if (!leftCell || !rightCell) continue;

      const sharedX = (leftCell.rightX + rightCell.leftX) / 2;

      // Vertical interval on leftCell's right side
      const yLeftTop = leftCell.topSegment.p2.y;
      const yLeftBot = leftCell.bottomSegment.p2.y;
      const leftYMin = Math.min(yLeftTop, yLeftBot);
      const leftYMax = Math.max(yLeftTop, yLeftBot);

      // Vertical interval on rightCell's left side
      const yRightTop = rightCell.topSegment.p1.y;
      const yRightBot = rightCell.bottomSegment.p1.y;
      const rightYMin = Math.min(yRightTop, yRightBot);
      const rightYMax = Math.max(yRightTop, yRightBot);

      // Overlap of the two vertical intervals
      const yStart = Math.max(leftYMin, rightYMin);
      const yEnd = Math.min(leftYMax, rightYMax);

      if (yEnd - yStart > MIN_OVERLAP_PX) {
        const seg: Segment = {
          p1: { x: Math.round(sharedX * 10) / 10, y: Math.round(yStart * 10) / 10 },
          p2: { x: Math.round(sharedX * 10) / 10, y: Math.round(yEnd * 10) / 10 },
        };

        const waypoint: Point = {
          x: seg.p1.x,
          y: Math.round(((yStart + yEnd) / 2) * 10) / 10,
        };

        adjacency.get(leftCell.id)?.push({
          fromNodeId: leftCell.id,
          toNodeId: rightCell.id,
          waypoint,
          boundarySegment: seg,
        });

        adjacency.get(rightCell.id)?.push({
          fromNodeId: rightCell.id,
          toNodeId: leftCell.id,
          waypoint,
          boundarySegment: seg,
        });
      }
    }
  }

  return { nodes, adjacency };
}

