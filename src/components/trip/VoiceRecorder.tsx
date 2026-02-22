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

export default function VoiceRecorder({ tripId, onResult, onAudioReady }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    transcript: string;
    agent_message: string;
    decision: { action: string };
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setProcessing(true);
        try {
          await onAudioReady(blob);
        } finally {
          setProcessing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setResult(null);
    } catch (err) {
      console.error("Mic access denied", err);
    }
  }, [onAudioReady]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

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

// Export a way to set result from parent
export type VoiceRecorderHandle = {
  setResult: (r: { transcript: string; agent_message: string; decision: { action: string } }) => void;
};
