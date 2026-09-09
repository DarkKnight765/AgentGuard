export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge-${status} px-2.5 py-0.5 rounded-full text-xs font-medium inline-block`}>
      {status}
    </span>
  );
}
