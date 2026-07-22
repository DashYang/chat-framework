export function validateStoryConfig(story, conversations = []) {
  if (!story || typeof story !== "object" || Array.isArray(story)) return;
  for (const field of ["title", "favicon"]) {
    if (Object.prototype.hasOwnProperty.call(story, field) && typeof story[field] !== "string") {
      throw new Error(`story.${field} must be a string`);
    }
  }
  const hasResetInfo = Object.prototype.hasOwnProperty.call(story, "resetInfo");
  const hasResetAccount = Object.prototype.hasOwnProperty.call(story, "resetAccount");
  const hasEndInfo = Object.prototype.hasOwnProperty.call(story, "endInfo");
  const badEndingFlags = new Set();
  for (const conversation of conversations) {
    for (const message of conversation?.messages || []) {
      if (message?.kind !== "choice") continue;
      for (const option of message.choice?.options || []) {
        const flags = Array.isArray(option?.flags) ? option.flags : [option?.flag];
        flags
          .map((flag) => String(flag || "").trim())
          .filter((flag) => flag.startsWith("bad-end"))
          .forEach((flag) => badEndingFlags.add(flag));
      }
    }
  }
  if (hasEndInfo && typeof story.endInfo !== "string") {
    throw new Error("story.endInfo must be a string");
  }
  if (!hasResetInfo && !hasResetAccount && !badEndingFlags.size) return;
  if (!hasResetAccount || !String(story.resetAccount || "").trim()) {
    throw new Error("story.resetAccount is required when configuring a bad-ending reset or bad-end choice flag");
  }
  if (!Array.isArray(story.accountOrder)) {
    throw new Error("story.accountOrder is required when configuring story.resetAccount");
  }
  const resetAccount = String(story.resetAccount).trim();
  const accountOrder = story.accountOrder.map((id) => String(id || "").trim()).filter(Boolean);
  if (!accountOrder.includes(resetAccount)) {
    throw new Error(`story.resetAccount must be an account in story.accountOrder: ${resetAccount}`);
  }
  if (hasResetInfo && typeof story.resetInfo !== "string") {
    throw new Error("story.resetInfo must be a string");
  }
}
