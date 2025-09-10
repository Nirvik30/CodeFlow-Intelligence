"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Code, Zap, Users, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AuthModal } from "@/components/landing/auth-modal"

export function HeroSection() {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup")

  const openAuthModal = (mode: "signin" | "signup") => {
    setAuthMode(mode)
    setAuthModalOpen(true)
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        {/* Header */}
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-2"
            >
              <Code className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">CodeFlow</span>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-4"
            >
              <Button 
                variant="ghost" 
                onClick={() => openAuthModal("signin")}
              >
                Sign In
              </Button>
              <Button onClick={() => openAuthModal("signup")}>
                Get Started
              </Button>
            </motion.div>
          </div>
        </header>

        {/* Hero Content */}
        <main className="container mx-auto px-4 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent"
            >
              Code Smarter,
              <br />
              Ship Faster
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed"
            >
              The ultimate development platform that streamlines your workflow, 
              enhances collaboration, and accelerates your coding journey.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
            >
              <Button 
                size="lg" 
                onClick={() => openAuthModal("signup")}
                className="text-lg px-8 py-3 h-auto"
              >
                Start Building
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => openAuthModal("signin")}
                className="text-lg px-8 py-3 h-auto"
              >
                Sign In
              </Button>
            </motion.div>

            {/* Features Grid */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto"
            >
              {[
                {
                  icon: <Code className="h-12 w-12 text-primary" />,
                  title: "Smart Development",
                  description: "AI-powered code suggestions and intelligent debugging tools"
                },
                {
                  icon: <Zap className="h-12 w-12 text-primary" />,
                  title: "Lightning Fast",
                  description: "Optimized performance with instant deployments and real-time sync"
                },
                {
                  icon: <Users className="h-12 w-12 text-primary" />,
                  title: "Team Collaboration",
                  description: "Seamless collaboration tools for distributed development teams"
                }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="bg-card border rounded-xl p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex flex-col items-center text-center space-y-4">
                    {feature.icon}
                    <h3 className="text-xl font-semibold">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </main>
      </div>

      <AuthModal 
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authMode}
      />
    </>
  )
}