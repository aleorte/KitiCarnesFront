import { toast } from 'sonner';
import { cn } from '../utils/format';
import { openWhatsApp, toWhatsAppNumber } from '../utils/whatsapp';

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m0 1.67c4.54 0 8.24 3.7 8.24 8.24 0 4.54-3.7 8.24-8.24 8.24-1.4 0-2.77-.35-3.98-1.02l-.28-.17-3.11.82.83-3.04-.18-.3a8.2 8.2 0 0 1-1.28-4.53c0-4.54 3.7-8.24 8.24-8.24m4.52 11.64c-.2.56-1.16 1.07-1.61 1.14-.41.06-.93.11-1.5-.09-.34-.12-.78-.26-1.35-.5-2.38-1.03-3.93-3.43-4.05-3.59-.12-.17-.96-1.28-.96-2.44s.61-1.73.83-1.97c.2-.22.45-.28.6-.28h.43c.14 0 .33-.05.51.39.2.48.67 1.64.73 1.76.06.12.1.26.02.42-.08.17-.13.26-.25.4l-.37.44c-.12.13-.25.27-.10.52.14.26.64 1.05 1.37 1.7.94.84 1.73 1.1 1.98 1.22.25.12.4.1.54-.06.15-.17.64-.75.81-1 .17-.26.35-.22.58-.13.24.08 1.52.72 1.78.85.26.13.43.2.5.31.06.12.06.67-.14 1.23" />
    </svg>
  );
}

type Props = {
  phone?: string | null;
  message?: string;
  label?: string;
  iconOnly?: boolean;
  className?: string;
  missingLabel?: string;
};

export function WhatsAppButton({
  phone,
  message,
  label = 'WhatsApp',
  iconOnly = false,
  className,
  missingLabel = 'Este cliente no tiene un número de teléfono registrado.',
}: Props) {
  const valid = Boolean(toWhatsAppNumber(phone));

  return (
    <button
      type="button"
      title={valid ? 'Contactar por WhatsApp' : missingLabel}
      aria-label="Contactar por WhatsApp"
      disabled={!valid}
      onClick={() => {
        if (!openWhatsApp(phone, message)) {
          toast.error(missingLabel);
        }
      }}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold text-[#128C7E] transition hover:bg-[#25D366]/15 disabled:cursor-not-allowed disabled:opacity-40',
        iconOnly ? 'h-9 w-9 p-0' : 'px-3 py-2',
        className,
      )}
    >
      <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
      {iconOnly ? null : <span>{label}</span>}
    </button>
  );
}
