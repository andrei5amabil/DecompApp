import React, { useState, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Text, Group } from 'react-konva';
import { type KonvaEventObject } from 'konva/lib/Node';
import { type Point, type TriangleCell } from '../../types/geometry';
import { type DrawingTool, type PlannerInputs, type PlannerResult, type LayerVisibility } from '../../types/planner';
import { DrawingToolbar } from '../controls/DrawingToolbar';
import { LayerControls } from '../controls/LayerControls';
import {
  validateNextVertex,
  validatePolygonClosure,
  validatePointInFreeSpace,
} from '../../algorithms/common/validation';
import { solveTriangularDecomposition } from '../../algorithms/triangular/planner';

interface PlannerCanvasProps {
  width?: number;
  height?: number;
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

  // Algorithm Results & Layer Toggles
  const [plannerResult, setPlannerResult] = useState<PlannerResult | null>(null);
  const [visibility, setVisibility] = useState<LayerVisibility>({
    showGeometry: true,
    showDecomposition: true,
    showGraph: true,
    showWaypoints: true,
    showPath: true,
  });

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
  const resetResult = () => setPlannerResult(null);

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

      resetResult();
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

      resetResult();
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
    setPlannerResult(null);
    setActiveTool('DRAW_FIELD');
  };

  const handleLaunchSolver = () => {
    if (!inputs.field || !inputs.startPoint || !inputs.finishPoint) {
      notifyError('Set Field, C_init, and C_final before running.');
      return;
    }

    const result = solveTriangularDecomposition(inputs);
    if (result.error) {
      notifyError(result.error);
    } else if (!result.path) {
      notifyError('No path found! C_init and C_final might be in disconnected regions.');
    }
    setPlannerResult(result);
  };

  const handleToggleLayer = (key: keyof LayerVisibility) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const lastActivePoint = activePoints[activePoints.length - 1];
  const rubberBandTarget = isSnapping && activePoints.length >= 3 ? activePoints[0] : cursorPos;
  const rubberBandCoords =
    lastActivePoint && rubberBandTarget
      ? [lastActivePoint.x, lastActivePoint.y, rubberBandTarget.x, rubberBandTarget.y]
      : [];

  const traversedCellSet = new Set(plannerResult?.path?.traversedCellIds || []);
  const canSolve = Boolean(inputs.field && inputs.startPoint && inputs.finishPoint);

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
        result={plannerResult}
        visibility={visibility}
        onToggleLayer={handleToggleLayer}
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
          {/* ================= 1. DECOMPOSITION & SEARCH LAYER ================= */}
          {plannerResult && visibility.showDecomposition && (
            <Layer>
              {(plannerResult.cells as TriangleCell[]).map((cell) => {
                const isTraversed = traversedCellSet.has(cell.id);
                return (
                  <Group key={`cell-${cell.id}`}>
                    {/* Triangle Polygon (Yellow if traversed, matching slide 2) */}
                    <Line
                      points={cell.vertices.flatMap((v) => [v.x, v.y])}
                      closed={true}
                      fill={isTraversed ? 'rgba(254, 240, 138, 0.55)' : 'transparent'}
                      stroke="#991b1b"
                      strokeWidth={1.2}
                      lineJoin="round"
                    />

                    {/* Cell Label Circle & Number k_i at Centroid */}
                    <Circle
                      x={cell.centroid.x}
                      y={cell.centroid.y}
                      radius={10}
                      fill={isTraversed ? '#fef08a' : '#ffffff'}
                      stroke="#991b1b"
                      strokeWidth={1.2}
                    />
                    <Text
                      x={cell.centroid.x - 7}
                      y={cell.centroid.y - 5}
                      width={14}
                      align="center"
                      text={cell.id.toString()}
                      fontSize={10}
                      fontStyle="bold"
                      fill="#1e293b"
                    />
                  </Group>
                );
              })}
            </Layer>
          )}

          {/* ================= 2. DUAL CONNECTIVITY GRAPH G LAYER ================= */}
          {plannerResult && visibility.showGraph && (
            <Layer>
              {Array.from(plannerResult.graph.adjacency.entries()).map(([fromId, edges]) => {
                const fromNode = plannerResult.graph.nodes.get(fromId);
                if (!fromNode) return null;

                return edges.map((edge) => {
                  if (fromId > edge.toNodeId) return null; // Render each undirected edge once
                  const toNode = plannerResult.graph.nodes.get(edge.toNodeId);
                  if (!toNode) return null;

                  return (
                    <Line
                      key={`g-edge-${fromId}-${edge.toNodeId}`}
                      points={[fromNode.center.x, fromNode.center.y, toNode.center.x, toNode.center.y]}
                      stroke="#64748b"
                      strokeWidth={1.2}
                      dash={[4, 3]}
                    />
                  );
                });
              })}
            </Layer>
          )}

          {/* ================= 3. USER GEOMETRY LAYER ================= */}
          <Layer>
            {/* Field Boundary */}
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
          {plannerResult?.path && (
            <Layer>
              {/* Solved Path Trajectory Line */}
              {visibility.showPath && (
                <Line
                  points={plannerResult.path.points.flatMap((p) => [p.x, p.y])}
                  stroke="#16a34a"
                  strokeWidth={3.5}
                  lineCap="round"
                  lineJoin="round"
                />
              )}

              {/* Waypoints Q_j at shared edge midpoints */}
              {visibility.showWaypoints &&
                plannerResult.path.points.slice(1, -1).map((q, idx) => (
                  <Group key={`waypoint-${idx}`}>
                    <Circle
                      x={q.x}
                      y={q.y}
                      radius={4.5}
                      fill="#eab308"
                      stroke="#000000"
                      strokeWidth={1}
                    />
                    <Text
                      x={q.x + 6}
                      y={q.y - 10}
                      text={`Q${idx + 1}`}
                      fontSize={11}
                      fontStyle="bold"
                      fill="#0f172a"
                    />
                  </Group>
                ))}
            </Layer>
          )}

          {/* ================= 5. START / FINISH MARKERS ================= */}
          <Layer>
            {inputs.startPoint && (
              <Group>
                <Circle
                  x={inputs.startPoint.x}
                  y={inputs.startPoint.y}
                  radius={7}
                  fill="#800000"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <Text
                  x={inputs.startPoint.x + 8}
                  y={inputs.startPoint.y - 8}
                  text="C_init"
                  fontSize={13}
                  fontStyle="bold"
                  fill="#00008b"
                />
              </Group>
            )}

            {inputs.finishPoint && (
              <Group>
                <Circle
                  x={inputs.finishPoint.x}
                  y={inputs.finishPoint.y}
                  radius={7}
                  fill="#800000"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <Text
                  x={inputs.finishPoint.x + 8}
                  y={inputs.finishPoint.y - 8}
                  text="C_final"
                  fontSize={13}
                  fontStyle="bold"
                  fill="#00008b"
                />
              </Group>
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};