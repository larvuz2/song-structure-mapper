export type SectionType = 'intro' | 'groove' | 'build' | 'drop' | 'breakdown' | 'outro' | 'variation'

export type Section = {
  id: string
  label: string
  type: SectionType
  startBar: number
  endBar: number
  loop: string
  energy: number
  similarity: number
}

export type StemLane = {
  id: string
  name: string
  color: string
  activity: number[]
  loops: string[]
}

export type SongMap = {
  bpm: number
  bars: number
  duration: number
  sections: Section[]
  energy: number[]
  stems: StemLane[]
}

export const stemPalette = [
  '#A7F3D0',
  '#93C5FD',
  '#FBCFE8',
  '#FDE68A',
  '#C4B5FD',
  '#FCA5A5',
]

const sectionTypes: SectionType[] = ['intro', 'groove', 'build', 'drop', 'breakdown', 'build', 'drop', 'outro']
const loopNames = ['A', 'A', 'B', 'C', 'D', 'B↑', 'C2', 'A-out']

export function makeDemoMap(): SongMap {
  const bars = 160
  const sectionLengths = [16, 16, 16, 32, 16, 16, 32, 16]
  let cursor = 1
  const sections: Section[] = sectionLengths.map((length, i) => {
    const startBar = cursor
    const endBar = cursor + length - 1
    cursor += length
    const type = sectionTypes[i]
    const energyByType: Record<SectionType, number> = {
      intro: 24,
      groove: 58,
      build: 74,
      drop: i === 6 ? 96 : 91,
      breakdown: 32,
      outro: 18,
      variation: 64,
    }
    return {
      id: `${type}-${i}`,
      label: type === 'drop' ? `Drop ${i === 6 ? '2' : '1'}` : titleCase(type),
      type,
      startBar,
      endBar,
      loop: `Loop ${loopNames[i]}`,
      energy: energyByType[type],
      similarity: type === 'drop' ? 88 : type === 'groove' ? 76 : 54,
    }
  })

  const energy = Array.from({ length: bars }, (_, i) => {
    const bar = i + 1
    const sec = sections.find((s) => bar >= s.startBar && bar <= s.endBar) ?? sections[0]
    const local = (bar - sec.startBar) / Math.max(1, sec.endBar - sec.startBar)
    const rise = sec.type === 'build' ? local * 22 : sec.type === 'drop' ? Math.sin(local * Math.PI) * 8 : 0
    return Math.min(100, Math.max(4, sec.energy + rise + Math.sin(i / 2.2) * 4))
  })

  const stemNames = ['Drums', 'Bass', 'Synths / Music', 'Vocal / Lead', 'FX / Atmosphere', 'Extra stem']
  const stems = stemNames.map((name, stemIndex) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    color: stemPalette[stemIndex],
    activity: Array.from({ length: sections.length }, (_, sectionIndex) => stemActivity(stemIndex, sections[sectionIndex].type)),
    loops: sections.map((section, sectionIndex) => stemLoop(stemIndex, section.type, sectionIndex)),
  }))

  return { bpm: 128, bars, duration: 300, sections, energy, stems }
}

export async function analyzeAudioFile(file: File): Promise<SongMap> {
  const buffer = await file.arrayBuffer()
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const context = new AudioContextCtor()
  const decoded = await context.decodeAudioData(buffer.slice(0))
  const mono = mixToMono(decoded)
  const frameSize = 2048
  const hop = 1024
  const rms = computeRms(mono, frameSize, hop)
  const duration = decoded.duration
  const bpm = estimateBpmFromEnvelope(rms, duration)
  const bars = Math.max(32, Math.round((duration / 60) * bpm / 4))
  const energy = resample(rms, bars).map((v) => Math.round(v * 100))
  const sections = buildSectionsFromEnergy(energy)
  await context.close()

  const stems = ['Drums', 'Bass', 'Synths / Music', 'Vocal / Lead'].map((name, stemIndex) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    color: stemPalette[stemIndex],
    activity: sections.map((section) => stemActivity(stemIndex, section.type)),
    loops: sections.map((section, sectionIndex) => stemLoop(stemIndex, section.type, sectionIndex)),
  }))

  return { bpm, bars, duration, sections, energy, stems }
}

export function applyUploadedStems(base: SongMap, files: File[]): SongMap {
  if (!files.length) return base
  return {
    ...base,
    stems: files.map((file, index) => ({
      id: file.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: cleanStemName(file.name, index),
      color: stemPalette[index % stemPalette.length],
      activity: base.sections.map((section) => stemActivity(index, section.type)),
      loops: base.sections.map((section, sectionIndex) => stemLoop(index, section.type, sectionIndex)),
    })),
  }
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  const out = new Float32Array(buffer.length)
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i++) out[i] += data[i] / buffer.numberOfChannels
  }
  return out
}

function computeRms(samples: Float32Array, frameSize: number, hop: number): number[] {
  const out: number[] = []
  let max = 0
  for (let offset = 0; offset + frameSize < samples.length; offset += hop) {
    let sum = 0
    for (let i = 0; i < frameSize; i++) sum += samples[offset + i] ** 2
    const value = Math.sqrt(sum / frameSize)
    max = Math.max(max, value)
    out.push(value)
  }
  return out.map((v) => (max ? v / max : 0))
}

function estimateBpmFromEnvelope(rms: number[], duration: number): number {
  if (duration < 20) return 128
  const peaks = rms.filter((v, i) => v > 0.62 && v > (rms[i - 1] ?? 0) && v > (rms[i + 1] ?? 0)).length
  const rough = Math.round((peaks / duration) * 60)
  if (!Number.isFinite(rough) || rough < 80 || rough > 170) return 128
  return rough
}

function resample(values: number[], target: number): number[] {
  if (!values.length) return Array.from({ length: target }, () => 0)
  const out: number[] = []
  for (let i = 0; i < target; i++) {
    const start = Math.floor((i / target) * values.length)
    const end = Math.max(start + 1, Math.floor(((i + 1) / target) * values.length))
    const slice = values.slice(start, end)
    out.push(slice.reduce((sum, v) => sum + v, 0) / slice.length)
  }
  return out
}

function buildSectionsFromEnergy(energy: number[]): Section[] {
  const bars = energy.length
  const block = bars > 128 ? 16 : 8
  const sections: Section[] = []
  let loopIndex = 0
  for (let start = 1; start <= bars; start += block) {
    const end = Math.min(bars, start + block - 1)
    const slice = energy.slice(start - 1, end)
    const avg = slice.reduce((sum, v) => sum + v, 0) / Math.max(1, slice.length)
    const prev = sections[sections.length - 1]?.energy ?? avg
    const type: SectionType = start === 1 ? 'intro' : end === bars ? 'outro' : avg > 74 ? 'drop' : avg > prev + 12 ? 'build' : avg < 36 ? 'breakdown' : 'groove'
    sections.push({
      id: `${type}-${start}`,
      label: type === 'drop' ? `Drop ${sections.filter((s) => s.type === 'drop').length + 1}` : titleCase(type),
      type,
      startBar: start,
      endBar: end,
      loop: `Loop ${String.fromCharCode(65 + (loopIndex++ % 6))}`,
      energy: Math.round(avg),
      similarity: Math.round(48 + avg * 0.42),
    })
  }
  return sections
}

function stemActivity(stemIndex: number, type: SectionType): number {
  const table: Record<SectionType, number[]> = {
    intro: [45, 12, 28, 8, 54, 20],
    groove: [76, 70, 52, 35, 38, 42],
    build: [82, 64, 74, 42, 85, 66],
    drop: [96, 94, 86, 58, 72, 74],
    breakdown: [12, 18, 62, 44, 70, 36],
    outro: [36, 22, 24, 4, 38, 16],
    variation: [64, 62, 70, 42, 50, 54],
  }
  return table[type][stemIndex % 6]
}

function stemLoop(stemIndex: number, type: SectionType, sectionIndex: number): string {
  if (type === 'breakdown' && stemIndex < 2) return '—'
  if (type === 'intro' && stemIndex === 1) return 'ghost'
  const base = ['A', 'B', 'C', 'D', 'FX', 'X'][stemIndex % 6]
  const variation = type === 'drop' && sectionIndex > 4 ? '2' : type === 'build' ? '↑' : ''
  return `${base}${variation}`
}

function cleanStemName(name: string, index: number): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
  return base.trim() || `Stem ${index + 1}`
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
