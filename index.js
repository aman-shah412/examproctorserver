require("dotenv").config();
const express = require("express");
const app = express();
const router = require("./routes/router");
const cors = require("cors")
const server = app.listen(4000)
const io = require("socket.io")(server, {
    cors: {
        origin: '*',
    }
});


app.use(cors())
app.use(express.json());
app.use(router)

const idToSocket = new Map();
const socketToId = new Map();

io.on("connection", (socket) => {
    socket.on("room_join", data => {
        const { id, room } = data
        idToSocket.set(id, socket.id)
        socketToId.set(socket.id, id)
        socket.to(room).emit("user_joined", { id, Id: socket.id })
        socket.join(room)
    })

    socket.on("call_user", (data) => {
        const { id, offer } = data
        const from = socketToId.get(socket.id)
        const socketID = idToSocket.get(id);
        socket.to(socketID).emit("incoming_call", { from, offer })
    })

    socket.on("call_accepted", (data) => {
        const { from, ans } = data;
        const socketID = idToSocket.get(from);
        socket.to(socketID).emit("call_accepted", { ans })
    })
})


app.listen(process.env.PORT, () => {
    console.log(`server start at port no :${process.env.PORT}`)
})