import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const session = await auth.getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const data = await req.json();
    
    if (!data.events || !Array.isArray(data.events)) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
    }

    // Process and store activity events
    const results = await Promise.all(
      data.events.map(async (event) => {
        try {
          // Check if event already exists to prevent duplicates
          const existing = await prisma.activityEvent.findUnique({
            where: { eventId: event.id }
          });

          if (!existing) {
            await prisma.activityEvent.create({
              data: {
                eventId: event.id,
                timestamp: new Date(event.timestamp),
                type: event.type,
                data: event.data,
                workspaceId: event.workspaceId || null,
                projectName: event.projectName || null,
                sessionId: event.sessionId,
                userId: userId,
              },
            });
            return { id: event.id, status: "created" };
          }
          
          return { id: event.id, status: "exists" };
        } catch (error) {
          console.error("Error processing event:", error);
          return { id: event.id, status: "error", error: String(error) };
        }
      })
    );

    // Process and store sessions
    if (data.sessions && Array.isArray(data.sessions)) {
      await Promise.all(
        data.sessions.map(async (session) => {
          try {
            // Check if session already exists
            const existing = await prisma.activitySession.findUnique({
              where: { sessionId: session.id }
            });

            if (!existing) {
              await prisma.activitySession.create({
                data: {
                  sessionId: session.id,
                  startTime: new Date(session.startTime),
                  endTime: session.endTime ? new Date(session.endTime) : null,
                  workspaceId: session.workspaceId || null,
                  projectName: session.projectName || null,
                  totalEvents: session.totalEvents || 0,
                  activeTime: session.activeTime || 0,
                  userId: userId,
                },
              });
            } else if (session.endTime) {
              // Update existing session with end time and counts
              await prisma.activitySession.update({
                where: { sessionId: session.id },
                data: {
                  endTime: new Date(session.endTime),
                  totalEvents: session.totalEvents || 0,
                  activeTime: session.activeTime || 0,
                  updatedAt: new Date(),
                },
              });
            }
          } catch (error) {
            console.error("Error processing session:", error);
          }
        })
      );
    }

    return NextResponse.json({ 
      success: true, 
      processed: results.length,
      status: results 
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Failed to process activity data" }, 
      { status: 500 }
    );
  }
}