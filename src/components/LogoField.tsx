"use client";

import { useState } from "react";
import { inputClass, labelClass } from "@/lib/ui";

export function LogoField({
  name,
  defaultValue = "",
  form,
}: {
  name: string;
  defaultValue?: string | null;
  form?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const preview = value.startsWith("data:image/") || value.startsWith("https://") || value.startsWith("/") ? value : "";

  function onFile(file: File | undefined) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);
      const scale = Math.min(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      setValue(canvas.toDataURL("image/png"));
      URL.revokeObjectURL(url);
    };
    image.src = url;
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} form={form} value={value.startsWith("/") ? "" : value} />
      <label className="block">
        <span className={labelClass}>Logo URL</span>
        <input
          value={value.startsWith("data:") ? "" : value}
          placeholder={value.startsWith("data:") ? "Uploaded image" : "https://"}
          onChange={(event) => setValue(event.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className={labelClass}>Or upload</span>
        <input
          type="file"
          accept="image/png,image/webp,image/jpeg"
          onChange={(event) => onFile(event.target.files?.[0])}
          className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-zinc-100"
        />
      </label>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="h-10 w-10 rounded-lg bg-zinc-800 object-contain p-1" />
      ) : (
        <p className="text-xs text-zinc-500">Leave this blank to keep the built-in logo.</p>
      )}
    </div>
  );
}
