type LeadButtonProps = {
  label: string;
  onClick: () => void;
};

function LeadButton({ label, onClick }: LeadButtonProps) {
  return (
    <button onClick={onClick} style={{ padding: "8px 16px", borderRadius: "6px" }}>
      {label}
    </button>
  );
}

export default LeadButton;