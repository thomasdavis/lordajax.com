import { ChatInterface } from '@/components/chat/ChatInterface';

export default function ChatPage({ params }: { params: { id: string } }) {
  return <ChatInterface chatId={params.id} />;
}