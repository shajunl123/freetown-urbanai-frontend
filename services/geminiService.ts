// ./services/geminiService.ts

export async function queryFlowise(prompt: string): Promise<string> {
  try {
    const res = await fetch(
      "https://vivacious-forgiveness-production-fe57.up.railway.app/api/v1/prediction/e6e89a4e-0515-44bf-bfc6-48de3ed638bc",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt })
      }
    );

    if (!res.ok) throw new Error("Flowise request failed");

    const data = await res.json();

    // 🔥 UNIFIED FIX: support *all* Flowise response formats
    const unified =
      data.answer ||
      data.text ||
      data.response ||
      data.output ||
      data.result ||
      (typeof data === "string" ? data : null);

    return unified || "No response from Flowise";
  } catch (err) {
    console.error("Flowise error:", err);
    return "Error connecting to Flowise";
  }
}
