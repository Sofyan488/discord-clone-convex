import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ServerHeader } from "@/features/servers/ServerHeader";
import { ChannelManageModal } from "./ChannelManageModal";

export type Channel = {
  _id: Id<"channels">;
  name: string;
  type: "text" | "voice";
  _creationTime: number;
};

type Props = {
  serverId: Id<"servers">;
  serverName: string;
  isOwner: boolean;
  channels: Channel[];
  selectedId: Id<"channels"> | null;
  onSelect: (id: Id<"channels">) => void;
};

export function ChannelSidebar({
  serverId,
  serverName,
  isOwner,
  channels,
  selectedId,
  onSelect,
}: Props) {
  const remove = useMutation(api.channels.remove);
  const [createType, setCreateType] = useState<"text" | "voice" | null>(null);
  const [renaming, setRenaming] = useState<Channel | null>(null);

  const text = channels.filter((c) => c.type === "text");
  const voice = channels.filter((c) => c.type === "voice");

  async function onDelete(channel: Channel) {
    if (
      !window.confirm(
        `Delete #${channel.name}? Its messages will be removed permanently.`,
      )
    )
      return;
    await remove({ channelId: channel._id });
  }

  const Section = ({
    label,
    list,
    type,
    prefix,
  }: {
    label: string;
    list: Channel[];
    type: "text" | "voice";
    prefix: string;
  }) => (
    <div className="mb-3">
      <div className="flex items-center justify-between px-2 py-1">
        <h3 className="text-xs font-semibold uppercase text-discord-muted">
          {label}
        </h3>
        {isOwner && (
          <button
            onClick={() => setCreateType(type)}
            className="text-discord-muted hover:text-discord-text"
            title={`Create ${type} channel`}
            aria-label={`Create ${type} channel`}
          >
            +
          </button>
        )}
      </div>
      <ul>
        {list.map((c) => (
          <li key={c._id} className="group relative">
            <button
              onClick={() => onSelect(c._id)}
              className={`flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm ${
                selectedId === c._id
                  ? "bg-white/10 text-white"
                  : "text-discord-muted hover:bg-white/5 hover:text-discord-text"
              }`}
            >
              <span className="text-discord-muted">{prefix}</span>
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
            </button>
            {isOwner && (
              <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
                <button
                  onClick={() => setRenaming(c)}
                  className="text-xs text-discord-muted hover:text-discord-text"
                  title="Rename"
                  aria-label={`Rename ${c.name}`}
                >
                  ✎
                </button>
                <button
                  onClick={() => onDelete(c)}
                  className="text-xs text-discord-muted hover:text-discord-danger"
                  title="Delete"
                  aria-label={`Delete ${c.name}`}
                >
                  ✕
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <aside
      aria-label="Channels"
      className="flex w-60 shrink-0 flex-col bg-discord-sidebar"
    >
      <ServerHeader serverId={serverId} name={serverName} isOwner={isOwner} />
      <div className="flex-1 overflow-y-auto py-2">
        <Section label="Text channels" list={text} type="text" prefix="#" />
        <Section label="Voice channels" list={voice} type="voice" prefix="🔊" />
      </div>

      {createType && (
        <ChannelManageModal
          mode="create"
          serverId={serverId}
          defaultType={createType}
          open={true}
          onClose={() => setCreateType(null)}
        />
      )}
      {renaming && (
        <ChannelManageModal
          mode="rename"
          channelId={renaming._id}
          currentName={renaming.name}
          open={true}
          onClose={() => setRenaming(null)}
        />
      )}
    </aside>
  );
}
