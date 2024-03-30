import {
  streamType,
  departmentType,
} from 'src/server/gameLogic/detectiveChat/ConversationTypes';

export type Message = {
  id: number;
  text: string;
  sender: 'player' | 'robot';
};

export interface ChatMessage {
  sender: 'user' | 'robot';
  departmentId: departmentType;
  message: string;
  timestamp?: string;
  isTyping?: boolean;
}

export const sendMessage = async (chatMessage: Partial<ChatMessage>) => {
  const streamSend: streamType = {
    departmentId: 'forensic',
    message: chatMessage.message,
    clientId: 'daniel.anca',
  };
  const response = await fetch('/chat', {
    ...optionForJSON,
    body: JSON.stringify(streamSend),
  });
  return await response.json();
};

const optionForJSON = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};
