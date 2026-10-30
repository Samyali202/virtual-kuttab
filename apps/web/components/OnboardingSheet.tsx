"use client";

type Props = {
  open: boolean;
  onDone: () => void;
};

export function OnboardingSheet({ open, onDone }: Props) {
  if (!open) return null;
  return (
    <div className="sheet-backdrop" role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboard-title"
      >
        <h2 id="onboard-title" className="sheet-title">
          كيف يعمل الكتّاب؟
        </h2>
        <ol className="sheet-steps">
          <li>
            <strong>١</strong> استمع للشيخ الحصري المعلّم
          </li>
          <li>
            <strong>٢</strong> كرّر بعده
          </li>
          <li>
            <strong>٣</strong> سجّل من حفظك
          </li>
        </ol>
        <p className="sheet-note">آية بآية — تغذية راجعة على مستوى الكلمة فقط</p>
        <button type="button" className="sheet-cta" onClick={onDone}>
          فهمت، ابدأ
        </button>
      </div>
    </div>
  );
}
