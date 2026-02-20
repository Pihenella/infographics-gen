import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("projects").order("desc").collect();
  },
});

export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("projects", {
      name: args.name,
      status: "draft",
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const updateStyleAnalysis = mutation({
  args: {
    id: v.id("projects"),
    styleAnalysis: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { styleAnalysis: args.styleAnalysis });
  },
});

export const setReferenceImage = mutation({
  args: {
    id: v.id("projects"),
    referenceImageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { referenceImageId: args.referenceImageId });
  },
});

export const setProductImage = mutation({
  args: {
    id: v.id("projects"),
    productImageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { productImageId: args.productImageId });
  },
});

export const updateSheetsData = mutation({
  args: {
    id: v.id("projects"),
    sheetsUrl: v.string(),
    sheetsData: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      sheetsUrl: args.sheetsUrl,
      sheetsData: args.sheetsData,
    });
  },
});

export const updateCarouselCount = mutation({
  args: {
    id: v.id("projects"),
    carouselCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { carouselCount: args.carouselCount });
  },
});
