import { useState, useCallback, useEffect } from "react";
import { Trash2, Download, Save, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import TripForm from "@/components/trip/TripForm";
import Itinerary from "@/components/trip/Itinerary";
import VoiceRecorder from "@/components/trip/VoiceRecorder";
import * as api from "@/lib/api";
import { saveWithTTL, loadWithTTL, clearKeys, KEYS } from "@/lib/persist";
import type { TripPlan, TripFormInputs, TripPrefs } from "@/lib/types";

export default function Index() {
  const { toast } = useToast();
  const [trip, setTrip] = useState<TripPlan | null>(null);
  const [prefs, setPrefs] = useState<TripPrefs>({ likedBlockIds: [] });
  const [savedInputs, setSavedInputs] = useState<TripFormInputs | null>(null);
  const [hasSaved, setHasSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  // Hydrate on mount
  useEffect(() => {
    const t = loadWithTTL<TripPlan>(KEYS.TRIP_PLAN);
    const p = loadWithTTL<TripPrefs>(KEYS.PREFS);
    const i = loadWithTTL<TripFormInputs>(KEYS.INPUTS);
    if (t) { setTrip(t); setHasSaved(true); }
    if (p) setPrefs(p);
    if (i) setSavedInputs(i);
  }, []);

  const persistTrip = useCallback((plan: TripPlan) => {
    setTrip(plan);
    saveWithTTL(KEYS.TRIP_PLAN, plan);
    setHasSaved(true);
  }, []);

  const persistPrefs = useCallback((p: TripPrefs) => {
    setPrefs(p);
    saveWithTTL(KEYS.PREFS, p);
  }, []);

  // Form submit
  const handleCreate = async (inputs: TripFormInputs) => {
    setLoading(true);
    try {
      const plan = await api.createTrip(inputs);
      persistTrip(plan);
      saveWithTTL(KEYS.INPUTS, inputs);
      setSavedInputs(inputs);
      toast({ title: "Trip generated!", description: `${plan.days.length} days planned.` });
    } catch (err: any) {
      toast({ title: "Error creating trip", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Like toggle
  const toggleLike = useCallback(
    (blockId: string) => {
      const liked = prefs.likedBlockIds.includes(blockId);
      const next: TripPrefs = {
        likedBlockIds: liked
          ? prefs.likedBlockIds.filter((id) => id !== blockId)
          : [...prefs.likedBlockIds, blockId],
      };
      persistPrefs(next);
    },
    [prefs, persistPrefs]
  );

  // Skip
  const handleSkip = async (blockId: string) => {
    if (!trip) return;
    // optimistic
    const optimistic = {
      ...trip,
      days: trip.days.map((d) => ({
        ...d,
        blocks: d.blocks.map((b) =>
          b.block_id === blockId ? { ...b, status: "skipped" as const } : b
        ),
      })),
    };
    setTrip(optimistic);
    try {
      const updated = await api.skipBlock(trip.trip_id, blockId);
      persistTrip(updated);
    } catch (err: any) {
      setTrip(trip); // revert
      toast({ title: "Skip failed", description: err.message, variant: "destructive" });
    }
  };

  // Change
  const handleChange = async (blockId: string, text: string, direction?: string) => {
    if (!trip) return;
    try {
      const updated = await api.changeBlock(trip.trip_id, blockId, {
        preference_text: text,
        direction: direction as any,
      });
      persistTrip(updated);
      toast({ title: "Block updated" });
    } catch (err: any) {
      toast({ title: "Change failed", description: err.message, variant: "destructive" });
    }
  };

  // Voice
  const handleVoice = async (blob: Blob) => {
    if (!trip) return;
    try {
      const res = await api.voiceIntent(trip.trip_id, blob);
      persistTrip(res.trip);
      return res;
    } catch (err: any) {
      toast({ title: "Voice command failed", description: err.message, variant: "destructive" });
      return null;
    }
  };

  // Delete saved
  const handleDelete = () => {
    clearKeys([KEYS.TRIP_PLAN, KEYS.PREFS, KEYS.INPUTS]);
    setTrip(null);
    setPrefs({ likedBlockIds: [] });
    setSavedInputs(null);
    setHasSaved(false);
    toast({ title: "Saved trip deleted" });
  };

  // Export calendar
  const handleExport = async () => {
    if (!trip) return;
    try {
      const blob = await api.downloadCalendar(trip.trip_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trip-${trip.trip_id}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-3xl mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight">Rally</h1>
          </div>
          <div className="flex items-center gap-2">
            {hasSaved && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Save className="h-3 w-3" />
                Saved locally
              </Badge>
            )}
            {trip && (
              <>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Calendar
                </Button>
                <Button variant="outline" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Form */}
        {!trip && (
          <TripForm
            initialInputs={savedInputs}
            onSubmit={handleCreate}
            loading={loading}
          />
        )}

        {/* Voice */}
        {trip && (
          <VoiceRecorder
            tripId={trip.trip_id}
            onResult={() => {}}
            onAudioReady={async (blob) => {
              const res = await handleVoice(blob);
              // VoiceRecorder handles its own display via the returned result
            }}
          />
        )}

        {/* Itinerary */}
        {trip && (
          <Itinerary
            trip={trip}
            prefs={prefs}
            onToggleLike={toggleLike}
            onSkip={handleSkip}
            onChange={handleChange}
          />
        )}

        {/* Show form again when trip exists */}
        {trip && (
          <div className="pt-4 border-t border-border/60">
            <p className="text-sm text-muted-foreground mb-4">
              Want a different trip? Delete the current one or plan a new one below.
            </p>
            <TripForm
              initialInputs={savedInputs}
              onSubmit={handleCreate}
              loading={loading}
            />
          </div>
        )}
      </main>
    </div>
  );
}
