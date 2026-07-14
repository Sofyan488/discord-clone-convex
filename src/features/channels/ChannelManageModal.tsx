import { FormEvent, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

type CreateProps = {
  mode: "create";
  serverId: Id<"servers">;
  defaultType?: "text" | "voice";
  open: boolean;
  onClose: () => void;
};
type RenameProps = {
  mode: "rename";
  channelId: Id<"channels">;
  currentName: string;
  open: boolean;
  onClose: () => void;
};

export function ChannelManageModal(props: CreateProps | RenameProps) {
  const create = useMutation(api.channels.create);
  const rename = useMutation(api.channels.rename);
  const [name, setName] = useState(
    props.mode === "rename" ? props.currentName : "",
  );
  const [type, setType] = useState<"text" | "voice">(
    props.mode === "create" ? (props.defaultType ?? "text") : "text",
  );
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      if (props.mode === "create") {
        await create({ serverId: props.serverId, name, type });
      } else {
        await rename({ channelId: props.channelId, name });
      }
      props.onClose();
      if (props.mode === "create") setName("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={props.open}
      title={props.mode === "create" ? "Create channel" : "Rename channel"}
      onClose={props.onClose}
    >
      <form onSubmit={onSubmit}>
        {props.mode === "create" && (
          <div className="mb-4 flex gap-2">
            {(["text", "voice"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 rounded border px-3 py-2 text-sm capitalize ${
                  type === t
                    ? "border-discord-accent bg-discord-accent/20"
                    : "border-white/10"
                }`}
              >
                {t === "text" ? "# Text" : "🔊 Voice"}
              </button>
            ))}
          </div>
        )}
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold uppercase text-discord-muted">
            Channel name
          </span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus
            placeholder="new-channel"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={props.onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || busy}>
            {props.mode === "create" ? "Create" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
