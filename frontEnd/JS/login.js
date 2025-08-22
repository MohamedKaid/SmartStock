/* ============================================================
   SmartStock — Login Page Logic (Firebase Auth)
   - Modular Firebase SDK (v10+ via CDN)
   - Email/Password, Google Sign-In, Forgot Password
   ============================================================ */

// ============================
// IMPORTS (Firebase Modular)
// ============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// If/when you need Firestore later:
// import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============================
// FIREBASE CONFIG & INIT
// - Replace the placeholders below with YOUR Firebase project config
//   (Firebase Console → Project Settings → General → Your apps → SDK setup)
// ============================
const firebaseConfig = {
  apiKey: "AIzaSyBflYHnfmZlgvfRMjhTNHeB-brwX2HzZN8",
  authDomain: "smartstock-3c147.firebaseapp.com",
  projectId: "smartstock-3c147",
  storageBucket: "smartstock-3c147.firebasestorage.app",
  messagingSenderId: "784549882543",
  appId: "1:784549882543:web:33e1a73cb1d8a29fef025a",
  measurementId: "G-9R83YYESEE"
};

// Initialize Firebase app & Auth
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Keep the session in this browser until user signs out
setPersistence(auth, browserLocalPersistence).catch((e) => {
  console.warn("Persistence set failed:", e);
});

// ============================
// DOM REFERENCES
// - Grabs elements from login.html by id
// ============================
const form = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const pwdInput = document.getElementById("password");
const emailErr = document.getElementById("email-error");
const pwdErr = document.getElementById("password-error");
const submitBtn = document.getElementById("submit-btn");
const googleBtn = document.getElementById("google-btn");
const forgotLink = document.getElementById("forgot-link");
const signupLink = document.getElementById("signup-link");
const formError = document.getElementById("form-error");
const formSuccess = document.getElementById("form-success");
const togglePassword = document.getElementById("togglePassword");
const eyeIcon = document.getElementById("eyeIcon");

// ============================
// SMALL UTILITIES
// ============================
const show = (el) => el.classList.remove("hidden");
const hide = (el) => el.classList.add("hidden");

// Swap the submit button contents during loading
function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.innerHTML = loading
    ? `<svg class="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
         <circle cx="12" cy="12" r="9" stroke-width="2" stroke-opacity=".25"></circle>
         <path d="M21 12a9 9 0 0 1-9 9" stroke-width="2" stroke-linecap="round"></path>
       </svg>
       Signing in…`
    : `<svg class="h-5 w-5 opacity-90" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
             stroke="currentColor" stroke-width="1.8" aria-hidden="true">
         <path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/>
         <circle cx="9" cy="7" r="4"/> <path d="M17 11l2 2 4-4"/>
       </svg>
       Sign in`;
}

// Super basic email validator
const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Human-friendly error messages from Firebase codes
function mapAuthError(code) {
  const map = {
    "auth/invalid-credential": "Invalid email or password.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/popup-closed-by-user": "Sign-in popup was closed.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

// ============================
// UI BEHAVIOR — PASSWORD TOGGLE
// ============================
togglePassword?.addEventListener("click", () => {
  const type = pwdInput.type === "password" ? "text" : "password";
  pwdInput.type = type;
  eyeIcon.innerHTML =
    type === "password"
      ? `<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>`
      : `<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a21.64 21.64 0 0 1 5.06-7.94"/>
         <path d="M1 1l22 22"/>`;
});

// ============================
// AUTH FLOW — EMAIL/PASSWORD
// ============================
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  hide(formError); hide(formSuccess);

  // Basic client-side validation
  let ok = true;
  if (!emailInput.value || !validateEmail(emailInput.value)) {
    show(emailErr); ok = false;
  } else hide(emailErr);

  if (!pwdInput.value || pwdInput.value.length < 6) {
    show(pwdErr); ok = false;
  } else hide(pwdErr);

  if (!ok) return;

  try {
    setLoading(true);
    await signInWithEmailAndPassword(auth, emailInput.value, pwdInput.value);
    formSuccess.textContent = "Signed in! Redirecting…";
    show(formSuccess);

    // TODO: Update to your dashboard route
    window.location.href = "/frontEnd/index.html";
  } catch (err) {
    formError.textContent = mapAuthError(err.code);
    show(formError);
  } finally {
    setLoading(false);
  }
});

// ============================
// AUTH FLOW — GOOGLE SIGN-IN
// ============================
googleBtn?.addEventListener("click", async () => {
  hide(formError); hide(formSuccess);
  const provider = new GoogleAuthProvider();

  try {
    setLoading(true);
    await signInWithPopup(auth, provider);
    // TODO: Update to your dashboard route
    window.location.href = "/frontEnd/index.html";
  } catch (err) {
    formError.textContent = mapAuthError(err.code);
    show(formError);
  } finally {
    setLoading(false);
  }
});

// ============================
// AUTH FLOW — FORGOT PASSWORD
// ============================
forgotLink?.addEventListener("click", async (e) => {
  e.preventDefault();
  hide(formError); hide(formSuccess);

  const email = emailInput.value;
  if (!validateEmail(email)) {
    formError.textContent = "Enter your email above first.";
    show(formError);
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    formSuccess.textContent = "Password reset email sent.";
    show(formSuccess);
  } catch (err) {
    formError.textContent = mapAuthError(err.code);
    show(formError);
  }
});

// ============================
// NAV — SIGNUP LINK
// ============================
signupLink?.addEventListener("click", (e) => {
  e.preventDefault();
  // TODO: change to your actual signup path
  window.location.href = "/frontEnd/signup.html";
});

// ============================
// SESSION GUARD — ALREADY LOGGED IN?
// (Optional redirect if user is already authenticated)
// ============================
onAuthStateChanged(auth, (user) => {
  if (user) {
    // If you want to auto-redirect logged-in users:
    // window.location.href = "/dashboard.html";
  }
});
