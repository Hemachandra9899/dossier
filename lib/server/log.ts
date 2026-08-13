const LOG_TIMEOUT_MS = 2500;

const postJsonWithTimeout = async (
  url: string,
  body: unknown,
  timeoutMs: number,
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  timeoutId.unref?.();
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const logStore = async ({ object }: { object: any }) => {
  /* If in development or env variable not set, log to the console */
  if (
    process.env.NODE_ENV === "development" ||
    !process.env.PPMK_STORE_WEBHOOK_URL
  ) {
    console.log(object);
    return;
  }

  try {
    if (process.env.PPMK_STORE_WEBHOOK_URL) {
      return await fetch(process.env.PPMK_STORE_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(object),
      });
    }
  } catch (e) {
    console.error("Error logging store:", e);
    return;
  }
};

export const log = async ({
  message,
  type,
  mention = false,
}: {
  message: string;
  type: "info" | "cron" | "links" | "error" | "trial";
  mention?: boolean;
}) => {
  /* If in development or env variable not set, log to the console */
  if (
    process.env.NODE_ENV === "development" ||
    !process.env.PPMK_SLACK_WEBHOOK_URL
  ) {
    console.log(message);
    return;
  }

  /* Log a message to channel */
  try {
    const payload = {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            // prettier-ignore
            text: `${mention ? "<@U05BTDUKPLZ> " : ""}${type === "error" ? ":rotating_light: " : ""}${message}`,
          },
        },
      ],
    };

    if (type === "trial" && process.env.PPMK_TRIAL_SLACK_WEBHOOK_URL) {
      return await postJsonWithTimeout(
        process.env.PPMK_TRIAL_SLACK_WEBHOOK_URL,
        payload,
        LOG_TIMEOUT_MS,
      );
    }

    return await postJsonWithTimeout(
      `${process.env.PPMK_SLACK_WEBHOOK_URL}`,
      payload,
      LOG_TIMEOUT_MS,
    );
  } catch (e) {}
};
