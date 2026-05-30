'use client';

import { X, RotateCcw, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type StrokePoint = { x: number; y: number };
type Stroke = { color: string; width: number; points: StrokePoint[] };

export function AnnotationModal({
  imageUrl,
  fileName,
  onClose,
  onSave
}: {
  imageUrl: string;
  fileName: string;
  onClose: () => void;
  onSave: (dataUrl: string, strokes: Stroke[]) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [color, setColor] = useState('#79f2ff');
  const [width, setWidth] = useState(8);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxWidth = 1000;
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      drawCanvas(strokes, draft);
    };
    img.src = imageUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  useEffect(() => {
    drawCanvas(strokes, draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, draft]);

  function drawCanvas(finalStrokes: Stroke[], draftStroke: Stroke | null) {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    [...finalStrokes, ...(draftStroke ? [draftStroke] : [])].forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });
  }

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function startDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft({ color, width, points: [pointFromEvent(event)] });
  }

  function moveDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!draft) return;
    setDraft({ ...draft, points: [...draft.points, pointFromEvent(event)] });
  }

  function endDraw() {
    if (draft && draft.points.length > 1) {
      setStrokes((current) => [...current, draft]);
    }
    setDraft(null);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      await onSave(canvas.toDataURL('image/png'), strokes);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-md">
      <div className="kiaro-card flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
          <div>
            <div className="font-display text-xl font-black">Mark up image</div>
            <div className="text-sm text-kiaro-muted">{fileName}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-kiaro-muted">
              Color
              <input value={color} onChange={(e) => setColor(e.target.value)} type="color" className="h-10 w-12 rounded-xl bg-transparent" />
            </label>
            <label className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-kiaro-muted">
              Pen
              <input value={width} min={2} max={28} onChange={(e) => setWidth(Number(e.target.value))} type="range" />
            </label>
            <button className="btn-ghost flex items-center gap-2 px-4 py-3 text-sm" onClick={() => setStrokes((s) => s.slice(0, -1))}>
              <RotateCcw size={16} /> Undo
            </button>
            <button className="btn-primary flex items-center gap-2 px-5 py-3 text-sm" disabled={saving} onClick={save}>
              <Save size={16} /> Save
            </button>
            <button className="btn-ghost grid h-11 w-11 place-items-center" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="overflow-auto p-4">
          <canvas
            ref={canvasRef}
            className="mx-auto max-h-[72vh] max-w-full cursor-crosshair rounded-2xl border border-white/10 bg-black/30"
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerCancel={endDraw}
          />
        </div>
      </div>
    </div>
  );
}
