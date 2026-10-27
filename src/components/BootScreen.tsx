import { ErrorBanner } from "./ui";

export function BootScreen({
  message,
  error,
}: {
  message: string;
  error?: string | null;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-xs font-bold text-white">MK</div>
      <p className="mt-4 text-lg font-semibold text-gray-900">Makhzan</p>
      {!error ? (
        <>
          <span className="mt-6 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-black" />
          <p className="mt-3 text-sm text-slate-500">{message}</p>
        </>
      ) : (
        <div className="mt-6 w-full max-w-md">
          <ErrorBanner>
            <p className="font-medium">{message}</p>
            <p className="mt-1">{error}</p>
          </ErrorBanner>
        </div>
      )}
    </div>
  );
}
