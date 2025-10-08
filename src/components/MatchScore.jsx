export function MatchScore({ match, columnasMatching, onSelect, isSelected, numeroAtajo }) {
  return (
    <div 
      onClick={onSelect}
      style={{
        padding: "10px",
        backgroundColor: isSelected ? "#f0fdf4" : "#fff",
        borderRadius: "6px",
        border: isSelected ? "2px solid #22c55e" : "2px solid #e2e8f0",
        cursor: "pointer",
        transition: "all 0.2s ease",
        position: "relative"
      }}
      onMouseOver={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = "#f8fafc";
          e.currentTarget.style.borderColor = "#3b82f6";
        }
      }}
      onMouseOut={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = "#fff";
          e.currentTarget.style.borderColor = "#e2e8f0";
        }
      }}
    >
      {/* Badge de número de atajo */}
      <div style={{
        position: "absolute",
        top: "10px",
        left: "10px",
        backgroundColor: isSelected ? "#22c55e" : "#6366f1",
        color: "white",
        padding: "1px 5px",
        borderRadius: "50%",
        fontSize: "10px",
        fontWeight: "bold",
        minWidth: "18px",
        height: "18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center"
      }}>
        {numeroAtajo}
      </div>

      {/* Badge de puntuación */}
      <div style={{
        position: "absolute",
        top: "8px",
        right: "8px",
        backgroundColor: isSelected ? "#22c55e" : "#3b82f6",
        color: "white",
        padding: "3px 8px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: "bold"
      }}>
        {isSelected ? "✓ " : ""}{match.total.toFixed(0)}
      </div>

      {/* Información del producto */}
      <div style={{paddingRight: "70px", paddingLeft: "30px"}}>
        <div style={{fontSize: "12px", fontWeight: "bold", color: "#1e293b", marginBottom: "4px", lineHeight: "1.3"}}>
          {match.producto[columnasMatching.DESCRIPCION]}
        </div>
        <div style={{fontSize: "10px", color: "#64748b", lineHeight: "1.4"}}>
          <div><b>CODIPROD:</b> {match.producto[columnasMatching.CODIPROD]}</div>
          <div>
            <b>Marca:</b> {match.producto[columnasMatching.MARCA] || "—"} | 
            <b> Cantidad:</b> {match.producto[columnasMatching.CANTIDAD]} {match.producto[columnasMatching.MEDIDA]} | 
            <b> Formato:</b> {match.producto[columnasMatching.FORMATO] || "—"}
          </div>
        </div>
        
        {/* Desglose de puntuaciones - SOLO las que aportan valor */}
        <div style={{
          marginTop: "6px",
          padding: "6px",
          backgroundColor: "#f8fafc",
          borderRadius: "4px",
          fontSize: "9px",
          lineHeight: "1.4"
        }}>
          <div style={{fontWeight: "bold", marginBottom: "3px", fontSize: "10px", color: "#475569"}}>
            📊 Desglose de Puntuación:
          </div>
          <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px"}}>
            {match.codiprod > 0 && (
              <span style={{color: "#059669"}}>
                🎯 CODIPROD: <b>+{match.codiprod.toFixed(0)}</b>
              </span>
            )}
            {match.ean > 0 && (
              <span style={{color: "#059669"}}>
                🏷️ EAN: <b>+{match.ean.toFixed(0)}</b>
              </span>
            )}
            {match.aecoc > 0 && (
              <span style={{color: "#059669"}}>
                🔢 AECOC: <b>+{match.aecoc.toFixed(0)}</b>
              </span>
            )}
            {match.marca > 0 && (
              <span style={{color: "#059669"}}>
                ™️ Marca: <b>+{match.marca.toFixed(0)}</b>
              </span>
            )}
            {match.cantidad > 0 && (
              <span style={{color: "#059669"}}>
                📏 Cantidad: <b>+{match.cantidad.toFixed(0)}</b>
              </span>
            )}
            {match.medida > 0 && (
              <span style={{color: "#059669"}}>
                📐 Medida: <b>+{match.medida.toFixed(0)}</b>
              </span>
            )}
            {match.formato > 0 && (
              <span style={{color: "#059669"}}>
                📦 Formato: <b>+{match.formato.toFixed(0)}</b>
              </span>
            )}
            {match.sabor > 0 && (
              <span style={{color: "#059669"}}>
                🍋 Sabor: <b>+{match.sabor.toFixed(0)}</b>
              </span>
            )}
            {match.unidades > 0 && (
              <span style={{color: "#059669"}}>
                🔢 Unidades: <b>+{match.unidades.toFixed(0)}</b>
              </span>
            )}
            {match.descripcion > 0 && (
              <span style={{color: "#059669"}}>
                📝 Descripción: <b>+{match.descripcion.toFixed(1)}</b>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}