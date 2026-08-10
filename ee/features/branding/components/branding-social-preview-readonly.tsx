import React from "react";

export function BrandingSocialPreviewReadonly({
  title,
  description,
  image,
  favicon,
}: any) {
  return (
    <div className="w-full rounded border border-gray-200 bg-white overflow-hidden shadow-sm max-w-md dark:border-gray-800 dark:bg-gray-900">
      <div className="bg-gray-100 h-36 flex items-center justify-center text-gray-400 dark:bg-gray-800">
        {image ? (
          <img src={image} alt="Preview" className="object-cover w-full h-full" />
        ) : (
          <span className="text-xs">Social Preview Image</span>
        )}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {favicon && <img src={favicon} alt="Favicon" className="w-4 h-4 rounded-full" />}
          <span>papermark.io</span>
        </div>
        <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-1">
          {title || "Untitled Link"}
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
          {description || "No description provided."}
        </p>
      </div>
    </div>
  );
}
