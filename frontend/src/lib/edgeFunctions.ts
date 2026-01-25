import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

interface TranscriptionResult {
  transcript: string
}

interface EmbeddingResult {
  embedding: number[]
}

interface ImageResult {
  imageBase64: string
}

/**
 * Call Supabase Edge Function for audio transcription
 */
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string = 'audio/webm'
): Promise<TranscriptionResult> {
  const { data, error } = await supabase.functions.invoke('transcribe', {
    body: { audioBase64, mimeType },
  })

  if (error) throw error
  return data as TranscriptionResult
}

/**
 * Call Supabase Edge Function for text embedding generation
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const { data, error } = await supabase.functions.invoke('generate-embedding', {
    body: { text },
  })

  if (error) throw error
  return data as EmbeddingResult
}

/**
 * Call Supabase Edge Function for image generation
 */
export async function generateImage(prompt: string): Promise<ImageResult> {
  const { data, error } = await supabase.functions.invoke('generate-image', {
    body: { prompt },
  })

  if (error) throw error
  return data as ImageResult
}

/**
 * Process a note: transcribe audio, generate embedding, generate image
 * Updates note in database as processing progresses
 */
export async function processNote(noteId: string, audioBlob: Blob): Promise<void> {
  try {
    // Convert blob to base64
    const audioBase64 = await blobToBase64(audioBlob)

    // Update status to processing
    await supabase
      .from('notes')
      .update({ embedding_status: 'processing' })
      .eq('id', noteId)

    // Step 1: Transcribe audio
    const { transcript } = await transcribeAudio(audioBase64, audioBlob.type)

    // Update note with transcript
    await supabase
      .from('notes')
      .update({
        transcript,
        title: generateTitle(transcript),
      })
      .eq('id', noteId)

    // Step 2: Generate embedding (in background, don't block)
    generateEmbedding(transcript)
      .then(async ({ embedding }) => {
        // Store embedding as array
        await supabase
          .from('notes')
          .update({
            embedding,
            embedding_status: 'completed',
          })
          .eq('id', noteId)
      })
      .catch((err) => {
        console.error('Embedding generation failed:', err)
        supabase
          .from('notes')
          .update({ embedding_status: 'failed' })
          .eq('id', noteId)
      })

    // Step 3: Generate image (in background, don't block)
    generateImage(transcript.substring(0, 500))
      .then(async ({ imageBase64 }) => {
        // Upload image to storage
        const filename = `images/${noteId}-${Date.now()}.png`
        const imageBuffer = base64ToUint8Array(imageBase64)

        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(filename, imageBuffer, { contentType: 'image/png' })

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(filename)

          await supabase
            .from('notes')
            .update({ image_url: publicUrl })
            .eq('id', noteId)
        }
      })
      .catch((err) => {
        console.error('Image generation failed:', err)
        // Image generation failure is non-critical, don't update status
      })

  } catch (error) {
    console.error('Note processing failed:', error)
    await supabase
      .from('notes')
      .update({ embedding_status: 'failed' })
      .eq('id', noteId)
    throw error
  }
}

/**
 * Convert Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * Generate a title from transcript
 */
function generateTitle(transcript: string): string {
  // Take first sentence or first 50 chars
  const firstSentence = transcript.split(/[.!?]/)[0]
  if (firstSentence.length <= 50) {
    return firstSentence.trim()
  }
  return transcript.substring(0, 47).trim() + '...'
}
