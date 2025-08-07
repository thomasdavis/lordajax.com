import { ChatLayout } from '@/components/chat/ChatLayout';

export default function ChatPage({ params }: { params: { id: string } }) {
  return <ChatLayout chatId={params.id} />;
}