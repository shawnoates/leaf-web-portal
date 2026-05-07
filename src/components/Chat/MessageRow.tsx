"use client";

import { MapPin, CheckCircle2, ExternalLink, Smartphone } from "lucide-react";
import type { FirMessage, UserLite } from "./types";

const APP_STORE_URL = "https://apps.apple.com/us/app/leaf-build-your-community/id1040588046";

interface Props {
  message: FirMessage;
  user?: UserLite;
  isFromCurrentUser: boolean;
  hideAvatar: boolean;
}

export default function MessageRow({
  message,
  user,
  isFromCurrentUser,
  hideAvatar,
}: Props) {
  const type = message.type;

  if (type === "response") return <ResponseRow text={message.text || ""} />;
  if (type === "checkIn" || type === "reservation") {
    return message.text && message.text.trim()
      ? <ResponseRow text={message.text} />
      : <CheckInRow message={message} type={type} />;
  }
  if (type === "locationSuggestion") {
    return (
      <LocationSuggestionRow
        message={message}
        user={user}
        isFromCurrentUser={isFromCurrentUser}
      />
    );
  }
  if (type === "readyToSplit") return <ReadyToSplitRow />;
  if (type && !["leafMessage"].includes(type)) {
    return <OpenInAppRow message={message} />;
  }
  return (
    <TextBubbleRow
      message={message}
      user={user}
      isFromCurrentUser={isFromCurrentUser}
      hideAvatar={hideAvatar}
    />
  );
}

// --- Default text bubble (covers leafMessage and untyped messages) ---

function TextBubbleRow({
  message,
  user,
  isFromCurrentUser,
  hideAvatar,
}: {
  message: FirMessage;
  user?: UserLite;
  isFromCurrentUser: boolean;
  hideAvatar: boolean;
}) {
  const isLeafAI = message.from === "leaf_ai";
  const senderName = isLeafAI ? "Leaf" : user?.name || "";
  const text = (message.text || "").trim();

  const avatar = isLeafAI ? (
    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold shrink-0">
      L
    </div>
  ) : user?.profilePictureUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={user.profilePictureUrl}
      alt={user.name}
      className="w-8 h-8 rounded-full object-cover shrink-0"
    />
  ) : (
    <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600 text-xs font-bold shrink-0">
      {senderName.charAt(0).toUpperCase() || "?"}
    </div>
  );

  return (
    <div
      className={`flex items-start gap-2 ${isFromCurrentUser && !isLeafAI ? "flex-row-reverse" : "flex-row"}`}
    >
      <div className="w-8 shrink-0">{hideAvatar ? null : avatar}</div>
      <div
        className={`max-w-[75%] flex flex-col ${isFromCurrentUser && !isLeafAI ? "items-end" : "items-start"}`}
      >
        {!hideAvatar && senderName && (
          <span className="text-[11px] text-zinc-400 mb-0.5 px-1">
            {senderName}
          </span>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm ${
            isFromCurrentUser && !isLeafAI
              ? "bg-zinc-900 text-white"
              : "bg-white border border-zinc-200 text-zinc-900"
          }`}
        >
          {message.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.imageUrl}
              alt=""
              className="rounded-lg mb-2 max-w-full max-h-80 object-cover cursor-pointer"
              onClick={() =>
                message.imageUrl && window.open(message.imageUrl, "_blank")
              }
            />
          )}
          {text && <Linkified text={text} />}
        </div>
      </div>
    </div>
  );
}

// --- response: short RSVP-style colored text (no bubble) ---

function ResponseRow({ text }: { text: string }) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const positive =
    lower.includes("going") ||
    lower.includes("yes") ||
    lower.includes("in") ||
    lower.includes("checked in");
  const negative =
    lower.includes("not going") || lower.includes("no") || lower.includes("out");

  const color = negative
    ? "text-rose-600"
    : positive
      ? "text-emerald-600"
      : "text-zinc-500";

  return (
    <div className="flex justify-center py-1">
      <span className={`text-xs font-medium ${color}`}>{trimmed}</span>
    </div>
  );
}

// --- checkIn / reservation: icon + location name ---

function CheckInRow({
  message,
  type,
}: {
  message: FirMessage;
  type: "checkIn" | "reservation";
}) {
  const label = type === "reservation" ? "Reservation" : "Check In";
  return (
    <div className="flex justify-center py-2">
      <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full text-xs">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span className="font-medium">{label}</span>
        {message.locationId && (
          <span className="text-emerald-600/70">·</span>
        )}
      </div>
    </div>
  );
}

// --- locationSuggestion: image card with name and address ---

function LocationSuggestionRow({
  message,
  user,
  isFromCurrentUser,
}: {
  message: FirMessage;
  user?: UserLite;
  isFromCurrentUser: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-2 ${isFromCurrentUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <div className="w-8 shrink-0">
        {user?.profilePictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.profilePictureUrl}
            alt={user.name}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600 text-xs font-bold">
            {user?.name?.charAt(0).toUpperCase() || "?"}
          </div>
        )}
      </div>
      <div className="max-w-[75%] bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        {message.suggestedLocationImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.suggestedLocationImageUrl}
            alt={message.suggestedLocationName || ""}
            className="w-full h-32 object-cover"
          />
        )}
        <div className="p-3 space-y-1.5">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 text-zinc-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {message.suggestedLocationName || "Location"}
              </p>
              {message.suggestedLocationAddress && (
                <p className="text-xs text-zinc-500 truncate">
                  {message.suggestedLocationAddress}
                </p>
              )}
            </div>
          </div>
          {message.text && message.text.trim() && (
            <p className="text-xs text-zinc-700 pt-1.5 border-t border-zinc-100">
              {message.text.trim()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- readyToSplit: strongest fallback CTA — best app-install pitch ---

function ReadyToSplitRow() {
  return (
    <div className="flex justify-center py-2">
      <div className="max-w-md w-full bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center text-lg">
            $
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-900">
              The bill is ready to split
            </p>
            <p className="text-xs text-zinc-600">
              Settle up in the Leaf app
            </p>
          </div>
        </div>
        <a
          href={APP_STORE_URL}
          className="flex items-center justify-center gap-2 w-full bg-zinc-900 text-white py-2.5 text-xs uppercase tracking-wider font-bold rounded-lg hover:opacity-90"
        >
          <Smartphone className="w-4 h-4" />
          Split the bill in the app
        </a>
      </div>
    </div>
  );
}

// --- Generic "Open in app" fallback for unsupported message types ---

function OpenInAppRow({ message }: { message: FirMessage }) {
  const copy = fallbackCopyForType(message.type);
  const preview = (message.text || "").trim().slice(0, 120);
  return (
    <div className="flex justify-center py-2">
      <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <ExternalLink className="w-4 h-4 mt-0.5 text-zinc-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900">{copy.title}</p>
            {preview && (
              <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{preview}</p>
            )}
          </div>
        </div>
        <a
          href={APP_STORE_URL}
          className="flex items-center justify-center gap-2 w-full border border-zinc-200 py-2 text-xs uppercase tracking-wider font-bold rounded-lg hover:bg-zinc-50"
        >
          <Smartphone className="w-3.5 h-3.5" />
          {copy.cta}
        </a>
      </div>
    </div>
  );
}

function fallbackCopyForType(type?: string): { title: string; cta: string } {
  switch (type) {
    case "poll":
      return { title: "There's a poll to vote on", cta: "Vote in the app" };
    case "hangoutSuggestion":
      return {
        title: "Vote on the next hangout",
        cta: "Open in the app",
      };
    case "note":
      return { title: "Someone shared a location note", cta: "Open in the app" };
    case "weeklySuggestionCarousel":
      return { title: "This week's picks", cta: "See picks in the app" };
    case "importedPlanShare":
      return { title: "A plan was shared", cta: "Watch in the app" };
    case "bountyShare":
    case "bounty":
      return { title: "A new plan idea — host it", cta: "Host in the app" };
    case "recommendationShare":
      return { title: "A recommendation was shared", cta: "Open in the app" };
    case "planShared":
    case "planConfirmation":
      return { title: "A plan was shared", cta: "Open in the app" };
    case "leafAIResponse":
      return { title: "Leaf AI sent a message", cta: "Open in the app" };
    default:
      return { title: "Message available in the app", cta: "Open in the app" };
  }
}

// --- Linkify URLs in text content ---

function Linkified({ text }: { text: string }) {
  const parts: Array<string | { url: string }> = [];
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push({ url: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <span key={i}>{p}</span>
        ) : (
          <a
            key={i}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-80"
          >
            {p.url}
          </a>
        )
      )}
    </span>
  );
}
