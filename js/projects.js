// Supabase Configuration
const SUPABASE_URL = 'https://mkpgiaxzqantcmepingm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rcGdpYXh6cWFudGNtZXBpbmdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5ODI3MjYsImV4cCI6MjA2MjU1ODcyNn0.phFix12pnaPqk9Tz7vO6UZZBuj-b99qSgjbjEhyfRdc';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
console.log('Supabase initialized successfully');

// Storage Buckets Configuration
const STORAGE_BUCKETS = {
  FILES: 'archivos',
  IMAGES: 'imagenes',
  VIDEOS: 'videos'
};

// Error Handling Class
class UploadError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'UploadError';
    this.details = details;
  }
}

// Enhanced Storage Verification
async function verifyStorageAccess() {
  try {
    const results = await Promise.allSettled(
      Object.values(STORAGE_BUCKETS).map(async (bucket) => {
        const { error } = await supabase.storage
          .from(bucket)
          .list('', { limit: 1 });
        if (error) throw error;
        return bucket;
      })
    );

    const verifiedBuckets = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);

    const failedBuckets = Object.values(STORAGE_BUCKETS)
      .filter(bucket => !verifiedBuckets.includes(bucket));

    if (failedBuckets.length > 0) {
      throw new UploadError(
        'Problemas de acceso a almacenamiento',
        {
          accessibleBuckets: verifiedBuckets,
          failedBuckets: failedBuckets,
          solution: 'Verifique las políticas de los buckets y los permisos de autenticación'
        }
      );
    }

    console.log('Verified buckets:', verifiedBuckets);
    return true;
  } catch (error) {
    console.error('Storage verification failed:', error);
    throw error;
  }
}

// Enhanced File Upload Function
async function uploadFile(file, bucket) {
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  if (file.size > MAX_SIZE) {
    throw new UploadError(
      `Archivo demasiado grande (${(file.size/(1024*1024)).toFixed(2)}MB)`,
      { maxAllowed: '50MB' }
    );
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
  
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false
      });

    if (error) {
      // Handle specific error cases
      if (error.message.includes('The resource already exists')) {
        throw new UploadError(
          'El archivo ya existe',
          { fileName: file.name, suggestion: 'Renombre el archivo e intente nuevamente' }
        );
      }
      throw error;
    }

    // Get public URL with cache busting
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path, {
        download: false,
        transform: null
      });

    return publicUrl;
  } catch (error) {
    console.error(`Error uploading to ${bucket}:`, error);
    throw new UploadError(
      `Error al subir ${file.name}`,
      {
        bucket: bucket,
        error: error.message,
        fileType: file.type,
        fileSize: file.size
      }
    );
  }
}

// Upload Manager with Enhanced Retry Logic
async function uploadWithRetry(file, bucket, maxRetries = 2) {
  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    try {
      const result = await uploadFile(file, bucket);
      return result;
    } catch (error) {
      lastError = error;
      attempt++;
      
      if (attempt <= maxRetries) {
        const delay = 1000 * attempt;
        console.warn(`Retrying ${file.name} (attempt ${attempt}) after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new UploadError(
    `Error al subir ${file.name} después de ${maxRetries} intentos`,
    { 
      originalError: lastError.message,
      bucket: bucket,
      finalAttempt: true
    }
  );
}

// Enhanced Error Modal
function showErrorModal(title, message, details = '') {
  // Remove any existing error modal
  const existingModal = document.getElementById('errorModal');
  if (existingModal) {
    existingModal.remove();
  }

  const modalHTML = `
    <div class="modal fade" id="errorModal" tabindex="-1" aria-labelledby="errorModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header bg-danger text-white">
            <h5 class="modal-title" id="errorModalLabel">${title}</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>${message}</p>
            ${details ? `
            <div class="mt-3">
              <h6>Detalles técnicos:</h6>
              <pre class="bg-light p-2 small">${details}</pre>
            </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  const modal = new bootstrap.Modal(document.getElementById('errorModal'));
  modal.show();
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Verify storage access
    await verifyStorageAccess();
    
    // Image preview handler
    const imageInput = document.getElementById('projectImages');
    const previewContainer = document.getElementById('imagePreviews');
    
    imageInput.addEventListener('change', function(e) {
      previewContainer.innerHTML = '';
      
      Array.from(e.target.files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = document.createElement('img');
          img.src = event.target.result;
          img.className = 'preview-media img-thumbnail me-2 mb-2';
          img.style.maxHeight = '100px';
          previewContainer.appendChild(img);
        };
        reader.readAsDataURL(file);
      });
    });

    // Form submission handler
    const projectForm = document.getElementById('projectForm');
    projectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = projectForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.innerHTML;
      
      try {
        // Disable form during submission
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          Subiendo...
        `;

        // Get form data
        const projectData = {
          title: document.getElementById('projectTitle').value.trim(),
          description: document.getElementById('projectDescription').value.trim(),
          type: document.getElementById('projectType').value,
          video_url: document.getElementById('projectVideoUrl').value.trim() || null,
          files: [],
          images: []
        };

        // Validate required fields
        if (!projectData.title || !projectData.description || !projectData.type) {
          throw new UploadError('Por favor complete todos los campos requeridos');
        }

        // Upload files if any
        const fileInputs = [
          { id: 'projectFiles', bucket: STORAGE_BUCKETS.FILES, field: 'files' },
          { id: 'projectImages', bucket: STORAGE_BUCKETS.IMAGES, field: 'images' },
          { id: 'projectVideoFile', bucket: STORAGE_BUCKETS.VIDEOS, field: 'video_url' }
        ];

        // Process all file uploads
        for (const input of fileInputs) {
          const files = document.getElementById(input.id).files;
          if (files.length > 0) {
            try {
              if (input.field === 'video_url') {
                // Single file upload for video
                projectData[input.field] = await uploadWithRetry(files[0], input.bucket);
              } else {
                // Multiple file upload for other types
                projectData[input.field] = await Promise.all(
                  Array.from(files).map(file => uploadWithRetry(file, input.bucket))
                );
              }
            } catch (error) {
              console.error(`Error uploading ${input.field}:`, error);
              throw error;
            }
          }
        }

        // Here you would typically save to your database
        console.log('Project data ready for submission:', projectData);
        
        // Show success message
        showErrorModal(
          '¡Éxito!',
          'Proyecto subido correctamente',
          'Los archivos se han cargado en el almacenamiento'
        );
        
        // Reset form
        projectForm.reset();
        previewContainer.innerHTML = '';

      } catch (error) {
        console.error('Submission error:', error);
        showErrorModal(
          'Error al subir el proyecto',
          error instanceof UploadError ? error.message : 'Ocurrió un error inesperado',
          error instanceof UploadError ? JSON.stringify(error.details, null, 2) : error.message
        );
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    });

  } catch (error) {
    console.error('Initialization error:', error);
    showErrorModal(
      'Error de inicialización',
      'No se pudo verificar el acceso al almacenamiento',
      error instanceof UploadError ? JSON.stringify(error.details, null, 2) : error.message
    );
  }
});