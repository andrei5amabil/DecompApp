import { PlannerCanvas } from './components/canvas/PlannerCanvas';

export function App() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px',
        fontFamily: 'sans-serif',
      }}
    >
      <h1 style={{ marginBottom: '16px', color: '#0f172a' }}>
        Polygonal Path Planner - Exact Cell Decomposition
      </h1>
      <PlannerCanvas width={900} height={500} />
    </main>
  );
}

export default App;