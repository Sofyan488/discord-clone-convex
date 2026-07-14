import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/Spinner";
import { DmMessageList } from "./DmMessageList";
import { MessageComposer } from "@/features/messages/MessageComposer";
import { TypingIndicator } from "@/features/messages/TypingIndicator";
import { CallView } from "@/features/calls/CallView";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// A single DM conversation (FR-027). Reuses the shared composer/typing/scroller.
export function DmConversation() {
  const { threadId } = useParams();
  const id = threadId as Id<"directMessageThreads">;
  const threads = useQuery(api.directMessages.listThreads);
  const send = useMutation(api.directMessages.send);
  const [inCall, setInCall] = useState(false);

  if (threads === undefined) {
    return (
      <main className="grid min-w-0 flex-1 place-items-center bg-discord-bg">
        <Spinner />
      </main>
    );
  }

  const thread = threads.find((t) => t.threadId === id);
  if (!thread) {
    return (
      <main className="grid min-w-0 flex-1 place-items-center bg-discord-bg text-discord-muted">
        Conversation not found.
      </main>
    );
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-discord-bg">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-4 font-semibold shadow-sm">
        <Avatar
          name={thread.otherUser.name}
          src={thread.otherUser.avatarUrl}
          online={thread.otherUser.online}
        />
        <span className="flex-1">{thread.otherUser.name}</span>
        {!inCall && (
          <button
            onClick={() => setInCall(true)}
            className="text-lg"
            title="Start video call"
            aria-label="Start video call"
          >
            📹
          </button>
        )}
      </div>

      {inCall ? (
        <div className="min-h-0 flex-1">
          <ErrorBoundary
            title="This call ran into a problem."
            onLeave={() => setInCall(false)}
            leaveLabel="Leave call"
          >
            <CallView
              target={{ threadId: id }}
              title={`Call with ${thread.otherUser.name}`}
              onLeave={() => setInCall(false)}
            />
          </ErrorBoundary>
        </div>
      ) : (
        <>
          <DmMessageList threadId={id} />
          <TypingIndicator target={{ threadId: id }} />
          <MessageComposer
            placeholder={`Message @${thread.otherUser.name}`}
            typingTarget={{ threadId: id }}
            onSend={(content, clientKey) =>
              send({ threadId: id, content, clientKey }).then(() => {})
            }
          />
        </>
      )}
    </main>
  );
}
