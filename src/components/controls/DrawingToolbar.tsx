import React from 'react';
import { type DrawingTool } from '../../types/planner';

interface DrawingToolbarProps {
  currentTool: DrawingTool;
  onSelectTool: (tool: DrawingTool) => void;
  hasField: boolean;
  obstacleCount: number;
  hasStart: boolean;
  hasFinish: boolean;
  onClearAll: () => void;
}

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  currentTool,
  onSelectTool,
  hasField,
  obstacleCount,
  hasStart,
  hasFinish,
  onClearAll,
}) => {
  const tools: { id: DrawingTool; label: string; badge?: string; disabled?: boolean }[] = [
    {
      id: 'DRAW_FIELD',
      label: '1. Field Boundary',
      badge: hasField ? 'Defined' : 'Required',
      disabled: hasField,
    },
    {
      id: 'DRAW_OBSTACLE',
      label: '2. Obstacle',
      badge: `${obstacleCount} added`,
      disabled: !hasField,
    },
    {
      id: 'SET_START',
      label: '3. Start Point',
      badge: hasStart ? 'Placed' : 'Not set',
      disabled: !hasField,
    },
    {
      id: 'SET_FINISH',
      label: '4. Finish Point',
      badge: hasFinish ? 'Placed' : 'Not set',
      disabled: !hasField,
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '10px 14px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {tools.map((t) => {
          const isSelected = currentTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelectTool(t.id)}
              disabled={t.disabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: isSelected ? '2px solid #0284c7' : '1px solid #cbd5e1',
                backgroundColor: isSelected ? '#f0f9ff' : t.disabled ? '#f8fafc' : '#ffffff',
                color: t.disabled ? '#94a3b8' : isSelected ? '#0369a1' : '#334155',
                cursor: t.disabled ? 'not-allowed' : 'pointer',
                fontWeight: isSelected ? 600 : 500,
                fontSize: '13px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{t.label}</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: isSelected
                    ? '#bae6fd'
                    : t.disabled
                    ? '#e2e8f0'
                    : '#f1f5f9',
                  color: isSelected ? '#0369a1' : '#64748b',
                }}
              >
                {t.badge}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={onClearAll}
        style={{
          padding: '6px 14px',
          backgroundColor: '#fee2e2',
          color: '#b91c1c',
          border: '1px solid #fca5a5',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '13px',
          flexShrink: 0,
        }}
      >
        Clear All
      </button>
    </div>
  );
};