const express = require("express");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
app.use(express.json());

const streams = {}; // guarda várias lives ao mesmo tempo

// =============================
// CONECTAR LIVE
// =============================
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
        console.error("Erro ao conectar:", err);
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


// =============================
// BUSCAR EVENTOS
// =============================
app.get("/events/:serverId", (req, res) => {
    const stream = streams[req.params.serverId];

    if (!stream) return res.json([]);

    const events = [...stream.queue];
    stream.queue.length = 0; // limpa fila

    res.json(events);
});


// =============================
// DESCONECTAR LIVE
// =============================
app.post("/disconnect", (req, res) => {
    const { serverId } = req.body;

    if (!serverId) {
        return res.status(400).json({ error: "ServerId inválido" });
    }

    const stream = streams[serverId];

    if (!stream) {
        return res.json({ status: "Não estava conectado" });
    }

    try {
        stream.connection.disconnect();
    } catch (err) {
        console.error("Erro ao desconectar:", err);
    }

    delete streams[serverId];

    res.json({ status: "Desconectado com sucesso" });
});


// =============================
// START SERVIDOR
// =============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Servidor rodando na porta", PORT);
});
