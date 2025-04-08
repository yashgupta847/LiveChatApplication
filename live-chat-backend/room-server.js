// Load environment variables
require('dotenv').config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*"
}));

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, '../live-chat-frontend')));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['polling', 'websocket'],
  upgrade: false,
  allowEIO3: true,
  maxHttpBufferSize: 1e8
});

// Store active rooms and their users
const activeRooms = new Map();
// Store usernames mapped to socket ids
const usernames = new Map(); // socketId -> username

io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  // Set username
  socket.on("set_username", (data) => {
    const { username, roomId } = data;
    usernames.set(socket.id, username);
    console.log(`User ${socket.id} set username to: ${username}`);
    
    // Update users in room if already in a room
    if (roomId && activeRooms.has(roomId)) {
      const usersInRoom = Array.from(activeRooms.get(roomId)).map(id => usernames.get(id) || "Anonymous");
      io.to(roomId).emit("online_users", usersInRoom);
    }
  });

  // Always return true to allow joining any room
  socket.on("check-room-exists", (roomId, callback) => {
    callback(true);
  });

  // Join room
  socket.on("join-room", (data) => {
    try {
      const { roomId, username } = data;
      console.log(`👋 User ${socket.id} trying to join room ${roomId}`);
      
      // Set username if provided
      if (username) {
        usernames.set(socket.id, username);
      }
      
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
      
      // Get all usernames in this room
      const usersInRoom = Array.from(activeRooms.get(roomId)).map(id => usernames.get(id) || "Anonymous");
      
      // Notify all room members including the new user
      io.to(roomId).emit("user-joined", { 
        roomId,
        username: usernames.get(socket.id) || "Anonymous",
        users: usersInRoom
      });
      
      // Also send separate online users update to ensure it's received
      io.to(roomId).emit("online_users", usersInRoom);
      
      console.log(`✅ User ${socket.id} joined room ${roomId}`);
      console.log(`👥 Users in room ${roomId}: ${usersInRoom.join(', ')}`);
      console.log(`🔑 Active rooms: ${Array.from(activeRooms.keys()).join(', ')}`);
    } catch (error) {
      console.error("Error in join-room:", error);
    }
  });
  
  // Leave room
  socket.on("leave-room", (data) => {
    const { roomId } = data;
    leaveRoom(socket, roomId);
  });
  
  // Send message in room
  socket.on("send-message", (data) => {
    try {
      const { message, roomId, username, time } = data;
      console.log(`💬 Message from ${username} in room ${roomId}: ${message}`);
      
      // Send to all in room including sender for consistency
      io.to(roomId).emit("receive-message", {
        message,
        senderId: socket.id,
        username: username || usernames.get(socket.id) || "Anonymous",
        time,
        isBroadcast: true
      });
    } catch (error) {
      console.error("Error in send-message:", error);
    }
  });
  
  // Handle typing
  socket.on("typing", (data) => {
    const { username, roomId } = data;
    if (roomId) {
      socket.to(roomId).emit("typing", {
        username: username || usernames.get(socket.id) || "Anonymous"
      });
    }
  });
  
  socket.on("stop_typing", (data) => {
    const { username, roomId } = data;
    if (roomId) {
      socket.to(roomId).emit("stop_typing", {
        username: username || usernames.get(socket.id) || "Anonymous"
      });
    }
  });
  
  // Disconnect
  socket.on("disconnect", () => {
    leaveRoom(socket);
    usernames.delete(socket.id);
    console.log(`❌ User disconnected: ${socket.id}`);
  });
  
  // Helper function to leave a room
  function leaveRoom(socket, specificRoomId = null) {
    const roomId = specificRoomId || socket.roomId;
    if (roomId) {
      socket.leave(roomId);
      
      if (activeRooms.has(roomId)) {
        const room = activeRooms.get(roomId);
        room.delete(socket.id);
        
        // Get remaining users in room
        const usersInRoom = Array.from(room).map(id => usernames.get(id) || "Anonymous");
        
        // If room is empty, remove it
        if (room.size === 0) {
          activeRooms.delete(roomId);
        } else {
          // Notify others in room
          socket.to(roomId).emit("user-left", { 
            roomId,
            username: usernames.get(socket.id) || "Anonymous",
            users: usersInRoom
          });
          
          // Update online users list for remaining users
          io.to(roomId).emit("online_users", usersInRoom);
        }
        
        console.log(`User ${socket.id} left room ${roomId}`);
        console.log(`Active rooms: ${Array.from(activeRooms.keys()).join(', ')}`);
      }
      
      if (roomId === socket.roomId) {
        socket.roomId = null;
      }
    }
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, '../live-chat-frontend/index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🌐 Server is running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
}); 