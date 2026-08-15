import { upload } from "@vercel/blob/client";

export const isDataUrl = (str: string): boolean => {
  return str?.startsWith("data:");
};

export const convertDataUrlToFile = ({
  dataUrl,
  filename = "logo.png",
}: {
  dataUrl: string;
  filename?: string;
}) => {
  let arr = dataUrl.split(","),
    match = arr[0].match(/:(.*?);/),
    mime = match ? match[1] : "",
    bstr = atob(arr[1]),
    n = bstr.length,
    u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  filename =
    mime == "image/png"
      ? "logo.png"
      : mime == "image/jpeg"
        ? "logo.jpg"
        : filename;

  return new File([u8arr], filename, { type: mime });
};

export const convertDataUrlToBuffer = (
  dataUrl: string,
): { buffer: Buffer; mimeType: string; filename: string } => {
  // Extract mime type
  const match = dataUrl.match(/:(.*?);/);
  const mimeType = match ? match[1] : "";

  // Extract base64 data
  const base64Data = dataUrl.split(",")[1];
  const buffer = Buffer.from(base64Data, "base64");

  // Determine filename based on mime type
  const filename =
    mimeType === "image/png"
      ? "image.png"
      : mimeType === "image/jpeg"
        ? "image.jpg"
        : mimeType === "image/x-icon" || mimeType === "image/vnd.microsoft.icon"
          ? "favicon.ico"
          : "image";

  return { buffer, mimeType, filename };
};

export const validateImageDimensions = (
  image: string,
  minSize: number,
  maxSize: number,
): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = image;
    img.onload = () => {
      const { width, height } = img;
      if (
        width >= minSize &&
        height >= minSize &&
        width <= maxSize &&
        height <= maxSize
      ) {
        resolve(true);
      } else {
        resolve(false);
      }
    };
    img.onerror = () => {
      resolve(false);
    };
  });
};

export const uploadImage = async (
  file: File,
  uploadType: "profile" | "assets" = "assets",
) => {
  const newBlob = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: `/api/file/image-upload?type=${uploadType}`,
  });

  return newBlob.url;
};
