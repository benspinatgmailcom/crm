flowchart TB
  %% =======================
  %% LAYERS
  %% =======================
  subgraph UI[Next.js UI]
    UI_PIPE[Pipeline Kanban]
    UI_HEALTH[Pipeline Health Dashboard]
    UI_OPP[Opportunity Detail]
    UI_FU[Follow-ups Panel]
  end

  subgraph API[NestJS API]
    API_OPP[Opportunities Controller/Service]
    API_ACT[Activity Controller/Service]
    API_FU_SVC[FollowUpService]
    API_DRAFT[FollowUpDraftService]
    API_DASH[DashboardService]
    API_USERS[Users Service]
  end

  subgraph INTEL[Intelligence Layer (Pure Modules)]
    AGING[Aging Calculator\n(daysSinceLastTouch, daysInStage)]
    HEALTH[Health Scoring v1\n(score, status, signals)]
    RULES[Follow-up Rules Engine\n(SuggestionSpec[])]
    DEDUPE[Dedupe/Cooldown Logic\n(Activities-based)]
    CONTEXT[Draft Context Builder\n(brief from CRM facts)]
    PROMPT[Prompt + JSON Schema\n(non-hallucination guardrails)]
    FORECAST[Forecast/Probability Engine\n(stage weights + signals)]
  end

  subgraph DATA[(Postgres via Prisma)]
    OPPS[Opportunity\n(ownerId, stage, amount,\nlastActivityAt, lastStageChangedAt,\nnextFollowUpAt, healthSignals/Score*)]
    USERS[User\n(role)]
    ACTS[Activity\n(type, opportunityId,\ncreatedAt, metadata)]
  end

  subgraph SCHED[Schedulers / Triggers]
    CRON[In-process Cron\n(@nestjs/schedule)]
    EVENTS[Event Triggers\n(stage change, activity create)]
  end

  %% =======================
  %% DATA WRITES / READS
  %% =======================
  UI_PIPE -->|GET /opportunities/pipeline| API_OPP
  UI_HEALTH -->|GET /dashboard/pipeline-health| API_DASH
  UI_OPP -->|GET /opportunities/:id| API_OPP
  UI_FU -->|GET /opportunities/:id/followups| API_FU_SVC
  UI_FU -->|POST create-task / complete / dismiss / snooze| API_FU_SVC
  UI_FU -->|POST /followups/:id/draft\nPOST /drafts/:id/mark-sent| API_DRAFT
  UI_HEALTH -->|GET /users (admin)| API_USERS

  API_OPP <-->|read/write| OPPS
  API_USERS <-->|read| USERS
  API_ACT <-->|write/read| ACTS
  API_FU_SVC <-->|write/read| ACTS
  API_DRAFT <-->|write/read| ACTS
  API_DASH <-->|read| OPPS
  API_DASH <-->|read| ACTS
  API_DASH <-->|read| USERS

  %% =======================
  %% INTELLIGENCE FLOW
  %% =======================
  API_OPP --> AGING
  API_OPP --> HEALTH

  HEALTH --> RULES
  AGING --> RULES
  API_FU_SVC --> RULES
  RULES --> DEDUPE
  DEDUPE -->|create followup_suggested| ACTS

  API_DRAFT --> CONTEXT
  CONTEXT --> PROMPT
  PROMPT -->|OpenAI JSON output| API_DRAFT
  API_DRAFT -->|create followup_draft_created\ncreate followup_sent| ACTS

  %% =======================
  %% SCHEDULING
  %% =======================
  CRON -->|daily run| API_FU_SVC
  EVENTS -->|stage change| API_OPP
  EVENTS -->|activity created| API_ACT

  %% =======================
  %% FORECAST (NEXT)
  %% =======================
  API_DASH --> FORECAST
  API_OPP --> FORECAST
  FORECAST -->|probability, category,\nexpectedRevenue| API_DASH

  %% =======================
  %% AUDIT LOOP
  %% =======================
  ACTS -->|touch signals| OPPS
  OPPS -->|improved recency/health| AGING
  OPPS -->|improved score| HEALTH