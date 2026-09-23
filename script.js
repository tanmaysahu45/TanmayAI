import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    addDoc,
    query,
    deleteDoc,
    doc,
    getDocs,
    where
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

const googleOAuthUrl =
    `https://tanmay-ai-1190d.firebaseapp.com/__/auth/handler?providerId=google.com&authType=signInWithRedirect&apiKey=${firebaseConfig.apiKey}`;

// ELEMENTS
const loginContainer = document.getElementById("login-container");
const appContainer = document.getElementById("app-container");
const googleLoginBtn = document.getElementById("google-login-btn");
const usernameDisplay = document.getElementById("username-display");
const useremailDisplay = document.getElementById("useremail-display");
const userAvatar = document.getElementById("user-avatar");
const defaultUserIcon = document.getElementById("default-user-icon");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const messagesContainer = document.getElementById("messages-container");
const toggleVoiceBtn = document.getElementById("toggle-voice-btn");
const historyList = document.getElementById("history-list");
const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
const newChatBtn = document.getElementById("new-chat-btn");
const chatArea = document.querySelector(".chat-area");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const chatSearchInput = document.getElementById("chat-search-input");
const toastContainer = document.getElementById("toast-container");
const headerMenuBtn = document.getElementById("header-menu-btn");

const openSettingsBtn = document.getElementById("open-settings-btn");
const closeSettingsBtn = document.getElementById("close-settings-btn");
const settingsOverlay = document.getElementById("settings-overlay");
const userProfileBtn = document.getElementById("user-profile-btn");
const settingsAvatar = document.getElementById("settings-avatar");
const settingsDefaultIcon = document.getElementById("settings-default-icon");
const settingsUsername = document.getElementById("settings-username");
const settingsUseremail = document.getElementById("settings-useremail");
const settingTheme = document.getElementById("setting-theme");
const settingLanguage = document.getElementById("setting-language");
const settingVoiceToggle = document.getElementById("setting-voice-toggle");
const settingAutosendVoice = document.getElementById("setting-autosend-voice");
const settingsClearHistory = document.getElementById("settings-clear-history");
const settingsClearMemory = document.getElementById("settings-clear-memory");
const settingsLogoutBtn = document.getElementById("settings-logout-btn");
const settingsInstallBtn = document.getElementById("settings-install-btn");
const installSection = document.getElementById("install-section");
const installHint = document.getElementById("install-hint");

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

loginContainer.classList.add("hidden");
appContainer.classList.add("hidden");

// =====================================================
// PWA — SERVICE WORKER + INSTALL
// =====================================================
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js").catch(err => {
            console.log("SW registration failed:", err);
        });
    });
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalone() {
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true
    );
}

// Capture install prompt
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
    if (isStandalone()) {
        installSection.style.display = "none";
        return;
    }

    installSection.style.display = "block";

    if (deferredInstallPrompt) {
        settingsInstallBtn.style.display = "flex";
        settingsInstallBtn.innerHTML = `
            <i class="fa-solid fa-download"></i>
            <div>
                <strong>Install Tanmay AI</strong>
                <small>App ki tarah phone mein lagao</small>
            </div>
        `;
        installHint.style.display = "none";
    } else if (isIOS()) {
        settingsInstallBtn.style.display = "none";
        installHint.style.display = "block";
        installHint.innerHTML = `
            <strong>iPhone / iPad pe install karne ke liye:</strong><br>
            1. Neeche <b>Share</b> button dabao (square with arrow)<br>
            2. <b>Add to Home Screen</b> chuno<br>
            3. <b>Add</b> dabao
        `;
    } else {
        settingsInstallBtn.style.display = "flex";
        settingsInstallBtn.innerHTML = `
            <i class="fa-solid fa-download"></i>
            <div>
                <strong>Install Tanmay AI</strong>
                <small>Browser menu se "Install App" chuno</small>
            </div>
        `;
        installHint.style.display = "block";
        installHint.innerHTML = `
            Browser ke menu (⋮) mein <b>"Install App"</b> ya <b>"Add to Home Screen"</b> option dhundho.
        `;
    }
}

async function triggerInstall() {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === "accepted") {
            showToast("Installing...", "success");
        } else {
            showToast("Install cancelled", "info");
        }
        deferredInstallPrompt = null;
        updateInstallUI();
    } else if (isIOS()) {
        showToast("Safari Share button se add karo", "info");
    } else {
        showToast("Browser menu se install karo", "info");
    }
}

settingsInstallBtn.addEventListener("click", triggerInstall);

// =====================================================
// HEADER MENU (3-DOT)
// =====================================================
function closeHeaderDropdown() {
    if (openDropdown && openDropdown.classList.contains("header-dropdown")) {
        openDropdown.remove();
        openDropdown = null;
    }
}

headerMenuBtn.addEventListener("click", e => {
    e.stopPropagation();
    closeDropdown();
    closeHeaderDropdown();

    const dd = document.createElement("div");
    dd.className = "header-dropdown";

    const items = [];

    if (!isStandalone()) {
        items.push({
            label: "Install App",
            icon: "fa-download",
            action: () => triggerInstall()
        });
    }

    items.push(
        {
            label: "Share App",
            icon: "fa-share-nodes",
            action: () => shareApp()
        },
        {
            label: "Settings",
            icon: "fa-gear",
            action: () => {
                closeSidebar();
                openSettings();
            }
        },
        {
            label: "New Chat",
            icon: "fa-plus",
            action: () => startNewChatSession()
        }
    );

    items.forEach(item => {
        const b = document.createElement("button");
        b.className = "header-dropdown-item";
        b.innerHTML = `<i class="fa-solid ${item.icon}"></i> ${item.label}`;
        b.onclick = ev => {
            ev.stopPropagation();
            closeHeaderDropdown();
            item.action();
        };
        dd.appendChild(b);
    });

    document.body.appendChild(dd);

    const rect = headerMenuBtn.getBoundingClientRect();
    const menuWidth = 210;
    let left = rect.right - menuWidth;
    let top = rect.bottom + 6;

    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10;

    dd.style.left = left + "px";
    dd.style.top = top + "px";

    openDropdown = dd;
});

async function shareApp() {
    const url = window.location.origin + window.location.pathname;
    const shareData = {
        title: "Tanmay AI",
        text: "Dekh, ye Tanmay AI hai — ek personal AI assistant!",
        url: url
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (e) {
            if (e.name !== "AbortError") {
                await copyToClipboard(url);
            }
        }
    } else {
        await copyToClipboard(url);
    }
}

// =====================================================
// SETTINGS STORAGE
// =====================================================
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
    toggleVoiceBtn.innerHTML = isVoiceEnabled
        ? '<i class="fa-solid fa-volume-high"></i>'
        : '<i class="fa-solid fa-volume-xmark"></i>';

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
    if (meta) meta.setAttribute("content", theme === "light" ? "#f5f5f7" : "#131314");
}

themeToggleBtn.addEventListener("click", () => {
    const isLight = document.body.classList.contains("light-mode");
    applyTheme(isLight ? "dark" : "light");
});

settingTheme.addEventListener("change", e => applyTheme(e.target.value));

settingLanguage.addEventListener("change", e => {
    currentLanguage = e.target.value;
    localStorage.setItem("tanmay-language", currentLanguage);
    showToast("Language updated", "success");
});

settingVoiceToggle.addEventListener("change", e => {
    isVoiceEnabled = e.target.checked;
    localStorage.setItem("tanmay-voice", isVoiceEnabled ? "on" : "off");
    toggleVoiceBtn.innerHTML = isVoiceEnabled
        ? '<i class="fa-solid fa-volume-high"></i>'
        : '<i class="fa-solid fa-volume-xmark"></i>';
    if (!isVoiceEnabled) {
        window.speechSynthesis.cancel();
        resetSpeakingButtons();
    }
    showToast(isVoiceEnabled ? "Voice ON" : "Voice OFF", "info");
});

settingAutosendVoice.addEventListener("change", e => {
    autoSendVoice = e.target.checked;
    localStorage.setItem("tanmay-autosend-voice", autoSendVoice ? "on" : "off");
    showToast(autoSendVoice ? "Auto-send ON" : "Auto-send OFF", "info");
});

// =====================================================
// TOAST
// =====================================================
function showToast(message, type = "success") {
    const t = document.createElement("div");
    t.className = "toast toast-" + type;
    t.innerText = message;
    toastContainer.appendChild(t);
    setTimeout(() => t.classList.add("show"), 20);
    setTimeout(() => {
        t.classList.remove("show");
        setTimeout(() => t.remove(), 300);
    }, 2600);
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
    requestAnimationFrame(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 80);
}

// =====================================================
// LOADER
// =====================================================
const globalLoader = document.createElement("div");
globalLoader.classList.add("custom-loader-wrapper");
globalLoader.innerHTML = `
    <div class="chakri"></div>
    <div class="loader-text">Tanmay AI is loading...</div>
`;
document.body.appendChild(globalLoader);

function removeLoader() {
    if (globalLoader && document.body.contains(globalLoader)) {
        globalLoader.style.opacity = "0";
        setTimeout(() => {
            if (document.body.contains(globalLoader)) {
                document.body.removeChild(globalLoader);
            }
        }, 300);
    }
}

function isCurrentUserAdmin() {
    return !!(
        currentUser &&
        currentUser.email &&
        ADMIN_EMAILS.includes(currentUser.email.toLowerCase())
    );
}

// =====================================================
// COPY / SHARE
// =====================================================
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
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
    } catch (e) {
        console.error("Copy error:", e);
        showToast("Copy failed", "error");
    }
}

async function shareMessage(text) {
    if (navigator.share) {
        try {
            await navigator.share({ title: "Tanmay AI", text: text });
        } catch (e) {
            if (e.name !== "AbortError") copyToClipboard(text);
        }
    } else {
        copyToClipboard(text);
    }
}

// =====================================================
// DROPDOWN (MESSAGE MENU)
// =====================================================
function closeDropdown() {
    if (openDropdown && !openDropdown.classList.contains("header-dropdown")) {
        openDropdown.remove();
        openDropdown = null;
    }
}

document.addEventListener("click", e => {
    if (!openDropdown) return;
    if (openDropdown.contains(e.target)) return;
    const isMsgBtn = e.target.closest(".msg-menu-btn");
    const isHeaderBtn = e.target.closest("#header-menu-btn");
    if (isMsgBtn || isHeaderBtn) return;
    if (openDropdown.classList.contains("header-dropdown")) {
        closeHeaderDropdown();
    } else {
        closeDropdown();
    }
});

function openMenu(anchorBtn, menuItems, isUserMsg) {
    closeDropdown();
    closeHeaderDropdown();

    const dropdown = document.createElement("div");
    dropdown.className = "msg-dropdown";

    menuItems.forEach(item => {
        const btn = document.createElement("button");
        btn.className = "msg-dropdown-item" + (item.danger ? " danger" : "");
        btn.innerHTML = `<i class="fa-solid ${item.icon}"></i> ${item.label}`;
        btn.onclick = ev => {
            ev.stopPropagation();
            closeDropdown();
            item.action();
        };
        dropdown.appendChild(btn);
    });

    document.body.appendChild(dropdown);

    const rect = anchorBtn.getBoundingClientRect();
    const menuWidth = 180;
    let left = isUserMsg ? rect.right - menuWidth : rect.left;
    let top = rect.bottom + 6;

    if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10;
    if (left < 10) left = 10;

    const menuHeight = menuItems.length * 42 + 12;
    let dropUp = false;
    if (top + menuHeight > window.innerHeight - 10) {
        top = rect.top - menuHeight - 6;
        dropUp = true;
    }

    dropdown.style.left = left + "px";
    dropdown.style.top = top + "px";
    if (dropUp) dropdown.classList.add("drop-up");

    openDropdown = dropdown;
}

// =====================================================
// MEMORY
// =====================================================
async function loadAllMemories() {
    if (!currentUser) return;
    try {
        const gSnap = await getDocs(collection(db, "global_rules"));
        globalRulesCache = [];
        gSnap.forEach(d => {
            const data = d.data();
            if (data && data.rule) globalRulesCache.push(data.rule);
        });

        const uSnap = await getDocs(
            collection(db, `users_memory/${currentUser.uid}/memories`)
        );
        userPersonalMemoryCache = [];
        uSnap.forEach(d => {
            if (d.data() && d.data().memory) {
                userPersonalMemoryCache.push(d.data().memory);
            }
        });
    } catch (error) {
        console.error("Memory load error:", error);
    }
}

// =====================================================
// AUTH
// =====================================================
onAuthStateChanged(auth, async user => {
    if (user) {
        currentUser = user;
        const displayName =
            user.displayName || (user.email && user.email.split("@")[0]) || "User";
        const email = user.email || "";

        usernameDisplay.innerText = displayName;
        useremailDisplay.innerText = email;
        settingsUsername.innerText = displayName;
        settingsUseremail.innerText = email;

        if (user.photoURL) {
            userAvatar.src = user.photoURL;
            userAvatar.style.display = "block";
            defaultUserIcon.style.display = "none";
            settingsAvatar.src = user.photoURL;
            settingsAvatar.style.display = "block";
            settingsDefaultIcon.style.display = "none";
        } else {
            userAvatar.style.display = "none";
            defaultUserIcon.style.display = "inline-block";
            settingsAvatar.style.display = "none";
            settingsDefaultIcon.style.display = "block";
        }

        await loadAllMemories();
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
    const isWebView =
        /wv|WebView/i.test(window.navigator.userAgent) ||
        (!window.chrome && /Android|iPhone|iPad/i.test(window.navigator.userAgent));

    if (isWebView) {
        window.location.href = googleOAuthUrl;
    } else {
        signInWithPopup(auth, provider).catch(error => {
            showToast("Login Error: " + error.message, "error");
        });
    }
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

// =====================================================
// SETTINGS PANEL
// =====================================================
function openSettings() {
    settingsOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    updateInstallUI();
}

function closeSettings() {
    settingsOverlay.classList.add("hidden");
    document.body.style.overflow = "";
}

openSettingsBtn.addEventListener("click", () => {
    closeSidebar();
    openSettings();
});
userProfileBtn.addEventListener("click", () => {
    closeSidebar();
    openSettings();
});
closeSettingsBtn.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", e => {
    if (e.target === settingsOverlay) closeSettings();
});

settingsClearHistory.addEventListener("click", async () => {
    if (!currentUser) return;
    if (!confirm("Clear ALL chat history? Ye wapas nahi aayega.")) return;

    try {
        const q = query(collection(db, "chat_messages"));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
            if (d.data().uid === currentUser.uid) {
                await deleteDoc(doc(db, "chat_messages", d.id));
            }
        }
        sessionStorage.removeItem(CHAT_SESSION_KEY);
        startNewChatSession();
        historyList.innerHTML = "";
        closeSettings();
        showToast("History cleared", "success");
    } catch (e) {
        console.error(e);
        showToast("Clear failed", "error");
    }
});

settingsClearMemory.addEventListener("click", async () => {
    if (!currentUser) return;
    if (!confirm("Clear your personal memory? AI sab bhool jayega.")) return;

    try {
        const q = query(collection(db, `users_memory/${currentUser.uid}/memories`));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
            await deleteDoc(doc(db, `users_memory/${currentUser.uid}/memories`, d.id));
        }
        userPersonalMemoryCache = [];
        showToast("Personal memory cleared", "success");
    } catch (e) {
        console.error(e);
        showToast("Clear failed", "error");
    }
});

// =====================================================
// SIDEBAR
// =====================================================
function openSidebar() {
    sidebar.classList.remove("collapsed");
    if (window.innerWidth <= 768) sidebarOverlay.classList.add("active");
}

function closeSidebar() {
    sidebar.classList.add("collapsed");
    sidebarOverlay.classList.remove("active");
}

sidebarToggleBtn.addEventListener("click", e => {
    e.stopPropagation();
    if (sidebar.classList.contains("collapsed")) openSidebar();
    else closeSidebar();
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

// =====================================================
// CHIPS
// =====================================================
const CHIP_POOL = [
    "Mujhe ek joke sunao",
    "Ek chhoti si kahani likho",
    "Aaj ka din kaisa rahega",
    "Mujhe motivate karo",
    "Ek shayari sunao",
    "Kuchh interesting batao",
    "Ek puzzle do mujhe",
    "Study tips do yaar",
    "Ek riddle poochho mujhse",
    "Tanmay ke baare mein batao",
    "Ek mazedaar fact batao",
    "Mera mood kharaab hai, kuchh acha bolo",
    "Python ke baare mein batao",
    "Ek film recommend karo",
    "Cricket ke baare mein kuchh batao",
    "Ek quote do mujhe",
    "Mujhe kuchh naya sikhao",
    "Ek dost jaisa baat karo",
    "Kuchh hasi-mazaak karo",
    "Ek achhi kitaab batao",
    "Mujhe ek brain teaser do",
    "Space ke baare mein batao",
    "History ki ek rochak baat batao",
    "Ek achha gaana recommend karo",
    "Mujhe coding ke baare mein sikhao",
    "Kaise time manage karun batao"
];

function showWelcomeScreen() {
    const displayName = currentUser
        ? (currentUser.displayName || (currentUser.email && currentUser.email.split("@")[0]) || "User")
        : "User";

    const sub = isCurrentUserAdmin()
        ? `Welcome back, ${displayName}`
        : `Hello ${displayName}! Kuchh bhi poochho.`;

    messagesContainer.innerHTML = `
        <div class="welcome-block">
            <div class="welcome-logo">T</div>
            <h1 class="welcome-title">Tanmay AI</h1>
            <p class="welcome-sub">${sub}</p>
            <div class="suggestion-chips" id="suggestion-chips"></div>
        </div>
    `;

    const shuffled = [...CHIP_POOL].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, 4);
    const chipsContainer = document.getElementById("suggestion-chips");

    chosen.forEach(text => {
        const btn = document.createElement("button");
        btn.className = "chip";
        btn.innerText = text;
        btn.addEventListener("click", () => {
            userInput.value = text;
            sendMessage();
        });
        chipsContainer.appendChild(btn);
    });
}

function startNewChatSession() {
    currentChatId = "chat_" + Date.now();
    sessionStorage.setItem(CHAT_SESSION_KEY, currentChatId);
    chatHistoryContext = [];
    showWelcomeScreen();
    window.speechSynthesis.cancel();
    resetSpeakingButtons();

    document.querySelectorAll(".history-item-wrapper").forEach(el => {
        el.classList.remove("active-chat-topic");
    });
}

newChatBtn.addEventListener("click", () => {
    startNewChatSession();
    if (window.innerWidth <= 768) closeSidebar();
    userInput.focus();
});

// =====================================================
// VOICE
// =====================================================
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
        micBtn.classList.add("listening");
        userInput.placeholder = "Listening...";
    };
    recognition.onend = () => {
        micBtn.classList.remove("listening");
        userInput.placeholder = "Ask Tanmay AI...";
    };
    recognition.onresult = event => {
        userInput.value = event.results[0][0].transcript;
        if (autoSendVoice) sendMessage();
    };
}

micBtn.addEventListener("click", () => {
    if (recognition) {
        try { recognition.start(); } catch (e) { console.log("Mic error:", e); }
    } else {
        showToast("Mic not supported", "error");
    }
});

toggleVoiceBtn.addEventListener("click", () => {
    isVoiceEnabled = !isVoiceEnabled;
    toggleVoiceBtn.innerHTML = isVoiceEnabled
        ? '<i class="fa-solid fa-volume-high"></i>'
        : '<i class="fa-solid fa-volume-xmark"></i>';
    settingVoiceToggle.checked = isVoiceEnabled;
    localStorage.setItem("tanmay-voice", isVoiceEnabled ? "on" : "off");
    if (!isVoiceEnabled) {
        window.speechSynthesis.cancel();
        resetSpeakingButtons();
    }
    showToast(isVoiceEnabled ? "Voice ON" : "Voice OFF", "info");
});

window.speakIndividualMessage = function (buttonElement) {
    const messageRow = buttonElement.closest(".message-row");
    const messageText = messageRow.querySelector(".message-text").innerText;

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

    const utterance = new SpeechSynthesisUtterance(messageText);
    utterance.lang = "en-US";
    utterance.onend = resetSpeakingButtons;
    utterance.onerror = resetSpeakingButtons;
    window.speechSynthesis.speak(utterance);
};

function resetSpeakingButtons() {
    document.querySelectorAll(".msg-action-btn.speak-btn").forEach(btn => {
        btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        btn.classList.remove("speaking-now");
    });
    currentSpeakingButton = null;
}

// =====================================================
// MESSAGES
// =====================================================
function buildMessageRow(text, isUser, timestamp) {
    if (!timestamp) timestamp = Date.now();

    const row = document.createElement("div");
    row.classList.add("message-row", isUser ? "user-row" : "ai-row");

    const bubble = document.createElement("div");
    bubble.classList.add("message", isUser ? "user-message" : "ai-message");

    const textNode = document.createElement("div");
    textNode.classList.add("message-text");
    textNode.innerText = text;

    const timeNode = document.createElement("div");
    timeNode.classList.add("msg-time");
    timeNode.innerText = formatTime(timestamp);

    bubble.appendChild(textNode);
    bubble.appendChild(timeNode);
    row.appendChild(bubble);

    const actions = document.createElement("div");
    actions.classList.add("msg-actions", isUser ? "user-actions" : "ai-actions");

    if (!isUser) {
        const speakBtn = document.createElement("button");
        speakBtn.className = "msg-action-btn speak-btn";
        speakBtn.title = "Listen";
        speakBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        speakBtn.onclick = e => {
            e.stopPropagation();
            speakIndividualMessage(speakBtn);
        };
        actions.appendChild(speakBtn);
    }

    const copyBtn = document.createElement("button");
    copyBtn.className = "msg-action-btn";
    copyBtn.title = "Copy";
    copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i>';
    copyBtn.onclick = e => {
        e.stopPropagation();
        copyToClipboard(text);
    };
    actions.appendChild(copyBtn);

    const menuBtn = document.createElement("button");
    menuBtn.className = "msg-action-btn msg-menu-btn";
    menuBtn.title = "More";
    menuBtn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
    menuBtn.onclick = e => {
        e.stopPropagation();
        openMessageMenu(menuBtn, text, isUser);
    };
    actions.appendChild(menuBtn);

    row.appendChild(actions);

    bubble.onclick = e => {
        if (e.target.closest("button")) return;
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
        items.push({
            label: "Read Aloud",
            icon: "fa-volume-high",
            action: () => {
                window.speechSynthesis.cancel();
                const utter = new SpeechSynthesisUtterance(text);
                utter.lang = "en-US";
                window.speechSynthesis.speak(utter);
                showToast("Reading...", "info");
            }
        });
    }

    items.push({
        label: "Select Text",
        icon: "fa-text-height",
        action: () => showToast("Long-press / drag to select", "info")
    });

    openMenu(anchorBtn, items, isUser);
}

function appendUserMessage(text, timestamp) {
    const row = buildMessageRow(text, true, timestamp);
    messagesContainer.appendChild(row);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return row;
}

function appendAIMessage(text, shouldSpeak, questionText, timestamp) {
    const row = buildMessageRow(text, false, timestamp);
    messagesContainer.appendChild(row);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (isVoiceEnabled && shouldSpeak && !isInitialLoadRunning) {
        const speakBtn = row.querySelector(".speak-btn");
        if (speakBtn) window.speakIndividualMessage(speakBtn);
    }
    return row;
}

// =====================================================
// PERSONAL MEMORY
// =====================================================
async function savePersonalMemory(content) {
    if (!currentUser) return;
    await addDoc(
        collection(db, `users_memory/${currentUser.uid}/memories`),
        { memory: content, timestamp: Date.now() }
    );
    userPersonalMemoryCache.push(content);
}

// =====================================================
// SEND MESSAGE
// =====================================================
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    if (!currentUser) {
        showToast("Pehle login karo", "error");
        return;
    }

    if (!currentChatId) {
        currentChatId = "chat_" + Date.now();
        sessionStorage.setItem(CHAT_SESSION_KEY, currentChatId);
    }

    const welcomeBlock = messagesContainer.querySelector(".welcome-block");
    if (welcomeBlock) welcomeBlock.remove();

    appendUserMessage(text);
    userInput.value = "";
    chatHistoryContext.push({ role: "user", content: text });

    const userEmail = currentUser.email || "No Email";
    const userName =
        currentUser.displayName || (currentUser.email && currentUser.email.split("@")[0]) || "User";

    const memoryTriggerRegex =
        /^(remember:|remember that|save:|save that|note:|rule:|yaad rakho:|yaad rakhna:|suno:|sun:)\s*(.*)/i;
    const match = text.match(memoryTriggerRegex);

    if (match && match[2]) {
        const learnedContent = match[2].trim();
        await savePersonalMemory(learnedContent);

        const msg = "Theek hai, maine ise yaad rakh liya.";
        chatHistoryContext.push({ role: "assistant", content: msg });
        appendAIMessage(msg, true, text);
        await saveMessageToFirebase(currentChatId, text, msg);
        return;
    }

    const trimmedContext = chatHistoryContext.slice(-8);

    const loadingRow = document.createElement("div");
    loadingRow.classList.add("message-row", "ai-row");
    const loadingBubble = document.createElement("div");
    loadingBubble.classList.add("message", "ai-message", "typing-message");
    loadingBubble.innerHTML = `
        <div class="typing-dots">
            <span></span><span></span><span></span>
        </div>
    `;
    loadingRow.appendChild(loadingBubble);
    messagesContainer.appendChild(loadingRow);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
        const response = await fetch(
            "https://tanmayai-11j5.onrender.com/api/chat",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: trimmedContext,
                    userName: userName,
                    userEmail: userEmail,
                    globalRules: globalRulesCache,
                    personalMemory: userPersonalMemoryCache,
                    preferredLanguage: currentLanguage
                })
            }
        );

        const data = await response.json();

        if (messagesContainer.contains(loadingRow)) {
            messagesContainer.removeChild(loadingRow);
        }

        if (response.ok && data.reply) {
            const aiResponse = data.reply;
            chatHistoryContext.push({ role: "assistant", content: aiResponse });

            appendAIMessage(aiResponse, true, text);

            if (isCurrentUserAdmin() && data.showModel && data.provider && data.model) {
                const modelInfo = document.createElement("div");
                modelInfo.className = "admin-model-info";
                modelInfo.innerText = "🤖 " + data.provider + " • " + data.model;
                messagesContainer.appendChild(modelInfo);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            await saveMessageToFirebase(currentChatId, text, aiResponse);
        } else {
            appendAIMessage(
                (data && data.reply) || "Abhi AI ka proper response nahi aaya.",
                true,
                text
            );
        }
    } catch (error) {
        console.error("Tanmay AI Error:", error);

        if (messagesContainer.contains(loadingRow)) {
            messagesContainer.removeChild(loadingRow);
        }

        appendAIMessage(
            "Bhai, abhi server se connection nahi ho pa raha. Thodi der baad try karo.",
            true,
            text
        );
        showToast("Connection failed", "error");
    }
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
});

// =====================================================
// SAVE CHAT
// =====================================================
async function saveMessageToFirebase(chatId, userText, aiText) {
    if (!currentUser) return;
    try {
        const calculatedName =
            currentUser.displayName || (currentUser.email && currentUser.email.split("@")[0]) || "User";

        await addDoc(collection(db, "chat_messages"), {
            uid: currentUser.uid,
            userName: calculatedName,
            userEmail: currentUser.email || "No Email",
            userPhoto: currentUser.photoURL || "",
            chatId: chatId,
            userText: userText,
            aiText: aiText,
            timestamp: Date.now()
        });

        loadAllSidebarTopics(false);
    } catch (error) {
        console.error("Firebase Save Error:", error);
    }
}

// =====================================================
// SIDEBAR TOPICS
// =====================================================
async function loadAllSidebarTopics(isInitialLoad) {
    if (!currentUser) return;

    try {
        historyList.innerHTML = "";

        const q = query(collection(db, "chat_messages"));
        const snap = await getDocs(q);
        const chatMap = new Map();

        snap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.uid !== currentUser.uid) return;
            const chatId = data.chatId;
            if (!chatId) return;

            if (!chatMap.has(chatId)) {
                chatMap.set(chatId, {
                    chatId: chatId,
                    firstUserText: data.userText || "Chat",
                    firstTimestamp: data.timestamp || 0,
                    latestTimestamp: data.timestamp || 0
                });
            } else {
                const c = chatMap.get(chatId);
                const ts = data.timestamp || 0;
                if (ts < c.firstTimestamp) {
                    c.firstTimestamp = ts;
                    c.firstUserText = data.userText || c.firstUserText;
                }
                if (ts > c.latestTimestamp) c.latestTimestamp = ts;
            }
        });

        const chatList = Array.from(chatMap.values());
        chatList.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
        chatList.forEach(item => addTopicToSidebarUI(item.firstUserText, item.chatId));

        const term = chatSearchInput.value.toLowerCase().trim();
        if (term) {
            document.querySelectorAll(".history-item-wrapper").forEach(el => {
                const t = (el.dataset.text || "").toLowerCase();
                el.style.display = t.includes(term) ? "flex" : "none";
            });
        }

        if (isInitialLoad) {
            const savedChatId = sessionStorage.getItem(CHAT_SESSION_KEY);
            const chatExists = savedChatId && chatMap.has(savedChatId);
            if (chatExists) {
                currentChatId = savedChatId;
                await loadFullChatSession(currentChatId);
            } else {
                startNewChatSession();
            }
            isInitialLoadRunning = false;
        }
    } catch (error) {
        console.error("Sidebar error:", error);
        isInitialLoadRunning = false;
    }
}

function addTopicToSidebarUI(firstQuestion, chatId) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("history-item-wrapper");
    wrapper.dataset.text = firstQuestion || "";

    if (chatId === currentChatId) wrapper.classList.add("active-chat-topic");

    const textSpan = document.createElement("span");
    textSpan.classList.add("history-text");
    textSpan.innerText =
        firstQuestion && firstQuestion.length > 20
            ? firstQuestion.substring(0, 20) + "..."
            : firstQuestion || "Chat";

    textSpan.onclick = () => {
        currentChatId = chatId;
        sessionStorage.setItem(CHAT_SESSION_KEY, chatId);
        document.querySelectorAll(".history-item-wrapper").forEach(el => {
            el.classList.remove("active-chat-topic");
        });
        wrapper.classList.add("active-chat-topic");
        loadFullChatSession(chatId);
        if (window.innerWidth <= 768) closeSidebar();
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.classList.add("delete-item-btn");
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';

    deleteBtn.onclick = async e => {
        e.stopPropagation();
        if (!confirm("Delete this chat?")) return;

        const q = query(collection(db, "chat_messages"), where("chatId", "==", chatId));
        const snap = await getDocs(q);

        for (const docSnap of snap.docs) {
            if (docSnap.data().uid === currentUser.uid) {
                await deleteDoc(doc(db, "chat_messages", docSnap.id));
            }
        }

        const wasActive = currentChatId === chatId;
        if (wasActive) {
            sessionStorage.removeItem(CHAT_SESSION_KEY);
            startNewChatSession();
        }
        loadAllSidebarTopics(false);
        showToast("Chat deleted", "success");
    };

    wrapper.appendChild(textSpan);
    wrapper.appendChild(deleteBtn);
    historyList.appendChild(wrapper);
}

async function loadFullChatSession(chatId) {
    messagesContainer.innerHTML = "";
    chatHistoryContext = [];

    try {
        const q = query(collection(db, "chat_messages"), where("chatId", "==", chatId));
        const snapshot = await getDocs(q);
        const localMessages = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.uid === currentUser.uid) localMessages.push(data);
        });

        localMessages.sort((a, b) => a.timestamp - b.timestamp);

        for (const data of localMessages) {
            appendUserMessage(data.userText, data.timestamp - 1000);
            chatHistoryContext.push({ role: "user", content: data.userText });
            appendAIMessage(data.aiText, false, data.userText, data.timestamp);
            chatHistoryContext.push({ role: "assistant", content: data.aiText });
        }

        scrollToBottom();
    } catch (error) {
        console.error("Session error:", error);
    }
}

// =====================================================
// KEYBOARD SHORTCUTS
// =====================================================
document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        startNewChatSession();
        showToast("New chat", "info");
    }
    if (e.key === "Escape") {
        if (openDropdown) {
            if (openDropdown.classList.contains("header-dropdown")) closeHeaderDropdown();
            else closeDropdown();
        } else if (!settingsOverlay.classList.contains("hidden")) {
            closeSettings();
        } else if (window.innerWidth <= 768 && !sidebar.classList.contains("collapsed")) {
            closeSidebar();
        }
    }
});