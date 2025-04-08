// Check WebSocket support before DOM loads
(function checkWebSocketSupport() {
  if (!window.WebSocket) {
      console.warn("WebSockets not supported");
      window.websocketsBlocked = true;
      return;
  }

  try {
      const testSocket = new WebSocket("wss://echo.websocket.events/");
      let opened = false;

      testSocket.onopen = () => {
          opened = true;
          testSocket.close();
      };

      testSocket.onerror = () => {
          console.warn("WebSockets might be blocked");
          window.websocketsBlocked = true;
      };

      setTimeout(() => {
          if (!opened) {
              console.warn("WebSocket test timed out");
              window.websocketsBlocked = true;
          }
      }, 5000);
  } catch (e) {
      console.error("WebSocket error:", e);
      window.websocketsBlocked = true;
  }
})();

// Connect with fallback to polling
let socket = io(window.location.origin, {
  transports: ['polling', 'websocket'],
  upgrade: false
});

let username = null;
let currentChatId = null;

document.addEventListener("DOMContentLoaded", () => {
  if (window.websocketsBlocked) {
      socket.io.opts.transports = ['polling'];
  }

  socket.on("connect", () => {
      console.log("Connected:", socket.id);
      showAlert("Connected!", "success");

      if (!currentChatId) {
          generateChatId();
          askUsername();
      } else {
          socket.emit("join-room", { roomId: currentChatId, username });
      }
  });

  socket.on("connect_error", () => {
      showAlert("Connection error!", "error");
      socket.io.opts.transports = ['polling'];
  });

  socket.on("disconnect", () => {
      showAlert("Disconnected!", "error");
  });

  socket.on("reconnect", () => {
      showAlert("Reconnected!", "success");
      socket.emit("join-room", { roomId: currentChatId, username });
  });

  // Messaging logic
  socket.on("receive-message", (data) => {
      const isOwn = data.senderId === socket.id;
      addMessageToUI(data.message, isOwn, data.username, data.time);
  });

  socket.on("user-joined", (data) => {
      showAlert(`${data.username} joined`, "info");
      addSystemMessage(`${data.username} joined the room`);
      updateOnlineUsers(data.users);
  });

  socket.on("user-left", (data) => {
      addSystemMessage(`${data.username} left`);
      updateOnlineUsers(data.users);
  });

  socket.on("typing", (data) => {
      if (data.username !== username) {
          document.getElementById("typingStatus").textContent = `${data.username} is typing...`;
      }
  });

  socket.on("stop_typing", (data) => {
      if (data.username !== username) {
          document.getElementById("typingStatus").textContent = ``;
      }
  });

  socket.on("online_users", (users) => {
      updateOnlineUsers(users);
  });

  document.getElementById("messageInput").addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendMessage();
  });

  document.getElementById("messageInput").addEventListener("input", () => {
      socket.emit("typing", { username, roomId: currentChatId });
      clearTimeout(window.typingTimeout);
      window.typingTimeout = setTimeout(() => {
          socket.emit("stop_typing", { username, roomId: currentChatId });
      }, 1000);
  });
});

function askUsername() {
  username = prompt("Enter your name:") || "Anonymous";
  socket.emit("set_username", { username, roomId: currentChatId });
}

function generateChatId() {
  const id = Math.random().toString(36).substring(2, 8).toUpperCase();
  currentChatId = id;
  document.getElementById("yourChatId").textContent = id;
  socket.emit("join-room", { roomId: id, username });
  addSystemMessage(`Created room: ${id}`);
}

function joinChat() {
  const id = document.getElementById("chatIdInput").value.trim().toUpperCase();
  if (!id) return showAlert("Enter a chat ID", "error");

  if (currentChatId) {
      socket.emit("leave-room", { roomId: currentChatId });
  }

  currentChatId = id;
  document.getElementById("yourChatId").textContent = id;
  socket.emit("join-room", { roomId: id, username });
  document.getElementById("messages").innerHTML = '';
  addSystemMessage(`Joined room: ${id}`);
}

function sendMessage() {
  const input = document.getElementById("messageInput");
  const msg = input.value.trim();
  if (!msg || !currentChatId) return;

  const messageData = {
      message: msg,
      username,
      senderId: socket.id,
      roomId: currentChatId,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  };

  socket.emit("send-message", messageData);
  input.value = "";
}

function addMessageToUI(message, isOwn, user, time) {
  const div = document.createElement("div");
  div.className = isOwn ? "message own-message" : "message other-message";
  div.innerHTML = `
      <span class="message-sender">${isOwn ? "You" : user}</span>
      <span class="message-content">${message}</span>
      <span class="message-time">${time}</span>
  `;
  document.getElementById("messages").appendChild(div);
  document.getElementById("messages").scrollTop = messages.scrollHeight;
}

function addSystemMessage(msg) {
  const div = document.createElement("div");
  div.className = "system-message";
  div.textContent = msg;
  document.getElementById("messages").appendChild(div);
  document.getElementById("messages").scrollTop = messages.scrollHeight;
}

function showAlert(message, type = "info") {
  const div = document.createElement("div");
  div.className = `alert-box ${type}`;
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => {
      div.classList.add("fade-out");
      setTimeout(() => div.remove(), 500);
  }, 3000);
}

function updateOnlineUsers(users) {
  const list = document.getElementById("onlineUsers");
  list.innerHTML = "";
  users.forEach((user) => {
      const li = document.createElement("li");
      li.textContent = `🟢 ${user}`;
      list.appendChild(li);
  });
}
