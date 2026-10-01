"use client";

import { memo } from "react";
import { Calendar, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge-2";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import type { Task } from "@/lib/tasks-api";

type BadgeProps = Pick<React.ComponentProps<typeof Badge>, "variant" | "appearance">;

export function priorityBadgeProps(priority: string): BadgeProps {
  switch (priority) {
    case "CRITICAL":
      return { variant: "destructive", appearance: "light" };
    case "HIGH":
      return { variant: "warning", appearance: "light" };
    case "MEDIUM":
      return { variant: "info", appearance: "light" };
    case "LOW":
      return { variant: "primary", appearance: "light" };
    default:
      return { variant: "secondary", appearance: "light" };
  }
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const formatDate = (date: string | null | undefined, formatter: Intl.DateTimeFormat) => {
  if (!date) return null;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : formatter.format(parsed);
};

const initials = (person: { firstName?: string | null; lastName?: string | null }) =>
  `${person.firstName?.charAt(0) ?? ""}${person.lastName?.charAt(0) ?? ""}`.toUpperCase() || "?";

export const TaskCard = memo(function TaskCard({
  task,
  columns,
  onOpen,
  onMove,
}: {
  task: Task;
  columns: { id: string; title: string }[];
  onOpen: (task: Task) => void;
  onMove: (taskId: string, status: string) => void;
}) {
  const people = task.taskAssignees?.length
    ? task.taskAssignees.map((ta) => ta.user)
    : task.assignee
      ? [task.assignee]
      : [];
  const start = formatDate(task.startDate, shortDateFormatter);
  const end = formatDate(task.endDate, dateFormatter);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open task ${task.title}`}
      onClick={() => onOpen(task)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(task);
        }
      }}
      className="flex flex-col gap-2 outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="m-0 flex-1 text-sm font-medium leading-tight text-foreground">
            {task.title}
          </p>
          <Badge {...priorityBadgeProps(task.priority)} shape="circle" size="sm" className="w-fit">
            {task.priority}
          </Badge>
        </div>
        {people.length > 0 && (
          <AvatarGroup>
            {people.slice(0, 3).map((person) => (
              <Avatar
                key={person.id}
                size="sm"
                className="h-4 w-4"
                title={`${person.firstName ?? ""} ${person.lastName ?? ""}`.trim()}
              >
                <AvatarFallback className="text-[8px]">{initials(person)}</AvatarFallback>
              </Avatar>
            ))}
            {people.length > 3 && (
              <AvatarGroupCount className="h-4 w-4 text-[8px]">+{people.length - 3}</AvatarGroupCount>
            )}
          </AvatarGroup>
        )}
      </div>

      {task.crId && (
        <Badge variant="info" appearance="light" size="sm" shape="circle" className="w-fit">
          CR{task.phase ? ` / ${task.phase}` : ""}
        </Badge>
      )}

      {task.dailyEffort != null && (
        <span
          className="w-fit rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
          title={task.workingDays ? `Spread across ${task.workingDays} working days` : undefined}
        >
          {task.dailyEffort} h/day
        </span>
      )}

      {(start || end) && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar size={10} />
          <span>{start || "?"} - {end || "?"}</span>
        </div>
      )}

      <div className="mt-1 flex items-center justify-between border-t pt-2">
        <span className="truncate text-[10px] font-semibold text-muted-foreground/70">
          {task.project?.name || "No Project"}
        </span>
        <div className="flex gap-1" onClick={(event) => event.stopPropagation()}>
          {columns
            .filter((column) => column.id !== task.status)
            .map((column) => (
              <button
                key={column.id}
                type="button"
                onClick={() => onMove(task.id, column.id)}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                title={`Move to ${column.title}`}
                aria-label={`Move ${task.title} to ${column.title}`}
              >
                <ChevronRight size={10} />
              </button>
            ))}
        </div>
      </div>
    </div>
  );
},
// Only re-render when the task's own data changes — skips re-renders from parent state changes
// (search typing, combobox open, modal open, etc.)
(prev, next) =>
  prev.task.id === next.task.id &&
  prev.task.updatedAt === next.task.updatedAt &&
  prev.task.status === next.task.status &&
  prev.task.title === next.task.title &&
  prev.task.priority === next.task.priority);
