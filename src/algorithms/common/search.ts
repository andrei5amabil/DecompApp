import { type ConnectivityGraph, type GraphEdge } from '../../types/graph';

export interface GraphSearchResult {
  nodePath: number[];
  edgesTraversed: GraphEdge[];
}

/** Computes the shortest sequence of connected cells from start to target */
export function findGraphPath(
  graph: ConnectivityGraph,
  startNodeId: number,
  targetNodeId: number
): GraphSearchResult | null {
  if (startNodeId === targetNodeId) {
    return { nodePath: [startNodeId], edgesTraversed: [] };
  }

  const queue: number[] = [startNodeId];
  const visited = new Set<number>([startNodeId]);
  const parentEdge = new Map<number, GraphEdge>();
  const parentNode = new Map<number, number>();

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === targetNodeId) {
      // Reconstruct cell path
      const nodePath: number[] = [];
      const edgesTraversed: GraphEdge[] = [];
      let curr = targetNodeId;

      while (curr !== startNodeId) {
        nodePath.unshift(curr);
        const edge = parentEdge.get(curr)!;
        edgesTraversed.unshift(edge);
        curr = parentNode.get(curr)!;
      }
      nodePath.unshift(startNodeId);

      return { nodePath, edgesTraversed };
    }

    const neighbors = graph.adjacency.get(current) || [];
    for (const edge of neighbors) {
      if (!visited.has(edge.toNodeId)) {
        visited.add(edge.toNodeId);
        parentNode.set(edge.toNodeId, current);
        parentEdge.set(edge.toNodeId, edge);
        queue.push(edge.toNodeId);
      }
    }
  }

  return null; // No path exists between disjoint regions
}