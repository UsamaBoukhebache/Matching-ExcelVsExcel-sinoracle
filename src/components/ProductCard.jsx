// Función para quitar acentos y pasar a minúsculas
const quitarAcentos = (texto) => {
  if (!texto) return "";
  return texto.toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
};

export function ProductCard({ title, product, columns, onNoMatchMarca, onEditarMarca, marcaFueEditada }) {
  const marca = product[columns.MARCA];
  
  return (
    <div style={{
      padding: "10px",
      backgroundColor: "#f8fafc",
      borderRadius: "6px",
      border: "1px solid #e2e8f0",
      position: "relative"
    }}>
      {title && <h3 style={{margin: "0 0 8px 0", color: "#334155", fontSize: "13px"}}>{title}</h3>}
      
      {/* Botones en la esquina superior derecha */}
      <div style={{
        position: "absolute",
        top: "10px",
        right: "10px",
        display: "flex",
        gap: "8px"
      }}>
        {/* Botón EDITAR MARCA */}
        {onEditarMarca && marca && (
          <button
            onClick={() => onEditarMarca(marca)}
            style={{
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "11px",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 4px rgba(59, 130, 246, 0.3)"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "#2563eb";
              e.currentTarget.style.transform = "scale(1.05)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "#3b82f6";
              e.currentTarget.style.transform = "scale(1)";
            }}
            title={`Editar marca "${marca}" en todos tus productos`}
          >
            ✏️ Editar Marca
          </button>
        )}
        
        {/* Botón NO MATCH MARCA */}
        {onNoMatchMarca && marca && (
          <button
            onClick={() => onNoMatchMarca(marca)}
            style={{
              backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "11px",
            fontWeight: "bold",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 4px rgba(220, 53, 69, 0.3)"
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = "#bb2d3b";
            e.target.style.transform = "scale(1.05)";
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = "#dc3545";
            e.target.style.transform = "scale(1)";
          }}
          title={`Marcar como NO MATCH todos los productos de la marca "${marca}"`}
        >
          🚫 No Match Marca
        </button>
      )}
      </div>
      
      <div style={{fontSize: "11px", lineHeight: "1.5"}}>
        <p style={{margin: "2px 0"}}><b>DESCRIPCION:</b> {quitarAcentos(product[columns.DESCRIPCION])}</p>
        <p style={{margin: "2px 0"}}><b>CODIPROD:</b> {product[columns.CODIPROD]} | <b>EAN:</b> {product[columns.EAN]} | <b>AECOC:</b> {product[columns.AECOC]}</p>
        <p style={{margin: "2px 0"}}>
          <b>Marca:</b> <span style={{
            backgroundColor: "#fef3c7",
            padding: "2px 6px",
            borderRadius: "4px",
            fontWeight: "bold",
            color: "#92400e"
          }}>{quitarAcentos(marca || "—")}</span>
          {marcaFueEditada && marcaFueEditada(marca) && (
            <span style={{
              marginLeft: "6px",
              fontSize: "11px",
              color: "#f59e0b",
              fontWeight: "bold"
            }} title="Esta marca fue editada manualmente">
              ✏️ editada
            </span>
          )} |{" "}
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