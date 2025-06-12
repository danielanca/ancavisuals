import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import data from './messages.json';
import styles from './Messages.module.scss';

const Messages = () => {
  const [scanNR, setScanNR] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  return (
    <div className={styles.messagesContainer}>
      <div className={styles.messagesWrapper}>
        <div className={styles.loginTopTitle}>Lorem ipsum, dolor </div>
        <div className={styles.titleUnderline}> </div>
        <div className={styles.messTitle}>intercept the following number</div>

        <div className={styles.scanWrapper}>
          <div className={styles.scan}>
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

        <div className={styles.error}>{error}</div>
 
      </div>
    </div>
  );
};

export default Messages;
