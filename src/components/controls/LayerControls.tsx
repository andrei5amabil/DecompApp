import React from 'react';
import { type LayerVisibility, type PlannerResult } from '../../types/planner';

interface LayerControlsProps {
  canSolve: boolean;
  onSolve: () => void;
  result: PlannerResult | null;
  visibility: LayerVisibility;
  onToggleLayer: (key: keyof LayerVisibility) => void;
}

export const LayerControls: React.FC<LayerControlsProps> = ({
  canSolve,
  onSolve,
  result,
  visibility,
  onToggleLayer,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '10px 14px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      {/* Row 1: Action Button & Stable Metrics Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          minHeight: '34px',
        }}
      >
        <button
          onClick={onSolve}
          disabled={!canSolve}
          style={{
            padding: '7px 16px',
            backgroundColor: canSolve ? '#0284c7' : '#94a3b8',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: canSolve ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
            boxShadow: canSolve ? '0 1px 3px rgba(2, 132, 199, 0.25)' : 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          ▶ Calculate Decomposition & Path
        </button>

        {/* Stable Metrics Slot: Always occupies space so height never shifts */}
        <div
          style={{
            fontSize: '12px',
            color: result ? '#334155' : '#94a3b8',
            fontFamily: 'monospace',
            textAlign: 'right',
            whiteSpace: 'nowrap',
          }}
        >
          {result ? (
            <>
              Cells: <b>{result.cells.length}</b> | Time: <b>{result.executionTimeMs}ms</b>
              {result.path && <> | Path: <b>{result.path.totalLength}px</b></>}
            </>
          ) : (
            <span>Ready to compute</span>
          )}
        </div>
      </div>

      {/* Row 2: Layer Checkboxes */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '6px',
          borderTop: '1px solid #f1f5f9',
          fontSize: '12px',
          color: '#475569',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontWeight: 600,
            color: '#64748b',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Layers:
        </span>

        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={visibility.showDecomposition}
            onChange={() => onToggleLayer('showDecomposition')}
          />
          Cells & Labels (k_i)
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={visibility.showGraph}
            onChange={() => onToggleLayer('showGraph')}
          />
          Dual Graph G
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
    </div>
  );
};