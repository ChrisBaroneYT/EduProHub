// Configuración de Supabase
const SUPABASE_URL = 'https://mkpgiaxzqantcmepingm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rcGdpYXh6cWFudGNtZXBpbmdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5ODI3MjYsImV4cCI6MjA2MjU1ODcyNn0.phFix12pnaPqk9Tz7vO6UZZBuj-b99qSgjbjEhyfRdc';

// Tabla para proyectos en Supabase
const PROJECTS_TABLE = 'proyectos_estudiantiles';

// Configuración de buckets de almacenamiento
const STORAGE_BUCKETS = {
  FILES: 'archivos',
  IMAGES: 'imagenes',
  VIDEOS: 'videos'
};

// Clase para errores detallados
class DetailedError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'DetailedError';
    this.details = details;
  }
}

// Función para verificar que los buckets existan
async function verifyStorageBuckets() {
  try {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY
      }
    });
    
    if (!response.ok) throw new Error('Error al verificar buckets');
    
    const buckets = await response.json();
    const requiredBuckets = Object.values(STORAGE_BUCKETS);
    
    requiredBuckets.forEach(bucket => {
      if (!buckets.find(b => b.name === bucket)) {
        console.error(`⚠️ Bucket faltante: "${bucket}". Por favor crearlo en Supabase Storage.`);
      }
    });
  } catch (error) {
    console.error('Error en verificación de buckets:', error);
  }
}

// Función para subir un solo archivo
async function uploadSingleFile(file, folder) {
  try {
    // Validar tamaño del archivo (límite de 50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      throw new DetailedError(
        `Archivo demasiado grande (${(file.size / (1024 * 1024)).toFixed(2)}MB)`,
        {
          maxAllowed: `${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          actualSize: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
          suggestion: 'Reduce el tamaño del archivo o compártelo en partes'
        }
      );
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${folder}/${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'multipart/form-data'
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      let userMessage = `Error ${response.status} al subir ${file.name}`;
      if (response.status === 404) {
        userMessage += ' (Bucket no existe)';
      } else if (response.status === 401) {
        userMessage += ' (No autorizado)';
      } else if (response.status === 413) {
        userMessage += ' (Archivo demasiado grande)';
      }
      
      throw new DetailedError(userMessage, {
        status: response.status,
        statusText: response.statusText,
        bucket: folder,
        details: errorData,
        suggestion: response.status === 404 ? 
          'Verifica que el bucket exista en Supabase Storage' :
          response.status === 401 ?
          'Revisa tus permisos de autenticación' :
          'Intenta con un archivo más pequeño o verifica los límites'
      });
    }

    const data = await response.json();
    return `${SUPABASE_URL}/storage/v1/object/public/${folder}/${encodeURIComponent(file.name)}`;

  } catch (error) {
    console.error(`Error al subir ${file.name}:`, error);
    throw error;
  }
}

// Función mejorada para subir archivos con reintentos
async function uploadFilesWithRetry(files, folder, maxRetries = 2) {
  const urls = [];
  
  for (const file of files) {
    let retryCount = 0;
    let lastError = null;
    
    while (retryCount <= maxRetries) {
      try {
        const fileUrl = await uploadSingleFile(file, folder);
        urls.push(fileUrl);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        retryCount++;
        console.warn(`Intento ${retryCount} fallido para ${file.name}. Reintentando...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    
    if (lastError) {
      throw new DetailedError(
        `Error al subir archivo ${file.name} después de ${maxRetries} intentos`,
        {
          originalError: lastError,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        }
      );
    }
  }

  return urls;
}

// Función para escapar HTML (seguridad básica)
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Función para formatear detalles del error
function formatErrorDetails(error, details) {
  return `Mensaje: ${error.message}\n\n` +
         `Tipo: ${error.name}\n\n` +
         `Detalles:\n${details}\n\n` +
         `Stack trace:\n${error.stack || 'No disponible'}`;
}

// Mostrar alerta de error en un cuadro de texto copiable
function showErrorAlert(error) {
  let errorMessage = 'Error al subir el proyecto';
  let errorDetails = '';
  let suggestions = '';

  if (error instanceof DetailedError) {
    errorDetails = JSON.stringify(error.details, null, 2);
    if (error.details?.suggestion) {
      suggestions = `<p><strong>Sugerencia:</strong> ${error.details.suggestion}</p>`;
    }
  }

  // Clasificación de errores comunes
  if (error.message.includes('Failed to fetch')) {
    errorMessage = 'Error de conexión: No se pudo contactar al servidor';
    suggestions = '<p><strong>Sugerencia:</strong> Verifica tu conexión a internet e intenta nuevamente</p>';
  } else if (error.message.includes('permission denied') || error.message.includes('401')) {
    errorMessage = 'Error de autenticación: No tienes permisos para esta acción';
    suggestions = '<p><strong>Sugerencia:</strong> Cierra sesión y vuelve a iniciar, o contacta al administrador</p>';
  } else if (error.message.includes('bucket not found')) {
    errorMessage = 'Error de configuración: El directorio de almacenamiento no existe';
    suggestions = '<p><strong>Solución:</strong> Crea el bucket en Supabase Storage > Buckets</p>';
  } else if (error.message.includes('Payload too large')) {
    errorMessage = 'Error: El archivo es demasiado grande';
    suggestions = '<p><strong>Sugerencia:</strong> Intenta con archivos más pequeños o comprime los archivos</p>';
  } else {
    errorMessage = error.message;
  }

  // Crear modal de error
  const errorModal = document.createElement('div');
  errorModal.className = 'error-modal';
  errorModal.style = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  `;

  // Contenido del modal
  errorModal.innerHTML = `
    <div class="error-content" style="
      background: white;
      padding: 20px;
      border-radius: 8px;
      max-width: 80%;
      max-height: 80vh;
      overflow: auto;
      width: 500px;
    ">
      <h3 style="color: #dc3545; margin-top: 0;">Error al subir proyecto</h3>
      <p><strong>Mensaje:</strong> ${escapeHtml(errorMessage)}</p>
      ${suggestions}
      
      <div style="margin: 15px 0;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">
          Detalles técnicos (selecciona para copiar):
        </label>
        <textarea id="errorDetailsText" style="
          width: 100%;
          height: 150px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: monospace;
          background: #f8f9fa;
          white-space: pre-wrap;
          word-wrap: break-word;
        " readonly>${escapeHtml(formatErrorDetails(error, errorDetails))}</textarea>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-top: 15px;">
        <button id="copyErrorBtn" style="
          padding: 8px 15px;
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">Copiar detalles</button>
        
        <button id="closeErrorBtn" style="
          padding: 8px 15px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">Cerrar</button>
      </div>
    </div>
  `;

  // Añadir al documento
  document.body.appendChild(errorModal);

  // Configurar botones
  document.getElementById('copyErrorBtn').addEventListener('click', async () => {
    const textarea = document.getElementById('errorDetailsText');
    try {
      await navigator.clipboard.writeText(textarea.value);
      const copyBtn = document.getElementById('copyErrorBtn');
      copyBtn.textContent = '¡Copiado!';
      setTimeout(() => copyBtn.textContent = 'Copiar detalles', 2000);
    } catch (err) {
      textarea.select();
      document.execCommand('copy');
      alert('Detalles copiados al portapapeles');
    }
  });

  document.getElementById('closeErrorBtn').addEventListener('click', () => {
    document.body.removeChild(errorModal);
  });
}

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
  // Verificar buckets al cargar
  verifyStorageBuckets();

  const projectForm = document.getElementById('projectForm');
  
  // Preview de imágenes
  document.getElementById('projectImages').addEventListener('change', function(e) {
    const previewContainer = document.getElementById('imagePreviews');
    previewContainer.innerHTML = '';
    
    Array.from(e.target.files).forEach(file => {
      if (!file.type.match('image.*')) {
        console.warn(`Archivo ${file.name} no es una imagen válida`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.createElement('img');
        img.src = event.target.result;
        img.classList.add('preview-media', 'img-thumbnail', 'me-2');
        img.style.maxHeight = '100px';
        previewContainer.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  });

  // Envío del formulario
  projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) {
      alert('Debes iniciar sesión primero');
      window.location.href = 'index.html';
      return;
    }

    // Mostrar indicador de carga
    const submitBtn = projectForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Subiendo...';

    try {
      // Preparar datos del proyecto
      const projectData = {
        titulo: document.getElementById('projectTitle').value,
        descripcion: document.getElementById('projectDescription').value,
        tipo: document.getElementById('projectType').value,
        id_estudiante: user.id_usuario,
        nombre_estudiante: user.nombre_usuario,
        video_url: document.getElementById('projectVideoUrl').value || null,
        fecha_subida: new Date().toISOString()
      };

      // Subir archivos principales (PDF, ZIP, etc.)
      const files = document.getElementById('projectFiles').files;
      if (files.length > 0) {
        projectData.archivos_url = await uploadFilesWithRetry(files, STORAGE_BUCKETS.FILES);
      }

      // Subir imágenes
      const images = document.getElementById('projectImages').files;
      if (images.length > 0) {
        projectData.imagenes_url = await uploadFilesWithRetry(images, STORAGE_BUCKETS.IMAGES);
      }

      // Subir video (archivo)
      const videoFile = document.getElementById('projectVideoFile').files[0];
      if (videoFile) {
        const videoUrls = await uploadFilesWithRetry([videoFile], STORAGE_BUCKETS.VIDEOS);
        projectData.video_url = videoUrls[0];
      }

      // Guardar metadatos en la tabla de proyectos
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${PROJECTS_TABLE}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(projectData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new DetailedError(
          'Error al guardar proyecto en la base de datos',
          {
            status: response.status,
            statusText: response.statusText,
            details: errorData,
            suggestion: 'Verifica la conexión y los datos enviados'
          }
        );
      }

      const result = await response.json();
      console.log('Proyecto guardado exitosamente:', result);
      
      alert('¡Proyecto subido exitosamente!');
      projectForm.reset();
      document.getElementById('imagePreviews').innerHTML = '';

    } catch (error) {
      console.error('Error completo:', error);
      showErrorAlert(error);
      
    } finally {
      // Restaurar el botón de submit
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-upload"></i> Subir Proyecto';
    }
  });
});