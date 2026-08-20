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
    where,
    updateDoc
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

const loginContainer =
    document.getElementById("login-container");

const appContainer =
    document.getElementById("app-container");

const googleLoginBtn =
    document.getElementById("google-login-btn");

const logoutBtn =
    document.getElementById("logout-btn");

const usernameDisplay =
    document.getElementById("username-display");

const userAvatar =
    document.getElementById("user-avatar");

const defaultUserIcon =
    document.getElementById("default-user-icon");

const userInput =
    document.getElementById("user-input");

const sendBtn =
    document.getElementById("send-btn");

const micBtn =
    document.getElementById("mic-btn");

const messagesContainer =
    document.getElementById("messages-container");

const toggleVoiceBtn =
    document.getElementById("toggle-voice-btn");

const historyList =
    document.getElementById("history-list");

const clearHistoryBtn =
    document.getElementById("clear-history-btn");

const sidebarToggleBtn =
    document.getElementById("sidebar-toggle-btn");

const sidebar =
    document.getElementById("sidebar");

const newChatBtn =
    document.getElementById("new-chat-btn");

const chatArea =
    document.querySelector(".chat-area");

let isVoiceEnabled = true;
let recognition = null;
let currentSpeakingButton = null;
let currentUser = null;
let currentChatId = null;
let chatHistoryContext = [];
let isInitialLoadRunning = true;

let globalRulesCache = [];
let globalRulesDocs = [];

let userPersonalMemoryCache = [];

let lastQuestionForEdit = "";
let lastAIResponseForEdit = "";

loginContainer.classList.add("hidden");
appContainer.classList.add("hidden");

// =====================================================
// LOADER
// =====================================================

const globalLoader =
    document.createElement("div");

globalLoader.classList.add(
    "custom-loader-wrapper"
);

globalLoader.innerHTML = `
    <div class="chakri"></div>
    <div class="loader-text">
        Tanmay AI is loading...
    </div>
`;

document.body.appendChild(
    globalLoader
);

function removeLoader() {

    if (
        globalLoader &&
        document.body.contains(globalLoader)
    ) {

        globalLoader.style.opacity = "0";

        setTimeout(() => {

            if (
                document.body.contains(
                    globalLoader
                )
            ) {
                document.body.removeChild(
                    globalLoader
                );
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
        ADMIN_EMAILS.includes(
            currentUser.email.toLowerCase()
        )
    );
}

// =====================================================
// MEMORY LOAD
// =====================================================

async function loadAllMemories() {

    if (!currentUser) return;

    try {

        // -------------------------------
        // GLOBAL
        // -------------------------------

        const gSnap =
            await getDocs(
                collection(
                    db,
                    "global_rules"
                )
            );

        globalRulesCache = [];
        globalRulesDocs = [];

        gSnap.forEach(
            d => {

                const data = d.data();

                if (data?.rule) {

                    globalRulesCache.push(
                        data.rule
                    );

                    globalRulesDocs.push({
                        id: d.id,
                        ...data
                    });
                }
            }
        );

        // -------------------------------
        // PERSONAL
        // -------------------------------

        const uSnap =
            await getDocs(
                collection(
                    db,
                    `users_memory/${currentUser.uid}/memories`
                )
            );

        userPersonalMemoryCache = [];

        uSnap.forEach(
            d => {

                if (d.data()?.memory) {

                    userPersonalMemoryCache.push(
                        d.data().memory
                    );
                }
            }
        );

    } catch (error) {

        console.error(
            "Memory load error:",
            error
        );
    }
}

// =====================================================
// AUTH
// =====================================================

onAuthStateChanged(
    auth,
    async user => {

        if (user) {

            currentUser = user;

            const displayName =
                user.displayName ||
                user.email?.split("@")[0] ||
                "User";

            usernameDisplay.innerText =
                displayName;

            if (user.photoURL) {

                userAvatar.src =
                    user.photoURL;

                userAvatar.style.display =
                    "block";

                defaultUserIcon.style.display =
                    "none";

            } else {

                userAvatar.style.display =
                    "none";

                defaultUserIcon.style.display =
                    "inline-block";
            }

            await loadAllMemories();

            await loadAllSidebarTopics(
                true
            );

            createAdminControls();

            loginContainer.classList.add(
                "hidden"
            );

            appContainer.classList.remove(
                "hidden"
            );

            removeLoader();

        } else {

            currentUser = null;

            loginContainer.classList.remove(
                "hidden"
            );

            appContainer.classList.add(
                "hidden"
            );

            removeLoader();
        }
    }
);

// =====================================================
// LOGIN
// =====================================================

googleLoginBtn.addEventListener(
    "click",
    () => {

        const isWebView =
            /wv|WebView/i.test(
                window.navigator.userAgent
            ) ||
            (
                !window.chrome &&
                /Android|iPhone|iPad/i.test(
                    window.navigator.userAgent
                )
            );

        if (isWebView) {

            window.location.href =
                googleOAuthUrl;

        } else {

            signInWithPopup(
                auth,
                provider
            ).catch(
                error =>
                    alert(
                        "Login Error: " +
                        error.message
                    )
            );
        }
    }
);

// =====================================================
// LOGOUT
// =====================================================

logoutBtn.addEventListener(
    "click",
    () => {

        signOut(auth).then(
            () => {

                window.speechSynthesis.cancel();

                localStorage.removeItem(
                    "activeChatId"
                );
            }
        );
    }
);

// =====================================================
// SIDEBAR
// =====================================================

sidebarToggleBtn.addEventListener(
    "click",
    e => {

        e.stopPropagation();

        sidebar.classList.toggle(
            "collapsed"
        );
    }
);

// =====================================================
// NEW CHAT
// =====================================================

function startNewChatSession() {

    currentChatId =
        "chat_" + Date.now();

    localStorage.setItem(
        "activeChatId",
        currentChatId
    );

    chatHistoryContext = [];

    const displayName =
        currentUser
            ? (
                currentUser.displayName ||
                currentUser.email?.split("@")[0] ||
                "User"
            )
            : "User";

    const welcomeText =
        isCurrentUserAdmin()
            ? "Hello Tanmay! 👑 You are Admin. AI se kuchh bhi poochho. Kisi jawab ko correct karke Global Knowledge mein save bhi kar sakte ho."
            : `Hello ${displayName}! 👋 Main Tanmay AI hoon. Main tumhari personal memory yaad rakh sakta hoon.`;

    messagesContainer.innerHTML = `
        <div class="message ai-message">
            <div class="message-text">${welcomeText}</div>

            <button
                class="msg-speak-btn"
                onclick="speakIndividualMessage(this)"
                title="Listen / Stop"
            >
                <i class="fa-solid fa-volume-high"></i>
            </button>
        </div>
    `;

    window.speechSynthesis.cancel();

    resetSpeakingButtons();

    document
        .querySelectorAll(
            ".history-item-wrapper"
        )
        .forEach(
            el =>
                el.classList.remove(
                    "active-chat-topic"
                )
        );

    if (
        isVoiceEnabled &&
        !isInitialLoadRunning
    ) {

        setTimeout(() => {

            const firstBtn =
                messagesContainer.querySelector(
                    ".msg-speak-btn"
                );

            if (firstBtn) {

                window.speechSynthesis.cancel();

                resetSpeakingButtons();

                firstBtn.innerHTML =
                    '<i class="fa-solid fa-stop"></i>';

                firstBtn.classList.add(
                    "speaking-now"
                );

                currentSpeakingButton =
                    firstBtn;

                const utterance =
                    new SpeechSynthesisUtterance(
                        welcomeText
                    );

                utterance.lang =
                    "en-US";

                utterance.onend =
                    resetSpeakingButtons;

                utterance.onerror =
                    resetSpeakingButtons;

                window.speechSynthesis.speak(
                    utterance
                );
            }

        }, 500);
    }
}

newChatBtn.addEventListener(
    "click",
    startNewChatSession
);

// =====================================================
// VOICE INPUT
// =====================================================

if (
    "webkitSpeechRecognition" in window ||
    "SpeechRecognition" in window
) {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    recognition =
        new SpeechRecognition();

    recognition.continuous =
        false;

    recognition.lang =
        "en-US";

    recognition.onstart = () => {

        micBtn.classList.add(
            "listening"
        );

        userInput.placeholder =
            "Listening...";
    };

    recognition.onend = () => {

        micBtn.classList.remove(
            "listening"
        );

        userInput.placeholder =
            "Ask Tanmay AI...";
    };

    recognition.onresult =
        event => {

            userInput.value =
                event.results[0][0]
                    .transcript;

            sendMessage();
        };
}

micBtn.addEventListener(
    "click",
    () => {

        if (recognition) {

            try {
                recognition.start();
            } catch {}
        }
    }
);

// =====================================================
// VOICE OUTPUT
// =====================================================

toggleVoiceBtn.addEventListener(
    "click",
    () => {

        isVoiceEnabled =
            !isVoiceEnabled;

        toggleVoiceBtn.innerHTML =
            isVoiceEnabled
                ? '<i class="fa-solid fa-volume-high"></i>'
                : '<i class="fa-solid fa-volume-xmark"></i>';

        if (!isVoiceEnabled) {

            window.speechSynthesis.cancel();

            resetSpeakingButtons();
        }
    }
);

window.speakIndividualMessage =
    function(buttonElement) {

        const messageText =
            buttonElement
                .parentNode
                .querySelector(
                    ".message-text"
                )
                .innerText;

        if (
            currentSpeakingButton ===
                buttonElement &&
            window.speechSynthesis.speaking
        ) {

            window.speechSynthesis.cancel();

            resetSpeakingButtons();

            return;
        }

        window.speechSynthesis.cancel();

        resetSpeakingButtons();

        buttonElement.innerHTML =
            '<i class="fa-solid fa-stop"></i>';

        buttonElement.classList.add(
            "speaking-now"
        );

        currentSpeakingButton =
            buttonElement;

        const utterance =
            new SpeechSynthesisUtterance(
                messageText
            );

        utterance.lang =
            "en-US";

        utterance.onend =
            resetSpeakingButtons;

        utterance.onerror =
            resetSpeakingButtons;

        window.speechSynthesis.speak(
            utterance
        );
    };

function resetSpeakingButtons() {

    document
        .querySelectorAll(
            ".msg-speak-btn"
        )
        .forEach(btn => {

            btn.innerHTML =
                '<i class="fa-solid fa-volume-high"></i>';

            btn.classList.remove(
                "speaking-now"
            );
        });

    currentSpeakingButton =
        null;
}

// =====================================================
// USER MESSAGE
// =====================================================

function appendUserMessage(text) {

    const msgDiv =
        document.createElement(
            "div"
        );

    msgDiv.classList.add(
        "message",
        "user-message"
    );

    msgDiv.innerText =
        text;

    messagesContainer.appendChild(
        msgDiv
    );

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;
}

// =====================================================
// AI MESSAGE
// =====================================================

function appendAIMessage(
    text,
    shouldSpeak = false,
    questionText = ""
) {

    const msgDiv =
        document.createElement(
            "div"
        );

    msgDiv.classList.add(
        "message",
        "ai-message"
    );

    const textDiv =
        document.createElement(
            "div"
        );

    textDiv.classList.add(
        "message-text"
    );

    textDiv.innerText =
        text;

    const speakBtn =
        document.createElement(
            "button"
        );

    speakBtn.classList.add(
        "msg-speak-btn"
    );

    speakBtn.innerHTML =
        '<i class="fa-solid fa-volume-high"></i>';

    speakBtn.onclick =
        function () {
            speakIndividualMessage(
                this
            );
        };

    msgDiv.appendChild(
        textDiv
    );

    msgDiv.appendChild(
        speakBtn
    );

    // =================================================
    // ADMIN ONLY CONTROLS
    // =================================================

    if (isCurrentUserAdmin()) {

        const controls =
            document.createElement(
                "div"
            );

        controls.classList.add(
            "admin-ai-controls"
        );

        const editBtn =
            document.createElement(
                "button"
            );

        editBtn.className =
            "admin-edit-answer-btn";

        editBtn.innerHTML =
            "✏️ Edit";

        editBtn.title =
            "Correct this AI answer and save it globally";

        editBtn.onclick =
            () => {

                openEditGlobalAnswer(
                    questionText,
                    text
                );
            };

        controls.appendChild(
            editBtn
        );

        msgDiv.appendChild(
            controls
        );
    }

    messagesContainer.appendChild(
        msgDiv
    );

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;

    if (
        isVoiceEnabled &&
        shouldSpeak &&
        !isInitialLoadRunning
    ) {

        window.speakIndividualMessage(
            speakBtn
        );
    }
}

// =====================================================
// ADMIN CONTROL PANEL
// =====================================================

function createAdminControls() {

    if (!isCurrentUserAdmin()) {
        return;
    }

    if (
        document.getElementById(
            "tanmay-admin-panel"
        )
    ) {
        return;
    }

    const panel =
        document.createElement(
            "div"
        );

    panel.id =
        "tanmay-admin-panel";

    panel.innerHTML = `
        <div class="tanmay-admin-title">
            👑 Admin
        </div>

        <button
            id="add-global-memory-btn"
            class="tanmay-admin-button"
        >
            ➕ Add Global
        </button>

        <button
            id="manage-global-memory-btn"
            class="tanmay-admin-button"
        >
            🧠 Global Memory
        </button>
    `;

    sidebar.prepend(
        panel
    );

    document
        .getElementById(
            "add-global-memory-btn"
        )
        .onclick =
        openAddGlobalMemory;

    document
        .getElementById(
            "manage-global-memory-btn"
        )
        .onclick =
        openGlobalMemoryManager;
}

// =====================================================
// ADD GLOBAL
// =====================================================

function openAddGlobalMemory() {

    if (!isCurrentUserAdmin()) {
        return;
    }

    const information =
        prompt(
            "Global Knowledge mein kya add karna hai?\n\nExample:\nTanmay ke mama Manesh Sahu hain."
        );

    if (
        information === null ||
        !information.trim()
    ) {
        return;
    }

    addGlobalInformation(
        information.trim()
    );
}

async function addGlobalInformation(
    information
) {

    if (!isCurrentUserAdmin()) {
        alert(
            "Only Admin can add Global Knowledge."
        );

        return;
    }

    try {

        await addDoc(
            collection(
                db,
                "global_rules"
            ),
            {
                rule:
                    information,

                addedBy:
                    currentUser.email,

                timestamp:
                    Date.now()
            }
        );

        await loadAllMemories();

        alert(
            "✅ Global information save ho gayi."
        );

    } catch (error) {

        console.error(
            error
        );

        alert(
            "Global information save nahi ho saki."
        );
    }
}

// =====================================================
// EDIT AI ANSWER -> GLOBAL
// =====================================================

function openEditGlobalAnswer(
    question,
    oldAnswer
) {

    if (!isCurrentUserAdmin()) {
        return;
    }

    const editedAnswer =
        prompt(
            "AI ke jawab ko correct karo.\n\nQuestion:\n" +
            question +
            "\n\nCorrect answer:",
            oldAnswer
        );

    if (
        editedAnswer === null ||
        !editedAnswer.trim()
    ) {
        return;
    }

    const globalKnowledge =
        `Question: ${question}\nCorrect information/answer: ${editedAnswer.trim()}`;

    addGlobalInformation(
        globalKnowledge
    );
}

// =====================================================
// GLOBAL MEMORY MANAGER
// =====================================================

async function openGlobalMemoryManager() {

    if (!isCurrentUserAdmin()) {
        return;
    }

    await loadAllMemories();

    const overlay =
        document.createElement(
            "div"
        );

    overlay.className =
        "tanmay-memory-overlay";

    const box =
        document.createElement(
            "div"
        );

    box.className =
        "tanmay-memory-box";

    box.innerHTML = `
        <div class="tanmay-memory-header">
            <strong>🧠 Global Knowledge</strong>

            <button
                class="tanmay-close-memory"
            >
                ✕
            </button>
        </div>

        <div
            class="tanmay-memory-list"
            id="tanmay-global-memory-list"
        ></div>
    `;

    overlay.appendChild(
        box
    );

    document.body.appendChild(
        overlay
    );

    const list =
        document.getElementById(
            "tanmay-global-memory-list"
        );

    if (!globalRulesDocs.length) {

        list.innerHTML =
            `<div class="tanmay-empty-memory">
                Abhi koi Global Knowledge nahi hai.
            </div>`;

    } else {

        globalRulesDocs.forEach(
            item => {

                const row =
                    document.createElement(
                        "div"
                    );

                row.className =
                    "tanmay-memory-row";

                const text =
                    document.createElement(
                        "div"
                    );

                text.className =
                    "tanmay-memory-text";

                text.innerText =
                    item.rule;

                const buttons =
                    document.createElement(
                        "div"
                    );

                buttons.className =
                    "tanmay-memory-buttons";

                const editBtn =
                    document.createElement(
                        "button"
                    );

                editBtn.innerText =
                    "✏️ Edit";

                editBtn.onclick =
                    async () => {

                        const newValue =
                            prompt(
                                "Global information edit karo:",
                                item.rule
                            );

                        if (
                            newValue === null ||
                            !newValue.trim()
                        ) {
                            return;
                        }

                        try {

                            await updateDoc(
                                doc(
                                    db,
                                    "global_rules",
                                    item.id
                                ),
                                {
                                    rule:
                                        newValue.trim(),

                                    updatedBy:
                                        currentUser.email,

                                    updatedAt:
                                        Date.now()
                                }
                            );

                            await loadAllMemories();

                            row.remove();

                        } catch (error) {

                            console.error(
                                error
                            );

                            alert(
                                "Edit save nahi hua."
                            );
                        }
                    };

                const deleteBtn =
                    document.createElement(
                        "button"
                    );

                deleteBtn.innerText =
                    "🗑️ Delete";

                deleteBtn.onclick =
                    async () => {

                        if (
                            !confirm(
                                "Is Global information ko delete karna hai?"
                            )
                        ) {
                            return;
                        }

                        try {

                            await deleteDoc(
                                doc(
                                    db,
                                    "global_rules",
                                    item.id
                                )
                            );

                            await loadAllMemories();

                            row.remove();

                        } catch (error) {

                            console.error(
                                error
                            );

                            alert(
                                "Delete nahi hua."
                            );
                        }
                    };

                buttons.appendChild(
                    editBtn
                );

                buttons.appendChild(
                    deleteBtn
                );

                row.appendChild(
                    text
                );

                row.appendChild(
                    buttons
                );

                list.appendChild(
                    row
                );
            }
        );
    }

    box.querySelector(
        ".tanmay-close-memory"
    ).onclick =
        () => overlay.remove();

    overlay.onclick =
        event => {

            if (
                event.target === overlay
            ) {
                overlay.remove();
            }
        };
}

// =====================================================
// PERSONAL MEMORY
// =====================================================

async function savePersonalMemory(
    content
) {

    if (!currentUser) {
        return;
    }

    await addDoc(
        collection(
            db,
            `users_memory/${currentUser.uid}/memories`
        ),
        {
            memory:
                content,

            timestamp:
                Date.now()
        }
    );

    userPersonalMemoryCache.push(
        content
    );
}

// =====================================================
// SEND MESSAGE
// =====================================================

async function sendMessage() {

    const text =
        userInput.value.trim();

    if (!text) {
        return;
    }

    if (!currentUser) {
        alert(
            "Pehle login karo."
        );

        return;
    }

    if (!currentChatId) {

        currentChatId =
            "chat_" + Date.now();

        localStorage.setItem(
            "activeChatId",
            currentChatId
        );
    }

    appendUserMessage(
        text
    );

    userInput.value =
        "";

    chatHistoryContext.push({
        role: "user",
        content: text
    });

    const userEmail =
        currentUser.email ||
        "No Email";

    const userName =
        currentUser.displayName ||
        currentUser.email?.split("@")[0] ||
        "User";

    // =================================================
    // NORMAL USER PERSONAL MEMORY
    // =================================================

    const memoryTriggerRegex =
        /^(remember:|remember that|save:|save that|note:|rule:|yaad rakho:|yaad rakhna:|suno:|sun:)\s*(.*)/i;

    const match =
        text.match(
            memoryTriggerRegex
        );

    if (
        match &&
        match[2]
    ) {

        const learnedContent =
            match[2].trim();

        // -----------------------------------------------
        // ADMIN
        // -----------------------------------------------

        if (
            isCurrentUserAdmin()
        ) {

            const choice =
                confirm(
                    "Is information ko Global banana hai?\n\nOK = Global\nCancel = Sirf meri Personal Memory"
                );

            if (choice) {

                await addGlobalInformation(
                    learnedContent
                );

                const msg =
                    "✅ Ye information Global Knowledge mein save ho gayi. Ab relevant questions par sab users ke AI ko ye information milegi.";

                chatHistoryContext.push({
                    role: "assistant",
                    content: msg
                });

                appendAIMessage(
                    msg,
                    true,
                    text
                );

                await saveMessageToFirebase(
                    currentChatId,
                    text,
                    msg
                );

                return;

            } else {

                await savePersonalMemory(
                    learnedContent
                );

                const msg =
                    "✅ Ye information sirf tumhari Personal Memory mein save ho gayi.";

                chatHistoryContext.push({
                    role: "assistant",
                    content: msg
                });

                appendAIMessage(
                    msg,
                    true,
                    text
                );

                await saveMessageToFirebase(
                    currentChatId,
                    text,
                    msg
                );

                return;
            }
        }

        // -----------------------------------------------
        // NORMAL USER
        // ONLY PERSONAL
        // -----------------------------------------------

        await savePersonalMemory(
            learnedContent
        );

        const msg =
            "✅ Theek hai, maine ise tumhari personal memory mein yaad rakh liya.";

        chatHistoryContext.push({
            role: "assistant",
            content: msg
        });

        appendAIMessage(
            msg,
            true,
            text
        );

        await saveMessageToFirebase(
            currentChatId,
            text,
            msg
        );

        return;
    }

    // =================================================
    // AI REQUEST
    // =================================================

    const trimmedContext =
        chatHistoryContext.slice(-8);

    const loadingDiv =
        document.createElement(
            "div"
        );

    loadingDiv.classList.add(
        "message",
        "ai-message"
    );

    loadingDiv.innerText =
        "Tanmay AI is thinking...";

    messagesContainer.appendChild(
        loadingDiv
    );

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;

    try {

        const response =
            await fetch(
                "https://tanmayai-11j5.onrender.com/api/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            messages:
                                trimmedContext,

                            userName:
                                userName,

                            userEmail:
                                userEmail,

                            globalRules:
                                globalRulesCache,

                            personalMemory:
                                userPersonalMemoryCache
                        })
                }
            );

        const data =
            await response.json();

        if (
            messagesContainer.contains(
                loadingDiv
            )
        ) {

            messagesContainer.removeChild(
                loadingDiv
            );
        }

        if (
            response.ok &&
            data.reply
        ) {

            const aiResponse =
                data.reply;

            lastQuestionForEdit =
                text;

            lastAIResponseForEdit =
                aiResponse;

            chatHistoryContext.push({
                role: "assistant",
                content:
                    aiResponse
            });

            appendAIMessage(
                aiResponse,
                true,
                text
            );

            // -----------------------------------------
            // MODEL NAME: ADMIN ONLY
            // -----------------------------------------

            if (
                isCurrentUserAdmin() &&
                data.showModel &&
                data.provider &&
                data.model
            ) {

                const modelInfo =
                    document.createElement(
                        "div"
                    );

                modelInfo.className =
                    "admin-model-info";

                modelInfo.innerText =
                    `🤖 ${data.provider} • ${data.model}`;

                messagesContainer.appendChild(
                    modelInfo
                );
            }

            await saveMessageToFirebase(
                currentChatId,
                text,
                aiResponse
            );

        } else {

            appendAIMessage(
                data.reply ||
                "Abhi AI ka proper response nahi aaya.",
                true,
                text
            );
        }

    } catch (error) {

        console.error(
            "Tanmay AI Error:",
            error
        );

        if (
            messagesContainer.contains(
                loadingDiv
            )
        ) {

            messagesContainer.removeChild(
                loadingDiv
            );
        }

        appendAIMessage(
            "Bhai, abhi server se connection nahi ho pa raha. Thodi der baad try karo.",
            true,
            text
        );
    }
}

sendBtn.addEventListener(
    "click",
    sendMessage
);

userInput.addEventListener(
    "keypress",
    e => {

        if (e.key === "Enter") {
            sendMessage();
        }
    }
);

// =====================================================
// SAVE CHAT
// =====================================================

async function saveMessageToFirebase(
    chatId,
    userText,
    aiText
) {

    if (!currentUser) {
        return;
    }

    try {

        const calculatedName =
            currentUser.displayName ||
            currentUser.email?.split("@")[0] ||
            "User";

        await addDoc(
            collection(
                db,
                "chat_messages"
            ),
            {

                uid:
                    currentUser.uid,

                userName:
                    calculatedName,

                userEmail:
                    currentUser.email ||
                    "No Email",

                userPhoto:
                    currentUser.photoURL ||
                    "",

                chatId:
                    chatId,

                userText:
                    userText,

                aiText:
                    aiText,

                timestamp:
                    Date.now()
            }
        );

        loadAllSidebarTopics(
            false
        );

    } catch (error) {

        console.error(
            "Firebase Save Error:",
            error
        );
    }
}

// =====================================================
// SIDEBAR TOPICS
// =====================================================

async function loadAllSidebarTopics(
    isInitialLoad = false
) {

    if (!currentUser) {
        return;
    }

    try {

        historyList.innerHTML =
            "";

        const chatIdsInOrder =
            [];

        const seenChatIds =
            new Set();

        const q =
            query(
                collection(
                    db,
                    "chat_messages"
                ),
                orderBy(
                    "timestamp",
                    "desc"
                )
            );

        const snap =
            await getDocs(q);

        snap.forEach(
            docSnap => {

                const data =
                    docSnap.data();

                if (
                    data.uid ===
                        currentUser.uid &&
                    !seenChatIds.has(
                        data.chatId
                    )
                ) {

                    seenChatIds.add(
                        data.chatId
                    );

                    chatIdsInOrder.push({
                        chatId:
                            data.chatId,

                        userText:
                            data.userText,

                        timestamp:
                            data.timestamp
                    });
                }
            }
        );

        chatIdsInOrder.sort(
            (a, b) =>
                b.timestamp -
                a.timestamp
        );

        chatIdsInOrder.forEach(
            item => {

                addTopicToSidebarUI(
                    item.userText,
                    item.chatId
                );
            }
        );

        if (isInitialLoad) {

            const savedChatId =
                localStorage.getItem(
                    "activeChatId"
                );

            if (
                savedChatId &&
                seenChatIds.has(
                    savedChatId
                )
            ) {

                currentChatId =
                    savedChatId;

                await loadFullChatSession(
                    currentChatId
                );

                isInitialLoadRunning =
                    false;

            } else {

                startNewChatSession();

                isInitialLoadRunning =
                    false;
            }
        }

    } catch (error) {

        console.error(
            "Sidebar error:",
            error
        );

        isInitialLoadRunning =
            false;
    }
}

// =====================================================
// SIDEBAR ITEM
// =====================================================

function addTopicToSidebarUI(
    firstQuestion,
    chatId
) {

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.classList.add(
        "history-item-wrapper"
    );

    if (
        chatId === currentChatId
    ) {

        wrapper.classList.add(
            "active-chat-topic"
        );
    }

    const textSpan =
        document.createElement(
            "span"
        );

    textSpan.classList.add(
        "history-text"
    );

    textSpan.innerText =
        firstQuestion.length > 18
            ? firstQuestion.substring(
                0,
                18
            ) + "..."
            : firstQuestion;

    textSpan.onclick =
        () => {

            currentChatId =
                chatId;

            localStorage.setItem(
                "activeChatId",
                chatId
            );

            document
                .querySelectorAll(
                    ".history-item-wrapper"
                )
                .forEach(
                    el =>
                        el.classList.remove(
                            "active-chat-topic"
                        )
                );

            wrapper.classList.add(
                "active-chat-topic"
            );

            loadFullChatSession(
                chatId
            );
        };

    const deleteBtn =
        document.createElement(
            "button"
        );

    deleteBtn.classList.add(
        "delete-item-btn"
    );

    deleteBtn.innerHTML =
        '<i class="fa-solid fa-trash-can"></i>';

    deleteBtn.onclick =
        async e => {

            e.stopPropagation();

            if (
                !confirm(
                    "Do you want to delete this chat?"
                )
            ) {
                return;
            }

            const q =
                query(
                    collection(
                        db,
                        "chat_messages"
                    ),
                    where(
                        "chatId",
                        "==",
                        chatId
                    )
                );

            const snap =
                await getDocs(q);

            for (
                const docSnap of
                snap.docs
            ) {

                if (
                    docSnap.data().uid ===
                    currentUser.uid
                ) {

                    await deleteDoc(
                        doc(
                            db,
                            "chat_messages",
                            docSnap.id
                        )
                    );
                }
            }

            if (
                currentChatId ===
                chatId
            ) {

                localStorage.removeItem(
                    "activeChatId"
                );

                startNewChatSession();
            }

            loadAllSidebarTopics(
                false
            );
        };

    wrapper.appendChild(
        textSpan
    );

    wrapper.appendChild(
        deleteBtn
    );

    historyList.appendChild(
        wrapper
    );
}

// =====================================================
// LOAD CHAT
// =====================================================

async function loadFullChatSession(
    chatId
) {

    messagesContainer.innerHTML =
        "";

    chatHistoryContext = [];

    try {

        const q =
            query(
                collection(
                    db,
                    "chat_messages"
                ),
                where(
                    "chatId",
                    "==",
                    chatId
                )
            );

        const snapshot =
            await getDocs(q);

        const localMessages =
            [];

        snapshot.forEach(
            docSnap => {

                const data =
                    docSnap.data();

                if (
                    data.uid ===
                    currentUser.uid
                ) {

                    localMessages.push(
                        data
                    );
                }
            }
        );

        localMessages.sort(
            (a, b) =>
                a.timestamp -
                b.timestamp
        );

        for (
            const data of
            localMessages
        ) {

            appendUserMessage(
                data.userText
            );

            chatHistoryContext.push({
                role: "user",
                content:
                    data.userText
            });

            appendAIMessage(
                data.aiText,
                false,
                data.userText
            );

            chatHistoryContext.push({
                role: "assistant",
                content:
                    data.aiText
            });
        }

        messagesContainer.scrollTop =
            messagesContainer.scrollHeight;

    } catch (error) {

        console.error(
            "Session error:",
            error
        );
    }
}

// =====================================================
// CLEAR HISTORY
// =====================================================

clearHistoryBtn.addEventListener(
    "click",
    async () => {

        if (!currentUser) {
            return;
        }

        if (
            !confirm(
                "Are you sure you want to clear all chat history?"
            )
        ) {
            return;
        }

        const q =
            query(
                collection(
                    db,
                    "chat_messages"
                )
            );

        const snap =
            await getDocs(q);

        for (
            const d of
            snap.docs
        ) {

            if (
                d.data().uid ===
                currentUser.uid
            ) {

                await deleteDoc(
                    doc(
                        db,
                        "chat_messages",
                        d.id
                    )
                );
            }
        }

        localStorage.removeItem(
            "activeChatId"
        );

        startNewChatSession();

        historyList.innerHTML =
            "";
    }
);

// =====================================================
// SIDEBAR AUTO CLOSE
// =====================================================

chatArea.addEventListener(
    "click",
    () => {

        if (
            !sidebar.classList.contains(
                "collapsed"
            )
        ) {

            sidebar.classList.add(
                "collapsed"
            );
        }
    }
);

userInput.addEventListener(
    "click",
    e => {

        e.stopPropagation();

        if (
            !sidebar.classList.contains(
                "collapsed"
            )
        ) {

            sidebar.classList.add(
                "collapsed"
            );
        }
    }
);

// =====================================================
// ADMIN UI CSS
// =====================================================

const adminStyle =
    document.createElement(
        "style"
    );

adminStyle.innerHTML = `

.admin-model-info {
    font-size: 11px;
    opacity: 0.65;
    margin: 3px 0 12px 12px;
    font-family: monospace;
}

.admin-ai-controls {
    display: flex;
    gap: 6px;
    margin-top: 8px;
}

.admin-edit-answer-btn {
    border: none;
    border-radius: 8px;
    padding: 5px 9px;
    cursor: pointer;
    font-size: 12px;
    background: rgba(100,100,100,.12);
}

.admin-edit-answer-btn:hover {
    opacity: .75;
}

#tanmay-admin-panel {
    padding: 8px;
    margin-bottom: 8px;
}

.tanmay-admin-title {
    font-weight: 700;
    margin-bottom: 7px;
}

.tanmay-admin-button {
    width: 100%;
    border: none;
    border-radius: 9px;
    padding: 8px;
    margin-bottom: 6px;
    cursor: pointer;
}

.tanmay-memory-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.55);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 99999;
    padding: 18px;
}

.tanmay-memory-box {
    width: min(650px, 100%);
    max-height: 85vh;
    overflow: auto;
    border-radius: 16px;
    padding: 16px;
    background: var(--background, #fff);
}

.tanmay-memory-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.tanmay-close-memory {
    border: none;
    background: transparent;
    font-size: 20px;
    cursor: pointer;
}

.tanmay-memory-row {
    border: 1px solid rgba(128,128,128,.25);
    border-radius: 12px;
    padding: 10px;
    margin-bottom: 9px;
}

.tanmay-memory-text {
    white-space: pre-wrap;
    word-break: break-word;
    margin-bottom: 8px;
}

.tanmay-memory-buttons {
    display: flex;
    gap: 7px;
}

.tanmay-memory-buttons button {
    border: none;
    border-radius: 8px;
    padding: 6px 9px;
    cursor: pointer;
}

.tanmay-empty-memory {
    opacity: .7;
    padding: 20px;
    text-align: center;
}

`;

document.head.appendChild(
    adminStyle
);