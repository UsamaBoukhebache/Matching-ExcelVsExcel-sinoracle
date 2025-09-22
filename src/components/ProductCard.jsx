import React from 'react';
import { styles } from '../styles';

export function ProductCard({ title, product, columns }) {
  return (
    <div style={{
      padding: "16px",
      backgroundColor: "#f8fafc",
      borderRadius: "12px",
      border: "1px solid #e2e8f0"
    }}>
      <h3 style={{margin: "0 0 12px 0", color: "#334155", fontSize: "16px"}}>{title}</h3>
      <div style={{fontSize: "14px", lineHeight: "1.6"}}>
        <p style={{margin: "4px 0"}}><b>EAN:</b> {product[columns.EAN]}</p>
        <p style={{margin: "4px 0"}}><b>Descripción:</b> {product[columns.ARDesc]}</p>
        <p style={{margin: "4px 0"}}>
          <b>Marca:</b> {product[columns.Marca]} |{" "}
          <b>Cantidad:</b> {product[columns.Cantidad]} {product[columns.Medida]}
        </p>
      </div>
    </div>
  );
}