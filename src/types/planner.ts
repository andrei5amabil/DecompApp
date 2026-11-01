import { type Point, type Segment, type TriangleCell, type TrapezoidCell } from './geometry';
import { type ConnectivityGraph } from './graph';

export type DecompositionType = 'TRIANGULAR' | 'TRAPEZOIDAL';

export type DrawingTool =
  | 'IDLE'
  | 'DRAW_FIELD'
  | 'DRAW_OBSTACLE'
  | 'SET_START'   // C_initial
  | 'SET_FINISH';  // C_final

export interface PlannerInputs {
  field: Point[] | null;          // Outer boundary polygon
  obstacles: Point[][];           // Arbitrary concave obstacles
  startPoint: Point | null;       // C_initial
  finishPoint: Point | null;      // C_final
}

export interface WaypointPath {
  /** Complete sequence: C_initial -> Q_1 -> Q_2 -> ... -> Q_m -> C_final */
  points: Point[];
  segments: Segment[];
  traversedCellIds: number[];
  totalLength: number;
}

export interface PlannerResult {
  type: DecompositionType;
  cells: TriangleCell[] | TrapezoidCell[];
  graph: ConnectivityGraph;
  startCellId: number | null;
  targetCellId: number | null;
  path: WaypointPath | null;
  executionTimeMs: number;
  error?: string;
  verticalCuts?: Segment[]; // Free-space vertical cuts for trapezoidal decomposition
}

export interface LayerVisibility {
  showGeometry: boolean;      // Field and obstacles
  showDecomposition: boolean; // Cells (triangles / trapezoids & perpendiculars) and labels k_i
  showGraph: boolean;         // Dual connectivity graph G
  showWaypoints: boolean;     // Q_j midpoint markers
  showPath: boolean;          // Final trajectory line
}
