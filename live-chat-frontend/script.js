let socket = io(); // This will automatically connect to the host server
let currentChatId = null;
let username = null;

// DOM elements
const typingStatus = document.getElementById("typingStatus");
const messageInput = document.getElementById("messageInput");
const messagesDiv = document.getElementById("messages");
const onlineUsersList = document.getElementById("onlineUsers");

let typingTimeout;

// Ask username on load
window.onload = function() {
    generateChatId();
    askUsername();
};

// Ask for username
function askUsername() {
    username = prompt("Enter your name:") || "Anonymous";
    socket.emit("set_username", { username, roomId: currentChatId });
}

// Generate a random chat ID
function generateChatId() {
    const chatId = Math.random().toString(36).substring(2, 8).toUpperCase();
    document.getElementById('yourChatId').textContent = chatId;
    currentChatId = chatId;
    
    // Join the chat room with the generated ID
    socket.emit('join-room', { roomId: chatId, username });
    console.log("Created room with ID:", chatId);
}

// Copy chat ID to clipboard
function copyChatId() {
    const chatId = document.getElementById('yourChatId').textContent;
    navigator.clipboard.writeText(chatId).then(() => {
        showAlert('Chat ID copied to clipboard!', 'success');
    });
}

// Join a chat using a chat ID
function joinChat() {
    const chatId = document.getElementById('chatIdInput').value.trim().toUpperCase();
    
    if (!chatId) {
        showAlert('Please enter a chat ID', 'error');
        return;
    }
    
    console.log("Trying to join room:", chatId);
    
    // Leave current room if exists
    if (currentChatId) {
        socket.emit('leave-room', { roomId: currentChatId });
    }
    
    // Join new room
    currentChatId = chatId;
    document.getElementById('yourChatId').textContent = chatId;
    socket.emit('join-room', { roomId: chatId, username });
    addSystemMessage(`You joined chat room: ${chatId}`);
}

// Show an alert message
function showAlert(message, type = 'info') {
    const alertBox = document.createElement('div');
    alertBox.className = `alert-box ${type}`;
    alertBox.textContent = message;
    
    document.body.appendChild(alertBox);
    
    // Remove after 3 seconds
    setTimeout(() => {
        alertBox.classList.add('fade-out');
        setTimeout(() => {
            document.body.removeChild(alertBox);
        }, 500);
    }, 3000);
}

// Send message
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !currentChatId) return;

    console.log("Sending message to room:", currentChatId);
    
    const messageData = {
        message,
        roomId: currentChatId,
        username,
        time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        })
    };
    
    socket.emit('send-message', messageData);

    // Add own message to UI
    addMessageToUI(message, true, username, messageData.time);
    messageInput.value = '';
}

// Add message to UI
function addMessageToUI(message, isOwnMessage = false, user = 'Unknown', time = '') {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isOwnMessage ? 'own-message' : 'other-message'}`;
    
    const timeDisplay = time || new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
    
    messageElement.innerHTML = `
        <span class="message-sender">${isOwnMessage ? 'You' : user}</span>
        <span class="message-content">${message}</span>
        <span class="message-time">${timeDisplay}</span>
    `;
    
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Add system message to UI
function addSystemMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'system-message';
    messageElement.textContent = message;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Handle typing
messageInput.addEventListener("input", () => {
    if (currentChatId) {
        socket.emit("typing", { username, roomId: currentChatId });

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit("stop_typing", { username, roomId: currentChatId });
        }, 1000); // 1s idle = stop typing
    }
});

// Handle Enter key in message input
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Set up socket event listeners
socket.on('user-joined', (data) => {
    console.log("User joined event received:", data);
    addSystemMessage(`${data.username || 'A user'} joined the chat`);
    updateOnlineUsers(data.users);
    
    // Show popup notification
    showAlert(`${data.username || 'A user'} has connected to your chat!`, 'success');
});

socket.on('user-left', (data) => {
    console.log("User left event received:", data);
    addSystemMessage(`${data.username || 'A user'} left the chat`);
    updateOnlineUsers(data.users);
});

socket.on('receive-message', (data) => {
    console.log("Message received:", data);
    addMessageToUI(data.message, false, data.username, data.time);
});

socket.on('typing', (data) => {
    if (data.username !== username) {
        typingStatus.textContent = `${data.username} is typing...`;
    }
});

socket.on('stop_typing', (data) => {
    if (data.username !== username) {
        typingStatus.textContent = "";
    }
});

socket.on('online_users', (users) => {
    updateOnlineUsers(users);
});

// Update online users list
function updateOnlineUsers(users) {
    if (!users || !Array.isArray(users)) return;
    
    onlineUsersList.innerHTML = "";
    users.forEach((user) => {
        const li = document.createElement("li");
        li.textContent = `🟢 ${user}`;
        onlineUsersList.appendChild(li);
    });
}

// Add event listeners after the page loads
window.addEventListener('load', function() {
    // Make sure we're connected to socket.io
    if (!socket.connected) {
        socket.connect();
    }
});
