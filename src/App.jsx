import React, { useRef, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { styles } from "./styles";
import { FileUploader } from "./components/FileUploader";
import { ProductCard } from "./components/ProductCard";
import { WeightAdjuster } from "./components/WeightAdjuster";
import { MatchScore } from "./components/MatchScore";
import Login from "./components/Login";
import sessionService from "./services/sessionService";
import { Notification, ConfirmDialog } from "./components/Notification";

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

/** Normaliza números */
function normalizarNumero(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  
  let s = String(raw).trim();
  
  if (/e[+-]?\d+/i.test(s)) {
    const asNumber = Number(raw);
    if (!Number.isFinite(asNumber)) return null;
    return asNumber;
  }
  
  s = s.replace(/\s+/g, "");
  s = s.replace(/\./g, "");
  s = s.replace(/,/g, ".");
  
  const num = parseFloat(s);
  return Number.isFinite(num) ? num : null;
}

/** Normaliza descripción */
function normalizarDescripcion(raw) {
  if (!raw) return "";
  return String(raw)
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

/** Normaliza unidad de medida */
function normalizarUnidadMedida(raw) {
  if (!raw) return "";
  let s = String(raw)
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "");
  
  const equivalencias = {
    'kilogramo': 'kg', 'kilogramos': 'kg', 'kilo': 'kg', 'kilos': 'kg',
    'gramo': 'g', 'gramos': 'g',
    'litro': 'l', 'litros': 'l',
    'mililitro': 'ml', 'mililitros': 'ml',
    'unidad': 'u', 'unidades': 'u',
    'metro': 'm', 'metros': 'm',
    'centimetro': 'cm', 'centimetros': 'cm',
  };
  
  return equivalencias[s] || s;
}

/** Tokeniza texto para similitud */
function tokenizar(str) {
  if (!str) return [];
  const normalizado = normalizarDescripcion(str);
  let protegido = normalizado.replace(/(\d+)[,.](\d+)/g, '$1_$2');
  protegido = protegido.replace(/[^a-z0-9_]+/g, " ");
  return protegido
    .split(" ")
    .filter(Boolean)
    .map(token => token.replace(/_/g, '.'));
}

/** Calcula similitud entre dos palabras */
function similitudPalabras(palabra1, palabra2) {
  if (!palabra1 || !palabra2) return 0;
  if (palabra1 === palabra2) return 1;
  if (palabra1.length < 4 || palabra2.length < 4) return 0;
  
  if (palabra1.includes(palabra2) || palabra2.includes(palabra1)) {
    const minLen = Math.min(palabra1.length, palabra2.length);
    const maxLen = Math.max(palabra1.length, palabra2.length);
    if (minLen >= 4) {
      return minLen / maxLen * 0.8;
    }
  }
  
  const distancia = levenshtein(palabra1, palabra2);
  const maxLen = Math.max(palabra1.length, palabra2.length);
  const similitud = 1 - (distancia / maxLen);
  
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

/** Similitud mejorada */
function similitudMejorada(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  
  const A = new Set(tokensA);
  const B = new Set(tokensB);
  let coincidenciasExactas = 0;
  A.forEach(t => { if (B.has(t)) coincidenciasExactas++; });
  
  let similitudParcial = 0;
  let comparaciones = 0;
  
  tokensA.forEach(tokenA => {
    if (tokenA.length >= 4) {
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
  
  const similitudParcialNormalizada = comparaciones > 0 ? similitudParcial / comparaciones : 0;
  const union = A.size + B.size - coincidenciasExactas;
  const jaccardScore = union ? coincidenciasExactas / union : 0;
  
  return Math.max(jaccardScore, similitudParcialNormalizada * 0.5);
}

/** Puntuación AECOC progresiva */
function puntuacionAECOC(aecocA, aecocB, pesoBase) {
  if (!aecocA || !aecocB) return 0;
  
  const normalizarAECOC = (aecoc) => {
    let s = String(aecoc).trim().replace(/\D/g, "");
    return s.padEnd(14, "0");
  };
  
  const a = normalizarAECOC(aecocA);
  const b = normalizarAECOC(aecocB);
  
  let digitosCoincidentes = 0;
  for (let i = 0; i < 14; i += 2) {
    const parA = a.substring(i, i + 2);
    const parB = b.substring(i, i + 2);
    
    if (parA === parB) {
      digitosCoincidentes += 2;
    } else {
      break;
    }
  }
  
  if (digitosCoincidentes === 0) return 0;
  
  const porcentaje = Math.min(digitosCoincidentes / 10, 1);
  return pesoBase * porcentaje;
}

/** Puntuación basada en similitud de precio */
function puntuacionPrecio(precioRef, precioMatch, pesoBase) {
  // Normalizar precios a números
  const pRef = normalizarNumero(precioRef);
  const pMatch = normalizarNumero(precioMatch);
  
  // Si alguno no existe, no puntuar
  if (pRef === null || pMatch === null || pRef === 0) return 0;
  
  // Calcular diferencia absoluta
  const diferencia = Math.abs(pRef - pMatch);
  
  // Calcular diferencia porcentual respecto al precio de referencia
  const diferenciaPorcentual = diferencia / pRef;
  
  // Sistema de puntuación decreciente según la diferencia
  // 0% diferencia = 100% puntos
  // 10% diferencia = 90% puntos
  // 20% diferencia = 80% puntos
  // 50% diferencia = 50% puntos
  // 100% diferencia o más = 0% puntos
  
  let multiplicador = 0;
  if (diferenciaPorcentual <= 0.05) {
    // Diferencia <= 5%: puntuación completa
    multiplicador = 1;
  } else if (diferenciaPorcentual <= 0.10) {
    // Diferencia 5-10%: 95-90%
    multiplicador = 1 - (diferenciaPorcentual - 0.05) * 2;
  } else if (diferenciaPorcentual <= 0.20) {
    // Diferencia 10-20%: 90-80%
    multiplicador = 0.9 - (diferenciaPorcentual - 0.10) * 1;
  } else if (diferenciaPorcentual <= 0.50) {
    // Diferencia 20-50%: 80-50%
    multiplicador = 0.8 - (diferenciaPorcentual - 0.20) * 1;
  } else if (diferenciaPorcentual <= 1.0) {
    // Diferencia 50-100%: 50-0%
    multiplicador = 0.5 - (diferenciaPorcentual - 0.50) * 1;
  } else {
    // Diferencia > 100%: 0%
    multiplicador = 0;
  }
  
  return pesoBase * Math.max(0, multiplicador);
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
    PMEDIO: pick(["pmedio", "pvp", "precio"], "PMEDIO"),
    EQUIVALE: pick(["equivale"], "EQUIVALE"),
    FACTOR: pick(["factor"], "FACTOR"),
    CODIPRODPX: pick(["codiprodpx"], "CODIPRODPX"),
  };
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const inputFicheroReferencia = useRef(null);
  const inputFicheroMatching = useRef(null);
  const listaMatchesRef = useRef(null);
  const archivoSugerenciasPendiente = useRef(null); // Para subir sugerencias después de crear sesión
  
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
  const [pesos, setPesos] = useState({
    codiProdExacto: 0,
    eanExacto: 200,
    marca: 80,
    aecoc: 40, 
    descripcionJaccard: 40,
    cantidadExacta: 10,
    unidades: 5,
    precio: 2,
    formato: 1, 
    medida: 1,
    sabor: 0,
  });
  const [ponderacionesVisible, setPonderacionesVisible] = useState(false);
  const [comentarioNoMatch, setComentarioNoMatch] = useState("");
  const [cantidadProductos, setCantidadProductos] = useState(5); // 5, 10, 25, 50
  const [seleccionMultiple, setSeleccionMultiple] = useState(new Set());

  // Estados para persistencia en BD
  const [sesionActiva, setSesionActiva] = useState(null); // ID de sesión activa
  const [sesionesDisponibles, setSesionesDisponibles] = useState([]); // Lista de sesiones del usuario
  const [mostrarSelectorSesiones, setMostrarSelectorSesiones] = useState(false);
  
  // Estados para buscador manual
  const [busquedaManual, setBusquedaManual] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [totalResultadosBusqueda, setTotalResultadosBusqueda] = useState(0); // Total de resultados encontrados (antes de aplicar límite)
  const [busquedaActiva, setBusquedaActiva] = useState(false); // Controla si se muestran resultados de búsqueda en vez de top automáticos
  
  // Estado para controlar cuándo hacer scroll automático
  const [debeHacerScroll, setDebeHacerScroll] = useState(false);

  // Estados para notificaciones y confirmaciones
  const [notificacion, setNotificacion] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Estado para mapeo de marcas editadas: { "marca-original": "marca-nueva" }
  const [marcasEditadas, setMarcasEditadas] = useState(new Map());
  const [editandoMarca, setEditandoMarca] = useState(null); // { marcaOriginal: "...", marcaNueva: "..." }

  // Funciones helper para notificaciones
  const mostrarNotificacion = (message, type = 'info', duration = 4000) => {
    setNotificacion({ message, type, duration });
  };

  const mostrarConfirmacion = (message, title = '¿Estás seguro?') => {
    return new Promise((resolve) => {
      setConfirmDialog({
        message,
        title,
        onConfirm: () => {
          setConfirmDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmDialog(null);
          resolve(false);
        }
      });
    });
  };

  /** 
   * Obtiene la marca efectiva de un producto de referencia
   * (si fue editada, devuelve la nueva; si no, la original)
   */
  function obtenerMarcaEfectiva(productoRef) {
    if (!columnasReferencia?.MARCA) return "";
    const marcaOriginal = productoRef[columnasReferencia.MARCA] || "";
    return marcasEditadas.get(marcaOriginal) || marcaOriginal;
  }

  /**
   * Editar una marca del archivo de REFERENCIA (tu archivo de entrada)
   * Aplicar el cambio a TODOS los productos con esa marca
   */
  async function editarMarcaReferencia(marcaOriginal, marcaNueva) {
    if (!marcaOriginal || !marcaNueva) return;
    
    const marcaNuevaTrim = marcaNueva.trim();
    if (!marcaNuevaTrim) return;
    
    // Si es la misma marca, no hacer nada
    if (marcaOriginal === marcaNuevaTrim) {
      setEditandoMarca(null);
      return;
    }
    
    const confirmacion = await mostrarConfirmacion(
      `¿Cambiar todas las ocurrencias de "${marcaOriginal}" por "${marcaNuevaTrim}"?\n\n` +
      `Esto afectará a todos TUS productos (referencia) con esta marca y recalculará automáticamente las puntuaciones.`,
      '✏️ Editar marca'
    );
    
    if (!confirmacion) {
      setEditandoMarca(null);
      return;
    }
    
    // Actualizar el mapeo de marcas editadas
    const nuevoMapeo = new Map(marcasEditadas);
    nuevoMapeo.set(marcaOriginal, marcaNuevaTrim);
    setMarcasEditadas(nuevoMapeo);
    
    // Aplicar el cambio directamente en filasReferencia
    const filasActualizadas = filasReferencia.map(fila => {
      if (fila[columnasReferencia.MARCA] === marcaOriginal) {
        return {
          ...fila,
          [columnasReferencia.MARCA]: marcaNuevaTrim
        };
      }
      return fila;
    });
    
    setFilasReferencia(filasActualizadas);
    
    // Contar productos afectados
    const productosActualizados = filasActualizadas.filter(
      fila => fila[columnasReferencia.MARCA] === marcaNuevaTrim
    ).length;
    
    // Guardar en BD (mapeo de marcas editadas)
    if (sesionActiva) {
      try {
        // Convertir Map a objeto para guardar en BD
        const mapeoObj = Object.fromEntries(nuevoMapeo);
        await sessionService.saveBrandMapping(sesionActiva, mapeoObj);
        console.log('✅ Mapeo de marcas guardado en BD');
      } catch (error) {
        console.error('Error guardando mapeo de marcas:', error);
      }
    }
    
    // Mostrar notificación
    mostrarNotificacion(
      `✅ Marca actualizada correctamente\n\n` +
      `"${marcaOriginal}" → "${marcaNuevaTrim}"\n` +
      `${productosActualizados} productos actualizados`,
      'success',
      5000
    );
    
    // Cerrar modal de edición
    setEditandoMarca(null);
    
    // Limpiar búsqueda si estaba activa para refrescar resultados
    if (busquedaActiva) {
      limpiarBusqueda();
    }
  }

  /**
   * Abrir modal de edición de marca
   */
  function abrirEdicionMarca(marcaOriginal) {
    const marcaActual = marcasEditadas.get(marcaOriginal) || marcaOriginal;
    setEditandoMarca({
      marcaOriginal,
      marcaNueva: marcaActual
    });
  }

  /**
   * Verificar si una marca fue editada
   */
  function marcaFueEditada(marcaOriginal) {
    return marcasEditadas.has(marcaOriginal);
  }

  /** Cargar Excel de referencia */
  function manejarFicheroReferencia(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
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
      setContadorMatches(0);
      setContadorNoMatches(0);

      // Crear sesión en BD si no existe
      const userSession = localStorage.getItem('userSession');
      if (!sesionActiva && userSession) {
        await crearNuevaSesion(json, colDetectadas, 'referencia', file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /** Cargar Excel para matching */
  function manejarFicheroMatching(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const data = new Uint8Array(ev.target.result);
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (!json.length) return;

      const cabecera = Object.keys(json[0]);
      const colDetectadas = adivinarColumnas(cabecera);
      setColumnasMatching(colDetectadas);
      setFilasMatching(json);

      // Subir archivo a BD
      const userSession = localStorage.getItem('userSession');
      if (sesionActiva && userSession) {
        // Ya hay sesión activa, subir directamente
        console.log('📤 Subiendo archivo de sugerencias a sesión:', sesionActiva);
        await subirArchivoABD('sugerencias', file.name, json, colDetectadas);
      } else if (userSession) {
        // No hay sesión activa aún, guardar para subir después
        console.log('💾 Guardando archivo de sugerencias para subir cuando se cree la sesión');
        archivoSugerenciasPendiente.current = {
          nombreArchivo: file.name,
          datos: json,
          columnas: colDetectadas
        };
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /** Calcula puntuación detallada entre dos productos */
  function calcularPuntuacionDetallada(productoRef, productoMatch) {
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
      precio: 0,
      descripcion: 0,
      total: 0
    };

    // CODIPROD - PRIORIDAD MÁXIMA
    const codiProdRef = (productoRef[columnasReferencia.CODIPROD] ?? "").toString().trim();
    const codiProdMatch = (productoMatch[columnasMatching.CODIPROD] ?? "").toString().trim();
    if (codiProdRef && codiProdMatch && codiProdRef === codiProdMatch) {
      puntuaciones.codiprod = pesos.codiProdExacto;
      puntuaciones.total = pesos.codiProdExacto;
      return puntuaciones;
    }

    // EAN
    const eanRefOriginal = productoRef[columnasReferencia.EAN];
    const eanMatchOriginal = productoMatch[columnasMatching.EAN];
    const eanRef = normalizarEAN(eanRefOriginal);
    const eanMatch = normalizarEAN(eanMatchOriginal);
    if (eanRef && eanMatch && eanRef === eanMatch) {
      puntuaciones.ean = pesos.eanExacto;
    }

    // AECOC - Puntuación progresiva
    const aecocRef = productoRef[columnasReferencia.AECOC];
    const aecocMatch = productoMatch[columnasMatching.AECOC];
    puntuaciones.aecoc = puntuacionAECOC(aecocRef, aecocMatch, pesos.aecoc);

    const marcaRefOriginal = obtenerMarcaEfectiva(productoRef) ?? "";
    const marcaMatchOriginal = productoMatch[columnasMatching.MARCA] ?? "";
    const marcaRef = normalizarDescripcion(marcaRefOriginal);
    const marcaMatch = normalizarDescripcion(marcaMatchOriginal);
    if (marcaRef && marcaMatch && marcaRef === marcaMatch) {
      puntuaciones.marca = pesos.marca;
    }

    const cantRefOriginal = productoRef[columnasReferencia.CANTIDAD];
    const cantMatchOriginal = productoMatch[columnasMatching.CANTIDAD];
    const cantRef = normalizarNumero(cantRefOriginal);
    const cantMatch = normalizarNumero(cantMatchOriginal);
    if (cantRef !== null && cantMatch !== null && cantRef === cantMatch) {
      puntuaciones.cantidad = pesos.cantidadExacta;
    }

    const medRefOriginal = productoRef[columnasReferencia.MEDIDA] ?? "";
    const medMatchOriginal = productoMatch[columnasMatching.MEDIDA] ?? "";
    const medRef = normalizarUnidadMedida(medRefOriginal);
    const medMatch = normalizarUnidadMedida(medMatchOriginal);
    if (medRef && medMatch && medRef === medMatch) {
      puntuaciones.medida = pesos.medida;
    }

    const formRefOriginal = productoRef[columnasReferencia.FORMATO] ?? "";
    const formMatchOriginal = productoMatch[columnasMatching.FORMATO] ?? "";
    const formRef = normalizarDescripcion(formRefOriginal);
    const formMatch = normalizarDescripcion(formMatchOriginal);
    if (formRef && formMatch && formRef === formMatch) {
      puntuaciones.formato = pesos.formato;
    }

    const sabRefOriginal = productoRef[columnasReferencia.SABOR] ?? "";
    const sabMatchOriginal = productoMatch[columnasMatching.SABOR] ?? "";
    const sabRef = normalizarDescripcion(sabRefOriginal);
    const sabMatch = normalizarDescripcion(sabMatchOriginal);
    if (sabRef && sabMatch && sabRef === sabMatch) {
      puntuaciones.sabor = pesos.sabor;
    }

    const uniRefOriginal = productoRef[columnasReferencia.UNIDADES];
    const uniMatchOriginal = productoMatch[columnasMatching.UNIDADES];
    const uniRef = normalizarNumero(uniRefOriginal);
    const uniMatch = normalizarNumero(uniMatchOriginal);
    if (uniRef !== null && uniMatch !== null && uniRef === uniMatch) {
      puntuaciones.unidades = pesos.unidades;
    }

    // PRECIO - Puntuación basada en proximidad
    const precioRefOriginal = productoRef[columnasReferencia.PMEDIO];
    const precioMatchOriginal = productoMatch[columnasMatching.PMEDIO];
    puntuaciones.precio = puntuacionPrecio(precioRefOriginal, precioMatchOriginal, pesos.precio);

    const descRefOriginal = productoRef[columnasReferencia.DESCRIPCION];
    const descMatchOriginal = productoMatch[columnasMatching.DESCRIPCION];
    const descRef = tokenizar(descRefOriginal);
    const descMatch = tokenizar(descMatchOriginal);
    const similitud = similitudMejorada(descRef, descMatch);
    puntuaciones.descripcion = similitud * pesos.descripcionJaccard;

    puntuaciones.total = Object.values(puntuaciones).reduce((a, b) => a + b, 0) - puntuaciones.total;

    return puntuaciones;
  }

  /** Calcula Top candidatos para el producto actual */
  function calcularTop5ParaActual() {
    if (!filasReferencia.length || !filasMatching.length || !columnasReferencia || !columnasMatching) return [];
    
    // Si hay búsqueda activa, devolver resultados de búsqueda
    if (busquedaActiva && resultadosBusqueda.length > 0) {
      return resultadosBusqueda;
    }
    
    const productoRef = filasReferencia[indiceActual];
    const candidatos = [];
    
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
    
    return candidatos.slice(0, cantidadProductos);
  }

  async function seleccionarMatch(productoMatch) {
    const nuevosMatches = new Map(matchesSeleccionados);
    const matchAnterior = matchesSeleccionados.get(indiceActual);
    
    const match = {
      codiprodpx: productoMatch[columnasMatching.CODIPROD],
      esNoMatch: false
    };
    
    nuevosMatches.set(indiceActual, match);
    
    if (!matchAnterior) {
      setContadorMatches(prev => prev + 1);
    } else if (matchAnterior.esNoMatch) {
      setContadorMatches(prev => prev + 1);
      setContadorNoMatches(prev => prev - 1);
    }
    
    setMatchesSeleccionados(nuevosMatches);
    
    // Guardar en BD
    await guardarMatchEnBD(indiceActual, {
      codiprodSugerido: match.codiprodpx,
      puntuacionTotal: null,
      detalles: null,
      esMultiple: false,
      esNoMatch: false
    });
    
    setComentarioNoMatch("");
    setSeleccionMultiple(new Set());
    
    if (indiceActual < filasReferencia.length - 1) {
      setDebeHacerScroll(true);
      setIndiceActual(prev => prev + 1);
    }
  }

  function toggleSeleccionMultiple(indexProducto) {
    const nuevaSeleccion = new Set(seleccionMultiple);
    if (nuevaSeleccion.has(indexProducto)) {
      nuevaSeleccion.delete(indexProducto);
    } else {
      nuevaSeleccion.add(indexProducto);
    }
    setSeleccionMultiple(nuevaSeleccion);
  }

  async function matchearVariosProductos() {
    if (seleccionMultiple.size === 0) return;
    
    const top5 = calcularTop5ParaActual();
    const productosSeleccionados = Array.from(seleccionMultiple)
      .sort((a, b) => a - b)
      .map(idx => top5[idx])
      .filter(Boolean);
    
    if (productosSeleccionados.length === 0) return;
    
    const codiprods = productosSeleccionados
      .map(match => match.producto[columnasMatching.CODIPROD])
      .join(", ");
    
    const nuevosMatches = new Map(matchesSeleccionados);
    const matchAnterior = matchesSeleccionados.get(indiceActual);
    
    const match = {
      codiprodpx: codiprods,
      esNoMatch: false,
      esMultiple: true
    };
    
    nuevosMatches.set(indiceActual, match);
    
    if (!matchAnterior) {
      setContadorMatches(prev => prev + 1);
    } else if (matchAnterior.esNoMatch) {
      setContadorMatches(prev => prev + 1);
      setContadorNoMatches(prev => prev - 1);
    }
    
    setMatchesSeleccionados(nuevosMatches);
    
    // Guardar en BD
    await guardarMatchEnBD(indiceActual, {
      codiprodSugerido: match.codiprodpx,
      puntuacionTotal: null,
      detalles: null,
      esMultiple: true,
      esNoMatch: false
    });
    
    setComentarioNoMatch("");
    setSeleccionMultiple(new Set());
    
    if (indiceActual < filasReferencia.length - 1) {
      setDebeHacerScroll(true);
      setIndiceActual(prev => prev + 1);
    }
  }

  async function seleccionarNoMatch() {
    const nuevosMatches = new Map(matchesSeleccionados);
    const matchAnterior = matchesSeleccionados.get(indiceActual);
    
    const match = {
      codiprodpx: "NO MATCH",
      esNoMatch: true
    };
    
    nuevosMatches.set(indiceActual, match);
    
    if (!matchAnterior) {
      setContadorNoMatches(prev => prev + 1);
    } else if (!matchAnterior.esNoMatch) {
      setContadorMatches(prev => prev - 1);
      setContadorNoMatches(prev => prev + 1);
    }
    
    setMatchesSeleccionados(nuevosMatches);
    
    // Guardar en BD
    await guardarMatchEnBD(indiceActual, {
      codiprodSugerido: "NO MATCH",
      puntuacionTotal: null,
      detalles: null,
      esMultiple: false,
      esNoMatch: true
    });
    
    setComentarioNoMatch("");
    
    if (indiceActual < filasReferencia.length - 1) {
      setDebeHacerScroll(true);
      setIndiceActual(prev => prev + 1);
    }
  }

  async function seleccionarNoMatchConComentario() {
    if (!comentarioNoMatch.trim()) return;
    
    const nuevosMatches = new Map(matchesSeleccionados);
    const matchAnterior = matchesSeleccionados.get(indiceActual);
    
    const match = {
      codiprodpx: comentarioNoMatch.trim(),
      esNoMatch: true,
      tieneComentario: true
    };
    
    nuevosMatches.set(indiceActual, match);
    
    if (!matchAnterior) {
      setContadorNoMatches(prev => prev + 1);
    } else if (!matchAnterior.esNoMatch) {
      setContadorMatches(prev => prev - 1);
      setContadorNoMatches(prev => prev + 1);
    }
    
    setMatchesSeleccionados(nuevosMatches);
    
    // Guardar en BD
    await guardarMatchEnBD(indiceActual, {
      codiprodSugerido: match.codiprodpx,
      puntuacionTotal: null,
      detalles: null,
      esMultiple: false,
      esNoMatch: true
    });
    
    setComentarioNoMatch("");
    
    if (indiceActual < filasReferencia.length - 1) {
      setDebeHacerScroll(true);
      setIndiceActual(prev => prev + 1);
    }
  }

  async function noMatchPorMarca(marca) {
    if (!marca) return;
    
    const confirmacion = await mostrarConfirmacion(
      `¿Estás seguro de marcar como NO MATCH todos los productos de la marca "${marca}"?\n\n` +
      `Esto afectará a TODOS los productos pendientes de matchear que tengan esta marca.`,
      '⚠️ Marcar marca completa como NO MATCH'
    );
    
    if (!confirmacion) return;
    
    const nuevosMatches = new Map(matchesSeleccionados);
    let productosAfectados = 0;
    let nuevosNoMatches = 0;
    let matchesConvertidos = 0;
    
    // Normalizar la marca para comparación case-insensitive
    const marcaNormalizada = normalizarDescripcion(marca);
    
    // Recorrer todos los productos de referencia
    filasReferencia.forEach((producto, idx) => {
      const marcaProducto = producto[columnasReferencia.MARCA];
      const marcaProductoNormalizada = normalizarDescripcion(marcaProducto);
      
      // Si la marca coincide
      if (marcaProductoNormalizada === marcaNormalizada) {
        const matchAnterior = matchesSeleccionados.get(idx);
        
        // Solo marcar como NO MATCH si no tiene match previo o si tenía un match válido
        if (!matchAnterior) {
          nuevosNoMatches++;
          productosAfectados++;
        } else if (!matchAnterior.esNoMatch) {
          matchesConvertidos++;
          productosAfectados++;
        } else {
          // Ya era NO MATCH, no contar
          return;
        }
        
        // Marcar como NO MATCH con comentario de marca
        nuevosMatches.set(idx, {
          codiprodpx: `NO MATCH - Marca: ${marca}`,
          esNoMatch: true,
          tieneComentario: true,
          porMarca: true
        });
        
        // Guardar en BD de forma asíncrona (no esperar)
        guardarMatchEnBD(idx, {
          codiprodSugerido: `NO MATCH - Marca: ${marca}`,
          puntuacionTotal: null,
          detalles: null,
          esMultiple: false,
          esNoMatch: true
        });
      }
    });
    
    if (productosAfectados > 0) {
      // Actualizar estado
      setMatchesSeleccionados(nuevosMatches);
      setContadorNoMatches(prev => prev + nuevosNoMatches);
      setContadorMatches(prev => prev - matchesConvertidos);
      
      // Mostrar mensaje de confirmación
      mostrarNotificacion(
        `Se han marcado ${productosAfectados} productos como NO MATCH:\n\n` +
        `• ${nuevosNoMatches} productos sin match previo\n` +
        `• ${matchesConvertidos} productos con match convertidos a NO MATCH\n\n` +
        `Marca: "${marca}"`,
        'success',
        6000
      );
      
      // Avanzar al siguiente producto que no sea de esa marca
      let siguienteIndice = indiceActual + 1;
      while (siguienteIndice < filasReferencia.length) {
        const marcaSiguiente = filasReferencia[siguienteIndice][columnasReferencia.MARCA];
        const marcaSiguienteNormalizada = normalizarDescripcion(marcaSiguiente);
        
        if (marcaSiguienteNormalizada !== marcaNormalizada) {
          setIndiceActual(siguienteIndice);
          break;
        }
        siguienteIndice++;
      }
      
      // Si no hay más productos de otra marca, quedarse en el último
      if (siguienteIndice >= filasReferencia.length) {
        setIndiceActual(filasReferencia.length - 1);
      }
    } else {
      mostrarNotificacion(
        `No se encontraron productos de la marca "${marca}" para marcar como NO MATCH.`,
        'warning'
      );
    }
  }

  function ejecutarBusquedaManual() {
    if (!busquedaManual.trim() || !filasMatching.length || !columnasMatching) {
      // Si está vacío, volver a las sugerencias automáticas
      setBusquedaActiva(false);
      setResultadosBusqueda([]);
      return;
    }

    // Búsqueda LITERAL (sin normalizar ni tokenizar)
    // Solo convertir a minúsculas para que sea case-insensitive
    const terminoBusqueda = busquedaManual.trim().toLowerCase();
    
    console.log('🔍 BUSCANDO:', terminoBusqueda);
    console.log('📊 Total productos en filasMatching:', filasMatching.length);
    
    // Buscar coincidencias literales SOLO en descripción y marca
    const resultados = filasMatching
      .map((producto, idx) => {
        const descripcion = (producto[columnasMatching.DESCRIPCION] || "").toString().toLowerCase();
        const marca = (producto[columnasMatching.MARCA] || "").toString().toLowerCase();
        
        // Calcular relevancia solo con coincidencias LITERALES
        let relevancia = 0;
        
        // Coincidencia literal en marca (mayor prioridad)
        if (marca.includes(terminoBusqueda)) {
          relevancia += 50;
        }
        
        // Coincidencia literal en descripción
        if (descripcion.includes(terminoBusqueda)) {
          relevancia += 30;
        }
        
        // Si no hay ninguna coincidencia literal, no incluir este producto
        if (relevancia === 0) {
          return null;
        }
        
        // Calcular puntuación completa como en las sugerencias automáticas
        const productoRef = filasReferencia[indiceActual];
        const puntuacionCompleta = calcularPuntuacionDetallada(productoRef, producto);
        
        return {
          producto,
          indice: idx,
          relevancia,
          ...puntuacionCompleta
        };
      })
      .filter(r => r !== null) // Filtrar los null
      .sort((a, b) => {
        // Ordenar primero por puntuación de matching (más importante)
        const diffPuntuacion = b.puntuacionTotal - a.puntuacionTotal;
        if (Math.abs(diffPuntuacion) > 0.01) {
          return diffPuntuacion;
        }
        // Si tienen puntuación similar, ordenar por relevancia de búsqueda
        return b.relevancia - a.relevancia;
      });

    // Guardar el total de resultados encontrados ANTES de aplicar el límite
    const totalEncontrados = resultados.length;
    
    console.log('✅ Resultados encontrados:', totalEncontrados);
    if (totalEncontrados > 0) {
      console.log('📝 Primeros 3 resultados:', resultados.slice(0, 3).map(r => ({
        descripcion: r.producto[columnasMatching.DESCRIPCION]?.substring(0, 50),
        marca: r.producto[columnasMatching.MARCA],
        relevancia: r.relevancia
      })));
    }
    
    // Aplicar límite de cantidad de productos a mostrar
    const resultadosLimitados = resultados.slice(0, cantidadProductos);

    setTotalResultadosBusqueda(totalEncontrados);
    setResultadosBusqueda(resultadosLimitados);
    setBusquedaActiva(true);
  }

  function limpiarBusqueda() {
    setBusquedaManual("");
    setResultadosBusqueda([]);
    setTotalResultadosBusqueda(0);
    setBusquedaActiva(false);
  }

  function exportarExcelMatcheado() {
    if (!filasReferencia.length || !columnasReferencia) return;
    
    const filasActualizadas = filasReferencia.map((fila, idx) => {
      const match = matchesSeleccionados.get(idx);
      const filaLimpia = { ...fila };
      
      // Si hay match
      if (match) {
        // Si es NO MATCH con comentario
        if (match.esNoMatch && match.tieneComentario) {
          // Si ya empieza con "NO MATCH", no duplicar
          if (match.codiprodpx.startsWith('NO MATCH')) {
            filaLimpia[columnasReferencia.CODIPRODPX] = match.codiprodpx;
          } else {
            // Si no, agregar "NO MATCH: " antes del comentario
            filaLimpia[columnasReferencia.CODIPRODPX] = `NO MATCH: ${match.codiprodpx}`;
          }
        } else {
          filaLimpia[columnasReferencia.CODIPRODPX] = match.codiprodpx;
        }
      } else {
        filaLimpia[columnasReferencia.CODIPRODPX] = "";
      }
      
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

  // =====================================================
  // FUNCIONES DE PERSISTENCIA EN BASE DE DATOS
  // =====================================================

  async function crearNuevaSesion(filasReferencia, columnasRef, tipo, nombreArchivo) {
    try {
      const userSession = JSON.parse(localStorage.getItem('userSession'));
      if (!userSession) return;

      const nombreSesion = `Sesión ${new Date().toLocaleString('es-ES')}`;
      
      const result = await sessionService.createSession(
        userSession.id,
        nombreSesion,
        pesos,
        filasReferencia.length
      );

      if (result.success) {
        const nuevaSesionId = result.sesion_id;
        console.log('✅ Sesión creada:', nuevaSesionId);
        setSesionActiva(nuevaSesionId);
        
        // Subir archivo de referencia usando el ID directamente (no esperar a que se actualice el estado)
        console.log('📤 Subiendo archivo de referencia a sesión:', nuevaSesionId);
        const uploadResult = await sessionService.uploadFile(
          nuevaSesionId,
          'referencia',
          nombreArchivo,
          filasReferencia,
          columnasRef
        );
        
        if (uploadResult.success) {
          console.log('✅ Archivo de referencia subido:', uploadResult.stats);
        } else {
          console.error('❌ Error subiendo archivo de referencia:', uploadResult.error);
          mostrarNotificacion('Error al subir el archivo de referencia: ' + uploadResult.error, 'error');
        }
        
        // Recargar lista de sesiones
        await cargarSesionesUsuario();
      }
    } catch (error) {
      console.error('Error creando sesión:', error);
      mostrarNotificacion('Error al crear la sesión: ' + error.message, 'error');
    }
  }

  // Subir archivo de sugerencias pendiente cuando se crea la sesión
  useEffect(() => {
    const subirArchivoSugerenciasPendiente = async () => {
      if (sesionActiva && archivoSugerenciasPendiente.current) {
        const { nombreArchivo, datos, columnas } = archivoSugerenciasPendiente.current;
        console.log('📤 Subiendo archivo de sugerencias pendiente a sesión:', sesionActiva);
        
        try {
          const result = await sessionService.uploadFile(
            sesionActiva,
            'sugerencias',
            nombreArchivo,
            datos,
            columnas
          );
          
          if (result.success) {
            console.log('✅ Archivo de sugerencias subido:', result.stats);
          } else {
            console.error('❌ Error subiendo archivo de sugerencias:', result.error);
          }
        } catch (error) {
          console.error('❌ Error subiendo archivo de sugerencias:', error);
        } finally {
          archivoSugerenciasPendiente.current = null; // Limpiar después de subir
        }
      }
    };
    
    subirArchivoSugerenciasPendiente();
  }, [sesionActiva]);

  async function subirArchivoABD(tipoArchivo, nombreArchivo, datos, columnas) {
    if (!sesionActiva) {
      console.warn('⚠️ No hay sesión activa para subir archivo');
      return;
    }

    console.log(`📤 Subiendo archivo ${tipoArchivo}:`, {
      sesionId: sesionActiva,
      nombreArchivo,
      filas: datos.length,
      columnas: columnas.length
    });

    try {
      const result = await sessionService.uploadFile(
        sesionActiva,
        tipoArchivo,
        nombreArchivo,
        datos,
        columnas
      );

      if (result.success) {
        console.log(`✅ Archivo ${tipoArchivo} subido:`, result.stats);
      } else {
        console.error(`❌ Error subiendo ${tipoArchivo}:`, result.error);
        mostrarNotificacion(`Error al subir archivo ${tipoArchivo}: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error(`❌ Error subiendo archivo ${tipoArchivo}:`, error);
      mostrarNotificacion(`Error al subir archivo ${tipoArchivo}: ${error.message}`, 'error');
    }
  }

  async function cargarSesionesUsuario() {
    try {
      const userSession = JSON.parse(localStorage.getItem('userSession'));
      if (!userSession) return;

      const result = await sessionService.getSessions(userSession.id);
      
      if (result.success) {
        setSesionesDisponibles(result.sesiones);
        console.log('📋 Sesiones disponibles:', result.sesiones.length);
      }
    } catch (error) {
      console.error('Error cargando sesiones:', error);
    }
  }

  async function cargarSesionExistente(sesionId) {
    try {
      console.log('🔄 Cargando sesión:', sesionId);
      
      // Limpiar estado anterior primero
      setFilasReferencia([]);
      setFilasMatching([]);
      setColumnasReferencia([]);
      setColumnasMatching([]);
      setIndiceActual(0);
      setContadorMatches(0);
      setContadorNoMatches(0);
      setMatchesSeleccionados(new Map());
      
      const result = await sessionService.loadSession(sesionId);
      console.log('📦 Resultado loadSession:', result);
      
      if (result.success) {
        console.log('✅ Sesión cargada:', sesionId);
        
        // Establecer sesión activa
        setSesionActiva(sesionId);
        
        // Cargar archivos
        if (result.archivos?.referencia) {
          console.log('📄 Cargando referencia:', result.archivos.referencia.datos?.length, 'filas');
          setFilasReferencia(result.archivos.referencia.datos || []);
          setColumnasReferencia(result.archivos.referencia.columnas || []);
        } else {
          console.warn('⚠️ No se encontró archivo de referencia');
        }
        
        if (result.archivos?.sugerencias) {
          console.log('📄 Cargando sugerencias:', result.archivos.sugerencias.datos?.length, 'filas');
          setFilasMatching(result.archivos.sugerencias.datos || []);
          setColumnasMatching(result.archivos.sugerencias.columnas || []);
        } else {
          console.warn('⚠️ No se encontró archivo de sugerencias');
        }
        
        // Cargar progreso
        setIndiceActual(result.sesion.indice_actual);
        setContadorMatches(result.sesion.productos_matcheados);
        setContadorNoMatches(result.sesion.productos_no_match);
        console.log('📊 Progreso:', result.sesion.indice_actual, '/', result.sesion.total_productos);
        
        // Cargar pesos si existen
        if (result.sesion.pesos_config) {
          setPesos(result.sesion.pesos_config);
        }
        
        // Cargar mapeo de marcas editadas si existe
        if (result.sesion.mapeo_marcas) {
          const mapeoMarcas = new Map(Object.entries(result.sesion.mapeo_marcas));
          setMarcasEditadas(mapeoMarcas);
          console.log('✏️ Mapeo de marcas cargado:', mapeoMarcas.size, 'marcas editadas');
        }
        
        // Cargar resultados
        const matchesMap = new Map();
        Object.entries(result.resultados || {}).forEach(([indice, match]) => {
          matchesMap.set(Number(indice), {
            codiprodpx: match.codiprodSugerido,
            esNoMatch: match.esNoMatch,
            esMultiple: match.esMultiple
          });
        });
        setMatchesSeleccionados(matchesMap);
        console.log('✅ Matches cargados:', matchesMap.size);
        
        // Cerrar selector
        setMostrarSelectorSesiones(false);
      } else {
        console.error('❌ Error en loadSession:', result.error);
        mostrarNotificacion('Error al cargar la sesión: ' + (result.error || 'Error desconocido'), 'error');
      }
    } catch (error) {
      console.error('❌ Error cargando sesión:', error);
      mostrarNotificacion('Error al cargar la sesión: ' + error.message, 'error');
    }
  }

  async function guardarMatchEnBD(indiceProducto, match) {
    if (!sesionActiva) return;

    try {
      // Auto-save: guarda match + sync cada 5
      await sessionService.autoSave(
        sesionActiva,
        indiceProducto,
        match,
        {
          indiceActual: indiceProducto + 1,
          productosMatcheados: contadorMatches + (match.esNoMatch ? 0 : 1),
          productosNoMatch: contadorNoMatches + (match.esNoMatch ? 1 : 0)
        }
      );
    } catch (error) {
      console.error('Error guardando match:', error);
    }
  }

  async function sincronizarProgreso() {
    if (!sesionActiva) return;

    try {
      await sessionService.forceSync(sesionActiva, {
        indiceActual,
        productosMatcheados: contadorMatches,
        productosNoMatch: contadorNoMatches,
        estado: indiceActual >= filasReferencia.length ? 'completada' : 'en_progreso'
      });
      console.log('💾 Progreso sincronizado');
    } catch (error) {
      console.error('Error sincronizando progreso:', error);
    }
  }

  async function eliminarSesion(sesionId, nombreSesion) {
    const confirmacion = await mostrarConfirmacion(
      `¿Estás seguro de eliminar la sesión "${nombreSesion}"?\n\nEsto eliminará todos los archivos y matches guardados.`,
      '🗑️ Eliminar sesión'
    );
    
    if (!confirmacion) {
      return;
    }

    try {
      console.log('🗑️ Eliminando sesión:', sesionId);
      await sessionService.deleteSession(sesionId);
      
      // Si se eliminó la sesión activa, limpiar la UI
      if (sesionActiva === sesionId) {
        setSesionActiva(null);
        setFilasReferencia([]);
        setFilasMatching([]);
        setColumnasReferencia([]);
        setColumnasMatching([]);
        setIndiceActual(0);
        setContadorMatches(0);
        setContadorNoMatches(0);
        setMatchesSeleccionados(new Map());
      }
      
      // Recargar lista de sesiones
      await cargarSesionesUsuario();
      mostrarNotificacion('Sesión eliminada correctamente', 'success');
    } catch (error) {
      console.error('Error eliminando sesión:', error);
      mostrarNotificacion('Error al eliminar la sesión: ' + error.message, 'error');
    }
  }

  // Mantener solo el progreso de la sesión al recargar la página
  // Los datos de los archivos se cargan desde la base de datos al cargar una sesión
  useEffect(() => {
    // Limpiar datos antiguos de archivos Excel que puedan estar en localStorage
    // Esto previene el error QuotaExceededError
    localStorage.removeItem('filasReferencia');
    localStorage.removeItem('filasMatching');
    localStorage.removeItem('columnasReferencia');
    localStorage.removeItem('columnasMatching');
    
    const userSession = localStorage.getItem('userSession');
    const savedMatches = localStorage.getItem('matchesSeleccionados');
    const savedIndiceActual = localStorage.getItem('indiceActual');
    const savedContadorMatches = localStorage.getItem('contadorMatches');
    const savedContadorNoMatches = localStorage.getItem('contadorNoMatches');

    if (userSession) {
      setIsAuthenticated(true);
    }

    if (savedMatches) {
      const matchesMap = new Map(JSON.parse(savedMatches));
      setMatchesSeleccionados(matchesMap);
      
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

    // Los datos de archivos Excel ya NO se cargan desde localStorage
    // Se cargan desde la base de datos al cargar/crear una sesión

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

  // Guardar solo el progreso de la sesión (NO los datos de los archivos Excel)
  // Los datos de los archivos ya están en la base de datos
  useEffect(() => {
    if (isAuthenticated) {
      try {
        // Solo guardar datos pequeños: matches, índices y contadores
        localStorage.setItem('matchesSeleccionados', JSON.stringify(Array.from(matchesSeleccionados.entries())));
        localStorage.setItem('indiceActual', indiceActual);
        localStorage.setItem('contadorMatches', contadorMatches);
        localStorage.setItem('contadorNoMatches', contadorNoMatches);
        
        // NO guardar filasReferencia, filasMatching, ni columnas (están en DB)
        // Esto previene el error QuotaExceededError
      } catch (error) {
        if (error.name === 'QuotaExceededError') {
          console.warn('⚠️ LocalStorage lleno. Solo se guardarán datos esenciales.');
          // Intentar limpiar datos antiguos innecesarios
          localStorage.removeItem('filasReferencia');
          localStorage.removeItem('filasMatching');
          localStorage.removeItem('columnasReferencia');
          localStorage.removeItem('columnasMatching');
        }
      }
    }
  }, [isAuthenticated, matchesSeleccionados, indiceActual, contadorMatches, contadorNoMatches]);

  // Scroll automático para posicionar el producto actual en la tabla de la izquierda
  useEffect(() => {
    if (debeHacerScroll && listaMatchesRef.current && filasReferencia.length > 0 && indiceActual !== null) {
      // Usar un timeout breve para asegurar que el DOM se ha actualizado
      setTimeout(() => {
        if (!listaMatchesRef.current) return;
        
        // Buscar el elemento actual en la lista
        const elementos = listaMatchesRef.current.children;
        if (elementos && elementos[indiceActual]) {
          // Usar scrollIntoView con opciones personalizadas
          elementos[indiceActual].scrollIntoView({
            behavior: 'smooth',
            block: 'center', // Centrar verticalmente
            inline: 'nearest'
          });
        }
        
        setDebeHacerScroll(false);
      }, 50);
    }
  }, [indiceActual, filasReferencia.length, debeHacerScroll]);

  useEffect(() => {
    setComentarioNoMatch("");
    setSeleccionMultiple(new Set());
    // Limpiar búsqueda al cambiar de producto
    limpiarBusqueda();
  }, [indiceActual]);

  // Sincronizar progreso al cerrar o cambiar navegación
  useEffect(() => {
    const handleBeforeUnload = () => {
      sincronizarProgreso();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        sincronizarProgreso();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sesionActiva, indiceActual, contadorMatches, contadorNoMatches]);

  // Cargar sesiones al autenticarse
  useEffect(() => {
    if (isAuthenticated) {
      cargarSesionesUsuario();
    }
  }, [isAuthenticated]);

  // Atajos de teclado para selección rápida
  useEffect(() => {
    if (!filasReferencia.length || !filasMatching.length) return;
    
    const handleKeyPress = (e) => {
      // Ignorar si está escribiendo en el input de comentario
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      const top5 = calcularTop5ParaActual();
      const key = e.key;
      
      // Números 1-9 para seleccionar opciones (máximo 9 con teclado)
      const maxKey = '9';
      if (key >= '1' && key <= maxKey) {
        const index = parseInt(key) - 1;
        if (top5[index]) {
          seleccionarMatch(top5[index].producto);
        }
      }
      // 0 para NO MATCH
      else if (key === '0') {
        seleccionarNoMatch();
      }
      // Flecha derecha o Enter para avanzar
      else if (key === 'ArrowRight' || key === 'Enter') {
        if (indiceActual < filasReferencia.length - 1) {
          setIndiceActual(prev => prev + 1);
        }
      }
      // Flecha izquierda para retroceder
      else if (key === 'ArrowLeft') {
        if (indiceActual > 0) {
          setIndiceActual(prev => prev - 1);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [filasReferencia, filasMatching, indiceActual, columnasReferencia, columnasMatching, cantidadProductos]);

  // Re-ejecutar búsqueda cuando cambie la cantidad de productos a mostrar
  useEffect(() => {
    if (busquedaActiva && busquedaManual.trim()) {
      ejecutarBusquedaManual();
    }
  }, [cantidadProductos]);

  const handleLogout = () => {
    localStorage.removeItem('userSession');
    // Limpiar también datos antiguos que pueden estar ocupando espacio
    localStorage.removeItem('filasReferencia');
    localStorage.removeItem('filasMatching');
    localStorage.removeItem('columnasReferencia');
    localStorage.removeItem('columnasMatching');
    setIsAuthenticated(false);
  };

  const handleClearSession = async () => {
    const confirmClear = await mostrarConfirmacion(
      "¿Seguro que quieres reiniciar el proceso? Se perderá todo el progreso actual.",
      "🔄 Reiniciar sesión"
    );
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
          <div style={{...styles.container, padding: "12px", maxHeight: "100vh", overflow: "hidden"}}>
      <div style={{
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: "12px",
        padding: "8px 12px",
        backgroundColor: "white",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        position: "sticky",
        top: 0,
        zIndex: 100
      }}>
        <h1 style={{...styles.title, margin: 0, fontSize: "18px"}}>
          🎯 Matching de Productos
        </h1>
        
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={async () => {
              if (sesionActiva && (filasReferencia.length > 0 || filasMatching.length > 0)) {
                const confirmacion = await mostrarConfirmacion(
                  '¿Crear una nueva sesión? Se limpiará el trabajo actual.',
                  '✨ Nueva sesión'
                );
                if (!confirmacion) {
                  return;
                }
              }
              // Limpiar todo
              setSesionActiva(null);
              setFilasReferencia([]);
              setFilasMatching([]);
              setColumnasReferencia([]);
              setColumnasMatching([]);
              setIndiceActual(0);
              setContadorMatches(0);
              setContadorNoMatches(0);
              setMatchesSeleccionados(new Map());
              console.log('🆕 Nueva sesión iniciada');
            }}
            style={{
              background: "#28a745",
              color: "white",
              border: "none",
              padding: "6px 12px",
              borderRadius: "5px",
              fontSize: "13px",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            title="Crear nueva sesión desde cero"
          >
            ✨ Nueva Sesión
          </button>
          <button
            onClick={() => setMostrarSelectorSesiones(!mostrarSelectorSesiones)}
            style={{
              background: "#17a2b8",
              color: "white",
              border: "none",
              padding: "6px 12px",
              borderRadius: "5px",
              fontSize: "13px",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            📂 Sesiones {sesionesDisponibles.length > 0 && `(${sesionesDisponibles.length})`}
          </button>
          <button
            onClick={sincronizarProgreso}
            disabled={!sesionActiva}
            style={{
              background: sesionActiva ? "#28a745" : "#6c757d",
              color: "white",
              border: "none",
              padding: "6px 12px",
              borderRadius: "5px",
              fontSize: "13px",
              fontWeight: "bold",
              cursor: sesionActiva ? "pointer" : "not-allowed",
              transition: "all 0.2s ease",
              opacity: sesionActiva ? 1 : 0.6
            }}
            title="Guardar progreso actual en la base de datos"
          >
            💾 Guardar
          </button>
          <button
            onClick={handleLogout}
            style={{
              background: "#dc3545",
              color: "white",
              border: "none",
              padding: "6px 12px",
              borderRadius: "5px",
              fontSize: "13px",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            🔒 Cerrar
          </button>
          <button
            onClick={handleClearSession}
            style={{
              background: "#ffc107",
              color: "#212529",
              border: "none",
              padding: "6px 12px",
              borderRadius: "5px",
              fontSize: "13px",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            🔄 Reiniciar
          </button>
        </div>
      </div>

      {/* Selector de sesiones */}
      {mostrarSelectorSesiones && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "white",
            borderRadius: "12px",
            padding: "30px",
            maxWidth: "600px",
            width: "90%",
            maxHeight: "80vh",
            overflow: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ margin: 0 }}>📂 Mis Sesiones</h2>
              <button
                onClick={() => setMostrarSelectorSesiones(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer"
                }}
              >
                ✕
              </button>
            </div>

            {sesionesDisponibles.length === 0 ? (
              <p style={{ textAlign: "center", color: "#666" }}>
                No tienes sesiones guardadas. Carga un archivo para crear una nueva.
              </p>
            ) : (
              <div>
                {sesionesDisponibles.map(sesion => (
                  <div
                    key={sesion.id}
                    style={{
                      border: sesion.id === sesionActiva ? "2px solid #28a745" : "1px solid #ddd",
                      borderRadius: "8px",
                      padding: "15px",
                      marginBottom: "10px",
                      background: sesion.id === sesionActiva ? "#f0fdf4" : "white",
                      transition: "all 0.2s",
                      position: "relative"
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                  >
                    <div 
                      onClick={() => cargarSesionExistente(sesion.id)}
                      style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center",
                        cursor: "pointer"
                      }}
                    >
                      <div>
                        <h3 style={{ margin: "0 0 8px 0", fontSize: "16px" }}>
                          {sesion.id === sesionActiva && "✓ "}
                          {sesion.nombre_sesion}
                        </h3>
                        <p style={{ margin: "4px 0", fontSize: "14px", color: "#666" }}>
                          📦 {sesion.productos_matcheados + sesion.productos_no_match} / {sesion.total_productos} productos
                          {" · "}
                          {sesion.estado === 'completada' ? '✅ Completada' : 
                           sesion.estado === 'pausada' ? '⏸️ Pausada' : 
                           '🔄 En progreso'}
                        </p>
                        <p style={{ margin: "4px 0", fontSize: "12px", color: "#999" }}>
                          📅 {new Date(sesion.fecha_creacion).toLocaleString('es-ES')}
                        </p>
                      </div>
                      <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
                        <div style={{ 
                          background: sesion.estado === 'completada' ? '#22c55e' : '#f59e0b',
                          color: "white",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "bold"
                        }}>
                          {Math.round((sesion.productos_matcheados + sesion.productos_no_match) / sesion.total_productos * 100)}%
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        eliminarSesion(sesion.id, sesion.nombre_sesion);
                      }}
                      style={{
                        position: "absolute",
                        top: "10px",
                        right: "10px",
                        background: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        padding: "6px 10px",
                        fontSize: "12px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        transition: "background 0.2s"
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "#bb2d3b"}
                      onMouseLeave={e => e.currentTarget.style.background = "#dc3545"}
                      title="Eliminar sesión"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <button
                onClick={() => setMostrarSelectorSesiones(false)}
                style={{
                  background: "#6c757d",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "5px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {(!filasReferencia.length || !filasMatching.length) && (
        <div style={{
          ...styles.card, 
          padding: "16px", 
          marginBottom: "12px"
        }}>
          <h2 style={{...styles.subtitle, fontSize: "16px", marginBottom: "12px"}}>📂 Cargar Archivos</h2>
          <div style={{...styles.flexContainer, gap: "12px"}}>
            <FileUploader
              inputRef={inputFicheroReferencia}
              fileCount={filasReferencia.length}
              onUpload={manejarFicheroReferencia}
              label="Productos a Matchear"
            />
            <FileUploader
              inputRef={inputFicheroMatching}
              fileCount={filasMatching.length}
              onUpload={manejarFicheroMatching}
              label="Catálogo/Base de Datos"
            />
          </div>
        </div>
      )}

      {filasReferencia.length > 0 && filasMatching.length > 0 && (
        <>
          <div style={{display: "grid", gridTemplateColumns: "320px 1fr", gap: "12px", height: "calc(100vh - 100px)"}}>
            
            <div style={{
              backgroundColor: "white",
              borderRadius: "8px",
              padding: "12px",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}>
              <div style={{marginBottom: "12px"}}>
                <h2 style={{margin: 0, fontSize: "15px", color: "#1e293b"}}>
                  📋 Matches
                </h2>
                <div style={{
                  display: "flex", 
                  gap: "8px", 
                  padding: "8px", 
                  backgroundColor: "#f8f9fa", 
                  borderRadius: "6px",
                  fontSize: "12px"
                }}>
                  <div>✅ <strong>{contadorMatches}</strong></div>
                  <div>❌ <strong>{contadorNoMatches}</strong></div>
                  <div>📊 <strong>{contadorMatches + contadorNoMatches}/{filasReferencia.length}</strong></div>
                </div>
              </div>

              <button
                onClick={exportarExcelMatcheado}
                disabled={contadorMatches + contadorNoMatches === 0}
                style={{
                  backgroundColor: contadorMatches + contadorNoMatches === 0 ? "#e2e8f0" : "#10b981",
                  color: "white",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  cursor: contadorMatches + contadorNoMatches === 0 ? "not-allowed" : "pointer",
                  marginBottom: "12px",
                  transition: "all 0.2s ease"
                }}
                onMouseOver={(e) => {
                  if (contadorMatches + contadorNoMatches > 0) {
                    e.target.style.backgroundColor = "#059669";
                  }
                }}
                onMouseOut={(e) => {
                  if (contadorMatches + contadorNoMatches > 0) {
                    e.target.style.backgroundColor = "#10b981";
                  }
                }}
              >
                💾 Descargar ({contadorMatches + contadorNoMatches})
              </button>

              <div 
                ref={listaMatchesRef}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "8px",
                  scrollBehavior: "smooth"
                }}>
                {filasReferencia.map((producto, idx) => {
                  const match = matchesSeleccionados.get(idx);
                  const isProcessed = match !== undefined;
                  const isCurrent = idx === indiceActual;
                  
                  return (
                    <div
                      key={idx}
                      onClick={() => setIndiceActual(idx)}
                      style={{
                        padding: "8px",
                        marginBottom: "6px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        backgroundColor: isCurrent ? "#eff6ff" : (isProcessed ? "#f0fdf4" : "white"),
                        border: isCurrent ? "2px solid #3b82f6" : (isProcessed ? "1px solid #86efac" : "1px solid #e2e8f0"),
                        transition: "all 0.2s ease"
                      }}
                      onMouseOver={(e) => {
                        if (!isCurrent) {
                          e.currentTarget.style.backgroundColor = "#f8fafc";
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isCurrent) {
                          e.currentTarget.style.backgroundColor = isProcessed ? "#f0fdf4" : "white";
                        }
                      }}
                    >
                      <div style={{fontSize: "10px", color: "#64748b", marginBottom: "2px"}}>
                        #{idx + 1} {isCurrent && "← Actual"}
                      </div>
                      <div style={{fontSize: "11px", fontWeight: "500", color: "#1e293b", marginBottom: "2px", lineHeight: "1.3"}}>
                        {producto[columnasReferencia.DESCRIPCION]?.substring(0, 35)}...
                      </div>
                      {isProcessed && (
                        <div style={{
                          fontSize: "10px",
                          color: match.esNoMatch ? (match.tieneComentario ? "#f97316" : "#dc2626") : (match.esMultiple ? "#3b82f6" : "#059669"),
                          fontWeight: "600"
                        }}>
                          {match.esNoMatch 
                            ? (match.tieneComentario ? `❌ NO MATCH: ${match.codiprodpx.substring(0, 20)}...` : "❌ NO MATCH") 
                            : (match.esMultiple ? `✅📋 ${match.codiprodpx.substring(0, 30)}...` : `✅ ${match.codiprodpx}`)
                          }
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{display: "flex", flexDirection: "column", gap: "12px", overflow: "auto"}}>
              
              <div style={{
                backgroundColor: "white",
                borderRadius: "8px",
                padding: "12px",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)"
              }}>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px"}}>
                  <h2 style={{margin: 0, fontSize: "15px", color: "#1e293b"}}>
                    🎯 Producto ({indiceActual + 1}/{filasReferencia.length})
                  </h2>
                  <div style={{display: "flex", gap: "6px"}}>
                    <button
                      onClick={() => setIndiceActual(i => Math.max(0, i - 1))}
                      disabled={indiceActual === 0}
                      style={{
                        ...styles.buttonSecondary,
                        padding: "4px 10px",
                        fontSize: "12px",
                        opacity: indiceActual === 0 ? 0.5 : 1,
                        cursor: indiceActual === 0 ? "not-allowed" : "pointer"
                      }}
                    >
                      ← 
                    </button>
                    <button
                      onClick={() => setIndiceActual(i => Math.min(filasReferencia.length - 1, i + 1))}
                      disabled={indiceActual === filasReferencia.length - 1}
                      style={{
                        ...styles.buttonSecondary,
                        padding: "4px 10px",
                        fontSize: "12px",
                        opacity: indiceActual === filasReferencia.length - 1 ? 0.5 : 1,
                        cursor: indiceActual === filasReferencia.length - 1 ? "not-allowed" : "pointer"
                      }}
                    >
                      →
                    </button>
                  </div>
                </div>
                <ProductCard
                  title=""
                  product={filasReferencia[indiceActual]}
                  columns={columnasReferencia}
                  onNoMatchMarca={noMatchPorMarca}
                  onEditarMarca={abrirEdicionMarca}
                  marcaFueEditada={marcaFueEditada}
                />
              </div>

              <div style={{
                backgroundColor: "white",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden"
              }}>
                <div style={{
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  padding: "12px",
                  gap: "10px",
                  backgroundColor: "white",
                  borderBottom: "2px solid #e2e8f0",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                }}>
                  <div style={{display: "flex", flexDirection: "column", gap: "4px", minWidth: "150px"}}>
                    <h3 style={{margin: 0, fontSize: "14px", color: busquedaActiva ? "#3b82f6" : "#1e293b"}}>
                      {busquedaActiva ? "🔍 Resultados de búsqueda" : "🔍 Coincidencias"}
                    </h3>
                    <div style={{fontSize: "9px", color: "#64748b", fontStyle: "italic"}}>
                      {busquedaActiva 
                        ? `📝 "${busquedaManual}" - Mostrando ${resultadosBusqueda.length} de ${totalResultadosBusqueda} resultado(s)`
                        : `💡 Atajos: ${cantidadProductos === 5 ? "1-5" : cantidadProductos === 10 ? "1-9" : "1-9"} = Seleccionar | 0 = No Match | ←→ = Navegar`
                      }
                    </div>
                  </div>
                  
                  {/* Buscador manual */}
                  <div style={{ display: "flex", gap: "4px", flex: 1, maxWidth: "400px" }}>
                    <input
                      type="text"
                      value={busquedaManual}
                      onChange={(e) => setBusquedaManual(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          ejecutarBusquedaManual();
                        }
                      }}
                      placeholder="🔍 Buscar productos..."
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        fontSize: "11px",
                        border: busquedaActiva ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                        borderRadius: "4px",
                        outline: "none"
                      }}
                      onFocus={(e) => {
                        if (!busquedaActiva) {
                          e.target.style.borderColor = "#3b82f6";
                          e.target.style.boxShadow = "0 0 0 2px rgba(59, 130, 246, 0.1)";
                        }
                      }}
                      onBlur={(e) => {
                        if (!busquedaActiva) {
                          setTimeout(() => {
                            e.target.style.borderColor = "#e2e8f0";
                            e.target.style.boxShadow = "none";
                          }, 200);
                        }
                      }}
                    />
                    {busquedaActiva ? (
                      <button
                        onClick={limpiarBusqueda}
                        style={{
                          backgroundColor: "#ef4444",
                          color: "white",
                          border: "none",
                          padding: "4px 10px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: "bold",
                          transition: "all 0.2s ease"
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = "#dc2626"}
                        onMouseOut={(e) => e.target.style.backgroundColor = "#ef4444"}
                        title="Limpiar búsqueda y volver a sugerencias automáticas"
                      >
                        ✕
                      </button>
                    ) : (
                      <button
                        onClick={ejecutarBusquedaManual}
                        disabled={!busquedaManual.trim()}
                        style={{
                          backgroundColor: busquedaManual.trim() ? "#3b82f6" : "#e2e8f0",
                          color: busquedaManual.trim() ? "white" : "#94a3b8",
                          border: "none",
                          padding: "4px 10px",
                          borderRadius: "4px",
                          cursor: busquedaManual.trim() ? "pointer" : "not-allowed",
                          fontSize: "11px",
                          fontWeight: "bold",
                          transition: "all 0.2s ease"
                        }}
                        onMouseOver={(e) => {
                          if (busquedaManual.trim()) {
                            e.target.style.backgroundColor = "#2563eb";
                          }
                        }}
                        onMouseOut={(e) => {
                          if (busquedaManual.trim()) {
                            e.target.style.backgroundColor = "#3b82f6";
                          }
                        }}
                        title="Buscar productos (o presiona Enter)"
                      >
                        🔍
                      </button>
                    )}
                  </div>

                  <div style={{display: "flex", gap: "6px"}}>
                    <button
                      onClick={matchearVariosProductos}
                      disabled={seleccionMultiple.size === 0}
                      style={{
                        backgroundColor: seleccionMultiple.size > 0 ? "#10b981" : "#e2e8f0",
                        color: seleccionMultiple.size > 0 ? "white" : "#94a3b8",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: seleccionMultiple.size > 0 ? "pointer" : "not-allowed",
                        fontSize: "11px",
                        fontWeight: "bold",
                        transition: "all 0.2s ease"
                      }}
                      onMouseOver={(e) => {
                        if (seleccionMultiple.size > 0) {
                          e.target.style.opacity = "0.8";
                        }
                      }}
                      onMouseOut={(e) => {
                        if (seleccionMultiple.size > 0) {
                          e.target.style.opacity = "1";
                        }
                      }}
                    >
                      ✅ Match Varios {seleccionMultiple.size > 0 && `(${seleccionMultiple.size})`}
                    </button>
                    <button
                      onClick={() => setCantidadProductos(cantidadProductos === 5 ? 10 : cantidadProductos === 10 ? 25 : cantidadProductos === 25 ? 50 : 5)}
                      style={{
                        backgroundColor: cantidadProductos === 5 ? "#64748b" : cantidadProductos === 10 ? "#3b82f6" : cantidadProductos === 25 ? "#8b5cf6" : "#ec4899",
                        color: "white",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: "bold",
                        transition: "all 0.2s ease"
                      }}
                      onMouseOver={(e) => {
                        e.target.style.opacity = "0.8";
                      }}
                      onMouseOut={(e) => {
                        e.target.style.opacity = "1";
                      }}
                    >
                      📋 Top {cantidadProductos}
                    </button>
                    <button
                      onClick={() => setPonderacionesVisible(!ponderacionesVisible)}
                      style={{
                        backgroundColor: "#94a3b8",
                        color: "white",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: "bold"
                      }}
                    >
                      ⚖️ Pesos
                    </button>
                  </div>
                </div>

                <div style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}>
                  {/* Mostrar mensaje si la búsqueda está activa pero no hay resultados */}
                  {busquedaActiva && resultadosBusqueda.length === 0 ? (
                    <div style={{
                      padding: "20px",
                      textAlign: "center",
                      backgroundColor: "#fef2f2",
                      borderRadius: "8px",
                      border: "2px dashed #dc2626"
                    }}>
                      <div style={{fontSize: "32px", marginBottom: "10px"}}>🔍</div>
                      <div style={{fontSize: "14px", fontWeight: "bold", color: "#dc2626", marginBottom: "5px"}}>
                        No se han encontrado resultados
                      </div>
                      <div style={{fontSize: "11px", color: "#6c757d"}}>
                        No hay productos que contengan "{busquedaManual}" literalmente
                      </div>
                      <button
                        onClick={limpiarBusqueda}
                        style={{
                          marginTop: "10px",
                          backgroundColor: "#dc2626",
                          color: "white",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: "bold",
                          cursor: "pointer"
                        }}
                      >
                        Limpiar búsqueda
                      </button>
                    </div>
                  ) : (
                    <>
                      {calcularTop5ParaActual().map((match, idx) => (
                        <MatchScore
                          key={idx}
                          match={match}
                          columnasMatching={columnasMatching}
                          onSelect={() => seleccionarMatch(match.producto)}
                          isSelected={matchesSeleccionados.get(indiceActual)?.codiprodpx === match.producto[columnasMatching.CODIPROD]}
                          numeroAtajo={idx + 1}
                          onCheckboxChange={() => toggleSeleccionMultiple(idx)}
                          isChecked={seleccionMultiple.has(idx)}
                          haySeleccionMultiple={seleccionMultiple.size}
                          marcaReferencia={filasReferencia[indiceActual]?.[columnasReferencia.MARCA]}
                        />
                      ))}
                    </>
                  )}
                  
                  <div style={{
                    border: "2px solid #dc3545",
                    borderRadius: "6px",
                    padding: "6px 8px",
                    backgroundColor: matchesSeleccionados.get(indiceActual)?.esNoMatch && !matchesSeleccionados.get(indiceActual)?.tieneComentario ? "#fee2e2" : "white",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    position: "relative"
                  }}
                  onClick={seleccionarNoMatch}
                  onMouseOver={(e) => {
                    if (!matchesSeleccionados.get(indiceActual)?.esNoMatch) {
                      e.currentTarget.style.backgroundColor = "#fef2f2";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!matchesSeleccionados.get(indiceActual)?.esNoMatch) {
                      e.currentTarget.style.backgroundColor = "white";
                    }
                  }}
                  >
                    <div style={{
                      position: "absolute",
                      top: "8px",
                      left: "8px",
                      backgroundColor: matchesSeleccionados.get(indiceActual)?.esNoMatch && !matchesSeleccionados.get(indiceActual)?.tieneComentario ? "#dc3545" : "#dc2626",
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
                      0
                    </div>
                    <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: "30px"}}>
                      <div style={{flex: 1}}>
                        <div style={{fontSize: "11px", fontWeight: "bold", color: "#dc3545"}}>
                          ❌ NO MATCH
                        </div>
                        <div style={{fontSize: "9px", color: "#6c757d", marginTop: "1px"}}>
                          Ninguna opción es correcta
                        </div>
                      </div>
                      {matchesSeleccionados.get(indiceActual)?.esNoMatch && !matchesSeleccionados.get(indiceActual)?.tieneComentario && (
                        <div style={{
                          backgroundColor: "#dc3545",
                          color: "white",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "10px",
                          fontWeight: "bold"
                        }}>
                          ✓
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{
                    border: "2px solid #f97316",
                    borderRadius: "6px",
                    padding: "10px",
                    backgroundColor: matchesSeleccionados.get(indiceActual)?.tieneComentario ? "#fff7ed" : "white",
                    transition: "all 0.2s ease"
                  }}>
                    <div style={{marginBottom: "8px"}}>
                      <div style={{fontSize: "13px", fontWeight: "bold", color: "#f97316", marginBottom: "4px"}}>
                        💬 NO MATCH con Comentario
                      </div>
                      <div style={{fontSize: "11px", color: "#6c757d", marginBottom: "6px"}}>
                        Añade un comentario para explicar por qué no hay match
                      </div>
                      <input
                        type="text"
                        value={comentarioNoMatch}
                        onChange={(e) => setComentarioNoMatch(e.target.value)}
                        placeholder="Escribe tu comentario aquí..."
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          fontSize: "11px",
                          border: "1px solid #e2e8f0",
                          borderRadius: "4px",
                          outline: "none",
                          transition: "all 0.2s ease"
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = "#f97316";
                          e.target.style.boxShadow = "0 0 0 2px rgba(249, 115, 22, 0.1)";
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = "#e2e8f0";
                          e.target.style.boxShadow = "none";
                        }}
                      />
                    </div>
                    <button
                      onClick={seleccionarNoMatchConComentario}
                      disabled={!comentarioNoMatch.trim()}
                      style={{
                        width: "100%",
                        backgroundColor: comentarioNoMatch.trim() ? "#f97316" : "#e2e8f0",
                        color: comentarioNoMatch.trim() ? "white" : "#94a3b8",
                        border: "none",
                        padding: "6px 12px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "bold",
                        cursor: comentarioNoMatch.trim() ? "pointer" : "not-allowed",
                        transition: "all 0.2s ease"
                      }}
                      onMouseOver={(e) => {
                        if (comentarioNoMatch.trim()) {
                          e.target.style.backgroundColor = "#ea580c";
                        }
                      }}
                      onMouseOut={(e) => {
                        if (comentarioNoMatch.trim()) {
                          e.target.style.backgroundColor = "#f97316";
                        }
                      }}
                    >
                      {matchesSeleccionados.get(indiceActual)?.tieneComentario ? "✓ Comentario Guardado" : "Guardar Comentario"}
                    </button>
                    {matchesSeleccionados.get(indiceActual)?.tieneComentario && (
                      <div style={{
                        marginTop: "6px",
                        padding: "6px 8px",
                        backgroundColor: "#f97316",
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "10px",
                        fontWeight: "600"
                      }}>
                        📝 "{matchesSeleccionados.get(indiceActual)?.codiprodpx}"
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {ponderacionesVisible && (
                <div style={{
                  backgroundColor: "white",
                  borderRadius: "8px",
                  padding: "12px",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)"
                }}>
                  <WeightAdjuster
                    weights={pesos}
                    onWeightChange={(k, v) => setPesos({ ...pesos, [k]: v })}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!filasReferencia.length || !filasMatching.length ? (
        <div style={{ marginTop: 12, color: "#555" }}>
          Sube dos archivos Excel: <strong>Productos a Matchear</strong> (los que necesitas encontrar) y <strong>Catálogo/Base de Datos</strong> (donde buscarás las coincidencias).
        </div>
      ) : null}

      {/* Notificaciones */}
      {notificacion && (
        <Notification
          message={notificacion.message}
          type={notificacion.type}
          duration={notificacion.duration}
          onClose={() => setNotificacion(null)}
        />
      )}

      {/* Diálogo de confirmación */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel}
        />
      )}

      {/* Modal de edición de marca */}
      {editandoMarca && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999
        }}>
          <div style={{
            background: "white",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "500px",
            width: "90%",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)"
          }}>
            <h3 style={{ marginTop: 0, color: "#1e293b" }}>✏️ Editar Marca de tu Producto</h3>
            <p style={{ color: "#64748b", fontSize: "14px" }}>
              Cambiará <b>todas las ocurrencias</b> de esta marca en TU archivo de entrada (referencia).
            </p>
            
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "#334155" }}>
                Marca original:
              </label>
              <input
                type="text"
                value={editandoMarca.marcaOriginal}
                disabled
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: "14px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "6px",
                  background: "#f1f5f9",
                  color: "#64748b"
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "#334155" }}>
                Nueva marca:
              </label>
              <input
                type="text"
                value={editandoMarca.marcaNueva}
                onChange={(e) => setEditandoMarca({ ...editandoMarca, marcaNueva: e.target.value })}
                autoFocus
                placeholder="Escribe la marca corregida..."
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: "14px",
                  border: "2px solid #3b82f6",
                  borderRadius: "6px",
                  outline: "none"
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    editarMarcaReferencia(editandoMarca.marcaOriginal, editandoMarca.marcaNueva);
                  } else if (e.key === 'Escape') {
                    setEditandoMarca(null);
                  }
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setEditandoMarca(null)}
                style={{
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: "600",
                  background: "#e2e8f0",
                  color: "#475569",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => editarMarcaReferencia(editandoMarca.marcaOriginal, editandoMarca.marcaNueva)}
                style={{
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: "600",
                  background: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                ✅ Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}