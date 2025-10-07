import React from 'react';
import { styles } from '../styles';

export function MatchScore({ match, columnasMatching, onSelect, isSelected }) {
  return (
    <div style={{
      padding: "16px",
      backgroundColor: "#fff",
      borderRadius: "12px",
      border: "1px solid #e2e8f0",
      display: "grid",
      gridTemplateColumns: "1fr auto"
    }}>
      <div>
        <div style={{fontSize: "14px", lineHeight: "1.6"}}>
          <p style={{margin: "4px 0"}}><b>CODIPROD:</b> {match.producto[columnasMatching.CODIPROD]}</p>
          <p style={{margin: "4px 0"}}><b>DESCRIPCION:</b> {match.producto[columnasMatching.DESCRIPCION]}</p>
          <p style={{margin: "4px 0"}}><b>EAN:</b> {match.producto[columnasMatching.EAN]} | <b>AECOC:</b> {match.producto[columnasMatching.AECOC]}</p>
          <p style={{margin: "4px 0"}}>
            <b>Marca:</b> {match.producto[columnasMatching.MARCA]} |{" "}
            <b>Cantidad:</b> {match.producto[columnasMatching.CANTIDAD]} {match.producto[columnasMatching.MEDIDA]}
          </p>
          <p style={{margin: "4px 0"}}>
            <b>Formato:</b> {match.producto[columnasMatching.FORMATO]} |{" "}
            <b>Sabor:</b> {match.producto[columnasMatching.SABOR]} |{" "}
            <b>Unidades:</b> {match.producto[columnasMatching.UNIDADES]}
          </p>
        </div>
        <div style={{
          marginTop: "8px",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          fontSize: "12px"
        }}>
          {match.codiprod > 0 && (
            <span style={{color: "#dc2626", fontWeight: "bold"}}>🎯 CODIPROD: +{match.codiprod.toFixed(1)}</span>
          )}
          {match.ean > 0 && (
            <span style={{color: "#059669"}}>EAN: +{match.ean.toFixed(1)}</span>
          )}
          {match.aecoc > 0 && (
            <span style={{color: "#059669"}}>AECOC: +{match.aecoc.toFixed(1)}</span>
          )}
          {match.marca > 0 && (
            <span style={{color: "#059669"}}>Marca: +{match.marca.toFixed(1)}</span>
          )}
          {match.cantidad > 0 && (
            <span style={{color: "#059669"}}>Cantidad: +{match.cantidad.toFixed(1)}</span>
          )}
          {match.medida > 0 && (
            <span style={{color: "#059669"}}>Medida: +{match.medida.toFixed(1)}</span>
          )}
          {match.formato > 0 && (
            <span style={{color: "#059669"}}>Formato: +{match.formato.toFixed(1)}</span>
          )}
          {match.sabor > 0 && (
            <span style={{color: "#059669"}}>Sabor: +{match.sabor.toFixed(1)}</span>
          )}
          {match.unidades > 0 && (
            <span style={{color: "#059669"}}>Unidades: +{match.unidades.toFixed(1)}</span>
          )}
          {match.descripcion > 0 && (
            <span style={{color: "#059669"}}>Desc: +{match.descripcion.toFixed(1)}</span>
          )}
          <span style={{fontWeight: "600", marginLeft: "auto"}}>
            Total: {match.total.toFixed(1)}
          </span>
        </div>
      </div>
      <div style={{marginLeft: "16px"}}>
        <button
          style={{
            ...styles.button,
            backgroundColor: isSelected ? '#22c55e' : '#3b82f6'
          }}
          onClick={onSelect}
        >
          {isSelected ? '✓ Seleccionado' : 'Seleccionar'}
        </button>
      </div>
    </div>
  );
}