import { useState, useEffect } from 'react';
import axios from 'axios';

const Upload = () => {
  const [file, setFile] = useState(null);
  const [fileList, setFileList] = useState([]);

  const fetchFiles = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/files');
      setFileList(response.data);
    } catch (error) {
      console.error("Error cargando archivos", error);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleUpload = async () => {
    if (!file) return;

    try {
      const response = await axios.post('http://127.0.0.1:8000/api/upload/presigned-url', {
        fileName: file.name,
        fileType: file.type
      });

      const { presignedUrl } = response.data;

      await axios.put(presignedUrl, file, {
        headers: { 'Content-Type': file.type }
      });

      alert('¡Archivo subido con éxito!');
      setFile(null); 
      fetchFiles(); 
      
    } catch (error) {
      alert("Error al subir archivo.");
      console.error(error);
    }
  };

  const handleDelete = async (filename) => {
    if (window.confirm(`¿Seguro que deseas borrar ${filename}?`)) {
      try {
        await axios.delete(`http://127.0.0.1:8000/api/files/${filename}`);
        alert('Archivo eliminado');
        fetchFiles();
      } catch (error) {
        console.error("Error al eliminar", error);
      }
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h2>ArchivaCloud P-12 - Sprint 2</h2>
      
      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
        <h3>Subir Archivo</h3>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <button onClick={handleUpload}>Subir a S3</button>
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
              <button onClick={() => handleDelete(f.filename)} style={{ color: 'red', marginLeft: '10px' }}>
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