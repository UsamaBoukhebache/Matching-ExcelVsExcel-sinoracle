import React, { useState } from "react";
import authService from "../services/authService.js";

const Login = ({ onLoginSuccess }) => {
  const [credentials, setCredentials] = useState({
    username: "",
    password: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
    setError(""); // Limpiar error al escribir
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!credentials.username.trim() || !credentials.password.trim()) {
      setError("Por favor completa todos los campos");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Primero intentar autenticación como admin
      const adminResult = await authService.verifyAdminCredentials(
        credentials.username, 
        credentials.password
      );
      
      if (adminResult.success) {
        // Guardar sesión de admin con token
        localStorage.setItem('userSession', JSON.stringify({
          id: adminResult.user.id,
          username: adminResult.user.username,
          nombre: adminResult.user.nombre,
          isAdmin: true,
          token: adminResult.user.token,
          loginTime: new Date().toISOString()
        }));
        
        onLoginSuccess(adminResult.user);
        return;
      }

      // Si no es admin, continuar con autenticación normal de usuario
      const formData = new FormData();
      formData.append("username", credentials.username);
      formData.append("password", credentials.password);

      // URL base según entorno
      const BASE_URL =
        import.meta.env.MODE === "development"
          ? "https://www.mercadinamica.es/v2/matching-app/php" // entorno local (XAMPP)
          : "https://www.mercadinamica.es/v2/matching-app/php"; // producción en IONOS

      const response = await fetch(`${BASE_URL}/login.php`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        // Guardar datos del usuario en localStorage
        localStorage.setItem('userSession', JSON.stringify({
          id: data.user.id,
          username: data.user.username,
          nombre: data.user.nombre,
          loginTime: new Date().toISOString()
        }));
        
        onLoginSuccess(data.user);
      } else {
        setError(data.message || "Credenciales incorrectas");
      }
    } catch (error) {
      console.error("Error en login:", error);
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: "100vh",
      background: "linear-gradient(135deg, #28a745 0%, #fd7e14 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      <div style={{
        background: "white",
        borderRadius: "20px",
        padding: "40px",
        boxShadow: "0 15px 35px rgba(0,0,0,0.1)",
        width: "100%",
        maxWidth: "400px",
        margin: "20px"
      }}>
        {/* Logo/Título */}
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <div style={{ 
            fontSize: "3rem", 
            marginBottom: "10px" 
          }}>
            🔐
          </div>
          <h1 style={{ 
            color: "#333", 
            fontSize: "2rem", 
            margin: 0,
            fontWeight: "bold",
            textAlign: "center"
          }}>
            Matching App ExcelVSExcel
          </h1>
          <p style={{ 
            color: "#666", 
            fontSize: "1rem", 
            margin: "10px 0 0 0" 
          }}>
            Inicia sesión para continuar
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "20px" }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "1rem",
              fontWeight: "600",
              color: "#333"
            }}>
              👤 Usuario
            </label>
            <input
              type="text"
              name="username"
              value={credentials.username}
              onChange={handleInputChange}
              placeholder="Ingresa tu usuario"
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "2px solid #e1e5e9",
                borderRadius: "10px",
                fontSize: "1rem",
                outline: "none",
                transition: "border-color 0.3s ease",
                boxSizing: "border-box"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#28a745";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e1e5e9";
              }}
            />
          </div>

          <div style={{ marginBottom: "25px" }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "1rem",
              fontWeight: "600",
              color: "#333"
            }}>
              🔒 Contraseña
            </label>
            <input
              type="password"
              name="password"
              value={credentials.password}
              onChange={handleInputChange}
              placeholder="Ingresa tu contraseña"
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "2px solid #e1e5e9",
                borderRadius: "10px",
                fontSize: "1rem",
                outline: "none",
                transition: "border-color 0.3s ease",
                boxSizing: "border-box"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#fd7e14";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e1e5e9";
              }}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              background: "#f8d7da",
              border: "1px solid #f5c6cb",
              color: "#721c24",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "20px",
              fontSize: "0.9rem",
              textAlign: "center"
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Botón Submit */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%",
              background: isLoading 
                ? "#ccc" 
                : "linear-gradient(135deg, #28a745 0%, #fd7e14 100%)",
              color: "white",
              border: "none",
              padding: "14px",
              borderRadius: "10px",
              fontSize: "1.1rem",
              fontWeight: "bold",
              cursor: isLoading ? "not-allowed" : "pointer",
              transition: "all 0.3s ease",
              boxShadow: isLoading 
                ? "none" 
                : "0 4px 15px rgba(40, 167, 69, 0.4)"
            }}
            onMouseOver={(e) => {
              if (!isLoading) {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 6px 20px rgba(40, 167, 69, 0.6)";
              }
            }}
            onMouseOut={(e) => {
              if (!isLoading) {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 15px rgba(40, 167, 69, 0.4)";
              }
            }}
          >
            {isLoading ? (
              <>
                <span style={{ 
                  display: "inline-block", 
                  marginRight: "10px",
                  animation: "spin 1s linear infinite" 
                }}>
                  ⏳
                </span>
                Iniciando sesión...
              </>
            ) : (
              "🚀 Iniciar Sesión"
            )}
          </button>
        </form>

        {/* Footer */}
        <div style={{ 
          textAlign: "center", 
          marginTop: "25px",
          fontSize: "0.9rem",
          color: "#666"
        }}>
          Sistema de Matching de Productos ExcelVSExcel
        </div>
      </div>

      {/* CSS Animation */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default Login;
