import React, { useRef, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { styles } from "./styles";
import { FileUploader } from "./components/FileUploader";
import { ProductCard } from "./components/ProductCard";
import { WeightAdjuster } from "./components/WeightAdjuster";
import { MatchScore } from "./components/MatchScore";
import logoMD from "./assets/logoMD.png";
import Login from "./components/Login";

/**
 * ---------------------------------------------
 *   Ayudas / Normalización / Utilidades
 * ---------------------------------------------
 */

/** Normaliza EAN */
function normalizarEAN(raw) {
  if (raw === undefined || raw === null || raw === "") return "";
  let s = String(raw).trim();

  if (/e\+/i.test(s)) {
    const asNumber = Number(raw);
    if (!Number.isFinite(asNumber)) return "";
    s = Math.trunc(asNumber).toString();
  }

  s = s.replace(/\D+/g, "");
  if (s.length > 14) s = s.slice(0, 14);
  return s;
}

/** Tokeniza texto para similitud */
function tokenizar(str) {
  if (!str) return [];
  return String(str)
    .toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

/** Similitud Jaccard */
function jaccard(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const A = new Set(tokensA);
  const B = new Set(tokensB);
  let inter = 0;
  A.forEach(t => { if (B.has(t)) inter++; });
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

/** Puntuación EAN */
function puntuacionPrefijoEAN(a, b, pesos) {
  if (!a || !b) return 0;
  if (a === b) return pesos.eanExacto;
  let score = 0;
  if (a.slice(0, 6) === b.slice(0, 6)) score = Math.max(score, pesos.ean6);
  if (a.slice(0, 4) === b.slice(0, 4)) score = Math.max(score, pesos.ean4);
  if (a.slice(0, 2) === b.slice(0, 2)) score = Math.max(score, pesos.ean2);
  return score;
}

/** Detecta columnas */
function adivinarColumnas(cabecera) {
  const norm = h => h.toLowerCase();
  const mapa = new Map(cabecera.map(h => [norm(h), h]));
  function pick(opciones, fallback) {
    for (const c of opciones) {
      const clave = norm(c);
      if (mapa.has(clave)) return mapa.get(clave);
    }
    return fallback;
  }
  return {
    ARCodi: pick(["arcodi"], cabecera[0]),
    ARDesc: pick(["ardesc"], cabecera[1]),
    Cantidad: pick(["cantidad", "qty"], "Cantidad"),
    Medida: pick(["medida", "unidad", "unit"], "Medida"),
    Formato: pick(["formato"], "Formato"),
    Unidades: pick(["unidades"], "Unidades"),
    Marca: pick(["marca", "brand"], "Marca"),
    Sabor: pick(["sabor", "flavor"], "Sabor"),
    EAN: pick(["ean", "barcode", "codigo", "codbarras"], "EAN"),
    CODIPROD_MARKO: pick(["codiprod_marko"], "CODIPROD_MARKO"),
    DESCRIPCION_MARKO: pick(["descripcion_marko"], "DESCRIPCION_MARKO"),
    UNIDADES_MARKO: pick(["unidades_marko"], "UNIDADES_MARKO"),
  };
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleLoginSuccess = (user) => {
    console.log("Usuario logueado:", user);
    setIsAuthenticated(true);
  };

  // Referencias para los inputs de archivo
  const inputFicheroReferencia = useRef(null);
  const inputFicheroMatching = useRef(null);
  
  // Contenedor principal con nueva clase
  const AppContainer = ({ children }) => (
    <div className="app-container">
      <div className="logo-container">
        <img src={logoMD} alt="MD Logo" className="app-logo" />
      </div>
      {children}
    </div>
  );

  // Estado principal
  const [filasReferencia, setFilasReferencia] = useState([]);
  const [filasMatching, setFilasMatching] = useState([]);
  const [columnasReferencia, setColumnasReferencia] = useState(null);
  const [columnasMatching, setColumnasMatching] = useState(null);
  const [indiceActual, setIndiceActual] = useState(0);
  const [matchesSeleccionados, setMatchesSeleccionados] = useState(new Map());

  // Pesos para el sistema de puntuación
  const [pesos, setPesos] = useState({
    eanExacto: 120,
    ean6: 70,
    ean4: 40,
    ean2: 15,
    marca: 60,
    cantidadExacta: 30,
    medida: 12,
    formato: 10,
    sabor: 6,
    descJaccard: 100,
  });

  /** Cargar Excel de referencia */
  function manejarFicheroReferencia(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target.result);
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (!json.length) return;

      const cabecera = Object.keys(json[0]);
      const colDetectadas = adivinarColumnas(cabecera);
      setColumnasReferencia(colDetectadas);
      setFilasReferencia(json);
      setIndiceActual(0);
      setMatchesSeleccionados(new Map());
    };
    reader.readAsArrayBuffer(file);
  }

  /** Cargar Excel para matching */
  function manejarFicheroMatching(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target.result);
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (!json.length) return;

      const cabecera = Object.keys(json[0]);
      const colDetectadas = adivinarColumnas(cabecera);
      setColumnasMatching(colDetectadas);
      setFilasMatching(json);
    };
    reader.readAsArrayBuffer(file);
  }

  /** Calcula puntuación detallada entre dos productos */
  function calcularPuntuacionDetallada(productoRef, productoMatch) {
    const puntuaciones = {
      ean: 0,
      marca: 0,
      cantidad: 0,
      medida: 0,
      formato: 0,
      sabor: 0,
      descripcion: 0,
      total: 0
    };

    // EAN
    const eanRef = normalizarEAN(productoRef[columnasReferencia.EAN]);
    const eanMatch = normalizarEAN(productoMatch[columnasMatching.EAN]);
    puntuaciones.ean = puntuacionPrefijoEAN(eanRef, eanMatch, pesos);

    // Marca
    const marcaRef = (productoRef[columnasReferencia.Marca] ?? "").toString().trim().toLowerCase();
    const marcaMatch = (productoMatch[columnasMatching.Marca] ?? "").toString().trim().toLowerCase();
    if (marcaRef && marcaMatch && marcaRef === marcaMatch) {
      puntuaciones.marca = pesos.marca;
    }

    // Cantidad
    const cantRef = productoRef[columnasReferencia.Cantidad];
    const cantMatch = productoMatch[columnasMatching.Cantidad];
    if (cantRef !== undefined && cantMatch !== undefined &&
        cantRef !== "" && cantMatch !== "" &&
        Number(cantRef) === Number(cantMatch)) {
      puntuaciones.cantidad = pesos.cantidadExacta;
    }

    // Medida
    const medRef = (productoRef[columnasReferencia.Medida] ?? "").toString().trim().toLowerCase();
    const medMatch = (productoMatch[columnasMatching.Medida] ?? "").toString().trim().toLowerCase();
    if (medRef && medMatch && medRef === medMatch) {
      puntuaciones.medida = pesos.medida;
    }

    // Formato
    const formRef = (productoRef[columnasReferencia.Formato] ?? "").toString().trim().toLowerCase();
    const formMatch = (productoMatch[columnasMatching.Formato] ?? "").toString().trim().toLowerCase();
    if (formRef && formMatch && formRef === formMatch) {
      puntuaciones.formato = pesos.formato;
    }

    // Sabor
    const sabRef = (productoRef[columnasReferencia.Sabor] ?? "").toString().trim().toLowerCase();
    const sabMatch = (productoMatch[columnasMatching.Sabor] ?? "").toString().trim().toLowerCase();
    if (sabRef && sabMatch && sabRef === sabMatch) {
      puntuaciones.sabor = pesos.sabor;
    }

    // Descripción
    const descRef = tokenizar(productoRef[columnasReferencia.Descripcion]);
    const descMatch = tokenizar(productoMatch[columnasMatching.Descripcion]);
    puntuaciones.descripcion = jaccard(descRef, descMatch) * pesos.descJaccard;

    // Total
    puntuaciones.total = Object.values(puntuaciones).reduce((a, b) => a + b, 0) - puntuaciones.total;

    return puntuaciones;
  }

  /** Calcula Top 5 para el producto actual */
  function calcularTop5ParaActual() {
    if (!filasReferencia.length || !filasMatching.length || !columnasReferencia || !columnasMatching) return [];
    
    const productoRef = filasReferencia[indiceActual];
    const candidatos = [];
    
    filasMatching.forEach((productoMatch, idx) => {
      const puntuacion = calcularPuntuacionDetallada(productoRef, productoMatch);
      if (puntuacion.total > 0) {
        candidatos.push({
          index: idx,
          producto: productoMatch,
          ...puntuacion
        });
      }
    });
    
    candidatos.sort((a, b) => b.total - a.total);
    return candidatos.slice(0, 5);
  }

  /** Seleccionar match para el producto actual */
  function seleccionarMatch(productoMatch) {
    const nuevosMatches = new Map(matchesSeleccionados);
    nuevosMatches.set(indiceActual, {
      codiprod: normalizarEAN(productoMatch[columnasMatching.CODIPROD]),
      descripcion: productoMatch[columnasMatching.DESCRIPCION],
      unidades: productoMatch[columnasMatching.Unidades],
    });
    setMatchesSeleccionados(nuevosMatches);
  }

  /** Exportar Excel con matches */
  function exportarExcelMatcheado() {
    if (!filasReferencia.length || !columnasReferencia) return;

    const filasActualizadas = filasReferencia.map((fila, idx) => {
      const match = matchesSeleccionados.get(idx);
      const filaLimpia = { ...fila };

      // Rellenar las columnas de matching
      filaLimpia[columnasReferencia.CODIPROD_MARKO] = match?.codiprod ?? "";
      filaLimpia[columnasReferencia.DESCRIPCION_MARKO] = match?.descripcion ?? "";
      filaLimpia[columnasReferencia.UNIDADES_MARKO] = match?.unidades ?? "";

      return filaLimpia;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filasActualizadas);
    XLSX.utils.book_append_sheet(wb, ws, "Productos_Matcheados");

    const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, "productos_matcheados.xlsx");
  }

  // Mantener sesión y progreso al recargar la página
  useEffect(() => {
    const userSession = localStorage.getItem('userSession');
    const savedMatches = localStorage.getItem('matchesSeleccionados');
    const savedReferencia = localStorage.getItem('filasReferencia');
    const savedMatching = localStorage.getItem('filasMatching');
    const savedColumnasReferencia = localStorage.getItem('columnasReferencia');
    const savedColumnasMatching = localStorage.getItem('columnasMatching');
    const savedIndiceActual = localStorage.getItem('indiceActual');

    if (userSession) {
      setIsAuthenticated(true);
    }

    if (savedMatches) {
      setMatchesSeleccionados(new Map(JSON.parse(savedMatches)));
    }

    if (savedReferencia) {
      setFilasReferencia(JSON.parse(savedReferencia));
    }

    if (savedMatching) {
      setFilasMatching(JSON.parse(savedMatching));
    }

    if (savedColumnasReferencia) {
      setColumnasReferencia(JSON.parse(savedColumnasReferencia));
    }

    if (savedColumnasMatching) {
      setColumnasMatching(JSON.parse(savedColumnasMatching));
    }

    if (savedIndiceActual) {
      setIndiceActual(Number(savedIndiceActual));
    }

    setIsLoading(false);
  }, []);

  // Guardar progreso en localStorage
  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem('matchesSeleccionados', JSON.stringify(Array.from(matchesSeleccionados.entries())));
      localStorage.setItem('filasReferencia', JSON.stringify(filasReferencia));
      localStorage.setItem('filasMatching', JSON.stringify(filasMatching));
      localStorage.setItem('columnasReferencia', JSON.stringify(columnasReferencia));
      localStorage.setItem('columnasMatching', JSON.stringify(columnasMatching));
      localStorage.setItem('indiceActual', indiceActual);
    }
  }, [isAuthenticated, matchesSeleccionados, filasReferencia, filasMatching, columnasReferencia, columnasMatching, indiceActual]);

  const handleLogout = () => {
    localStorage.removeItem('userSession');
    setIsAuthenticated(false);
  };

  const handleClearSession = () => {
    const confirmClear = window.confirm("¿Seguro que quieres reiniciar el proceso? Se perderá todo el progreso actual.");
    if (confirmClear) {
      localStorage.removeItem('matchesSeleccionados');
      localStorage.removeItem('filasReferencia');
      localStorage.removeItem('filasMatching');
      localStorage.removeItem('columnasReferencia');
      localStorage.removeItem('columnasMatching');
      localStorage.removeItem('indiceActual');
      setFilasReferencia([]);
      setFilasMatching([]);
      setColumnasReferencia(null);
      setColumnasMatching(null);
      setIndiceActual(0);
      setMatchesSeleccionados(new Map());
    }
  };

  if (isLoading) {
    return <div style={{ textAlign: 'center', marginTop: '20%' }}>Cargando...</div>;
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>
        Matching de Productos Excel vs Excel
      </h1>

      {/* Botones de sesión */}
      <div style={{ position: "absolute", top: "10px", right: "10px", display: "flex", gap: "10px" }}>
        <button
          onClick={handleLogout}
          style={{
            background: "#dc3545",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "5px",
            fontSize: "1rem",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "all 0.3s ease",
            boxShadow: "0 4px 15px rgba(220, 53, 69, 0.4)"
          }}
          onMouseOver={(e) => {
            e.target.style.transform = "translateY(-2px)";
            e.target.style.boxShadow = "0 6px 20px rgba(220, 53, 69, 0.6)";
          }}
          onMouseOut={(e) => {
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 4px 15px rgba(220, 53, 69, 0.4)";
          }}
        >
          🔒 Cerrar Sesión
        </button>
        <button
          onClick={handleClearSession}
          style={{
            background: "#ffc107",
            color: "#212529",
            border: "none",
            padding: "10px 20px",
            borderRadius: "5px",
            fontSize: "1rem",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "all 0.3s ease",
            boxShadow: "0 4px 15px rgba(255, 193, 7, 0.4)"
          }}
          onMouseOver={(e) => {
            e.target.style.transform = "translateY(-2px)";
            e.target.style.boxShadow = "0 6px 20px rgba(255, 193, 7, 0.6)";
          }}
          onMouseOut={(e) => {
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 4px 15px rgba(255, 193, 7, 0.4)";
          }}
        >
          🔄 Reiniciar Proceso
        </button>
      </div>

      {/* Bloque: Cargar Excels */}
      <div style={styles.card}>
        <h2 style={styles.subtitle}>1) Cargar Archivos Excel</h2>
        <div style={styles.flexContainer}>
          <FileUploader
            inputRef={inputFicheroReferencia}
            fileCount={filasReferencia.length}
            onUpload={manejarFicheroReferencia}
            label="Excel de Referencia"
          />
          <FileUploader
            inputRef={inputFicheroMatching}
            fileCount={filasMatching.length}
            onUpload={manejarFicheroMatching}
            label="Excel para Matching"
          />
        </div>
      </div>

      {filasReferencia.length > 0 && filasMatching.length > 0 && (
        <>
          {/* Bloque: Navegación y Matching */}
          <div style={styles.card}>
            <h2 style={styles.subtitle}>2) Matching de Productos ({indiceActual + 1} de {filasReferencia.length})</h2>
            
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px"}}>
              {/* Producto de referencia */}
              <ProductCard
                title="Producto a Matchear:"
                product={filasReferencia[indiceActual]}
                columns={columnasReferencia}
              />

              {/* Navegación y exportación */}
              <div style={{display: "flex", gap: "12px", alignItems: "center", justifyContent: "flex-end"}}>
                <button
                  style={{...styles.buttonSecondary, opacity: indiceActual === 0 ? 0.5 : 1}}
                  onClick={() => setIndiceActual(i => Math.max(0, i - 1))}
                  disabled={indiceActual === 0}
                >
                  ← Anterior
                </button>
                <span style={{color: "#64748b"}}>
                  {indiceActual + 1} de {filasReferencia.length}
                </span>
                <button
                  style={{...styles.buttonSecondary, opacity: indiceActual === filasReferencia.length - 1 ? 0.5 : 1}}
                  onClick={() => setIndiceActual(i => Math.min(filasReferencia.length - 1, i + 1))}
                  disabled={indiceActual === filasReferencia.length - 1}
                >
                  Siguiente →
                </button>
                <button
                  style={{...styles.button, marginLeft: "24px"}}
                  onClick={exportarExcelMatcheado}
                >
                  Descargar Excel Matcheado
                </button>
              </div>
            </div>

            {/* Top 5 matches */}
            <div style={{marginTop: "24px"}}>
              <h3 style={{margin: "0 0 16px 0", color: "#334155", fontSize: "16px"}}>Mejores coincidencias:</h3>
              <div style={{display: "flex", flexDirection: "column", gap: "16px"}}>
                {calcularTop5ParaActual().map((match, idx) => (
                  <MatchScore
                    key={idx}
                    match={match}
                    columnasMatching={columnasMatching}
                    onSelect={() => seleccionarMatch(match.producto)}
                    isSelected={matchesSeleccionados.get(indiceActual)?.codiprod === normalizarEAN(match.producto[columnasMatching.EAN])}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Bloque: Ponderaciones */}
          <WeightAdjuster
            weights={pesos}
            onWeightChange={(k, v) => setPesos({ ...pesos, [k]: v })}
          />
        </>
      )}

      {!filasReferencia.length || !filasMatching.length ? (
        <div style={{ marginTop: 12, color: "#555" }}>
          Sube dos archivos Excel: uno con los productos que quieres matchear y otro con los productos de referencia.
        </div>
      ) : null}
    </div>
  );
}