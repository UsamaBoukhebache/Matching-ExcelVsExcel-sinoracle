import { styles } from '../styles';

export function WeightAdjuster({ weights, onWeightChange }) {
  return (
    <div style={styles.card}>
      <h2 style={styles.subtitle}>3) Ajustar Ponderaciones</h2>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "12px"
      }}>
        {Object.entries(weights).map(([k, v]) => (
          <label key={k} style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            alignItems: "center",
            backgroundColor: "#f8fafc",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0"
          }}>
            <span style={{color: "#334155"}}>{k}</span>
            <input
              type="number"
              value={v}
              onChange={(e) => onWeightChange(k, Number(e.target.value))}
              style={{
                width: "90px",
                padding: "4px 8px",
                borderRadius: "4px",
                border: "1px solid #e2e8f0"
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}