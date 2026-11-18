import { redirect } from 'next/navigation';

/** 旧 URL。ホームがタイムラインになったのでホームへ */
export default function TimelineRedirect() {
  redirect('/');
}
