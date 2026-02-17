const express = require("express");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
app.use(express.json());

const streams = {};

// Verificar streams inativas a cada minuto (NOVO)
setInterval(() => {
    const now = Date.now();
    for (const [serverId, stream] of Object.entries(streams)) {
        // Se não houve atividade em 2 minutos, considera inativo
        if (stream.lastActivity && (now - stream.lastActivity) > 120000) {
            console.log(`🧹 Removendo stream inativa: ${serverId}`);
            try {
                stream.connection.disconnect();
            } catch (e) {}
            delete streams[serverId];
        }
    }
}, 60000); // Verificar a cada minuto

app.post("/connect", async (req, res) => {
    const { username, serverId } = req.body;

    if (!username || !serverId) {
        return res.status(400).json({ error: "Dados inválidos" });
    }

    if (streams[serverId]) {
        return res.json({ status: "Já conectado" });
    }

    console.log(`🟢 Tentando conectar à live: ${username}`);
    const connection = new WebcastPushConnection(username);
    const queue = [];

    try {
        await connection.connect();
        console.log(`✅ Conectado à live: ${username}`);
    } catch (err) {
        console.error(`❌ Erro ao conectar: ${err.message}`);
        return res.status(500).json({ error: "Erro ao conectar live" });
    }

    // 🎁 GIFT (PRESENTE)
    connection.on("gift", data => {
        console.log(`🎁 Presente: ${data.giftName} de @${data.uniqueId} (${data.diamondCount} diamantes)`);
        queue.push({
            type: "gift",
            user: data.uniqueId,
            gift: data.giftName,
            amount: data.repeatCount || 1,
            diamondValue: data.diamondCount || 0
        });
    });

    // 👤 FOLLOW (SEGUIDOR)
    connection.on("follow", data => {
        console.log(`👤 Novo seguidor: @${data.uniqueId}`);
        queue.push({
            type: "follow",
            user: data.uniqueId
        });
    });

    // 💬 CHAT
    connection.on("chat", data => {
        console.log(`💬 Chat: @${data.uniqueId}: ${data.comment}`);
        queue.push({
            type: "chat",
            user: data.uniqueId,
            message: data.comment
        });
    });

    // ❤️ LIKE
    connection.on("like", data => {
        console.log(`❤️ Likes: ${data.likeCount} de @${data.uniqueId}`);
        queue.push({
            type: "like",
            user: data.uniqueId,
            count: data.likeCount || 1
        });
    });

    // 🚪 SHARE (COMPARTILHAMENTO)
    connection.on("share", data => {
        console.log(`📢 Compartilhamento: @${data.uniqueId}`);
        queue.push({
            type: "share",
            user: data.uniqueId
        });
    });

    // ❌ Erros
    connection.on("error", err => {
        console.error(`❌ Erro na live: ${err.message}`);
    });

    // Disconnect
    connection.on("disconnected", () => {
        console.log(`🔴 Desconectado da live: ${username}`);
        delete streams[serverId];
    });

    streams[serverId] = { connection, queue, lastActivity: Date.now() };
    res.json({ status: "Conectado com sucesso" });
});

app.get("/events/:serverId", (req, res) => {
    const stream = streams[req.params.serverId];
    if (!stream) return res.json([]);
    
    // Atualizar última atividade (NOVO)
    stream.lastActivity = Date.now();

    const events = [...stream.queue];
    stream.queue.length = 0;
    
    if (events.length > 0) {
        console.log(`📤 Enviando ${events.length} eventos para o Roblox`);
    }
    
    res.json(events);
});

// Endpoint para desconectar (MELHORADO)
app.post("/disconnect", (req, res) => {
    const { serverId, username } = req.body;
    console.log(`🔌 Requisição para desconectar: serverId=${serverId}, username=${username}`);

    const stream = streams[serverId];
    if (!stream) {
        console.log(`⚠️ ServerId ${serverId} não encontrado, pode já ter sido desconectado`);
        return res.json({ status: "Não estava conectado" });
    }

    try {
        // Desconectar a conexão
        stream.connection.disconnect();
        
        // Remover dos streams ativos
        delete streams[serverId];
        
        console.log(`✅ Desconectado com sucesso: ${username} (${serverId})`);
        res.json({ status: "Desconectado com sucesso" });
    } catch (err) {
        console.error(`❌ Erro ao desconectar: ${err.message}`);
        // Mesmo com erro, removemos dos streams ativos
        delete streams[serverId];
        res.json({ status: "Erro na desconexão, mas removido" });
    }
});

// ENDPOINT PARA LIMPEZA MANUAL (NOVO)
app.post("/cleanup", (req, res) => {
    const { serverId } = req.body;
    
    // Remove qualquer stream órfão
    if (streams[serverId]) {
        try {
            streams[serverId].connection.disconnect();
        } catch (e) {}
        delete streams[serverId];
        console.log(`🧹 Cleanup: removido stream ${serverId}`);
    }
    
    res.json({ status: "Cleanup realizado" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
