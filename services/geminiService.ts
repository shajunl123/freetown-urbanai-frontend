export async function queryFlowise(prompt: string): Promise<string> {
  try {
    const chatWebhookUrl = import.meta.env.VITE_CHAT_WEBHOOK_URL;
    if (!chatWebhookUrl) {
      throw new Error("Chat workflow is not configured. Set VITE_CHAT_WEBHOOK_URL.");
    }

    // n8n embedded chat "made publicly available" typically accepts a single object.
    // Include common fields (chatInput + sessionId + action) to satisfy the trigger.
    const payload = {
      sessionId: crypto.randomUUID(),
      action: "sendMessage",
      chatInput: prompt,
    };

    const res = await fetch(chatWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // surface backend error text to the UI
      const errorText = await res.text().catch(() => "");
      throw new Error(errorText || `n8n request failed (${res.status})`);
    }

    const data = await res.json();

    // Support common reply shapes from n8n or prior Flowise responses
    const unified =
      data.answer ||
      data.text ||
      data.response ||
      data.output ||
      data.result ||
      data.message ||
      (typeof data === "string" ? data : null);

    return unified || "No response from n8n";
  } catch (err) {
    console.error("n8n chat error:", err);
    if (err instanceof Error) return err.message;
    return "Error connecting to the chatbot service";
  }
}
