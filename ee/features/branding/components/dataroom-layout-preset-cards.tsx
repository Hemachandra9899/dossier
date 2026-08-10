import React from "react";

export function DataroomLayoutPresetCards({ selectedPreset, onSelect }: any) {
  const presets = ["STANDARD", "MODERN", "MINIMAL"];
  return (
    <div className="grid grid-cols-3 gap-3">
      {presets.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onSelect(preset)}
          className={`p-3 rounded border text-center text-sm font-medium transition-colors ${
            selectedPreset === preset
              ? "border-black bg-gray-150 font-semibold"
              : "border-gray-200 hover:bg-gray-50"
          }`}
        >
          {preset}
        </button>
      ))}
    </div>
  );
}
