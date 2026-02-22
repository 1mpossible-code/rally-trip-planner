import { useState, useRef, useCallback } from "react";
import { Mic, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VoiceRecorderProps {
  tripId: string;
  onResult: (response: {
    transcript: string;
    agent_message: string;
    decision: { action: string; block_id?: string; direction?: string; preference_text?: string };
  }) => void;
  onAudioReady: (blob: Blob) => Promise<void>;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export default function VoiceRecorder({ tripId, onResult, onAudioReady }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    transcript: string;
    agent_message: string;
    decision: { action: string };
  } | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      chunksRef.current = [];

      processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(data));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      setRecording(true);
      setResult(null);
    } catch (err) {
      console.error("Mic access denied", err);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    setRecording(false);

    // Disconnect audio nodes
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());

    const sampleRate = audioCtxRef.current?.sampleRate ?? 16000;
    audioCtxRef.current?.close();

    // Merge chunks into single buffer
    const totalLength = chunksRef.current.reduce((acc, c) => acc + c.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunksRef.current) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    if (merged.length === 0) return;

    const wavBlob = encodeWav(merged, sampleRate);
    setProcessing(true);
    try {
      await onAudioReady(wavBlob);
    } finally {
      setProcessing(false);
    }
  }, [onAudioReady]);

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mic className="h-5 w-5 text-primary" />
          Voice Command
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <button
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerCancel={stopRecording}
            disabled={processing}
            className={`
              w-20 h-20 rounded-full flex items-center justify-center 
              transition-all select-none touch-none
              ${
                recording
                  ? "bg-destructive text-destructive-foreground scale-110 animate-pulse-record"
                  : processing
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:opacity-90 active:scale-95"
              }
            `}
          >
            {processing ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {recording
            ? "Recording… release to send"
            : processing
            ? "Processing…"
            : "Hold to talk"}
        </p>

        {result && (
          <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
            <div>
              <span className="font-medium">You said:</span>{" "}
              <span className="text-muted-foreground">{result.transcript}</span>
            </div>
            <div>
              <span className="font-medium">Agent:</span> {result.agent_message}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Action:</span>
              <Badge variant="secondary">{result.decision.action}</Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export type VoiceRecorderHandle = {
  setResult: (r: { transcript: string; agent_message: string; decision: { action: string } }) => void;
};
