# Internal Communication Platform - Architecture Plan
### MS Teams Replacement | 300+ Users | Internal Network Only
**Date:** 2026-03-07
**Version:** 1.1 (Draft for Senior Manager Review)

---

## 0. Existing Hardware — Grandstream UCM6304 V1.4A

| Specification | Value |
|--------------|-------|
| **Model** | Grandstream UCM6304 |
| **Hardware Version** | V1.4A |
| **IP Address** | 192.168.7.2 |
| **Max SIP Extensions** | 2,000 (we need ~300–500) |
| **Max Concurrent Calls** | 300 (200 with SRTP encryption) |
| **Audio Conference** | Up to 200 participants |
| **Video Conference** | Up to 40 participants @1080p (H.264), 4 rooms |
| **WebRTC Gateway** | Built-in (SIP over WebSocket, WSS port 8445) |
| **REST API** | Yes (HTTPS port 8089, MD5 token auth) |
| **Video Codecs** | H.264, H.263, H.265, VP8 |
| **Call Recording** | Built-in (SD card / USB storage) |
| **LDAP** | Supported |
| **Recommended Firmware** | 1.0.29.19 or later |

> **Verdict:** The UCM6304 is more than capable for 300+ users. It can handle all 1:1 calls, group audio conferences (200 participants), AND group video calls up to 40 participants natively. Janus Gateway is only needed as overflow for very large video meetings (40+).

---

## 1. Executive Summary

Build a fully self-hosted internal communication platform to replace Microsoft Teams for 300+ employees. The platform will provide real-time messaging, audio/video calling (1:1 and group), file sharing, and presence — all confined to the company's internal network. Zero external dependency, zero licensing cost.

**Key Constraint:** Fully utilize the existing Grandstream SIP server. Zero additional software licensing cost. One blank server provided for deployment.

---

## 2. Technology Stack (All Open Source / Free)

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React 18 + Vite + TypeScript | Fast dev experience, large ecosystem, SPA |
| **Backend** | Node.js + Express + TypeScript | Best for real-time (event-driven I/O), single language with frontend, native WebSocket support |
| **Database** | PostgreSQL 16 | ACID-compliant, JSON support, full-text search for messages, battle-tested |
| **Cache / Pub-Sub** | Redis 7 (or Valkey) | Real-time presence, message pub/sub, session store, caching |
| **Media Server** | Janus WebRTC Gateway | Overflow for 40+ video calls, advanced screen sharing, SIP bridge plugin |
| **SIP / PBX** | Grandstream UCM6304 V1.4A (existing, IP: 192.168.7.2) | 1:1 calls, group video (40p), audio conference (200p), WebRTC gateway, REST API |
| **SIP Client (Browser)** | SIP.js | Browser SIP registration via WebSocket to Grandstream |
| **TURN/STUN** | coturn | ICE/NAT traversal for WebRTC within internal network subnets |
| **File Storage** | Local filesystem + MinIO (optional) | File uploads, attachments, shared files |
| **Reverse Proxy** | Nginx | SSL termination, load balancing, static file serving |
| **Containerization** | Docker + Docker Compose | Easy deployment, isolation, reproducibility |
| **OS** | Ubuntu Server 22.04 LTS | Free, stable, well-supported |

**Total Software Licensing Cost: $0**

---

## 3. Why Node.js Over Python?

| Criteria | Node.js | Python |
|----------|---------|--------|
| Real-time I/O | Native event loop, non-blocking | asyncio works but less natural |
| WebSocket support | First-class (Socket.IO, ws) | Requires extra libraries |
| WebRTC ecosystem | SIP.js, mediasoup, Janus clients | Limited WebRTC libraries |
| Concurrent connections | Handles 10K+ connections easily | Needs async frameworks |
| Single language stack | Same JS/TS for frontend + backend | Different language = context switch |
| NPM ecosystem | Massive real-time/comm packages | Fewer real-time packages |

**Verdict: Node.js is significantly better for this real-time communication project.**

---

## 4. Why PostgreSQL?

| Feature | Benefit for This Project |
|---------|------------------------|
| ACID transactions | Message delivery guarantees, no lost messages |
| Full-text search | Search across millions of messages instantly |
| JSONB columns | Flexible message metadata, reactions, threads |
| Row-level security | Per-user, per-group access control |
| Proven at scale | Handles billions of rows (Slack, Discord use Postgres) |
| Partitioning | Partition messages by date for performance |
| Free & open source | Zero cost |

**Redis complements PostgreSQL** for real-time needs:
- User presence (online/offline/away/busy)
- Typing indicators
- Message pub/sub across server instances
- Session management
- Rate limiting

---

## 5. System Architecture Overview

```
+------------------------------------------------------------------+
|                     INTERNAL NETWORK ONLY                         |
|                                                                   |
|  +------------------+     +------------------+                    |
|  | Employee Browser  |     | Employee Browser  |   ... (300+)    |
|  | (React SPA)      |     | (React SPA)      |                   |
|  +--------+---------+     +--------+---------+                    |
|           |                         |                             |
|           +------------+------------+                             |
|                        |                                          |
|                   [ NGINX ]                                       |
|                   Reverse Proxy                                   |
|                   SSL Termination                                 |
|                   Static Files                                    |
|                        |                                          |
|           +------------+------------+                             |
|           |            |            |                              |
|     +-----+----+ +----+-----+ +----+------+                      |
|     | REST API | | Socket.IO| | Janus WS  |                      |
|     | (Express)| | Server   | | Signaling |                      |
|     +-----+----+ +----+-----+ +----+------+                      |
|           |            |            |                              |
|     +-----+------------+------------+------+                      |
|     |        NODE.JS BACKEND SERVER        |                      |
|     |  +--------+  +----------+  +------+  |                     |
|     |  | Auth   |  | Chat     |  | File |  |                     |
|     |  | Module |  | Module   |  | Mod  |  |                     |
|     |  +--------+  +----------+  +------+  |                     |
|     |  +--------+  +----------+  +------+  |                     |
|     |  | User   |  | Group    |  | Call |  |                     |
|     |  | Module |  | Module   |  | Mod  |  |                     |
|     |  +--------+  +----------+  +------+  |                     |
|     +-----+--+----------+-----------+------+                      |
|           |  |          |           |                              |
|     +-----+--+--+  +---+---+  +----+--------+                    |
|     | PostgreSQL |  | Redis |  | File System |                    |
|     | (Messages, |  | (Pub/ |  | (Uploads,   |                   |
|     |  Users,    |  |  Sub, |  |  Shared     |                   |
|     |  Groups,   |  |  Pres |  |  Files)     |                   |
|     |  Files)    |  |  ence)|  |             |                   |
|     +------------+  +-------+  +-------------+                    |
|                                                                   |
|     +-------------------+     +------------------+                |
|     | JANUS GATEWAY     |     | GRANDSTREAM UCM  |               |
|     | (Group Video SFU) |<--->| (SIP Server/PBX) |               |
|     | (Screen Sharing)  | SIP | (1:1 Calls)      |               |
|     | (SIP Bridge)      |     | (Conference)     |               |
|     +--------+----------+     | (Extensions)     |               |
|              |                | (WebRTC Gateway) |               |
|              |                +------------------+                |
|     +--------+----------+                                         |
|     | coturn            |                                         |
|     | (STUN/TURN Server)|                                         |
|     +-------------------+                                         |
|                                                                   |
+------------------------------------------------------------------+
                    FIREWALL: NO EXTERNAL ACCESS
```

---

## 6. Grandstream UCM6304 Integration Strategy

**Model:** UCM6304 V1.4A | **IP:** 192.168.7.2

This is the **core differentiator** — fully leveraging your existing Grandstream UCM6304.

### 6.1 What Grandstream UCM6304 Handles

| Feature | How UCM6304 Handles It | Capacity |
|---------|----------------------|----------|
| **1:1 Audio Calls** | SIP extensions via WebRTC gateway (WSS port 8445) | 300 concurrent (200 SRTP) |
| **1:1 Video Calls** | SIP video (H.264/H.265/VP8) through WebRTC gateway | Included in 300 limit |
| **Group Video Calls** | Built-in video bridge @1080p Full HD | Up to 40 participants, 4 rooms |
| **Group Audio Calls** | Built-in conference bridge | Up to 200 participants |
| **Extension Management** | REST API (port 8089): auto-provision extensions | 2,000 max extensions |
| **Call History (CDR)** | Built-in CDR accessible via REST API | Full history |
| **Voicemail** | Built-in per-extension voicemail | Per extension |
| **Call Recording** | Built-in recording (SD/USB storage) | Per call/queue/global |
| **LDAP Directory** | Built-in LDAP server for contacts | Syncs with IP phones |

### 6.2 UCM6304 REST API Integration Points

**Base URL:** `https://192.168.7.2:8089/api`
**Auth Method:** Challenge/Response with MD5 token

```
Authentication:
  POST /api?action=challenge  →  Get challenge string
  POST /api?action=login      →  Submit MD5(challenge+password), get token

Extension Management:
  POST /api?action=addUpdateUser      →  Create/update SIP extension
  GET  /api?action=listUser           →  List all extensions
  POST /api?action=deleteUser         →  Remove extension

Conference Control:
  GET  /api?action=listConference     →  List conference rooms
  POST /api?action=addUpdateConferenceRoom  →  Create conference room
  GET  /api?action=getConferenceRoomStatus  →  Room status/participants
  POST /api?action=kickConferenceMember     →  Remove participant

Call Records:
  GET  /api?action=listCDR            →  Call detail records

System:
  GET  /api?action=getSystemStatus    →  Server health
```

### 6.3 Browser-to-UCM6304 Call Flow (1:1 Calls)

```
Employee Browser                    Grandstream UCM6304 (192.168.7.2)
     |                                    |
     |  1. SIP REGISTER via WSS           |
     |  (SIP.js → wss://192.168.7.2:8445/ws) |
     |----------------------------------->|
     |  2. 200 OK (Registered)            |
     |<-----------------------------------|
     |                                    |
     |  3. SIP INVITE (audio/video)       |
     |----------------------------------->|
     |  4. UCM routes to callee           |
     |  5. SDP negotiation (WebRTC)       |
     |<---------------------------------->|
     |  6. Media flows (DTLS-SRTP)        |
     |<=================================>|
     |                                    |
```

### 6.4 What Janus Gateway Handles (Supplementing UCM6304)

Since the UCM6304 natively supports group video (up to 40 participants @1080p), Janus is only needed as overflow:

| Feature | Why Janus, Not UCM |
|---------|-------------------|
| **Large Group Video (40+ people)** | UCM6304 maxes at 40 video participants; Janus SFU scales to 100+ |
| **Advanced Screen Sharing** | Additional video stream alongside call, custom layouts |
| **Individual Stream Recording** | Janus records each participant's stream separately |
| **SIP Bridge** | Janus SIP plugin connects to UCM for hybrid calls |

### 6.5 Hybrid Call Routing Decision (Updated for UCM6304)

```
User initiates call
        |
        v
   Is it 1:1 call?
   /           \
  YES           NO (Group)
   |              |
   v              v
SIP.js →      Group size?
UCM6304       /          \
direct     ≤40            >40
(WSS:8445)   |              |
             v              v
         UCM6304        Janus
         Video Bridge   VideoRoom
         (1080p HD)     (SFU overflow)
             |
         Audio only?
             |
             v
         UCM6304
         Conference Bridge
         (up to 200 participants)
```

> **Key Insight:** For a 300-person company, most group video calls will be under 40 participants, meaning the UCM6304 handles the vast majority of calls natively. Janus is a safety net for all-hands meetings.

---

## 7. Feature Modules - Detailed Design

### 7.1 Authentication & User Management

```
- LDAP / Active Directory integration (if company has AD)
- OR local user database with JWT tokens
- Auto-provision SIP extension on Grandstream when user is created
- Roles: Admin, Manager, Employee
- Profile: name, avatar, department, designation, status
- Session management via Redis (auto-expire inactive sessions)
```

**Database Tables:**
```sql
users (
  id, username, email, password_hash, display_name,
  avatar_url, department, designation, role,
  sip_extension, sip_password,
  status, last_seen, created_at
)
```

### 7.2 Real-Time Messaging (Chat)

```
Features:
- 1:1 direct messages
- Group channels (public/private)
- Message types: text, file, image, video, audio, code, system
- Typing indicators (Redis pub/sub)
- Read receipts (delivered, read)
- Message reactions (emoji)
- Thread/reply support
- Message edit & delete
- Message search (PostgreSQL full-text search)
- @mentions with notifications
- Message pinning
- Unread message count
```

**Database Tables:**
```sql
conversations (
  id, type [direct/group], name, description,
  avatar_url, created_by, created_at
)

conversation_members (
  conversation_id, user_id, role [admin/member],
  joined_at, last_read_message_id, muted, notifications
)

messages (
  id, conversation_id, sender_id, type,
  content, metadata (JSONB), reply_to_id,
  edited_at, deleted_at, created_at
)
-- Partition messages table by month for performance

message_reactions (
  message_id, user_id, emoji, created_at
)
```

**Real-Time Flow:**
```
Sender Browser                 Node.js Server              Receiver Browser
     |                              |                            |
     | socket.emit('message:send')  |                            |
     |----------------------------->|                            |
     |                              | 1. Validate & save to DB  |
     |                              | 2. Publish to Redis       |
     |                              | 3. Redis pub/sub delivers |
     |                              |--------------------------->|
     |                              | socket.emit('message:new') |
     | socket.emit('message:ack')   |                            |
     |<-----------------------------|                            |
```

### 7.3 Group Management

```
Features:
- Create groups with name, description, avatar
- Add/remove members
- Group roles: owner, admin, member
- Group settings (who can post, who can add members)
- Mute group notifications
- Leave group
- Archive/delete group (admin only)
```

### 7.4 Audio/Video Calling

**1:1 Calls (via Grandstream UCM):**
```
- SIP.js registers each online user as a SIP extension
- Audio call: SIP INVITE with audio SDP
- Video call: SIP INVITE with audio+video SDP
- Call controls: hold, mute, transfer, DTMF
- Call history stored in app DB + UCM CDR
```

**Group Video Calls (via UCM6304 built-in video bridge, primary):**
```
- UCM6304 supports up to 40 video participants @1080p (H.264)
- 4 concurrent video rooms available
- Participants join via SIP.js → UCM6304 WebRTC gateway (WSS :8445)
- Screen sharing supported within video bridge
- For most team meetings (≤40 people), UCM handles everything natively
```

**Group Video Calls (via Janus Gateway, overflow for 40+ participants):**
```
- Create Janus VideoRoom only when group exceeds 40 participants
- Each participant joins via WebRTC → Janus SFU
- Simulcast for adaptive quality (low/medium/high)
- Active speaker detection
- Screen sharing as additional video stream
- Used for: all-hands meetings, large department calls
```

**Group Audio Calls (via UCM6304 Conference Bridge):**
```
- Create conference room on UCM6304 via REST API (https://192.168.7.2:8089/api)
- Participants join via SIP.js → UCM6304 conference bridge
- Supports up to 200 audio participants
- Moderator controls: mute all, kick, lock room
```

### 7.5 File Sharing

```
Features:
- Upload files in chat (drag & drop)
- File preview (images, videos, PDFs, code)
- Download files
- Shared file library per group
- File size limit: configurable (default 100MB)
- Storage: local filesystem with organized directory structure
- Virus scanning: ClamAV (optional, open source)

Storage Structure:
/data/files/
  /conversations/{conv_id}/
    /2026/03/
      {uuid}-{original_name}
  /avatars/{user_id}/
  /temp/
```

**Database Tables:**
```sql
files (
  id, original_name, stored_path, mime_type,
  size_bytes, uploaded_by, conversation_id,
  message_id, checksum, created_at
)
```

### 7.6 Presence & Status

```
- Online / Offline / Away / Busy / Do Not Disturb
- Auto-away after inactivity (configurable timeout)
- Custom status message
- Presence tracked in Redis (TTL-based)
- Broadcast to contacts via Socket.IO
```

### 7.7 Notifications

```
- In-app real-time notifications (Socket.IO push)
- Desktop notifications (browser Notification API)
- Audio alerts for calls/messages
- Notification preferences per conversation
- Do Not Disturb mode
- No external push service needed (internal network only)
```

### 7.8 Admin Panel

```
- User management (CRUD, bulk import)
- Group management
- System monitoring (online users, active calls, storage usage)
- SIP extension management (synced with Grandstream)
- File storage management
- Broadcast announcements
- Usage analytics/reports
```

---

## 8. Server Infrastructure Plan

### 8.1 Single Server Deployment (Blank Server)

**Recommended Server Specs (minimum for 300+ users):**

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 8 cores | 16 cores |
| RAM | 16 GB | 32 GB |
| Storage | 500 GB SSD | 1 TB SSD |
| Network | 1 Gbps | 1 Gbps |
| OS | Ubuntu Server 22.04 LTS | Ubuntu Server 22.04 LTS |

### 8.2 Docker Compose Services

```yaml
services:
  nginx          # Reverse proxy, SSL, static files     (Port 443)
  app-server     # Node.js backend (REST + Socket.IO)   (Port 3000)
  janus          # Janus WebRTC Gateway                  (Port 8088, 8188)
  coturn         # STUN/TURN server                      (Port 3478, 5349)
  postgres       # PostgreSQL database                   (Port 5432)
  redis          # Redis cache/pub-sub                   (Port 6379)
```

### 8.3 Network Architecture

```
+--------------------------------------------------+
|              COMPANY INTERNAL NETWORK             |
|                                                   |
|   [Employees]  ----+                              |
|   [Wi-Fi/LAN]      |                              |
|                     v                              |
|              [ Firewall ]                          |
|              (Block all external)                  |
|                     |                              |
|          +----------+-----------+                  |
|          |                      |                  |
|   [Communication Server]  [Grandstream UCM6304]   |
|   IP: 192.168.7.x         IP: 192.168.7.2        |
|   - Nginx (443)            - SIP (5060)           |
|   - Node.js (3000)         - WebRTC WSS (8445)    |
|   - Janus (8088/8188)      - REST API (8089)      |
|   - coturn (3478/5349)                             |
|   - PostgreSQL (5432)                              |
|   - Redis (6379)                                   |
|                                                   |
+--------------------------------------------------+
        FIREWALL: ALL EXTERNAL ACCESS BLOCKED
```

---

## 9. Security Design

### 9.1 Network Security
- All services bind to internal IP addresses only
- Firewall blocks all inbound/outbound external traffic
- VLANs separate communication server from general network (optional)
- All traffic encrypted via TLS (internal CA or self-signed certificates)

### 9.2 Application Security
- JWT-based authentication with refresh tokens
- Password hashing with bcrypt (cost factor 12)
- Rate limiting on all API endpoints
- Input validation & sanitization (prevent XSS, SQL injection)
- CORS restricted to internal domains only
- File upload validation (type, size, content scanning)
- WebSocket authentication with JWT

### 9.3 Data Security
- PostgreSQL encrypted at rest (full disk encryption)
- File storage on encrypted partition
- SIP/RTP media encrypted via DTLS-SRTP (WebRTC default)
- Redis authentication enabled
- Database backups encrypted
- No data leaves internal network

### 9.4 Access Control
- Role-based access control (RBAC)
- Per-conversation access control lists
- Admin audit logs for sensitive operations
- Session timeout and forced re-authentication

---

## 10. Project Directory Structure

```
internal-communication/
├── client/                        # React + Vite Frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/            # Sidebar, Header, Navigation
│   │   │   ├── chat/              # ChatWindow, MessageList, MessageInput
│   │   │   ├── calls/             # CallControls, VideoGrid, Dialer
│   │   │   ├── contacts/          # ContactList, UserProfile
│   │   │   ├── groups/            # GroupList, GroupSettings, CreateGroup
│   │   │   ├── files/             # FileUpload, FilePreview, FileList
│   │   │   ├── notifications/     # NotificationPanel, NotificationItem
│   │   │   ├── admin/             # AdminDashboard, UserManagement
│   │   │   └── common/            # Button, Modal, Avatar, etc.
│   │   ├── services/
│   │   │   ├── api.ts             # REST API client (axios)
│   │   │   ├── socket.ts          # Socket.IO client
│   │   │   ├── sip.ts             # SIP.js — Grandstream integration
│   │   │   ├── janus.ts           # Janus client — group video
│   │   │   └── notification.ts    # Browser notification service
│   │   ├── store/                 # Zustand or Redux state management
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── types/                 # TypeScript interfaces
│   │   ├── utils/                 # Helpers, formatters
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── server/                        # Node.js Backend
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/              # Login, JWT, sessions
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.routes.ts
│   │   │   │   └── auth.middleware.ts
│   │   │   ├── users/             # User CRUD, profile, status
│   │   │   ├── chat/              # Messages, conversations
│   │   │   ├── groups/            # Group CRUD, members
│   │   │   ├── calls/             # Call initiation, history, Janus rooms
│   │   │   ├── files/             # Upload, download, storage
│   │   │   ├── presence/          # Online status, typing indicators
│   │   │   ├── notifications/     # In-app notification delivery
│   │   │   └── admin/             # Admin operations, reports
│   │   ├── services/
│   │   │   ├── socket.service.ts  # Socket.IO event handling
│   │   │   ├── grandstream.service.ts  # UCM REST API integration
│   │   │   ├── janus.service.ts   # Janus room management
│   │   │   └── redis.service.ts   # Redis pub/sub, presence
│   │   ├── database/
│   │   │   ├── migrations/        # SQL migration files
│   │   │   ├── seeds/             # Seed data
│   │   │   └── connection.ts      # PostgreSQL connection pool
│   │   ├── middleware/
│   │   │   ├── auth.ts            # JWT verification
│   │   │   ├── rateLimiter.ts     # Rate limiting
│   │   │   └── validator.ts       # Request validation
│   │   ├── config/
│   │   │   └── index.ts           # Environment configuration
│   │   ├── utils/
│   │   └── app.ts                 # Express app setup
│   ├── tsconfig.json
│   └── package.json
│
├── docker/                        # Docker configurations
│   ├── nginx/
│   │   ├── nginx.conf
│   │   └── ssl/
│   ├── janus/
│   │   ├── Dockerfile
│   │   └── config/
│   │       ├── janus.jcfg
│   │       ├── janus.plugin.videoroom.jcfg
│   │       └── janus.plugin.sip.jcfg
│   ├── coturn/
│   │   └── turnserver.conf
│   └── postgres/
│       └── init.sql
│
├── docker-compose.yml             # Full stack orchestration
├── .env.example                   # Environment variables template
└── README.md
```

---

## 11. API Design Overview

### 11.1 REST API Endpoints

```
AUTH
  POST   /api/auth/login              # Login
  POST   /api/auth/logout             # Logout
  POST   /api/auth/refresh            # Refresh JWT token

USERS
  GET    /api/users                   # List users (with search)
  GET    /api/users/:id               # Get user profile
  PUT    /api/users/:id               # Update profile
  GET    /api/users/:id/status        # Get user status

CONVERSATIONS
  GET    /api/conversations           # List user's conversations
  POST   /api/conversations           # Create direct/group conversation
  GET    /api/conversations/:id       # Get conversation details
  PUT    /api/conversations/:id       # Update conversation settings
  DELETE /api/conversations/:id       # Delete/archive conversation

MESSAGES
  GET    /api/conversations/:id/messages       # Get messages (paginated)
  POST   /api/conversations/:id/messages       # Send message
  PUT    /api/messages/:id                     # Edit message
  DELETE /api/messages/:id                     # Delete message
  POST   /api/messages/:id/reactions           # Add reaction
  GET    /api/conversations/:id/messages/search # Search messages

FILES
  POST   /api/files/upload            # Upload file
  GET    /api/files/:id               # Download file
  GET    /api/files/:id/preview       # Preview file (thumbnail)
  GET    /api/conversations/:id/files # List files in conversation

CALLS
  POST   /api/calls/initiate          # Start a call
  GET    /api/calls/history           # Call history
  POST   /api/calls/group             # Create group call room
  GET    /api/calls/group/:id         # Get group call info

GROUPS
  POST   /api/groups                  # Create group
  PUT    /api/groups/:id              # Update group
  POST   /api/groups/:id/members      # Add members
  DELETE /api/groups/:id/members/:uid # Remove member

ADMIN
  GET    /api/admin/dashboard         # System stats
  GET    /api/admin/users             # All users management
  POST   /api/admin/users/bulk        # Bulk import users
  GET    /api/admin/reports           # Usage reports
```

### 11.2 Socket.IO Events

```
CLIENT → SERVER:
  message:send          # Send message
  message:typing        # Typing indicator
  message:read          # Mark as read
  presence:update       # Update status
  call:signal           # WebRTC signaling

SERVER → CLIENT:
  message:new           # New message received
  message:updated       # Message edited
  message:deleted       # Message deleted
  message:typing        # Someone is typing
  message:read          # Read receipt
  presence:changed      # User status changed
  call:incoming         # Incoming call
  call:signal           # WebRTC signaling
  notification:new      # General notification
  user:online           # User came online
  user:offline          # User went offline
```

---

## 12. Development Phases

### Phase 1: Foundation (Weeks 1-3)
- [ ] Project setup (monorepo, Docker Compose, CI)
- [ ] PostgreSQL schema design and migrations
- [ ] User authentication (JWT + bcrypt)
- [ ] User CRUD API
- [ ] React app shell with routing
- [ ] Nginx + SSL setup
- [ ] Redis connection
- [ ] Socket.IO basic connection

### Phase 2: Real-Time Messaging (Weeks 4-6)
- [ ] 1:1 direct messaging
- [ ] Group conversations
- [ ] Real-time message delivery (Socket.IO + Redis pub/sub)
- [ ] Message history with pagination
- [ ] Typing indicators
- [ ] Read receipts
- [ ] Message search (PostgreSQL full-text)
- [ ] File attachments in chat
- [ ] @mentions
- [ ] Message edit/delete
- [ ] Emoji reactions

### Phase 3: File Sharing (Weeks 7-8)
- [ ] File upload/download API
- [ ] Drag & drop upload in chat
- [ ] Image/video/PDF preview
- [ ] File size limits and validation
- [ ] Per-conversation file library
- [ ] Storage management

### Phase 4: Voice & Video Calling (Weeks 9-13)
- [ ] SIP.js integration with Grandstream UCM
- [ ] 1:1 audio calls (SIP → UCM)
- [ ] 1:1 video calls (SIP → UCM)
- [ ] Call controls (hold, mute, transfer)
- [ ] Janus Gateway setup and configuration
- [ ] Group video calls (Janus VideoRoom)
- [ ] Group audio calls (UCM conference bridge)
- [ ] Screen sharing (Janus)
- [ ] Call history
- [ ] coturn STUN/TURN setup

### Phase 5: Polish & Admin (Weeks 14-16)
- [ ] Admin panel (user management, reports)
- [ ] Desktop notifications
- [ ] Presence system (online/away/busy/DND)
- [ ] Notification preferences
- [ ] Performance optimization
- [ ] Security hardening
- [ ] User documentation

### Phase 6: Testing & Deployment (Weeks 17-18)
- [ ] Load testing (300+ concurrent users)
- [ ] Security audit
- [ ] Deploy to production server
- [ ] User training
- [ ] Go-live

**Estimated Total: ~18 weeks (4.5 months)**

---

## 13. Grandstream UCM Configuration Checklist

Before development starts, configure on the Grandstream UCM:

- [ ] Update firmware to 1.0.29.19 or later (critical for stability)
- [ ] Enable WebRTC Gateway (SIP over WebSocket, WSS port 8445)
- [ ] Enable REST API access (HTTPS port 8089)
- [ ] Generate API credentials (challenge/response MD5 auth)
- [ ] Create SIP extension range for web users (e.g., 1001-1500 of 2,000 max)
- [ ] Enable WebRTC (account_type: SIP(WebRTC)) on each extension template
- [ ] Configure up to 4 video conference rooms (40 participants @1080p)
- [ ] Configure audio conference bridge (200 participants max)
- [ ] Set up SSL certificate on UCM6304 (for WSS on port 8445)
- [ ] Configure SRTP (required for WebRTC, reduces capacity to 200 concurrent)
- [ ] Test SIP.js connection from browser to wss://192.168.7.2:8445/ws
- [ ] Configure call recording storage (SD card or USB 3.0)
- [ ] Enable LDAP directory on UCM6304
- [ ] Verify UCM6304 IP: 192.168.7.2 is reachable from all employee subnets

---

## 14. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| UCM6304 video bridge limit: 40 participants, 4 rooms | Medium | Janus SFU as overflow for 40+ participants (rare for 300-person company) |
| Single server = single point of failure | High | Regular backups, monitoring, future HA plan |
| 300+ concurrent WebSocket connections | Medium | Node.js handles this well; Redis pub/sub scales |
| File storage fills up | Medium | Storage monitoring, cleanup policies, alerts |
| Browser WebRTC compatibility | Low | All modern browsers support WebRTC |
| UCM6304 firmware updates breaking API | Low | Pin firmware at 1.0.29.19, test updates in staging first |
| Network latency within internal network | Low | Internal network = sub-millisecond latency |

---

## 15. Future Enhancements (Post-MVP)

- Mobile app (React Native — same codebase)
- End-to-end encryption for messages
- Message archival and compliance
- Integration with HR systems (auto-onboard/offboard)
- Chatbot / AI assistant integration
- Meeting scheduler with calendar
- Whiteboard for meetings
- High availability (multi-server deployment)

---

## 16. Comparison: Our Platform vs. MS Teams

| Feature | MS Teams | Our Platform |
|---------|----------|-------------|
| 1:1 Chat | Yes | Yes |
| Group Chat | Yes | Yes |
| File Sharing | Yes | Yes |
| 1:1 Audio Call | Yes | Yes (via Grandstream) |
| 1:1 Video Call | Yes | Yes (via Grandstream) |
| Group Video Call | Yes | Yes (UCM6304 up to 40p, Janus for 40+) |
| Screen Sharing | Yes | Yes (via UCM6304 + Janus) |
| Presence/Status | Yes | Yes |
| Notifications | Yes | Yes (in-app + desktop) |
| Search | Yes | Yes (PostgreSQL FTS) |
| Admin Panel | Yes | Yes |
| Internal Network Only | No (cloud) | Yes (fully self-hosted) |
| Data Privacy | Microsoft servers | 100% on-premise |
| Cost | Licensing fees | $0 |
| Customizable | Limited | Fully customizable |

---

*This document is ready for Project Manager review. Once approved, development begins with Phase 1.*
