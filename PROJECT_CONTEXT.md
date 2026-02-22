# Project: Bespoke CRM

## Vision
AI-native deal intelligence platform for modern sales workflows.
Not just a CRUD CRM — focused on pipeline clarity, automation, and AI insight.
Ultimately, this will be part of a project called "Bespoke CRM", where we start with a complete, but generic, modern light-weight CRM created with an API-backed and AI-native architecture, which can be inexpensively deployed in a public cloud environment.  Using this as a starting point, the CRM can then be cloned and customized for the needs and specific client organizations.  These customizations will be efficiently development using "vibe coding".  Clients will enjoy a simple, scalable, AI-native CRM which is tailored to their precise requirements, but which is much more cost-effective and open than the current SaaS CRM offerings such as Salesforce.com.

---

## Current Phase
Transitioning from feature build to Production Readiness & Deployment.

---

## Stack

### Frontend
- Next.js (App Router)
- Tailwind CSS
- DnD Kit (pipeline drag/drop)
- JWT auth
- Env-driven theming (accent colors + logo)

### Backend
- NestJS
- Prisma ORM
- PostgreSQL
- OpenAI Responses API
- Role-based auth (ADMIN / USER / VIEWER)

### Storage
- Local (dev)
- Planned: S3/R2/Vercel Blob

---

## Core Entities
Account
Contact
Lead
Opportunity
Activity
Attachment
User

---

## Architecture Conventions

- Activities are the event/audit layer.
- AI features create Activity records.
- Opportunity is the primary object post-lead conversion.
- Stage changes create `stage_change` activities.
- Lead conversion creates Account + Contact + Opportunity + Task.
- Inline pipeline edits PATCH the Opportunity directly.

---

## Code Structure

/apps
  /web
    /app
      /(dashboard)
      /opportunities
      /accounts
      /contacts
      /leads
      /settings
    /components
    /lib
  /api
    /src
      /auth
      /users
      /accounts
      /contacts
      /leads
      /opportunities
      /activities
      /attachments
      /ai

/packages
  /db (Prisma schema + migrations)

Key APIs:
- GET /opportunities/pipeline
- POST /ai/draft-email
- POST /leads/:id/convert
- GET /search
- PATCH /opportunities/:id

---

## Implemented Features

### CRM Essentials
- Entity detail pages (dedicated routes)
- Global search
- Quick create
- Opportunity Kanban
- Pipeline totals & weighted forecast
- Pipeline filters
- Inline card editing
- Stage change reason modal
- Lead conversion workflow
- Attachment uploads
- Activity timeline

### AI Features
- AI summaries
- Next best actions
- AI draft email

### Admin
- User management (create, role update, deactivate, reset password)
- RBAC enforcement

### Branding
- Env-driven accent colors
- Logo support
- Dark header theme
- Favicon + manifest

---

# Production Deployment Architecture

## Environment Topology

### Web (Frontend)
- Platform: Vercel
- Root Directory: `apps/web`
- Framework Preset: Next.js
- Build: Default Next.js build
- Environment Variables:
  - `NEXT_PUBLIC_API_URL` → Render API URL

### API (Backend)
- Platform: Render (Docker Web Service)
- Runtime: Node 22
- Start Command:

---

# Roadmap

## Phase 1 – Production Readiness
- Deploy web + API
- Managed Postgres
- Blob storage
- Env validation
- AI rate limiting
- Logging & monitoring
- Backups
- Password reset via email
- Audit log

## Phase 2 – Workflow Intelligence
- Deal aging detection
- Pipeline health dashboard
- Stage probability editing
- Win/loss reporting
- Auto follow-up tasks
- Notifications

## Phase 3 – AI Differentiation
- AI deal brief
- Risk scoring
- Relationship mapping
- Auto meeting ingestion
- Long-term account memory

## Phase 4 – Collaboration
- Mentions
- Comments
- Slack/email integration
- Calendar sync

## Phase 5 – Commercialization
- Multi-tenant support
- Billing tiers
- AI usage metering
- Public API

---

## Observability (optional Sentry)

Env vars for future Sentry integration (no vendor required until configured):

**API (NestJS)**  
- `SENTRY_DSN` – project DSN  
- `SENTRY_ENVIRONMENT` – e.g. `development` | `staging` | `production`  
- `SENTRY_RELEASE` – optional release/version

**Web (Next.js)**  
- `NEXT_PUBLIC_SENTRY_DSN` – project DSN (client)  
- `SENTRY_DSN` – server DSN  
- `SENTRY_ENVIRONMENT`  
- `SENTRY_RELEASE` – optional