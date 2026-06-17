type PlaceholderPageProps = {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
      <p className="mt-3 max-w-md text-slate-400">{description}</p>
      <p className="mt-6 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-2 text-sm text-primary">
        Bu sayfa yakında eklenecek.
      </p>
    </div>
  )
}
