import { sendEmail } from "@/shared/utils/resend";

import DataroomTrialEnd from "@/shared/ui/emails/dataroom-trial-end";

export const sendDataroomTrialEndEmail = async (params: {
  email: string;
  name: string;
}) => {
  const { email, name } = params;

  let emailTemplate;
  let subject;

  emailTemplate = DataroomTrialEnd({ name });
  subject = "Your Data Room Plus plan trial has ended";

  try {
    await sendEmail({
      to: email as string,
      from: "Marc Seitz <marc@papermark.com>",
      subject,
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
    });
  } catch (e) {
    console.error(e);
  }
};
