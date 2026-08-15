import { sendEmail } from "@/shared/utils/resend";

import WelcomeEmail from "@/shared/ui/emails/welcome";

import { CreateUserEmailProps } from "../types";

export const sendWelcomeEmail = async (params: CreateUserEmailProps) => {
  const { name, email } = params.user;
  const emailTemplate = WelcomeEmail({ name });
  try {
    await sendEmail({
      to: email as string,
      marketing: true,
      subject: "Welcome to Papermark!",
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
      unsubscribeUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/account/general`,
    });
  } catch (e) {
    console.error(e);
  }
};
