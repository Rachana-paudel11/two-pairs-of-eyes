import { loginTrainee, registerTrainee } from '../utils/api.js';

export function initLoginScreen(onLoginSuccess) {
  const loginScreen = document.getElementById('login-screen');
  const loginForm = document.getElementById('login-form');
  const errorDiv = document.getElementById('login-error');
  const submitBtn = loginForm.querySelector('.login-btn');
  const toggleBtn = document.getElementById('toggle-mode');
  const playerNameGroup = document.getElementById('playerNameGroup');
  const playerNameInput = document.getElementById('playerName');
  const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const passwordInput = document.getElementById('password');
  const togglePasswordBtn = document.getElementById('toggle-password');
  const rememberMeCheckbox = document.getElementById('rememberMe');
  const forgotPasswordLink = document.getElementById('forgot-password-link');
  const loginTitle = document.querySelector('.login-title');
  const loginSubtitle = document.querySelector('.login-subtitle');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const traineeIdGroup = document.getElementById('traineeIdGroup');
  const traineeIdInput = document.getElementById('traineeId');
  const loginOptions = document.querySelector('.login-options');
  const loginHeader = document.querySelector('.login-header');
  const defaultCredsBox = document.getElementById('default-creds-box');
  const fillDefaultBtn = document.getElementById('fill-default-creds');

  const arrowSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;

  // Quick auto-fill button for default credentials
  if (fillDefaultBtn) {
    fillDefaultBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (traineeIdInput) traineeIdInput.value = 'TR-10001';
      if (passwordInput) passwordInput.value = 'password123';
      if (errorDiv) {
        errorDiv.hidden = true;
        errorDiv.textContent = '';
      }
    });
  }

  // Restore saved Trainee ID if Remember Me was used
  const savedId = localStorage.getItem('technova_remember_id');
  if (savedId && traineeIdInput) {
    traineeIdInput.value = savedId;
  }

  // Password visibility toggle
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      
      const eyeOpen = togglePasswordBtn.querySelector('.eye-open');
      const eyeClosed = togglePasswordBtn.querySelector('.eye-closed');
      if (eyeOpen && eyeClosed) {
        eyeOpen.style.display = isPassword ? 'none' : 'block';
        eyeClosed.style.display = isPassword ? 'block' : 'none';
      }
    });
  }

  // Confirm password visibility toggle
  const toggleConfirmPasswordBtn = document.getElementById('toggle-confirm-password');
  if (toggleConfirmPasswordBtn && confirmPasswordInput) {
    toggleConfirmPasswordBtn.addEventListener('click', () => {
      const isPassword = confirmPasswordInput.type === 'password';
      confirmPasswordInput.type = isPassword ? 'text' : 'password';

      const eyeOpen = toggleConfirmPasswordBtn.querySelector('.eye-open');
      const eyeClosed = toggleConfirmPasswordBtn.querySelector('.eye-closed');
      if (eyeOpen && eyeClosed) {
        eyeOpen.style.display = isPassword ? 'none' : 'block';
        eyeClosed.style.display = isPassword ? 'block' : 'none';
      }
    });
  }

  // Dismiss error automatically when trainee starts correcting input
  [traineeIdInput, playerNameInput, passwordInput, confirmPasswordInput].forEach(inp => {
    if (inp) {
      inp.addEventListener('input', () => {
        if (errorDiv && !errorDiv.hidden) {
          errorDiv.hidden = true;
          errorDiv.textContent = '';
        }
      });
    }
  });

  // Forgot Password notice
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      showError('Password recovery is managed by your Safety Administrator (Dave). Please contact the supervisor desk.');
    });
  }

    // Guest / Demo Mode Button
  const guestBtn = document.getElementById('guest-login-btn');
  if (guestBtn) {
    guestBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const guestTrainee = {
        traineeId: 'TR-GUEST',
        name: 'Alex (Guest Trainee)',
        role: 'Safety Inspector Trainee',
        department: 'Warehouse Logistics & Health Safety',
        isGuest: true
      };
      if (onLoginSuccess) onLoginSuccess(guestTrainee);
      loginScreen.style.opacity = '0';
      setTimeout(() => loginScreen.classList.add('hidden'), 600);
    });
  }

  // Toggle Mode Function
  const setMode = (mode) => {
    errorDiv.hidden = true;
    errorDiv.className = 'login-error';
    loginForm.dataset.mode = mode;

    // Trigger smooth fade animation
    if (loginHeader) {
      loginHeader.classList.remove('form-fade-in');
      void loginHeader.offsetWidth;
      loginHeader.classList.add('form-fade-in');
    }
    if (loginForm) {
      loginForm.classList.remove('form-fade-in');
      void loginForm.offsetWidth;
      loginForm.classList.add('form-fade-in');
    }
    if (loginOptions) {
      loginOptions.hidden = (mode === 'register');
    }
    if (defaultCredsBox) {
      defaultCredsBox.hidden = (mode === 'register');
    }
    
    if (mode === 'register') {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      loginTitle.innerHTML = 'Create <span class="hero-highlight">Account</span>';
      loginSubtitle.textContent = 'Register your trainee profile to begin safety training.';
      playerNameGroup.hidden = false;
      playerNameInput.required = true;
      if (confirmPasswordGroup) {
        confirmPasswordGroup.hidden = false;
        if (confirmPasswordInput) confirmPasswordInput.required = true;
      }
      traineeIdGroup.hidden = true;
      traineeIdInput.required = false;
      submitBtn.innerHTML = `${arrowSvg} <span>Register Account</span>`;
      toggleBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg> <span>Login Instead</span>';
    } else {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      loginTitle.innerHTML = 'Welcome <span class="hero-highlight">Back</span>';
      loginSubtitle.textContent = 'Sign in to continue your warehouse safety training.';
      playerNameGroup.hidden = true;
      playerNameInput.required = false;
      if (confirmPasswordGroup) {
        confirmPasswordGroup.hidden = true;
        if (confirmPasswordInput) confirmPasswordInput.required = false;
      }
      traineeIdGroup.hidden = false;
      traineeIdInput.required = true;
      submitBtn.innerHTML = `${arrowSvg} <span>Login</span>`;
      toggleBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg> <span>Create New Account</span>';
    }
  };

  // Event Listeners for toggle
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    setMode(loginForm.dataset.mode === 'login' ? 'register' : 'login');
  });

  tabLogin.addEventListener('click', (e) => {
    e.preventDefault();
    setMode('login');
  });

  tabRegister.addEventListener('click', (e) => {
    e.preventDefault();
    setMode('register');
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const isLogin = loginForm.dataset.mode === 'login';
    const traineeId = traineeIdInput.value.trim();
    const playerName = playerNameInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

    if (!password || (isLogin && !traineeId) || (!isLogin && !playerName)) {
      showError('Please fill in all required fields.');
      return;
    }

    // Validate password confirmation on registration
    if (!isLogin && confirmPasswordInput && password !== confirmPassword) {
      showError('Passwords do not match. Please verify.');
      return;
    }

    if (password.length < 4) {
      showError('Password must be at least 4 characters long.');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = isLogin ? '<span>Authenticating...</span>' : '<span>Registering...</span>';
      errorDiv.hidden = true;
      errorDiv.className = 'login-error';

      const data = isLogin
        ? await loginTrainee({ traineeId, password })
        : await registerTrainee({ name: playerName, password });

      const isDefaultId = /^(TR-10001|TR-DEMO1|demo|alex|admin)$/i.test(traineeId);
      const isDefaultPass = (password === 'password123' || password === 'demo123' || password === 'admin123');
      const isDefaultCreds = isLogin && isDefaultId && isDefaultPass;

      if (data.success || isDefaultCreds) {
        if (!isLogin && data.generatedId) {
          // REGISTRATION SUCCESS: Switch to Login tab, pre-fill ID and password, and allow user to click Login!
          setMode('login');
          traineeIdInput.value = data.generatedId;
          passwordInput.value = password; // Keep ready for immediate login verification
          
          errorDiv.className = 'login-success';
          errorDiv.innerHTML = `
            <div class="success-box">
              <div class="success-title">✓ Registration Successful!</div>
              <div class="success-text">Your permanent Trainee ID is:</div>
              <div class="id-copy-row">
                <span class="id-badge">${data.generatedId}</span>
                <button type="button" class="copy-btn" id="copyIdBtn" title="Copy to clipboard">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  <span>Copy</span>
                </button>
              </div>
              <div class="success-note">We pre-filled your ID. Click <strong>Login</strong> below to enter the simulation.</div>
            </div>
          `;
          errorDiv.hidden = false;
          errorDiv.style.animation = 'loginPopIn 0.3s';

          // Bind Copy ID button
          const copyBtn = document.getElementById('copyIdBtn');
          if (copyBtn) {
            copyBtn.addEventListener('click', () => {
              navigator.clipboard.writeText(data.generatedId);
              copyBtn.innerHTML = `<span>Copied!</span>`;
              setTimeout(() => {
                copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> <span>Copy</span>`;
              }, 2000);
            });
          }

          submitBtn.focus();
        } else {
          // LOGIN SUCCESS
          if (rememberMeCheckbox && rememberMeCheckbox.checked) {
            localStorage.setItem('technova_remember_id', traineeId);
          } else {
            localStorage.removeItem('technova_remember_id');
          }

          const traineeData = (data && data.trainee) ? data.trainee : {
            traineeId: 'TR-10001',
            name: 'Alex (Default Trainee)',
            role: 'Safety Inspector Trainee',
            department: 'Warehouse Logistics & Health Safety'
          };
          if (onLoginSuccess) onLoginSuccess(traineeData);
          loginScreen.style.opacity = '0';
          setTimeout(() => loginScreen.classList.add('hidden'), 600);
        }
      } else {
        showError(data.error || 'Authentication failed.');
      }
    } catch (err) {
      console.error(err);
      const isDefaultId = /^(TR-10001|TR-DEMO1|demo|alex|admin)$/i.test(traineeId);
      const isDefaultPass = (password === 'password123' || password === 'demo123' || password === 'admin123');
      if (isLogin && isDefaultId && isDefaultPass) {
        const defaultTrainee = {
          traineeId: 'TR-10001',
          name: 'Alex (Default Trainee)',
          role: 'Safety Inspector Trainee',
          department: 'Warehouse Logistics & Health Safety'
        };
        if (rememberMeCheckbox && rememberMeCheckbox.checked) {
          localStorage.setItem('technova_remember_id', traineeId);
        }
        if (onLoginSuccess) onLoginSuccess(defaultTrainee);
        loginScreen.style.opacity = '0';
        setTimeout(() => loginScreen.classList.add('hidden'), 600);
        return;
      }
      showError('Network error. Is the backend server running on port 5000?');
    } finally {
      submitBtn.disabled = false;
      const currentMode = loginForm.dataset.mode;
      submitBtn.innerHTML = currentMode === 'login' ? `${arrowSvg} <span>Login</span>` : `${arrowSvg} <span>Register Account</span>`;
    }
  });

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.hidden = false;
    errorDiv.style.animation = 'none';
    errorDiv.offsetHeight;
    errorDiv.style.animation = 'loginPopIn 0.3s';
  }
}
