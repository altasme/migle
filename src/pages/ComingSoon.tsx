export function ComingSoon({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-10 text-center">
      <p className="text-4xl">{emoji}</p>
      <h1 className="text-lg font-semibold text-white">{title} is coming soon</h1>
      <p className="text-sm text-zinc-500">This ships in a later build step.</p>
    </div>
  )
}
