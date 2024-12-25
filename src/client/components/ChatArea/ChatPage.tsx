// ChatPage.tsx
import React, { useState, useEffect } from 'react';
import styles from './ChatPage.module.scss';
import { sendMessage, ChatMessage } from './requests';
import { ChatResponse, departmentType } from './../../../server/gameLogic/detectiveChat/ConversationTypes';

const departmentID_URL = 'forensic';
const accountID = 'daniel.anca';

interface chatPageProps {
  departmentID_URL: departmentType;
  accountID: string;
}

const chatProps: chatPageProps = {
  departmentID_URL: 'forensic',
  accountID: 'daniel.anca',
};

export const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);

  const parseHistoryToChatMessages = (historyString: string, departmentId: string): ChatMessage[] | null => {
    if (historyString === '') {
      return null;
    }
    const validDepartmentIds: departmentType[] = ['forensic', 'technical', 'assistant'];
    const isDepartmentIdValid = validDepartmentIds.includes(departmentId as departmentType);

    if (isDepartmentIdValid) {
      const messagesArray = historyString.split('\n'); // Split by line breaks
      return messagesArray.map((line: any): ChatMessage => {
        const [sender, message] = line.split('[:] '); // Split each line into sender and message
        return {
          sender: sender.trim() === 'user' ? 'user' : 'robot', // Determine the sender
          message: message.trim(), // Trim the message
          timestamp: Date.now().toString(), // Use the current timestamp, or modify as needed
          departmentId: departmentId as departmentType, // Use the provided department ID
        };
      });
    } else {
      return null;
    }
  };

  // useEffect hook to fetch conversation history on component mount
  useEffect(() => {
    const fetchConversationHistory = async () => {
      console.log('Loading conversation history...');
      const requestHistory: ChatMessage = {
        departmentId: chatProps.departmentID_URL,
        sender: 'user',
        message: 'REQUEST_HISTORY',
      };
      sendMessage(requestHistory).then(response => {
        if (response.response.status !== 'SUCCESS') {
          // If sending fails, revert the optimistic update (this is a simplified approach)
          // In a real application, you'd likely want to mark the message as failed in the UI
          console.error('Failed to send message');
        } else {
          console.log('THE DATA HISTORY IS:', response.response.feedbackMessage);
          const parsedMessages = parseHistoryToChatMessages(
            response.response.feedbackMessage.response,
            departmentID_URL
          );

          if (parsedMessages !== null) {
            setMessages(parsedMessages);
            console.log('Adding to suggested:', response.response.feedbackMessage.suggestedNextPrompts);
          }
          setSuggestedPrompts(response.response.feedbackMessage.suggestedNextPrompts);
        }
      });
    };

    fetchConversationHistory();
  }, []);

  useEffect(() => {
    console.log('Suggested is:', suggestedPrompts);
  }, [suggestedPrompts]);
  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const newMessageOut: ChatMessage = {
      departmentId: departmentID_URL,
      sender: 'user',
      message: inputText,
    };

    setMessages(prevMessages => [...prevMessages, newMessageOut]); //OPTIMIST UI

    sendMessage(newMessageOut).then(response => {
      if (response.response.status !== 'SUCCESS') {
        // If sending fails, revert the optimistic update (this is a simplified approach)
        // In a real application, you'd likely want to mark the message as failed in the UI
        console.error('Failed to send message');
        setMessages(prevMessages => prevMessages.filter(m => m.timestamp !== newMessageOut.timestamp));
      }
      // If success, the real message will be added through the Firestore listener

      if (response.response.status === 'SUCCESS') {
        const feedbackMessage = response.response.feedbackMessage;
        console.log('response:', response.response);
        const robotResponse: ChatMessage = {
          sender: 'robot',
          departmentId: departmentID_URL,
          message: feedbackMessage.response,
        };
        setMessages(prevMessages => [...prevMessages, robotResponse]);
        setSuggestedPrompts(feedbackMessage.suggestedNextPrompts);
      }
    });

    setInputText('');
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.conversationHeader}>
        <div className={styles.imgProfileWrapper}>
          <img src='https://www.hofstra.edu/sites/default/files/2020-12/Chemistry%20Summer%20Research%20Students%20-35.jpg' />
        </div>
        <div className={styles.chatRecipientInfo}>
          <h3>Miclea Marian</h3>
          <p>Departmentul Forensic</p>
        </div>
      </div>
      <div className={styles.messagesContainer}>
        {messages.map((message: ChatMessage, index: number) => (
          <div
            key={`${message.timestamp}+${index}`}
            className={`${styles.message} ${message.sender === 'user' ? styles.right : styles.left}`}
          >
            {message.isTyping ? <div className={styles.typingIndicator}>Typing...</div> : message.message}
          </div>
        ))}
      </div>
      <div className={styles.suggestedPromptsContainer}>
        {suggestedPrompts &&
          suggestedPrompts.map((prompt, index) => (
            <button
              key={index}
              className={styles.promptButton}
              onClick={() => setInputText(prompt)} // Option to set prompt as input text
              // onClick={() => handleSendMessage(prompt)} // Or send the prompt directly
            >
              {prompt}
            </button>
          ))}
      </div>
      <div className={styles.inputContainer}>
        <input
          type='text'
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          className={styles.messageInput}
          onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
        />
        <button onClick={handleSendMessage} className={styles.sendButton}>
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatPage;
