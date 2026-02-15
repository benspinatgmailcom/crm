# Project: TechConnect CRM

## Purpose
AI-native CRM focused on sales workflow intelligence and automation.

## Stack
Frontend: Next.js (App Router) + Tailwind
Backend: NestJS
DB: PostgreSQL + Prisma
AI: OpenAI Responses API
Storage: Local (future: cloud)
Auth: JWT

## Core Entities
Account
Contact
Lead
Opportunity
Activity
Attachment
User

## Implemented Features
- Entity detail pages
- Lead conversion (creates account/contact/opportunity)
- Activity timeline
- Attachments with text extraction
- AI summaries
- Next best actions
- AI draft email
- Global search
- Quick create
- RBAC (ADMIN/USER/VIEWER)
- Branding system (env-driven theme + logo)

## Conventions
- Activities are the audit/event layer
- AI actions produce activity records
- Opportunity is primary sales object post-conversion

## Current Focus
CRM Essentials → Opportunity Pipeline (Kanban)