import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const session = await auth.getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    
    // Get query params
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get("days") || "7");
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get activity data
    const events = await prisma.activityEvent.findMany({
      where: {
        userId: userId,
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    // Get sessions
    const sessions = await prisma.activitySession.findMany({
      where: {
        userId: userId,
        startTime: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    // Calculate basic stats
    const totalEvents = events.length;
    const activeTime = sessions.reduce((sum, session) => 
      sum + (session.activeTime || 0), 0);
    
    // Count event types
    const eventTypeCounts: Record<string, number> = {};
    events.forEach(event => {
      if (!eventTypeCounts[event.type]) {
        eventTypeCounts[event.type] = 0;
      }
      eventTypeCounts[event.type]++;
    });

    // Format data for response
    const stats = {
      totalEvents,
      activeTime,
      eventTypeCounts,
      sessionsCount: sessions.length,
      timeRange: {
        start: startDate,
        end: endDate
      },
      dailyActivity: calculateDailyActivity(events, startDate, endDate)
    };

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity stats" }, 
      { status: 500 }
    );
  }
}

// Helper function to calculate daily activity
function calculateDailyActivity(events: any[], startDate: Date, endDate: Date) {
  const dailyMap = new Map<string, { date: string, events: number, activeTime: number }>();
  
  // Initialize all days in the range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    dailyMap.set(dateStr, { date: dateStr, events: 0, activeTime: 0 });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Count events per day
  events.forEach(event => {
    const dateStr = new Date(event.timestamp).toISOString().split('T')[0];
    const day = dailyMap.get(dateStr);
    if (day) {
      day.events++;
    }
  });
  
  return Array.from(dailyMap.values());
}