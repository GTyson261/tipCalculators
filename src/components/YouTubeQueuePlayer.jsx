import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "arcadeYoutubeQueue";
const INDEX_KEY = "arcadeYoutubeCurrentIndex";
const VOLUME_KEY = "arcadeYoutubeVolume";

function extractVideoId(input) {
  if (!input || typeof input !== "string") return "";

  const text = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) {
    return text;
  }

  try {
    const url = new URL(text);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.replace("/", "").trim();
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = (url.searchParams.get("v") || "").trim();
      if (/^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      const pathParts = url.pathname.split("/").filter(Boolean);

      if (pathParts[0] === "embed" && /^[a-zA-Z0-9_-]{11}$/.test(pathParts[1] || "")) {
        return pathParts[1];
      }

      if (pathParts[0] === "shorts" && /^[a-zA-Z0-9_-]{11}$/.test(pathParts[1] || "")) {
        return pathParts[1];
      }
    }
  } catch {
    const match = text.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    if (match) return match[1];
  }

  return "";
}

function isValidVideoId(id) {
  return /^[a-zA-Z0-9_-]{11}$/.test((id || "").trim());
}

function normalizeQueueItem(value) {
  const id = extractVideoId(value);
  return isValidVideoId(id) ? id : "";
}

function sanitizeQueue(queue) {
  if (!Array.isArray(queue)) return [];
  return queue
    .map((item) => normalizeQueueItem(item))
    .filter(Boolean);
}

function loadYouTubeAPI() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }

    const existing = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    );

    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === "function") previous();
      resolve(window.YT);
    };
  });
}

function readStoredQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return sanitizeQueue(JSON.parse(raw));
  } catch {
    return [];
  }
}

function readStoredIndex() {
  try {
    const raw = Number(localStorage.getItem(INDEX_KEY));
    return Number.isInteger(raw) && raw >= 0 ? raw : 0;
  } catch {
    return 0;
  }
}

function readStoredVolume() {
  try {
    const raw = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 50;
  } catch {
    return 50;
  }
}

function YouTubeQueuePlayer() {
  const playerRef = useRef(null);
  const playerShellRef = useRef(null);
  const draggedIndexRef = useRef(null);

  const [input, setInput] = useState("");
  const [queue, setQueue] = useState(readStoredQueue);
  const [currentIndex, setCurrentIndex] = useState(readStoredIndex);
  const [volume, setVolume] = useState(readStoredVolume);
  const [apiReady, setApiReady] = useState(false);
  const [message, setMessage] = useState("");

  const safeQueue = useMemo(() => sanitizeQueue(queue), [queue]);

  const safeCurrentIndex =
    safeQueue.length === 0 ? 0 : Math.min(currentIndex, safeQueue.length - 1);

  const currentVideoId = safeQueue[safeCurrentIndex] || "";

  useEffect(() => {
    let mounted = true;

    loadYouTubeAPI().then(() => {
      if (mounted) setApiReady(true);
    });

    return () => {
      mounted = false;
      try {
        playerRef.current?.destroy?.();
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    if (safeQueue.length !== queue.length) {
      setQueue(safeQueue);
    }
  }, [queue, safeQueue]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeQueue));
  }, [safeQueue]);

  useEffect(() => {
    localStorage.setItem(INDEX_KEY, String(safeCurrentIndex));
  }, [safeCurrentIndex]);

  useEffect(() => {
    localStorage.setItem(VOLUME_KEY, String(volume));
  }, [volume]);

  useEffect(() => {
    if (safeQueue.length === 0 && currentIndex !== 0) {
      setCurrentIndex(0);
      return;
    }

    if (safeQueue.length > 0 && currentIndex > safeQueue.length - 1) {
      setCurrentIndex(safeQueue.length - 1);
    }
  }, [safeQueue, currentIndex]);

  useEffect(() => {
    if (!apiReady || !playerShellRef.current || playerRef.current) return;

    playerRef.current = new window.YT.Player(playerShellRef.current, {
      height: "220",
      width: "100%",
      playerVars: {
        playsinline: 1,
        rel: 0,
      },
      events: {
        onReady: (event) => {
          setMessage("");
          try {
            event.target.setVolume(volume);

            if (isValidVideoId(currentVideoId)) {
              event.target.loadVideoById(currentVideoId);
            }
          } catch {
            setMessage("Could not load the current video.");
          }
        },
        onStateChange: (event) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            handleSkip();
          }
        },
        onError: () => {
          setMessage("That video could not be played, so it was removed.");
          removeCurrentVideo();
        },
      },
    });
  }, [apiReady, currentVideoId, volume]);

  useEffect(() => {
    if (!playerRef.current) return;

    try {
      playerRef.current.setVolume(volume);

      if (isValidVideoId(currentVideoId)) {
        setMessage("");
        playerRef.current.loadVideoById(currentVideoId);
      } else {
        playerRef.current.stopVideo?.();
      }
    } catch {
      setMessage("Could not load the current video.");
      removeCurrentVideo();
    }
  }, [currentVideoId, volume]);

  function addToQueue() {
    const id = extractVideoId(input);

    if (!isValidVideoId(id)) {
      setMessage("Please paste a valid YouTube link or video ID.");
      return;
    }

    setQueue((prev) => [...sanitizeQueue(prev), id]);
    setInput("");
    setMessage("");
  }

  function handlePlay() {
    try {
      if (!isValidVideoId(currentVideoId)) {
        setMessage("Add a valid video first.");
        return;
      }
      playerRef.current?.playVideo?.();
    } catch {
      setMessage("Could not play this video.");
    }
  }

  function handlePause() {
    try {
      playerRef.current?.pauseVideo?.();
    } catch {
      // ignore
    }
  }

  function handleMute() {
    try {
      playerRef.current?.mute?.();
    } catch {
      // ignore
    }
  }

  function handleUnmute() {
    try {
      playerRef.current?.unMute?.();
    } catch {
      // ignore
    }
  }

  function handleSkip() {
    if (safeQueue.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % safeQueue.length);
  }

  function handlePick(index) {
    if (!safeQueue[index]) return;
    setCurrentIndex(index);
    setMessage("");
  }

  function removeSong(index) {
    setQueue((prev) => {
      const next = sanitizeQueue(prev).filter((_, i) => i !== index);

      if (next.length === 0) {
        setCurrentIndex(0);
        setMessage("");
        try {
          playerRef.current?.stopVideo?.();
        } catch {
          // ignore
        }
        return [];
      }

      if (index < safeCurrentIndex) {
        setCurrentIndex((prevIndex) => Math.max(0, prevIndex - 1));
      } else if (index === safeCurrentIndex) {
        setCurrentIndex(index >= next.length ? 0 : index);
      }

      return next;
    });
  }

  function removeCurrentVideo() {
    if (safeQueue.length === 0) return;
    removeSong(safeCurrentIndex);
  }

  function clearQueue() {
    setQueue([]);
    setCurrentIndex(0);
    setInput("");
    setMessage("");
    try {
      playerRef.current?.stopVideo?.();
    } catch {
      // ignore
    }
  }

  function onDragStart(index) {
    draggedIndexRef.current = index;
  }

  function onDrop(dropIndex) {
    const dragIndex = draggedIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) return;

    setQueue((prev) => {
      const next = [...sanitizeQueue(prev)];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, moved);

      if (dragIndex === safeCurrentIndex) {
        setCurrentIndex(dropIndex);
      } else if (dragIndex < safeCurrentIndex && dropIndex >= safeCurrentIndex) {
        setCurrentIndex((prevIndex) => prevIndex - 1);
      } else if (dragIndex > safeCurrentIndex && dropIndex <= safeCurrentIndex) {
        setCurrentIndex((prevIndex) => prevIndex + 1);
      }

      return next;
    });

    draggedIndexRef.current = null;
  }

  return (
    <div className="yt-card">
      <h3 className="yt-title">YouTube Queue</h3>

      <div className="yt-input-row">
        <input
          type="text"
          placeholder="Paste YouTube link or ID"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (pasted) {
              e.preventDefault();
              setInput(pasted.trim());
              setMessage("");
            }
          }}
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              addToQueue();
            }
          }}
          className="glass-input"
        />

        <button className="neon-btn" onClick={addToQueue}>
          Add
        </button>

        <button
          className="neon-btn small-btn"
          onClick={async () => {
            try {
              const text = await navigator.clipboard.readText();
              if (text) {
                setInput(text.trim());
                setMessage("");
              }
            } catch {
              setMessage("Clipboard access was blocked. Click the input and use Command+V.");
            }
          }}
        >
          Paste
        </button>

        <button className="neon-btn small-btn" onClick={clearQueue}>
          Clear
        </button>
      </div>

      {message && <div className="yt-empty">{message}</div>}

      <div className="yt-player-wrap">
        {apiReady ? (
          <div ref={playerShellRef} className="yt-iframe-shell" />
        ) : (
          <div className="yt-empty">Loading YouTube player...</div>
        )}
      </div>

      <div className="yt-controls">
        <button className="neon-btn small-btn" onClick={handlePlay}>
          Play
        </button>
        <button className="neon-btn small-btn" onClick={handlePause}>
          Pause
        </button>
        <button className="neon-btn small-btn" onClick={handleMute}>
          Mute
        </button>
        <button className="neon-btn small-btn" onClick={handleUnmute}>
          Unmute
        </button>
        <button className="neon-btn small-btn" onClick={handleSkip}>
          Skip
        </button>
      </div>

      <div className="yt-volume-wrap">
        <label className="yt-volume-label">Volume: {volume}</label>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="yt-volume-slider"
        />
      </div>

      <div className="yt-queue-list">
        {safeQueue.length === 0 ? (
          <p className="yt-queue-empty">Queue is empty</p>
        ) : (
          safeQueue.map((videoId, index) => (
            <div
              key={`${videoId}-${index}`}
              className={`yt-queue-row ${
                index === safeCurrentIndex ? "yt-queue-item-active" : ""
              }`}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(index)}
            >
              <button
                className="yt-queue-item"
                onClick={() => handlePick(index)}
              >
                {index + 1}. {videoId}
              </button>

              <button
                className="yt-remove-btn"
                onClick={() => removeSong(index)}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default YouTubeQueuePlayer;