"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { GoogleAuth } from "google-auth-library";

async function getAccessToken(): Promise<{ token: string; projectId: string }> {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new ConvexError("GOOGLE_SERVICE_ACCOUNT_JSON not set");

  const credentials = JSON.parse(json);
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) throw new ConvexError("Failed to get access token");

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
      const errMsg = data.error?.message || JSON.stringify(data);
      throw new ConvexError(`Imagen API error (${response.status}): ${errMsg}`);
    }

    const base64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!base64) throw new ConvexError("No image in Imagen response: " + JSON.stringify(data));
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
          editConfig: { backgroundRemovalConfig: {} },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const errMsg = data.error?.message || JSON.stringify(data.error) || "Background removal error";
      throw new ConvexError(`Vertex AI error (${response.status}): ${errMsg}`);
    }

    const base64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!base64) throw new ConvexError("No image in background removal response: " + JSON.stringify(data));
    return base64;
  },
});
