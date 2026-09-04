export default function StateMessage({ title, message }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {message && <span>{message}</span>}
    </div>
  );
}
