"use client";

type Props = {
  open: boolean;
  onAllow: () => void;
  onDismiss: () => void;
};

export function MicPermissionSheet({ open, onAllow, onDismiss }: Props) {
  if (!open) return null;
  return (
    <div className="sheet-backdrop" role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mic-title"
      >
        <h2 id="mic-title" className="sheet-title">
          إذن الميكروفون
        </h2>
        <p className="sheet-note">
          نحتاج الميكروفون لتسجيل تلاوتك — لن نحفظ الصوت خارج جهازك.
        </p>
        <button type="button" className="sheet-cta" onClick={onAllow}>
          سماح
        </button>
        <button type="button" className="sheet-dismiss" onClick={onDismiss}>
          ليس الآن
        </button>
      </div>
    </div>
  );
}
