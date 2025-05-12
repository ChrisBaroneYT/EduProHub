const SUPABASE_URL = 'https://mkpgiaxzqantcmepingm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rcGdpYXh6cWFudGNtZXBpbmdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5ODI3MjYsImV4cCI6MjA2MjU1ODcyNn0.phFix12pnaPqk9Tz7vO6UZZBuj-b99qSgjbjEhyfRdc';

// DOM Elements
const logoutBtn = document.getElementById('logoutBtn');
const loginContainer = document.getElementById('loginContainer');
const registerContainer = document.getElementById('registerContainer');
const appContainer = document.getElementById('appContainer');
const userTableBody = document.getElementById('userTableBody');
const userForm = document.getElementById('userForm');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const refreshBtn = document.getElementById('refreshBtn');
const newUserBtn = document.getElementById('newUserBtn');
const editBtn = document.getElementById('editBtn');
const deleteBtn = document.getElementById('deleteBtn');
const cancelBtn = document.getElementById('cancelBtn');
const submitBtn = document.getElementById('submitBtn');
const formTitle = document.getElementById('formTitle');
const userInfo = document.getElementById('userInfo');
const loadingSpinners = document.querySelectorAll('.loading-spinner');
const errorContainer = document.getElementById('errorContainer');
const showRegister = document.getElementById('showRegister');
const showLogin = document.getElementById('showLogin');
const projectsTab = document.querySelector('a[href="projects.html"]').parentElement;



// State variables
let currentMode = 'create';
let currentUserId = null;
let currentUserType = null;
let currentUser = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  checkLoggedInUser();
  
  // Event listeners
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  if (showRegister) showRegister.addEventListener('click', toggleRegister);
  if (showLogin) showLogin.addEventListener('click', toggleLogin);
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (registerForm) registerForm.addEventListener('submit', handleRegister);
  if (refreshBtn) refreshBtn.addEventListener('click', loadUsers);
  if (newUserBtn) newUserBtn.addEventListener('click', setCreateMode);
  if (editBtn) editBtn.addEventListener('click', setEditMode);
  if (deleteBtn) deleteBtn.addEventListener('click', showDeleteConfirmation);
  if (cancelBtn) cancelBtn.addEventListener('click', cancelAction);
  if (userForm) userForm.addEventListener('submit', handleUserSubmit);
});

function toggleRegister(e) {
  e.preventDefault();
  loginContainer.inert = true;
  loginContainer.classList.add('hidden');
  registerContainer.inert = false;
  registerContainer.classList.remove('hidden');
  // Set focus to first field in register form
  document.getElementById('regIdentification').focus();
}

function toggleLogin(e) {
  e.preventDefault();
  registerContainer.inert = true;
  registerContainer.classList.add('hidden');
  loginContainer.inert = false;
  loginContainer.classList.remove('hidden');
  // Set focus to first field in login form
  document.getElementById('loginEmail').focus();
}

function checkLoggedInUser() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (user) {
    currentUser = user;
    currentUserType = user.es_docente ? 'teacher' : 'student';
    showApplication();
  }
}

function showApplication() {
  loginContainer.inert = true;
  loginContainer.classList.add('hidden');
  registerContainer.inert = true;
  registerContainer.classList.add('hidden');
  
  // Show app container
  appContainer.inert = false;
  appContainer.classList.remove('hidden');
  
  // Always show navigation tabs for all users
  document.querySelector('.nav-tabs').classList.remove('hidden');
  
  // Get the form container element
  const formContainer = document.getElementById('userManagementFormContainer');
  
  // Set up UI based on user type
  if (currentUserType === 'teacher') {
    // Teachers see full management interface
    loadUsers();
    projectsTab.classList.remove('hidden');
    newUserBtn.classList.remove('hidden');
    if (formContainer) formContainer.classList.remove('hidden');
  } else {
    // Students only see the table and projects tab
    loadStudents();
    projectsTab.classList.remove('hidden');
    newUserBtn.classList.add('hidden');
    if (formContainer) formContainer.classList.add('hidden');
    
    // Hide edit/delete buttons in table rows
    document.querySelectorAll('.view-details').forEach(btn => {
      btn.style.display = 'none';
    });
  }
}
// Add this function with your other functions
function handleLogout() {
  // Clear user data
  localStorage.removeItem('currentUser');
  currentUser = null;
  currentUserType = null;
  currentUserId = null;
  
  // Reset all forms
  loginForm.reset();
  registerForm.reset();
  userForm.reset();
  
  // Clear user table
  userTableBody.innerHTML = '';

  // Hide app interface and show login
  appContainer.inert = true;
  appContainer.classList.add('hidden');
  
  loginContainer.inert = false;
  loginContainer.classList.remove('hidden');
  registerContainer.inert = true;
  registerContainer.classList.add('hidden');
  
  // Hide user info
  userInfo.style.display = 'none';
  
  // Show success message
  Swal.fire({
    icon: 'success',
    title: 'Logged out successfully',
    text: 'You have been securely logged out',
    timer: 2000,
    showConfirmButton: false
  }).then(() => {
    // Focus on login email field
    document.getElementById('loginEmail').focus();
  });
}

async function loadStudents() {
  try {
    showLoading(true);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?es_estudiante=eq.true&select=*`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });
   
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const users = await res.json();
    renderUserTable(users);
  } catch (err) {
    console.error('Error loading students:', err);
    displayError(`Error loading students: ${err.message}`);
  } finally {
    showLoading(false);
  }
}

async function loadUsers() {
  try {
    showLoading(true);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=*`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });
   
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const users = await res.json();
    renderUserTable(users);
  } catch (err) {
    console.error('Error loading users:', err);
    displayError(`Error loading users: ${err.message}`);
  } finally {
    showLoading(false);
  }
}

function renderUserTable(users) {
  userTableBody.innerHTML = '';
  if (!users || users.length === 0) {
    userTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No users found</td></tr>';
    return;
  }

  users.forEach(user => {
    const row = document.createElement('tr');
    let userType, badgeClass;
    if (user.es_docente) {
      userType = 'Docente';
      badgeClass = 'bg-success';
      row.classList.add('teacher-card');
    } else {
      userType = 'Estudiante';
      badgeClass = 'bg-primary';
      row.classList.add('student-card');
    }

    // Only show action buttons for teachers
    const actionButtons = currentUserType === 'teacher' ? `
      <button class="btn btn-sm btn-outline-info view-details me-1" data-id="${user.id_usuario}">
        <i class="bi bi-eye"></i>
      </button>
    ` : '';

    row.innerHTML = `
      <td>${user.id_usuario}</td>
      <td>${user.nombre_usuario}</td>
      <td>${user.email}</td>
      <td><span class="badge ${badgeClass} user-type-badge">${userType}</span></td>
      <td>${actionButtons}</td>
    `;
    userTableBody.appendChild(row);
  });

  // Add event listeners to view buttons (only for teachers)
  if (currentUserType === 'teacher') {
    document.querySelectorAll('.view-details').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = btn.getAttribute('data-id');
        loadUserDetails(userId);
      });
    });
  }
}

async function handleRegister(e) {
  e.preventDefault();
  try {
    showLoading(true, 'register');

    const identification = document.getElementById('regIdentification').value;
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    const email = document.getElementById('regEmail').value;
    const isTeacher = document.getElementById('regTeacherUser').checked;

    if (!identification || !username || !password || !email) {
      throw new Error('All fields are required');
    }

    // Hash password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const userData = {
      identificacion: parseInt(identification),
      nombre_usuario: username,
      email: email,
      clave_encriptada: passwordHash,
      es_estudiante: !isTeacher,
      es_docente: isTeacher
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify([userData])
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${res.status}`);
    }

    const result = await res.json();
    console.log('Registration successful:', result);

    Swal.fire({
      icon: 'success',
      title: 'Registration successful',
      text: `User ${username} created successfully. Please login.`,
      timer: 3000,
      showConfirmButton: false
    });

    toggleLogin(e);
    registerForm.reset();
  } catch (err) {
    console.error('Registration error:', err);
    displayError(`Registration failed: ${err.message}`);
  } finally {
    showLoading(false, 'register');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  try {
    showLoading(true, 'login');

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) throw new Error('Email and password are required');

    // Hash password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const users = await res.json();
    const user = users[0];

    if (!user) throw new Error('User not found. Please check your email address.');
    if (user.clave_encriptada !== passwordHash) throw new Error('Incorrect password. Please try again.');

    // Move focus before hiding login container
    document.body.focus();
    
    // Save user session
    localStorage.setItem('currentUser', JSON.stringify(user));
    currentUser = user;
    currentUserType = user.es_docente ? 'teacher' : 'student';
    
    // Hide login and show app
    loginContainer.inert = true;
    loginContainer.classList.add('hidden');
    showApplication();
    
    Swal.fire({
      icon: 'success',
      title: 'Login successful',
      text: `Welcome, ${user.nombre_usuario}`,
      timer: 2000,
      showConfirmButton: false
    });
  } catch (err) {
    console.error('Login error:', err);
    Swal.fire({
      icon: 'error',
      title: 'Login Failed',
      text: err.message,
      timer: 3000,
      showConfirmButton: true
    });
  } finally {
    showLoading(false, 'login');
  }
}

async function loadUserDetails(userId) {
  try {
    showLoading(true);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id_usuario=eq.${userId}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });
   
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
   
    const users = await res.json();
    if (users.length === 0) throw new Error('User not found');
   
    const user = users[0];
    populateForm(user);
    setViewMode();
    currentUserId = userId;
  } catch (err) {
    console.error('Error loading user details:', err);
    displayError(`Error loading user details: ${err.message}`);
  } finally {
    showLoading(false);
  }
}

function populateForm(user) {
  document.getElementById('userId').value = user.id_usuario;
  document.getElementById('identification').value = user.identificacion;
  document.getElementById('username').value = user.nombre_usuario;
  document.getElementById('email').value = user.email;
  document.getElementById('password').value = '';

  // Set user type
  if (user.es_docente) {
    document.getElementById('teacherUser').checked = true;
  } else {
    document.getElementById('studentUser').checked = true;
  }
}

function setCreateMode() {
  if (currentUserType !== 'teacher') return;

  currentMode = 'create';
  currentUserId = null;
  userForm.reset();
  document.getElementById('userId').value = '';
  
  formTitle.textContent = 'Register New User';
  document.getElementById('submitText').textContent = 'Register';
  submitBtn.classList.remove('btn-warning');
  submitBtn.classList.add('btn-primary');
  submitBtn.style.display = 'inline-block';
  cancelBtn.style.display = 'none';
  editBtn.disabled = true;
  deleteBtn.disabled = true;
  
  setFormEditable(true);
  document.getElementById('userForm').classList.remove('hidden');
}

function setViewMode() {
  currentMode = 'view';
  formTitle.textContent = 'User Details';
  submitBtn.style.display = 'none';
  cancelBtn.style.display = 'none';
  
  if (currentUserType === 'teacher') {
    editBtn.disabled = false;
    deleteBtn.disabled = false;
  }
  
  setFormEditable(false);
}

function setEditMode() {
  if (currentUserType !== 'teacher') return;

  currentMode = 'edit';
  formTitle.textContent = 'Edit User';
  document.getElementById('submitText').textContent = 'Update';
  submitBtn.classList.remove('btn-primary');
  submitBtn.classList.add('btn-warning');
  submitBtn.style.display = 'inline-block';
  cancelBtn.style.display = 'inline-block';
  editBtn.disabled = true;
  deleteBtn.disabled = true;
  
  setFormEditable(true);
  document.getElementById('identification').readOnly = false;
}

function cancelAction() {
  if (currentUserId) {
    loadUserDetails(currentUserId);
    setViewMode();
  } else {
    setCreateMode();
  }
}

function setFormEditable(editable) {
  const inputs = userForm.querySelectorAll('input:not([type="hidden"]), select, textarea');
  inputs.forEach(input => {
    if (input.type === 'radio' || input.type === 'checkbox') {
      input.disabled = !editable;
    } else {
      input.readOnly = !editable;
      if (editable) {
        input.classList.remove('form-mode-view');
      } else {
        input.classList.add('form-mode-view');
      }
    }
  });
 
  const passwordField = document.getElementById('password');
  if (editable) {
    passwordField.placeholder = 'Enter new password (leave blank to keep current)';
    passwordField.required = false;
  } else {
    passwordField.placeholder = 'Password (hidden)';
    passwordField.required = true;
  }
}

async function handleUserSubmit(e) {
  e.preventDefault();
  try {
    showLoading(true, 'submit');

    const identification = document.getElementById('identification').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const email = document.getElementById('email').value;
    const isTeacher = document.getElementById('teacherUser').checked;

    if (!identification || !username || !email) {
      throw new Error('Required fields are missing');
    }

    let passwordHash = null;
    if (password) {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const dataToSend = {
      identificacion: parseInt(identification),
      nombre_usuario: username,
      email: email,
      es_estudiante: !isTeacher,
      es_docente: isTeacher
    };

    if (passwordHash) {
      dataToSend.clave_encriptada = passwordHash;
    }

    let method, url;
    if (currentMode === 'create') {
      method = 'POST';
      url = `${SUPABASE_URL}/rest/v1/usuarios`;
    } else {
      method = 'PATCH';
      url = `${SUPABASE_URL}/rest/v1/usuarios?id_usuario=eq.${currentUserId}`;
    }

    const res = await fetch(url, {
      method: method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(currentMode === 'create' ? [dataToSend] : dataToSend)
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${res.status}`);
    }

    const result = await res.json();
    console.log('Operation successful:', result);

    Swal.fire({
      icon: 'success',
      title: currentMode === 'create' ? 'User registered' : 'User updated',
      text: `User ${username} ${currentMode === 'create' ? 'created' : 'updated'} successfully`,
      timer: 2000,
      showConfirmButton: false
    });
   
    if (currentMode === 'create') {
      userForm.reset();
    }
   
    loadUsers();
    setViewMode();
  } catch (err) {
    console.error('Operation error:', err);
    displayError(`Operation error: ${err.message}`);
    showError('Operation failed. Please try again.');
  } finally {
    showLoading(false, 'submit');
  }
}

function showDeleteConfirmation() {
  if (currentUserType !== 'teacher') return;

  const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
  modal.show();
 
  document.getElementById('confirmDeleteBtn').onclick = async () => {
    try {
      modal.hide();
      showLoading(true);
     
      const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id_usuario=eq.${currentUserId}`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      });
     
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
     
      Swal.fire({
        icon: 'success',
        title: 'User deleted',
        text: 'User deleted successfully',
        timer: 2000,
        showConfirmButton: false
      });
     
      setCreateMode();
      loadUsers();
    } catch (err) {
      console.error('Delete error:', err);
      displayError(`Delete error: ${err.message}`);
      showError('Failed to delete user.');
    } finally {
      showLoading(false);
    }
  };
}

function showUserInfo(message) {
  userInfo.textContent = message;
  userInfo.style.display = 'block';
}

function displayError(message) {
  const errorAlert = document.createElement('div');
  errorAlert.className = 'alert alert-danger alert-dismissible fade show';
  errorAlert.role = 'alert';
  errorAlert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  errorContainer.appendChild(errorAlert);
 
  setTimeout(() => {
    errorAlert.remove();
  }, 5000);
}

function showLoading(show, target = 'all') {
  if (target === 'all') {
    loadingSpinners.forEach(sp => sp.style.display = show ? 'inline-block' : 'none');
  } else if (target === 'submit' && userForm) {
    toggleBtnLoading('submitText', userForm, show);
  } else if (target === 'login' && loginForm) {
    toggleBtnLoading('loginText', loginForm, show);
  } else if (target === 'register' && registerForm) {
    toggleBtnLoading('registerText', registerForm, show);
  }
}

function toggleBtnLoading(textId, form, show) {
  const textElement = form.querySelector(`#${textId}`);
  const spinner = form.querySelector('.loading-spinner');
  const button = form.querySelector('button[type="submit"]');
 
  if (textElement) textElement.style.display = show ? 'none' : 'inline-block';
  if (spinner) spinner.style.display = show ? 'inline-block' : 'none';
  if (button) button.disabled = show;
}

function showError(message) {
  Swal.fire({
    icon: 'error',
    title: 'Error',
    text: message,
    timer: 3000
  });
}