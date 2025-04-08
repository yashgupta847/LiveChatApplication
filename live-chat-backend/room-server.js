const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const roomUsers = {};

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", ({ roomId, username }) => {
        socket.join(roomId);
        socket.roomId = roomId;
        socket.username = username;

        if (!roomUsers[roomId]) roomUsers[roomId] = [];
        if (!roomUsers[roomId].includes(username)) roomUsers[roomId].push(username);

        io.to(roomId).emit("user-joined", { username, users: roomUsers[roomId] });
    });

    socket.on("leave-room", ({ roomId }) => {
        socket.leave(roomId);
        if (roomUsers[roomId]) {
            roomUsers[roomId] = roomUsers[roomId].filter(name => name !== socket.username);
            io.to(roomId).emit("user-left", { username: socket.username, users: roomUsers[roomId] });
        }
    });

    socket.on("send-message", (data) => {
        io.to(data.roomId).emit("receive-message", data);
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
            io.to(roomId).emit("user-left", { username, users: roomUsers[roomId] });
        }
        console.log("User disconnected:", socket.id);
    });
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
