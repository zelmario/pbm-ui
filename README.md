# PBM UI

Web interface for managing [Percona Backup for MongoDB (PBM)](https://docs.percona.com/percona-backup-mongodb/) 

<img width="1920" height="954" alt="image" src="https://github.com/user-attachments/assets/a5ea97d6-d0c0-4879-b835-44f2a3956066" />



PBM only provides a CLI tool with no REST API or web UI. PBM UI wraps the CLI with a web application that lets you manage backups, restores, PITR, configuration, and logs through your browser.

> **Disclaimer:** This is an independent, community project. It is **not** developed, maintained, or supported by Percona. Use at your own risk.

## Features

- **Dashboard** — Cluster node health, backup list with sizes, PITR toggle, running operations, force resync
- **Backups** — Create logical/physical/incremental backups, view details, cancel running backups
- **PITR** — Enable/disable Point-in-Time Recovery, restore to any point within available ranges using a time slider
- **Restores** — Restore from any backup or PITR point, view restore history with error details
- **Configuration** — Friendly tabs for Storage, PITR, Backup, Restore settings, plus raw JSON editor
- **Logs** — Live log streaming with severity and event filters, follow mode
- **Instances** — Manage multiple PBM instances, see live status (node health, PITR, running ops) at a glance. Click any instance to jump to its dashboard
- **Authentication** — JWT-based auth with change password support

## Quick Start

### Prerequisites

- Docker and Docker Compose
- A MongoDB replica set with PBM agents installed and running
- The MongoDB replica set must be reachable from the PBM UI backend container (see [Networking](#networking))

### 1. Clone and configure

```bash
git clone https://github.com/zelmario/pbm-ui.git
cd pbm-ui
cp .env.example .env
```

Edit `.env` with a secure secret key:

```env
# Generate a strong key: python3 -c "import secrets; print(secrets.token_urlsafe(48))"
SECRET_KEY=your-random-secret-key

# Default admin credentials (used only on first startup)
DEFAULT_ADMIN_USER=admin
DEFAULT_ADMIN_PASSWORD=admin

# Only needed if MongoDB runs on the same Docker host (see Networking below)
# PBM_DOCKER_NETWORK=your-docker-network-name
```

### 2. Start

```bash
docker compose up --build -d
```

If your MongoDB runs in Docker containers on the **same host**, see [Scenario 1](#scenario-1-mongodb-on-the-same-docker-host) — you'll need an extra compose file for networking.

The UI is available at **http://localhost** (port 80).

### 3. Login and add an instance

1. Login with `admin` / `admin` (or whatever you set in `.env`)
2. Go to **Instances** and click **Add Instance**
3. Fill in:
   - **Name**: any label (e.g., "Production RS")
   - **MongoDB URI**: your connection string (see [Networking](#networking) for examples)
   - **PBM Version**: must match your PBM agent version (e.g., `2.7.0`)
4. Click **Create**, then **Test Connection** to verify

## Architecture

```
┌──────────────────┐     ┌──────────────────┐
│   Frontend       │     │   Backend        │
│   React + Vite   │────>│   FastAPI        │
│   Nginx proxy    │     │   Python 3.12    │
│   Port 80        │     │   Port 8000      │
└──────────────────┘     └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │  PBM CLI binary   │
                         │  (downloaded      │
                         │   on-demand)      │
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │  MongoDB RS       │
                         │  + PBM agents     │
                         └──────────────────┘
```

- **Frontend**: React 18, TypeScript, Mantine UI, TanStack Query, served by Nginx which proxies `/api` to the backend
- **Backend**: FastAPI with async SQLAlchemy (SQLite for config storage). Executes `pbm` CLI commands against the MongoDB URI
- **PBM binary**: Downloaded on-demand per instance version, cached in a Docker volume. No need to install PBM in the backend container
- **No SSH**: The PBM binary runs locally in the backend container and connects to MongoDB directly via URI

## Networking

PBM UI does **not** run PBM agents or connect via SSH. It runs the `pbm` CLI binary inside the backend container, which connects to MongoDB via the URI you provide. This means:

- The backend container needs **TCP access to port 27017** (or your custom port) on **every** replica set member
- The hostnames or IPs used in the MongoDB URI must be **resolvable and reachable** from the backend container

Below are the most common deployment scenarios.

### Scenario 1: MongoDB on the same Docker host

When MongoDB runs in Docker containers on the same machine (typical for development/testing), PBM UI needs to join the same Docker network so it can reach the containers by name.

1. Find your MongoDB Docker network:
   ```bash
   docker inspect <mongodb-container> --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}'
   ```

2. Set it in `.env`:
   ```env
   PBM_DOCKER_NETWORK=your-mongodb-network
   ```

3. Start with the network override:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.network.yml up --build -d
   ```

4. When adding the instance, use **container names** in the URI:
   ```
   mongodb://user:pass@node0:27017,node1:27017,node2:27017/?authSource=admin&replicaSet=rs0
   ```

### Scenario 2: MongoDB on remote servers (VMs, bare metal, cloud)

When MongoDB runs on separate hosts accessible over the network, no special Docker network is needed. Use the base `docker-compose.yml`:

```bash
docker compose up --build -d
```

When adding the instance, use the **hostnames or IPs** of your MongoDB nodes:

```
mongodb://user:pass@db1.example.com:27017,db2.example.com:27017,db3.example.com:27017/?authSource=admin&replicaSet=rs0
```

Requirements:
- Port 27017 must be open in firewalls / security groups from the PBM UI host to each MongoDB node
- Hostnames must be resolvable from the PBM UI host (DNS or `/etc/hosts`)

### Scenario 3: MongoDB on a different Docker host

When MongoDB runs in Docker containers on a **different** machine, you cannot share Docker networks across hosts. Treat this like Scenario 2 — use the IPs or hostnames of the remote machine.

However, there's a common gotcha: **replica set member hostnames**. MongoDB replica set members advertise themselves using the hostnames configured in `rs.conf()`. If those are container names (e.g., `node0`), they won't be resolvable from the PBM UI host.

Check what your replica set advertises:
```javascript
rs.conf().members.forEach(m => print(m.host))
```

If the output shows container names or internal hostnames, you have two options:
- **Reconfigure the replica set** to advertise reachable IPs/hostnames
- **Add entries to `/etc/hosts`** on the PBM UI host (or in the backend container via `extra_hosts` in `docker-compose.yml`)

Example using `extra_hosts`:
```yaml
# docker-compose.override.yml
services:
  backend:
    extra_hosts:
      - "node0:192.168.1.10"
      - "node1:192.168.1.11"
      - "node2:192.168.1.12"
```

### Scenario 4: Managing multiple replica sets

PBM UI supports multiple instances. Each instance is an independent PBM connection. You can mix scenarios — for example, one instance pointing to local Docker containers and another to a remote datacenter — as long as the backend container can reach all of them.

Each replica set needs its own PBM agents installed and configured independently. PBM UI only provides the web interface; it does not deploy or configure PBM agents.

## Data Persistence

All persistent data is stored in **Docker named volumes**:

| Volume | Contents | Purpose |
|--------|----------|---------|
| `pbm_data` | SQLite database | Users, instance configurations |
| `pbm_bins` | PBM CLI binaries | Cached downloads per version |

- `docker compose down` preserves volumes — your data is safe
- `docker compose down -v` **deletes volumes** — all data lost
- Rebuilding containers (`docker compose up --build`) keeps existing data

To back up the database:
```bash
docker compose cp backend:/app/data/pbm_ui.db ./pbm_ui_backup.db
```

## Authentication

- Default login: `admin` / `admin`
- Change your password: click the user icon (top-right) > **Change Password**
- JWT tokens expire after 24 hours
- Default credentials are only used on first startup to seed the database. Changing them in `.env` after the initial startup has no effect — use the Change Password feature instead

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | `change-me-in-...` | JWT signing key. **Change in production** |
| `DEFAULT_ADMIN_USER` | `admin` | Initial admin username (first startup only) |
| `DEFAULT_ADMIN_PASSWORD` | `admin` | Initial admin password (first startup only) |
| `PBM_DOCKER_NETWORK` | *(none)* | External Docker network to join (only with `docker-compose.network.yml`) |

## MongoDB User Requirements

The MongoDB user in the connection URI needs these roles:

- `root` — for PBM operations
- `__system` — required for restore operations on MongoDB 8.0+

```javascript
db.createUser({
  user: "pbm",
  pwd: "secret",
  roles: [
    { role: "root", db: "admin" },
    { role: "__system", db: "admin" }
  ]
})
```

## Scope

PBM UI is designed for **replica set** deployments. Sharded cluster support is not included.

## Development

To run the frontend and backend locally (outside Docker):

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs on port 5173 and proxies `/api` to the backend on port 8000.
