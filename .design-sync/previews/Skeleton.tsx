import { Skeleton } from "sims"

export const Shapes = () => (
  <div className="flex flex-col gap-3">
    <Skeleton className="h-4 w-[260px]" />
    <Skeleton className="h-4 w-[200px]" />
    <Skeleton className="h-9 w-[120px] rounded-md" />
    <Skeleton className="size-10 rounded-full" />
  </div>
)

export const TicketRowLoading = () => (
  <div className="flex w-full max-w-[420px] flex-col gap-4">
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-[70%]" />
          <Skeleton className="h-3 w-[40%]" />
        </div>
      </div>
    ))}
  </div>
)
