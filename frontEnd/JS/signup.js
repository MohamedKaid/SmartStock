/* ============================================================
   SmartStock — Sign Up Logic
   - Firebase Auth (email/password + Google)
   - Firestore user document on first sign-in
   ============================================================ */

// ============================
// IMPORTS (Firebase Modular)
// ============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged,
  // Optional: sendEmailVerification,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============================
// FIREBASE CONFIG & INIT
// - Replace with YOUR Firebase app config
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Persist session in this browser
setPersistence(auth, browserLocalPersistence).catch((e) => {
  console.warn("Persistence set failed:", e);
});

// ============================
// DOM REFERENCES
// ============================
const form = document.getElementById("signup-form");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const pwdInput = document.getElementById("password");
const confirmInput = document.getElementById("confirm");
const tosCheckbox = document.getElementById("tos");
const nameErr = document.getElementById("name-error");
const emailErr = document.getElementById("email-error");
const pwdErr = document.getElementById("password-error");
const confirmErr = document.getElementById("confirm-error");
const tosErr = document.getElementById("tos-error");
const submitBtn = document.getElementById("submit-btn");
const googleBtn = document.getElementById("google-btn");
const formError = document.getElementById("form-error");
const formSuccess = document.getElementById("form-success");

// ============================
// UTILITIES
// ============================
const show = (el) => el.classList.remove("hidden");
const hide = (el) => el.classList.add("hidden");
const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.innerHTML = loading
    ? `<svg class="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
         <circle cx="12" cy="12" r="9" stroke-width="2" stroke-opacity=".25"></circle>
         <path d="M21 12a9 9 0 0 1-9 9" stroke-width="2" stroke-linecap="round"></path>
       </svg>
       Creating account…`
    : `<svg class="h-5 w-5 opacity-90" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
             stroke="currentColor" stroke-width="1.8" aria-hidden="true">
         <circle cx="9" cy="7" r="4"/>
         <path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/>
         <path d="M19 8v6"/><path d="M22 11h-6"/>
       </svg>
       Create account`;
}

function mapAuthError(code) {
  const map = {
    "auth/email-already-in-use": "That email is already in use.",
    "auth/invalid-email": "Enter a valid email.",
    "auth/weak-password": "Password is too weak.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/popup-closed-by-user": "Google popup was closed.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

// ============================
// CREATE/UPSERT USER DOC
// - Ensures a profile document exists in Firestore
// ============================
async function ensureUserDoc(user, displayName) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || null,
      displayName: displayName || user.displayName || null,
      photoURL: user.photoURL || null,
      role: "user",           // default role; adjust to your app
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // companyId: null,     // if you add multi-company later
    });
  } else {
    // optional: update last-seen/updatedAt here
    // await updateDoc(ref, { updatedAt: serverTimestamp() });
  }
}

// ============================
// EMAIL/PASSWORD SIGNUP FLOW
// ============================
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  hide(formError); hide(formSuccess);
  hide(nameErr); hide(emailErr); hide(pwdErr); hide(confirmErr); hide(tosErr);

  // Basic checks
  let ok = true;
  if (!nameInput.value.trim()) { show(nameErr); ok = false; }
  if (!emailInput.value || !validateEmail(emailInput.value)) { show(emailErr); ok = false; }
  if (!pwdInput.value || pwdInput.value.length < 6) { show(pwdErr); ok = false; }
  if (confirmInput.value !== pwdInput.value) { show(confirmErr); ok = false; }
  if (!tosCheckbox.checked) { show(tosErr); ok = false; }

  if (!ok) return;

  try {
    setLoading(true);

    // Create auth user
    const cred = await createUserWithEmailAndPassword(auth, emailInput.value, pwdInput.value);

    // Set displayName for email/password users
    if (nameInput.value.trim()) {
      await updateProfile(cred.user, { displayName: nameInput.value.trim() });
    }

    // Create Firestore profile doc
    await ensureUserDoc(cred.user, nameInput.value.trim());

    // (Optional) Send email verification
    // await sendEmailVerification(cred.user);

    // Success message + redirect
    formSuccess.textContent = "Account created! Redirecting…";
    show(formSuccess);
    window.location.href = "./index.html"; // TODO: change to your route
  } catch (err) {
    formError.textContent = mapAuthError(err.code);
    show(formError);
  } finally {
    setLoading(false);
  }
});

// ============================
// GOOGLE SIGNUP/SIGNIN FLOW
// - Also ensures Firestore profile
// ============================
googleBtn?.addEventListener("click", async () => {
  hide(formError); hide(formSuccess);
  const provider = new GoogleAuthProvider();

  try {
    setLoading(true);
    const { user } = await signInWithPopup(auth, provider);
    await ensureUserDoc(user);   // create user doc if missing
    window.location.href = "./index.html"; // TODO: change to your route
  } catch (err) {
    formError.textContent = mapAuthError(err.code);
    show(formError);
  } finally {
    setLoading(false);
  }
});

// ============================
// SESSION GUARD — ALREADY LOGGED IN?
// ============================
onAuthStateChanged(auth, (user) => {
  if (user) {
    // If you want to auto-redirect logged-in users:
    // window.location.href = "/dashboard.html";
  }
});
