import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, deleteDoc, doc, getDocs, where, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

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

// आपकी एडमिन ईमेल ID
const ADMIN_EMAILS = ["tanmaysahu652@gmail.com"];

const googleOAuthUrl = `https://tanmay-ai-1190d.firebaseapp.com/__/auth/handler?providerId=google.com&authType=signInWithRedirect&apiKey=${firebaseConfig.apiKey}`;

const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const googleLoginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const usernameDisplay = document.getElementById('username-display');
const userAvatar = document.getElementById('user-avatar');
const defaultUserIcon = document.getElementById('default-user-icon');

const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');
const messagesContainer = document.getElementById('messages-container');
const toggleVoiceBtn = document.getElementById('toggle-voice-btn');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sidebar = document.getElementById('sidebar');
const newChatBtn = document.getElementById('new-chat-btn');
const chatArea = document.querySelector('.chat-area');

let isVoiceEnabled = true;
let recognition;
let currentSpeakingButton = null;
let currentUser = null; 
let currentChatId = null; 
let chatHistoryContext = [];
let isInitialLoadRunning = true; 

let globalRulesCache = [];
let userPersonalMemoryCache = [];

loginContainer.classList.add('hidden');
appContainer.classList.add('hidden');

const globalLoader = document.createElement('div');
globalLoader.classList.add('custom-loader-wrapper');
globalLoader.innerHTML = `
    <div class="chakri"></div>
    <div class="loader-text">Tanmay AI loading...</div>
`;
document.body.appendChild(globalLoader);

function removeLoader() {
    if (globalLoader && document.body.contains(globalLoader)) {
        globalLoader.style.opacity = '0';
        setTimeout(() => {
            if (document.body.contains(globalLoader)) document.body.removeChild(globalLoader);
        }, 300);
    }
}

if (!sessionStorage.getItem('isTabRefreshed')) {
    localStorage.removeItem('activeChatId'); 
    sessionStorage.setItem('isTabRefreshed', 'true');
}

// 1. ग्लोबल रूल्स और पर्सनल मेमोरी लोड करना
async function loadAllMemories() {
    if (!currentUser) return;
    try {
        const gSnap = await getDocs(collection(db, "global_rules"));
        globalRulesCache = [];
        gSnap.forEach(d => { if (d.data()?.rule) globalRulesCache.push(d.data().rule); });

        const uSnap = await getDocs(collection(db, `users_memory/${currentUser.uid}/memories`));
        userPersonalMemoryCache = [];
        uSnap.forEach(d => { if (d.data()?.memory) userPersonalMemoryCache.push(d.data().memory); });
    } catch (e) {
        console.error("Memory load error:", e);
    }
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const displayName = user.displayName || (user.email ? user.email.split('@')[0] : "User");
        usernameDisplay.innerText = displayName;
        
        if (user.photoURL) {
            userAvatar.src = user.photoURL;
            userAvatar.style.display = 'block';
            defaultUserIcon.style.display = 'none';
        } else {
            userAvatar.style.display = 'none';
            defaultUserIcon.style.display = 'inline-block';
        }
        
        await loadAllMemories();
        await loadAllSidebarTopics(true); 
        
        loginContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        removeLoader();
    } else {
        currentUser = null;
        isInitialLoadRunning = false;
        loginContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
        removeLoader();
    }
});

googleLoginBtn.addEventListener('click', () => {
    const isWebView = /wv|WebView/i.test(window.navigator.userAgent) || (!window.chrome && /Android|iPhone|iPad/i.test(window.navigator.userAgent));
    if (isWebView) {
        window.location.href = googleOAuthUrl;
    } else {
        signInWithPopup(auth, provider).catch(err => alert("Login Error: " + err.message));
    }
});

logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => { 
        window.speechSynthesis.cancel(); 
        localStorage.removeItem('activeChatId');
    });
});

sidebarToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('collapsed');
});

function startNewChatSession() {
    currentChatId = "chat_" + Date.now(); 
    localStorage.setItem('activeChatId', currentChatId); 
    chatHistoryContext = [];
    
    const displayName = currentUser ? (currentUser.displayName || currentUser.email?.split('@')[0] || "User") : "User";
    const isAdmin = currentUser && currentUser.email && ADMIN_EMAILS.includes(currentUser.email);
    
    const welcomeText = isAdmin 
        ? `नमस्ते तन्मय! आप मेरे क्रिएटर (Admin) हैं। मुझसे कुछ भी पूछें या ग्लोबल नियम सिखाने के लिए "याद रखो: [नियम]" लिखें।`
        : `New chat started! Hello ${displayName}, how can I help you today?`;

    messagesContainer.innerHTML = `
        <div class="message ai-message">
            <div class="message-text">${welcomeText}</div>
            <button class="msg-speak-btn" onclick="speakIndividualMessage(this)" title="Listen / Stop"><i class="fa-solid fa-volume-high"></i></button>
        </div>`;
        
    window.speechSynthesis.cancel();
    resetSpeakingButtons();
    document.querySelectorAll('.history-item-wrapper').forEach(el => el.classList.remove('active-chat-topic'));
    
    if (isVoiceEnabled && !isInitialLoadRunning) {
        setTimeout(() => {
            const firstBtn = messagesContainer.querySelector('.msg-speak-btn');
            if (firstBtn) {
                window.speechSynthesis.cancel();
                resetSpeakingButtons();
                firstBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
                firstBtn.classList.add('speaking-now');
                currentSpeakingButton = firstBtn;
                
                const utterance = new SpeechSynthesisUtterance(welcomeText);
                utterance.lang = isAdmin ? 'hi-IN' : 'en-US';
                utterance.onend = () => { resetSpeakingButtons(); };
                utterance.onerror = () => { resetSpeakingButtons(); };
                window.speechSynthesis.speak(utterance);
            }
        }, 500);
    }
}

newChatBtn.addEventListener('click', startNewChatSession);

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'hi-IN';
    recognition.onstart = () => { micBtn.classList.add('listening'); userInput.placeholder = "Sunaai de raha hai, boliye..."; };
    recognition.onend = () => { micBtn.classList.remove('listening'); userInput.placeholder = "Ask Tanmay AI..."; };
    recognition.onresult = (event) => { userInput.value = event.results[0][0].transcript; sendMessage(); };
}

micBtn.addEventListener('click', () => { if (recognition) recognition.start(); });

toggleVoiceBtn.addEventListener('click', () => {
    isVoiceEnabled = !isVoiceEnabled;
    toggleVoiceBtn.innerHTML = isVoiceEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
    if (!isVoiceEnabled) { window.speechSynthesis.cancel(); resetSpeakingButtons(); }
});

window.speakIndividualMessage = function(buttonElement) {
    const messageText = buttonElement.parentNode.querySelector('.message-text').innerText;
    if (currentSpeakingButton === buttonElement && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel(); resetSpeakingButtons(); return;
    }
    window.speechSynthesis.cancel(); resetSpeakingButtons();
    buttonElement.innerHTML = '<i class="fa-solid fa-stop"></i>';
    buttonElement.classList.add('speaking-now');
    currentSpeakingButton = buttonElement;
    
    const utterance = new SpeechSynthesisUtterance(messageText);
    utterance.lang = messageText.includes("New chat started!") ? 'en-US' : 'hi-IN';
    
    utterance.onend = () => { resetSpeakingButtons(); };
    utterance.onerror = () => { resetSpeakingButtons(); };
    window.speechSynthesis.speak(utterance);
}

function resetSpeakingButtons() {
    document.querySelectorAll('.msg-speak-btn').forEach(btn => {
        btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        btn.classList.remove('speaking-now');
    });
    currentSpeakingButton = null;
}

function appendUserMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', 'user-message');
    msgDiv.innerText = text;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function appendAIMessage(text, shouldSpeak = false) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', 'ai-message');
    const textDiv = document.createElement('div');
    textDiv.classList.add('message-text');
    textDiv.innerText = text;
    const speakBtn = document.createElement('button');
    speakBtn.classList.add('msg-speak-btn');
    speakBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    speakBtn.onclick = function() { speakIndividualMessage(this); };
    msgDiv.appendChild(textDiv);
    msgDiv.appendChild(speakBtn);
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (isVoiceEnabled && shouldSpeak && !isInitialLoadRunning) {
        window.speakIndividualMessage(speakBtn);
    }
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    if (!currentChatId) {
        currentChatId = "chat_" + Date.now();
        localStorage.setItem('activeChatId', currentChatId);
    }

    appendUserMessage(text);
    userInput.value = '';
    chatHistoryContext.push({ role: "user", content: text });

    const userEmail = currentUser ? (currentUser.email || "No Email") : "No Email";
    const userName = currentUser ? (currentUser.displayName || currentUser.email?.split('@')[0] || "User") : "User";
    const isAdmin = currentUser && currentUser.email && ADMIN_EMAILS.includes(currentUser.email);

    // 🌟 SMART MEMORY HANDLER (Zero AI Token Cost)
    const teachPrefixMatch = text.match(/^(याद रखो:|याद रखो|rule:|rule|suno:|सुनो:|मेरा नाम|remember:)\s*(.*)/i);
    if (teachPrefixMatch && teachPrefixMatch[2]) {
        const learnedContent = teachPrefixMatch[2].trim();
        
        if (isAdmin) {
            await addDoc(collection(db, "global_rules"), {
                rule: learnedContent,
                addedBy: userEmail,
                timestamp: Date.now()
            });
            globalRulesCache.push(learnedContent);
            const confirmationMsg = `✅ समझ गया तन्मय! यह नया ग्लोबल नियम पूरे सिस्टम में सेव कर लिया गया है: "${learnedContent}"`;
            chatHistoryContext.push({ role: "assistant", content: confirmationMsg });
            appendAIMessage(confirmationMsg, true);
            await saveMessageToFirebase(currentChatId, text, confirmationMsg);
            return;
        } else {
            await addDoc(collection(db, `users_memory/${currentUser.uid}/memories`), {
                memory: learnedContent,
                timestamp: Date.now()
            });
            userPersonalMemoryCache.push(learnedContent);
            const confirmationMsg = `✅ ठीक है! मैंने आपकी यह जानकारी अपनी पर्सनल मेमोरी में सेव कर ली है: "${learnedContent}"`;
            chatHistoryContext.push({ role: "assistant", content: confirmationMsg });
            appendAIMessage(confirmationMsg, true);
            await saveMessageToFirebase(currentChatId, text, confirmationMsg);
            return;
        }
    }

    // 🌟 SLIDING WINDOW CONTEXT (पिछले 6 मैसेज ही सर्वर को भेजे जाएंगे)
    const trimmedContext = chatHistoryContext.slice(-6);

    const loadingDiv = document.createElement('div');
    loadingDiv.classList.add('message', 'ai-message');
    loadingDiv.innerText = "Tanmay AI soch raha hai...";
    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
        const response = await fetch('https://tanmayai-11j5.onrender.com/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                messages: trimmedContext,
                userName: userName,
                userEmail: userEmail,
                isAdmin: isAdmin,
                globalRules: globalRulesCache,
                personalMemory: userPersonalMemoryCache
            })
        });

        const data = await response.json();
        if (loadingDiv && messagesContainer.contains(loadingDiv)) messagesContainer.removeChild(loadingDiv);

        if (data.reply) {
            const aiResponse = data.reply;
            chatHistoryContext.push({ role: "assistant", content: aiResponse });
            appendAIMessage(aiResponse, true);
            await saveMessageToFirebase(currentChatId, text, aiResponse);
        } else {
            appendAIMessage("Server se koi valid response nahi aaya bhai.", true);
        }
    } catch (error) {
        if (loadingDiv && messagesContainer.contains(loadingDiv)) messagesContainer.removeChild(loadingDiv);
        appendAIMessage("Backend Server se connect nahi ho paya.", true);
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

async function saveMessageToFirebase(chatId, userText, aiText) {
    if (!currentUser) return;
    try {
        const calculatedName = currentUser.displayName || currentUser.email?.split('@')[0] || "User";
        
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
    } catch (e) {
        console.error("Firebase Save Error:", e);
    }
}

async function loadAllSidebarTopics(isInitialLoad = false) {
    if (!currentUser) return;
    try {
        historyList.innerHTML = '';
        const chatIdsInOrder = [];
        const seenChatIds = new Set();

        const qNew = query(collection(db, "chat_messages"), orderBy("timestamp", "desc"));
        const snapNew = await getDocs(qNew);
        snapNew.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.uid === currentUser.uid && !seenChatIds.has(data.chatId)) {
                seenChatIds.add(data.chatId);
                chatIdsInOrder.push({ chatId: data.chatId, userText: data.userText, timestamp: data.timestamp });
            }
        });

        chatIdsInOrder.sort((a, b) => b.timestamp - a.timestamp);
        chatIdsInOrder.forEach(item => { addTopicToSidebarUI(item.userText, item.chatId); });

        if (isInitialLoad) {
            const savedChatId = localStorage.getItem('activeChatId'); 
            
            if (savedChatId && seenChatIds.has(savedChatId)) {
                currentChatId = savedChatId;
                await loadFullChatSession(currentChatId); 
                isInitialLoadRunning = false; 
            } else {
                startNewChatSession();
                isInitialLoadRunning = false;
            }
        }
    } catch (err) {
        console.error("Error loading sidebar topics:", err);
        isInitialLoadRunning = false;
    }
}

function addTopicToSidebarUI(firstQuestion, chatId) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('history-item-wrapper');
    if (chatId === currentChatId) wrapper.classList.add('active-chat-topic');

    const textSpan = document.createElement('span');
    textSpan.classList.add('history-text');
    textSpan.innerText = firstQuestion.length > 18 ? firstQuestion.substring(0, 18) + "..." : firstQuestion;
    
    textSpan.onclick = () => { 
        currentChatId = chatId; 
        localStorage.setItem('activeChatId', chatId); 
        document.querySelectorAll('.history-item-wrapper').forEach(el => el.classList.remove('active-chat-topic'));
        wrapper.classList.add('active-chat-topic');
        loadFullChatSession(chatId); 
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('delete-item-btn');
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm("Kya aap is chat section ko delete karna chahte hain?")) {
            const q = query(collection(db, "chat_messages"), where("chatId", "==", chatId));
            const snap = await getDocs(q);
            for (const docSnap of snap.docs) { await deleteDoc(doc(db, "chat_messages", docSnap.id)); }
            if (currentChatId === chatId) {
                localStorage.removeItem('activeChatId');
                startNewChatSession();
            }
            loadAllSidebarTopics(false);
        }
    };

    wrapper.appendChild(textSpan);
    wrapper.appendChild(deleteBtn);
    historyList.appendChild(wrapper); 
}

async function loadFullChatSession(chatId) {
    messagesContainer.innerHTML = '';
    chatHistoryContext = [];
    try {
        const q = query(collection(db, "chat_messages"), where("chatId", "==", chatId));
        const querySnapshot = await getDocs(q);
        
        const localMessages = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.uid === currentUser.uid) {
                localMessages.push(data);
            }
        });

        localMessages.sort((a, b) => a.timestamp - b.timestamp);

        localMessages.forEach(data => {
            appendUserMessage(data.userText);
            chatHistoryContext.push({ role: "user", content: data.userText });
            appendAIMessage(data.aiText, false);
            chatHistoryContext.push({ role: "assistant", content: data.aiText });
        });
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (err) {
        console.error("Session fetch error:", err);
    }
}

clearHistoryBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    if (confirm("Kya aap sach me saari chat history hatana chahte hain?")) {
        const q = query(collection(db, "chat_messages"));
        const snap = await getDocs(q);
        for (const d of snap.docs) { 
            if(d.data().uid === currentUser.uid) {
                await deleteDoc(doc(db, "chat_messages", d.id)); 
            }
        }
        localStorage.removeItem('activeChatId');
        startNewChatSession();
        historyList.innerHTML = '';
    }
});

chatArea.addEventListener('click', () => { if (!sidebar.classList.contains('collapsed')) sidebar.classList.add('collapsed'); });
userInput.addEventListener('click', (e) => { e.stopPropagation(); if (!sidebar.classList.contains('collapsed')) sidebar.classList.add('collapsed'); });