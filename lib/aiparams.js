// Reasoning effort: ask for "low", but never break the request if the model does not support it.

// True if OpenAI rejected the request because of the reasoning_effort parameter.
export function isReasoningEffortRejected(err) {
  const text = `${err && err.message ? err.message : ""} ${err && err.param ? err.param : ""}`;
  return Boolean(err) && err.status === 400 && /reasoning_effort|reasoning effort/i.test(text);
}

// Adds reasoning_effort: "low" to the request body unless we already know the model does not support it.
export function withReasoningEffort(body, supported) {
  return supported === false ? body : { ...body, reasoning_effort: "low" };
}
