"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PhotoCropperProps = {
  file: File;
  title: string;
  onCancel: () => void;
  onSave: (file: File) => void;
};

type Size = { width: number; height: number };
type Point = { x: number; y: number };

const outputSize: Size = { width: 1200, height: 900 };

function rotatedSize(image: Size, rotation: number): Size {
  return Math.abs(rotation) % 180 === 90
    ? { width: image.height, height: image.width }
    : image;
}

function fitScale(image: Size, viewport: Size, rotation: number) {
  const rotated = rotatedSize(image, rotation);
  return Math.max(viewport.width / rotated.width, viewport.height / rotated.height);
}

function clampPosition(position: Point, image: Size, viewport: Size, scale: number, rotation: number): Point {
  const rotated = rotatedSize(image, rotation);
  const maxX = Math.max(0, (rotated.width * scale - viewport.width) / 2);
  const maxY = Math.max(0, (rotated.height * scale - viewport.height) / 2);
  return {
    x: Math.max(-maxX, Math.min(maxX, position.x)),
    y: Math.max(-maxY, Math.min(maxY, position.y)),
  };
}

export default function PhotoCropper({ file, title, onCancel, onSave }: PhotoCropperProps) {
  const sourceUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const imageElement = useRef<HTMLImageElement | null>(null);
  const viewportElement = useRef<HTMLButtonElement | null>(null);
  const drag = useRef<{ pointerId: number; start: Point; origin: Point } | null>(null);
  const [imageSize, setImageSize] = useState<Size>({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState<Size>({ width: 0, height: 0 });
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => () => URL.revokeObjectURL(sourceUrl), [sourceUrl]);

  useEffect(() => {
    const viewport = viewportElement.current;
    if (!viewport) return;
    const updateSize = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const baseScale = imageSize.width && viewportSize.width
    ? fitScale(imageSize, viewportSize, rotation)
    : 1;
  const appliedScale = baseScale * zoom;
  const safePosition = imageSize.width && viewportSize.width
    ? clampPosition(position, imageSize, viewportSize, appliedScale, rotation)
    : position;

  function reset() {
    setPosition({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }

  function rotate(direction: -1 | 1) {
    setRotation((current) => current + direction * 90);
    setPosition({ x: 0, y: 0 });
  }

  function startDragging(event: React.PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: safePosition,
    };
  }

  function moveImage(event: React.PointerEvent<HTMLButtonElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const next = {
      x: drag.current.origin.x + event.clientX - drag.current.start.x,
      y: drag.current.origin.y + event.clientY - drag.current.start.y,
    };
    setPosition(clampPosition(next, imageSize, viewportSize, appliedScale, rotation));
  }

  function stopDragging(event: React.PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }

  function nudgeImage(event: React.KeyboardEvent<HTMLButtonElement>) {
    const directions: Record<string, Point> = {
      ArrowLeft: { x: -8, y: 0 },
      ArrowRight: { x: 8, y: 0 },
      ArrowUp: { x: 0, y: -8 },
      ArrowDown: { x: 0, y: 8 },
    };
    const movement = directions[event.key];
    if (!movement) return;
    event.preventDefault();
    setPosition((current) => clampPosition({ x: current.x + movement.x, y: current.y + movement.y }, imageSize, viewportSize, appliedScale, rotation));
  }

  async function saveCrop() {
    const image = imageElement.current;
    if (!image || !imageSize.width || !viewportSize.width) return;
    setSaving(true);

    const canvas = document.createElement("canvas");
    canvas.width = outputSize.width;
    canvas.height = outputSize.height;
    const context = canvas.getContext("2d");
    if (!context) {
      setSaving(false);
      return;
    }

    const outputRatio = outputSize.width / viewportSize.width;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2 + safePosition.x * outputRatio, canvas.height / 2 + safePosition.y * outputRatio);
    context.rotate((rotation * Math.PI) / 180);
    context.scale(appliedScale * outputRatio, appliedScale * outputRatio);
    context.drawImage(image, -imageSize.width / 2, -imageSize.height / 2, imageSize.width, imageSize.height);

    canvas.toBlob((blob) => {
      setSaving(false);
      if (!blob) return;
      const originalName = file.name.replace(/\.[^.]+$/, "") || "producto";
      onSave(new File([blob], `${originalName}-recortada.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
    }, "image/jpeg", 0.9);
  }

  return (
    <div className="modalBackdrop cropperBackdrop" role="presentation">
      <section className="photoCropModal" role="dialog" aria-modal="true" aria-labelledby="photo-crop-title">
        <div className="modalHeading cropperHeading">
          <div><p className="eyebrow">Editar foto</p><h2 id="photo-crop-title">{title}</h2></div>
          <button type="button" className="closeButton" onClick={onCancel} aria-label="Cerrar editor">×</button>
        </div>

        <button
          type="button"
          ref={viewportElement}
          className="cropViewport"
          aria-label="Área de recorte. Arrastrá la foto o usá las flechas para acomodarla."
          onPointerDown={startDragging}
          onPointerMove={moveImage}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onKeyDown={nudgeImage}
        >
          {/* The editor needs the original local pixels; Next Image cannot render this temporary blob URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageElement}
            src={sourceUrl}
            alt="Vista previa del recorte"
            draggable={false}
            onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            style={{
              width: imageSize.width || undefined,
              height: imageSize.height || undefined,
              transform: `translate(calc(-50% + ${safePosition.x}px), calc(-50% + ${safePosition.y}px)) rotate(${rotation}deg) scale(${appliedScale})`,
            }}
          />
          <span className="cropGrid" aria-hidden="true" />
        </button>
        <p className="cropHint">Arrastrá la imagen para encuadrarla. El área visible será la foto final.</p>

        <label className="zoomControl">
          <span>Zoom</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => {
              const nextZoom = Number(event.target.value);
              setPosition(clampPosition(safePosition, imageSize, viewportSize, baseScale * nextZoom, rotation));
              setZoom(nextZoom);
            }}
          />
          <strong>{Math.round(zoom * 100)}%</strong>
        </label>

        <div className="cropTools" aria-label="Herramientas de imagen">
          <button type="button" className="secondaryButton" onClick={() => rotate(-1)}>↶ Girar</button>
          <button type="button" className="secondaryButton" onClick={() => rotate(1)}>Girar ↷</button>
          <button type="button" className="secondaryButton" onClick={reset}>Restablecer</button>
        </div>

        <div className="modalActions cropActions">
          <button type="button" className="secondaryButton" onClick={onCancel}>Cancelar</button>
          <button type="button" className="primaryButton fit" onClick={saveCrop} disabled={saving || !imageSize.width}>
            {saving ? "Preparando…" : "Usar este recorte"}
          </button>
        </div>
      </section>
    </div>
  );
}
