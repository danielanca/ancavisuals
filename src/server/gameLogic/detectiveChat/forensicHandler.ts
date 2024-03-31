import { conversationMapSecond } from './conversationMaps.js';
import { ConversationState, accountInterface, messageAccount, streamType } from './ConversationTypes.js';
import { getDynamicDocumentOrCollection, saveDiscussionStateToDB, db } from './getters.js';

type ChatResponse = {
  response: string;
  suggestedNextPrompts: string[];
  error?: string;
  header?: {
    state: 'NO_HISTORY_FOUND';
    info?: string;
  };
};

export class ForensicHandler {
  async getHistoryChat(data: any): Promise<ChatResponse> {
    const chatRef = db
      .collection('accounts')
      .doc(data.clientId)
      .collection('departments')
      .doc(data.departmentId)
      .collection('conversations')
      .doc('current')
      .collection('messages');

    // Fetch the chat history
    try {
      const snapshot = await chatRef.orderBy('timestamp', 'asc').get();
      if (snapshot.empty) {
        return {
          response: '',
          header: {
            state: 'NO_HISTORY_FOUND',
            info: 'No chat history available.',
          },
          suggestedNextPrompts: [...conversationMapSecond.values().next().value[0].triggers],
        };
      } else {
        // Construct a response that includes the entire chat history
        // This example simply concatenates messages, but you may want to format it differently
        let chatHistory = snapshot.docs
          .map(doc => {
            let messageData = doc.data();
            return `${messageData.sender}[:] ${messageData.message}`;
          })
          .join('\n');

        let lastMessageData = snapshot.docs[snapshot.docs.length - 1].data();
        // Assuming the last doc contains the last message from the robot
        let lastMessage = lastMessageData.message;
        let suggestedNextPrompts: string[] = [];

        // Iterate backwards to find the last message sent by the robot
        for (let i = snapshot.docs.length - 1; i >= 0; i--) {
          let doc = snapshot.docs[i];
          let messageData = doc.data();
          // Assuming "robot" is the identifier for messages sent by the robot
          // This condition should be adjusted based on how robot messages are identified
          if (messageData.sender === 'robot') {
            lastMessageData = messageData;
            break;
          }
        }

        if (lastMessageData) {
          let lastMessage = lastMessageData.message;

          // Find the current state based on the last message
          for (let [state, steps] of conversationMapSecond) {
            for (let step of steps) {
              if (step.response === lastMessage) {
                suggestedNextPrompts = step.suggestedNextPrompts;
                break;
              }
            }
            if (suggestedNextPrompts.length > 0) {
              break;
            }
          }
        } else {
          // Handle case where no robot messages were found
          suggestedNextPrompts = []; // Or some default prompts, if applicable
        }

        // Find the current state based on the last message
        for (let [state, steps] of conversationMapSecond) {
          for (let step of steps) {
            if (step.response === lastMessage) {
              suggestedNextPrompts = step.suggestedNextPrompts;
              break;
            }
          }
          if (suggestedNextPrompts.length > 0) {
            break;
          }
        }
        return {
          response: chatHistory,
          suggestedNextPrompts: suggestedNextPrompts,
        };
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
      let defaultResponse: ChatResponse = {
        response: '',
        header: {
          info: 'No history found!',
          state: 'NO_HISTORY_FOUND',
        },
        suggestedNextPrompts: [conversationMapSecond.values().next().value[0].triggers],
      };
      return defaultResponse;
    }
  }

  async forensicResponse(data: streamType): Promise<ChatResponse> {
    const message = data.message?.toLowerCase();

    if (data.message === 'REQUEST_HISTORY') {
      return this.getHistoryChat(data);
    }
    let defaultResponse: ChatResponse = {
      response: 'Can you provide more information or clarify?',
      suggestedNextPrompts: [...conversationMapSecond.values().next().value[0].triggers],
    };
    const chatRef = db
      .collection('accounts')
      .doc(data.clientId)
      .collection('departments')
      .doc(data.departmentId)
      .collection('conversations')
      .doc('current')
      .collection('messages');

    await chatRef.add({
      sender: 'user',
      message: message, // Original message before converting to lowercase
      timestamp: new Date().toISOString(),
    });

    if (!message) {
      return { response: 'No message', suggestedNextPrompts: [''] };
    }

    for (let [state, steps] of conversationMapSecond.entries()) {
      for (let step of steps) {
        if (step.triggers.some(trigger => trigger.toLowerCase() === message)) {
          // Match found, return the corresponding response and suggestions
          await chatRef.add({
            sender: 'robot',
            message: step.response,
            timestamp: new Date().toISOString(),
          });
          return {
            response: step.response,
            suggestedNextPrompts: step.suggestedNextPrompts,
          };
        }
      }
    }
    return defaultResponse;
  }
}
