"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { canWrite } from "@/lib/roles";
import { Modal } from "@/components/ui/modal";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { EntityAttachments } from "@/components/attachments/entity-attachments";
import { leadSchema, type LeadFormData } from "@/lib/validation";

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  status: string | null;
  source: string | null;
  convertedAccountId?: string | null;
  convertedContactId?: string | null;
  convertedOpportunityId?: string | null;
  convertedAt?: string | null;
}

interface ConvertLeadResult {
  leadId: string;
  accountId: string;
  contactId: string;
  opportunityId: string;
  initialTaskActivityId: string;
}

const STATUS_OPTIONS = ["new", "contacted", "qualified", "disqualified"];

export default function LeadDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const canEdit = canWrite(user?.role);
  const id = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertAccountName, setConvertAccountName] = useState("");
  const [convertOpportunityName, setConvertOpportunityName] = useState("");
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [formData, setFormData] = useState<LeadFormData>({
    name: "",
    email: "",
    company: "",
    status: "new",
    source: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchLead = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const l = await apiFetch<Lead>(`/leads/${id}`);
      setLead(l);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      setError(e.status === 404 ? "Lead not found" : e.message || "Failed to load lead");
      setLead(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  const openConvertModal = () => {
    setConvertAccountName(lead?.company || lead?.name || "");
    setConvertOpportunityName(
      lead?.company ? `${lead.company} - New opportunity` : `Opportunity from ${lead?.name || ""}`
    );
    setConvertError(null);
    setConvertModalOpen(true);
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    setConverting(true);
    setConvertError(null);
    try {
      const body: { accountName?: string; opportunityName?: string } = {};
      if (convertAccountName.trim()) body.accountName = convertAccountName.trim();
      if (convertOpportunityName.trim()) body.opportunityName = convertOpportunityName.trim();
      await apiFetch<ConvertLeadResult>(`/leads/${lead.id}/convert`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setConvertModalOpen(false);
      fetchLead();
      setTimelineRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const e = err as { body?: { message?: string }; message?: string };
      setConvertError(e.body?.message || e.message || "Conversion failed");
    } finally {
      setConverting(false);
    }
  };

  const openEdit = () => {
    if (!lead) return;
    setFormData({
      name: lead.name,
      email: lead.email,
      company: lead.company || "",
      status: lead.status || "new",
      source: lead.source || "",
    });
    setFormErrors({});
    setSubmitError(null);
    setEditModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    setFormErrors({});
    setSubmitError(null);
    const parsed = leadSchema.safeParse({
      ...formData,
      company: formData.company || undefined,
      status: formData.status || undefined,
      source: formData.source || undefined,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        const p = err.path[0] as string;
        if (p && !errs[p]) errs[p] = err.message;
      });
      setFormErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch(`/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      setEditModalOpen(false);
      fetchLead();
    } catch (err: unknown) {
      const e = err as { body?: { message?: string } };
      setSubmitError(e.body?.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !lead) {
    return (
      <div>
        <Link href="/leads" className="text-sm text-accent-1 hover:underline">
          ← Back to Leads
        </Link>
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div>
        <Link href="/leads" className="text-sm text-accent-1 hover:underline">
          ← Back to Leads
        </Link>
        <p className="mt-4 text-red-600">{error || "Lead not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leads" className="text-sm text-accent-1 hover:underline">
          ← Back to Leads
        </Link>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{lead.name}</h1>
            <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-600">
              {lead.company && <span>{lead.company}</span>}
              {lead.status === "converted" ? (
                <span className="rounded bg-green-100 px-2 py-0.5 font-medium text-green-800">Converted</span>
              ) : (
                lead.status && (
                  <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                    {lead.status}
                  </span>
                )
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-sm">
              <a href={`mailto:${lead.email}`} className="text-accent-1 hover:underline">
                {lead.email}
              </a>
              {lead.source && <span className="text-gray-500">Source: {lead.source}</span>}
            </div>
          </div>
          {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openEdit}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Edit Lead
            </button>
          </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Lead details</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">{lead.name}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-900">
                  <a href={`mailto:${lead.email}`} className="text-accent-1 hover:underline">
                    {lead.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Company</dt>
                <dd className="text-gray-900">{lead.company ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd className="text-gray-900">{lead.status ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Source</dt>
                <dd className="text-gray-900">{lead.source ?? "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Convert Lead</h2>
            {lead.convertedAt ? (
              <div className="space-y-3 text-sm">
                <p className="text-gray-700">This lead has been converted.</p>
                <div className="flex flex-wrap gap-2">
                  {lead.convertedAccountId && (
                    <Link
                      href={`/accounts/${lead.convertedAccountId}`}
                      className="text-accent-1 hover:underline"
                    >
                      View Account
                    </Link>
                  )}
                  {lead.convertedContactId && (
                    <Link
                      href={`/contacts/${lead.convertedContactId}`}
                      className="text-accent-1 hover:underline"
                    >
                      View Contact
                    </Link>
                  )}
                  {lead.convertedOpportunityId && (
                    <Link
                      href={`/opportunities/${lead.convertedOpportunityId}`}
                      className="text-accent-1 hover:underline"
                    >
                      View Opportunity
                    </Link>
                  )}
                </div>
                <p className="text-gray-600">
                  Initial task created: <strong>Schedule discovery call</strong> —{" "}
                  {lead.convertedOpportunityId && (
                    <Link
                      href={`/opportunities/${lead.convertedOpportunityId}`}
                      className="text-accent-1 hover:underline"
                    >
                      View on Opportunity timeline
                    </Link>
                  )}
                </p>
              </div>
            ) : canEdit ? (
              <>
                <p className="mb-3 text-sm text-gray-500">
                  Convert this lead to an Account, Contact, and Opportunity.
                </p>
                <button
                  type="button"
                  onClick={openConvertModal}
                  className="rounded-md bg-accent-1 px-3 py-2 text-sm font-medium text-white hover:brightness-90"
                >
                  Convert to Account & Contact
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-500">You do not have permission to convert leads.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <EntityAttachments
            entityType="lead"
            entityId={lead.id}
            onUploadSuccess={() => setTimelineRefreshKey((k) => k + 1)}
          />
          <ActivityTimeline
            entityType="lead"
            entityId={lead.id}
            refreshTrigger={timelineRefreshKey}
            draftEmailConfig={{ defaultRecipientEmail: lead.email }}
          />
        </div>
      </div>

      <Modal isOpen={convertModalOpen} onClose={() => setConvertModalOpen(false)} title="Convert Lead">
        <form onSubmit={handleConvert} className="space-y-4">
          {convertError && <p className="text-sm text-red-600">{convertError}</p>}
          <p className="text-sm text-gray-600">
            Create an Account, Contact, and Opportunity from this lead. An initial task &quot;Schedule
            discovery call&quot; will be added to the Opportunity timeline.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700">Account name</label>
            <input
              value={convertAccountName}
              onChange={(e) => setConvertAccountName(e.target.value)}
              placeholder={lead?.company || lead?.name || ""}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Opportunity name</label>
            <input
              value={convertOpportunityName}
              onChange={(e) => setConvertOpportunityName(e.target.value)}
              placeholder={
                lead?.company ? `${lead.company} - New opportunity` : `Opportunity from ${lead?.name || ""}`
              }
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setConvertModalOpen(false)}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={converting}
              className="rounded bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90 disabled:opacity-50"
            >
              {converting ? "Converting…" : "Convert"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Lead">
        <form onSubmit={handleSubmit} className="space-y-4">
          {(submitError || formErrors._) && (
            <p className="text-sm text-red-600">{submitError || formErrors._}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Name *</label>
            <input
              value={formData.name}
              onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            {formErrors.name && <p className="mt-0.5 text-sm text-red-600">{formErrors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            {formErrors.email && <p className="mt-0.5 text-sm text-red-600">{formErrors.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Company</label>
            <input
              value={formData.company}
              onChange={(e) => setFormData((d) => ({ ...d, company: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData((d) => ({ ...d, status: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Source</label>
            <input
              value={formData.source}
              onChange={(e) => setFormData((d) => ({ ...d, source: e.target.value }))}
              placeholder="e.g. website, referral"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-accent-1 px-4 py-2 text-sm font-medium text-white hover:brightness-90 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
