const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
app.use(cors());

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, '../live-chat-frontend')));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Store active rooms and their users
const activeRooms = new Map();

io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  // Check if a room exists
  socket.on("check-room-exists", (roomId, callback) => {
    // Room exists if:
    // 1. It's the room created by the user (currentRoomId matches)
    // 2. It exists in activeRooms
    const roomExists = activeRooms.has(roomId);
    callback(roomExists);
  });

  // Join room
  socket.on("join-room", (roomId) => {
    // Leave previous room if any
    if (socket.roomId) {
      leaveRoom(socket);
    }
    
    // Join new room
    socket.join(roomId);
    socket.roomId = roomId;
    
    // Add room to active rooms if not exists
    if (!activeRooms.has(roomId)) {
      activeRooms.set(roomId, new Set());
    }
    
    // Add user to room
    activeRooms.get(roomId).add(socket.id);
    
    // Notify room members
    socket.to(roomId).emit("user-joined", { roomId });
    
    console.log(`User ${socket.id} joined room ${roomId}`);
    console.log(`Active rooms: ${Array.from(activeRooms.keys()).join(', ')}`);
  });
  
  // Leave room
  socket.on("leave-room", (roomId) => {
    leaveRoom(socket);
  });
  
  // Send message in room
  socket.on("send-message", (data) => {
    const { message, roomId } = data;
    
    // Send to all in room except sender
    socket.to(roomId).emit("receive-message", {
      message,
      senderId: socket.id
    });
  });
  
  // Handle typing
  socket.on("typing", (username) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit("typing", username);
    }
  });
  
  socket.on("stop_typing", (username) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit("stop_typing", username);
    }
  });
  
  // Disconnect
  socket.on("disconnect", () => {
    leaveRoom(socket);
    console.log(`❌ User disconnected: ${socket.id}`);
  });
  
  // Helper function to leave a room
  function leaveRoom(socket) {
    const roomId = socket.roomId;
    if (roomId) {
      socket.leave(roomId);
      
      if (activeRooms.has(roomId)) {
        const room = activeRooms.get(roomId);
        room.delete(socket.id);
        
        // If room is empty, remove it
        if (room.size === 0) {
          activeRooms.delete(roomId);
        }
        
        // Notify others in room
        socket.to(roomId).emit("user-left", { roomId });
        
        console.log(`User ${socket.id} left room ${roomId}`);
        console.log(`Active rooms: ${Array.from(activeRooms.keys()).join(', ')}`);
      }
      
      socket.roomId = null;
    }
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, '../live-chat-frontend/index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🌐 Server is running on http://localhost:${PORT}`);
}); 