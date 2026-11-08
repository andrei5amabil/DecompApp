import { type PlannerInputs, type PlannerResult, type WaypointPath } from '../../types/planner';
import { type Point, type Segment } from '../../types/geometry';
import { type ConnectivityGraph, type GraphEdge } from '../../types/graph';
import {
  computeTrapezoidalDecomposition,
  locatePointInTrapezoids,
} from './trapezoidDecomposer';
import { buildTrapezoidalDualGraph } from './dualGraph';

function euclideanDistance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

interface TrapezoidalSearchResult {
  nodePath: number[];
  edgesTraversed: GraphEdge[];
}

/**
 * Verifies if targetNodeId can be reached from fromNodeId without traversing
 * any cell in the blocked set.
 */
function canReachTarget(
  graph: ConnectivityGraph,
  fromNodeId: number,
  targetNodeId: number,
  blocked: Set<number>
): boolean {
  if (fromNodeId === targetNodeId) return true;
  if (blocked.has(fromNodeId)) return false;

  const queue: number[] = [fromNodeId];
  const seen = new Set<number>([fromNodeId, ...blocked]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === targetNodeId) return true;

    const edges = graph.adjacency.get(current) || [];
    for (const edge of edges) {
      if (!seen.has(edge.toNodeId)) {
        seen.add(edge.toNodeId);
        queue.push(edge.toNodeId);
      }
    }
  }

  return false;
}

/**
 * Checks whether entering edge.toNodeId via edge (at x = edge.waypoint.x)
 * can progress toward targetNodeId without immediately U-turning back across
 * the exact same vertical boundary x = edge.waypoint.x.
 */
function canProgressWithoutImmediateUTurn(
  graph: ConnectivityGraph,
  edge: GraphEdge,
  targetNodeId: number,
  visited: Set<number>
): boolean {
  const nextCellId = edge.toNodeId;
  if (nextCellId === targetNodeId) return true;

  const entryX = edge.waypoint.x;
  const nextEdges = graph.adjacency.get(nextCellId) || [];
  const nextBlocked = new Set<number>([...visited, nextCellId]);

  for (const outEdge of nextEdges) {
    if (visited.has(outEdge.toNodeId)) continue;
    if (
      Math.abs(outEdge.waypoint.x - entryX) > 1e-2 &&
      canReachTarget(graph, outEdge.toNodeId, targetNodeId, nextBlocked)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Computes the path for trapezoidal decomposition.
 * When encountering two (or more) valid choices for the next move,
 * the shortest option (shortest move distance to the waypoint) is chosen.
 */
export function findTrapezoidalPath(
  graph: ConnectivityGraph,
  startCellId: number,
  targetCellId: number,
  startPoint: Point,
  finishPoint: Point
): TrapezoidalSearchResult | null {
  if (startCellId === targetCellId) {
    return { nodePath: [startCellId], edgesTraversed: [] };
  }

  function search(
    currentCellId: number,
    currentPos: Point,
    visited: Set<number>,
    nodePath: number[],
    edgesTraversed: GraphEdge[]
  ): TrapezoidalSearchResult | null {
    if (currentCellId === targetCellId) {
      return { nodePath: [...nodePath], edgesTraversed: [...edgesTraversed] };
    }

    const allEdges = graph.adjacency.get(currentCellId) || [];

    // 1. A valid choice is an unvisited neighboring cell that can reach targetCellId
    let validEdges = allEdges.filter(
      (edge) =>
        !visited.has(edge.toNodeId) &&
        canReachTarget(graph, edge.toNodeId, targetCellId, visited)
    );

    if (validEdges.length === 0) {
      return null;
    }

    // 2. Eliminate redundant loop neighbors whose only path to targetCellId
    // must pass through another direct neighbor of currentCellId
    if (validEdges.length > 1) {
      const neighborNodeIds = validEdges.map((e) => e.toNodeId);
      const nonRedundantEdges = validEdges.filter((edge) => {
        const blockedWithOtherNeighbors = new Set<number>(visited);
        for (const otherId of neighborNodeIds) {
          if (otherId !== edge.toNodeId) {
            blockedWithOtherNeighbors.add(otherId);
          }
        }
        return canReachTarget(
          graph,
          edge.toNodeId,
          targetCellId,
          blockedWithOtherNeighbors
        );
      });

      if (nonRedundantEdges.length > 0) {
        validEdges = nonRedundantEdges;
      }
    }

    // 3. Prefer forward choices that do not force an immediate U-turn in the next cell
    if (validEdges.length > 1) {
      const forwardEdges = validEdges.filter((edge) =>
        canProgressWithoutImmediateUTurn(graph, edge, targetCellId, visited)
      );
      if (forwardEdges.length > 0) {
        validEdges = forwardEdges;
      }
    }

    // 4. When encountering two or more valid choices on the next move, choose the shortest option
    validEdges.sort((a, b) => {
      const aIsTarget = a.toNodeId === targetCellId;
      const bIsTarget = b.toNodeId === targetCellId;
      if (aIsTarget && !bIsTarget) return -1;
      if (!aIsTarget && bIsTarget) return 1;

      if (aIsTarget && bIsTarget) {
        const totalA =
          euclideanDistance(currentPos, a.waypoint) +
          euclideanDistance(a.waypoint, finishPoint);
        const totalB =
          euclideanDistance(currentPos, b.waypoint) +
          euclideanDistance(b.waypoint, finishPoint);
        return totalA - totalB;
      }

      const distA = euclideanDistance(currentPos, a.waypoint);
      const distB = euclideanDistance(currentPos, b.waypoint);

      if (Math.abs(distA - distB) > 1e-4) {
        return distA - distB; // Shortest option first
      }

      // Tie-breaker: distance to destination point
      const toFinishA = euclideanDistance(a.waypoint, finishPoint);
      const toFinishB = euclideanDistance(b.waypoint, finishPoint);
      if (Math.abs(toFinishA - toFinishB) > 1e-4) {
        return toFinishA - toFinishB;
      }

      return a.toNodeId - b.toNodeId;
    });

    for (const edge of validEdges) {
      visited.add(edge.toNodeId);
      nodePath.push(edge.toNodeId);
      edgesTraversed.push(edge);

      const result = search(
        edge.toNodeId,
        edge.waypoint,
        visited,
        nodePath,
        edgesTraversed
      );

      if (result) return result;

      // Backtrack if needed
      edgesTraversed.pop();
      nodePath.pop();
      visited.delete(edge.toNodeId);
    }

    return null;
  }

  const visited = new Set<number>([startCellId]);
  return search(startCellId, startPoint, visited, [startCellId], []);
}

export function solveTrapezoidalDecomposition(inputs: PlannerInputs): PlannerResult {
  const startTime = performance.now();

  if (!inputs.field || inputs.field.length < 3) {
    return {
      type: 'TRAPEZOIDAL',
      cells: [],
      graph: { nodes: new Map(), adjacency: new Map() },
      startCellId: null,
      targetCellId: null,
      path: null,
      executionTimeMs: 0,
      error: 'Incomplete field boundary.',
      verticalCuts: [],
    };
  }

  // 1. Decompose C_free into trapezoidal cells and compute free vertical cuts
  const { cells, verticalCuts } = computeTrapezoidalDecomposition(
    inputs.field,
    inputs.obstacles
  );

  // 2. Build Connectivity Dual Graph G
  const graph = buildTrapezoidalDualGraph(cells);

  // 3. Locate start and finish cells
  const startCellId = inputs.startPoint
    ? locatePointInTrapezoids(inputs.startPoint, cells)
    : null;
  const targetCellId = inputs.finishPoint
    ? locatePointInTrapezoids(inputs.finishPoint, cells)
    : null;

  // 4. Solve path if both endpoints exist
  let solvedPath: WaypointPath | null = null;

  if (startCellId && targetCellId && inputs.startPoint && inputs.finishPoint) {
    const searchResult = findTrapezoidalPath(
      graph,
      startCellId,
      targetCellId,
      inputs.startPoint,
      inputs.finishPoint
    );

    if (searchResult) {
      const cellMap = new Map(cells.map((c) => [c.id, c]));
      const waypoints: Point[] = [inputs.startPoint];
      const edges = searchResult.edgesTraversed;
      for (let i = 0; i < edges.length; i++) {
        if (
          i > 0 &&
          Math.abs(edges[i - 1].waypoint.x - edges[i].waypoint.x) < 1e-2
        ) {
          // U-turn across two cuts on the same vertical boundary of an intermediate cell:
          // route through the cell's interior centroid to avoid grazing the obstacle wall at x
          const turnCell = cellMap.get(edges[i].fromNodeId);
          if (turnCell) {
            waypoints.push(turnCell.centroid);
          }
        }
        waypoints.push(edges[i].waypoint); // Midpoint of shared vertical cut
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
    type: 'TRAPEZOIDAL',
    cells,
    graph,
    startCellId,
    targetCellId,
    path: solvedPath,
    executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
    verticalCuts,
  };
}
