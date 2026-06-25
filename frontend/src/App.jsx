import React, { useState } from 'react';
import Login from './Login';
import Upload from './Upload';

function App() {
  // Estado para guardar el token. 
  // Inicialmente buscamos en localStorage si ya hay una sesión activa.
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Función para manejar el cierre de sesión
  const handleLogout = () => {
    localStorage.removeItem('token'); // Borramos el token del navegador
    setToken(null);                   // Actualizamos el estado para volver al Login
  };

  return (
    <div className="App">
      {!token ? (
        // Si no hay token, mostramos la pantalla de Login
        // Pasamos setToken como prop para que Login pueda guardar el token al entrar
        <Login setToken={setToken} />
      ) : (
        // Si hay token, mostramos el gestor de archivos (Upload)
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '10px', 
            backgroundColor: '#f8f9fa', 
            borderBottom: '1px solid #dee2e6' 
          }}>
            <span>ArchivaCloud P-12</span>
            <button 
              onClick={handleLogout} 
              style={{ 
                background: '#dc3545', 
                color: 'white', 
                border: 'none', 
                padding: '5px 10px', 
                cursor: 'pointer',
                borderRadius: '4px'
              }}
            >
              Cerrar Sesión
            </button>
          </div>
          
          {/* Pasamos el token al componente Upload para que pueda autenticar sus peticiones */}
          <Upload token={token} />
        </div>
      )}
    </div>
  );
}

export default App;