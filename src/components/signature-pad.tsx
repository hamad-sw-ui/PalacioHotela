"use client";

import { useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";

export function SignaturePad({ onChange, clearLabel }: { onChange: (value: string | null) => void; clearLabel: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const inkRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = 900 * ratio;
    canvas.height = 280 * ratio;
    context.scale(ratio, ratio);
    context.lineWidth = 2.4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#18382e";
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * 900, y: ((event.clientY - rect.top) / rect.height) * 280 };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const cursor = point(event);
    const context = canvasRef.current?.getContext("2d");
    context?.beginPath();
    context?.moveTo(cursor.x, cursor.y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const cursor = point(event);
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.lineTo(cursor.x, cursor.y);
    context.stroke();
    inkRef.current = true;
  }

  function finish() {
    drawingRef.current = false;
    onChange(inkRef.current ? canvasRef.current?.toDataURL("image/png") || null : null);
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    inkRef.current = false;
    onChange(null);
  }

  return (
    <div className="signature-pad">
      <canvas ref={canvasRef} className="signature-pad-canvas" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} />
      <button type="button" className="admin-secondary-button" onClick={clear}><RotateCcw size={14}/>{clearLabel}</button>
    </div>
  );
}
