let socket = io(); // This will automatically connect to the host server
let currentChatId = null;
let username = null;

// DOM elements
const typingStatus = document.getElementById("typingStatus");
const messageInput = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const onlineUsersList = document.getElementById("onlineUsers");

let typingTimeout;

// Generate a random chat ID
function generateChatId() {
    const chatId = Math.random().toString(36).substring(2, 8).toUpperCase();
    document.getElementById('yourChatId').textContent = chatId;
    currentChatId = chatId;
    
    // Join the chat room with the generated ID
    socket.emit('join-room', chatId);
    
    // Set up socket event listeners
    setupSocketListeners();
}

// Copy chat ID to clipboard
function copyChatId() {
    const chatId = document.getElementById('yourChatId').textContent;
    navigator.clipboard.writeText(chatId).then(() => {
        alert('Chat ID copied to clipboard!');
    });
}

// Join a chat using a chat ID
function joinChat() {
    const chatId = document.getElementById('chatIdInput').value.trim().toUpperCase();
    
    if (!chatId) {
        showAlert('Please enter a chat ID');
        return;
    }
    
    // Check if the entered ID exists in active rooms
    socket.emit('check-room-exists', chatId, (exists) => {
        if (exists) {
            // Valid room ID, proceed to join
            if (currentChatId) {
                socket.emit('leave-room', currentChatId);
            }
            
            // Join new room
            currentChatId = chatId;
            socket.emit('join-room', chatId);
            
            // Update UI
            document.getElementById('yourChatId').textContent = chatId;
            addMessageToUI(`Joined chat room: ${chatId}`);
        } else {
            // Invalid room ID
            showAlert('Invalid meeting ID. Please enter a valid ID.');
        }
    });
}

// Show an alert message
function showAlert(message) {
    const alertBox = document.createElement('div');
    alertBox.className = 'alert-box';
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

// Set up socket event listeners
function setupSocketListeners() {
    socket.on('user-joined', (data) => {
        addMessageToUI('A user joined the chat');
    });

    socket.on('user-left', (data) => {
        addMessageToUI('A user left the chat');
    });

    socket.on('receive-message', (data) => {
        addMessageToUI(data.message, false);
    });
}

// Send message
function sendMessage() {
    const message = document.getElementById('messageInput').value.trim();
    if (!message || !currentChatId) return;

    socket.emit('send-message', {
        message,
        roomId: currentChatId
    });

    addMessageToUI(message, true);
    document.getElementById('messageInput').value = '';
}

// Add message to UI
function addMessageToUI(message, isOwnMessage = false) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isOwnMessage ? 'own-message' : 'other-message'}`;
    messageElement.textContent = message;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Handle Enter key in message input
document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// ⌨️ Handle typing
messageInput.addEventListener("input", () => {
  socket.emit("typing", username);

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("stop_typing", username);
  }, 1000); // 1s idle = stop typing
});

// 🎧 Socket events
socket.on("receive_message", (data) => {
  const messageElement = document.createElement("div");
  const time = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
  messageElement.textContent = `[${data.user} • ${time}]: ${data.message}`;
  messages.appendChild(messageElement);
  messages.scrollTop = messages.scrollHeight;
});

socket.on("typing", (name) => {
  if (name !== username) {
    typingStatus.textContent = `${name} is typing...`;
  }
});

socket.on("stop_typing", (name) => {
  if (name !== username) {
    typingStatus.textContent = "";
  }
});

socket.on("user_joined", (name) => {
  const info = document.createElement("div");
  info.textContent = `🔔 ${name} joined the chat`;
  info.style.fontStyle = "italic";
  info.style.color = "lightgray";
  messages.appendChild(info);
  messages.scrollTop = messages.scrollHeight;
});

socket.on("user_left", (name) => {
  const info = document.createElement("div");
  info.textContent = `❌ ${name} left the chat`;
  info.style.fontStyle = "italic";
  info.style.color = "lightgray";
  messages.appendChild(info);
  messages.scrollTop = messages.scrollHeight;
});

// 🟢 Online Users List
socket.on("online_users", (usernames) => {
  onlineUsersList.innerHTML = "";
  usernames.forEach((name) => {
    const li = document.createElement("li");
    li.textContent = `🟢 ${name}`;
    onlineUsersList.appendChild(li);
  });
});

socket.on("update_users", (usernames) => {
  onlineUsersList.innerHTML = "";
  usernames.forEach((name) => {
    const li = document.createElement("li");
    li.textContent = `🟢 ${name}`;
    onlineUsersList.appendChild(li);
  });
});
