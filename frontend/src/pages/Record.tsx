import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui'

export default function Record() {
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const { user } = useAuth()

  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [saving, setSaving] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Set up audio analyser for waveform
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)

      // Start timer
      timerRef.current = window.setInterval(() => {
        setDuration(d => d + 1)
      }, 1000)

      // Start waveform animation
      drawWaveform()
    } catch (err) {
      console.error('Failed to start recording:', err)
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)

      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }

  // Draw waveform
  const drawWaveform = () => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      if (!isRecording) return

      animationRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)

      ctx.fillStyle = 'rgba(15, 20, 25, 0.3)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const barWidth = (canvas.width / bufferLength) * 2.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8

        // Gradient from teal to cyan
        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height)
        gradient.addColorStop(0, '#14b8a6')
        gradient.addColorStop(1, '#06b6d4')

        ctx.fillStyle = gradient
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)
        x += barWidth + 1
      }
    }

    draw()
  }

  // Cancel recording
  const handleCancel = () => {
    stopRecording()
    navigate('/')
  }

  // Save recording
  const handleSave = async () => {
    if (!audioBlob || !workspace || !user) return

    setSaving(true)
    try {
      // Upload audio to Supabase Storage
      const filename = `${workspace.id}/${user.id}/${Date.now()}.webm`
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(filename, audioBlob)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('audio')
        .getPublicUrl(filename)

      // Create note
      const { data: note, error: noteError } = await supabase
        .from('notes')
        .insert({
          workspace_id: workspace.id,
          created_by: user.id,
          title: `Note - ${new Date().toLocaleDateString()}`,
          audio_url: publicUrl,
          duration: duration,
          embedding_status: 'pending',
        })
        .select()
        .single()

      if (noteError) throw noteError

      navigate(`/notes/${note.id}`)
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Start recording on mount
  useEffect(() => {
    startRecording()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-base-dark/95 backdrop-blur-xl flex flex-col items-center justify-center px-6">
      {/* Duration */}
      <div className="text-5xl font-mono font-bold text-white mb-8">
        {formatDuration(duration)}
      </div>

      {/* Waveform */}
      <canvas
        ref={canvasRef}
        width={320}
        height={120}
        className="rounded-xl mb-8"
      />

      {/* Transcript preview */}
      {transcript && (
        <div className="glass p-4 max-w-md w-full mb-8 max-h-32 overflow-y-auto">
          <p className="text-slate-300 text-sm">{transcript}</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-6">
        <Button variant="ghost" onClick={handleCancel} className="w-14 h-14 rounded-full">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>

        {isRecording ? (
          <button
            onClick={stopRecording}
            className="w-20 h-20 rounded-full bg-rose-500 flex items-center justify-center shadow-[0_0_30px_rgba(244,63,94,0.5)] hover:scale-105 active:scale-95 transition-transform"
          >
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <Button onClick={handleSave} loading={saving} className="px-8">
            Save
          </Button>
        )}

        {!isRecording && audioBlob && (
          <Button variant="ghost" onClick={startRecording} className="w-14 h-14 rounded-full">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </Button>
        )}
      </div>
    </div>
  )
}
