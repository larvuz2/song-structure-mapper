import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import './App.css'
import { API_BASE, getTrackAudioUrl, getTrackMap, getTrackStatus, uploadTrack } from './api'
import { analyzeAudioFile, applyUploadedStems, makeDemoMap, type Section, type SongMap } from './analysis'

const sectionClass: Record<Section['type'], string> = {
  intro: 'intro',
  groove: 'groove',
  build: 'build',
  drop: 'drop',
  breakdown: 'breakdown',
  outro: 'outro',
  variation: 'variation',
}

type AnalysisProgress = {
  progress: number
  message: string
  stage: string
  state: 'idle' | 'uploading' | 'queued' | 'analyzing' | 'ready' | 'error' | 'fallback'
}

function App() {
  const [map, setMap] = useState<SongMap>(() => makeDemoMap())
  const [trackName, setTrackName] = useState('Demo electronic reference map')
  const [status, setStatus] = useState('Drop a full track to analyze on the VPS backend, then play it against the structure map.')
  const [progress, setProgress] = useState<AnalysisProgress>({
    progress: 0,
    message: 'Backend target: Option A VPS mode.',
    stage: 'idle',
    state: 'idle',
  })
  const [selected, setSelected] = useState<Section | null>(null)
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(map.duration)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localObjectUrl = useRef<string | null>(null)

  useEffect(() => () => {
    if (localObjectUrl.current) URL.revokeObjectURL(localObjectUrl.current)
  }, [])

  const maxEnergy = useMemo(() => Math.max(...map.energy, 1), [map.energy])
  const waveformBars = useMemo(() => map.energy.map((value, index) => ({
    id: `wave-${index}`,
    value: Math.max(0.08, value / maxEnergy),
    isBeat: index % 4 === 0,
  })), [map.energy, maxEnergy])
  const barMarkers = useMemo(() => {
    const step = map.bars > 128 ? 16 : 8
    return Array.from({ length: Math.floor(map.bars / step) + 1 }, (_, index) => index * step + 1).filter((bar) => bar <= map.bars)
  }, [map.bars])

  const playbackRatio = audioDuration ? currentTime / audioDuration : 0
  const currentBar = Math.max(1, Math.min(map.bars, Math.floor(playbackRatio * map.bars) + 1))
  const playbackSection = map.sections.find((section) => currentBar >= section.startBar && currentBar <= section.endBar)
  const activeSection = (isPlaying || currentTime > 0 ? playbackSection : null) ?? selected ?? map.sections[0]
  const playheadLeft = audioSrc ? playbackRatio * 100 : ((activeSection.startBar + activeSection.endBar) / 2 / map.bars) * 100

  async function onSong(file: File | undefined) {
    if (!file) return
    setTrackName(file.name)
    setSelected(null)
    setCurrentTime(0)
    setIsPlaying(false)
    setStatus('Uploading to VPS backend…')
    setProgress({ progress: 2, message: 'Uploading file to the analysis backend.', stage: 'upload', state: 'uploading' })

    if (localObjectUrl.current) URL.revokeObjectURL(localObjectUrl.current)
    localObjectUrl.current = URL.createObjectURL(file)
    setAudioSrc(localObjectUrl.current)

    try {
      const { trackId } = await uploadTrack(file)
      setStatus(`Track uploaded. Job ${trackId} is analyzing.`)
      await pollAnalysis(trackId)
    } catch (error) {
      setProgress({
        progress: 12,
        message: `VPS backend unavailable at ${API_BASE}. Running browser fallback so the interface still works locally.`,
        stage: 'fallback',
        state: 'fallback',
      })
      setStatus(`Backend unavailable; using browser fallback. ${error instanceof Error ? error.message : ''}`)
      try {
        const next = await analyzeAudioFile(file)
        setMap(next)
        setSelected(next.sections[0])
        setAudioDuration(next.duration)
        setProgress({ progress: 100, message: 'Fallback analysis ready. Press play.', stage: 'ready', state: 'ready' })
        setStatus('Fallback analysis ready. For full VPS mode, run the backend server and set VITE_API_BASE_URL.')
      } catch (fallbackError) {
        setProgress({ progress: 100, message: 'Could not analyze this file.', stage: 'error', state: 'error' })
        setStatus(`Could not decode this file. Try WAV/MP3. ${fallbackError instanceof Error ? fallbackError.message : ''}`)
      }
    }
  }

  async function pollAnalysis(trackId: string) {
    for (let attempt = 0; attempt < 240; attempt++) {
      const nextStatus = await getTrackStatus(trackId)
      setProgress({
        progress: nextStatus.progress,
        message: nextStatus.message,
        stage: nextStatus.stage,
        state: nextStatus.state,
      })
      setStatus(nextStatus.message)

      if (nextStatus.state === 'ready') {
        const nextMap = await getTrackMap(trackId)
        setMap(nextMap)
        setSelected(nextMap.sections[0])
        setAudioDuration(nextMap.duration)
        setAudioSrc(getTrackAudioUrl(trackId))
        setStatus('Analysis ready. Press play and watch the structure move.')
        return
      }

      if (nextStatus.state === 'error') throw new Error(nextStatus.message)
      await new Promise((resolve) => window.setTimeout(resolve, 900))
    }
    throw new Error('Analysis timed out. The backend job is taking too long.')
  }

  function onStems(files: FileList | null) {
    const list = Array.from(files ?? [])
    if (!list.length) return
    setMap((current) => applyUploadedStems(current, list))
    setStatus(`${list.length} stem lanes loaded. MVP visual supports 4+ stems; Demucs 4/6-stem backend separation is the next server step.`)
  }

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio || !audioSrc) return
    if (audio.paused) {
      await audio.play()
      setIsPlaying(true)
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }

  function seekToRatio(ratio: number) {
    const audio = audioRef.current
    if (!audio || !audioDuration) return
    const nextTime = Math.max(0, Math.min(audioDuration, ratio * audioDuration))
    audio.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  function selectSection(section: Section) {
    setSelected(section)
    if (audioSrc) {
      seekToRatio((section.startBar - 1) / map.bars)
    }
  }

  function onTimelineClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    seekToRatio((event.clientX - rect.left) / rect.width)
  }

  return (
    <main className="app-shell">
      <audio
        ref={audioRef}
        src={audioSrc ?? undefined}
        onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration || map.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onEnded={() => setIsPlaying(false)}
      />

      <section className="hero">
        <div>
          <p className="eyebrow">SONG STRUCTURE MAPPER MVP</p>
          <h1>Dark pastel x-ray for electronic tracks.</h1>
          <p className="subcopy">Upload one track, wait while the backend explains every analysis step, then play/pause and watch the arrangement map follow the song.</p>
        </div>
        <div className="upload-card">
          <label className="upload-button">
            <input type="file" accept="audio/*" onChange={(event) => void onSong(event.target.files?.[0])} />
            Analyze full song
          </label>
          <label className="upload-button secondary">
            <input type="file" accept="audio/*" multiple onChange={(event) => onStems(event.target.files)} />
            Add separated stems
          </label>
          <button className="ghost-button" onClick={() => { const demo = makeDemoMap(); setMap(demo); setTrackName('Demo electronic reference map'); setStatus('Demo map restored.'); setProgress({ progress: 0, message: 'Backend target: Option A VPS mode.', stage: 'idle', state: 'idle' }); setAudioSrc(null); setCurrentTime(0); setAudioDuration(demo.duration); }}>Reset demo</button>
          <p>{status}</p>
        </div>
      </section>

      <section className="progress-panel">
        <div className="progress-copy">
          <p className="eyebrow">Analysis communication</p>
          <h2>{progress.message}</h2>
          <span>{progress.stage} · {progress.state}</span>
        </div>
        <div className="progress-meter" aria-label="Analysis progress">
          <i style={{ width: `${progress.progress}%` }} />
        </div>
      </section>

      <section className="control-strip">
        <div><span>Track</span><strong>{trackName}</strong></div>
        <div><span>BPM</span><strong>{map.bpm}</strong></div>
        <div><span>Bars</span><strong>{map.bars}</strong></div>
        <div><span>Time</span><strong>{formatTime(currentTime)} / {formatTime(audioDuration || map.duration)}</strong></div>
        <div><span>Backend</span><strong>{API_BASE}</strong></div>
      </section>

      <section className="transport-panel">
        <button className="play-button" disabled={!audioSrc} onClick={() => void togglePlayback()}>{isPlaying ? 'Pause' : 'Play'}</button>
        <div>
          <p className="eyebrow">Now reading</p>
          <h2>{activeSection.label} · {activeSection.loop}</h2>
          <span>Bar {currentBar} / {map.bars}</span>
        </div>
      </section>

      <section className="audio-timeline-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Audio timeline</p>
            <h2>Waveform with section blocks</h2>
          </div>
          <p>Click the waveform or any block to seek. The playhead is synced to the real audio element.</p>
        </div>
        <div className="audio-timeline" aria-label="Waveform timeline with section overlay">
          <div className="timeline-ruler">
            {barMarkers.map((bar) => (
              <span key={bar} style={{ left: `${((bar - 1) / map.bars) * 100}%` }}>Bar {bar}</span>
            ))}
          </div>
          <div className="section-overlay">
            {map.sections.map((section) => (
              <button
                key={`overlay-${section.id}`}
                className={`overlay-block ${sectionClass[section.type]} ${activeSection.id === section.id ? 'active' : ''}`}
                style={{ flexGrow: section.endBar - section.startBar + 1 }}
                onClick={() => selectSection(section)}
              >
                <strong>{section.label}</strong>
                <span>{section.loop}</span>
              </button>
            ))}
          </div>
          <div className="waveform-track" onClick={onTimelineClick}>
            <div className="playhead" style={{ left: `${playheadLeft}%` }}>
              <i />
            </div>
            <div className="waveform-zero" />
            <div className="waveform-bars">
              {waveformBars.map((bar) => (
                <i
                  key={bar.id}
                  className={bar.isBeat ? 'beat' : undefined}
                  style={{ height: `${18 + bar.value * 78}%` }}
                />
              ))}
            </div>
          </div>
          <div className="timeline-footer">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(audioDuration || map.duration)}</span>
          </div>
        </div>
      </section>

      <section className="timeline-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Arrangement blocks</p>
            <h2>Section cards</h2>
          </div>
          <p>Click a section to inspect loop identity and jump playback.</p>
        </div>
        <div className="timeline">
          {map.sections.map((section) => (
            <button
              key={section.id}
              className={`section-block ${sectionClass[section.type]} ${activeSection.id === section.id ? 'active' : ''}`}
              style={{ flexGrow: section.endBar - section.startBar + 1 }}
              onClick={() => selectSection(section)}
            >
              <span>{section.label}</span>
              <strong>{section.loop}</strong>
              <small>Bars {section.startBar}–{section.endBar}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="card wide">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Stem lanes</p>
              <h2>Loop families by layer</h2>
            </div>
            <span className="pill">4+ stem-ready</span>
          </div>
          <div className="stem-map">
            {map.stems.map((stem) => (
              <div className="stem-row" key={stem.id}>
                <div className="stem-label" style={{ '--stem': stem.color } as CSSProperties}>
                  <i />
                  <span>{stem.name}</span>
                </div>
                <div className="stem-blocks">
                  {map.sections.map((section, index) => (
                    <div
                      key={`${stem.id}-${section.id}`}
                      className="stem-cell"
                      title={`${stem.name}: ${stem.loops[index]} / ${stem.activity[index]}% activity`}
                      style={{
                        flexGrow: section.endBar - section.startBar + 1,
                        '--stem': stem.color,
                        '--activity': stem.activity[index] / 100,
                      } as CSSProperties}
                    >
                      <span>{stem.loops[index]}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card inspector">
          <p className="eyebrow">Selected block</p>
          <h2>{activeSection.label}</h2>
          <dl>
            <div><dt>Bars</dt><dd>{activeSection.startBar}–{activeSection.endBar}</dd></div>
            <div><dt>Loop family</dt><dd>{activeSection.loop}</dd></div>
            <div><dt>Energy</dt><dd>{activeSection.energy}%</dd></div>
            <div><dt>Similarity</dt><dd>{activeSection.similarity}%</dd></div>
          </dl>
          <div className="mini-copy">Designed for electronic analysis: 8/16/32-bar phrases, repeated base loops, and clear section transitions.</div>
        </div>

        <div className="card energy-card">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Energy curve</p>
              <h2>Bar-level movement</h2>
            </div>
          </div>
          <div className="energy-chart">
            {map.energy.map((value, index) => (
              <i key={index} style={{ height: `${Math.max(7, (value / maxEnergy) * 100)}%` }} />
            ))}
          </div>
        </div>

        <div className="card matrix-card">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Repetition view</p>
              <h2>Self-similarity sketch</h2>
            </div>
          </div>
          <div className="similarity-grid">
            {map.sections.flatMap((a, row) => map.sections.map((b, col) => {
              const sameLoop = a.loop.replace(/[^A-Z]/g, '') === b.loop.replace(/[^A-Z]/g, '')
              const intensity = row === col ? 1 : sameLoop ? 0.72 : a.type === b.type ? 0.38 : 0.14
              return <i key={`${a.id}-${b.id}`} style={{ opacity: intensity }} />
            }))}
          </div>
        </div>
      </section>
    </main>
  )
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${String(remaining).padStart(2, '0')}`
}

export default App
