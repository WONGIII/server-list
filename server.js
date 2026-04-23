const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 4323;

// 配置
const TIMEOUT_MS = 30000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const MAX_RECORD_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 请求日志中间件
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// ============ 数据清理函数 ============

function sanitizeServerData(body, clientIp) {
    const cleanIp = clientIp.replace('::ffff:', '').replace('::1', '127.0.0.1');
    
    // 解析 mode 字段
    let mode = body.mode || 'Unknown';
    
    console.log('[DEBUG] Original mode:', mode);
    
    // 检查是否是 Rush PVE (Normal)
    if (mode.includes('BP_PBGameMode_Rush_PVE_Normal')) {
        mode = 'RUSH PVE';
        console.log('[DEBUG] Matched: RUSH PVE');
    }
    // 检查是否是 Rush PVP
    else if (mode.includes('PBGameMode_Rush_BP')) {
        mode = 'RUSH PVP';
        console.log('[DEBUG] Matched: RUSH PVP');
    }
    // 其他情况
    else {
        console.log('[DEBUG] No match, keeping as is');
    }
    
    // 解析 serverState
    let serverState = body.serverState || 'Waiting';
    if (serverState === 'InvalidState') {
        serverState = 'Waiting';
    }
    
    console.log('[DEBUG] Final mode:', mode);
    
    return {
        name: body.name || 'Unknown',
        region: body.region || 'CN',
        mode: mode,
        map: body.map || 'Lobby',
        port: body.port || 7777,
        playerCount: body.playerCount || 0,
        serverState: serverState,
        ip: body.ip || cleanIp
    };
}

// ============ 定时任务 ============

setInterval(async () => {
    try {
        const result = await db.markOfflineServers(TIMEOUT_MS);
        if (result.marked > 0) {
            console.log(`[Cleanup] Marked ${result.marked} server(s) as offline`);
        }
    } catch (err) {
        console.error('[Cleanup Error]', err.message);
    }
}, 30000);

setInterval(async () => {
    try {
        const result = await db.cleanupOldRecords(MAX_RECORD_AGE_MS);
        if (result.deleted > 0) {
            console.log(`[Cleanup] Deleted ${result.deleted} old offline server record(s)`);
        }
    } catch (err) {
        console.error('[Cleanup Error]', err.message);
    }
}, CLEANUP_INTERVAL_MS);

// ============ 心跳处理函数 ============

async function handleHeartbeat(req, res) {
    console.log('\n[HEARTBEAT] ===== Received =====');
    
    try {
        const clientIp = req.body.ip || 
                        req.headers['x-forwarded-for']?.split(',')[0] || 
                        req.ip || 
                        req.connection.remoteAddress;
        
        const serverData = sanitizeServerData(req.body, clientIp);
        
        console.log(`[HEARTBEAT] Saving: ${serverData.name} @ ${serverData.ip}:${serverData.port} - ${serverData.playerCount} players - ${serverData.map} (${serverData.mode})`);
        
        const result = await db.upsertServer(serverData);
        
        console.log(`[HEARTBEAT] ✓ Saved successfully`);
        
        res.json({ 
            status: 'ok', 
            message: 'Heartbeat received'
        });
        
    } catch (err) {
        console.error('[HEARTBEAT ERROR]', err);
        res.status(500).json({ 
            status: 'error', 
            message: err.message 
        });
    }
}

// ============ 核心路由 ============

// 心跳上报接口
app.post('/server/status', handleHeartbeat);
app.post('/announce', handleHeartbeat);
app.post('/', handleHeartbeat);

/**
 * 获取服务器列表 - /servers (不返回 IP)
 */
app.get('/servers', async (req, res) => {
    try {
        const servers = await db.getAllServers(false);
        
        // 过滤掉 IP 字段
        const filteredServers = servers.map(server => ({
            name: server.name,
            region: server.region,
            mode: server.mode,
            map: server.map,
            port: server.port,
            playerCount: server.playerCount,
            serverState: server.serverState,
            lastHeartbeat: server.lastHeartbeat
        }));
        
        console.log(`[SERVERS] Returned ${filteredServers.length} servers`);
        res.json(filteredServers);
    } catch (err) {
        console.error('[SERVERS ERROR]', err.message);
        res.status(500).json([]);
    }
});

/**
 * 服务器主动下线
 */
app.post('/offline', async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ status: 'error', message: 'Server name required' });
        }
        
        const result = await db.deleteServer(name);
        
        if (result.deleted) {
            console.log(`[OFFLINE] ${name} removed`);
            res.json({ status: 'ok' });
        } else {
            res.status(404).json({ status: 'error', message: 'Server not found' });
        }
        
    } catch (err) {
        console.error('[OFFLINE ERROR]', err.message);
        res.status(500).json({ status: 'error' });
    }
});

// ============ 优雅关闭 ============

process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    try {
        await db.closeDatabase();
        process.exit(0);
    } catch (err) {
        console.error('Error closing database:', err);
        process.exit(1);
    }
});

// ============ 启动服务 ============

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ╔═══════════════════════════════════════════════════╗
    ║           Game Server Status Backend              ║
    ╠═══════════════════════════════════════════════════╣
    ║  Status Page:  http://localhost:${PORT}              ║
    ║  Heartbeat:    POST http://localhost:${PORT}/server/status ║
    ║  Server List:  GET  http://localhost:${PORT}/servers ║
    ╚═══════════════════════════════════════════════════╝
    `);
});