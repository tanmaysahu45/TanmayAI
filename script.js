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
    orderBy,
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

const ADMIN_EMAILS = [
    "tanmaysahu652@gmail.com"
];

const googleOAuthUrl =
    `https://tanmay-ai-1190d.firebaseapp.com/__/auth/handler?providerId=google.com&authType=signInWithRedirect&apiKey=${firebaseConfig.apiKey}`;

// sessionStorage — tab band hone pe clear, refresh pe rehta hai
const CHAT_SESSION_KEY = "tanmay_active_chat";

const loginContainer = document.getElementById("login-container");
const appContainer = document.getElementById("app-container");
const googleLoginBtn = document.getElementById("google-login-btn");
const logoutBtn = document.getElementById("logout-btn");
const usernameDisplay = document.getElementById("username-display");
const userAvatar = document.getElementById("user-avatar");
const defaultUserIcon = document.getElementById("default-user-icon");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const messagesContainer = document.getElementById("messages-container");
const toggleVoiceBtn = document.getElementById("toggle-voice-btn");
const historyList = document.getElementById("history-list");
const clearHistoryBtn = document.getElementById("clear-history-btn");
const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const newChatBtn = document.getElementById("new-chat-btn");
const chatArea = document.querySelector(".chat-area");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const chatSearchInput = document.getElementById("chat-search-input");
const toastContainer = document.getElementById("toast-container");

let isVoiceEnabled = true;
let recognition = null;
let currentSpeakingButton = null;
let currentUser = null;
let currentChatId = null;
let chatHistoryContext = [];
let isInitialLoadRunning = true;
let globalRulesCache = [];
let userPersonalMemoryCache = [];

loginContainer.classList.add("hidden");
appContainer.classList.add("hidden");

// =====================================================
// THEME
// =====================================================
const savedTheme = localStorage.getItem("tanmay-theme");
if (savedTheme === "light") {
    document.body.classList.add("light-mode");
    themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
}

themeToggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    const isLight = document.body.classList.contains("light-mode");
    localStorage.setItem("tanmay-theme", isLight ? "light" : "dark");
    themeToggleBtn.innerHTML = isLight
        ? '<i class="fa-solid fa-moon"></i>'
        : '<i class="fa-solid fa-sun"></i>';
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

// =====================================================
// TIME
// =====================================================
function formatTime(ts) {
    const d = new Date(ts);
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + m + " " + ampm;
}

// =====================================================
// SCROLL TO BOTTOM
// =====================================================
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

// =====================================================
// ADMIN
// =====================================================
function isCurrentUserAdmin() {
    return !!(
        currentUser &&
        currentUser.email &&
        ADMIN_EMAILS.includes(currentUser.email.toLowerCase())
    );
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
        usernameDisplay.innerText = displayName;

        if (user.photoURL) {
            userAvatar.src = user.photoURL;
            userAvatar.style.display = "block";
            defaultUserIcon.style.display = "none";
        } else {
            userAvatar.style.display = "none";
            defaultUserIcon.style.display = "inline-block";
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

// =====================================================
// LOGIN
// =====================================================
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

// =====================================================
// LOGOUT
// =====================================================
logoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => {
        window.speechSynthesis.cancel();
        sessionStorage.removeItem(CHAT_SESSION_KEY);
        showToast("Logged out", "info");
    });
});

// =====================================================
// SIDEBAR
// =====================================================
sidebarToggleBtn.addEventListener("click", e => {
    e.stopPropagation();
    sidebar.classList.toggle("collapsed");
    if (window.innerWidth <= 768) {
        sidebarOverlay.classList.toggle(
            "active",
            !sidebar.classList.contains("collapsed")
        );
    }
});

sidebarOverlay.addEventListener("click", () => {
    sidebar.classList.add("collapsed");
    sidebarOverlay.classList.remove("active");
});

// =====================================================
// SEARCH
// =====================================================
chatSearchInput.addEventListener("input", e => {
    const term = e.target.value.toLowerCase().trim();
    document.querySelectorAll(".history-item-wrapper").forEach(el => {
        const text = (el.dataset.text || "").toLowerCase();
        el.style.display = !term || text.includes(term) ? "flex" : "none";
    });
});

// =====================================================
// SUGGESTION CHIPS POOL
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
    "Aaj ka mausam kaisa hai",
    "Ek quote do mujhe",
    "Mujhe kuchh naya sikhao",
    "Ek dost jaisa baat karo",
    "Kuchh hasi-mazaak karo",
    "Ek achhi kitaab batao",
    "Mujhe ek brain teaser do",
    "Space ke baare mein batao",
    "History ki ek rochak baat batao",
    "Mujhe ek nayi hobby suggest karo",
    "Ek achha gaana recommend karo",
    "Kuchh motivation quotes do",
    "Mujhe coding ke baare mein sikhao",
    "Ek ajeeb sa fact batao",
    "Kaise time manage karun batao"
];

// =====================================================
// WELCOME SCREEN
// =====================================================
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
        btn.setAttribute("data-prompt", text);
        btn.innerText = text;
        btn.addEventListener("click", () => {
            userInput.value = text;
            sendMessage();
        });
        chipsContainer.appendChild(btn);
    });
}

// =====================================================
// NEW CHAT
// =====================================================
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

newChatBtn.addEventListener("click", startNewChatSession);

// =====================================================
// VOICE INPUT
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
        sendMessage();
    };
}

micBtn.addEventListener("click", () => {
    if (recognition) {
        try {
            recognition.start();
        } catch (e) {
            console.log("Mic error:", e);
        }
    } else {
        showToast("Aapke browser mein mic support nahi hai", "error");
    }
});

// =====================================================
// VOICE OUTPUT
// =====================================================
toggleVoiceBtn.addEventListener("click", () => {
    isVoiceEnabled = !isVoiceEnabled;
    toggleVoiceBtn.innerHTML = isVoiceEnabled
        ? '<i class="fa-solid fa-volume-high"></i>'
        : '<i class="fa-solid fa-volume-xmark"></i>';
    if (!isVoiceEnabled) {
        window.speechSynthesis.cancel();
        resetSpeakingButtons();
    }
    showToast(isVoiceEnabled ? "Voice ON" : "Voice OFF", "info");
});

window.speakIndividualMessage = function (buttonElement) {
    const messageText = buttonElement
        .parentNode.querySelector(".message-text").innerText;

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
    document.querySelectorAll(".msg-speak-btn").forEach(btn => {
        btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        btn.classList.remove("speaking-now");
    });
    currentSpeakingButton = null;
}

// =====================================================
// MESSAGES
// =====================================================
function appendUserMessage(text, timestamp) {
    if (!timestamp) timestamp = Date.now();

    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", "user-message");

    const textNode = document.createElement("div");
    textNode.classList.add("message-text");
    textNode.innerText = text;

    const timeNode = document.createElement("div");
    timeNode.classList.add("msg-time");
    timeNode.innerText = formatTime(timestamp);

    msgDiv.appendChild(textNode);
    msgDiv.appendChild(timeNode);

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function appendAIMessage(text, shouldSpeak, questionText, timestamp) {
    if (!timestamp) timestamp = Date.now();

    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", "ai-message");

    const textDiv = document.createElement("div");
    textDiv.classList.add("message-text");
    textDiv.innerText = text;

    const speakBtn = document.createElement("button");
    speakBtn.classList.add("msg-speak-btn");
    speakBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    speakBtn.onclick = function () {
        speakIndividualMessage(this);
    };

    const timeNode = document.createElement("div");
    timeNode.classList.add("msg-time");
    timeNode.innerText = formatTime(timestamp);

    msgDiv.appendChild(textDiv);
    msgDiv.appendChild(speakBtn);
    msgDiv.appendChild(timeNode);

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (isVoiceEnabled && shouldSpeak && !isInitialLoadRunning) {
        window.speakIndividualMessage(speakBtn);
    }
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

    const loadingDiv = document.createElement("div");
    loadingDiv.classList.add("message", "ai-message", "typing-message");
    loadingDiv.innerHTML = `
        <div class="typing-dots">
            <span></span><span></span><span></span>
        </div>
    `;
    messagesContainer.appendChild(loadingDiv);
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
                    personalMemory: userPersonalMemoryCache
                })
            }
        );

        const data = await response.json();

        if (messagesContainer.contains(loadingDiv)) {
            messagesContainer.removeChild(loadingDiv);
        }

        if (response.ok && data.reply) {
            const aiResponse = data.reply;
            chatHistoryContext.push({ role: "assistant", content: aiResponse });

            appendAIMessage(aiResponse, true, text);

            if (
                isCurrentUserAdmin() &&
                data.showModel &&
                data.provider &&
                data.model
            ) {
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

        if (messagesContainer.contains(loadingDiv)) {
            messagesContainer.removeChild(loadingDiv);
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

        // Puri collection fetch karo, phir JS mein group karo
        const q = query(collection(db, "chat_messages"));
        const snap = await getDocs(q);

        // Har chat ke liye: first message (title), first time, last time
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
                if (ts > c.latestTimestamp) {
                    c.latestTimestamp = ts;
                }
            }
        });

        // Order: latest activity first
        const chatList = Array.from(chatMap.values());
        chatList.sort((a, b) => b.latestTimestamp - a.latestTimestamp);

        chatList.forEach(item => {
            addTopicToSidebarUI(item.firstUserText, item.chatId);
        });

        // Search filter
        const term = chatSearchInput.value.toLowerCase().trim();
        if (term) {
            document.querySelectorAll(".history-item-wrapper").forEach(el => {
                const t = (el.dataset.text || "").toLowerCase();
                el.style.display = t.includes(term) ? "flex" : "none";
            });
        }

        // Initial load: sessionStorage check
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

// =====================================================
// SIDEBAR ITEM
// =====================================================
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
        if (window.innerWidth <= 768) {
            sidebar.classList.add("collapsed");
            sidebarOverlay.classList.remove("active");
        }
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.classList.add("delete-item-btn");
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';

    deleteBtn.onclick = async e => {
        e.stopPropagation();
        if (!confirm("Do you want to delete this chat?")) return;

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

// =====================================================
// LOAD CHAT (with scroll to bottom)
// =====================================================
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

        // Scroll to bottom after render
        scrollToBottom();
    } catch (error) {
        console.error("Session error:", error);
    }
}

// =====================================================
// CLEAR HISTORY
// =====================================================
clearHistoryBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    if (!confirm("Are you sure you want to clear all chat history?")) return;

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
    showToast("History cleared", "success");
});

// =====================================================
// SIDEBAR AUTO CLOSE
// =====================================================
chatArea.addEventListener("click", () => {
    if (!sidebar.classList.contains("collapsed")) {
        sidebar.classList.add("collapsed");
        sidebarOverlay.classList.remove("active");
    }
});

userInput.addEventListener("click", e => {
    e.stopPropagation();
    if (!sidebar.classList.contains("collapsed")) {
        sidebar.classList.add("collapsed");
        sidebarOverlay.classList.remove("active");
    }
});