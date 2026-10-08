import { z } from 'zod';

export const understandSchema = z.object({
  category: z.string().min(1).max(80),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  objective: z.string().min(1).max(400),
  affectedServices: z.array(z.string().max(80)).max(12),
  symptoms: z.array(z.string().max(200)).max(8).optional(),
  suspectedDomains: z.array(z.string().max(40)).max(12).optional(),
  investigationStrategy: z.array(z.string().max(240)).max(6).optional(),
  plan: z.array(z.object({
    id: z.string().max(16),
    title: z.string().max(160),
    toolHint: z.string().max(64),
  })).min(1).max(12),
});

export const investigateSchema = z.object({
  action: z.enum(['call_tool', 'finish_investigation']),
  tool: z.string().max(64).optional(),
  args: z.record(z.any()).optional(),
  why: z.string().min(1).max(280),
});

export const analyzeSchema = z.object({
  rootCause: z.string().min(1).max(600),
  confidence: z.number(),
  evidence: z.array(z.object({
    signal: z.string(),
    detail: z.string(),
    weight: z.number(),
  })).max(8),
  ruledOut: z.array(z.object({
    hypothesis: z.string(),
    reason: z.string(),
  })).max(6),
  remediation: z.object({
    tool: z.string(),
    args: z.record(z.any()),
    title: z.string(),
    rationale: z.string(),
    expectedImpact: z.string(),
    risk: z.enum(['low', 'medium', 'high']),
  }).nullable(),
});

export const SCHEMAS = {
  understand: understandSchema,
  investigate_step: investigateSchema,
  analyze: analyzeSchema,
  alternative: analyzeSchema,
};
