export type DataroomBannerKind = "image" | "video" | "youtube" | "none";

export function classifyDataroomBanner(url: string | null | undefined): {
  kind: DataroomBannerKind;
  src: string | null;
  youtubeId: string | null;
} {
  if (!url) {
    return { kind: "none", src: null, youtubeId: null };
  }
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const youtubeId = match && match[2].length === 11 ? match[2] : null;
    return { kind: "youtube", src: url, youtubeId };
  }
  if (url.endsWith(".mp4") || url.endsWith(".webm") || url.includes(".mp4?")) {
    return { kind: "video", src: url, youtubeId: null };
  }
  return { kind: "image", src: url, youtubeId: null };
}
