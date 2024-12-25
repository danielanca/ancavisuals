import React, { useEffect, useState, useRef } from 'react';
import styles from './Prompt.module.scss';

const txt = [
  'FORCE: XX0022. ENCYPT://000.222.2345',
  'TRYPASS: ********* AUTH CODE: ALPHA GAMMA: 1___ PRIORITY 1',
  'RETRY: REINDEER FLOTILLA',
  'Z:> /BUN VENIT IN PANOUL SECRET DE COMANDA',
  '===============================',
  'Priority 1 // local / scanning...',
  'Verificare conexiune ...',
  'BACKDOOR FOUND (23.45.23.12.00000000)',
  'BACKDOOR FOUND (13.66.23.12.00110000)',
  'BACKDOOR FOUND (13.66.23.12.00110044)',
  '...',
  '...',
  'Autentificare reusita! Bun venit!',
  'MCP/> DEPLOY CLU',
  'SCAN: __ 0100.0000.0554.0080',
  'SCAN: __ 0020.0000.0553.0080',
  'SCAN: __ 0001.0000.0554.0550',
  'Conectat cu succes. Pentru ajutor, tastati /help',
];
//WARNING
//IN strict MODE, the TEXT will be incremented by 2, so only the odd index will appear.
const Prompt = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [accessGranted, setAccessGranted] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null); // Reference to keep the focus on the input
  const maxLines: number = 20;

  useEffect(() => {
    // Function to force focus back to the input
    const focusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };
    // Listen for any click events on the document
    document.addEventListener('click', focusInput);
    // Cleanup the event listener on component unmount
    return () => {
      document.removeEventListener('click', focusInput);
    };
  }, []);
  useEffect(() => {
    console.log('Line index is:', lineIndex);
    const intervalID = setInterval(() => {
      setMessages(currentMessages => {
        if (lineIndex < maxLines) {
          let newMessages = [...currentMessages, txt[lineIndex]];
          // Ensure the length of newMessages does not exceed maxLines
          if (newMessages.length > maxLines) {
            // Remove the oldest message(s) as needed
            newMessages = newMessages.slice(-maxLines);
          }
          setLineIndex(prevIndex => prevIndex + 1);
          return newMessages;
        }
        return currentMessages;
      });
    }, 200);

    const timeoutID = setTimeout(() => {
      setAccessGranted(true);
      clearInterval(intervalID); // Stop adding lines once access is granted
    }, 5000);

    return () => {
      clearTimeout(timeoutID);
      clearInterval(intervalID);
    };
  }, [lineIndex]);

  // Handle input change
  const handleInputChange = (event: any) => {
    setInputValue(event.target.value);
  };
  // Submit the input value
  const handleSubmit = (event: any) => {
    if (event.key === 'Enter') {
      setMessages(currentMessages => {
        let newMessages = [...currentMessages, inputValue.trim()]; // Trim input value to avoid adding empty messages
        if (newMessages.length > maxLines) {
          newMessages = newMessages.slice(-maxLines); // Simplified to directly use -maxLines
        }
        return newMessages;
      });
      setInputValue('');
      inputRef.current?.focus(); // Safely call focus with optional chaining
    }
  };
  return (
    <>
      <div>
        {accessGranted ? (
          <div className={styles.msg} style={{ background: 'limegreen', boxShadow: '0 0 30px limegreen' }}>
            ACCESS GRANTED
          </div>
        ) : (
          <div className={styles.msg}>Scanning</div>
        )}

        <div id='console'>
          {messages.map((message, index) => (
            <p key={index}>{message}</p>
          ))}
        </div>
      </div>
      <div className={styles.inputPrompt}>
        <input
          ref={inputRef}
          value={`${inputValue}`}
          onChange={handleInputChange}
          onKeyPress={handleSubmit}
          placeholder='Tasteaza comanda'
          autoFocus
        />
      </div>
    </>
  );
};

export default Prompt;
