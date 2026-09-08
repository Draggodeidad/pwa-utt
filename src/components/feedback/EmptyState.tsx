type EmptyStateProps = {
  title: string;
  description?: string;
};

/** Generic empty-result state with no domain-specific behaviour. */
export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div role="status">
      <p>{title}</p>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
