const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'servers.db');

// 创建数据库连接
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Failed to connect to database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        initDatabase();
    }
});

// 初始化数据库表
function initDatabase() {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS servers (
            name TEXT PRIMARY KEY,
            region TEXT DEFAULT 'CN',
            mode TEXT DEFAULT 'PVE',
            map TEXT DEFAULT 'Lobby',
            port INTEGER DEFAULT 7777,
            player_count INTEGER DEFAULT 0,
            server_state TEXT DEFAULT 'Waiting',
            ip TEXT,
            last_heartbeat INTEGER,
            created_at INTEGER,
            updated_at INTEGER
        );
        
        CREATE INDEX IF NOT EXISTS idx_last_heartbeat ON servers(last_heartbeat);
        CREATE INDEX IF NOT EXISTS idx_server_state ON servers(server_state);
    `;

    db.exec(createTableSQL, (err) => {
        if (err) {
            console.error('Failed to create tables:', err.message);
        } else {
            console.log('Database tables ready.');
        }
    });
}

// ============ 数据库操作函数 ============

/**
 * 插入或更新服务器信息（心跳上报）
 */
function upsertServer(serverData) {
    return new Promise((resolve, reject) => {
        const now = Date.now();
        const {
            name, region = 'CN', mode = 'PVE', map = 'Lobby',
            port = 7777, playerCount = 0, serverState = 'Waiting', ip = ''
        } = serverData;

        const sql = `
            INSERT INTO servers (
                name, region, mode, map, port, player_count, 
                server_state, ip, last_heartbeat, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                region = excluded.region,
                mode = excluded.mode,
                map = excluded.map,
                port = excluded.port,
                player_count = excluded.player_count,
                server_state = excluded.server_state,
                ip = excluded.ip,
                last_heartbeat = excluded.last_heartbeat,
                updated_at = excluded.updated_at;
        `;

        db.run(sql, [
            name, region, mode, map, port, playerCount,
            serverState, ip, now, now, now
        ], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ name, lastHeartbeat: now });
            }
        });
    });
}

/**
 * 删除服务器（主动下线）
 */
function deleteServer(name) {
    return new Promise((resolve, reject) => {
        const sql = 'DELETE FROM servers WHERE name = ?';
        db.run(sql, [name], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ deleted: this.changes > 0, name });
            }
        });
    });
}

/**
 * 获取所有服务器列表
 * @param {boolean} includeOffline - 是否包含离线的服务器
 */
function getAllServers(includeOffline = false) {
    return new Promise((resolve, reject) => {
        let sql = `
            SELECT 
                name, region, mode, map, port, 
                player_count as playerCount,
                server_state as serverState,
                ip, last_heartbeat as lastHeartbeat,
                created_at as createdAt,
                updated_at as updatedAt
            FROM servers
        `;
        
        if (!includeOffline) {
            sql += ` WHERE server_state != 'Offline'`;
        }
        
        sql += ` ORDER BY 
            CASE server_state 
                WHEN 'InProgress' THEN 1 
                WHEN 'Waiting' THEN 2 
                WHEN 'Starting' THEN 3
                WHEN 'InvalidState' THEN 4
                ELSE 5 
            END,
            player_count DESC,
            last_heartbeat DESC
        `;

        db.all(sql, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * 更新超时的服务器状态为 Offline
 */
function markOfflineServers(timeoutMs) {
    return new Promise((resolve, reject) => {
        const cutoffTime = Date.now() - timeoutMs;
        const sql = `
            UPDATE servers 
            SET server_state = 'Offline', updated_at = ?
            WHERE last_heartbeat < ? AND server_state != 'Offline'
        `;
        
        db.run(sql, [Date.now(), cutoffTime], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ marked: this.changes });
            }
        });
    });
}

/**
 * 清理已离线的旧记录（可选，防止数据库无限增长）
 */
function cleanupOldRecords(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
    return new Promise((resolve, reject) => {
        const cutoffTime = Date.now() - maxAgeMs;
        const sql = `
            DELETE FROM servers 
            WHERE server_state = 'Offline' AND last_heartbeat < ?
        `;
        
        db.run(sql, [cutoffTime], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ deleted: this.changes });
            }
        });
    });
}

/**
 * 获取统计信息
 */
function getStats() {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT 
                COUNT(*) as totalServers,
                SUM(CASE WHEN server_state != 'Offline' THEN 1 ELSE 0 END) as onlineServers,
                SUM(player_count) as totalPlayers
            FROM servers
            WHERE server_state != 'Offline'
        `;
        
        db.get(sql, [], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve({
                    totalServers: row.onlineServers || 0,
                    totalPlayers: row.totalPlayers || 0
                });
            }
        });
    });
}

/**
 * 关闭数据库连接
 */
function closeDatabase() {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) {
                reject(err);
            } else {
                console.log('Database connection closed.');
                resolve();
            }
        });
    });
}

// 导出函数
module.exports = {
    upsertServer,
    deleteServer,
    getAllServers,
    markOfflineServers,
    cleanupOldRecords,
    getStats,
    closeDatabase
};

// 如果直接运行此文件，执行初始化
if (require.main === module) {
    console.log('Initializing database...');
    initDatabase();
}