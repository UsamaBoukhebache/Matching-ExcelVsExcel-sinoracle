export function ProductCard({ title, product, columns }) {
  return (
    <div style={{
      padding: "10px",
      backgroundColor: "#f8fafc",
      borderRadius: "6px",
      border: "1px solid #e2e8f0"
    }}>
      {title && <h3 style={{margin: "0 0 8px 0", color: "#334155", fontSize: "13px"}}>{title}</h3>}
      <div style={{fontSize: "11px", lineHeight: "1.5"}}>
        <p style={{margin: "2px 0"}}><b>DESCRIPCION:</b> {product[columns.DESCRIPCION]}</p>
        <p style={{margin: "2px 0"}}><b>CODIPROD:</b> {product[columns.CODIPROD]} | <b>EAN:</b> {product[columns.EAN]} | <b>AECOC:</b> {product[columns.AECOC]}</p>
        <p style={{margin: "2px 0"}}>
          <b>Marca:</b> {product[columns.MARCA]} |{" "}
          <b>Cantidad:</b> {product[columns.CANTIDAD]} {product[columns.MEDIDA]} |{" "}
          <b>Formato:</b> {product[columns.FORMATO]} |{" "}
          <b>Unidades:</b> {product[columns.UNIDADES] || "—"}
        </p>
        {product[columns.PMEDIO] && (
          <p style={{margin: "2px 0"}}>
            <b>💰 Precio:</b> <span style={{color: "#059669", fontWeight: "bold"}}>{(product[columns.PMEDIO] / 100).toFixed(2)}€</span>
          </p>
        )}
      </div>
    </div>
  );
}