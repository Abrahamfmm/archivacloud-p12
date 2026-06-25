import React, { useState } from 'react';
import axios from 'axios';

export default function Login({ setToken }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginView, setIsLoginView] = useState(true); // Controla si mostramos Login o Registro

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLoginView) {
        // --- FLUJO DE LOGIN ---
        const response = await axios.post('http://127.0.0.1:8000/api/auth/login', { 
          username, 
          password 
        });
        const tokenStr = response.data.access_token;
        localStorage.setItem('token', tokenStr);
        setToken(tokenStr);
      } else {
        // --- FLUJO DE REGISTRO ---
        await axios.post('http://127.0.0.1:8000/api/auth/register', { 
          username, 
          password 
        });
        alert('¡Usuario registrado con éxito! Ahora puedes iniciar sesión.');
        setIsLoginView(true); // Devolvemos automáticamente a la vista de Login
        setPassword('');      // Limpiamos la contraseña por seguridad
      }
    } catch (error) {
      console.error("Error de autenticación", error);
      alert(error.response?.data?.detail || "Ocurrió un error en el servidor.");
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '50px', fontFamily: 'Arial' }}>
      <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', width: '300px' }}>
        <h2 style={{ textAlign: 'center' }}>
          {isLoginView ? 'Iniciar Sesión' : 'Registro de Usuario'}
        </h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '5px' }}>Usuario:</label>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            style={{ marginBottom: '15px', padding: '8px' }}
            required 
          />
          
          <label style={{ marginBottom: '5px' }}>Contraseña:</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            style={{ marginBottom: '20px', padding: '8px' }}
            required 
          />
          
          <button 
            type="submit" 
            style={{ 
              padding: '10px', 
              backgroundColor: isLoginView ? '#007bff' : '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {isLoginView ? 'Entrar' : 'Registrar'}
          </button>
        </form>

        <div style={{ marginTop: '15px', textAlign: 'center' }}>
          <span 
            style={{ color: 'blue', cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}
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