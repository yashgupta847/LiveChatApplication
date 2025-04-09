// Check WebSocket availability
let isWebSocketAvailable = false;
try {
    const ws = new WebSocket('wss://echo.websocket.org');
    ws.onopen = () => {
        isWebSocketAvailable = true;
        ws.close();
    };
    ws.onerror = () => {
        isWebSocketAvailable = false;
    };
} catch (e) {
    isWebSocketAvailable = false;
}

// Initialize socket with basic configuration
const socket = io({
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

// DOM Elements
const messageInput = document.getElementById("messageInput");
const messagesDiv = document.getElementById("messages");
const onlineUsersList = document.getElementById("onlineUsers");
const typingStatus = document.getElementById("typingStatus");
let currentUsername = "";
let currentRoomId = "";

// Connection status
socket.on("connect", () => {
    console.log("✅ Connected to server");
    showAlert("Connected to server", "success");
    // Clear any previous error messages
    const errorAlerts = document.querySelectorAll('.alert-error');
    errorAlerts.forEach(alert => alert.remove());
});

socket.on("disconnect", () => {
    console.log("❌ Disconnected from server");
    showAlert("Disconnected from server", "error");
});

socket.on("connect_error", (error) => {
    console.error("Connection error:", error);
    showAlert("Connection error: " + error.message, "error");
});

// Handle room history
socket.on("room-history", (messages) => {
    messages.forEach(msg => displayMessage(msg));
});

// Handle incoming messages
socket.on("receive-message", (data) => {
    displayMessage(data);
    // Scroll to bottom
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

// Handle online users updates
socket.on("online_users", (users) => {
    updateOnlineUsers(users);
});

// Handle typing indicators
socket.on("typing", (data) => {
    typingStatus.textContent = `${data.username} is typing...`;
    typingStatus.style.display = "block";
});

socket.on("stop_typing", () => {
    typingStatus.style.display = "none";
});

// Generate random chat ID
function generateChatId() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Ask for username
function askUsername() {
    const username = prompt("Please enter your name:");
    if (username) {
        currentUsername = username;
        const chatId = generateChatId();
        currentRoomId = chatId;
        document.getElementById("chatId").textContent = chatId;
        showAlert("Your chat ID: " + chatId, "info");
    } else {
        askUsername();
    }
}

// Join chat room
function joinChat() {
    const chatId = document.getElementById("joinChatId").value.toUpperCase();
    if (chatId) {
        socket.emit("join-room", {
            roomId: chatId,
            username: currentUsername
        });
        currentRoomId = chatId;
        showAlert("Joined chat room: " + chatId, "success");
    } else {
        showAlert("Please enter a chat ID", "error");
    }
}

// Send message
function sendMessage() {
    const message = messageInput.value.trim();
    if (message && currentRoomId) {
        const messageData = {
            message,
            roomId: currentRoomId,
            username: currentUsername,
            time: new Date().toLocaleTimeString()
        };
        socket.emit("send-message", messageData);
        messageInput.value = "";
    }
}

// Display message in chat
function displayMessage(data) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${data.type === "system" ? "system" : data.username === currentUsername ? "sent" : "received"}`;
    
    const messageContent = document.createElement("div");
    messageContent.className = "message-content";
    
    if (data.type !== "system") {
        const usernameSpan = document.createElement("span");
        usernameSpan.className = "message-username";
        usernameSpan.textContent = data.username;
        messageContent.appendChild(usernameSpan);
    }
    
    const messageText = document.createElement("p");
    messageText.className = "message-text";
    messageText.textContent = data.message;
    messageContent.appendChild(messageText);
    
    const timeSpan = document.createElement("span");
    timeSpan.className = "message-time";
    timeSpan.textContent = data.time;
    messageContent.appendChild(timeSpan);
    
    messageDiv.appendChild(messageContent);
    messagesDiv.appendChild(messageDiv);
}

// Update online users list
function updateOnlineUsers(users) {
    onlineUsersList.innerHTML = "";
    users.forEach(user => {
        const li = document.createElement("li");
        li.textContent = user;
        onlineUsersList.appendChild(li);
    });
}

// Show alert
function showAlert(message, type = "info") {
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

// Handle typing indicator
let typingTimeout;
messageInput.addEventListener("input", () => {
    if (currentRoomId) {
        socket.emit("typing", {
            roomId: currentRoomId,
            username: currentUsername
        });
        
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit("stop_typing", {
                roomId: currentRoomId,
                username: currentUsername
            });
        }, 1000);
    }
});

// Handle enter key for sending messages
messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        sendMessage();
    }
});

// Copy chat ID to clipboard
function copyChatId() {
    const chatId = document.getElementById("chatId").textContent;
    navigator.clipboard.writeText(chatId).then(() => {
        showAlert("Chat ID copied to clipboard!", "success");
    }).catch(() => {
        showAlert("Failed to copy chat ID", "error");
    });
}
