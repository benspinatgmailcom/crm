"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import type { Event } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { canWrite, isAdmin } from "@/lib/roles";
import { Modal } from "@/components/ui/modal";
import { Check, X, ExternalLink, CalendarClock } from "lucide-react";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { "en-US": enUS },
});

// --- Data types ---
interface TaskItem {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  dueAt: string | null;
  status: string;
  priority: string | null;
  ownerEmail: string | null;
  entityName?: string;
}

interface FollowupItem {
  kind: "suggestion" | "openTask";
  id: string;
  opportunityId: string;
  opportunityName: string;
  ownerEmail: string | null;
  title: string;
  description?: string;
  dueAt: string;
  snoozedUntil?: string;
  severity?: string;
}

interface CalendarEvent extends Event {
  start: Date;
  end: Date;
  title: string;
  resource: {
    type: "task" | "suggestion" | "openTask";
    id: string;
    task?: TaskItem;
    followup?: FollowupItem;
  };
}

// --- Helpers ---
function toEvent(task: TaskItem): CalendarEvent | null {
  if (!task.dueAt) return null;
  const start = new Date(task.dueAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    start,
    end,
    title: task.title,
    resource: { type: "task", id: task.id, task },
  };
}

function followupToEvent(f: FollowupItem): CalendarEvent {
  const start = new Date(f.dueAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    start,
    end,
    title: f.title,
    resource: {
      type: f.kind === "suggestion" ? "suggestion" : "openTask",
      id: f.id,
      followup: f,
    },
  };
}

export default function CalendarPage() {
  const { user } = useAuth();
  const canEdit = canWrite(user?.role);
  const admin = isAdmin(user?.role);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [followups, setFollowups] = useState<FollowupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assignee, setAssignee] = useState<"me" | "all" | "user">("me");
  const [userId, setUserId] = useState("");
  const [showTasks, setShowTasks] = useState(true);
  const [showFollowups, setShowFollowups] = useState(true);
  const [showOnlyOpenTasks, setShowOnlyOpenTasks] = useState(true);
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [currentView, setCurrentView] = useState<"month" | "week">("month");

  const assigneeParam =
    assignee === "me" ? "me" : assignee === "all" ? "all" : assignee === "user" && userId ? userId : "me";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [openRes, doneRes, followupsRes] = await Promise.all([
        apiFetch<{ data: TaskItem[] }>(
          `/tasks?assignee=${assigneeParam}&page=1&pageSize=100&status=open`
        ),
        apiFetch<{ data: TaskItem[] }>(
          `/tasks?assignee=${assigneeParam}&page=1&pageSize=100&status=done`
        ),
        apiFetch<{ items: FollowupItem[] }>(`/followups?assignee=${assigneeParam}`),
      ]);
      const openTasks = openRes.data ?? [];
      const doneTasks = doneRes.data ?? [];
      setTasks([...openTasks, ...doneTasks]);
      setFollowups(followupsRes.items ?? []);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message ?? "Failed to load calendar data");
      setTasks([]);
      setFollowups([]);
    } finally {
      setLoading(false);
    }
  }, [assigneeParam]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (admin) {
      apiFetch<{ id: string; email: string }[]>("/users/active")
        .then(setUsers)
        .catch(() => setUsers([]));
    }
  }, [admin]);

  const events: CalendarEvent[] = useMemo(() => {
    const list: CalendarEvent[] = [];
    if (showTasks) {
      tasks.forEach((t) => {
        if (showOnlyOpenTasks && t.status === "done") return;
        const ev = toEvent(t);
        if (ev) list.push(ev);
      });
    }
    if (showFollowups) {
      followups.forEach((f) => list.push(followupToEvent(f)));
    }
    return list.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [tasks, followups, showTasks, showFollowups, showOnlyOpenTasks]);

  const runAction = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        setSelectedEvent(null);
        await fetchData();
      } finally {
        setActionId(null);
      }
    },
    [fetchData]
  );

  const handleCompleteTask = (taskId: string) => {
    if (!canEdit) return;
    setActionId(taskId);
    runAction(() =>
      apiFetch(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
      })
    );
  };

  const handleSnoozeTask = (taskId: string, days: number) => {
    if (!canEdit) return;
    const d = new Date();
    d.setDate(d.getDate() + days);
    setActionId(taskId);
    runAction(() =>
      apiFetch(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ dueAt: d.toISOString() }),
      })
    );
  };

  const handleCreateTaskFromSuggestion = (suggestionId: string) => {
    if (!canEdit) return;
    setActionId(suggestionId);
    runAction(() => apiFetch(`/followups/${suggestionId}/create-task`, { method: "POST" }));
  };

  const handleCompleteFollowupTask = (taskActivityId: string) => {
    if (!canEdit) return;
    setActionId(taskActivityId);
    runAction(() => apiFetch(`/tasks/${taskActivityId}/complete`, { method: "POST" }));
  };

  const handleDismissFollowupTask = (taskActivityId: string) => {
    if (!canEdit) return;
    setActionId(taskActivityId);
    runAction(() => apiFetch(`/tasks/${taskActivityId}/dismiss`, { method: "POST" }));
  };

  const handleSnoozeFollowupTask = (taskActivityId: string, days: number) => {
    if (!canEdit) return;
    const d = new Date();
    d.setDate(d.getDate() + days);
    setActionId(taskActivityId);
    runAction(() =>
      apiFetch(`/tasks/${taskActivityId}/snooze`, {
        method: "POST",
        body: JSON.stringify({ until: d.toISOString() }),
      })
    );
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const type = event.resource?.type;
    let bg: string;
    if (type === "suggestion") {
      bg = "#6366f1";
    } else if (type === "openTask") {
      bg = "#059669";
    } else if (type === "task" && event.resource?.task) {
      const priority = (event.resource.task.priority ?? "").toLowerCase();
      if (priority === "high") bg = "#dc2626";
      else if (priority === "medium") bg = "#d97706";
      else if (priority === "low") bg = "#64748b";
      else bg = "#3174ad";
    } else {
      bg = "#3174ad";
    }
    return { style: { backgroundColor: bg } };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Calendar</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tasks and follow-ups by due date. Click an event to view details and actions.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500">Assignee</label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value as "me" | "all" | "user")}
              className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="me">My</option>
              <option value="all">All</option>
              {admin && <option value="user">Specific user</option>}
            </select>
          </div>
          {admin && assignee === "user" && (
            <div>
              <label className="block text-xs font-medium text-gray-500">User</label>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="mt-1 min-w-[180px] rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select user</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showTasks}
                onChange={(e) => setShowTasks(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>Tasks</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showFollowups}
                onChange={(e) => setShowFollowups(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>Follow-ups</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showOnlyOpenTasks}
                onChange={(e) => setShowOnlyOpenTasks(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>Only open tasks</span>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="inline-block h-3 w-3 rounded bg-[#dc2626]" /> High
            <span className="inline-block h-3 w-3 rounded bg-[#d97706]" /> Medium
            <span className="inline-block h-3 w-3 rounded bg-[#64748b]" /> Low
            <span className="inline-block h-3 w-3 rounded bg-[#6366f1]" /> Suggestion
            <span className="inline-block h-3 w-3 rounded bg-[#059669]" /> Open task
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading calendar…</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm" style={{ minHeight: 600 }}>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            titleAccessor="title"
            view={currentView}
            views={["month", "week"]}
            date={currentDate}
            onNavigate={(newDate) => setCurrentDate(newDate)}
            onView={(view) => setCurrentView(view as "month" | "week")}
            onSelectEvent={(ev) => setSelectedEvent(ev as CalendarEvent)}
            eventPropGetter={eventStyleGetter}
            style={{ height: 600 }}
          />
        </div>
      )}

      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.title ?? "Event"}
      >
        {selectedEvent && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {selectedEvent.resource.type === "task" && selectedEvent.resource.task && (
                <>
                  Due: {format(selectedEvent.start, "PPP p")}
                  {selectedEvent.resource.task.ownerEmail && (
                    <> · Assignee: {selectedEvent.resource.task.ownerEmail}</>
                  )}
                  {selectedEvent.resource.task.entityName && (
                    <>
                      {" "}
                      ·{" "}
                      <Link
                        href={
                          selectedEvent.resource.task.entityType === "opportunity"
                            ? `/opportunities/${selectedEvent.resource.task.entityId}`
                            : selectedEvent.resource.task.entityType === "account"
                              ? `/accounts/${selectedEvent.resource.task.entityId}`
                              : selectedEvent.resource.task.entityType === "lead"
                                ? `/leads/${selectedEvent.resource.task.entityId}`
                                : "#"
                        }
                        className="text-accent-1 hover:underline inline-flex items-center gap-1"
                      >
                        {selectedEvent.resource.task.entityName}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </>
                  )}
                </>
              )}
              {selectedEvent.resource.type === "suggestion" && selectedEvent.resource.followup && (
                <>
                  Due: {format(selectedEvent.start, "PPP p")}
                  {" · "}
                  <Link
                    href={`/opportunities/${selectedEvent.resource.followup.opportunityId}`}
                    className="text-accent-1 hover:underline inline-flex items-center gap-1"
                  >
                    {selectedEvent.resource.followup.opportunityName}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  {selectedEvent.resource.followup.severity && (
                    <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                      {selectedEvent.resource.followup.severity}
                    </span>
                  )}
                </>
              )}
              {selectedEvent.resource.type === "openTask" && selectedEvent.resource.followup && (
                <>
                  Due: {format(selectedEvent.start, "PPP p")}
                  {" · "}
                  <Link
                    href={`/opportunities/${selectedEvent.resource.followup.opportunityId}`}
                    className="text-accent-1 hover:underline inline-flex items-center gap-1"
                  >
                    {selectedEvent.resource.followup.opportunityName}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </>
              )}
            </p>

            {canEdit && (
              <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-3">
                {selectedEvent.resource.type === "task" && (
                  <>
                    {selectedEvent.resource.task?.status !== "done" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCompleteTask(selectedEvent.resource.id)}
                          disabled={actionId === selectedEvent.resource.id}
                          className="inline-flex items-center gap-1 rounded border border-emerald-600 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                          Complete
                        </button>
                        <div className="inline-flex rounded border border-gray-300 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => handleSnoozeTask(selectedEvent.resource.id, 1)}
                            disabled={actionId === selectedEvent.resource.id}
                            className="px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            +1 day
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSnoozeTask(selectedEvent.resource.id, 3)}
                            disabled={actionId === selectedEvent.resource.id}
                            className="border-l border-gray-300 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            +3 days
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSnoozeTask(selectedEvent.resource.id, 7)}
                            disabled={actionId === selectedEvent.resource.id}
                            className="border-l border-gray-300 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            +1 week
                          </button>
                        </div>
                      </>
                    )}
                    <Link
                      href="/tasks"
                      className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <CalendarClock className="h-4 w-4" />
                      View in Tasks
                    </Link>
                  </>
                )}
                {selectedEvent.resource.type === "suggestion" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleCreateTaskFromSuggestion(selectedEvent.resource.id)}
                      disabled={actionId === selectedEvent.resource.id}
                      className="inline-flex items-center gap-1 rounded border border-accent-1 bg-white px-3 py-1.5 text-sm font-medium text-accent-1 hover:bg-accent-1/5 disabled:opacity-50"
                    >
                      {actionId === selectedEvent.resource.id ? "Creating…" : "Create task"}
                    </button>
                    <Link
                      href={
                        selectedEvent.resource.followup
                          ? `/opportunities/${selectedEvent.resource.followup.opportunityId}`
                          : "/followups"
                      }
                      className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open opportunity
                    </Link>
                  </>
                )}
                {selectedEvent.resource.type === "openTask" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleCompleteFollowupTask(selectedEvent.resource.id)}
                      disabled={actionId === selectedEvent.resource.id}
                      className="inline-flex items-center gap-1 rounded border border-emerald-600 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismissFollowupTask(selectedEvent.resource.id)}
                      disabled={actionId === selectedEvent.resource.id}
                      className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      Dismiss
                    </button>
                    <div className="inline-flex rounded border border-gray-300 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleSnoozeFollowupTask(selectedEvent.resource.id, 1)}
                        disabled={actionId === selectedEvent.resource.id}
                        className="px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        +1d
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSnoozeFollowupTask(selectedEvent.resource.id, 3)}
                        disabled={actionId === selectedEvent.resource.id}
                        className="border-l border-gray-300 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        +3d
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSnoozeFollowupTask(selectedEvent.resource.id, 7)}
                        disabled={actionId === selectedEvent.resource.id}
                        className="border-l border-gray-300 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        +1w
                      </button>
                    </div>
                    <Link
                      href={
                        selectedEvent.resource.followup
                          ? `/opportunities/${selectedEvent.resource.followup.opportunityId}`
                          : "/followups"
                      }
                      className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open opportunity
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
