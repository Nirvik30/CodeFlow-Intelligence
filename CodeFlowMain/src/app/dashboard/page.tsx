import { ActivityChart } from "@/components/dashboard/activity-chart";
import { Toaster } from "@/components/ui/toaster";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 mx-auto">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        
        <div className="grid gap-6">
          <ActivityChart />
        </div>
      </div>
      <Toaster />
    </div>
  )
}