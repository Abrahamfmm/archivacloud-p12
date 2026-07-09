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

    // --- Control SEC-04 (Límite de 14 MB para P-12) ---
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

      // --- NUEVO: Guardar metadata en DynamoDB ---
      try {
        await axios.post('http://127.0.0.1:8000/api/files/metadata', null, {
          params: { file_name: file.name },
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Metadata guardada en DynamoDB exitosamente.");
      } catch (metaError) {
        console.error("El archivo subió a S3, pero hubo un error al guardar la metadata en DynamoDB:", metaError);
      }
      // -------------------------------------------

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
    <div style={{ 
      padding: '30px', 
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      color: '#e2e8f0',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#f8fafc' }}>
        ArchivaCloud P-12 - Panel de Archivos
      </h2>
      
      {/* SECCIÓN DE SUBIDA */}
      <div style={{ 
        marginBottom: '30px', 
        padding: '25px', 
        backgroundColor: '#1e293b', 
        border: '1px solid #334155', 
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ marginTop: '0', color: '#38bdf8', marginBottom: '20px' }}>Subir Nuevo Archivo</h3>
        
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
          {/* Botón de archivo personalizado */}
          <label style={{ 
            padding: '10px 20px', 
            backgroundColor: '#0f172a', 
            border: '1px dashed #475569',
            borderRadius: '6px', 
            cursor: 'pointer',
            color: file ? '#38bdf8' : '#94a3b8',
            transition: 'border-color 0.2s',
            textAlign: 'center',
            minWidth: '200px'
          }}>
            {file ? file.name : '📄 Seleccionar archivo...'}
            <input 
              type="file" 
              style={{ display: 'none' }} 
              onChange={(e) => setFile(e.target.files[0])} 
            />
          </label>

          <button 
            onClick={handleUpload} 
            disabled={!file}
            style={{ 
              padding: '10px 24px', 
              backgroundColor: file ? '#3b82f6' : '#475569', 
              color: 'white',
              border: 'none', 
              borderRadius: '6px',
              cursor: file ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              transition: 'background-color 0.2s'
            }}
          >
            Subir a S3
          </button>
        </div>
      </div>

      {/* SECCIÓN DE LISTA DE ARCHIVOS */}
      <h3 style={{ color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '10px', marginBottom: '20px' }}>
        Archivos en el Bucket
      </h3>
      
      {fileList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#1e293b', borderRadius: '12px', color: '#94a3b8' }}>
          No hay archivos subidos todavía.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {fileList.map((f, index) => (
            <div key={index} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '15px 20px', 
              backgroundColor: '#1e293b', 
              borderRadius: '8px',
              border: '1px solid #334155',
              transition: 'transform 0.1s',
            }}>
              {/* Info del archivo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <a 
                  href={f.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: '#e2e8f0', textDecoration: 'none', fontWeight: '500', fontSize: '15px' }}
                >
                  {f.filename}
                </a>
                <span style={{ color: '#64748b', fontSize: '13px', backgroundColor: '#0f172a', padding: '4px 8px', borderRadius: '4px' }}>
                  {(f.size / 1024).toFixed(2)} KB
                </span>
              </div>
              
              {/* Contenedor de Botones de Acción */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => handleRename(f.filename)} 
                  style={{ 
                    color: '#fff', 
                    backgroundColor: '#f59e0b', // Naranja/Amarillo moderno
                    border: 'none', 
                    cursor: 'pointer', 
                    padding: '8px 12px', 
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold'
                  }}
                >
                  Renombrar
                </button>

                <button 
                  onClick={() => handleDelete(f.filename)} 
                  style={{ 
                    color: 'white', 
                    backgroundColor: '#ef4444', // Rojo moderno
                    border: 'none', 
                    cursor: 'pointer', 
                    padding: '8px 12px', 
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold'
                  }}
                >
                  Borrar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Upload;