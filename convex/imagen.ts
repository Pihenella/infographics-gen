"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { GoogleAuth } from "google-auth-library";

async function getAccessToken(): Promise<{ token: string; projectId: string }> {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");

  const credentials = JSON.parse(json);
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) throw new Error("Failed to get access token");

  return { token: tokenResponse.token, projectId: credentials.project_id };
}

export const generateImage = action({
  args: { prompt: v.string() },
  handler: async (_ctx, args): Promise<string> => {
    const { token, projectId } = await getAccessToken();

    const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-4.0-ultra-generate-001:predict`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{ prompt: args.prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "1:1",
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Imagen API error");
    }

    const base64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!base64) throw new Error("No image in Imagen response");
    return base64;
  },
});

export const removeBackground = action({
  args: { imageBase64: v.string() },
  handler: async (_ctx, args): Promise<string> => {
    const { token, projectId } = await getAccessToken();

    const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-3.0-capability-001:predict`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: "",
            image: { bytesBase64Encoded: args.imageBase64 },
          },
        ],
        parameters: {
          editMode: "product-image",
          sampleCount: 1,
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Background removal error");
    }

    const base64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!base64) throw new Error("No image in background removal response");
    return base64;
  },
});
