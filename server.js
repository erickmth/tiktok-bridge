const express = require("express");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
app.use(express.json());

const streams = {}; // guarda várias lives ao mesmo tempo

// Conectar live
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

    connection.on("gift", data => {
        queue.push({
            user: data.uniqueId,
            gift: data.giftName
        });
    });

    streams[serverId] = { connection, queue };

    res.json({ status: "Conectado com sucesso" });
});

// Buscar eventos
app.get("/events/:serverId", (req, res) => {
    const stream = streams[req.params.serverId];
    if (!stream) return res.json([]);

    const events = [...stream.queue];
    stream.queue = [];
    res.json(events);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando na porta", PORT));

