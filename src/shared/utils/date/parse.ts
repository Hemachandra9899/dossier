import ms from "ms";
import * as chrono from "chrono-node";

export const timeAgo = (timestamp?: Date | string | number): string => {
  if (!timestamp) return "Just now";
  const date = new Date(timestamp);
  const diff = Date.now() - date.getTime();
  if (diff < 60000) {
    // less than 1 second
    return "Just now";
  } else if (diff > 82800000) {
    // more than 23 hours – similar to how Twitter displays timestamps
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  }
  return `${ms(diff)} ago`;
};

export const timeIn = (timestamp?: Date): string => {
  if (!timestamp) return "Just now";
  const diff = new Date(timestamp).getTime() - Date.now();
  if (diff < 60000) {
    return "Just now";
  }
  return `in ${ms(diff, { long: true })}`;
};

export const durationFormat = (durationInMilliseconds?: number): string => {
  if (!durationInMilliseconds) return "0 secs";

  if (durationInMilliseconds < 60000) {
    return `${Math.round(durationInMilliseconds / 1000)} secs`;
  } else {
    const minutes = Math.floor(durationInMilliseconds / 60000);
    const seconds = Math.round((durationInMilliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")} mins`;
  }
};

export const getDateTimeLocal = (timestamp?: Date): string => {
  const d = timestamp ? new Date(timestamp) : new Date();
  if (d.toString() === "Invalid Date") return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .split(":")
    .slice(0, 2)
    .join(":");
};

export const formatDateTime = (
  datetime: Date | string,
  options?: Intl.DateTimeFormatOptions,
) => {
  if (datetime.toString() === "Invalid Date") return "";
  return new Date(datetime).toLocaleTimeString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
    ...options,
  });
};

export const getFirstAndLastDay = (day: number) => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  if (currentDay >= day) {
    // if the current day is greater than target day, it means that we just passed it
    return {
      firstDay: new Date(currentYear, currentMonth, day),
      lastDay: new Date(currentYear, currentMonth + 1, day - 1),
    };
  } else {
    // if the current day is less than target day, it means that we haven't passed it yet
    const lastYear = currentMonth === 0 ? currentYear - 1 : currentYear; // if the current month is January, we need to go back a year
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1; // if the current month is January, we need to go back to December
    return {
      firstDay: new Date(lastYear, lastMonth, day),
      lastDay: new Date(currentYear, currentMonth, day - 1),
    };
  }
};

export const formatDate = (dateString: string, updateDate?: boolean) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year:
      updateDate &&
      new Date(dateString).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
    timeZone: "UTC",
  });
};

export const daysLeft = (
  accountCreationDate: Date,
  maxDays: number,
): number => {
  const now = new Date();
  const endPeriodDate = new Date(accountCreationDate);
  endPeriodDate.setDate(accountCreationDate.getDate() + maxDays);

  const diffInMilliseconds = endPeriodDate.getTime() - now.getTime();

  // Convert milliseconds to days and round down to show complete days remaining
  return Math.floor(diffInMilliseconds / (1000 * 60 * 60 * 24));
};

const cutoffDate = new Date("2023-10-17T00:00:00.000Z");

export const calculateDaysLeft = (accountCreationDate: Date): number => {
  let maxDays;
  if (accountCreationDate < cutoffDate) {
    maxDays = 30;
    accountCreationDate = new Date("2023-10-01T00:00:00.000Z");
  } else {
    maxDays = 14;
  }
  return daysLeft(accountCreationDate, maxDays);
};

export const PRESET_OPTIONS: { label: string; value: number }[] = [
  { label: "in 1 hour", value: 3600 },
  { label: "in 6 hours", value: 21600 },
  { label: "in 12 hours", value: 43200 },
  { label: "in 1 day", value: 86400 },
  { label: "in 3 days", value: 259200 },
  { label: "in 7 days", value: 604800 },
  { label: "in 14 days", value: 1209600 },
  { label: "in 1 month", value: 2592000 },
  { label: "in 3 months", value: 7776000 },
  { label: "in 6 months", value: 15552000 },
  { label: "in 1 year", value: 31536000 },
];

export const WITH_CUSTOM_PRESET_OPTION: {
  label: string;
  value: number | string;
}[] = [...PRESET_OPTIONS, { label: "Custom", value: "custom" }];

export const formatExpirationTime = (seconds: number) => {
  // Define constants for time units
  const MINUTE = 60;
  const HOUR = 3600;
  const DAY = 86400;
  const YEAR = 31536000;

  seconds = Math.ceil(seconds / MINUTE) * MINUTE;

  if (seconds < MINUTE) {
    return "Less than a minute";
  }

  // Return exact unit match if possible
  if (seconds % YEAR === 0) {
    const years = seconds / YEAR;
    return `${years} year${years !== 1 ? "s" : ""}`;
  }

  if (seconds % DAY === 0) {
    const days = seconds / DAY;
    return `${days} day${days !== 1 ? "s" : ""}`;
  }

  if (seconds % HOUR === 0 && seconds < DAY) {
    const hours = seconds / HOUR;
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }

  if (seconds % MINUTE === 0 && seconds < HOUR) {
    const minutes = seconds / MINUTE;
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }

  // Mixed unit fallbacks
  if (seconds < HOUR) {
    const minutes = Math.floor(seconds / MINUTE);
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }

  if (seconds < DAY) {
    const hours = Math.floor(seconds / HOUR);
    const minutes = Math.floor((seconds % HOUR) / MINUTE);
    return (
      `${hours} hour${hours !== 1 ? "s" : ""}` +
      (minutes > 0 ? ` and ${minutes} minute${minutes !== 1 ? "s" : ""}` : "")
    );
  }

  if (seconds < YEAR) {
    const days = Math.floor(seconds / DAY);
    const remainingSeconds = seconds % DAY;
    const hours = Math.floor(remainingSeconds / HOUR);
    const minutes = Math.floor((remainingSeconds % HOUR) / MINUTE);

    let result = `${days} day${days !== 1 ? "s" : ""}`;

    if (hours > 0 && minutes > 0) {
      result += `, ${hours} hour${hours !== 1 ? "s" : ""} and ${minutes} minute${minutes !== 1 ? "s" : ""}`;
    } else if (hours > 0) {
      result += ` and ${hours} hour${hours !== 1 ? "s" : ""}`;
    } else if (minutes > 0) {
      result += ` and ${minutes} minute${minutes !== 1 ? "s" : ""}`;
    }

    return result;
  }

  // Years + remaining time
  const years = Math.floor(seconds / YEAR);
  const remainingSeconds = seconds % YEAR;
  const days = Math.floor(remainingSeconds / DAY);
  const hours = Math.floor((remainingSeconds % DAY) / HOUR);
  const minutes = Math.floor((remainingSeconds % HOUR) / MINUTE);

  let result = `${years} year${years !== 1 ? "s" : ""}`;

  if (days > 0) {
    result += `, ${days} day${days !== 1 ? "s" : ""}`;
  }
  if (hours > 0) {
    result += `, ${hours} hour${hours !== 1 ? "s" : ""}`;
  }
  if (minutes > 0) {
    result += ` and ${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }

  return result;
};

// from DUB.IO
export const parseDateTime = (str: Date | string) => {
  if (str instanceof Date) return str;
  return chrono.parseDate(str);
};
