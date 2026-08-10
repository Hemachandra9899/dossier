import {
  sendConversationMessageNotificationTask,
  sendConversationTeamMemberNotificationTask,
} from "@/ee/features/conversations/lib/trigger/conversation-message-notification";

export const sendConversationMentionNotificationTask = {
  id: "send-conversation-mention-notification",
} as any;

export {
  sendConversationMessageNotificationTask,
  sendConversationTeamMemberNotificationTask,
};
