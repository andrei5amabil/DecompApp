import React from 'react';
import { type DecompositionType, type LayerVisibility, type PlannerResult } from '../../types/planner';

interface LayerControlsProps {
  canSolve: boolean;
  onSolve: () => void;
  result: PlannerResult | null;
  visibility: LayerVisibility;
  onToggleLayer: (key: keyof LayerVisibility) => void;
  selectedAlgorithm: DecompositionType;
  onSelectAlgorithm: (algo: DecompositionType) => void;
  compareBothPaths: boolean;
  onToggleCompareBothPaths: () => void;
  triangularResult: PlannerResult | null;
  trapezoidalResult: PlannerResult | null;
}

function renderMethodSummary(label: string, color: string, data: PlannerResult | null) {
  const totalCells = data ? data.cells.length : null;
  const traversedCells = data ? (data.path ? data.path.traversedCellIds.length : 0) : null;
  const pathLength = data?.path ? `${data.path.totalLength}px` : data ? 'No path' : 'Not computed';

  return (
    <div
      key={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '6px 10px',
        borderRadius: '6px',
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        fontSize: '12px',
        fontVariantNumeric: 'tabular-nums',
        color: '#334155',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color, fontWeight: 700 }}>{label}:</span>
      <span style={{ whiteSpace: 'nowrap' }}>
        {data ? (
          <>
            Path: <b>{pathLength}</b> | Total Cells: <b>{totalCells}</b> | Traversed:{' '}
            <b>{traversedCells}</b>
          </>
        ) : (
          <span style={{ color: '#94a3b8' }}>Not computed</span>
        )}
      </span>
    </div>
  );
}

export const LayerControls: React.FC<LayerControlsProps> = ({
  canSolve,
  onSolve,
  result,
  visibility,
  onToggleLayer,
  selectedAlgorithm,
  onSelectAlgorithm,
  compareBothPaths,
  onToggleCompareBothPaths,
  triangularResult,
  trapezoidalResult,
}) => {
  const isTriangular = selectedAlgorithm === 'TRIANGULAR';
  const showComparisonSummary = compareBothPaths && Boolean(triangularResult || trapezoidalResult);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '12px 14px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      {/* Row 1: Algorithm Selector Tabs & Solve Button & Metrics */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Method Tabs */}
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: '#f1f5f9',
              padding: '3px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
            }}
          >
            <button
              onClick={() => onSelectAlgorithm('TRIANGULAR')}
              style={{
                padding: '6px 14px',
                borderRadius: '5px',
                border: 'none',
                fontSize: '12px',
                fontWeight: isTriangular ? 700 : 500,
                backgroundColor: isTriangular ? '#ffffff' : 'transparent',
                color: isTriangular ? '#0369a1' : '#64748b',
                boxShadow: isTriangular ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              ▲ Triangular Decomposition
            </button>
            <button
              onClick={() => onSelectAlgorithm('TRAPEZOIDAL')}
              style={{
                padding: '6px 14px',
                borderRadius: '5px',
                border: 'none',
                fontSize: '12px',
                fontWeight: !isTriangular ? 700 : 500,
                backgroundColor: !isTriangular ? '#ffffff' : 'transparent',
                color: !isTriangular ? '#6d28d9' : '#64748b',
                boxShadow: !isTriangular ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              ⏢ Trapezoidal Decomposition
            </button>
          </div>

          {/* Action button specifically for the active category */}
          <button
            onClick={onSolve}
            disabled={!canSolve}
            style={{
              padding: '7px 16px',
              backgroundColor: canSolve
                ? isTriangular
                  ? '#0284c7'
                  : '#7c3aed'
                : '#94a3b8',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: canSolve ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s ease',
              boxShadow: canSolve
                ? isTriangular
                  ? '0 1px 3px rgba(2, 132, 199, 0.25)'
                  : '0 1px 3px rgba(124, 58, 237, 0.25)'
                : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            ▶ Calculate {isTriangular ? 'Triangular' : 'Trapezoidal'}
          </button>
        </div>

        {/* Stable Metrics Slot: (Time removed as requested) */}
        <div
          style={{
            fontSize: '12px',
            color: result || showComparisonSummary ? '#334155' : '#94a3b8',
            fontFamily: 'monospace',
            textAlign: 'right',
            whiteSpace: 'nowrap',
          }}
        >
          {showComparisonSummary ? (
            <span style={{ color: '#15803d', fontWeight: 700 }}>Comparing Both Methods</span>
          ) : result ? (
            <>
              <b>{isTriangular ? 'Triangular' : 'Trapezoidal'}</b> | Cells: <b>{result.cells.length}</b>
              {result.path && (
                <>
                  {' '}| Traversed: <b>{result.path.traversedCellIds.length}</b> | Path:{' '}
                  <b>{result.path.totalLength}px</b>
                </>
              )}
            </>
          ) : (
            <span>Not computed ({isTriangular ? 'Triangular' : 'Trapezoidal'})</span>
          )}
        </div>
      </div>

      {/* Row 2: Layer Checkboxes strictly scoped to the active category & Path Comparison Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '8px',
          borderTop: '1px solid #f1f5f9',
          fontSize: '12px',
          color: '#475569',
          userSelect: 'none',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontWeight: 700,
              color: isTriangular ? '#0369a1' : '#6d28d9',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Layers ({isTriangular ? 'Triangular' : 'Trapezoidal'}):
          </span>

          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={visibility.showDecomposition}
              onChange={() => onToggleLayer('showDecomposition')}
            />
            Cells
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={visibility.showWaypoints}
              onChange={() => onToggleLayer('showWaypoints')}
            />
            Waypoints (Q_j)
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={visibility.showPath}
              onChange={() => onToggleLayer('showPath')}
            />
            Trajectory Path
          </label>
        </div>

        {/* Simultaneous Paths Visibility Toggle */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            padding: '4px 10px',
            backgroundColor: compareBothPaths ? '#f0fdf4' : '#f8fafc',
            border: compareBothPaths ? '1px solid #86efac' : '1px solid #e2e8f0',
            borderRadius: '6px',
            fontWeight: 600,
            color: compareBothPaths ? '#15803d' : '#475569',
            transition: 'all 0.15s ease',
          }}
          title="Display both Triangular (Green) and Trapezoidal (Blue) paths simultaneously"
        >
          <input
            type="checkbox"
            checked={compareBothPaths}
            onChange={onToggleCompareBothPaths}
          />
          Compare Both Paths (<span style={{ color: '#16a34a' }}>■ Tri</span> + <span style={{ color: '#2563eb' }}>■ Trap</span>)
        </label>
      </div>

      {/* Row 3: Comparison metrics for both methods (path length, total cells, traversed cells) */}
      {showComparisonSummary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            paddingTop: '8px',
            borderTop: '1px solid #f1f5f9',
          }}
        >
          {renderMethodSummary('Triangular', '#16a34a', triangularResult)}
          {renderMethodSummary('Trapezoidal', '#2563eb', trapezoidalResult)}
        </div>
      )}
    </div>
  );
};
