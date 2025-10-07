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

/** Normaliza números (elimina notación científica, formatos, etc.) */
function normalizarNumero(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  
  // Si ya es un número válido
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  
  let s = String(raw).trim();
  
  // Manejar notación científica
  if (/e[+-]?\d+/i.test(s)) {
    const asNumber = Number(raw);
    if (!Number.isFinite(asNumber)) return null;
    return asNumber;
  }
  
  // Eliminar separadores de miles y convertir coma decimal a punto
  s = s.replace(/\s+/g, ""); // Eliminar espacios
  s = s.replace(/\./g, ""); // Eliminar puntos (separador de miles)
  s = s.replace(/,/g, "."); // Convertir coma a punto (decimal)
  
  const num = parseFloat(s);
  return Number.isFinite(num) ? num : null;
}

/** Normaliza descripción */
function normalizarDescripcion(raw) {
  if (!raw) return "";
  return String(raw)
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "") // Eliminar acentos
    .replace(/\s+/g, " "); // Normalizar espacios múltiples
}

/** Normaliza unidad de medida */
function normalizarUnidadMedida(raw) {
  if (!raw) return "";
  let s = String(raw)
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "");
  
  // Normalizar abreviaturas comunes
  const equivalencias = {
    'kilogramo': 'kg',
    'kilogramos': 'kg',
    'kilo': 'kg',
    'kilos': 'kg',
    'gramo': 'g',
    'gramos': 'g',
    'litro': 'l',
    'litros': 'l',
    'mililitro': 'ml',
    'mililitros': 'ml',
    'unidad': 'u',
    'unidades': 'u',
    'metro': 'm',
    'metros': 'm',
    'centimetro': 'cm',
    'centimetros': 'cm',
  };
  
  return equivalencias[s] || s;
}

/** Tokeniza texto para similitud */
function tokenizar(str) {
  if (!str) return [];
  const normalizado = normalizarDescripcion(str);
  
  // Primero, proteger números con decimales (comas y puntos)
  // Convertir "1,5" o "1.5" a "1_5" temporalmente para preservarlos
  let protegido = normalizado.replace(/(\d+)[,.](\d+)/g, '$1_$2');
  
  // Ahora eliminar caracteres especiales excepto guiones bajos (temporales)
  protegido = protegido.replace(/[^a-z0-9_]+/g, " ");
  
  // Split y restaurar los números decimales con punto
  return protegido
    .split(" ")
    .filter(Boolean)
    .map(token => token.replace(/_/g, '.')); // Restaurar como punto decimal
}

/** Calcula similitud entre dos palabras usando distancia de Levenshtein normalizada */
function similitudPalabras(palabra1, palabra2) {
  if (!palabra1 || !palabra2) return 0;
  if (palabra1 === palabra2) return 1;
  
  // Solo considerar palabras de al menos 4 caracteres para evitar coincidencias falsas
  if (palabra1.length < 4 || palabra2.length < 4) return 0;
  
  // Si una palabra está contenida en la otra, dar alta puntuación
  if (palabra1.includes(palabra2) || palabra2.includes(palabra1)) {
    const minLen = Math.min(palabra1.length, palabra2.length);
    const maxLen = Math.max(palabra1.length, palabra2.length);
    // Solo si la palabra más corta tiene al menos 4 caracteres
    if (minLen >= 4) {
      return minLen / maxLen * 0.8; // 80% de similitud si una contiene a la otra
    }
  }
  
  // Distancia de Levenshtein
  const distancia = levenshtein(palabra1, palabra2);
  const maxLen = Math.max(palabra1.length, palabra2.length);
  const similitud = 1 - (distancia / maxLen);
  
  // Solo considerar similitud si es mayor al 70% y ambas palabras son largas
  return similitud > 0.7 && palabra1.length >= 4 && palabra2.length >= 4 ? similitud : 0;
}

/** Calcula distancia de Levenshtein entre dos cadenas */
function levenshtein(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/** Similitud mejorada que combina Jaccard con similitud de palabras parciales */
function similitudMejorada(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  
  // Similitud Jaccard tradicional para coincidencias exactas
  const A = new Set(tokensA);
  const B = new Set(tokensB);
  let coincidenciasExactas = 0;
  A.forEach(t => { if (B.has(t)) coincidenciasExactas++; });
  
  // Similitud parcial para palabras abreviadas
  let similitudParcial = 0;
  let comparaciones = 0;
  
  tokensA.forEach(tokenA => {
    if (tokenA.length >= 4) { // Solo considerar tokens de 4+ caracteres
      tokensB.forEach(tokenB => {
        if (tokenB.length >= 4) {
          const sim = similitudPalabras(tokenA, tokenB);
          if (sim > 0) {
            similitudParcial += sim;
            comparaciones++;
          }
        }
      });
    }
  });
  
  // Normalizar similitud parcial
  const similitudParcialNormalizada = comparaciones > 0 ? similitudParcial / comparaciones : 0;
  
  // Combinar ambas similitudes
  const union = A.size + B.size - coincidenciasExactas;
  const jaccardScore = union ? coincidenciasExactas / union : 0;
  
  // Dar prioridad a coincidencias exactas, similitud parcial con peso menor
  return Math.max(jaccardScore, similitudParcialNormalizada * 0.5);
}

/** Puntuación AECOC progresiva (comparando de 2 en 2 con 0 imaginario al principio) */
function puntuacionAECOC(aecocA, aecocB, pesoBase) {
  if (!aecocA || !aecocB) return 0;
  
  // Normalizar: añadir 0 al principio si es necesario y rellenar con 0s hasta 14 caracteres
  const normalizarAECOC = (aecoc) => {
    let s = String(aecoc).trim().replace(/\D/g, ""); // Solo dígitos
    s = "0" + s; // Añadir 0 imaginario al principio
    return s.padEnd(15, "0"); // Asegurar 15 caracteres (0 + 14)
  };
  
  const a = normalizarAECOC(aecocA);
  const b = normalizarAECOC(aecocB);
  
  // Comparar de 2 en 2 dígitos
  let digitosCoincidentes = 0;
  for (let i = 0; i < 14; i += 2) {
    const parA = a.substring(i, i + 2);
    const parB = b.substring(i, i + 2);
    
    if (parA === parB) {
      digitosCoincidentes += 2;
    } else {
      break; // Si no coinciden, dejamos de comparar
    }
  }
  
  // Calcular puntuación progresiva
  // 2 dígitos (1 par) = 20% del peso
  // 4 dígitos (2 pares) = 40% del peso
  // 6 dígitos (3 pares) = 60% del peso
  // 8 dígitos (4 pares) = 80% del peso
  // 10+ dígitos (5+ pares) = 100% del peso
  if (digitosCoincidentes === 0) return 0;
  
  const porcentaje = Math.min(digitosCoincidentes / 10, 1); // Máximo 100%
  return pesoBase * porcentaje;
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
    CODIPROD: pick(["codiprod"], cabecera[0]),
    DESCRIPCION: pick(["descripcion"], cabecera[1]),
    AECOC: pick(["aecoc"], "AECOC"),
    EAN: pick(["ean"], "EAN"),
    CANTIDAD: pick(["cantidad"], "CANTIDAD"),
    MEDIDA: pick(["medida"], "MEDIDA"),
    FORMATO: pick(["formato"], "FORMATO"),
    MARCA: pick(["marca"], "MARCA"),
    UNIDADES: pick(["unidades"], "UNIDADES"),
    SABOR: pick(["sabor"], "SABOR"),
    EQUIVALE: pick(["equivale"], "EQUIVALE"),
    FACTOR: pick(["factor"], "FACTOR"),
    CODIPRODPX: pick(["codiprodpx"], "CODIPRODPX"), // Nueva columna para exportación
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
  
  // Contadores de matches
  const [contadorMatches, setContadorMatches] = useState(0);
  const [contadorNoMatches, setContadorNoMatches] = useState(0);

  // Pesos para el sistema de puntuación
  const [pesos, setPesos] = useState({
    codiProdExacto: 1000, // Prioridad máxima si CODIPROD coincide
    eanExacto: 150,
    aecoc: 100, 
    marca: 70,
    cantidadExacta: 40,
    medida: 20,
    formato: 20, 
    sabor: 10,
    unidades: 20,
    descripcionJaccard: 100,
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
      console.log('Referencia - Cabecera:', cabecera);
      console.log('Referencia - Columnas detectadas:', colDetectadas);
      console.log('Referencia - Primera fila:', json[0]);
      setColumnasReferencia(colDetectadas);
      setFilasReferencia(json);
      setIndiceActual(0);
      setMatchesSeleccionados(new Map());
      setContadorMatches(0);
      setContadorNoMatches(0);
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
      console.log('Matching - Cabecera:', cabecera);
      console.log('Matching - Columnas detectadas:', colDetectadas);
      console.log('Matching - Primera fila:', json[0]);
      setColumnasMatching(colDetectadas);
      setFilasMatching(json);
    };
    reader.readAsArrayBuffer(file);
  }

  /** Calcula puntuación detallada entre dos productos */
  function calcularPuntuacionDetallada(productoRef, productoMatch, mostrarLogs = false) {
    const puntuaciones = {
      codiprod: 0,
      ean: 0,
      aecoc: 0,
      marca: 0,
      cantidad: 0,
      medida: 0,
      formato: 0,
      sabor: 0,
      unidades: 0,
      descripcion: 0,
      total: 0
    };

    if (mostrarLogs) {
      console.log("\n═══════════════════════════════════════════════════════════════");
      console.log("🔍 ANÁLISIS DETALLADO DE MATCHING");
      console.log("═══════════════════════════════════════════════════════════════");
      console.log(`📦 Producto a matchear: ${productoRef[columnasReferencia.DESCRIPCION]}`);
      console.log(`🎯 Mejor candidato:     ${productoMatch[columnasMatching.DESCRIPCION]}`);
      console.log("───────────────────────────────────────────────────────────────\n");
    }

    // CODIPROD - PRIORIDAD MÁXIMA
    const codiProdRef = (productoRef[columnasReferencia.CODIPROD] ?? "").toString().trim();
    const codiProdMatch = (productoMatch[columnasMatching.CODIPROD] ?? "").toString().trim();
    if (codiProdRef && codiProdMatch && codiProdRef === codiProdMatch) {
      puntuaciones.codiprod = pesos.codiProdExacto;
      if (mostrarLogs) {
        console.log("✅ CODIPROD: MATCH EXACTO → +%s pts", pesos.codiProdExacto);
        console.log(`   "${codiProdRef}" = "${codiProdMatch}"\n`);
      }
      // Si CODIPROD coincide, es match directo
      puntuaciones.total = pesos.codiProdExacto;
      return puntuaciones;
    } else if (mostrarLogs && (codiProdRef || codiProdMatch)) {
      console.log("❌ CODIPROD: No coincide → +0 pts");
      console.log(`   "${codiProdRef}" ≠ "${codiProdMatch}"\n`);
    }

    // EAN
    const eanRefOriginal = productoRef[columnasReferencia.EAN];
    const eanMatchOriginal = productoMatch[columnasMatching.EAN];
    const eanRef = normalizarEAN(eanRefOriginal);
    const eanMatch = normalizarEAN(eanMatchOriginal);
    if (eanRef && eanMatch && eanRef === eanMatch) {
      puntuaciones.ean = pesos.eanExacto;
      if (mostrarLogs) {
        console.log("✅ EAN: MATCH EXACTO → +%s pts", pesos.eanExacto);
        if (eanRefOriginal !== eanRef) {
          console.log(`   "${eanRefOriginal}" → "${eanRef}"\n`);
        } else {
          console.log(`   "${eanRef}"\n`);
        }
      }
    } else if (mostrarLogs && (eanRef || eanMatch)) {
      console.log("❌ EAN: No coincide → +0 pts");
      console.log(`   "${eanRef}" ≠ "${eanMatch}"\n`);
    }

    // AECOC - Puntuación progresiva
    const aecocRef = productoRef[columnasReferencia.AECOC];
    const aecocMatch = productoMatch[columnasMatching.AECOC];
    puntuaciones.aecoc = puntuacionAECOC(aecocRef, aecocMatch, pesos.aecoc);
    if (mostrarLogs && (aecocRef || aecocMatch)) {
      const normalizarAECOC = (aecoc) => {
        let s = String(aecoc || "").trim().replace(/\D/g, "");
        s = "0" + s;
        return s.padEnd(15, "0");
      };
      const aecocRefNorm = normalizarAECOC(aecocRef);
      const aecocMatchNorm = normalizarAECOC(aecocMatch);
      let digitosCoincidentes = 0;
      for (let i = 0; i < 14; i += 2) {
        if (aecocRefNorm.substring(i, i + 2) === aecocMatchNorm.substring(i, i + 2)) {
          digitosCoincidentes += 2;
        } else {
          break;
        }
      }
      const porcentaje = Math.min(digitosCoincidentes / 10, 1);
      console.log(`${puntuaciones.aecoc > 0 ? '✅' : '⚠️'} AECOC: ${digitosCoincidentes}/14 dígitos (${Math.round(porcentaje * 100)}%) → +${puntuaciones.aecoc.toFixed(1)} pts`);
      console.log(`   "${aecocRef}" → "${aecocRefNorm}"`);
      console.log(`   "${aecocMatch}" → "${aecocMatchNorm}"\n`);
    }

    // Marca (normalizada)
    const marcaRefOriginal = productoRef[columnasReferencia.MARCA] ?? "";
    const marcaMatchOriginal = productoMatch[columnasMatching.MARCA] ?? "";
    const marcaRef = normalizarDescripcion(marcaRefOriginal);
    const marcaMatch = normalizarDescripcion(marcaMatchOriginal);
    if (marcaRef && marcaMatch && marcaRef === marcaMatch) {
      puntuaciones.marca = pesos.marca;
      if (mostrarLogs) {
        console.log("✅ MARCA: MATCH → +%s pts", pesos.marca);
        if (marcaRefOriginal !== marcaRef) {
          console.log(`   "${marcaRefOriginal}" → "${marcaRef}"\n`);
        } else {
          console.log(`   "${marcaRef}"\n`);
        }
      }
    } else if (mostrarLogs && (marcaRef || marcaMatch)) {
      console.log("❌ MARCA: No coincide → +0 pts");
      console.log(`   "${marcaRef}" ≠ "${marcaMatch}"\n`);
    }

    // Cantidad (normalizada)
    const cantRefOriginal = productoRef[columnasReferencia.CANTIDAD];
    const cantMatchOriginal = productoMatch[columnasMatching.CANTIDAD];
    const cantRef = normalizarNumero(cantRefOriginal);
    const cantMatch = normalizarNumero(cantMatchOriginal);
    if (cantRef !== null && cantMatch !== null && cantRef === cantMatch) {
      puntuaciones.cantidad = pesos.cantidadExacta;
      if (mostrarLogs) {
        console.log("✅ CANTIDAD: MATCH → +%s pts", pesos.cantidadExacta);
        if (cantRefOriginal != cantRef) {
          console.log(`   "${cantRefOriginal}" → ${cantRef}\n`);
        } else {
          console.log(`   ${cantRef}\n`);
        }
      }
    } else if (mostrarLogs && (cantRef !== null || cantMatch !== null)) {
      console.log("❌ CANTIDAD: No coincide → +0 pts");
      console.log(`   ${cantRef} ≠ ${cantMatch}\n`);
    }

    // Medida (normalizada)
    const medRefOriginal = productoRef[columnasReferencia.MEDIDA] ?? "";
    const medMatchOriginal = productoMatch[columnasMatching.MEDIDA] ?? "";
    const medRef = normalizarUnidadMedida(medRefOriginal);
    const medMatch = normalizarUnidadMedida(medMatchOriginal);
    if (medRef && medMatch && medRef === medMatch) {
      puntuaciones.medida = pesos.medida;
      if (mostrarLogs) {
        console.log("✅ MEDIDA: MATCH → +%s pts", pesos.medida);
        if (medRefOriginal !== medRef || medMatchOriginal !== medMatch) {
          console.log(`   "${medRefOriginal}" → "${medRef}"\n`);
        } else {
          console.log(`   "${medRef}"\n`);
        }
      }
    } else if (mostrarLogs && (medRef || medMatch)) {
      console.log("❌ MEDIDA: No coincide → +0 pts");
      console.log(`   "${medRef}" ≠ "${medMatch}"\n`);
    }

    // Formato (normalizado)
    const formRefOriginal = productoRef[columnasReferencia.FORMATO] ?? "";
    const formMatchOriginal = productoMatch[columnasMatching.FORMATO] ?? "";
    const formRef = normalizarDescripcion(formRefOriginal);
    const formMatch = normalizarDescripcion(formMatchOriginal);
    if (formRef && formMatch && formRef === formMatch) {
      puntuaciones.formato = pesos.formato;
      if (mostrarLogs) {
        console.log("✅ FORMATO: MATCH → +%s pts", pesos.formato);
        if (formRefOriginal !== formRef) {
          console.log(`   "${formRefOriginal}" → "${formRef}"\n`);
        } else {
          console.log(`   "${formRef}"\n`);
        }
      }
    } else if (mostrarLogs && (formRef || formMatch)) {
      console.log("❌ FORMATO: No coincide → +0 pts");
      console.log(`   "${formRef}" ≠ "${formMatch}"\n`);
    }

    // Sabor (normalizado)
    const sabRefOriginal = productoRef[columnasReferencia.SABOR] ?? "";
    const sabMatchOriginal = productoMatch[columnasMatching.SABOR] ?? "";
    const sabRef = normalizarDescripcion(sabRefOriginal);
    const sabMatch = normalizarDescripcion(sabMatchOriginal);
    if (sabRef && sabMatch && sabRef === sabMatch) {
      puntuaciones.sabor = pesos.sabor;
      if (mostrarLogs) {
        console.log("✅ SABOR: MATCH → +%s pts", pesos.sabor);
        if (sabRefOriginal !== sabRef) {
          console.log(`   "${sabRefOriginal}" → "${sabRef}"\n`);
        } else {
          console.log(`   "${sabRef}"\n`);
        }
      }
    } else if (mostrarLogs && (sabRef || sabMatch)) {
      console.log("❌ SABOR: No coincide → +0 pts");
      console.log(`   "${sabRef}" ≠ "${sabMatch}"\n`);
    }

    // Unidades (normalizadas)
    const uniRefOriginal = productoRef[columnasReferencia.UNIDADES];
    const uniMatchOriginal = productoMatch[columnasMatching.UNIDADES];
    const uniRef = normalizarNumero(uniRefOriginal);
    const uniMatch = normalizarNumero(uniMatchOriginal);
    if (uniRef !== null && uniMatch !== null && uniRef === uniMatch) {
      puntuaciones.unidades = pesos.unidades;
      if (mostrarLogs) {
        console.log("✅ UNIDADES: MATCH → +%s pts", pesos.unidades);
        if (uniRefOriginal != uniRef) {
          console.log(`   "${uniRefOriginal}" → ${uniRef}\n`);
        } else {
          console.log(`   ${uniRef}\n`);
        }
      }
    } else if (mostrarLogs && (uniRef !== null || uniMatch !== null)) {
      console.log("❌ UNIDADES: No coincide → +0 pts");
      console.log(`   ${uniRef} ≠ ${uniMatch}\n`);
    }

    // Descripción (ya normalizada en tokenizar)
    const descRefOriginal = productoRef[columnasReferencia.DESCRIPCION];
    const descMatchOriginal = productoMatch[columnasMatching.DESCRIPCION];
    const descRef = tokenizar(descRefOriginal);
    const descMatch = tokenizar(descMatchOriginal);
    const similitud = similitudMejorada(descRef, descMatch);
    puntuaciones.descripcion = similitud * pesos.descripcionJaccard;
    if (mostrarLogs) {
      console.log(`${puntuaciones.descripcion > 20 ? '✅' : '⚠️'} DESCRIPCIÓN: Similitud ${(similitud * 100).toFixed(1)}% → +${puntuaciones.descripcion.toFixed(1)} pts`);
      console.log(`   Tokens Ref:   [${descRef.join(', ')}]`);
      console.log(`   Tokens Match: [${descMatch.join(', ')}]\n`);
    }

    // Total
    puntuaciones.total = Object.values(puntuaciones).reduce((a, b) => a + b, 0) - puntuaciones.total;

    if (mostrarLogs) {
      console.log("═══════════════════════════════════════════════════════════════");
      console.log(`🎯 PUNTUACIÓN TOTAL: ${puntuaciones.total.toFixed(1)} puntos`);
      console.log("═══════════════════════════════════════════════════════════════\n");
    }

    return puntuaciones;
  }

  /** Calcula Top 5 para el producto actual */
  function calcularTop5ParaActual() {
    if (!filasReferencia.length || !filasMatching.length || !columnasReferencia || !columnasMatching) return [];
    
    const productoRef = filasReferencia[indiceActual];
    const candidatos = [];
    
    // Calcular puntuaciones sin logs
    filasMatching.forEach((productoMatch, idx) => {
      const puntuacion = calcularPuntuacionDetallada(productoRef, productoMatch, false);
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
    console.log('seleccionarMatch: productoMatch', productoMatch);
    console.log('columnasMatching:', columnasMatching);
    const nuevosMatches = new Map(matchesSeleccionados);
    const matchAnterior = matchesSeleccionados.get(indiceActual);
    
    const codiprodpx = productoMatch[columnasMatching.CODIPROD];
    console.log('CODIPRODPX seleccionado:', codiprodpx);
    
    nuevosMatches.set(indiceActual, {
      codiprodpx,
      esNoMatch: false
    });
    
    // Actualizar contadores
    if (!matchAnterior) {
      // Nuevo match
      setContadorMatches(prev => prev + 1);
    } else if (matchAnterior.esNoMatch) {
      // Cambio de NO MATCH a match
      setContadorMatches(prev => prev + 1);
      setContadorNoMatches(prev => prev - 1);
    }
    
    setMatchesSeleccionados(nuevosMatches);
  }

  /** Seleccionar NO MATCH para el producto actual */
  function seleccionarNoMatch() {
    const nuevosMatches = new Map(matchesSeleccionados);
    const matchAnterior = matchesSeleccionados.get(indiceActual);
    
    nuevosMatches.set(indiceActual, {
      codiprodpx: "NO MATCH",
      esNoMatch: true
    });
    
    // Actualizar contadores
    if (!matchAnterior) {
      // Nuevo NO MATCH
      setContadorNoMatches(prev => prev + 1);
    } else if (!matchAnterior.esNoMatch) {
      // Cambio de match a NO MATCH
      setContadorMatches(prev => prev - 1);
      setContadorNoMatches(prev => prev + 1);
    }
    
    setMatchesSeleccionados(nuevosMatches);
  }

  /** Exportar Excel con matches */
  function exportarExcelMatcheado() {
    if (!filasReferencia.length || !columnasReferencia) return;
    console.log('Exportando Excel con columnasReferencia:', columnasReferencia);
    const filasActualizadas = filasReferencia.map((fila, idx) => {
      const match = matchesSeleccionados.get(idx);
      const filaLimpia = { ...fila };
      console.log('Fila', idx, 'match:', match);
      // Añadir columna CODIPRODPX con el CODIPROD del excel grande
      filaLimpia[columnasReferencia.CODIPRODPX] = match?.codiprodpx ?? "";
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
    const savedContadorMatches = localStorage.getItem('contadorMatches');
    const savedContadorNoMatches = localStorage.getItem('contadorNoMatches');

    if (userSession) {
      setIsAuthenticated(true);
    }

    if (savedMatches) {
      const matchesMap = new Map(JSON.parse(savedMatches));
      setMatchesSeleccionados(matchesMap);
      
      // Recalcular contadores si no están guardados
      if (!savedContadorMatches && !savedContadorNoMatches) {
        let matches = 0;
        let noMatches = 0;
        matchesMap.forEach(match => {
          if (match.esNoMatch) {
            noMatches++;
          } else {
            matches++;
          }
        });
        setContadorMatches(matches);
        setContadorNoMatches(noMatches);
      }
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

    if (savedContadorMatches) {
      setContadorMatches(Number(savedContadorMatches));
    }

    if (savedContadorNoMatches) {
      setContadorNoMatches(Number(savedContadorNoMatches));
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
      localStorage.setItem('contadorMatches', contadorMatches);
      localStorage.setItem('contadorNoMatches', contadorNoMatches);
    }
  }, [isAuthenticated, matchesSeleccionados, filasReferencia, filasMatching, columnasReferencia, columnasMatching, indiceActual, contadorMatches, contadorNoMatches]);

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
      localStorage.removeItem('contadorMatches');
      localStorage.removeItem('contadorNoMatches');
      setFilasReferencia([]);
      setFilasMatching([]);
      setColumnasReferencia(null);
      setColumnasMatching(null);
      setIndiceActual(0);
      setMatchesSeleccionados(new Map());
      setContadorMatches(0);
      setContadorNoMatches(0);
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
            label="Excel Pequeño (A matchear)"
          />
          <FileUploader
            inputRef={inputFicheroMatching}
            fileCount={filasMatching.length}
            onUpload={manejarFicheroMatching}
            label="Excel Grande (Base de datos)"
          />
        </div>
      </div>

      {filasReferencia.length > 0 && filasMatching.length > 0 && (
        <>
          {/* Bloque: Navegación y Matching */}
          <div style={styles.card}>
            <h2 style={styles.subtitle}>2) Matching de Productos ({indiceActual + 1} de {filasReferencia.length})</h2>
            
            {/* Contador de matches */}
            <div style={{
              display: "flex", 
              gap: "20px", 
              marginBottom: "20px", 
              padding: "12px", 
              backgroundColor: "#f8f9fa", 
              borderRadius: "8px",
              border: "1px solid #e9ecef"
            }}>
              <div style={{display: "flex", alignItems: "center", gap: "8px"}}>
                <span style={{color: "#28a745", fontWeight: "bold", fontSize: "16px"}}>✅ Matches:</span>
                <span style={{color: "#28a745", fontWeight: "bold", fontSize: "18px"}}>{contadorMatches}</span>
              </div>
              <div style={{display: "flex", alignItems: "center", gap: "8px"}}>
                <span style={{color: "#dc3545", fontWeight: "bold", fontSize: "16px"}}>❌ No Matches:</span>
                <span style={{color: "#dc3545", fontWeight: "bold", fontSize: "18px"}}>{contadorNoMatches}</span>
              </div>
              <div style={{display: "flex", alignItems: "center", gap: "8px"}}>
                <span style={{color: "#6c757d", fontWeight: "bold", fontSize: "16px"}}>📊 Total procesados:</span>
                <span style={{color: "#6c757d", fontWeight: "bold", fontSize: "18px"}}>{contadorMatches + contadorNoMatches}</span>
              </div>
            </div>
            
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
                  Descargar Excel Matcheado ({contadorMatches + contadorNoMatches} procesados)
                </button>
              </div>
            </div>

            {/* Top 5 matches */}
            <div style={{marginTop: "24px"}}>
              <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px"}}>
                <h3 style={{margin: "0", color: "#334155", fontSize: "16px"}}>Mejores coincidencias:</h3>
                <button
                  onClick={() => {
                    const top5 = calcularTop5ParaActual();
                    if (top5.length > 0) {
                      console.clear();
                      calcularPuntuacionDetallada(filasReferencia[indiceActual], top5[0].producto, true);
                    } else {
                      console.log("❌ No hay matches para analizar");
                    }
                  }}
                  style={{
                    backgroundColor: "#6366f1",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "bold",
                    transition: "all 0.2s ease",
                    boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)"
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = "#4f46e5";
                    e.target.style.transform = "translateY(-1px)";
                    e.target.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.4)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = "#6366f1";
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 2px 8px rgba(99, 102, 241, 0.3)";
                  }}
                >
                  🔍 Ver Análisis Detallado (Consola)
                </button>
              </div>
              <div style={{display: "flex", flexDirection: "column", gap: "16px"}}>
                {calcularTop5ParaActual().map((match, idx) => (
                  <MatchScore
                    key={idx}
                    match={match}
                    columnasMatching={columnasMatching}
                    onSelect={() => seleccionarMatch(match.producto)}
                    isSelected={matchesSeleccionados.get(indiceActual)?.codiprodpx === match.producto[columnasMatching.CODIPROD]}
                  />
                ))}
                
                {/* Opción NO MATCH */}
                <div style={{
                  border: "2px solid #dc3545",
                  borderRadius: "8px",
                  padding: "16px",
                  backgroundColor: matchesSeleccionados.get(indiceActual)?.esNoMatch ? "#f8d7da" : "white",
                  transition: "all 0.2s ease"
                }}>
                  <div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                    <div style={{flex: 1}}>
                      <div style={{fontSize: "16px", fontWeight: "bold", color: "#dc3545", marginBottom: "4px"}}>
                        ❌ NO MATCH
                      </div>
                      <div style={{fontSize: "14px", color: "#6c757d"}}>
                        Selecciona esta opción si ninguna de las opciones anteriores es correcta
                      </div>
                    </div>
                    <button
                      onClick={seleccionarNoMatch}
                      style={{
                        backgroundColor: matchesSeleccionados.get(indiceActual)?.esNoMatch ? "#dc3545" : "#fff",
                        color: matchesSeleccionados.get(indiceActual)?.esNoMatch ? "white" : "#dc3545",
                        border: "2px solid #dc3545",
                        padding: "8px 16px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "bold",
                        minWidth: "100px",
                        transition: "all 0.2s ease"
                      }}
                      onMouseOver={(e) => {
                        if (!matchesSeleccionados.get(indiceActual)?.esNoMatch) {
                          e.target.style.backgroundColor = "#dc3545";
                          e.target.style.color = "white";
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!matchesSeleccionados.get(indiceActual)?.esNoMatch) {
                          e.target.style.backgroundColor = "#fff";
                          e.target.style.color = "#dc3545";
                        }
                      }}
                    >
                      {matchesSeleccionados.get(indiceActual)?.esNoMatch ? "SELECCIONADO" : "Seleccionar"}
                    </button>
                  </div>
                </div>
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