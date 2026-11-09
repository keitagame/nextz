import { Mail } from 'lucide-react';

export const metadata = { title: 'メッセージ' };

export default function MessagesIndex() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        <Mail className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-bold">メッセージを選択</h2>
      <p className="text-sm text-muted-foreground max-w-xs">既存の会話を選ぶか、新しいメッセージを開始しましょう。</p>
    </div>
  );
}
