import ms from "ms";

export function bytesToSize(bytes: number) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "n/a";
  const i = Math.floor(Math.log(bytes) / Math.log(1000));
  if (i === 0) return `${bytes} ${sizes[i]}`;
  const sizeInCurrentUnit = bytes / Math.pow(1000, i);
  if (sizeInCurrentUnit >= 1000 && i < sizes.length - 1) {
    return `1 ${sizes[i + 1]}`;
  }
  return `${Math.round(sizeInCurrentUnit)} ${sizes[i]}`;
}

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

export const getDomainWithoutWWW = (url: string) => {
  if (isValidUrl(url)) {
    return new URL(url).hostname.replace(/^www\./, "");
  }
  try {
    if (url.includes(".") && !url.includes(" ")) {
      return new URL(`https://${url}`).hostname.replace(/^www\./, "");
    }
  } catch (e) {
    return "(direct)"; // Not a valid URL, but cannot return null
  }
};

export function capitalize(str: string) {
  if (!str || typeof str !== "string") return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function nFormatter(num?: number, digits?: number) {
  if (!num) return "0";
  const lookup = [
    { value: 1, symbol: "" },
    { value: 1e3, symbol: "K" },
    { value: 1e6, symbol: "M" },
    { value: 1e9, symbol: "G" },
    { value: 1e12, symbol: "T" },
    { value: 1e15, symbol: "P" },
    { value: 1e18, symbol: "E" },
  ];
  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
  var item = lookup
    .slice()
    .reverse()
    .find(function (item) {
      return num >= item.value;
    });
  return item
    ? (num / item.value).toFixed(digits || 1).replace(rx, "$1") + item.symbol
    : "0";
}

export const trim = (u: unknown) => (typeof u === "string" ? u.trim() : u);

/**
 * Safely replaces template variables in user input with actual values.
 * Only allows whitelisted variables to prevent template injection.
 */
export function safeTemplateReplace(
  template: string,
  data: Record<string, any>,
): string {
  // Define allowed template variables - only these will be replaced
  const allowedVariables = ["email", "date", "time", "link", "ipAddress"];

  let result = template;

  for (const key of allowedVariables) {
    if (data[key] !== undefined && data[key] !== null) {
      // Use a regex to match {{variable}} patterns with optional whitespace
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "gi");
      result = result.replace(regex, String(data[key]));
    }
  }

  return result;
}

/**
 * Converts BigInt fileSize values to numbers for safe serialization
 * Recursively processes objects and arrays, converting only fileSize fields
 */
export function serializeFileSize(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeFileSize);
  }

  if (typeof obj === "object") {
    const serialized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (key === "fileSize" && typeof obj[key] === "bigint") {
          // Convert BigInt fileSize to number
          serialized[key] = Number(obj[key]);
        } else {
          serialized[key] = serializeFileSize(obj[key]);
        }
      }
    }
    return serialized;
  }

  return obj;
}
