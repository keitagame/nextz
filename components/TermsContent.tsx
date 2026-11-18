import { TERMS, TERMS_UPDATED_AT } from '@/lib/terms';

/** 利用規約の本文（サインアップ時のダイアログと /terms ページで共用） */
export function TermsContent() {
  return (
    <div className="space-y-5 text-sm leading-relaxed">
      <p className="text-xs text-muted-foreground">最終更新日：{TERMS_UPDATED_AT}</p>
      {TERMS.map((sec) => (
        <section key={sec.title} className="space-y-2">
          <h2 className="font-bold text-base">{sec.title}</h2>
          {sec.body?.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {sec.items && (
            <ol className="list-decimal pl-5 space-y-1.5">
              {sec.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
