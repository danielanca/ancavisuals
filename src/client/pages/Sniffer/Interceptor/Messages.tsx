import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import data from './messages.json';

import './Messages.css';

const Messages = () => {
  const [scanNR, setScanNR] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const handleScan = () => {
    if (data[scanNR]) {
      navigate(`/game/interceptor/number/${scanNR}`);
      setError('');
    } else {
      setError('Number not found');
    }
  };
  return (
    <div className='messagesContainer'>
      <div className='messagesWrapper'>
        <div className='loginTopTitle'>Lorem ipsum, dolor </div>
        <div className='titleUnderline'> </div>
        <div className='messTitle'>intercept the following number</div>

        <div className='scanWrapper'>
          <div className='scan'>
            <input
              autoComplete='off'
              type='text'
              id='scanNR'
              value={scanNR}
              onChange={e => setScanNR(e.target.value)}
              required
            />
          </div>
        </div>

        <div className='error'>{error}</div>

        <div className='scanBTN'>
          <button onClick={handleScan}>SCAN THE NUMBER </button>
        </div>
      </div>
    </div>
  );
};

export default Messages;
