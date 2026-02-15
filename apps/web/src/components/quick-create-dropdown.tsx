"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { canWrite } from "@/lib/roles";
import { AddActivityModal } from "@/components/activity/add-activity-modal";
import type { ActivityEntityType } from "@/components/activity/entity-activity-timeline";
import { QuickCreateAttachmentModal } from "./quick-create-attachment-modal";
import { EntityPickerModal } from "./entity-picker-modal";

type CreateType = "account" | "contact" | "lead" | "opportunity" | "activity" | "attachment";

const ITEMS: { type: CreateType; label: string }[] = [
  { type: "account", label: "Account" },
  { type: "contact", label: "Contact" },
  { type: "lead", label: "Lead" },
  { type: "opportunity", label: "Opportunity" },
  { type: "activity", label: "Activity" },
  { type: "attachment", label: "Attachment" },
];

function parseEntityFromPath(pathname: string): { entityType: ActivityEntityType; entityId: string } | null {
  const m = pathname.match(/^\/(accounts|contacts|leads|opportunities)\/([^/]+)$/);
  if (!m) return null;
  return { entityType: m[1] as ActivityEntityType, entityId: m[2] };
}

export function QuickCreateDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [entityPickerOpen, setEntityPickerOpen] = useState(false);
  const [entityPickerFor, setEntityPickerFor] = useState<"activity" | "attachment" | null>(null);
  const [pickedEntity, setPickedEntity] = useState<{ entityType: ActivityEntityType; entityId: string } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const entityContext = parseEntityFromPath(pathname);
  const canCreate = canWrite(user?.role);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        open &&
        panelRef.current &&
        buttonRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (type: CreateType) => {
    setOpen(false);
    switch (type) {
      case "account":
        router.push("/accounts?create=1");
        break;
      case "contact":
        router.push("/contacts?create=1");
        break;
      case "lead":
        router.push("/leads?create=1");
        break;
      case "opportunity":
        router.push("/opportunities?create=1");
        break;
      case "activity":
        if (entityContext) {
          setActivityModalOpen(true);
        } else {
          setEntityPickerFor("activity");
          setEntityPickerOpen(true);
        }
        break;
      case "attachment":
        if (entityContext) {
          setAttachmentModalOpen(true);
        } else {
          setEntityPickerFor("attachment");
          setEntityPickerOpen(true);
        }
        break;
    }
  };

  const handleActivitySuccess = () => {
    setActivityModalOpen(false);
    setPickedEntity(null);
    router.refresh();
  };

  const handleAttachmentSuccess = () => {
    setAttachmentModalOpen(false);
    setPickedEntity(null);
    router.refresh();
  };

  const activityEntity = entityContext ?? pickedEntity;

  const handleEntityPickerSelect = (entityType: ActivityEntityType, entityId: string) => {
    setEntityPickerOpen(false);
    setPickedEntity({ entityType, entityId });
    if (entityPickerFor === "activity") {
      setActivityModalOpen(true);
    } else if (entityPickerFor === "attachment") {
      setAttachmentModalOpen(true);
    }
    setEntityPickerFor(null);
  };

  if (!canCreate) return null;

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 rounded-lg border border-white/15 bg-accent-1/20 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-1/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-1/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span className="text-lg leading-none">+</span> Create
        </button>
        {open && (
          <div
            ref={panelRef}
            className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-white/10 bg-slate-900 py-1 shadow-xl"
          >
            {ITEMS.map(({ type, label }) => (
              <button
                key={type}
                type="button"
                onClick={() => handleSelect(type)}
                className="flex w-full px-3 py-2 text-left text-sm text-white/90 transition-colors hover:bg-white/5 hover:text-white"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {activityEntity && (
        <>
          <AddActivityModal
            isOpen={activityModalOpen}
            onClose={() => { setActivityModalOpen(false); setPickedEntity(null); }}
            entityType={activityEntity.entityType}
            entityId={activityEntity.entityId}
            onSuccess={handleActivitySuccess}
          />
          <QuickCreateAttachmentModal
            isOpen={attachmentModalOpen}
            onClose={() => { setAttachmentModalOpen(false); setPickedEntity(null); }}
            entityType={activityEntity.entityType}
            entityId={activityEntity.entityId}
            onSuccess={handleAttachmentSuccess}
          />
        </>
      )}
      <EntityPickerModal
        isOpen={entityPickerOpen}
        onClose={() => { setEntityPickerOpen(false); setEntityPickerFor(null); }}
        onSelect={handleEntityPickerSelect}
        title={entityPickerFor === "activity" ? "Select entity for activity" : "Select entity for attachment"}
      />
    </>
  );
}
