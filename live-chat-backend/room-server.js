const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

const server = http.createServer(app);

// Configure Socket.IO with more lenient settings
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000,
    maxHttpBufferSize: 1e8,
    path: "/socket.io/",
    serveClient: false
});

// Store active rooms and their messages
const roomUsers = {};
const roomMessages = {};

// Handle connection errors at the server level
io.engine.on("connection_error", (err) => {
    console.log("Connection error:", err.req, err.code, err.message, err.context);
});

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Handle connection errors
    socket.on("error", (error) => {
        console.error("Socket error:", error);
    });

    socket.on("join-room", ({ roomId, username }) => {
        try {
            socket.join(roomId);
            socket.roomId = roomId;
            socket.username = username;

            // Initialize room if it doesn't exist
            if (!roomUsers[roomId]) {
                roomUsers[roomId] = [];
                roomMessages[roomId] = [];
            }

            // Add user to room if not already there
            if (!roomUsers[roomId].includes(username)) {
                roomUsers[roomId].push(username);
            }

            // Send welcome message
            const welcomeMessage = {
                message: `${username} has joined the chat!`,
                username: "System",
                time: new Date().toLocaleTimeString(),
                type: "system"
            };
            roomMessages[roomId].push(welcomeMessage);
            io.to(roomId).emit("receive-message", welcomeMessage);

            // Send room history to the new user
            socket.emit("room-history", roomMessages[roomId]);

            // Update online users list
            io.to(roomId).emit("online_users", roomUsers[roomId]);
        } catch (error) {
            console.error("Error in join-room:", error);
            socket.emit("error", "Failed to join room");
        }
    });

    socket.on("leave-room", ({ roomId }) => {
        socket.leave(roomId);
        if (roomUsers[roomId]) {
            roomUsers[roomId] = roomUsers[roomId].filter(name => name !== socket.username);
            io.to(roomId).emit("user-left", { username: socket.username, users: roomUsers[roomId] });
        }
    });

    socket.on("send-message", (data) => {
        const { message, roomId, username, time } = data;
        
        // Create message object
        const messageObj = {
            message,
            username,
            time: time || new Date().toLocaleTimeString(),
            type: "user"
        };

        // Store message in room history
        if (!roomMessages[roomId]) {
            roomMessages[roomId] = [];
        }
        roomMessages[roomId].push(messageObj);

        // Broadcast message to room
        io.to(roomId).emit("receive-message", messageObj);
    });

    socket.on("typing", ({ roomId, username }) => {
        socket.to(roomId).emit("typing", { username });
    });

    socket.on("stop_typing", ({ roomId, username }) => {
        socket.to(roomId).emit("stop_typing", { username });
    });

    socket.on("disconnect", () => {
        const { roomId, username } = socket;
        if (roomId && roomUsers[roomId]) {
            roomUsers[roomId] = roomUsers[roomId].filter(user => user !== username);
            
            // Send leave message
            const leaveMessage = {
                message: `${username} has left the chat`,
                username: "System",
                time: new Date().toLocaleTimeString(),
                type: "system"
            };
            roomMessages[roomId].push(leaveMessage);
            io.to(roomId).emit("receive-message", leaveMessage);
            
            io.to(roomId).emit("user-left", { username, users: roomUsers[roomId] });
        }
        console.log("User disconnected:", socket.id);
    });
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
