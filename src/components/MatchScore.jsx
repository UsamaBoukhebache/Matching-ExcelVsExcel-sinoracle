import React from 'react';
import { styles } from '../styles';

export function MatchScore({ match, columnasMatching, onSelect, isSelected }) {
  return (
    <div 
      onClick={onSelect}
      style={{
        padding: "16px",
        backgroundColor: isSelected ? "#f0fdf4" : "#fff",
        borderRadius: "12px",
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
      {/* Badge de puntuación */}
      <div style={{
        position: "absolute",
        top: "12px",
        right: "12px",
        backgroundColor: isSelected ? "#22c55e" : "#3b82f6",
        color: "white",
        padding: "6px 12px",
        borderRadius: "20px",
        fontSize: "14px",
        fontWeight: "bold"
      }}>
        {isSelected ? "✓ " : ""}{match.total.toFixed(0)} pts
      </div>

      {/* Información del producto */}
      <div style={{paddingRight: "100px"}}>
        <div style={{fontSize: "15px", fontWeight: "bold", color: "#1e293b", marginBottom: "8px"}}>
          {match.producto[columnasMatching.DESCRIPCION]}
        </div>
        <div style={{fontSize: "13px", color: "#64748b", lineHeight: "1.6"}}>
          <div><b>CODIPROD:</b> {match.producto[columnasMatching.CODIPROD]}</div>
          <div>
            <b>Marca:</b> {match.producto[columnasMatching.MARCA] || "—"} | 
            <b> Cantidad:</b> {match.producto[columnasMatching.CANTIDAD]} {match.producto[columnasMatching.MEDIDA]} | 
            <b> Formato:</b> {match.producto[columnasMatching.FORMATO] || "—"}
          </div>
        </div>
        
        {/* Desglose de puntuaciones */}
        <div style={{
          marginTop: "8px",
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          fontSize: "11px"
        }}>
          {match.codiprod > 0 && (
            <span style={{
              backgroundColor: "#fee2e2",
              color: "#dc2626",
              padding: "2px 6px",
              borderRadius: "4px",
              fontWeight: "600"
            }}>
              🎯 CODIPROD +{match.codiprod.toFixed(0)}
            </span>
          )}
          {match.ean > 0 && (
            <span style={{
              backgroundColor: "#dcfce7",
              color: "#059669",
              padding: "2px 6px",
              borderRadius: "4px",
              fontWeight: "600"
            }}>
              EAN +{match.ean.toFixed(0)}
            </span>
          )}
          {match.aecoc > 0 && (
            <span style={{
              backgroundColor: "#dcfce7",
              color: "#059669",
              padding: "2px 6px",
              borderRadius: "4px",
              fontWeight: "600"
            }}>
              AECOC +{match.aecoc.toFixed(0)}
            </span>
          )}
          {match.marca > 0 && (
            <span style={{
              backgroundColor: "#dbeafe",
              color: "#2563eb",
              padding: "2px 6px",
              borderRadius: "4px",
              fontWeight: "600"
            }}>
              Marca +{match.marca.toFixed(0)}
            </span>
          )}
          {match.descripcion > 0 && (
            <span style={{
              backgroundColor: "#e0e7ff",
              color: "#4f46e5",
              padding: "2px 6px",
              borderRadius: "4px",
              fontWeight: "600"
            }}>
              Desc +{match.descripcion.toFixed(0)}
            </span>
          )}
          {match.formato > 0 && (
            <span style={{
              backgroundColor: "#fef3c7",
              color: "#d97706",
              padding: "2px 6px",
              borderRadius: "4px",
              fontWeight: "600"
            }}>
              Formato +{match.formato.toFixed(0)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}