// SignaturePadDialog: a drawn-signature capture modal. Produces a PNG data URL
// that the caller uploads to Dossier storage before binding to a field.

"use client";

import { useCallback, useRef, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { EraserIcon, PenLineIcon } from "lucide-react";

import type { RecipientFieldDTO } from "@/features/signing/api/signing-api";

export function SignaturePadDialog({
  field,
  onCancel,
  onConfirm,
}: {
  field: RecipientFieldDTO;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => Promise<void> | void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const startDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getPoint(event);
    if (!point) return;
    drawingRef.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const point = getPoint(event);
    if (!point) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const stopDraw = () => {
    drawingRef.current = false;
  };

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const confirm = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsSaving(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      await onConfirm(dataUrl);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLineIcon className="h-4 w-4" />
            Draw your {field.type === "INITIALS" ? "initials" : "signature"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-white p-2">
            <canvas
              ref={canvasRef}
              width={560}
              height={200}
              className="h-44 w-full touch-none"
              onPointerDown={startDraw}
              onPointerMove={draw}
              onPointerUp={stopDraw}
              onPointerLeave={stopDraw}
            />
          </div>

          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              <EraserIcon className="h-4 w-4" />
              Clear
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void confirm()} loading={isSaving}>
                Use signature
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}