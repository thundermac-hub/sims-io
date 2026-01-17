"use client"

import * as React from "react"
import { BadgeCheck, Camera } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ProfilePage() {
  const [open, setOpen] = React.useState(false)
  const [showPasswords, setShowPasswords] = React.useState(false)

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm">
          Manage your account details and role.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Name</span>
            <span>Farah A.</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>farah@engage.local</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              <BadgeCheck className="size-3" />
              Merchant Success
            </span>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Update profile</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update profile</DialogTitle>
                <DialogDescription>
                  Change your name, password, or profile photo.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="profile-name">Name</Label>
                  <Input id="profile-name" placeholder="Farah A." />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-current-password">
                    Current password
                  </Label>
                  <div className="relative">
                    <Input
                      id="profile-current-password"
                      type={showPasswords ? "text" : "password"}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords((value) => !value)}
                      className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                    >
                      {showPasswords ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-password">New password</Label>
                  <Input
                    id="profile-password"
                    type={showPasswords ? "text" : "password"}
                    placeholder="••••••••"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-password-confirm">
                    Confirm password
                  </Label>
                  <Input
                    id="profile-password-confirm"
                    type={showPasswords ? "text" : "password"}
                    placeholder="••••••••"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-photo">Profile photo</Label>
                  <div className="flex items-center gap-3">
                    <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
                      <Camera className="size-4" />
                    </div>
                    <Input id="profile-photo" type="file" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setOpen(false)}>Save changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  )
}
