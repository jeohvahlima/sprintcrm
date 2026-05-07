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

function isInvalidTranscription(text: unknown, durationSeconds?: number): boolean {
  if (typeof text !== 'string') return true;
  const normalized = text.trim().toLowerCase().replace(/[.!?…\s]+/g, ' ');
  if (!normalized) return true;
  const knownNoise = new Set(['you', 'thank you', 'thanks', 'legendas pela comunidade amara org']);
  return knownNoise.has(normalized) && (durationSeconds === undefined || durationSeconds >= 2);
}

async function transcribeWithOpenAI(audioBlob: Blob, ext: string, language?: string) {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) throw new Error('OPENAI_API_KEY ausente');

  const formData = new FormData();
  formData.append('file', audioBlob, `audio.${ext}`);
  formData.append('model', 'gpt-4o-mini-transcribe');
  formData.append('language', language || 'pt');
  formData.append('response_format', 'json');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openaiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha na transcrição OpenAI: ${response.status} ${errorText}`);
  }

  return await response.json();
}

async function transcribeWithLovableAI(audioBlob: Blob, language?: string) {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY ausente');

  const arrayBuffer = await audioBlob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `Transcreva o áudio enviado para ${language || 'pt-BR'}. Responda somente com o texto falado, sem comentários.`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Transcreva este áudio exatamente como foi falado.' },
            { type: 'input_audio', input_audio: { data: btoa(binary), format: 'wav' } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha na transcrição Lovable AI: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return { text: result.choices?.[0]?.message?.content };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audioUrl, audioBase64, mimeType, language, durationSeconds } = await req.json();

    if (!audioUrl && !audioBase64) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros inválidos: forneça audioUrl ou audioBase64', status: 'error' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    let result = await transcribeWithOpenAI(audioBlob, ext, language);
    let text: string | undefined = result.text;

    if (isInvalidTranscription(text, durationSeconds)) {
      console.warn(`[transcrever-audio] resultado inválido recebido (${JSON.stringify(text)}), tentando fallback Lovable AI`);
      result = await transcribeWithLovableAI(audioBlob, language);
      text = result.text;
    }

    if (isInvalidTranscription(text, durationSeconds)) {
      return new Response(
        JSON.stringify({ error: 'Não foi possível identificar fala clara no áudio', status: 'error' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ transcription: text?.trim(), text: text?.trim(), status: text ? 'completed' : 'error' }),
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
