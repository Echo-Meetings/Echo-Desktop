import { useState, useRef, useEffect, useCallback } from 'react'
import type { TranscriptResult, TranscriptSegment } from '@/types/models'
import { formatTimestamp, formatDuration, getFullText, getTimestampedText, isVideoFile } from '@/types/models'

const MIME_TYPES: Record<string, string> = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime',
  webm: 'video/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4',
  wav: 'audio/wav', ogg: 'audio/ogg'
}

function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  return MIME_TYPES[ext] || 'application/octet-stream'
}

const LANGUAGE_NAMES: Record<string, string> = {
  af: 'Afrikaans', ar: 'Arabic', be: 'Belarusian', bg: 'Bulgarian', bn: 'Bengali',
  ca: 'Catalan', cs: 'Czech', da: 'Danish', de: 'German', el: 'Greek',
  en: 'English', es: 'Spanish', et: 'Estonian', fi: 'Finnish', fr: 'French',
  hi: 'Hindi', hr: 'Croatian', hu: 'Hungarian', id: 'Indonesian', it: 'Italian',
  ja: 'Japanese', ko: 'Korean', lt: 'Lithuanian', lv: 'Latvian', nl: 'Dutch',
  no: 'Norwegian', pl: 'Polish', pt: 'Portuguese', ro: 'Romanian', ru: 'Russian',
  sk: 'Slovak', sl: 'Slovenian', sr: 'Serbian', sv: 'Swedish', th: 'Thai',
  tr: 'Turkish', uk: 'Ukrainian', vi: 'Vietnamese', zh: 'Chinese'
}

function displayLanguage(lang: string): string {
  return LANGUAGE_NAMES[lang.toLowerCase()] || lang
}

interface TranscriptViewProps {
  transcript: TranscriptResult
  mediaPath: string | null
}

export function TranscriptView({ transcript, mediaPath }: TranscriptViewProps) {
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null)
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [copyLabel, setCopyLabel] = useState('Copy')
  const [videoLoading, setVideoLoading] = useState(true)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isVideo = isVideoFile(transcript.fileName, mediaPath)

  // Use the correct ref based on media type
  const getMediaElement = useCallback((): HTMLMediaElement | null => {
    return isVideo ? videoRef.current : audioRef.current
  }, [isVideo])

  // mediaPath is already a file:// URL from the main process
  const mediaUrl = mediaPath || null

  // Time update handler
  const handleTimeUpdate = useCallback(() => {
    const el = getMediaElement()
    if (!el) return
    const t = el.currentTime
    setCurrentTime(t)

    // Find active segment
    const seg = transcript.segments.find((s) => t >= s.startTime && t < s.endTime)
    if (seg) {
      setActiveSegmentId(seg.id)
    }
  }, [transcript.segments, getMediaElement])

  // Auto-scroll to active segment during playback
  useEffect(() => {
    if (!activeSegmentId || !scrollContainerRef.current || !isPlaying) return
    const el = document.getElementById(`segment-${activeSegmentId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeSegmentId, isPlaying])

  const seekToSegment = useCallback((segment: TranscriptSegment) => {
    const el = getMediaElement()
    if (!el) return
    el.currentTime = segment.startTime
    if (el.paused) {
      el.play().catch(() => {})
    }
    setActiveSegmentId(segment.id)
    setCurrentTime(segment.startTime)
  }, [getMediaElement])

  const togglePlayPause = useCallback(() => {
    const el = getMediaElement()
    if (!el) return
    if (el.paused) {
      // If at end, restart
      if (el.currentTime >= el.duration - 0.5) {
        el.currentTime = 0
      }
      el.play().catch(() => {})
    } else {
      el.pause()
    }
  }, [getMediaElement])

  const seekTrackRef = useRef<HTMLDivElement>(null)

  const seekFromEvent = useCallback((clientX: number) => {
    const el = getMediaElement()
    const track = seekTrackRef.current
    if (!el || !duration || !track) return
    const rect = track.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    el.currentTime = fraction * duration
    setCurrentTime(fraction * duration)
  }, [getMediaElement, duration])

  const handleSeekMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    seekFromEvent(e.clientX)

    const onMove = (ev: MouseEvent) => seekFromEvent(ev.clientX)
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [seekFromEvent])

  const skipForward = useCallback(() => {
    const el = getMediaElement()
    if (!el) return
    el.currentTime = Math.min(el.duration, el.currentTime + 10)
    setCurrentTime(el.currentTime)
  }, [getMediaElement])

  const skipBackward = useCallback(() => {
    const el = getMediaElement()
    if (!el) return
    el.currentTime = Math.max(0, el.currentTime - 10)
    setCurrentTime(el.currentTime)
  }, [getMediaElement])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    setIsMuted(val === 0)
    const el = getMediaElement()
    if (el) {
      el.volume = val
      el.muted = val === 0
    }
  }, [getMediaElement])

  const toggleMute = useCallback(() => {
    const el = getMediaElement()
    if (!el) return
    if (isMuted) {
      el.muted = false
      el.volume = volume || 1
      setIsMuted(false)
      if (volume === 0) setVolume(1)
    } else {
      el.muted = true
      setIsMuted(true)
    }
  }, [getMediaElement, isMuted, volume])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const el = getMediaElement()
      if (!el) return
      if (e.code === 'Space') { e.preventDefault(); togglePlayPause() }
      if (e.code === 'ArrowLeft') { e.preventDefault(); skipBackward() }
      if (e.code === 'ArrowRight') { e.preventDefault(); skipForward() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [getMediaElement, togglePlayPause, skipBackward, skipForward])

  const handleCopy = async () => {
    await window.electronAPI.export.copyToClipboard(getFullText(transcript.segments))
    setCopyLabel('Copied ✓')
    setTimeout(() => setCopyLabel('Copy'), 1500)
  }

  const handleExport = async () => {
    const baseName = transcript.fileName.replace(/\.[^.]+$/, '')
    await window.electronAPI.export.saveTxt(baseName, getTimestampedText(transcript.segments))
  }

  // Common media event handlers
  const mediaEvents = {
    onTimeUpdate: handleTimeUpdate,
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      setDuration(e.currentTarget.duration)
      setMediaError(null)
    },
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
    onEnded: () => setIsPlaying(false),
    onError: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget
      const err = el.error
      const msg = err
        ? `Media error ${err.code}: ${err.message || 'Unknown'}`
        : 'Failed to load media'
      console.error('[TranscriptView] Media error:', msg, 'src:', mediaUrl)
      setMediaError(msg)
      setVideoLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      {/* Transcript panel (left) */}
      <div style={styles.transcriptPanel}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.fileName}>{transcript.fileName}</div>
          {transcript.detectedLanguage && (
            <span style={styles.languageBadge}>{displayLanguage(transcript.detectedLanguage)}</span>
          )}
        </div>

        {/* Stats bar */}
        {transcript.stats && (
          <div style={styles.statsBar}>
            <StatCard label="Duration" value={formatDuration(transcript.stats.audioDuration)} />
            <StatCard label="Processed in" value={formatDuration(transcript.stats.transcriptionDuration)} />
            <StatCard label="Speed" value={`${transcript.stats.speedRatio.toFixed(1)}x`} />
            <StatCard label="Words" value={String(transcript.stats.wordCount)} />
            <StatCard label="Characters" value={String(transcript.stats.characterCount)} />
          </div>
        )}

        {/* Media error banner for audio files */}
        {!isVideo && mediaError && (
          <div style={styles.mediaBanner}>
            <span>Audio playback error: {mediaError}</span>
          </div>
        )}

        {/* No media available */}
        {!mediaUrl && (
          <div style={styles.mediaBanner}>
            <span>Media file not available — playback disabled</span>
          </div>
        )}

        {/* Playback controls */}
        {mediaUrl && (
          <div style={styles.controls}>
            <button onClick={skipBackward} style={styles.skipButton} title="-10s">
              <span style={styles.skipLabel}>10</span>{'◁◁'}
            </button>
            <button onClick={togglePlayPause} style={styles.playButton}>
              {isPlaying ? '❚❚' : '▶'}
            </button>
            <button onClick={skipForward} style={styles.skipButton} title="+10s">
              {'▷▷'}<span style={styles.skipLabel}>10</span>
            </button>
            <span style={styles.timeDisplay}>{formatTimestamp(currentTime)}</span>
            <div ref={seekTrackRef} style={styles.seekTrack} onMouseDown={handleSeekMouseDown}>
              <div style={styles.seekTrackBg} />
              <div
                style={{
                  ...styles.seekFill,
                  width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%'
                }}
              />
              <div
                style={{
                  ...styles.seekThumb,
                  left: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%'
                }}
              />
            </div>
            <span style={styles.timeDisplay}>{formatTimestamp(duration)}</span>
            <button onClick={toggleMute} style={styles.volumeButton} title={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? '◇' : '◆'}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              style={styles.volumeSlider}
            />
          </div>
        )}

        {/* Segments */}
        <div ref={scrollContainerRef} style={styles.segmentList}>
          {transcript.segments.map((segment) => {
            const isActive = activeSegmentId === segment.id
            const isHovered = hoveredSegmentId === segment.id
            return (
              <div
                id={`segment-${segment.id}`}
                key={segment.id}
                onClick={() => seekToSegment(segment)}
                onMouseEnter={() => setHoveredSegmentId(segment.id)}
                onMouseLeave={() => setHoveredSegmentId(null)}
                style={{
                  ...styles.segmentRow,
                  backgroundColor: isActive
                    ? 'var(--color-highlight)'
                    : isHovered
                      ? 'var(--color-surface)'
                      : 'transparent',
                  cursor: mediaUrl ? 'pointer' : 'default'
                }}
              >
                {isActive && <div style={styles.activeBar} />}
                <span
                  style={{
                    ...styles.segmentTime,
                    color: isActive || isHovered
                      ? 'var(--color-foreground)'
                      : 'var(--color-secondary)',
                    textDecoration: isHovered && mediaUrl ? 'underline' : 'none'
                  }}
                >
                  {formatTimestamp(segment.startTime)}
                </span>
                <span style={styles.segmentText}>{segment.text}</span>
              </div>
            )
          })}
        </div>

        {/* Bottom bar */}
        <div style={styles.bottomBar}>
          <button onClick={handleCopy} style={styles.actionButton}>
            {copyLabel}
          </button>
          <button onClick={handleExport} style={styles.actionButton}>
            Export TXT
          </button>
        </div>
      </div>

      {/* Video panel (right side) */}
      {isVideo && mediaUrl && (
        <div style={styles.videoPanel}>
          {videoLoading && !mediaError && (
            <div style={styles.videoLoader}>
              <div style={styles.spinner} />
              <div style={styles.loaderText}>Loading video...</div>
            </div>
          )}
          {mediaError && (
            <div style={styles.videoLoader}>
              <div style={styles.loaderText}>Cannot play video</div>
              <div style={{ ...styles.loaderText, fontSize: 11, maxWidth: 280, wordBreak: 'break-word' as const }}>{mediaError}</div>
            </div>
          )}
          <video
            ref={videoRef}
            src={mediaUrl || undefined}
            style={{
              ...styles.videoElement,
              opacity: videoLoading || mediaError ? 0 : 1
            }}
            playsInline
            preload="auto"
            onLoadedData={() => { setVideoLoading(false); setMediaError(null) }}
            {...mediaEvents}
          />
        </div>
      )}

      {/* Hidden audio element for audio-only files */}
      {!isVideo && mediaUrl && (
        <audio
          ref={audioRef}
          src={mediaUrl || undefined}
          preload="auto"
          {...mediaEvents}
        />
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    height: '100%',
    overflow: 'hidden'
  },
  transcriptPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 'var(--spacing-sm)',
    flexShrink: 0
  },
  fileName: {
    fontSize: 'var(--font-heading)',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  languageBadge: {
    fontSize: 'var(--font-caption)',
    color: 'var(--color-secondary)',
    backgroundColor: 'var(--color-surface)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    flexShrink: 0
  },
  statsBar: {
    display: 'flex',
    gap: 8,
    padding: '0 var(--spacing-sm) var(--spacing-xs)',
    flexShrink: 0,
    overflowX: 'auto'
  },
  statCard: {
    flex: 1,
    minWidth: 80,
    padding: '8px 12px',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    textAlign: 'center'
  },
  statLabel: {
    fontSize: 11,
    color: 'var(--color-secondary)',
    marginBottom: 2
  },
  statValue: {
    fontSize: 'var(--font-body)',
    fontWeight: 600,
    fontFamily: 'ui-monospace, "SF Mono", monospace'
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px var(--spacing-sm)',
    flexShrink: 0
  },
  skipButton: {
    height: 28,
    border: 'none',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'transparent',
    color: 'var(--color-secondary)',
    cursor: 'pointer',
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    flexShrink: 0,
    padding: '0 4px'
  },
  skipLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--color-secondary)'
  },
  playButton: {
    width: 32,
    height: 32,
    border: 'none',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-foreground)',
    cursor: 'pointer',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  volumeButton: {
    width: 28,
    height: 28,
    border: 'none',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'transparent',
    color: 'var(--color-secondary)',
    cursor: 'pointer',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  volumeSlider: {
    width: 70,
    height: 4,
    flexShrink: 0,
    accentColor: 'var(--color-foreground)',
    cursor: 'pointer'
  },
  timeDisplay: {
    fontSize: 'var(--font-caption)',
    fontFamily: 'ui-monospace, "SF Mono", monospace',
    color: 'var(--color-secondary)',
    minWidth: 40,
    flexShrink: 0
  },
  seekTrack: {
    flex: 1,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    position: 'relative'
  },
  seekTrackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-border)'
  },
  seekFill: {
    position: 'absolute',
    left: 0,
    height: 6,
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-foreground)',
    transition: 'width 100ms linear'
  },
  seekThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: '50%',
    backgroundColor: 'var(--color-foreground)',
    transform: 'translateX(-50%)',
    transition: 'left 100ms linear',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
  },
  segmentList: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 var(--spacing-sm)'
  },
  segmentRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    transition: 'background-color 150ms ease',
    position: 'relative'
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 1.5,
    backgroundColor: 'var(--color-foreground)'
  },
  segmentTime: {
    fontSize: 'var(--font-caption)',
    fontFamily: 'ui-monospace, "SF Mono", monospace',
    flexShrink: 0,
    width: 56,
    paddingTop: 2,
    transition: 'color 150ms ease'
  },
  segmentText: {
    fontSize: 'var(--font-body)',
    lineHeight: 1.6,
    userSelect: 'text'
  },
  bottomBar: {
    display: 'flex',
    gap: 8,
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    borderTop: '1px solid var(--color-border)',
    flexShrink: 0
  },
  actionButton: {
    padding: '6px 14px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'transparent',
    color: 'var(--color-foreground)',
    fontSize: 'var(--font-button)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'var(--transition-fast)'
  },
  videoPanel: {
    width: 400,
    minWidth: 360,
    flexShrink: 0,
    backgroundColor: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeft: '1px solid var(--color-border)',
    position: 'relative' as const
  },
  videoElement: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    transition: 'opacity 300ms ease'
  },
  videoLoader: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 1
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid rgba(255,255,255,0.15)',
    borderTopColor: 'rgba(255,255,255,0.7)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  loaderText: {
    fontSize: 'var(--font-caption)',
    color: 'rgba(255,255,255,0.5)'
  },
  mediaBanner: {
    padding: '6px var(--spacing-sm)',
    fontSize: 'var(--font-caption)',
    color: 'var(--color-secondary)',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-sm)',
    margin: '0 var(--spacing-sm)',
    flexShrink: 0
  }
}
