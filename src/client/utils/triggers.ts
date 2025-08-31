import { getUserBrowser } from './onScreen';
import { destination } from './address';

const isProd = process.env.NODE_ENV === 'production';
interface EventsTrigger {
  typeEvent: string;
  url: string;
}

export const sendTriggerEmail = async ({ typeEvent, url }: EventsTrigger) => {
  try {
    if (!typeEvent || !url) {
      console.log('SEND ERROR:', typeEvent, url);
      throw new Error('Invalid input: typeEvent and url are required and url must be valid.');
    }

    if (!isProd) {
      console.error('You are on the local host, so we dont send the email');
      return;
    }
    const response = await fetch(`${destination}/triggerEvent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify({
        typeEvent: sanitizeInput(typeEvent),
        url: sanitizeInput(url),
        browserVersion: getUserBrowser(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    console.log('Email trigger sent successfully.');
    const text = response.text();
    console.log(text);
    return response;
  } catch (error) {
    console.error('Error sending trigger email:', error);
    throw error;
  }
};

const sanitizeInput = (input: string): string => {
  return input.replace(/</g, '&lt;').replace(/>/g, '&gt;');
};
