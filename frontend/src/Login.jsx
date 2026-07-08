import React, { useState } from 'react';
import axios from 'axios';

export default function Login({ setToken }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLoginView) {
        const response = await axios.post('http://127.0.0.1:8000/api/auth/login', { 
          username, 
          password 
        });
        const tokenStr = response.data.access_token;
        localStorage.setItem('token', tokenStr);
        setToken(tokenStr);
      } else {
        await axios.post('http://127.0.0.1:8000/api/auth/register', { 
          username, 
          password 
        });
        alert('¡Usuario registrado con éxito! Ahora puedes iniciar sesión.');
        setIsLoginView(true);
        setPassword('');
      }
    } catch (error) {
      console.error("Error de autenticación", error);
      alert(error.response?.data?.detail || "Ocurrió un error en el servidor.");
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      minHeight: '80vh', 
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      color: '#e2e8f0'
    }}>
      <div style={{ 
        padding: '40px', 
        backgroundColor: '#1e293b', // Fondo azul oscuro moderno
        border: '1px solid #334155', 
        borderRadius: '12px', 
        width: '100%',
        maxWidth: '360px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)'
      }}>
        <h2 style={{ 
          textAlign: 'center', 
          marginBottom: '30px', 
          color: '#f8fafc',
          fontSize: '24px',
          fontWeight: '600'
        }}>
          {isLoginView ? 'Iniciar Sesión' : 'Crear Cuenta'}
        </h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '8px', fontSize: '14px', color: '#94a3b8' }}>
            Usuario
          </label>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            style={{ 
              marginBottom: '20px', 
              padding: '12px', 
              borderRadius: '6px',
              border: '1px solid #475569',
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              outline: 'none',
              fontSize: '15px'
            }}
            required 
          />
          
          <label style={{ marginBottom: '8px', fontSize: '14px', color: '#94a3b8' }}>
            Contraseña
          </label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            style={{ 
              marginBottom: '30px', 
              padding: '12px', 
              borderRadius: '6px',
              border: '1px solid #475569',
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              outline: 'none',
              fontSize: '15px'
            }}
            required 
          />
          
          <button 
            type="submit" 
            style={{ 
              padding: '12px', 
              backgroundColor: isLoginView ? '#3b82f6' : '#10b981', // Azul para login, Verde para registro
              color: 'white', 
              border: 'none', 
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              transition: 'all 0.3s ease'
            }}
          >
            {isLoginView ? 'Ingresar' : 'Registrarse'}
          </button>
        </form>

        <div style={{ marginTop: '25px', textAlign: 'center' }}>
          <span 
            style={{ 
              color: '#38bdf8', 
              cursor: 'pointer', 
              fontSize: '14px',
              transition: 'color 0.2s'
            }}
            onClick={() => setIsLoginView(!isLoginView)}
          >
            {isLoginView 
              ? '¿No tienes cuenta? Regístrate aquí' 
              : '¿Ya tienes cuenta? Inicia sesión'}
          </span>
        </div>
      </div>
    </div>
  );
}