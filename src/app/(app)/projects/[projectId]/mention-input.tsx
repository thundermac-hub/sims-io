"use client"

import * as React from "react"

import { Textarea } from "@/components/ui/textarea"

import type { ProjectMember } from "../types"

type MentionInputProps = {
  value: string
  onChange: (value: string) => void
  members: ProjectMember[]
  placeholder?: string
  disabled?: boolean
  rows?: number
}

type Trigger = {
  /** Index of the "@" that opened the picker. */
  start: number
  query: string
}

/**
 * Comment composer with an @mention picker.
 *
 * The candidate list is exactly the project's members: someone without project
 * access must not appear here and cannot be tagged (PRD §4.4). The server
 * re-validates, so this is a usability layer, not the boundary.
 *
 * A selected mention is written into the text as the canonical
 * `@[Display Name](userId)` marker that `parseMentions` understands.
 */
export function MentionInput({
  value,
  onChange,
  members,
  placeholder,
  disabled = false,
  rows = 3,
}: MentionInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [trigger, setTrigger] = React.useState<Trigger | null>(null)
  const [highlighted, setHighlighted] = React.useState(0)

  const matches = React.useMemo(() => {
    if (!trigger) {
      return []
    }
    const query = trigger.query.toLowerCase()
    return members
      .filter((member) => {
        if (!query) {
          return true
        }
        return (
          (member.userName ?? "").toLowerCase().includes(query) ||
          (member.userEmail ?? "").toLowerCase().includes(query)
        )
      })
      .slice(0, 6)
  }, [members, trigger])

  // Reset the highlight whenever the candidate set changes, so Enter never picks
  // a stale row.
  React.useEffect(() => {
    setHighlighted(0)
  }, [trigger?.query])

  const detectTrigger = (text: string, caret: number) => {
    // Walk back from the caret to the nearest "@". Any whitespace in between
    // means the user is no longer writing a mention.
    for (let index = caret - 1; index >= 0; index -= 1) {
      const char = text[index]
      if (char === "@") {
        const preceding = index > 0 ? text[index - 1] : " "
        // Only treat "@" as a trigger at a word boundary, so emails don't fire it.
        if (!/\s|^$/.test(preceding) && index !== 0) {
          setTrigger(null)
          return
        }
        setTrigger({ start: index, query: text.slice(index + 1, caret) })
        return
      }
      if (/\s/.test(char) || char === "]" || char === ")") {
        break
      }
      if (caret - index > 40) {
        break
      }
    }
    setTrigger(null)
  }

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value
    onChange(next)
    detectTrigger(next, event.target.selectionStart ?? next.length)
  }

  const insertMention = (member: ProjectMember) => {
    if (!trigger) {
      return
    }
    const displayName = member.userName ?? member.userEmail ?? member.userId
    const marker = `@[${displayName}](${member.userId})`
    const caret = textareaRef.current?.selectionStart ?? value.length
    const next = `${value.slice(0, trigger.start)}${marker} ${value.slice(caret)}`
    onChange(next)
    setTrigger(null)

    // Put the caret just after the inserted marker.
    const nextCaret = trigger.start + marker.length + 1
    requestAnimationFrame(() => {
      const node = textareaRef.current
      if (node) {
        node.focus()
        node.setSelectionRange(nextCaret, nextCaret)
      }
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!trigger || matches.length === 0) {
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setHighlighted((current) => (current + 1) % matches.length)
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setHighlighted(
        (current) => (current - 1 + matches.length) % matches.length
      )
      return
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault()
      insertMention(matches[highlighted])
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      setTrigger(null)
    }
  }

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTrigger(null)}
      />
      {trigger && matches.length > 0 ? (
        <ul
          role="listbox"
          aria-label="Mention a project member"
          className="bg-popover text-popover-foreground absolute bottom-full z-50 mb-1 w-full max-w-sm overflow-hidden rounded-md border shadow-md"
        >
          {matches.map((member, index) => (
            <li key={member.userId}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlighted}
                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm ${
                  index === highlighted ? "bg-accent" : ""
                }`}
                // The picker closes on blur, so commit on mousedown instead.
                onMouseDown={(event) => {
                  event.preventDefault()
                  insertMention(member)
                }}
                onMouseEnter={() => setHighlighted(index)}
              >
                <span className="font-medium">
                  {member.userName ?? member.userId}
                </span>
                <span className="text-muted-foreground text-xs">
                  {member.userEmail} · {member.role}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
