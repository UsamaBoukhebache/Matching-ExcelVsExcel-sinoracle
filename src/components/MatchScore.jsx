export function MatchScore({ match, columnasMatching, onSelect, isSelected, numeroAtajo, onCheckboxChange, isChecked }) {
  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    if (onCheckboxChange) {
      onCheckboxChange();
    }
  };

  return (
    <div 
      onClick={onSelect}
      style={{
        padding: "6px 8px",
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
      {/* Checkbox para selección múltiple */}
      {onCheckboxChange && (
        <div style={{
          position: "absolute",
          top: "8px",
          left: "8px",
          zIndex: 10
        }}>
          <input
            type="checkbox"
            checked={isChecked || false}
            onChange={handleCheckboxClick}
            onClick={handleCheckboxClick}
            style={{
              width: "16px",
              height: "16px",
              cursor: "pointer",
              accentColor: "#3b82f6"
            }}
          />
        </div>
      )}

      {/* Badge de número de atajo */}
      {numeroAtajo && (
        <div style={{
          position: "absolute",
          top: "8px",
          left: onCheckboxChange ? "32px" : "8px",
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
      )}

      {/* Contenido principal con puntuación integrada */}
      <div style={{display: "flex", paddingLeft: onCheckboxChange ? "56px" : "30px", gap: "8px", alignItems: "flex-start"}}>
        {/* Información del producto */}
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{fontSize: "11px", fontWeight: "bold", color: "#1e293b", marginBottom: "3px", lineHeight: "1.2"}}>
            {match.producto[columnasMatching.DESCRIPCION]}
          </div>
          <div style={{fontSize: "9px", color: "#64748b", lineHeight: "1.3"}}>
            <div><b>CODIPROD:</b> {match.producto[columnasMatching.CODIPROD]}</div>
            <div>
              <b>Marca:</b> {match.producto[columnasMatching.MARCA] || "—"} | 
              <b> Cantidad:</b> {match.producto[columnasMatching.CANTIDAD]} {match.producto[columnasMatching.MEDIDA]} | 
              <b> Formato:</b> {match.producto[columnasMatching.FORMATO] || "—"}
            </div>
            {match.producto[columnasMatching.PMEDIO] && (
              <div style={{marginTop: "2px"}}>
                <b>💰 Precio:</b> <span style={{color: "#059669", fontWeight: "bold"}}>{(match.producto[columnasMatching.PMEDIO] / 100).toFixed(2)}€</span>
              </div>
            )}
          </div>
        </div>

        {/* Desglose de puntuaciones compacto a la derecha */}
        <div style={{
          minWidth: "140px",
          padding: "4px 6px",
          backgroundColor: "#f8fafc",
          borderRadius: "4px",
          fontSize: "8px",
          lineHeight: "1.3"
        }}>
          <div style={{
            fontWeight: "bold", 
            marginBottom: "3px", 
            fontSize: "9px", 
            color: "#475569",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}>
            📊 {match.total.toFixed(0)} pts {isSelected && <span style={{color: "#22c55e"}}>✓</span>}
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "2px 4px",
            columnGap: "6px"
          }}>
            {match.codiprod > 0 && (
              <span style={{color: "#059669", whiteSpace: "nowrap"}}>🎯 (CODIPROD) <b>+{match.codiprod.toFixed(0)}</b></span>
            )}
            {match.ean > 0 && (
              <span style={{color: "#059669", whiteSpace: "nowrap"}}>🏷️ (EAN) <b>+{match.ean.toFixed(0)}</b></span>
            )}
            {match.aecoc > 0 && (
              <span style={{color: "#059669", whiteSpace: "nowrap"}}>🔢 (AECOC) <b>+{match.aecoc.toFixed(0)}</b></span>
            )}
            {match.marca > 0 && (
              <span style={{color: "#059669", whiteSpace: "nowrap"}}>™️ (Marca) <b>+{match.marca.toFixed(0)}</b></span>
            )}
            {match.cantidad > 0 && (
              <span style={{color: "#059669", whiteSpace: "nowrap"}}>📏 (Cantidad) <b>+{match.cantidad.toFixed(0)}</b></span>
            )}
            {match.medida > 0 && (
              <span style={{color: "#059669", whiteSpace: "nowrap"}}>📐 (Medida) <b>+{match.medida.toFixed(0)}</b></span>
            )}
            {match.formato > 0 && (
              <span style={{color: "#059669", whiteSpace: "nowrap"}}>📦 (Formato) <b>+{match.formato.toFixed(0)}</b></span>
            )}
            {match.sabor > 0 && (
              <span style={{color: "#059669", whiteSpace: "nowrap"}}>🍋 (Sabor) <b>+{match.sabor.toFixed(0)}</b></span>
            )}
            {match.unidades > 0 && (
              <span style={{color: "#059669", whiteSpace: "nowrap"}}>🔢 (Unidades) <b>+{match.unidades.toFixed(0)}</b></span>
            )}
            {match.precio > 0 && (
              <span style={{color: "#059669", whiteSpace: "nowrap"}}>💰 (Precio) <b>+{match.precio.toFixed(1)}</b></span>
            )}
            {match.descripcion > 0 && (
              <span style={{color: "#059669", whiteSpace: "nowrap"}}>📝 (Descripción) <b>+{match.descripcion.toFixed(1)}</b></span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}