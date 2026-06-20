import { cn } from '@/lib/utils'
import { avatarColor, initial } from '@/lib/ui/colors'

type Props = {
  name: string
  // People get a coloured circle; agents get a neutral rounded square so the two
  // are instantly distinguishable in the feed and sidebar.
  kind?: 'person' | 'agent'
  size?: 'sm' | 'md'
  // When true, shows a small green "online" dot in the corner.
  status?: boolean
  className?: string
}

const SIZES = {
  sm: 'size-7 text-xs',
  md: 'size-9 text-sm',
}

export function Avatar({
  name,
  kind = 'person',
  size = 'md',
  status = false,
  className,
}: Props) {
  const shape =
    kind === 'agent'
      ? 'rounded-md bg-zinc-700 text-zinc-200'
      : cn('rounded-full text-white', avatarColor(name))

  return (
    <div className={cn('relative shrink-0', className)}>
      <div
        className={cn(
          'flex items-center justify-center font-semibold select-none',
          SIZES[size],
          shape,
        )}
      >
        {initial(name)}
      </div>
      {status && (
        <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
      )}
    </div>
  )
}
