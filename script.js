import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, deleteDoc, doc, getDocs, where } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

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

// शुरुआत में दोनों स्क्रीन छुपाकर रखेंगे ताकि कोई झटका न लगे
loginContainer.classList.add('hidden');
appContainer.classList.add('hidden');

// गोल-गोल घूमने वाली चकरी को स्क्रीन पर बनाना
const globalLoader = document.createElement('div');
globalLoader.classList.add('custom-loader-wrapper');
globalLoader.innerHTML = `
    <div class="chakri"></div>
    <div class="loader-text">Tanmay AI loading...</div>
`;
document.body.appendChild(globalLoader);

// चकरी को हटाने का फंक्शन
function removeLoader() {
    if (globalLoader && document.body.contains(globalLoader)) {
        globalLoader.style.opacity = '0';
        setTimeout(() => {
            if (document.body.contains(globalLoader)) document.body.removeChild(globalLoader);
        }, 300);
    }
}

// टैब रीफ्रेश चेक करने का लॉजिक (रीफ्रेश पर पुरानी चैट रहेगी, फ्रेश ओपन पर नई चैट)
if (!sessionStorage.getItem('isTabRefreshed')) {
    localStorage.removeItem('activeChatId'); 
    sessionStorage.setItem('isTabRefreshed', 'true');
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        usernameDisplay.innerText = user.displayName;
        if (user.photoURL) {
            userAvatar.src = user.photoURL;
            userAvatar.style.display = 'block';
            defaultUserIcon.style.display = 'none';
        }
        
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
    signInWithPopup(auth, provider).catch(err => alert("Login Error: " + err.message));
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

// ✅ नई चैट की शुरुआत अब शुद्ध इंग्लिश में होगी!
function startNewChatSession() {
    currentChatId = "chat_" + Date.now(); 
    localStorage.setItem('activeChatId', currentChatId); 
    chatHistoryContext = [];
    
    // शुरुआत का टेक्स्ट इंग्लिश में सेट कर दिया
    messagesContainer.innerHTML = `
        <div class="message ai-message">
            <div class="message-text">New chat started! Ask me anything, how can I help you?</div>
            <button class="msg-speak-btn" onclick="speakIndividualMessage(this)" title="Listen / Stop"><i class="fa-solid fa-volume-high"></i></button>
        </div>`;
        
    window.speechSynthesis.cancel();
    resetSpeakingButtons();
    document.querySelectorAll('.history-item-wrapper').forEach(el => el.classList.remove('active-chat-topic'));
    
    // पहला वेलकम मैसेज इंग्लिश टोन में बोलेगा
    if (isVoiceEnabled && !isInitialLoadRunning) {
        setTimeout(() => {
            const firstBtn = messagesContainer.querySelector('.msg-speak-btn');
            if (firstBtn) {
                window.speechSynthesis.cancel();
                resetSpeakingButtons();
                firstBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
                firstBtn.classList.add('speaking-now');
                currentSpeakingButton = firstBtn;
                
                const utterance = new SpeechSynthesisUtterance("New chat started! Ask me anything, how can I help you?");
                utterance.lang = 'en-US'; // शुरुआत इंग्लिश में
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
    recognition.lang = 'hi-IN'; // माइक डिफ़ॉल्ट हिंदी/हिंग्लिश सुनेगा
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

// बाकी मैसेजेस के लिए नॉर्मल बोलना (हिंग्लिश/हिंदी सपोर्ट)
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
    
    // अगर मैसेज में शुरुआत का इंग्लिश टेक्स्ट है तो en-US, बाकी सबके लिए hi-IN
    if (messageText.includes("New chat started!")) {
        utterance.lang = 'en-US';
    } else {
        utterance.lang = 'hi-IN';
    }
    
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

    const loadingDiv = document.createElement('div');
    loadingDiv.classList.add('message', 'ai-message');
    loadingDiv.innerText = "Tanmay AI soch raha hai...";
    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
        const response = await fetch('https://tanmayai-11j5.onrender.com/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: chatHistoryContext })
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
        await addDoc(collection(db, "chat_messages"), {
            uid: currentUser.uid,
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