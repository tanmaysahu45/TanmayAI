import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
    getFirestore, collection, addDoc, query, deleteDoc, doc, getDocs, where
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBQmzNsAaabSHw_s3gbulq45VTn4Ti0mq0",
    authDomain: "tanmay-ai-1190d.firebaseapp.com",
    projectId: "tanmay-ai-1190d",
    storageBucket: "tanmay-ai-1190d.firebasestorage.app",
    messagingSenderId: "652995283701",
    appId: "1:652995283701:web:1ef8b3b04e6806dcfc13bc"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const ADMIN_EMAILS = ["tanmaysahu652@gmail.com"];
const CHAT_SESSION_KEY = "tanmay_active_chat";
const API_BASE = "https://tanmayai-11j5.onrender.com";

const googleOAuthUrl =
    `https://tanmay-ai-1190d.firebaseapp.com/__/auth/handler?providerId=google.com&authType=signInWithRedirect&apiKey=${firebaseConfig.apiKey}`;

// PWA
let isRefreshing = false;
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js").then(reg => {
            setInterval(() => reg.update().catch(() => {}), 60000);
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "visible") reg.update().catch(() => {});
            });
            if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");
            reg.addEventListener("updatefound", () => {
                const nsw = reg.installing;
                if (!nsw) return;
                nsw.addEventListener("statechange", () => {
                    if (nsw.state === "installed" && navigator.serviceWorker.controller) {
                        nsw.postMessage("SKIP_WAITING");
                    }
                });
            });
        }).catch(e => console.log("SW fail:", e));
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (isRefreshing) return;
            isRefreshing = true;
            window.location.reload();
        });
    });
}

const $ = id => document.getElementById(id);

const loginContainer = $("login-container");
const appContainer = $("app-container");
const googleLoginBtn = $("google-login-btn");
const usernameDisplay = $("username-display");
const useremailDisplay = $("useremail-display");
const userAvatar = $("user-avatar");
const defaultUserIcon = $("default-user-icon");
const userInput = $("user-input");
const sendBtn = $("send-btn");
const micBtn = $("mic-btn");
const imageBtn = $("image-btn");
const imageInput = $("image-input");
const cameraBtn = $("camera-btn");
const cameraInput = $("camera-input");
const callBtn = $("call-btn");
const messagesContainer = $("messages-container");
const toggleVoiceBtn = $("toggle-voice-btn");
const historyList = $("history-list");
const sidebarToggleBtn = $("sidebar-toggle-btn");
const sidebar = $("sidebar");
const sidebarOverlay = $("sidebar-overlay");
const sidebarCloseBtn = $("sidebar-close-btn");
const newChatBtn = $("new-chat-btn");
const themeToggleBtn = $("theme-toggle-btn");
const chatSearchInput = $("chat-search-input");
const toastContainer = $("toast-container");
const headerMenuBtn = $("header-menu-btn");
const headerTitle = $("header-title");

const openSettingsBtn = $("open-settings-btn");
const closeSettingsBtn = $("close-settings-btn");
const settingsOverlay = $("settings-overlay");
const userProfileBtn = $("user-profile-btn");
const settingsAvatar = $("settings-avatar");
const settingsDefaultIcon = $("settings-default-icon");
const settingsUsername = $("settings-username");
const settingsUseremail = $("settings-useremail");
const settingTheme = $("setting-theme");
const settingLanguage = $("setting-language");
const settingVoiceToggle = $("setting-voice-toggle");
const settingAutosendVoice = $("setting-autosend-voice");
const settingsClearHistory = $("settings-clear-history");
const settingsClearMemory = $("settings-clear-memory");
const settingsLogoutBtn = $("settings-logout-btn");
const settingsInstallBtn = $("settings-install-btn");
const installSection = $("install-section");
const installHint = $("install-hint");

const navChat = $("nav-chat");
const navStudy = $("nav-study");
const studyContainer = $("study-container");
const chatFooter = $("chat-footer");
const studyTabs = document.querySelectorAll(".study-tab");
const studyPanels = {
    notes: $("study-panel-notes"),
    quiz: $("study-panel-quiz"),
    formula: $("study-panel-formula")
};
const noteTitleInput = $("note-title-input");
const noteContentInput = $("note-content-input");
const saveNoteBtn = $("save-note-btn");
const notesList = $("notes-list");
const quizTopicInput = $("quiz-topic-input");
const quizCountSelect = $("quiz-count-select");
const startQuizBtn = $("start-quiz-btn");
const quizDisplay = $("quiz-display");
const formulaTopicInput = $("formula-topic-input");
const formulaContentInput = $("formula-content-input");
const saveFormulaBtn = $("save-formula-btn");
const formulaList = $("formula-list");

const pendingImageBar = $("pending-image-bar");
const pendingThumb = $("pending-thumb");
const pendingRemove = $("pending-remove");
const pendingCaption = $("pending-caption");

const callOverlay = $("call-overlay");
const callStatus = $("call-status");
const callSub = $("call-sub");
const callMicBtn = $("call-mic-btn");
const callEndBtn = $("call-end-btn");
const callWave = $("call-wave");

console.log("Tanmay AI v4 loaded ✓");

// STATE
let isVoiceEnabled = true;
let autoSendVoice = true;
let currentLanguage = "auto";
let recognition = null;
let currentSpeakingButton = null;
let currentUser = null;
let currentChatId = null;
let chatHistoryContext = [];
let isInitialLoadRunning = true;
let globalRulesCache = [];
let userPersonalMemoryCache = [];
let openDropdown = null;
let deferredInstallPrompt = null;
let studyNotes = [];
let studyFormulas = [];
let currentView = "chat";
let pendingImage = null;
let callModeActive = false;
let callRecognition = null;
let callIsListening = false;
let callHistoryContext = [];

loginContainer.classList.add("hidden");
appContainer.classList.add("hidden");

// INSTALL
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateInstallUI();
});
window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    showToast("Tanmay AI installed! 🎉", "success");
    updateInstallUI();
});

function updateInstallUI() {
    if (isStandalone()) { installSection.style.display = "none"; return; }
    installSection.style.display = "block";

    if (deferredInstallPrompt) {
        settingsInstallBtn.style.display = "flex";
        settingsInstallBtn.innerHTML = `<i class="fa-solid fa-download"></i><div><strong>Install Tanmay AI</strong><small>App ki tarah lagao</small></div>`;
        installHint.style.display = "none";
    } else if (isIOS()) {
        settingsInstallBtn.style.display = "none";
        installHint.style.display = "block";
        installHint.innerHTML = `<strong>iPhone/iPad:</strong><br>1. Safari Share button dabao<br>2. Add to Home Screen<br>3. Add`;
    } else {
        settingsInstallBtn.style.display = "flex";
        settingsInstallBtn.innerHTML = `<i class="fa-solid fa-download"></i><div><strong>Install Tanmay AI</strong><small>Browser menu se</small></div>`;
        installHint.style.display = "block";
        installHint.innerHTML = `Browser menu (⋮) mein "Install App" dhundho.`;
    }
}

async function triggerInstall() {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const c = await deferredInstallPrompt.userChoice;
        showToast(c.outcome === "accepted" ? "Installing..." : "Cancelled", c.outcome === "accepted" ? "success" : "info");
        deferredInstallPrompt = null;
        updateInstallUI();
    } else if (isIOS()) showToast("Safari Share → Add to Home Screen", "info");
    else showToast("Browser menu (⋮) → Install App", "info");
}
settingsInstallBtn.addEventListener("click", triggerInstall);

// SETTINGS STORAGE
function loadSettings() {
    const theme = localStorage.getItem("tanmay-theme") || "dark";
    if (theme === "light") {
        document.body.classList.add("light-mode");
        themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
    settingTheme.value = theme;

    const lang = localStorage.getItem("tanmay-language") || "auto";
    currentLanguage = lang;
    settingLanguage.value = lang;

    const voice = localStorage.getItem("tanmay-voice");
    isVoiceEnabled = voice !== "off";
    settingVoiceToggle.checked = isVoiceEnabled;
    toggleVoiceBtn.innerHTML = isVoiceEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';

    const autoSend = localStorage.getItem("tanmay-autosend-voice");
    autoSendVoice = autoSend !== "off";
    settingAutosendVoice.checked = autoSendVoice;
}
loadSettings();
updateInstallUI();

function applyTheme(theme) {
    if (theme === "light") {
        document.body.classList.add("light-mode");
        themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    } else {
        document.body.classList.remove("light-mode");
        themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
    localStorage.setItem("tanmay-theme", theme);
    settingTheme.value = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f5f5f7" : "#0f0f10");
}
themeToggleBtn.addEventListener("click", () => applyTheme(document.body.classList.contains("light-mode") ? "dark" : "light"));
settingTheme.addEventListener("change", e => applyTheme(e.target.value));
settingLanguage.addEventListener("change", e => {
    currentLanguage = e.target.value;
    localStorage.setItem("tanmay-language", currentLanguage);
    showToast("Language updated", "success");
});
settingVoiceToggle.addEventListener("change", e => {
    isVoiceEnabled = e.target.checked;
    localStorage.setItem("tanmay-voice", isVoiceEnabled ? "on" : "off");
    toggleVoiceBtn.innerHTML = isVoiceEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
    if (!isVoiceEnabled) { window.speechSynthesis.cancel(); resetSpeakingButtons(); }
});
settingAutosendVoice.addEventListener("change", e => {
    autoSendVoice = e.target.checked;
    localStorage.setItem("tanmay-autosend-voice", autoSendVoice ? "on" : "off");
});

// TOAST
function showToast(message, type = "success") {
    const t = document.createElement("div");
    t.className = "toast toast-" + type;
    t.innerText = message;
    toastContainer.appendChild(t);
    setTimeout(() => t.classList.add("show"), 20);
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2600);
}

function formatTime(ts) {
    const d = new Date(ts);
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + m + " " + ampm;
}

function scrollToBottom() {
    requestAnimationFrame(() => messagesContainer.scrollTop = messagesContainer.scrollHeight);
    setTimeout(() => messagesContainer.scrollTop = messagesContainer.scrollHeight, 80);
}

// LOADER
const globalLoader = document.createElement("div");
globalLoader.classList.add("custom-loader-wrapper");
globalLoader.innerHTML = `<div class="chakri"></div><div class="loader-text">Tanmay AI is loading...</div>`;
document.body.appendChild(globalLoader);

function removeLoader() {
    if (globalLoader && document.body.contains(globalLoader)) {
        globalLoader.style.opacity = "0";
        setTimeout(() => globalLoader.parentNode && globalLoader.parentNode.removeChild(globalLoader), 300);
    }
}

function isCurrentUserAdmin() {
    return !!(currentUser && currentUser.email && ADMIN_EMAILS.includes(currentUser.email.toLowerCase()));
}

// COPY/SHARE
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
        else {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        }
        showToast("Copied!", "success");
    } catch { showToast("Copy failed", "error"); }
}

async function shareMessage(text) {
    if (navigator.share) {
        try { await navigator.share({ title: "Tanmay AI", text }); }
        catch (e) { if (e.name !== "AbortError") copyToClipboard(text); }
    } else copyToClipboard(text);
}

async function shareApp() {
    const url = window.location.origin + window.location.pathname;
    if (navigator.share) {
        try { await navigator.share({ title: "Tanmay AI", text: "Dekh, ye Tanmay AI hai!", url }); }
        catch (e) { if (e.name !== "AbortError") await copyToClipboard(url); }
    } else await copyToClipboard(url);
}

// DROPDOWNS
function closeDropdown() {
    if (openDropdown) { openDropdown.remove(); openDropdown = null; }
}

document.addEventListener("click", e => {
    if (!openDropdown) return;
    if (openDropdown.contains(e.target)) return;
    if (e.target.closest(".msg-menu-btn") || e.target.closest("#header-menu-btn")) return;
    closeDropdown();
});

function openMenu(anchorBtn, menuItems, isUserMsg) {
    closeDropdown();
    const dd = document.createElement("div");
    dd.className = "msg-dropdown";
    menuItems.forEach(item => {
        const b = document.createElement("button");
        b.className = "msg-dropdown-item" + (item.danger ? " danger" : "");
        b.innerHTML = `<i class="fa-solid ${item.icon}"></i> ${item.label}`;
        b.onclick = ev => { ev.stopPropagation(); closeDropdown(); item.action(); };
        dd.appendChild(b);
    });
    document.body.appendChild(dd);
    const r = anchorBtn.getBoundingClientRect();
    const mw = 180;
    let l = isUserMsg ? r.right - mw : r.left;
    let t = r.bottom + 6;
    if (l + mw > window.innerWidth - 10) l = window.innerWidth - mw - 10;
    if (l < 10) l = 10;
    const mh = menuItems.length * 42 + 12;
    if (t + mh > window.innerHeight - 10) { t = r.top - mh - 6; dd.classList.add("drop-up"); }
    dd.style.left = l + "px";
    dd.style.top = t + "px";
    openDropdown = dd;
}

headerMenuBtn.addEventListener("click", e => {
    e.stopPropagation();
    closeDropdown();
    const dd = document.createElement("div");
    dd.className = "header-dropdown";
    const items = [];
    if (!isStandalone()) items.push({ label: "Install App", icon: "fa-download", action: triggerInstall });
    items.push(
        { label: "Voice Call", icon: "fa-phone", action: startCallMode },
        { label: "Share App", icon: "fa-share-nodes", action: shareApp },
        { label: "Settings", icon: "fa-gear", action: () => { closeSidebar(); openSettings(); } },
        { label: "New Chat", icon: "fa-plus", action: () => { switchView("chat"); startNewChatSession(); } }
    );
    items.forEach(item => {
        const b = document.createElement("button");
        b.className = "header-dropdown-item";
        b.innerHTML = `<i class="fa-solid ${item.icon}"></i> ${item.label}`;
        b.onclick = ev => { ev.stopPropagation(); closeDropdown(); item.action(); };
        dd.appendChild(b);
    });
    document.body.appendChild(dd);
    const r = headerMenuBtn.getBoundingClientRect();
    const mw = 210;
    let l = r.right - mw;
    if (l < 10) l = 10;
    if (l + mw > window.innerWidth - 10) l = window.innerWidth - mw - 10;
    dd.style.left = l + "px";
    dd.style.top = (r.bottom + 6) + "px";
    openDropdown = dd;
});

// MEMORY
async function loadAllMemories() {
    if (!currentUser) return;
    try {
        const gSnap = await getDocs(collection(db, "global_rules"));
        globalRulesCache = [];
        gSnap.forEach(d => { const x = d.data(); if (x && x.rule) globalRulesCache.push(x.rule); });
        const uSnap = await getDocs(collection(db, `users_memory/${currentUser.uid}/memories`));
        userPersonalMemoryCache = [];
        uSnap.forEach(d => { if (d.data() && d.data().memory) userPersonalMemoryCache.push(d.data().memory); });
    } catch (e) { console.error(e); }
}

// AUTH
onAuthStateChanged(auth, async user => {
    if (user) {
        currentUser = user;
        const displayName = user.displayName || (user.email && user.email.split("@")[0]) || "User";
        const email = user.email || "";
        usernameDisplay.innerText = displayName;
        useremailDisplay.innerText = email;
        settingsUsername.innerText = displayName;
        settingsUseremail.innerText = email;
        if (user.photoURL) {
            userAvatar.src = user.photoURL; userAvatar.style.display = "block"; defaultUserIcon.style.display = "none";
            settingsAvatar.src = user.photoURL; settingsAvatar.style.display = "block"; settingsDefaultIcon.style.display = "none";
        } else {
            userAvatar.style.display = "none"; defaultUserIcon.style.display = "inline-block";
            settingsAvatar.style.display = "none"; settingsDefaultIcon.style.display = "block";
        }
        await loadAllMemories();
        loadStudyFromLocal();
        renderNotes();
        renderFormulas();
        await loadAllSidebarTopics(true);
        loginContainer.classList.add("hidden");
        appContainer.classList.remove("hidden");
        removeLoader();
    } else {
        currentUser = null;
        loginContainer.classList.remove("hidden");
        appContainer.classList.add("hidden");
        removeLoader();
    }
});

googleLoginBtn.addEventListener("click", () => {
    const isWebView = /wv|WebView/i.test(window.navigator.userAgent) || (!window.chrome && /Android|iPhone|iPad/i.test(window.navigator.userAgent));
    if (isWebView) window.location.href = googleOAuthUrl;
    else signInWithPopup(auth, provider).catch(e => showToast("Login Error: " + e.message, "error"));
});

function doLogout() {
    signOut(auth).then(() => {
        window.speechSynthesis.cancel();
        sessionStorage.removeItem(CHAT_SESSION_KEY);
        closeSettings();
        showToast("Logged out", "info");
    });
}
settingsLogoutBtn.addEventListener("click", () => {
    if (confirm("Sign out from Tanmay AI?")) doLogout();
});

// SETTINGS
function openSettings() { settingsOverlay.classList.remove("hidden"); document.body.style.overflow = "hidden"; updateInstallUI(); }
function closeSettings() { settingsOverlay.classList.add("hidden"); document.body.style.overflow = ""; }

openSettingsBtn.addEventListener("click", () => { closeSidebar(); openSettings(); });
userProfileBtn.addEventListener("click", () => { closeSidebar(); openSettings(); });
closeSettingsBtn.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", e => { if (e.target === settingsOverlay) closeSettings(); });

settingsClearHistory.addEventListener("click", async () => {
    if (!currentUser) return;
    if (!confirm("Clear ALL chat history?")) return;
    try {
        const q = query(collection(db, "chat_messages"));
        const snap = await getDocs(q);
        for (const d of snap.docs) if (d.data().uid === currentUser.uid) await deleteDoc(doc(db, "chat_messages", d.id));
        sessionStorage.removeItem(CHAT_SESSION_KEY);
        startNewChatSession();
        historyList.innerHTML = "";
        closeSettings();
        showToast("History cleared", "success");
    } catch { showToast("Clear failed", "error"); }
});

settingsClearMemory.addEventListener("click", async () => {
    if (!currentUser) return;
    if (!confirm("Clear your personal memory?")) return;
    try {
        const q = query(collection(db, `users_memory/${currentUser.uid}/memories`));
        const snap = await getDocs(q);
        for (const d of snap.docs) await deleteDoc(doc(db, `users_memory/${currentUser.uid}/memories`, d.id));
        userPersonalMemoryCache = [];
        showToast("Personal memory cleared", "success");
    } catch { showToast("Clear failed", "error"); }
});

// SIDEBAR
function openSidebar() { sidebar.classList.remove("collapsed"); if (window.innerWidth <= 768) sidebarOverlay.classList.add("active"); }
function closeSidebar() { sidebar.classList.add("collapsed"); sidebarOverlay.classList.remove("active"); }

sidebarToggleBtn.addEventListener("click", e => {
    e.stopPropagation();
    if (sidebar.classList.contains("collapsed")) openSidebar(); else closeSidebar();
});
sidebarOverlay.addEventListener("click", closeSidebar);
sidebarCloseBtn.addEventListener("click", closeSidebar);

chatSearchInput.addEventListener("input", e => {
    const term = e.target.value.toLowerCase().trim();
    document.querySelectorAll(".history-item-wrapper").forEach(el => {
        const text = (el.dataset.text || "").toLowerCase();
        el.style.display = !term || text.includes(term) ? "flex" : "none";
    });
});

// VIEW SWITCH
function switchView(view) {
    currentView = view;
    document.querySelectorAll(".sidebar-nav-btn").forEach(b => b.classList.remove("active"));
    if (view === "chat") navChat.classList.add("active"); else navStudy.classList.add("active");
    if (view === "chat") {
        messagesContainer.classList.remove("hidden");
        chatFooter.classList.remove("hidden");
        studyContainer.classList.add("hidden");
        headerTitle.innerText = "Tanmay AI";
    } else {
        messagesContainer.classList.add("hidden");
        chatFooter.classList.add("hidden");
        studyContainer.classList.remove("hidden");
        headerTitle.innerText = "Study Mode";
        renderNotes();
        renderFormulas();
    }
    if (window.innerWidth <= 768) closeSidebar();
}

navChat.addEventListener("click", () => switchView("chat"));
navStudy.addEventListener("click", () => switchView("study"));

studyTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        const t = tab.dataset.tab;
        studyTabs.forEach(x => x.classList.remove("active"));
        tab.classList.add("active");
        Object.keys(studyPanels).forEach(k => studyPanels[k].classList.toggle("active", k === t));
    });
});

// STUDY
function studyKey() { return currentUser ? `study_${currentUser.uid}` : "study_guest"; }

function loadStudyFromLocal() {
    try {
        const raw = localStorage.getItem(studyKey());
        if (raw) {
            const data = JSON.parse(raw);
            studyNotes = Array.isArray(data.notes) ? data.notes : [];
            studyFormulas = Array.isArray(data.formulas) ? data.formulas : [];
        } else { studyNotes = []; studyFormulas = []; }
    } catch { studyNotes = []; studyFormulas = []; }
}

function saveStudyToLocal() {
    try { localStorage.setItem(studyKey(), JSON.stringify({ notes: studyNotes, formulas: studyFormulas })); } catch {}
}

function renderNotes() {
    if (!notesList) return;
    notesList.innerHTML = "";
    if (!studyNotes.length) {
        notesList.innerHTML = `<div class="study-empty">Abhi koi note nahi. Upar se add karo.</div>`;
        return;
    }
    studyNotes.forEach((n, i) => {
        const card = document.createElement("div");
        card.className = "study-card";
        card.innerHTML = `
            <div class="study-card-title">${escapeHtml(n.title)}</div>
            <div class="study-card-body">${escapeHtml(n.content)}</div>
            <button class="study-card-delete"><i class="fa-solid fa-trash"></i></button>`;
        card.querySelector(".study-card-delete").onclick = () => {
            studyNotes.splice(i, 1);
            saveStudyToLocal();
            renderNotes();
            showToast("Note deleted", "success");
        };
        notesList.appendChild(card);
    });
}

function renderFormulas() {
    if (!formulaList) return;
    formulaList.innerHTML = "";
    if (!studyFormulas.length) {
        formulaList.innerHTML = `<div class="study-empty">Abhi koi formula nahi.</div>`;
        return;
    }
    studyFormulas.forEach((f, i) => {
        const card = document.createElement("div");
        card.className = "study-card";
        card.innerHTML = `
            <div class="study-card-title">${escapeHtml(f.topic)}</div>
            <div class="study-card-body">${escapeHtml(f.content)}</div>
            <button class="study-card-delete"><i class="fa-solid fa-trash"></i></button>`;
        card.querySelector(".study-card-delete").onclick = () => {
            studyFormulas.splice(i, 1);
            saveStudyToLocal();
            renderFormulas();
            showToast("Formula deleted", "success");
        };
        formulaList.appendChild(card);
    });
}

function escapeHtml(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

saveNoteBtn.addEventListener("click", () => {
    const title = noteTitleInput.value.trim();
    const content = noteContentInput.value.trim();
    if (!title || !content) return showToast("Title aur content dono likho", "error");
    studyNotes.unshift({ title, content, ts: Date.now() });
    saveStudyToLocal();
    noteTitleInput.value = "";
    noteContentInput.value = "";
    renderNotes();
    showToast("Note added", "success");
});

saveFormulaBtn.addEventListener("click", () => {
    const topic = formulaTopicInput.value.trim();
    const content = formulaContentInput.value.trim();
    if (!topic || !content) return showToast("Dono likho", "error");
    studyFormulas.unshift({ topic, content, ts: Date.now() });
    saveStudyToLocal();
    formulaTopicInput.value = "";
    formulaContentInput.value = "";
    renderFormulas();
    showToast("Formula added", "success");
});

// QUIZ
startQuizBtn.addEventListener("click", async () => {
    const topic = quizTopicInput.value.trim();
    if (!topic) return showToast("Topic likho pehle", "error");
    const count = quizCountSelect.value;
    quizDisplay.classList.remove("hidden");
    quizDisplay.innerHTML = `<div class="typing-dots" style="justify-content:center;"><span></span><span></span><span></span></div><div style="text-align:center;color:var(--text-muted);font-size:13px;margin-top:8px;">Quiz ban raha hai...</div>`;
    try {
        const res = await fetch(`${API_BASE}/api/quiz`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic, count, userName: currentUser.displayName || "User", userEmail: currentUser.email || "" })
        });
        const data = await res.json();
        if (res.ok && data.reply) renderQuiz(data.reply);
        else quizDisplay.innerHTML = `<div class="study-empty">Quiz nahi ban paya.</div>`;
    } catch {
        quizDisplay.innerHTML = `<div class="study-empty">Network problem.</div>`;
    }
});

function renderQuiz(rawText) {
    const blocks = rawText.split(/\n(?=Q\d+[\.\)])/i);
    const quizData = [];
    blocks.forEach(block => {
        const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
        if (!lines.length) return;
        const qMatch = lines[0].match(/Q\d+[\.\)]\s*(.+)/i);
        if (!qMatch) return;
        const question = qMatch[1].trim();
        const options = [];
        let answer = null;
        lines.slice(1).forEach(l => {
            const o = l.match(/^([A-D])[\.\)]\s*(.+)/i);
            if (o) options.push({ letter: o[1].toUpperCase(), text: o[2].trim() });
            const a = l.match(/^Answer\s*[:\-]\s*([A-D])/i);
            if (a) answer = a[1].toUpperCase();
        });
        if (question && options.length >= 2 && answer) quizData.push({ question, options, answer });
    });
    if (!quizData.length) {
        quizDisplay.innerHTML = `<div class="study-empty">Quiz format galat aaya.</div>`;
        return;
    }
    quizDisplay.innerHTML = "";
    let score = 0, answered = 0;
    quizData.forEach((q, idx) => {
        const qDiv = document.createElement("div");
        qDiv.className = "quiz-question";
        const qt = document.createElement("div");
        qt.className = "quiz-q-text";
        qt.innerText = `Q${idx + 1}. ${q.question}`;
        qDiv.appendChild(qt);
        const ow = document.createElement("div");
        ow.className = "quiz-options";
        q.options.forEach(opt => {
            const b = document.createElement("div");
            b.className = "quiz-option";
            b.innerText = `${opt.letter}) ${opt.text}`;
            b.onclick = () => {
                if (b.classList.contains("disabled")) return;
                ow.querySelectorAll(".quiz-option").forEach(x => x.classList.add("disabled"));
                if (opt.letter === q.answer) { b.classList.add("correct"); score++; }
                else {
                    b.classList.add("wrong");
                    ow.querySelectorAll(".quiz-option").forEach(x => { if (x.innerText.startsWith(q.answer + ")")) x.classList.add("correct"); });
                }
                answered++;
                if (answered === quizData.length) {
                    const sc = document.createElement("div");
                    sc.className = "quiz-score";
                    sc.innerText = `Score: ${score} / ${quizData.length}`;
                    quizDisplay.appendChild(sc);
                }
            };
            ow.appendChild(b);
        });
        qDiv.appendChild(ow);
        quizDisplay.appendChild(qDiv);
    });
}

// IMAGE PICKING (inline thumbnail)
imageBtn.addEventListener("click", () => imageInput.click());
cameraBtn.addEventListener("click", () => cameraInput.click());

function handleImageFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return showToast("Sirf image bhej sakte ho", "error");

    // Compress if too large (>2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast("Image compress kar rahe hain...", "info");
    }

    const reader = new FileReader();
    reader.onload = ev => {
        pendingImage = { dataUrl: ev.target.result, mime: file.type };
        pendingThumb.src = ev.target.result;
        pendingCaption.value = "";
        pendingImageBar.classList.remove("hidden");
        setTimeout(() => pendingCaption.focus(), 100);
    };
    reader.readAsDataURL(file);
}

imageInput.addEventListener("change", e => {
    const file = e.target.files && e.target.files[0];
    handleImageFile(file);
    e.target.value = "";
});

cameraInput.addEventListener("change", e => {
    const file = e.target.files && e.target.files[0];
    handleImageFile(file);
    e.target.value = "";
});

pendingRemove.addEventListener("click", () => {
    pendingImage = null;
    pendingImageBar.classList.add("hidden");
    pendingThumb.src = "";
    pendingCaption.value = "";
});

// SEND (text OR image)
async function sendMessage() {
    // If image pending → send image
    if (pendingImage) {
        const caption = pendingCaption.value.trim();
        const img = pendingImage;
        pendingImage = null;
        pendingImageBar.classList.add("hidden");
        pendingThumb.src = "";
        pendingCaption.value = "";
        await sendImageMessage(img.dataUrl, img.mime, caption);
        return;
    }

    const text = userInput.value.trim();
    if (!text) return;
    if (!currentUser) return showToast("Pehle login karo", "error");
    if (currentView !== "chat") switchView("chat");
    if (!currentChatId) { currentChatId = "chat_" + Date.now(); sessionStorage.setItem(CHAT_SESSION_KEY, currentChatId); }

    const wb = messagesContainer.querySelector(".welcome-block");
    if (wb) wb.remove();

    appendUserMessage(text);
    userInput.value = "";
    chatHistoryContext.push({ role: "user", content: text });

    const userEmail = currentUser.email || "No Email";
    const userName = currentUser.displayName || (currentUser.email && currentUser.email.split("@")[0]) || "User";

    const memRx = /^(remember:|remember that|save:|save that|note:|rule:|yaad rakho:|yaad rakhna:|suno:|sun:)\s*(.*)/i;
    const match = text.match(memRx);
    if (match && match[2]) {
        const learned = match[2].trim();
        await savePersonalMemory(learned);
        const msg = "Theek hai, maine ise yaad rakh liya.";
        chatHistoryContext.push({ role: "assistant", content: msg });
        appendAIMessage(msg, true, text);
        await saveMessageToFirebase(currentChatId, text, msg);
        return;
    }

    const trimmed = chatHistoryContext.slice(-8);
    const lr = document.createElement("div");
    lr.classList.add("message-row", "ai-row");
    const lb = document.createElement("div");
    lb.classList.add("message", "ai-message", "typing-message");
    lb.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
    lr.appendChild(lb);
    messagesContainer.appendChild(lr);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
        const res = await fetch(`${API_BASE}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: trimmed, userName, userEmail,
                globalRules: globalRulesCache,
                personalMemory: userPersonalMemoryCache,
                preferredLanguage: currentLanguage
            })
        });
        const data = await res.json();
        if (messagesContainer.contains(lr)) messagesContainer.removeChild(lr);

        if (res.ok && data.reply) {
            const aiReply = data.reply;
            chatHistoryContext.push({ role: "assistant", content: aiReply });
            appendAIMessage(aiReply, true, text);
            if (isCurrentUserAdmin() && data.showModel && data.provider && data.model) {
                const mi = document.createElement("div");
                mi.className = "admin-model-info";
                mi.innerText = "🤖 " + data.provider + " • " + data.model;
                messagesContainer.appendChild(mi);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
            await saveMessageToFirebase(currentChatId, text, aiReply);
        } else {
            appendAIMessage((data && data.reply) || "Abhi response nahi aaya.", true, text);
        }
    } catch {
        if (messagesContainer.contains(lr)) messagesContainer.removeChild(lr);
        appendAIMessage("Bhai, server se connection nahi ho pa raha.", true, text);
        showToast("Connection failed", "error");
    }
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });
pendingCaption.addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });

async function sendImageMessage(dataUrl, mime, caption) {
    if (!currentUser) return;
    if (currentView !== "chat") switchView("chat");
    if (!currentChatId) { currentChatId = "chat_" + Date.now(); sessionStorage.setItem(CHAT_SESSION_KEY, currentChatId); }
    const wb = messagesContainer.querySelector(".welcome-block");
    if (wb) wb.remove();

    appendUserImageMessage(dataUrl, caption);
    const userText = caption || "[Image]";
    chatHistoryContext.push({ role: "user", content: userText });

    const lr = document.createElement("div");
    lr.classList.add("message-row", "ai-row");
    const lb = document.createElement("div");
    lb.classList.add("message", "ai-message", "typing-message");
    lb.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
    lr.appendChild(lb);
    messagesContainer.appendChild(lr);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
        const res = await fetch(`${API_BASE}/api/vision`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userText: caption, imageBase64: dataUrl, imageMime: mime,
                userName: currentUser.displayName || "User",
                userEmail: currentUser.email || "",
                personalMemory: userPersonalMemoryCache
            })
        });
        const data = await res.json();
        if (messagesContainer.contains(lr)) messagesContainer.removeChild(lr);
        if (res.ok && data.reply) {
            chatHistoryContext.push({ role: "assistant", content: data.reply });
            appendAIMessage(data.reply, true, userText);
            if (isCurrentUserAdmin() && data.showModel && data.provider && data.model) {
                const mi = document.createElement("div");
                mi.className = "admin-model-info";
                mi.innerText = "🤖 " + data.provider + " • " + data.model;
                messagesContainer.appendChild(mi);
            }
            await saveMessageToFirebase(currentChatId, userText, data.reply);
        } else {
            appendAIMessage((data && data.reply) || "Image samajh nahi paaya.", true, userText);
        }
    } catch {
        if (messagesContainer.contains(lr)) messagesContainer.removeChild(lr);
        appendAIMessage("Image bhejne mein problem aayi.", true, userText);
    }
}

function appendUserImageMessage(dataUrl, caption) {
    const row = document.createElement("div");
    row.classList.add("message-row", "user-row");
    const bubble = document.createElement("div");
    bubble.classList.add("message", "user-message");
    const img = document.createElement("img");
    img.src = dataUrl;
    img.className = "message-image";
    img.onclick = () => openImageLightbox(dataUrl);
    bubble.appendChild(img);
    if (caption) {
        const t = document.createElement("div");
        t.className = "message-text";
        t.innerText = caption;
        bubble.appendChild(t);
    }
    const timeNode = document.createElement("div");
    timeNode.classList.add("msg-time");
    timeNode.innerText = formatTime(Date.now());
    bubble.appendChild(timeNode);
    row.appendChild(bubble);
    messagesContainer.appendChild(row);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function openImageLightbox(src) {
    const lb = document.createElement("div");
    lb.className = "image-lightbox";
    lb.innerHTML = `<button class="image-lightbox-close"><i class="fa-solid fa-xmark"></i></button><img src="${src}">`;
    document.body.appendChild(lb);
    lb.onclick = () => lb.remove();
}

// CALL
function startCallMode() {
    if (!currentUser) return showToast("Pehle login karo", "error");
    callModeActive = true;
    callHistoryContext = [];
    callOverlay.classList.remove("hidden");
    callStatus.innerText = "Tap mic to speak";
    callSub.innerText = "Voice Call Mode";
    callWave.classList.add("idle");
    callMicBtn.classList.remove("active");
    callIsListening = false;
}
callBtn.addEventListener("click", startCallMode);

function endCallMode() {
    callModeActive = false;
    callIsListening = false;
    window.speechSynthesis.cancel();
    try { if (callRecognition) callRecognition.stop(); } catch {}
    callOverlay.classList.add("hidden");
    callWave.classList.add("idle");
    callMicBtn.classList.remove("active");
}
callEndBtn.addEventListener("click", endCallMode);

if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    callRecognition = new SR();
    callRecognition.continuous = false;
    callRecognition.lang = "en-US";
    callRecognition.interimResults = false;
    callRecognition.onresult = async ev => {
        const t = ev.results[0][0].transcript;
        if (t && t.trim()) await handleCallUserSpeech(t.trim());
    };
    callRecognition.onend = () => {
        callIsListening = false;
        callMicBtn.classList.remove("active");
        callWave.classList.add("idle");
        if (callModeActive) callStatus.innerText = "Tap mic to speak";
    };
    callRecognition.onerror = () => {
        callIsListening = false;
        callMicBtn.classList.remove("active");
        callWave.classList.add("idle");
        if (callModeActive) callStatus.innerText = "Mic error";
    };
}

callMicBtn.addEventListener("click", () => {
    if (!callModeActive) return;
    if (callIsListening) {
        try { callRecognition.stop(); } catch {}
        callIsListening = false;
        callMicBtn.classList.remove("active");
        callWave.classList.add("idle");
        callStatus.innerText = "Stopped";
        return;
    }
    if (!callRecognition) return showToast("Mic support nahi hai", "error");
    window.speechSynthesis.cancel();
    try {
        callRecognition.start();
        callIsListening = true;
        callMicBtn.classList.add("active");
        callWave.classList.remove("idle");
        callStatus.innerText = "Listening...";
    } catch {}
});

async function handleCallUserSpeech(userText) {
    callStatus.innerText = "Thinking...";
    callWave.classList.add("idle");
    callMicBtn.classList.remove("active");
    callHistoryContext.push({ role: "user", content: userText });
    try {
        const res = await fetch(`${API_BASE}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: callHistoryContext.slice(-6),
                userName: currentUser.displayName || "User",
                userEmail: currentUser.email || "",
                globalRules: globalRulesCache,
                personalMemory: userPersonalMemoryCache
            })
        });
        const data = await res.json();
        if (res.ok && data.reply) {
            callHistoryContext.push({ role: "assistant", content: data.reply });
            speakCallReply(data.reply);
        } else callStatus.innerText = "No response";
    } catch { callStatus.innerText = "Network error"; }
}

function speakCallReply(text) {
    if (!("speechSynthesis" in window)) { callStatus.innerText = "Tap mic"; return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 1.0;
    u.pitch = 1.0;
    callStatus.innerText = "Speaking...";
    callWave.classList.remove("idle");
    u.onend = () => { callWave.classList.add("idle"); if (callModeActive) callStatus.innerText = "Tap mic to speak"; };
    u.onerror = () => { callWave.classList.add("idle"); if (callModeActive) callStatus.innerText = "Tap mic to speak"; };
    window.speechSynthesis.speak(u);
}

// CHIPS
const CHIP_POOL = [
    "Mujhe ek joke sunao", "Ek chhoti si kahani likho", "Aaj ka din kaisa rahega",
    "Mujhe motivate karo", "Ek shayari sunao", "Kuchh interesting batao",
    "Ek puzzle do mujhe", "Study tips do yaar", "Ek riddle poochho mujhse",
    "Tanmay ke baare mein batao", "Ek mazedaar fact batao", "Mera mood kharaab hai",
    "Python ke baare mein batao", "Ek film recommend karo", "Cricket ke baare mein batao",
    "Ek quote do mujhe", "Mujhe kuchh naya sikhao", "Ek dost jaisa baat karo",
    "Kuchh hasi-mazaak karo", "Ek achhi kitaab batao", "Mujhe ek brain teaser do",
    "Space ke baare mein batao", "History ki ek rochak baat batao", "Ek achha gaana recommend karo"
];

function showWelcomeScreen() {
    const displayName = currentUser ? (currentUser.displayName || (currentUser.email && currentUser.email.split("@")[0]) || "User") : "User";
    const sub = isCurrentUserAdmin() ? `Welcome back, ${displayName}` : `Hello ${displayName}! Kuchh bhi poochho.`;
    messagesContainer.innerHTML = `
        <div class="welcome-block">
            <div class="welcome-logo">T</div>
            <h1 class="welcome-title">Tanmay AI</h1>
            <p class="welcome-sub">${sub}</p>
            <div class="suggestion-chips" id="suggestion-chips"></div>
        </div>`;
    const shuffled = [...CHIP_POOL].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, 4);
    const cc = document.getElementById("suggestion-chips");
    chosen.forEach(text => {
        const b = document.createElement("button");
        b.className = "chip";
        b.innerText = text;
        b.addEventListener("click", () => { userInput.value = text; sendMessage(); });
        cc.appendChild(b);
    });
}

function startNewChatSession() {
    currentChatId = "chat_" + Date.now();
    sessionStorage.setItem(CHAT_SESSION_KEY, currentChatId);
    chatHistoryContext = [];
    showWelcomeScreen();
    window.speechSynthesis.cancel();
    resetSpeakingButtons();
    // clear pending image too
    pendingImage = null;
    if (pendingImageBar) pendingImageBar.classList.add("hidden");
    document.querySelectorAll(".history-item-wrapper").forEach(el => el.classList.remove("active-chat-topic"));
}

newChatBtn.addEventListener("click", () => {
    switchView("chat");
    startNewChatSession();
    if (window.innerWidth <= 768) closeSidebar();
    userInput.focus();
});

// VOICE
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.continuous = false;
    recognition.lang = "en-US";
    recognition.onstart = () => { micBtn.classList.add("listening"); userInput.placeholder = "Listening..."; };
    recognition.onend = () => { micBtn.classList.remove("listening"); userInput.placeholder = "Ask Tanmay AI..."; };
    recognition.onresult = ev => {
        userInput.value = ev.results[0][0].transcript;
        if (autoSendVoice) sendMessage();
    };
}

micBtn.addEventListener("click", () => {
    if (recognition) { try { recognition.start(); } catch {} }
    else showToast("Mic not supported", "error");
});

toggleVoiceBtn.addEventListener("click", () => {
    isVoiceEnabled = !isVoiceEnabled;
    toggleVoiceBtn.innerHTML = isVoiceEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
    settingVoiceToggle.checked = isVoiceEnabled;
    localStorage.setItem("tanmay-voice", isVoiceEnabled ? "on" : "off");
    if (!isVoiceEnabled) { window.speechSynthesis.cancel(); resetSpeakingButtons(); }
    showToast(isVoiceEnabled ? "Voice ON" : "Voice OFF", "info");
});

window.speakIndividualMessage = function (buttonElement) {
    const row = buttonElement.closest(".message-row");
    const text = row.querySelector(".message-text").innerText;
    if (currentSpeakingButton === buttonElement && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        resetSpeakingButtons();
        return;
    }
    window.speechSynthesis.cancel();
    resetSpeakingButtons();
    buttonElement.innerHTML = '<i class="fa-solid fa-stop"></i>';
    buttonElement.classList.add("speaking-now");
    currentSpeakingButton = buttonElement;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.onend = resetSpeakingButtons;
    u.onerror = resetSpeakingButtons;
    window.speechSynthesis.speak(u);
};

function resetSpeakingButtons() {
    document.querySelectorAll(".msg-action-btn.speak-btn").forEach(btn => {
        btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        btn.classList.remove("speaking-now");
    });
    currentSpeakingButton = null;
}

// MESSAGE BUILDER
function buildMessageRow(text, isUser, timestamp) {
    if (!timestamp) timestamp = Date.now();
    const row = document.createElement("div");
    row.classList.add("message-row", isUser ? "user-row" : "ai-row");

    const bubble = document.createElement("div");
    bubble.classList.add("message", isUser ? "user-message" : "ai-message");

    const tn = document.createElement("div");
    tn.classList.add("message-text");
    tn.innerText = text;

    const tm = document.createElement("div");
    tm.classList.add("msg-time");
    tm.innerText = formatTime(timestamp);

    bubble.appendChild(tn);
    bubble.appendChild(tm);
    row.appendChild(bubble);

    const actions = document.createElement("div");
    actions.classList.add("msg-actions", isUser ? "user-actions" : "ai-actions");

    if (!isUser) {
        const sb = document.createElement("button");
        sb.className = "msg-action-btn speak-btn";
        sb.title = "Listen";
        sb.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        sb.onclick = e => { e.stopPropagation(); speakIndividualMessage(sb); };
        actions.appendChild(sb);
    }

    const cb = document.createElement("button");
    cb.className = "msg-action-btn";
    cb.title = "Copy";
    cb.innerHTML = '<i class="fa-solid fa-copy"></i>';
    cb.onclick = e => { e.stopPropagation(); copyToClipboard(text); };
    actions.appendChild(cb);

    const mb = document.createElement("button");
    mb.className = "msg-action-btn msg-menu-btn";
    mb.title = "More";
    mb.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
    mb.onclick = e => { e.stopPropagation(); openMessageMenu(mb, text, isUser); };
    actions.appendChild(mb);

    row.appendChild(actions);

    bubble.onclick = e => {
        if (e.target.closest("button")) return;
        if (e.target.closest(".message-image")) return;
        if (window.getSelection().toString()) return;
        row.classList.toggle("show-actions");
    };
    return row;
}

function openMessageMenu(anchorBtn, text, isUser) {
    const items = [
        { label: "Copy", icon: "fa-copy", action: () => copyToClipboard(text) },
        { label: "Share", icon: "fa-share", action: () => shareMessage(text) }
    ];
    if (!isUser) {
        items.push({ label: "Read Aloud", icon: "fa-volume-high", action: () => {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = "en-US";
            window.speechSynthesis.speak(u);
            showToast("Reading...", "info");
        }});
    }
    openMenu(anchorBtn, items, isUser);
}

function appendUserMessage(text, timestamp) {
    const row = buildMessageRow(text, true, timestamp);
    messagesContainer.appendChild(row);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return row;
}

function appendAIMessage(text, shouldSpeak, qText, timestamp) {
    const row = buildMessageRow(text, false, timestamp);
    messagesContainer.appendChild(row);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    if (isVoiceEnabled && shouldSpeak && !isInitialLoadRunning) {
        const sb = row.querySelector(".speak-btn");
        if (sb) window.speakIndividualMessage(sb);
    }
    return row;
}

async function savePersonalMemory(content) {
    if (!currentUser) return;
    await addDoc(collection(db, `users_memory/${currentUser.uid}/memories`), { memory: content, timestamp: Date.now() });
    userPersonalMemoryCache.push(content);
}

async function saveMessageToFirebase(chatId, userText, aiText) {
    if (!currentUser) return;
    try {
        const nm = currentUser.displayName || (currentUser.email && currentUser.email.split("@")[0]) || "User";
        await addDoc(collection(db, "chat_messages"), {
            uid: currentUser.uid, userName: nm,
            userEmail: currentUser.email || "No Email",
            userPhoto: currentUser.photoURL || "",
            chatId, userText, aiText, timestamp: Date.now()
        });
        loadAllSidebarTopics(false);
    } catch (e) { console.error(e); }
}

async function loadAllSidebarTopics(isInitialLoad) {
    if (!currentUser) return;
    try {
        historyList.innerHTML = "";
        const q = query(collection(db, "chat_messages"));
        const snap = await getDocs(q);
        const map = new Map();
        snap.forEach(d => {
            const x = d.data();
            if (x.uid !== currentUser.uid) return;
            const cid = x.chatId;
            if (!cid) return;
            if (!map.has(cid)) {
                map.set(cid, { chatId: cid, firstUserText: x.userText || "Chat", firstTimestamp: x.timestamp || 0, latestTimestamp: x.timestamp || 0 });
            } else {
                const c = map.get(cid);
                const ts = x.timestamp || 0;
                if (ts < c.firstTimestamp) { c.firstTimestamp = ts; c.firstUserText = x.userText || c.firstUserText; }
                if (ts > c.latestTimestamp) c.latestTimestamp = ts;
            }
        });
        const list = Array.from(map.values());
        list.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
        list.forEach(i => addTopicToSidebarUI(i.firstUserText, i.chatId));
        if (isInitialLoad) {
            const saved = sessionStorage.getItem(CHAT_SESSION_KEY);
            if (saved && map.has(saved)) { currentChatId = saved; await loadFullChatSession(saved); }
            else startNewChatSession();
            isInitialLoadRunning = false;
        }
    } catch (e) { console.error(e); isInitialLoadRunning = false; }
}

function addTopicToSidebarUI(text, chatId) {
    const w = document.createElement("div");
    w.classList.add("history-item-wrapper");
    w.dataset.text = text || "";
    if (chatId === currentChatId) w.classList.add("active-chat-topic");

    const sp = document.createElement("span");
    sp.classList.add("history-text");
    sp.innerText = text && text.length > 20 ? text.substring(0, 20) + "..." : (text || "Chat");
    sp.onclick = () => {
        currentChatId = chatId;
        sessionStorage.setItem(CHAT_SESSION_KEY, chatId);
        document.querySelectorAll(".history-item-wrapper").forEach(el => el.classList.remove("active-chat-topic"));
        w.classList.add("active-chat-topic");
        switchView("chat");
        loadFullChatSession(chatId);
        if (window.innerWidth <= 768) closeSidebar();
    };

    const del = document.createElement("button");
    del.classList.add("delete-item-btn");
    del.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    del.onclick = async e => {
        e.stopPropagation();
        if (!confirm("Delete this chat?")) return;
        const q = query(collection(db, "chat_messages"), where("chatId", "==", chatId));
        const snap = await getDocs(q);
        for (const ds of snap.docs) if (ds.data().uid === currentUser.uid) await deleteDoc(doc(db, "chat_messages", ds.id));
        if (currentChatId === chatId) { sessionStorage.removeItem(CHAT_SESSION_KEY); startNewChatSession(); }
        loadAllSidebarTopics(false);
        showToast("Chat deleted", "success");
    };

    w.appendChild(sp);
    w.appendChild(del);
    historyList.appendChild(w);
}

async function loadFullChatSession(chatId) {
    messagesContainer.innerHTML = "";
    chatHistoryContext = [];
    try {
        const q = query(collection(db, "chat_messages"), where("chatId", "==", chatId));
        const snap = await getDocs(q);
        const arr = [];
        snap.forEach(d => { const x = d.data(); if (x.uid === currentUser.uid) arr.push(x); });
        arr.sort((a, b) => a.timestamp - b.timestamp);
        for (const x of arr) {
            appendUserMessage(x.userText, x.timestamp - 1000);
            chatHistoryContext.push({ role: "user", content: x.userText });
            appendAIMessage(x.aiText, false, x.userText, x.timestamp);
            chatHistoryContext.push({ role: "assistant", content: x.aiText });
        }
        scrollToBottom();
    } catch (e) { console.error(e); }
}

document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        switchView("chat");
        startNewChatSession();
        showToast("New chat", "info");
    }
    if (e.key === "Escape") {
        if (callModeActive) endCallMode();
        else if (openDropdown) closeDropdown();
        else if (pendingImage) { pendingImage = null; pendingImageBar.classList.add("hidden"); }
        else if (!settingsOverlay.classList.contains("hidden")) closeSettings();
        else if (window.innerWidth <= 768 && !sidebar.classList.contains("collapsed")) closeSidebar();
    }
});