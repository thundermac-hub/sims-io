import type { Metadata } from "next"

import { ProjectsView } from "./projects-view"

export const metadata: Metadata = {
  title: "Project Tracker",
}

export default function ProjectsPage() {
  return <ProjectsView />
}
