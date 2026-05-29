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

async function transcribeWithOpenAI(audioBlob: Blob, ext: string, language?: string, model = 'gpt-4o-mini-transcribe') {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) throw new Error('OPENAI_API_KEY ausente');

  const formData = new FormData();
  formData.append('file', audioBlob, `audio.${ext}`);
  formData.append('model', model);
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

async function hasAudibleSignal(audioBlob: Blob): Promise<boolean> {
  if (!(audioBlob.type || '').toLowerCase().includes('wav')) return true;

  const buffer = await audioBlob.arrayBuffer();
  if (buffer.byteLength < 44) return false;
  const view = new DataView(buffer);
  const readString = (offset: number, length: number) =>
    Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join('');

  if (readString(0, 4) !== 'RIFF' || readString(8, 4) !== 'WAVE') return true;

  let offset = 12;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= view.byteLength) {
    const chunkId = readString(offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (dataOffset < 0 || dataSize < 2) return false;
  const end = Math.min(dataOffset + dataSize, view.byteLength - 1);
  let sumSquares = 0;
  let count = 0;
  let maxAbs = 0;
  for (let i = dataOffset; i + 1 < end; i += 2) {
    const sample = view.getInt16(i, true);
    const abs = Math.abs(sample);
    maxAbs = Math.max(maxAbs, abs);
    sumSquares += sample * sample;
    count++;
  }

  const rms = count ? Math.sqrt(sumSquares / count) : 0;
  return maxAbs > 700 && rms > 120;
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

    if (!(await hasAudibleSignal(audioBlob))) {
      return new Response(
        JSON.stringify({ error: 'Não foi possível identificar fala clara no áudio', status: 'error' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: { text?: string } = { text: undefined };
    let openAiFailed = false;

    try {
      result = await transcribeWithOpenAI(audioBlob, ext, language).catch(async (error) => {
        const msg = String(error?.message || error);
        if (msg.includes('insufficient_quota') || msg.includes('429')) throw error;
        console.warn(`[transcrever-audio] gpt-4o-mini-transcribe falhou, tentando whisper-1: ${msg}`);
        return await transcribeWithOpenAI(audioBlob, ext, language, 'whisper-1');
      });
    } catch (error) {
      openAiFailed = true;
      console.warn(`[transcrever-audio] OpenAI indisponível, usando fallback Lovable AI: ${(error as Error)?.message || error}`);
    }
    let text: string | undefined = result.text;

    if (isInvalidTranscription(text, durationSeconds) && !openAiFailed) {
      console.warn(`[transcrever-audio] resultado inválido (${JSON.stringify(text)}), tentando gpt-4o-transcribe`);
      result = await transcribeWithOpenAI(audioBlob, ext, language, 'gpt-4o-transcribe').catch((error) => {
        console.warn(`[transcrever-audio] gpt-4o-transcribe falhou: ${error?.message || error}`);
        openAiFailed = true;
        return { text: undefined };
      });
      text = result.text;
    }

    if (isInvalidTranscription(text, durationSeconds) || openAiFailed) {
      try {
        const fallback = await transcribeWithLovableAI(audioBlob, language);
        if (fallback.text) text = fallback.text;
      } catch (fallbackError) {
        console.error(`[transcrever-audio] Fallback Lovable AI falhou: ${(fallbackError as Error)?.message || fallbackError}`);
      }
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
