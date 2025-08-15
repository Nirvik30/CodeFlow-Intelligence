import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"
import { NextRequest, NextResponse } from "next/server"

// Create the handler once, outside the request functions
const authHandler = toNextJsHandler(auth)

// Define handler functions that accept a request parameter
export async function GET(req: NextRequest) {
  try {
    return await authHandler.GET(req)
  } catch (error) {
    console.error("Auth handler error:", error)
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Authentication error", details: errorMessage },
      { status: 500 }
    )
  }
}

export const POST = GET  // Reuse the same handler function
export const PUT = GET
export const PATCH = GET
export const DELETE = GET