"use client";

import { useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n/provider";
import { PhotoRejected, photoToAvatarJpeg } from "@/lib/image";
import type { AppUser } from "@/lib/types";
import { Avatar } from "../avatar";

/** Что происходит с фото: только один вариант в каждый момент, поэтому «загружается и ошибка» одновременно невозможны. */
type PhotoState = { status: "idle" } | { status: "working"; action: "upload" | "remove" } | { status: "error"; message: string };

export function AvatarUploader({ user }: { user: AppUser }) {
  const { refreshUser } = useAuth();
  const { m } = useI18n();
  const [state, setState] = useState<PhotoState>({ status: "idle" });
  const input = useRef<HTMLInputElement>(null);
  const busy = state.status === "working";
  const errors = m.profile.photoErrors;

  async function upload(file: File) {
    setState({ status: "working", action: "upload" });
    try {
      await api.uploadAvatar(await photoToAvatarJpeg(file));
      await refreshUser();
      setState({ status: "idle" });
    } catch (err) {
      const message = err instanceof PhotoRejected ? errors[err.reason] : err instanceof ApiError && err.status === 413 ? errors.too_large : errors.saveFailed;
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
      setState({ status: "error", message: errors.removeFailed });
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar url={user.avatar_url} name={user.full_name} size={72} label={m.profile.photoAlt} />
      <div className="flex flex-col gap-2 items-start">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => input.current?.click()}>
            {state.status === "working" && state.action === "upload" ? m.profile.uploading : user.avatar_url ? m.profile.changePhoto : m.profile.addPhoto}
          </button>
          {user.avatar_url && (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={remove}>
              {state.status === "working" && state.action === "remove" ? m.profile.removing : m.profile.remove}
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
