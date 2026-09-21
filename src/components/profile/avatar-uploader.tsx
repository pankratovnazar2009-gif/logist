"use client";

import { useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PhotoRejected, photoToAvatarJpeg } from "@/lib/image";
import type { AppUser } from "@/lib/types";
import { Avatar } from "../avatar";

/** Что происходит с фото: только один вариант в каждый момент, поэтому «загружается и ошибка» одновременно невозможны. */
type PhotoState = { status: "idle" } | { status: "working"; action: "upload" | "remove" } | { status: "error"; message: string };

const PHOTO_ERRORS: Record<string, string> = {
  not_image: "To nie jest zdjęcie. Wybierz plik JPG, PNG lub WebP.",
  too_large: "Zdjęcie jest zbyt duże (maks. 12 MB).",
  unreadable: "Nie udało się odczytać zdjęcia. Spróbuj innego.",
};

export function AvatarUploader({ user }: { user: AppUser }) {
  const { refreshUser } = useAuth();
  const [state, setState] = useState<PhotoState>({ status: "idle" });
  const input = useRef<HTMLInputElement>(null);
  const busy = state.status === "working";

  async function upload(file: File) {
    setState({ status: "working", action: "upload" });
    try {
      await api.uploadAvatar(await photoToAvatarJpeg(file));
      await refreshUser();
      setState({ status: "idle" });
    } catch (err) {
      const message = err instanceof PhotoRejected ? PHOTO_ERRORS[err.reason] : err instanceof ApiError && err.status === 413 ? PHOTO_ERRORS.too_large : "Nie udało się zapisać zdjęcia. Spróbuj ponownie.";
      setState({ status: "error", message });
    }
  }

  async function remove() {
    setState({ status: "working", action: "remove" });
    try {
      await api.removeAvatar();
      await refreshUser();
      setState({ status: "idle" });
    } catch {
      setState({ status: "error", message: "Nie udało się usunąć zdjęcia." });
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar url={user.avatar_url} name={user.full_name} size={72} label="Twoje zdjęcie" />
      <div className="flex flex-col gap-2 items-start">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => input.current?.click()}>
            {state.status === "working" && state.action === "upload" ? "Wysyłanie…" : user.avatar_url ? "Zmień zdjęcie" : "Dodaj zdjęcie"}
          </button>
          {user.avatar_url && (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={remove}>
              {state.status === "working" && state.action === "remove" ? "Usuwanie…" : "Usuń"}
            </button>
          )}
        </div>
        <p role="alert" className="text-sm min-h-5" style={{ color: "var(--color-danger)" }}>
          {state.status === "error" ? state.message : ""}
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
