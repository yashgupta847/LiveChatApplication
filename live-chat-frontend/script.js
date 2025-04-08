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
    
    // Always allow joining any room, no checking required
    if (currentChatId) {
        socket.emit('leave-room', currentChatId);
    }
    
    // Join new room
    currentChatId = chatId;
    document.getElementById('yourChatId').textContent = chatId;
    socket.emit('join-room', chatId);
    addMessageToUI(`Joined chat room: ${chatId}`);
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

// Set up socket event listeners
function setupSocketListeners() {
    socket.on('user-joined', (data) => {
        console.log("User joined event received:", data);
        addMessageToUI('A user joined the chat');
        
        // Show popup notification
        showAlert('A user has connected to your chat!', 'success');
    });

    socket.on('user-left', (data) => {
        console.log("User left event received:", data);
        addMessageToUI('A user left the chat');
    });

    socket.on('receive-message', (data) => {
        console.log("Message received:", data);
        addMessageToUI(data.message, false);
    });
}

// Send message
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !currentChatId) return;

    console.log("Sending message to room:", currentChatId);
    socket.emit('send-message', {
        message,
        roomId: currentChatId
    });

    addMessageToUI(message, true);
    messageInput.value = '';
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
messageInput.addEventListener('keypress', (e) => {
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

// Add event listeners after the page loads
window.addEventListener('load', function() {
    // Make sure we're connected to socket.io
    if (!socket.connected) {
        socket.connect();
    }
});
