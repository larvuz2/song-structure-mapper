import type { SongMap } from './analysis'

export type TrackStatus = {
  trackId: string
  state: 'queued' | 'analyzing' | 'ready' | 'error'
  stage: string
  progress: number
  message: string
}

export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8000'

export async function uploadTrack(file: File): Promise<{ trackId: string }> {
  const body = new FormData()
  body.append('file', file)
  const response = await fetch(`${API_BASE}/api/tracks`, {
    method: 'POST',
    body,
  })
  if (!response.ok) {
    throw new Error(await readableError(response))
  }
  return response.json()
}

export async function getTrackStatus(trackId: string): Promise<TrackStatus> {
  const response = await fetch(`${API_BASE}/api/tracks/${trackId}/status`)
  if (!response.ok) {
    throw new Error(await readableError(response))
  }
  return response.json()
}

export async function getTrackMap(trackId: string): Promise<SongMap> {
  const response = await fetch(`${API_BASE}/api/tracks/${trackId}/map`)
  if (!response.ok) {
    throw new Error(await readableError(response))
  }
  return response.json()
}

export function getTrackAudioUrl(trackId: string): string {
  return `${API_BASE}/api/tracks/${trackId}/audio`
}

async function readableError(response: Response): Promise<string> {
  try {
    const data = await response.json()
    return data.detail || response.statusText
  } catch {
    return response.statusText
  }
}
