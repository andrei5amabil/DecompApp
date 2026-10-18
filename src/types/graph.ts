import { type Point, type Segment } from './geometry';

export interface GraphNode {
  id: number;         
  cellId: number;
  center: Point;      
}

export interface GraphEdge {
  fromNodeId: number;
  toNodeId: number;
  waypoint: Point;
  boundarySegment: Segment;
}

export interface ConnectivityGraph {
  nodes: Map<number, GraphNode>;
  adjacency: Map<number, GraphEdge[]>;
}