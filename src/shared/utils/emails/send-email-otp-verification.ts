import { sendEmail } from "@/shared/utils/resend";
import OtpEmailVerification from "@/shared/ui/emails/otp-verification";

export const sendOtpVerificationEmail = async (
  email: string,
  code: string,
  isDataroom: boolean = false,
  _teamId?: string,
) => {
  const emailTemplate = OtpEmailVerification({
    email,
    code,
    isDataroom,
  });

  try {
    await sendEmail({
      to: email,
      subject: `${code} is your verification code`,
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
      verify: true,
    });
  } catch (e) {
    console.error("Error sending OTP verification email:", e);
  }
};

export default sendOtpVerificationEmail;
