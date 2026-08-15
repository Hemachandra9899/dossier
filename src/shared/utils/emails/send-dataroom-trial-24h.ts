import { sendEmail } from "@/shared/utils/resend";

import DataroomTrial24hReminderEmail from "@/shared/ui/emails/dataroom-trial-24h";

export const sendDataroomTrial24hReminderEmail = async (params: {
  email: string;
  name: string;
}) => {
  const { email, name } = params;

  const emailTemplate = DataroomTrial24hReminderEmail({ name });
  try {
    await sendEmail({
      to: email,
      from: "Marc Seitz <marc@papermark.com>",
      subject: "Your Data Room Plus plan trial expires in 24 hours",
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
    });
  } catch (e) {
    console.error(e);
  }
};
