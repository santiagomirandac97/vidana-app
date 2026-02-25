// Placeholder — replaced in Task 5
export function PageHeader({ title }: { title: string; subtitle?: string; action?: React.ReactNode; className?: string }) {
  return <div className="pb-6 border-b border-border mb-6"><h1 className="text-xl font-semibold">{title}</h1></div>;
}
