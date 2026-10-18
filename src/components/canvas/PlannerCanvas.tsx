import React, { useState, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Text } from 'react-konva';
import { type KonvaEventObject } from 'konva/lib/Node';
import { type Point } from '../../types/geometry';
import { type DrawingTool, type PlannerInputs } from '../../types/planner';
import { DrawingToolbar } from '../controls/DrawingToolbar';
import {
  getDistance,
  validateNextVertex,
  validatePolygonClosure,
  validatePointInFreeSpace,
} from '../../algorithms/common/validation';

interface PlannerCanvasProps {
  width?: number;
  height?: number;
}

const SNAP_RADIUS = 15;

export const PlannerCanvas: React.FC<PlannerCanvasProps> = ({
  width = 850,
  height = 550,
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

  const notifyError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 3500);
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

    // 1. Start / Finish point markers
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

    // 3. Placing an intermediate vertex: validate BEFORE appending
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
        return; // Reject click immediately
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
    setActiveTool('DRAW_FIELD');
  };

  const lastActivePoint = activePoints[activePoints.length - 1];
  const rubberBandTarget = isSnapping && activePoints.length >= 3 ? activePoints[0] : cursorPos;
  const rubberBandCoords =
    lastActivePoint && rubberBandTarget
      ? [lastActivePoint.x, lastActivePoint.y, rubberBandTarget.x, rubberBandTarget.y]
      : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}

      <div
        style={{
          border: '2px solid #cbd5e1',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          width,
          height,
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
          <Layer>
            {/* Field */}
            {inputs.field && (
              <Line
                points={inputs.field.flatMap((p) => [p.x, p.y])}
                closed={true}
                fill="#f8fafc"
                stroke="#0284c7"
                strokeWidth={3}
                lineJoin="round"
              />
            )}

            {/* Obstacles (Teal) */}
            {inputs.obstacles.map((obs, idx) => (
              <React.Fragment key={`obs-${idx}`}>
                <Line
                  points={obs.flatMap((p) => [p.x, p.y])}
                  closed={true}
                  fill="#008080"
                  stroke="#004d40"
                  strokeWidth={2}
                  lineJoin="round"
                />
                {obs.map((p, pIdx) => (
                  <Circle key={`obs-${idx}-${pIdx}`} x={p.x} y={p.y} radius={3.5} fill="#004d40" />
                ))}
              </React.Fragment>
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

            {/* Rubber-band preview line */}
            {rubberBandCoords.length === 4 && (
              <Line
                points={rubberBandCoords}
                stroke={isSnapping ? '#16a34a' : '#94a3b8'}
                strokeWidth={isSnapping ? 2 : 1.5}
                dash={isSnapping ? undefined : [5, 4]}
              />
            )}

            {/* Placed vertices */}
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
                    radius={canSnap && isSnapping ? 6.5 : 4.5}
                    fill={canSnap && isSnapping ? '#16a34a' : '#0284c7'}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                </React.Fragment>
              );
            })}

            {/* C_initial */}
            {inputs.startPoint && (
              <React.Fragment>
                <Circle
                  x={inputs.startPoint.x}
                  y={inputs.startPoint.y}
                  radius={7}
                  fill="#800000"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <Text
                  x={inputs.startPoint.x + 9}
                  y={inputs.startPoint.y - 7}
                  text="C_init"
                  fontSize={13}
                  fontStyle="bold"
                  fill="#00008b"
                />
              </React.Fragment>
            )}

            {/* C_final */}
            {inputs.finishPoint && (
              <React.Fragment>
                <Circle
                  x={inputs.finishPoint.x}
                  y={inputs.finishPoint.y}
                  radius={7}
                  fill="#800000"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <Text
                  x={inputs.finishPoint.x + 9}
                  y={inputs.finishPoint.y - 7}
                  text="C_final"
                  fontSize={13}
                  fontStyle="bold"
                  fill="#00008b"
                />
              </React.Fragment>
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};