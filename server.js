const express = require("express");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
app.use(express.json());

const streams = {};

app.post("/connect", async (req, res) => {
    const { username, serverId } = req.body;

    if (!username || !serverId) {
        return res.status(400).json({ error: "Dados inválidos" });
    }

    if (streams[serverId]) {
        return res.json({ status: "Já conectado" });
    }

    const connection = new WebcastPushConnection(username);
    const queue = [];

    try {
        await connection.connect();
        console.log("Conectado à live:", username);
    } catch (err) {
        return res.status(500).json({ error: "Erro ao conectar live" });
    }

    // 🎁 PRESENTE
    connection.on("gift", data => {
        console.log("Presente recebido:", data.giftName);
        queue.push({
            type: "gift",
            user: data.uniqueId,
            gift: data.giftName,
            amount: data.repeatCount,
            diamondValue: data.diamondCount || 0
        });
    });

    // 👤 FOLLOW
    connection.on("follow", data => {
        console.log("Novo seguidor:", data.uniqueId);
        queue.push({
            type: "follow",
            user: data.uniqueId
        });
    });

    // 💬 CHAT
    connection.on("chat", data => {
        console.log("Mensagem:", data.comment);
        queue.push({
            type: "chat",
            user: data.uniqueId,
            message: data.comment
        });
    });

    // ❤️ LIKE
    connection.on("like", data => {
        console.log("Likes:", data.likeCount);
        queue.push({
            type: "like",
            user: data.uniqueId,
            count: data.likeCount
        });
    });

    // 🎉 SHARE
    connection.on("share", data => {
        console.log("Compartilhamento:", data.uniqueId);
        queue.push({
            type: "share",
            user: data.uniqueId
        });
    });

    streams[serverId] = { connection, queue };

    res.json({ status: "Conectado com sucesso" });
});

app.get("/events/:serverId", (req, res) => {
    const stream = streams[req.params.serverId];
    if (!stream) return res.json([]);

    const events = [...stream.queue];
    stream.queue.length = 0;

    res.json(events);
});

app.post("/disconnect", (req, res) => {
    const { serverId } = req.body;

    const stream = streams[serverId];
    if (!stream) return res.json({ status: "Não estava conectado" });

    stream.connection.disconnect();
    delete streams[serverId];

    res.json({ status: "Desconectado com sucesso" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando na porta", PORT));
