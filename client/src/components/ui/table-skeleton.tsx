import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 10, columns = 8 }: TableSkeletonProps) {
  return (
    <div className="space-y-3">
      {/* Header skeleton */}
      <div className="flex gap-4 pb-3 border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-6 flex-1" />
        ))}
      </div>

      {/* Rows skeleton */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4 py-3 border-b border-gray-100">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${colIndex}`}
              className={`h-8 ${colIndex === 0 ? 'w-32' : 'flex-1'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface LoadingProgressProps {
  loaded: number;
  total: number;
  message?: string;
}

export function LoadingProgress({ loaded, total, message }: LoadingProgressProps) {
  const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="w-64 space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{message || 'Cargando datos...'}</span>
          <span className="font-medium">{percentage}%</span>
        </div>
        <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-xs text-center text-muted-foreground">
          {loaded} de {total} campañas cargadas
        </p>
      </div>
      <div className="flex gap-2">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
