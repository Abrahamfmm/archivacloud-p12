import { useState, useEffect } from 'react';
import axios from 'axios';

const Upload = ({ token }) => {
  const [file, setFile] = useState(null);
  const [fileList, setFileList] = useState([]);

  // Configuración de cabeceras para autenticación
  const authHeaders = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const fetchFiles = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/files', authHeaders);
      setFileList(response.data);
    } catch (error) {
      console.error("Error cargando archivos", error);
      alert("Tu sesión ha expirado o no tienes permisos.");
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [token]);

  const handleUpload = async () => {
    if (!file) return;

    // --- NUEVO: Control SEC-04 (Límite de 14 MB para P-12) ---
    const maxSizeInBytes = 14 * 1024 * 1024; // 14 MB en bytes
    if (file.size > maxSizeInBytes) {
      alert("Error de seguridad: El archivo excede el límite permitido de 14 MB.");
      return;
    }

    try {
      // 1. Solicitar la URL prefirmada (PROTEGIDO CON TOKEN)
      const response = await axios.post('http://127.0.0.1:8000/api/upload/presigned-url', {
        fileName: file.name,
        fileType: 'application/octet-stream'
      }, authHeaders);

      const { presignedUrl } = response.data;

      // 2. Envolver el archivo en un Blob binario puro
      const fileBlob = new Blob([file], { type: 'application/octet-stream' });

      // 3. Ejecutar la subida directa a S3 (Esto NO requiere token, ya está firmado)
      const uploadResult = await fetch(presignedUrl, {
        method: 'PUT',
        body: fileBlob,
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });

      if (!uploadResult.ok) {
        throw new Error(`S3 respondió con estatus: ${uploadResult.status}`);
      }

      alert('¡Archivo subido con éxito a AWS S3!');
      setFile(null); 
      fetchFiles(); 
      
    } catch (error) {
      alert("Error al subir archivo. Revisa los detalles en la consola.");
      console.error("Detalle del fallo de subida:", error);
    }
  };

  const handleDelete = async (filename) => {
    if (window.confirm(`¿Seguro que deseas borrar ${filename}?`)) {
      try {
        // 4. Petición DELETE (PROTEGIDO CON TOKEN)
        await axios.delete(`http://127.0.0.1:8000/api/files/${filename}`, authHeaders);
        alert('Archivo eliminado');
        fetchFiles();
      } catch (error) {
        console.error("Error al eliminar", error);
        alert("No se pudo eliminar el archivo.");
      }
    }
  };

  const handleRename = async (oldFilename) => {
    // Pedimos el nuevo nombre mediante un prompt nativo del navegador
    const newFilename = window.prompt(
      `Ingresa el nuevo nombre para "${oldFilename}"\n(No olvides incluir la extensión .docx, .odt o .rtf):`, 
      oldFilename
    );

    // Si el usuario cancela o no cambia el nombre, no hacemos nada
    if (!newFilename || newFilename === oldFilename) return;

    try {
      // Enviamos el PUT con el nuevo nombre y los headers de seguridad (token)
      await axios.put(`http://127.0.0.1:8000/api/files/${oldFilename}/rename`, 
        { newFilename: newFilename }, 
        authHeaders
      );
      alert('¡Archivo renombrado con éxito!');
      fetchFiles(); // Recargamos la lista
    } catch (error) {
      console.error("Error al renombrar", error);
      // Mostramos el mensaje de error del backend (ej. si puso mal la extensión)
      alert(error.response?.data?.detail || "No se pudo renombrar el archivo.");
    }
  };
  
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h2>ArchivaCloud P-12 - Sprint 3 (Seguridad)</h2>
      
      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h3>Subir Archivo</h3>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <button onClick={handleUpload} style={{ marginLeft: '10px' }}>Subir a S3</button>
      </div>

      <h3>Archivos en el Bucket</h3>
      {fileList.length === 0 ? (
        <p>No hay archivos todavía.</p>
      ) : (
        <ul>
          {fileList.map((f, index) => (
            <li key={index} style={{ marginBottom: '10px' }}>
              <a href={f.url} target="_blank" rel="noopener noreferrer">
                {f.filename}
              </a>
              {" "} - {(f.size / 1024).toFixed(2)} KB {" "}
              
              {/* Botón Renombrar (Feature P-12) */}
              <button 
                onClick={() => handleRename(f.filename)} 
                style={{ color: 'black', backgroundColor: '#ffc107', border: 'none', marginLeft: '15px', cursor: 'pointer', padding: '2px 8px', borderRadius: '4px' }}
              >
                Renombrar
              </button>

              {/* Botón Borrar */}
              <button 
                onClick={() => handleDelete(f.filename)} 
                style={{ color: 'white', backgroundColor: '#dc3545', border: 'none', marginLeft: '5px', cursor: 'pointer', padding: '2px 8px', borderRadius: '4px' }}
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Upload;