import React, { useState, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Text, Group } from 'react-konva';
import { type KonvaEventObject } from 'konva/lib/Node';
import { type Point, type TriangleCell, type TrapezoidCell } from '../../types/geometry';
import {
  type DecompositionType,
  type DrawingTool,
  type PlannerInputs,
  type PlannerResult,
  type LayerVisibility,
} from '../../types/planner';
import { DrawingToolbar } from '../controls/DrawingToolbar';
import { LayerControls } from '../controls/LayerControls';
import {
  validateNextVertex,
  validatePolygonClosure,
  validatePointInFreeSpace,
} from '../../algorithms/common/validation';
import { solveTriangularDecomposition } from '../../algorithms/triangular/planner';
import { solveTrapezoidalDecomposition } from '../../algorithms/trapezoidal/planner';

interface PlannerCanvasProps {
  width?: number;
  height?: number;
}

interface DisplayWaypoint {
  x: number;
  y: number;
  label: string;
  isOnPath: boolean;
}

const SNAP_RADIUS = 15;

export const PlannerCanvas: React.FC<PlannerCanvasProps> = ({
  width = 880,
  height = 560,
}) => {
  const [inputs, setInputs] = useState<PlannerInputs>({
    field: null,
    obstacles: [],
    startPoint: null,
    finishPoint: null,
  });

  const [activeTool, setActiveTool] = useState<DrawingTool>('DRAW_FIELD');
  const [activePoints, setActivePoints] = useState<Point[]>([]);
  const [cursorPos, setCursorPos] = useState<Point | null>(null);
  const [isSnapping, setIsSnapping] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active algorithm mode
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<DecompositionType>('TRAPEZOIDAL');

  // Simultaneous paths comparison mode
  const [compareBothPaths, setCompareBothPaths] = useState<boolean>(false);

  // Independent results for each category to prevent cross-contamination
  const [triangularResult, setTriangularResult] = useState<PlannerResult | null>(null);
  const [trapezoidalResult, setTrapezoidalResult] = useState<PlannerResult | null>(null);

  // Independent layer visibility for each category
  const [triangularVisibility, setTriangularVisibility] = useState<LayerVisibility>({
    showGeometry: true,
    showDecomposition: true,
    showGraph: true,
    showWaypoints: true,
    showPath: true,
  });

  const [trapezoidalVisibility, setTrapezoidalVisibility] = useState<LayerVisibility>({
    showGeometry: true,
    showDecomposition: true,
    showGraph: true,
    showWaypoints: true,
    showPath: true,
  });

  const activeResult = selectedAlgorithm === 'TRIANGULAR' ? triangularResult : trapezoidalResult;
  const activeVisibility = selectedAlgorithm === 'TRIANGULAR' ? triangularVisibility : trapezoidalVisibility;

  const getDistance = (p1: Point, p2: Point): number => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const notifyError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 3500);
  };

  // Discard previous results whenever geometry mutations occur
  const resetResults = () => {
    setTriangularResult(null);
    setTrapezoidalResult(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePoints([]);
        setIsSnapping(false);
        setErrorMessage(null);
      } else if (e.key === 'Backspace' || (e.ctrlKey && e.key === 'z')) {
        setActivePoints((prev) => prev.slice(0, -1));
        setIsSnapping(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    const currentCursor: Point = {
      x: Math.round(pointerPos.x),
      y: Math.round(pointerPos.y),
    };

    if (
      (activeTool === 'DRAW_FIELD' || activeTool === 'DRAW_OBSTACLE') &&
      activePoints.length >= 3
    ) {
      if (getDistance(currentCursor, activePoints[0]) <= SNAP_RADIUS) {
        setIsSnapping(true);
        setCursorPos(activePoints[0]);
        return;
      }
    }

    setIsSnapping(false);
    setCursorPos(currentCursor);
  };

  const handleMouseLeave = () => {
    setCursorPos(null);
    setIsSnapping(false);
  };

  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    const clickPoint: Point = {
      x: Math.round(pointerPos.x),
      y: Math.round(pointerPos.y),
    };

    // 1. Start / Finish point placement
    if (activeTool === 'SET_START' || activeTool === 'SET_FINISH') {
      const freeSpaceCheck = validatePointInFreeSpace(
        clickPoint,
        inputs.field,
        inputs.obstacles
      );
      if (!freeSpaceCheck.isValid) {
        notifyError(freeSpaceCheck.error!);
        return;
      }

      resetResults();
      if (activeTool === 'SET_START') {
        setInputs((prev) => ({ ...prev, startPoint: clickPoint }));
      } else {
        setInputs((prev) => ({ ...prev, finishPoint: clickPoint }));
      }
      setErrorMessage(null);
      return;
    }

    // 2. Polygon Closing
    if (isSnapping && activePoints.length >= 3) {
      const closureCheck = validatePolygonClosure(
        activePoints,
        activeTool,
        inputs.field,
        inputs.obstacles
      );
      if (!closureCheck.isValid) {
        notifyError(closureCheck.error!);
        return;
      }

      resetResults();
      if (activeTool === 'DRAW_FIELD') {
        setInputs((prev) => ({ ...prev, field: activePoints }));
        setActivePoints([]);
        setIsSnapping(false);
        setErrorMessage(null);
        setActiveTool('DRAW_OBSTACLE');
        return;
      }

      if (activeTool === 'DRAW_OBSTACLE') {
        setInputs((prev) => ({
          ...prev,
          obstacles: [...prev.obstacles, activePoints],
        }));
        setActivePoints([]);
        setIsSnapping(false);
        setErrorMessage(null);
        return;
      }
    }

    // 3. Regular vertex placement
    if (activeTool === 'DRAW_FIELD' || activeTool === 'DRAW_OBSTACLE') {
      const vertexCheck = validateNextVertex(
        clickPoint,
        activePoints,
        activeTool,
        inputs.field,
        inputs.obstacles
      );

      if (!vertexCheck.isValid) {
        notifyError(vertexCheck.error!);
        return;
      }

      setErrorMessage(null);
      setActivePoints((prev) => [...prev, clickPoint]);
    }
  };

  const handleClearAll = () => {
    setInputs({
      field: null,
      obstacles: [],
      startPoint: null,
      finishPoint: null,
    });
    setActivePoints([]);
    setIsSnapping(false);
    setErrorMessage(null);
    resetResults();
    setActiveTool('DRAW_FIELD');
  };

  const handleLaunchSolver = () => {
    if (!inputs.field || !inputs.startPoint || !inputs.finishPoint) {
      notifyError('Please set Field Boundary, C_initial, and C_final before calculating.');
      return;
    }

    if (selectedAlgorithm === 'TRIANGULAR') {
      const result = solveTriangularDecomposition(inputs);
      if (result.error) {
        notifyError(result.error);
      } else if (!result.path) {
        notifyError('No path found! Endpoints might be in disconnected free-space regions.');
      }
      setTriangularResult(result);
    } else {
      const result = solveTrapezoidalDecomposition(inputs);
      if (result.error) {
        notifyError(result.error);
      } else if (!result.path) {
        notifyError('No path found! Endpoints might be in disconnected free-space regions.');
      }
      setTrapezoidalResult(result);
    }
  };

  const handleSelectAlgorithm = (algo: DecompositionType) => {
    setSelectedAlgorithm(algo);
  };

  const handleToggleLayer = (key: keyof LayerVisibility) => {
    if (selectedAlgorithm === 'TRIANGULAR') {
      setTriangularVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
    } else {
      setTrapezoidalVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const handleToggleCompareBothPaths = () => {
    const nextState = !compareBothPaths;
    setCompareBothPaths(nextState);

    // If enabling comparison and endpoints exist, ensure both solutions are computed
    if (nextState && inputs.field && inputs.startPoint && inputs.finishPoint) {
      if (!triangularResult) {
        const tri = solveTriangularDecomposition(inputs);
        setTriangularResult(tri);
      }
      if (!trapezoidalResult) {
        const trap = solveTrapezoidalDecomposition(inputs);
        setTrapezoidalResult(trap);
      }
    }
  };

  const lastActivePoint = activePoints[activePoints.length - 1];
  const rubberBandTarget = isSnapping && activePoints.length >= 3 ? activePoints[0] : cursorPos;
  const rubberBandCoords =
    lastActivePoint && rubberBandTarget
      ? [lastActivePoint.x, lastActivePoint.y, rubberBandTarget.x, rubberBandTarget.y]
      : [];

  const traversedCellSet = new Set(activeResult?.path?.traversedCellIds || []);
  const canSolve = Boolean(inputs.field && inputs.startPoint && inputs.finishPoint);

  // Waypoints computation for active category
  const displayWaypoints: DisplayWaypoint[] = [];
  if (activeResult && activeVisibility.showWaypoints) {
    if (selectedAlgorithm === 'TRIANGULAR') {
      // In Triangular: show midpoints along the traversed path
      if (activeResult.path) {
        activeResult.path.points.slice(1, -1).forEach((p, idx) => {
          displayWaypoints.push({
            x: p.x,
            y: p.y,
            label: `Q${idx + 1}`,
            isOnPath: true,
          });
        });
      }
    } else {
      // In Trapezoidal: show midpoints of the vertical cuts (Q1, Q2, ...)
      const pathWaypoints = activeResult.path ? activeResult.path.points.slice(1, -1) : [];
      const seen = new Set<string>();

      pathWaypoints.forEach((p, idx) => {
        const key = `${Math.round(p.x)},${Math.round(p.y)}`;
        seen.add(key);
        displayWaypoints.push({
          x: p.x,
          y: p.y,
          label: `Q${idx + 1}`,
          isOnPath: true,
        });
      });

      let nextLabelIdx = pathWaypoints.length + 1;
      // Add remaining vertical cut midpoints from cuts
      if (activeResult.verticalCuts) {
        for (const cut of activeResult.verticalCuts) {
          const midX = cut.p1.x;
          const midY = Math.round(((cut.p1.y + cut.p2.y) / 2) * 10) / 10;
          const key = `${Math.round(midX)},${Math.round(midY)}`;
          if (!seen.has(key)) {
            seen.add(key);
            displayWaypoints.push({
              x: midX,
              y: midY,
              label: `Q${nextLabelIdx++}`,
              isOnPath: false,
            });
          }
        }
      }
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        width: `${width}px`,
        maxWidth: `${width}px`,
        boxSizing: 'border-box',
      }}
    >
      <DrawingToolbar
        currentTool={activeTool}
        onSelectTool={(tool) => {
          setActivePoints([]);
          setIsSnapping(false);
          setErrorMessage(null);
          setActiveTool(tool);
        }}
        hasField={inputs.field !== null}
        obstacleCount={inputs.obstacles.length}
        hasStart={inputs.startPoint !== null}
        hasFinish={inputs.finishPoint !== null}
        onClearAll={handleClearAll}
      />

      <LayerControls
        canSolve={canSolve}
        onSolve={handleLaunchSolver}
        result={activeResult}
        visibility={activeVisibility}
        onToggleLayer={handleToggleLayer}
        selectedAlgorithm={selectedAlgorithm}
        onSelectAlgorithm={handleSelectAlgorithm}
        compareBothPaths={compareBothPaths}
        onToggleCompareBothPaths={handleToggleCompareBothPaths}
        triangularPathLength={triangularResult?.path?.totalLength}
        trapezoidalPathLength={trapezoidalResult?.path?.totalLength}
      />

      {errorMessage && (
        <div
          style={{
            padding: '8px 14px',
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            boxSizing: 'border-box',
            width: '100%',
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Canvas Box */}
      <div
        style={{
          border: '2px solid #cbd5e1',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          width: `${width}px`,
          height: `${height}px`,
          boxSizing: 'border-box',
          cursor: isSnapping
            ? 'pointer'
            : activeTool.startsWith('SET_')
            ? 'crosshair'
            : 'default',
        }}
      >
        <Stage
          width={width}
          height={height}
          onClick={handleStageClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* ================= 1. DECOMPOSITION LAYER (CELLS & LABELS) ================= */}
          {activeResult && activeVisibility.showDecomposition && (
            <Layer>
              {selectedAlgorithm === 'TRIANGULAR' && activeResult.type === 'TRIANGULAR'
                ? (activeResult.cells as TriangleCell[]).map((cell) => {
                    const isTraversed = traversedCellSet.has(cell.id);
                    return (
                      <Group key={`cell-tri-${cell.id}`}>
                        <Line
                          points={cell.vertices.flatMap((v) => [v.x, v.y])}
                          closed={true}
                          fill={isTraversed ? 'rgba(254, 240, 138, 0.55)' : 'transparent'}
                          stroke="#991b1b"
                          strokeWidth={1.2}
                          lineJoin="round"
                        />
                        <Circle
                          x={cell.centroid.x}
                          y={cell.centroid.y}
                          radius={11}
                          fill={isTraversed ? '#fef08a' : '#ffffff'}
                          stroke="#991b1b"
                          strokeWidth={1.2}
                        />
                        <Text
                          x={cell.centroid.x - 9}
                          y={cell.centroid.y - 6}
                          width={18}
                          align="center"
                          text={cell.id.toString()}
                          fontSize={10}
                          fontStyle="bold"
                          fill="#1e293b"
                        />
                      </Group>
                    );
                  })
                : selectedAlgorithm === 'TRAPEZOIDAL' && activeResult.type === 'TRAPEZOIDAL'
                ? (
                    <>
                      {/* Trapezoid cell filled area: NO BLUE BORDER (stroke="transparent") */}
                      {(activeResult.cells as TrapezoidCell[]).map((cell) => {
                        const isTraversed = traversedCellSet.has(cell.id);
                        return (
                          <Line
                            key={`cell-trap-fill-${cell.id}`}
                            points={cell.vertices.flatMap((v) => [v.x, v.y])}
                            closed={true}
                            fill={isTraversed ? 'rgba(254, 240, 138, 0.45)' : 'transparent'}
                            stroke="transparent"
                            strokeWidth={0}
                          />
                        );
                      })}

                      {/* Purple vertical cuts (perpendiculars) combined under Cells & Labels */}
                      {activeResult.verticalCuts?.map((cut, idx) => (
                        <Line
                          key={`vcut-${idx}`}
                          points={[cut.p1.x, cut.p1.y, cut.p2.x, cut.p2.y]}
                          stroke="#7c3aed"
                          strokeWidth={2}
                          lineCap="round"
                        />
                      ))}

                      {/* Centroid label marker k_i */}
                      {(activeResult.cells as TrapezoidCell[]).map((cell) => {
                        const isTraversed = traversedCellSet.has(cell.id);
                        return (
                          <Group key={`cell-trap-label-${cell.id}`}>
                            <Circle
                              x={cell.centroid.x}
                              y={cell.centroid.y}
                              radius={11}
                              fill={isTraversed ? '#fef08a' : '#ffffff'}
                              stroke="#6d28d9"
                              strokeWidth={1.2}
                            />
                            <Text
                              x={cell.centroid.x - 9}
                              y={cell.centroid.y - 6}
                              width={18}
                              align="center"
                              text={cell.id.toString()}
                              fontSize={10}
                              fontStyle="bold"
                              fill="#1e293b"
                            />
                          </Group>
                        );
                      })}
                    </>
                  )
                : null}
            </Layer>
          )}

          {/* ================= 2. DUAL CONNECTIVITY GRAPH G LAYER ================= */}
          {activeResult && activeVisibility.showGraph && (
            <Layer>
              {Array.from(activeResult.graph.adjacency.entries()).map(([fromId, edges]) => {
                const fromNode = activeResult.graph.nodes.get(fromId);
                if (!fromNode) return null;

                return edges.map((edge) => {
                  if (fromId > edge.toNodeId) return null;
                  const toNode = activeResult.graph.nodes.get(edge.toNodeId);
                  if (!toNode) return null;

                  return (
                    <Line
                      key={`g-edge-${selectedAlgorithm}-${fromId}-${edge.toNodeId}`}
                      points={[fromNode.center.x, fromNode.center.y, toNode.center.x, toNode.center.y]}
                      stroke={selectedAlgorithm === 'TRAPEZOIDAL' ? '#818cf8' : '#64748b'}
                      strokeWidth={1.3}
                      dash={[4, 3]}
                    />
                  );
                });
              })}
            </Layer>
          )}

          {/* ================= 3. USER GEOMETRY LAYER ================= */}
          <Layer>
            {/* Field Boundary (Teal outline) */}
            {inputs.field && (
              <Line
                points={inputs.field.flatMap((p) => [p.x, p.y])}
                closed={true}
                fill="transparent"
                stroke="#0f766e"
                strokeWidth={3}
                lineJoin="round"
              />
            )}

            {/* Obstacles (Teal fill matching the reference) */}
            {inputs.obstacles.map((obs, idx) => (
              <Line
                key={`obs-${idx}`}
                points={obs.flatMap((p) => [p.x, p.y])}
                closed={true}
                fill="#008080"
                stroke="#004d40"
                strokeWidth={2}
                lineJoin="round"
              />
            ))}

            {/* In-progress polygon wireframe */}
            {activePoints.length > 1 && (
              <Line
                points={activePoints.flatMap((p) => [p.x, p.y])}
                stroke={activeTool === 'DRAW_FIELD' ? '#0284c7' : '#0d9488'}
                strokeWidth={2}
                lineCap="round"
                lineJoin="round"
              />
            )}

            {/* Rubber-band dashed line */}
            {rubberBandCoords.length === 4 && (
              <Line
                points={rubberBandCoords}
                stroke={isSnapping ? '#16a34a' : '#94a3b8'}
                strokeWidth={isSnapping ? 2 : 1.5}
                dash={isSnapping ? undefined : [5, 4]}
              />
            )}

            {/* Active Drawing Vertices */}
            {activePoints.map((p, idx) => {
              const isP0 = idx === 0;
              const canSnap = isP0 && activePoints.length >= 3;
              return (
                <React.Fragment key={`active-${idx}`}>
                  {canSnap && isSnapping && (
                    <Circle
                      x={p.x}
                      y={p.y}
                      radius={SNAP_RADIUS}
                      fill="rgba(22, 163, 74, 0.2)"
                      stroke="#16a34a"
                      strokeWidth={1.5}
                    />
                  )}
                  <Circle
                    x={p.x}
                    y={p.y}
                    radius={canSnap && isSnapping ? 6.5 : 4}
                    fill={canSnap && isSnapping ? '#16a34a' : '#0284c7'}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                </React.Fragment>
              );
            })}
          </Layer>

          {/* ================= 4. TRAJECTORY & WAYPOINTS LAYER ================= */}
          {/* A: Trajectory Path(s) */}
          <Layer>
            {compareBothPaths ? (
              // SIMULTANEOUS PATHS DISPLAY (Triangular Green + Trapezoidal Blue, purely the paths!)
              <>
                {triangularResult?.path && (
                  <Line
                    points={triangularResult.path.points.flatMap((p) => [p.x, p.y])}
                    stroke="#16a34a"
                    strokeWidth={3.5}
                    lineCap="round"
                    lineJoin="round"
                  />
                )}
                {trapezoidalResult?.path && (
                  <Line
                    points={trapezoidalResult.path.points.flatMap((p) => [p.x, p.y])}
                    stroke="#2563eb"
                    strokeWidth={3.5}
                    lineCap="round"
                    lineJoin="round"
                  />
                )}
              </>
            ) : (
              // Active category single path
              activeVisibility.showPath &&
              activeResult?.path && (
                <Line
                  points={activeResult.path.points.flatMap((p) => [p.x, p.y])}
                  stroke={selectedAlgorithm === 'TRAPEZOIDAL' ? '#2563eb' : '#16a34a'}
                  strokeWidth={3.5}
                  lineCap="round"
                  lineJoin="round"
                />
              )
            )}

            {/* Waypoints Q_j for active category */}
            {!compareBothPaths &&
              activeVisibility.showWaypoints &&
              displayWaypoints.map((wp, idx) => (
                <Group key={`wp-${selectedAlgorithm}-${idx}`}>
                  <Circle
                    x={wp.x}
                    y={wp.y}
                    radius={wp.isOnPath ? 5.5 : 4}
                    fill={wp.isOnPath ? '#fef08a' : '#fef9c3'}
                    stroke={wp.isOnPath ? '#854d0e' : '#a16207'}
                    strokeWidth={wp.isOnPath ? 1.5 : 1}
                  />
                  <Text
                    x={wp.x + 6}
                    y={wp.y - 10}
                    text={wp.label}
                    fontSize={11}
                    fontStyle="bold"
                    fill="#0f172a"
                  />
                </Group>
              ))}
          </Layer>

          {/* ================= 5. START / FINISH MARKERS (C_initial & C_final) ================= */}
          <Layer>
            {inputs.startPoint && (
              <Group>
                <Circle
                  x={inputs.startPoint.x}
                  y={inputs.startPoint.y}
                  radius={7}
                  fill="#16a34a"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <Text
                  x={inputs.startPoint.x + 8}
                  y={inputs.startPoint.y - 8}
                  text="C_initial"
                  fontSize={13}
                  fontStyle="bold"
                  fill="#15803d"
                />
              </Group>
            )}

            {inputs.finishPoint && (
              <Group>
                <Circle
                  x={inputs.finishPoint.x}
                  y={inputs.finishPoint.y}
                  radius={7}
                  fill="#dc2626"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <Text
                  x={inputs.finishPoint.x + 8}
                  y={inputs.finishPoint.y - 8}
                  text="C_final"
                  fontSize={13}
                  fontStyle="bold"
                  fill="#b91c1c"
                />
              </Group>
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};
