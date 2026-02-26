import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Home",
}

export default async function Home() {
  const store = await cookies()
  const authCookie = store.get("sims-auth")
  if (authCookie?.value) {
    redirect("/overview")
  }
  redirect("/login")
}
