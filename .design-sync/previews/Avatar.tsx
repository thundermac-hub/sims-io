import { Avatar, AvatarImage, AvatarFallback } from "sims"

export const Fallbacks = () => (
  <div className="flex items-center gap-3">
    <Avatar>
      <AvatarFallback>NA</AvatarFallback>
    </Avatar>
    <Avatar>
      <AvatarFallback>WJ</AvatarFallback>
    </Avatar>
    <Avatar>
      <AvatarFallback>HH</AvatarFallback>
    </Avatar>
  </div>
)

export const Sizes = () => (
  <div className="flex items-center gap-3">
    <Avatar className="size-6">
      <AvatarFallback className="text-[10px]">SM</AvatarFallback>
    </Avatar>
    <Avatar className="size-8">
      <AvatarFallback className="text-xs">MD</AvatarFallback>
    </Avatar>
    <Avatar className="size-12">
      <AvatarFallback>LG</AvatarFallback>
    </Avatar>
  </div>
)

export const WithImage = () => (
  <Avatar>
    <AvatarImage
      src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MCA0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZTIzYjNiIi8+PGNpcmNsZSBjeD0iMjAiIGN5PSIxNSIgcj0iNiIgZmlsbD0iI2ZmZiIvPjxwYXRoIGQ9Ik04IDQwYzAtNyA1LTEyIDEyLTEyczEyIDUgMTIgMTJ6IiBmaWxsPSIjZmZmIi8+PC9zdmc+"
      alt="Agent avatar"
    />
    <AvatarFallback>AG</AvatarFallback>
  </Avatar>
)

export const Stack = () => (
  <div className="flex -space-x-2">
    {["NA", "WJ", "HH", "+4"].map((t) => (
      <Avatar key={t} className="ring-background ring-2">
        <AvatarFallback className="text-xs">{t}</AvatarFallback>
      </Avatar>
    ))}
  </div>
)
