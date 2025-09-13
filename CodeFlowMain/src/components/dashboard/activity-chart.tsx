"use client"

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ActivityData = {
  totalEvents: number;
  activeTime: number; // in milliseconds
  eventTypeCounts: Record<string, number>;
  sessionsCount: number;
  timeRange: {
    start: string;
    end: string;
  };
  dailyActivity: Array<{
    date: string;
    events: number;
    activeTime: number;
  }>;
};

export function ActivityChart() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ActivityData | null>(null);
  const [timeRange, setTimeRange] = useState(7); // 7 days by default

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/devtracker/stats?days=${timeRange}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch activity data");
        }
        
        const result = await response.json();
        
        if (result.success && result.stats) {
          setData(result.stats);
        } else {
          throw new Error(result.error || "Invalid data returned");
        }
      } catch (err) {
        console.error("Error fetching activity data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [timeRange]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Development Activity</CardTitle>
          <CardDescription>Loading your activity data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Development Activity</CardTitle>
          <CardDescription className="text-destructive">Error: {error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Development Activity</CardTitle>
          <CardDescription>No activity data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Format active time from milliseconds to readable format
  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Development Activity</CardTitle>
        <CardDescription>
          Your coding activity over the last {timeRange} days
        </CardDescription>
        <div className="flex gap-2 mt-2">
          {[7, 14, 30].map(days => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-3 py-1 text-xs rounded ${
                timeRange === days 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {days} days
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-4 border rounded-lg">
            <div className="text-2xl font-bold text-primary">
              {data.totalEvents.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">Total Events</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-2xl font-bold text-primary">
              {formatTime(data.activeTime)}
            </div>
            <div className="text-sm text-muted-foreground">Active Time</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-2xl font-bold text-primary">
              {data.sessionsCount}
            </div>
            <div className="text-sm text-muted-foreground">Coding Sessions</div>
          </div>
        </div>
        
        <h3 className="mt-8 mb-4 text-lg font-medium">Daily Activity</h3>
        <div className="h-48 w-full">
          {data.dailyActivity.length > 0 ? (
            <div className="flex h-full items-end justify-between gap-1">
              {data.dailyActivity.map((day) => {
                // Calculate height percentage (max 100%)
                const maxEvents = Math.max(...data.dailyActivity.map(d => d.events));
                const heightPercentage = maxEvents > 0 
                  ? Math.max(5, (day.events / maxEvents) * 100)
                  : 5;
                
                return (
                  <div key={day.date} className="flex flex-col items-center flex-1">
                    <div 
                      className="bg-primary/80 rounded-t w-full"
                      style={{ height: `${heightPercentage}%` }}
                      title={`${day.events} events`}
                    />
                    <span className="text-xs mt-1">
                      {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No daily activity data available
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}