import { ForensicHandler } from './gameLogic/detectiveChat/forensicHandler.js';
import { ChatResponse, streamType } from './gameLogic/detectiveChat/ConversationTypes.js';
interface ChatMessage {
  sender: 'user' | 'robot';
  departmentId: 'forensic' | 'technical' | 'assistant';
  message: string;
  timestamp: string; // ISO 8601 format
}
const messageHistory: ChatMessage[] = [];

interface RESPONSE_TYPE {
  status: string;
  feedbackMessage: ChatResponse;
}

function addMessageToHistory(newMessage: ChatMessage): void {
  messageHistory.push(newMessage);
}
function getMessageHistory(): ChatMessage[] {
  return messageHistory.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

const getChatResponse = async (data: streamType): Promise<RESPONSE_TYPE> => {
  let status = 'SUCCESS';
  let feedbackMessage: ChatResponse;

  switch (data.departmentId) {
    case 'forensic':
      feedbackMessage = await forensicResponse(data);
      break;
    // case 'technical':
    //     feedbackMessage = "Technical department: Reviewing the digital footprints."; break;
    // case 'assistant':
    //     feedbackMessage = "Assistant Colleague: How can I assist you with the case?"; break;
    default:
      feedbackMessage = await forensicResponse(data);
      break;
  }
  console.log('Sending ', { status, feedbackMessage });
  return { status, feedbackMessage };
};

async function forensicResponse(data: streamType): Promise<ChatResponse> {
  const forensicHandler = new ForensicHandler();

  return await forensicHandler.forensicResponse(data);
}

export { getChatResponse };
