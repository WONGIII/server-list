# 🌌 边境社区服务器状态面板

> 适用于 [ProjectRebound](https://github.com/STanJK/ProjectRebound) 的服务器状态展示系统

一个用于游戏《边境》的社区服务器状态展示系统，基于 Node.js + SQLite + Express 构建。支持游戏服务器心跳上报、实时状态展示、毛玻璃太空主题界面。

![主题风格](https://img.shields.io/badge/theme-深空边境-blue)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![SQLite](https://img.shields.io/badge/SQLite-3-blue)
![License](https://img.shields.io/badge/license-MIT-orange)

> **⚠️ 适配提醒**
> 
> 当前未适配[ProjectRebound Backend API Spec v2](https://github.com/STanJK/ProjectRebound/blob/main/docs/backend-api-spec-v2.md#projectrebound-backend-api-spec-v2)

---

## ✨ 特性

- 🚀 **实时心跳上报** - 游戏服务器定时上报状态，自动维护在线列表
- 💾 **SQLite 持久化** - 服务器数据持久存储，重启不丢失
- 🎨 **深空边境主题** - 毛玻璃效果、轨道动画、发光文字
- 📱 **响应式设计** - 完美适配桌面端、平板和手机
- 🔄 **自动刷新** - 每 5 秒自动更新服务器列表
- 🌍 **多区域支持** - 支持 CN/NA/EU 等区域标识
- 🎮 **游戏模式识别** - 自动识别 RUSH PVE / RUSH PVP 模式

---

## 🛠️ 技术栈

| 技术 | 用途 |
|:---|:---|
| Node.js | 后端运行环境 |
| Express | Web 服务器框架 |
| SQLite3 | 数据持久化存储 |
| HTML5/CSS3 | 前端界面 |
| 原生 JavaScript | 前端交互逻辑 |

---

## 📦 项目结构

```
server-list/
├── package.json          # 项目依赖配置
├── server.js             # 后端主程序（Express + API）
├── database.js           # SQLite 数据库操作模块
├── servers.db            # SQLite 数据库文件（自动生成）
├── public/
│   └── index.html        # 前端页面
└── README.md             # 项目说明文档
```

---

## 🚀 快速开始

### 1. 环境要求

- Node.js 18+ 
- npm 或 yarn

### 2. 安装依赖

```bash
npm install
```

### 3. 启动服务

```bash
npm start
```

启动成功后，控制台会显示：

```
╔═══════════════════════════════════════════════════╗
║           Game Server Status Backend              ║
╠═══════════════════════════════════════════════════╣
║  Status Page:  http://localhost:4323              ║
║  Heartbeat:    POST http://localhost:4323/server/status ║
║  Server List:  GET  http://localhost:4323/servers ║
╚═══════════════════════════════════════════════════╝
```

### 4. 访问页面

打开浏览器访问 `http://localhost:4323`

---

## 🔌 API 接口

### 服务器心跳上报

游戏服务器定时向此接口发送状态数据。

**请求**
```http
POST /server/status
Content-Type: application/json

{
  "name": "[WANG]Test",
  "region": "CN",
  "mode": "/Game/Online/GameMode/PBGameMode_Rush_BP.PBGameMode_Rush_BP_C",
  "map": "Dusty",
  "port": 7777,
  "playerCount": 4,
  "serverState": "InProgress"
}
```

**响应**
```json
{
  "status": "ok",
  "message": "Heartbeat received"
}
```

> 💡 游戏服务端配置示例：
> ```
> online http://192.168.0.217:4323
> ```

---

### 获取服务器列表

网页前端调用此接口获取在线服务器列表。

**请求**
```http
GET /servers
```

**响应**
```json
[
  {
    "name": "[WANG]Test",
    "region": "CN",
    "mode": "RUSH PVP",
    "map": "Dusty",
    "port": 7777,
    "playerCount": 4,
    "serverState": "InProgress",
    "lastHeartbeat": 1776859275130
  }
]
```

> ⚠️ 注意：返回的数据**不包含 IP 地址**，只显示端口号。

---

### 服务器主动下线

**请求**
```http
POST /offline
Content-Type: application/json

{
  "name": "[WANG]Test"
}
```

**响应**
```json
{
  "status": "ok"
}
```

---

## ⚙️ 配置说明

在 `server.js` 中可以修改以下配置：

```javascript
const PORT = process.env.PORT || 4323;        // 监听端口
const TIMEOUT_MS = 30000;                      // 心跳超时时间（30秒）
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;    // 清理间隔（1小时）
const MAX_RECORD_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 记录保留时间（7天）
```

---

## 🎨 界面特性

### 深空边境主题
- **背景**：深蓝色渐变 + 轨道旋转动画 + 星星闪烁
- **毛玻璃效果**：`backdrop-filter: blur()` 实现半透明模糊
- **发光文字**：标题和数值带有蓝色发光效果
- **状态色彩**：
  - 🟢 游戏中 - 绿色
  - 🟡 等待中 - 黄色
  - 🔴 离线 - 红色

### 响应式断点
| 屏幕宽度 | 布局 |
|:---|:---|
| ≥ 1400px | 3 列卡片 |
| 1000px - 1399px | 2 列卡片 |
| 600px - 999px | 2 列卡片 |
| ≤ 600px | 1 列卡片（移动端） |

---

## 📝 游戏模式识别

系统会自动识别游戏模式路径并转换为友好名称：

| 原始路径 | 显示名称 |
|:---|:---|
| `/Game/Online/GameMode/PBGameMode_Rush_BP...` | `RUSH PVP` |
| `/Game/Online/GameMode/BP_PBGameMode_Rush_PVE_Normal...` | `RUSH PVE` |

---

## 🔧 故障排查

### 网页没有显示服务器？

1. 检查游戏服务端是否执行了 `online` 命令
2. 查看后端控制台是否有 `[HEARTBEAT]` 日志
3. 确认游戏服务端发送的路径是 `/server/status`
4. 访问 `http://localhost:4323/servers` 查看原始 JSON 数据

### 端口被占用？

修改 `server.js` 中的 `PORT` 变量：

```javascript
const PORT = process.env.PORT || 你的端口号;
```

### 数据库文件位置？

默认在项目根目录生成 `servers.db` 文件。可以用 SQLite 浏览器查看：

```bash
sqlite3 servers.db
SELECT * FROM servers;
```

---

## 📄 许可证

MIT License

---

## 🙏 致谢

- 游戏《边境》开发团队
- 游戏《边境》社区开发团队
- Node.js 社区
- SQLite 团队

---

**Made with 🌌 by the community**
