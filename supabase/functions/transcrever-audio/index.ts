import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchAudioAsBlob(audioUrl: string, contentType = 'audio/ogg'): Promise<Blob> {
  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error(`Erro ao baixar áudio: ${res.status} ${res.statusText}`);
  const arrayBuffer = await res.arrayBuffer();
  const ct = res.headers.get('content-type') || contentType;
  return new Blob([arrayBuffer], { type: ct });
}

function base64ToBlob(base64Data: string, contentType = 'audio/ogg'): Blob {
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

function extFromMime(mime: string): string {
  const m = (mime || '').toLowerCase();
  if (m.includes('webm')) return 'webm';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('wav')) return 'wav';
  return 'webm';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audioUrl, audioBase64, mimeType, language } = await req.json();

    if (!audioUrl && !audioBase64) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros inválidos: forneça audioUrl ou audioBase64', status: 'error' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY ausente', status: 'error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar Blob do áudio com MIME real (default webm — formato típico do MediaRecorder no browser)
    const effectiveMime = (mimeType || 'audio/webm').split(';')[0].trim();
    let audioBlob: Blob;
    if (audioBase64) {
      audioBlob = base64ToBlob(audioBase64, effectiveMime);
    } else {
      audioBlob = await fetchAudioAsBlob(audioUrl, effectiveMime);
    }

    const ext = extFromMime(audioBlob.type || effectiveMime);
    console.log(`[transcrever-audio] mime=${audioBlob.type} ext=${ext} size=${audioBlob.size}`);

    // Montar FormData para Whisper
    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', language || 'pt');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: formData,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da API OpenAI:', errorText);
      return new Response(
        JSON.stringify({ error: 'Falha na transcrição', details: errorText, status: 'error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    const text: string | undefined = result.text;

    return new Response(
      JSON.stringify({ transcription: text, status: text ? 'completed' : 'error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao transcrever áudio:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido', status: 'error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
