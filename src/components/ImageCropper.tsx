import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCw, ZoomIn } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

type Props = {
  file: File | null;
  aspect: number;
  title?: string;
  outputWidth?: number;
  onCancel: () => void;
  onCropped: (blob: Blob) => void | Promise<void>;
};

/** Lightweight canvas cropper/editor: pan, zoom, rotate, brightness. */
export function ImageCropper({
  file,
  aspect,
  title = "Adjust photo",
  outputWidth = 1200,
  onCancel,
  onCropped,
}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!file) {
      setSrc(null);
      setImage(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setZoom(1);
    setRotation(0);
    setBrightness(100);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = src;
  }, [src]);

  const draw = useCallback(
    (canvas: HTMLCanvasElement, width: number) => {
      if (!image) return;
      const height = Math.round(width / aspect);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      ctx.filter = `brightness(${brightness}%)`;
      ctx.save();
      ctx.translate(width / 2 + offset.x * (width / 100), height / 2 + offset.y * (height / 100));
      ctx.rotate((rotation * Math.PI) / 180);
      const rotated = rotation % 180 !== 0;
      const imgW = rotated ? image.height : image.width;
      const imgH = rotated ? image.width : image.height;
      const base = Math.max(width / imgW, height / imgH) * zoom;
      ctx.drawImage(
        image,
        (-image.width * base) / 2,
        (-image.height * base) / 2,
        image.width * base,
        image.height * base,
      );
      ctx.restore();
    },
    [image, aspect, zoom, rotation, brightness, offset],
  );

  useEffect(() => {
    if (canvasRef.current) draw(canvasRef.current, 800);
  }, [draw]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setOffset((prev) => ({ x: prev.x + dx / 4, y: prev.y + dy / 4 }));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const apply = async () => {
    if (!image) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      draw(canvas, outputWidth);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
      );
      if (blob) await onCropped(blob);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!file} onOpenChange={(v) => !v && !busy && onCancel()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Drag to reposition, then zoom, rotate or brighten.</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border border-border bg-black">
          <canvas
            ref={canvasRef}
            className="w-full cursor-grab touch-none active:cursor-grabbing"
            style={{ aspectRatio: String(aspect) }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs">
              <ZoomIn className="size-3.5" /> Zoom
            </Label>
            <Slider
              value={[zoom]}
              min={1}
              max={4}
              step={0.01}
              onValueChange={([v]) => setZoom(v ?? 1)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Brightness</Label>
            <Slider
              value={[brightness]}
              min={50}
              max={160}
              step={1}
              onValueChange={([v]) => setBrightness(v ?? 100)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setRotation((r) => (r + 90) % 360)}>
            <RotateCw className="size-4" /> Rotate
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={busy || !image}>
            {busy ? "Saving…" : "Save photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
