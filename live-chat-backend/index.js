const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let users = {}; // { socket.id: username }

io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  // New user joined
  socket.on("new_user", (username) => {
    users[socket.id] = username;
    io.emit("user_joined", username);
    io.emit("online_users", Object.values(users));
  });

  // Typing indicator
  socket.on("typing", (name) => {
    socket.broadcast.emit("typing", name);
  });

  socket.on("stop_typing", (name) => {
    socket.broadcast.emit("stop_typing", name);
  });

  // Sending message (currently broadcast to all)
  socket.on("send_message", (data) => {
    io.emit("receive_message", data);
  });

  // Disconnect user
  socket.on("disconnect", () => {
    const name = users[socket.id];
    if (name) {
      io.emit("user_left", name);
      delete users[socket.id];
      io.emit("online_users", Object.values(users));
    }
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

app.get("/", (req, res) => {
  res.send("Live Chat Backend Running 🚀");
});

server.listen(5000, () => {
  console.log("🌐 Server is running on http://localhost:5000");
});