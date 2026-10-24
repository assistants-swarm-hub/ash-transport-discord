import { defineTransport } from "@assistants-swarm-hub/transport-sdk";

import { descriptor } from "./descriptor";
import { discordAdapter } from "./discord/adapter";
import { registerReactionTool } from "./discord/reaction-tool";
import { addressing } from "./inbound/addressing";
import { normalizeMessage } from "./inbound/normalize";

/**
 * The Discord transport, whole: the package the core hosts. What a
 * transport is — a descriptor, a platform adapter, a normalizer, an
 * addressing rule, and the words and tools of its own — and nothing else.
 * Everything that is true of any transport (registering, reconciling
 * connections from the desired state, deduping shared channels, assembling
 * and publishing events, splitting and performing sends, hosting the
 * delivery tools, shutting down in order) is the core's host.
 */
export default defineTransport({
  descriptor,
  adapter: discordAdapter,
  normalize: normalizeMessage,
  addressing,
  // The delivery tools are the contract's, but they speak to a model about a
  // specific platform, so the words are this transport's to choose.
  tools: {
    platform: "Discord",
    replyToMessage:
      "Send your answer to the Discord message that opened this turn, attached to it as a " +
      "reply. Use it once, with the complete answer as the channel should read it — the text " +
      "is delivered verbatim. Long answers are split across messages automatically; do not " +
      "shorten to fit.",
    sendMessage:
      "Send a message into the Discord channel this turn belongs to, not attached to " +
      "anything. Use it once, with the complete text as the channel should read it.",
    // Reacting is Discord's own tool: the emoji it takes are its own.
    register: registerReactionTool,
  },
});
