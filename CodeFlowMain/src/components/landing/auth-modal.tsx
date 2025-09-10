"use client"

import { useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { SignInForm } from "@/components/auth/signin-form"
import { SignUpForm } from "@/components/auth/signup-form"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultMode?: "signin" | "signup"
}

export function AuthModal({ isOpen, onClose, defaultMode = "signin" }: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode)

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 animate-in fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-lg p-6 w-full max-w-md animate-in fade-in-0 zoom-in-95 duration-200">
          <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
          </Dialog.Close>
          
          <div className="space-y-6">
            <div className="text-center">
              <Dialog.Title className="text-2xl font-semibold">
                {mode === "signin" ? "Welcome back" : "Create account"}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground mt-2">
                {mode === "signin" 
                  ? "Sign in to your account to continue" 
                  : "Sign up to get started with CodeFlow"
                }
              </Dialog.Description>
            </div>

            {mode === "signin" ? (
              <SignInForm 
                onClose={onClose} 
                onSwitchToSignUp={() => setMode("signup")} 
              />
            ) : (
              <SignUpForm 
                onClose={onClose} 
                onSwitchToSignIn={() => setMode("signin")} 
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}