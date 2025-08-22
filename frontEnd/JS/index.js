/* ============================================================
   SmartStock — Dashboard Logic
   - Auth guard (redirect to login if not signed in)
   - Sign out
   - Basic Firestore reads for KPIs, alerts, recent transactions
   - Search stub wiring
   ============================================================ */

// ============================
// IMPORTS (Firebase Modular)
// ============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============================
// FIREBASE CONFIG & INIT
// - Replace with YOUR Firebase config
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

// ============================
// DOM REFS
// ============================
const menuBtn = document.getElementById("menu-btn");
const sidebar = document.getElementById("sidebar");
const signoutBtn = document.getElementById("signout-btn");
const signoutBtnM = document.getElementById("signout-btn-m");
const userName = document.getElementById("user-name");
const avatar = document.getElementById("avatar");

const kpiSOH = document.getElementById("kpi-soh");
const kpiValue = document.getElementById("kpi-value");
const kpiLow = document.getElementById("kpi-low");
const kpiTxns = document.getElementById("kpi-txns");

const alertsList = document.getElementById("alerts-list");
const txnList = document.getElementById("txn-list");

const searchInput = document.getElementById("search-input");
const mSearchInput = document.getElementById("m-search-input");

// ============================
// UTILS
// ============================
const fmtInt = (n) => new Intl.NumberFormat().format(n ?? 0);
const fmtMoney = (n) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);
const setText = (el, text) => { if (el) el.textContent = text; };
const initialsOf = (displayName, email) => {
  const src = displayName || email || "";
  const parts = src.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const first = (parts[0]?.[0] || "").toUpperCase();
  const second = (parts[1]?.[0] || "").toUpperCase();
  return (first + second || "U").slice(0, 2);
};

// Simple mobile sidebar toggle (optional enhancement hook)
menuBtn?.addEventListener("click", () => {
  sidebar?.classList.toggle("hidden");
});

// Sign out handler (desktop & mobile)
function wireSignOut() {
  const go = async () => {
    await signOut(auth);
    window.location.href = "/frontEnd/login.html";
  };
  signoutBtn?.addEventListener("click", go);
  signoutBtnM?.addEventListener("click", go);
}

// ============================
// AUTH GUARD
// - If not signed in, go to login
// - If signed in, load UI data
// ============================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  // Fill user name + avatar initials
  setText(userName, user.displayName || user.email || "User");
  if (avatar) avatar.textContent = initialsOf(user.displayName, user.email);

  // Load dashboard data
  wireSignOut();
  loadKPIs().catch(console.warn);
  loadAlerts().catch(console.warn);
  loadRecentTransactions().catch(console.warn);
});

// ============================
// LOADERS — KPIs / Alerts / Transactions
// NOTE: Adjust collection paths to your schema.
// The examples assume top-level collections:
//   items, alerts, transactions
// For multi-tenant apps, prefix with /companies/{companyId}/...
// ============================
async function loadKPIs() {
  // --- Stock on Hand (sum of item.quantity) ---
  // If you store quantity per item:
  //   items: { quantity, cost }
  // Or if you store per-batch, you’ll aggregate differently.
  let totalQty = 0;
  let totalValue = 0;
  let lowCount = 0;
  let todayCount = 0;

  // Items (quantity + value)
  const itemsSnap = await getDocs(collection(db, "items"));
  itemsSnap.forEach((doc) => {
    const d = doc.data();
    const qty = Number(d.quantity || 0);
    const cost = Number(d.cost || 0);
    const reorder = Number(d.reorderPoint || 0);

    totalQty += qty;
    totalValue += qty * cost;
    if (reorder && qty <= reorder) lowCount += 1;
  });

  // Transactions today (quick example by timestamp field 'createdAt' (ms/ISO))
  // If you store Firestore Timestamps, you can filter client-side, or better, use a range query.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const txnsQ = query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(100));
  const txnsSnap = await getDocs(txnsQ);
  txnsSnap.forEach((doc) => {
    const d = doc.data();
    const t = d.createdAt instanceof Date ? d.createdAt : (d.createdAt?.toDate?.() || (d.createdAt ? new Date(d.createdAt) : null));
    if (t && t >= today) todayCount++;
  });

  // Update UI
  setText(kpiSOH, fmtInt(totalQty));
  setText(kpiValue, fmtMoney(totalValue));
  setText(kpiLow, fmtInt(lowCount));
  setText(kpiTxns, fmtInt(todayCount));
}

async function loadAlerts() {
  // Low-stock alerts list
  alertsList.innerHTML = `<div class="p-4 text-sm text-slate-500">Loading…</div>`;

  // If you store explicit alerts in "alerts" collection:
  const qAlerts = query(collection(db, "alerts"), orderBy("createdAt", "desc"), limit(8));
  const snap = await getDocs(qAlerts);

  if (snap.empty) {
    alertsList.innerHTML = `<div class="p-4 text-sm text-slate-500">No alerts right now. Nice!</div>`;
    return;
  }

  let html = "";
  snap.forEach((doc) => {
    const a = doc.data();
    const name = a.itemName || a.itemId || "Unknown item";
    const current = Number(a.currentQty ?? a.qty ?? 0);
    const rp = Number(a.reorderPoint ?? a.reorder ?? 0);
    html += `
      <div class="p-4 flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-slate-900 dark:text-white">${name}</p>
          <p class="text-xs text-slate-500">Qty: ${fmtInt(current)} · Reorder at ${fmtInt(rp)}</p>
        </div>
        <a href="./alerts.html" class="text-xs font-medium text-amber-700 hover:text-amber-800">Review</a>
      </div>`;
  });
  alertsList.innerHTML = html;
}

async function loadRecentTransactions() {
  txnList.innerHTML = `<div class="p-4 text-sm text-slate-500">Loading…</div>`;

  // Expecting: type ("IN" | "OUT" | "ADJUST" | "TRANSFER"), qty, itemName, createdAt
  const qTx = query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(8));
  const snap = await getDocs(qTx);

  if (snap.empty) {
    txnList.innerHTML = `<div class="p-4 text-sm text-slate-500">No recent transactions.</div>`;
    return;
  }

  let html = "";
  snap.forEach((doc) => {
    const t = doc.data();
    const when = t.createdAt?.toDate?.() || (t.createdAt ? new Date(t.createdAt) : null);
    const time = when ? when.toLocaleString() : "—";
    const type = t.type || "—";
    const qty = fmtInt(t.qty || 0);
    const item = t.itemName || t.itemId || "Unknown item";

    const badge = typeBadge(type);
    html += `
      <div class="p-4 flex items-center justify-between gap-4">
        <div class="min-w-0">
          <p class="text-sm font-medium text-slate-900 dark:text-white truncate">${item}</p>
          <p class="text-xs text-slate-500">${time}</p>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.class}">
            ${badge.icon} ${type}
          </span>
          <span class="text-sm font-semibold tabular-nums">${qty}</span>
        </div>
      </div>`;
  });
  txnList.innerHTML = html;
}

function typeBadge(type) {
  switch (String(type).toUpperCase()) {
    case "IN":
      return { class: "bg-emerald-100 text-emerald-700", icon: "⬇️" };
    case "OUT":
      return { class: "bg-rose-100 text-rose-700", icon: "⬆️" };
    case "ADJUST":
      return { class: "bg-indigo-100 text-indigo-700", icon: "🛠️" };
    case "TRANSFER":
      return { class: "bg-amber-100 text-amber-700", icon: "↔️" };
    default:
      return { class: "bg-slate-100 text-slate-700", icon: "•" };
  }
}

// ============================
// SEARCH WIRING (stub)
// - Hook your items store here or navigate to a search page.
// ============================
function wireSearch() {
  const go = (value) => {
    if (!value) return;
    // Example: navigate to items with a query param
    window.location.href = `/items.html?q=${encodeURIComponent(value.trim())}`;
  };
  searchInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") go(e.currentTarget.value); });
  mSearchInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") go(e.currentTarget.value); });
}
wireSearch();
