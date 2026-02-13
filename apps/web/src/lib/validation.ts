import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  industry: z.string().max(255).optional(),
  website: z
    .string()
    .optional()
    .refine((v) => !v || v === "" || /^https?:\/\/.+/.test(v), "Invalid URL"),
});

export const contactSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  firstName: z.string().min(1, "First name is required").max(255),
  lastName: z.string().min(1, "Last name is required").max(255),
  email: z.string().email("Invalid email"),
  phone: z.string().max(50).optional(),
});

export const leadSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email("Invalid email"),
  company: z.string().max(255).optional(),
  status: z.string().max(50).optional(),
  source: z.string().max(50).optional(),
});

export const opportunitySchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  name: z.string().min(1, "Name is required").max(255),
  amount: z.coerce.number().min(0).optional(),
  stage: z.string().max(50).optional(),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  closeDate: z.string().optional(),
});

export type AccountFormData = z.infer<typeof accountSchema>;
export type ContactFormData = z.infer<typeof contactSchema>;
export type LeadFormData = z.infer<typeof leadSchema>;
export type OpportunityFormData = z.infer<typeof opportunitySchema>;
