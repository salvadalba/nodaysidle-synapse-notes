import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt } = await req.json()

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a visual prompt from the transcript
    const visualPrompt = `Abstract digital art visualization of: ${prompt.substring(0, 200)}. Minimalist, geometric shapes, gradient colors, no text, no people, dreamy atmosphere`

    // Use Pollinations.ai - free image generation API (no key required)
    const encodedPrompt = encodeURIComponent(visualPrompt)
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`

    // Fetch the image
    const response = await fetch(imageUrl)

    if (!response.ok) {
      console.error('Pollinations API error:', response.status)
      return new Response(
        JSON.stringify({ error: 'Image generation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convert image to base64
    const imageBuffer = await response.arrayBuffer()
    const imageBase64 = btoa(
      new Uint8Array(imageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    )

    return new Response(
      JSON.stringify({ imageBase64 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Image generation error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
