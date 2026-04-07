import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "arcadeYoutubeQueue";
const INDEX_KEY = "arcadeYoutubeCurrentIndex";
const VOLUME_KEY = "arcadeYoutubeVolume";

function getVideoId(url) {
  if (!url) return "";

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "").trim();
    }

    if (parsed.hostname.includes("youtube.com")) {
      return (parsed.searchParams.get("v") || "").trim();
    }

    return "";
  } catch {
    return "";
  }
}

function isValidVideoId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{11}$/.test(id.trim());
}

function isValidYouTubeUrl(url) {
  return isValidVideoId(getVideoId(url));
}

function sanitizeQueue(queue) {
  if (!Array.isArray(queue)) return [];
  return queue.filter((item) => typeof item === "string" && isValidYouTubeUrl(item));
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
    const parsed = JSON.parse(raw);
    return sanitizeQueue(parsed);
  } catch {
    return [];
  }
}

function readStoredIndex() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function readStoredVolume() {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 50;
  } catch {
    return 50;
  }
}

function YouTubeQueuePlayer() {
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const draggedIndexRef = useRef(null);

  const [input, setInput] = useState("");
  const [queue, setQueue] = useState(readStoredQueue);
  const [currentIndex, setCurrentIndex] = useState(readStoredIndex);
  const [volume, setVolume] = useState(readStoredVolume);
  const [apiReady, setApiReady] = useState(false);
  const [playerError, setPlayerError] = useState("");

  const safeQueue = useMemo(() => sanitizeQueue(queue), [queue]);

  const safeCurrentIndex =
    safeQueue.length === 0 ? 0 : Math.min(currentIndex, safeQueue.length - 1);

  const currentVideoId = useMemo(() => {
    const currentUrl = safeQueue[safeCurrentIndex] || "";
    const id = getVideoId(currentUrl);
    return isValidVideoId(id) ? id : "";
  }, [safeQueue, safeCurrentIndex]);

  useEffect(() => {
    let mounted = true;

    loadYouTubeAPI().then(() => {
      if (!mounted) return;
      setApiReady(true);
    });

    return () => {
      mounted = false;
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
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
    if (safeQueue.length > 0 && currentIndex > safeQueue.length - 1) {
      setCurrentIndex(safeQueue.length - 1);
    }
  }, [safeQueue, currentIndex]);

  useEffect(() => {
    if (safeQueue.length === 0 && currentIndex !== 0) {
      setCurrentIndex(0);
    }
  }, [safeQueue.length, currentIndex]);

  useEffect(() => {
    if (!apiReady || !playerContainerRef.current) return;

    if (!playerRef.current) {
      playerRef.current = new window.YT.Player(playerContainerRef.current, {
        height: "220",
        width: "100%",
        videoId: currentVideoId || undefined,
        playerVars: {
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: (event) => {
            try {
              setPlayerError("");
              event.target.setVolume(volume);

              if (currentVideoId) {
                event.target.loadVideoById(currentVideoId);
              }
            } catch (error) {
              console.error("YouTube player onReady error:", error);
              setPlayerError("Could not load the current video.");
              event.target.stopVideo?.();
            }
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              handleSkip();
            }
          },
          onError: () => {
            setPlayerError("This video could not be played. It may be invalid or unavailable.");
            removeCurrentVideo();
          },
        },
      });
    }
  }, [apiReady, currentVideoId, volume]);

  useEffect(() => {
    if (!playerRef.current) return;

    try {
      setPlayerError("");

      if (currentVideoId) {
        playerRef.current.loadVideoById(currentVideoId);
        playerRef.current.setVolume(volume);
      } else {
        playerRef.current.stopVideo();
      }
    } catch (error) {
      console.error("YouTube load error:", error);
      setPlayerError("Could not load the current video.");
      playerRef.current.stopVideo?.();
      removeCurrentVideo();
    }
  }, [currentVideoId, volume]);

  function addToQueue() {
    const cleaned = input.trim();

    if (!isValidYouTubeUrl(cleaned)) {
      alert("Please enter a valid YouTube link.");
      return;
    }

    setQueue((prev) => {
      const next = [...sanitizeQueue(prev), cleaned];
      if (prev.length === 0) {
        setCurrentIndex(0);
      }
      return next;
    });

    setPlayerError("");
    setInput("");
  }

  function handlePlay() {
    try {
      if (!currentVideoId) return;
      playerRef.current?.playVideo();
    } catch (error) {
      console.error("Play error:", error);
      setPlayerError("Could not play this video.");
    }
  }

  function handlePause() {
    try {
      playerRef.current?.pauseVideo();
    } catch (error) {
      console.error("Pause error:", error);
    }
  }

  function handleMute() {
    try {
      playerRef.current?.mute();
    } catch (error) {
      console.error("Mute error:", error);
    }
  }

  function handleUnmute() {
    try {
      playerRef.current?.unMute();
    } catch (error) {
      console.error("Unmute error:", error);
    }
  }

  function handleSkip() {
    if (safeQueue.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % safeQueue.length);
  }

  function handlePick(index) {
    if (!safeQueue[index]) return;
    setPlayerError("");
    setCurrentIndex(index);
  }

  function removeSong(index) {
    setQueue((prev) => {
      const next = sanitizeQueue(prev).filter((_, i) => i !== index);

      if (next.length === 0) {
        setCurrentIndex(0);
        setPlayerError("");
        playerRef.current?.stopVideo?.();
        return [];
      }

      if (index < safeCurrentIndex) {
        setCurrentIndex((prevIndex) => Math.max(0, prevIndex - 1));
      } else if (index === safeCurrentIndex) {
        const newIndex = index >= next.length ? 0 : index;
        setCurrentIndex(newIndex);
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
    setPlayerError("");
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
          placeholder="Paste YouTube link"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (pasted) {
              e.preventDefault();
              setInput(pasted.trim());
              setPlayerError("");
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
                setPlayerError("");
              }
            } catch {
              alert("Clipboard paste was blocked. Try Command+V in the input.");
            }
          }}
        >
          Paste
        </button>

        <button className="neon-btn small-btn" onClick={clearQueue}>
          Clear
        </button>
      </div>

      {playerError && <div className="yt-empty">{playerError}</div>}

      <div className="yt-player-wrap">
        {apiReady ? (
          <div ref={playerContainerRef} className="yt-iframe-shell" />
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
          safeQueue.map((url, index) => (
            <div
              key={`${url}-${index}`}
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
                {index + 1}. {url}
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