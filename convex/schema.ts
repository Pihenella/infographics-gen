import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    status: v.union(v.literal("active"), v.literal("draft")),
    referenceImageId: v.optional(v.id("_storage")),
    productImageId: v.optional(v.id("_storage")),
    styleAnalysis: v.optional(v.any()),
    createdAt: v.number(),
  }),

  generatedImages: defineTable({
    projectId: v.id("projects"),
    type: v.union(v.literal("main"), v.literal("carousel"), v.literal("rich")),
    slot: v.number(),
    prompt: v.string(),
    styleNotes: v.string(),
    suggestedText: v.string(),
    imageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  }).index("by_project", ["projectId"]),
});
