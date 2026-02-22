import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import BlockCard from "./BlockCard";
import type { TripPlan, TripPrefs } from "@/lib/types";

interface ItineraryProps {
  trip: TripPlan;
  prefs: TripPrefs;
  onToggleLike: (blockId: string) => void;
  onSkip: (blockId: string) => Promise<void>;
  onChange: (blockId: string, text: string, direction?: string) => Promise<void>;
}

export default function Itinerary({
  trip,
  prefs,
  onToggleLike,
  onSkip,
  onChange,
}: ItineraryProps) {
  const [likedOnly, setLikedOnly] = useState(false);

  const days = trip.days ?? [];
  const defaultOpen = days.map((_, i) => `day-${i}`);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {trip.trip_id}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {trip.timezone}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="liked-only"
            checked={likedOnly}
            onCheckedChange={setLikedOnly}
          />
          <Label htmlFor="liked-only" className="text-sm">
            Liked only
          </Label>
        </div>
      </div>

      {/* Days */}
      <Accordion type="multiple" defaultValue={defaultOpen}>
        {days.map((day, i) => {
          const blocks = likedOnly
            ? day.blocks.filter((b) => prefs.likedBlockIds.includes(b.block_id))
            : day.blocks;

          return (
            <AccordionItem value={`day-${i}`} key={day.date}>
              <AccordionTrigger className="text-sm font-medium">
                <span className="flex items-center gap-2">
                  Day {i + 1}
                  <span className="text-muted-foreground font-normal">
                    — {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {blocks.length} blocks
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-2">
                  {blocks.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {likedOnly ? "No liked blocks this day" : "No blocks"}
                    </p>
                  ) : (
                    blocks.map((block) => (
                      <BlockCard
                        key={block.block_id}
                        block={block}
                        timezone={trip.timezone}
                        liked={prefs.likedBlockIds.includes(block.block_id)}
                        onToggleLike={onToggleLike}
                        onSkip={onSkip}
                        onChange={onChange}
                      />
                    ))
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
