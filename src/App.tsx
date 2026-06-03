import { useMemo, useState } from 'react'
import './App.css'
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

function App() {
  const [map, setMap] = useState<SongMap>(() => makeDemoMap())
  const [trackName, setTrackName] = useState('Demo electronic reference map')
  const [status, setStatus] = useState('Drop a full track to analyze, or add 4+ stems when separated.')
  const [selected, setSelected] = useState<Section | null>(null)

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
  const activeSection = selected ?? map.sections.find((s) => s.type === 'drop') ?? map.sections[0]
  const activeSectionCenter = ((activeSection.startBar + activeSection.endBar) / 2 / map.bars) * 100

  async function onSong(file: File | undefined) {
    if (!file) return
    setTrackName(file.name)
    setStatus('Analyzing waveform, energy blocks, BPM estimate, and repeated loop families…')
    try {
      const next = await analyzeAudioFile(file)
      setMap(next)
      setSelected(next.sections[0])
      setStatus('Analysis ready. For real 4/6-stem separation, run the Demucs backend command in docs/MVP_PLAN.md.')
    } catch (error) {
      setStatus(`Could not decode this file in-browser. Try WAV/MP3. ${error instanceof Error ? error.message : ''}`)
    }
  }

  function onStems(files: FileList | null) {
    const list = Array.from(files ?? [])
    if (!list.length) return
    setMap((current) => applyUploadedStems(current, list))
    setStatus(`${list.length} stem lanes loaded. MVP visual supports 4+ stems; default target is 6: drums, bass, vocals, other, guitar, piano.`)
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">SONG STRUCTURE MAPPER MVP</p>
          <h1>Dark pastel x-ray for electronic tracks.</h1>
          <p className="subcopy">Split the track into readable musical blocks: intro, groove, builds, drops, breakdowns, stem activity, repeated loop families, and energy movement.</p>
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
          <button className="ghost-button" onClick={() => { setMap(makeDemoMap()); setTrackName('Demo electronic reference map'); setStatus('Demo map restored.'); }}>Reset demo</button>
          <p>{status}</p>
        </div>
      </section>

      <section className="control-strip">
        <div><span>Track</span><strong>{trackName}</strong></div>
        <div><span>BPM</span><strong>{map.bpm}</strong></div>
        <div><span>Bars</span><strong>{map.bars}</strong></div>
        <div><span>Stems</span><strong>{map.stems.length}</strong></div>
        <div><span>Target separation</span><strong>4–6 stems</strong></div>
      </section>

      <section className="audio-timeline-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Audio timeline</p>
            <h2>Waveform with section blocks</h2>
          </div>
          <p>Blocks sit on top of the waveform so the song reads like a DAW arrangement view.</p>
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
                onClick={() => setSelected(section)}
              >
                <strong>{section.label}</strong>
                <span>{section.loop}</span>
              </button>
            ))}
          </div>
          <div className="waveform-track">
            <div className="playhead" style={{ left: `${activeSectionCenter}%` }}>
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
            <span>0:00</span>
            <span>{Math.floor(map.duration / 60)}:{String(Math.round(map.duration % 60)).padStart(2, '0')}</span>
          </div>
        </div>
      </section>

      <section className="timeline-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Arrangement blocks</p>
            <h2>Section cards</h2>
          </div>
          <p>Click a section to inspect loop identity and energy.</p>
        </div>
        <div className="timeline">
          {map.sections.map((section) => (
            <button
              key={section.id}
              className={`section-block ${sectionClass[section.type]} ${activeSection.id === section.id ? 'active' : ''}`}
              style={{ flexGrow: section.endBar - section.startBar + 1 }}
              onClick={() => setSelected(section)}
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
                <div className="stem-label" style={{ '--stem': stem.color } as React.CSSProperties}>
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
                      } as React.CSSProperties}
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

export default App
