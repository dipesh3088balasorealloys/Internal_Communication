# BAL Connect — Session Context (April 4, 2026)

## What Was Done in This Session

### 1. Calendar Module (NEW — Complete)
- Created `server/src/database/migrations/006_calendar_events.sql` — calendar_events + event_attendees tables
- Created `server/src/modules/calendar/calendar.routes.ts` — Full CRUD + RSVP + Socket.IO notifications
- Created `client/src/components/calendar/CalendarWindow.tsx` — Week/day view, mini calendar, time grid
- Created `client/src/components/calendar/CreateEventModal.tsx` — Event creation with attendee search
- Registered in `server/src/app.ts`, wired in `AppLayout.tsx`
- Added 'calendar' to uiStore SidebarTab type
- Added Calendar icon between Calls and Email in Sidebar

### 2. Sidebar UI Update
- Icon rail width: 60px → 68px (matches MS Teams)
- Labels added below every icon (Chat, Contacts, Calls, Calendar, Email, Admin, Settings, Logout)
- NavButton height: 40px → 52px with flexDirection column layout

### 3. Email Module Enhancements
- Removed permanent count badges from Sent Items and Deleted Items (only Drafts shows count)
- Removed "Shared Mailboxes" section entirely (it.trainees no longer needed)
- Fixed From address to use user's actual @balasorealloys.in email from DB
- Added email attachment support:
  - Paperclip button opens file picker (multiple files, 25MB max)
  - Attached files shown with name, size, remove button
  - FormData upload for multipart/form-data
  - Backend multer handles file buffers
  - Nodemailer sends as MIME attachments
  - Attachments saved to data/email-attachments/ with UUID filenames
  - `attachments` JSONB column added to sent_emails (migration 008)
  - Download endpoint: GET /api/email/attachment/:fileId
  - IMAP attachment download: GET /api/email/imap-attachment/:uid/:index
  - Download via authenticated API (blob + createObjectURL) — fixes "Access token required" error
- Added email notification sound (playMessageSound) when new inbox emails detected
- Added desktop notification for new emails
- Auto-refresh inbox every 30 seconds (silent, no blink)
- Blue dot read state persisted in localStorage (survives refresh)
- Inbox emails default to unread, Sent/Drafts/Deleted always read

### 4. Stalwart Internal Mail Server (NEW — Complete)
- Added `stalwart` container to docker-compose.yml (stalwartlabs/stalwart:latest)
- Ports: 8080 (admin), 25 (SMTP), 587 (submission), 143 (IMAP), 993 (IMAPS)
- Volume: stalwart_data:/opt/stalwart
- Domain configured: balasorealloys.in
- 10 user accounts created in Stalwart matching BAL Connect users
- Per-user IMAP authentication (each user reads their OWN mailbox)
- Per-user SMTP authentication (each user sends as themselves)
- `mail_password` column added to users table (migration 007) — separate from login password
- Smart SMTP routing:
  - @balasorealloys.in recipients → Stalwart (direct internal delivery)
  - @balasorealloys.com recipients → Office 365 relay (with sender banner + Reply-To)
- Stalwart admin password: D@ipesh2002 (changed by user)
- All mail_password set to: Test@123
- imap.service.ts updated: tls.rejectUnauthorized = false for self-signed cert

### 5. Video Call Improvements
- Camera quality: getUserMedia constraints set to 1920x1080 ideal, 720p min, 30fps
- Audio: echoCancellation, noiseSuppression, autoGainControl enabled
- Screen share: getDisplayMedia set to 1920x1080, 30fps
- Video objectFit: dynamic — 'contain' during screen share, 'cover' for camera
- remoteIsScreenSharing state + screen-share:started/stopped socket events
- Incoming call modal: only shows matching accept button (video call → video accept only, audio → audio only)

### 6. Remote Control / Pointer Annotation (NEW)
- WebRTC DataChannel 'remote-control' created with every call
- sendPointerEvent(callId, {type, x, y}) — sends pointer position as 0-1 percentage
- onPointerEvent callback fires on receiver
- Controller side: mouse hidden, movements/clicks captured and sent via DataChannel
- Sharer side: purple arrow cursor (SVG) with name label + click ripple animation
- Role tracking: 'controller' vs 'sharer' state
- "You are controlling" badge shown to controller

### 7. Call History (CallsWindow)
- Filter chip count badges removed (were permanent, now just labels)
- Three-dot menu button removed (was non-functional placeholder)

### 8. Presence Fix
- Server: changed socket.broadcast.emit to io.emit for online status (user receives their own status)
- Client: onConnect emits presence:heartbeat + presence:update immediately (fixes cached login)

### 9. Bug Fixes
- Conversation creation crash: removed double client.release() in chat.routes.ts (was crashing server)
- Calendar 500 error: replaced DISTINCT + json_agg with EXISTS subquery
- Message creation: added sequence_number with allocate_sequence_number() to system messages
- Pramit's account: password_hash reset, username corrected to pramit.panda
- Aparna's Stalwart login name: fixed from aparnal.samal to aparna.samal

### 10. User Accounts (10 total)
| # | Display Name | Username | Email | Login Password | Mail Password |
|---|-------------|----------|-------|---------------|---------------|
| 1 | Admin User (Dipesh) | admin | dipesh.mondal@balasorealloys.in | (original) | Test@123 |
| 2 | Kamlesh | kamlesh | kamlesh.ojha@balasorealloys.in | (original) | Test@123 |
| 3 | Swastik | swastik | swastik.roychoudhury@balasorealloys.in | (original) | Test@123 |
| 4 | Pramit Kumar Panda | pramit.panda | pramitkumar.panda@balasorealloys.in | Bal@1234 | Test@123 |
| 5 | Aparna Samal | aparna.samal | aparna.samal@balasorealloys.in | Bal@1234 | Test@123 |
| 6 | Harsh Ashish | harsh.ashish | harsh.ashish@balasorealloys.in | Bal@1234 | Test@123 |
| 7 | Janbhi Tripathy | janbhi.tripathy | janbhi.tripathy@balasorealloys.in | Bal@1234 | Test@123 |
| 8 | Prajnashree Pradhan | prajnashree.pradhan | prajnashree.pradhan@balasorealloys.in | Bal@1234 | Test@123 |
| 9 | Sandipan Giri | sandipan.giri | sandipan.giri@balasorealloys.in | Bal@1234 | Test@123 |
| 10 | Sthitaprajnya Sahoo | sthitaprajnya.sahoo | sthitaprajnya.sahoo@balasorealloys.in | Bal@1234 | Test@123 |

### 11. Documentation Created
- `docs/BAL_Connect_Architecture_v2.html` — Full architecture dashboard (updated, SIP removed)
- `docs/BAL_Connect_Architecture_Diagram_v2.html` — 6-layer architecture diagram with data flows
- `docs/BAL_Connect_Process_Flow_v2.html` — 8 end-to-end process flow diagrams
- `docs/BAL_Connect_Email_Server_Proposal.html` — Stalwart proposal for management approval
- `docs/BAL_Connect_V1_Progress_Report_updated_ppt.pptx` — 11-slide PPT (team names, features, cost)
- `ICP_Development_Timeline_.xlsx` — Updated timeline (36/43 tasks, 90% complete, 3 bonus modules)

### 12. Database Migrations
- 006_calendar_events.sql — calendar_events + event_attendees tables
- 007_user_mail_password.sql — mail_password column on users table
- 008_email_attachments.sql — attachments JSONB column on sent_emails

### 13. Docker Compose
- Stalwart container added: stalwartlabs/stalwart:latest
- stalwart_data volume added
- Ports: 8080, 25, 587, 143, 993, 4190

### 14. Environment (.env changes)
- IMAP_HOST=localhost, IMAP_PORT=143, IMAP_SECURE=false, IMAP_USER=admin, IMAP_PASSWORD=40oFsZUAhM
- STALWART_SMTP_HOST=localhost, STALWART_SMTP_PORT=587, STALWART_DOMAIN=balasorealloys.in
- (Note: per-user auth now uses mail_password from DB, not .env)

### 15. Production Deployment Status
- Windows Server 2016 attempted — Docker Linux containers NOT supported
- Docker Desktop failed (requires newer kernel)
- WSL2 not available on Server 2016
- Decision: Install Ubuntu 24.04 LTS (or 25.10 available) on the server
- Infra head to handle OS installation

### 16. Pending / Known Issues
- Group audio/video calls (partial — Socket.IO events + GroupCallOverlay built, mesh/SFU pending)
- coturn TURN server (config ready, deploy on production)
- Nginx + SSL production config
- Production Docker deployment (waiting for Ubuntu on server)
- Rate limiting on auth endpoints
- User documentation / Swagger API docs
- The last error user mentioned was not specified — need screenshot to identify

### 17. Key Architecture Decisions
- SIP/UCM6304 removed (firmware failure) — Pure WebRTC adopted
- Stalwart Community Edition for internal mail (@balasorealloys.in)
- Office 365 kept for executives (@balasorealloys.com) — relay via Stalwart
- mail_password separate from login password (enterprise pattern, SSO-ready)
- Per-user IMAP/SMTP authentication (not shared service account)
- WebRTC DataChannel for remote pointer annotation
- localStorage for email read state persistence
