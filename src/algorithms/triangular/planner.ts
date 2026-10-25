import { type PlannerInputs, type PlannerResult, type WaypointPath } from '../../types/planner';
import { type Point, type Segment } from '../../types/geometry';
import { computeTriangulation, isPointInTriangle } from './triangulator';
import { buildTriangularDualGraph } from './dualGraph';
import { findGraphPath } from '../common/search';

function euclideanDistance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function solveTriangularDecomposition(inputs: PlannerInputs): PlannerResult {
  const startTime = performance.now();

  if (!inputs.field || inputs.field.length < 3) {
    return {
      type: 'TRIANGULAR',
      cells: [],
      graph: { nodes: new Map(), adjacency: new Map() },
      startCellId: null,
      targetCellId: null,
      path: null,
      executionTimeMs: 0,
      error: 'Incomplete field boundary.',
    };
  }

  // 1. Triangulate C_free
  const cells = computeTriangulation(inputs.field, inputs.obstacles);

  // 2. Build Connectivity Graph G
  const graph = buildTriangularDualGraph(cells);

  // 3. Locate start and finish cells
  let startCellId: number | null = null;
  let targetCellId: number | null = null;

  if (inputs.startPoint) {
    for (const cell of cells) {
      if (isPointInTriangle(inputs.startPoint, cell.vertices[0], cell.vertices[1], cell.vertices[2])) {
        startCellId = cell.id;
        break;
      }
    }
  }

  if (inputs.finishPoint) {
    for (const cell of cells) {
      if (isPointInTriangle(inputs.finishPoint, cell.vertices[0], cell.vertices[1], cell.vertices[2])) {
        targetCellId = cell.id;
        break;
      }
    }
  }

  // 4. Solve path if both endpoints exist
  let solvedPath: WaypointPath | null = null;

  if (startCellId && targetCellId && inputs.startPoint && inputs.finishPoint) {
    const searchResult = findGraphPath(graph, startCellId, targetCellId);

    if (searchResult) {
      const waypoints: Point[] = [inputs.startPoint];
      for (const edge of searchResult.edgesTraversed) {
        waypoints.push(edge.waypoint); // Midpoints Q_j
      }
      waypoints.push(inputs.finishPoint);

      const segments: Segment[] = [];
      let totalLength = 0;
      for (let i = 0; i < waypoints.length - 1; i++) {
        segments.push({ p1: waypoints[i], p2: waypoints[i + 1] });
        totalLength += euclideanDistance(waypoints[i], waypoints[i + 1]);
      }

      solvedPath = {
        points: waypoints,
        segments,
        traversedCellIds: searchResult.nodePath,
        totalLength: Math.round(totalLength * 10) / 10,
      };
    }
  }

  return {
    type: 'TRIANGULAR',
    cells,
    graph,
    startCellId,
    targetCellId,
    path: solvedPath,
    executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
  };
}