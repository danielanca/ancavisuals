import React, { useState } from 'react';
import styles from './ConversationInfo.module.scss';
import { useParams, useNavigate } from 'react-router-dom';
import data from './messages.json';

const ConversationsInfo = () => {
  const { scanNR, otherNumber } = useParams();
  const numberData = data[scanNR];
  const navigate = useNavigate();

  const handleBackButtonClick = () => {
    navigate(`/game/interceptor/number/${scanNR}`);
  };

  if (!numberData || !numberData[otherNumber]) {
    return <div>Conversation not found</div>;
  }

  const messages = numberData[otherNumber];
  return (
    <div className={styles.conversationsInfoContainer}>
      <div className={styles.conversationsInfoWrapper}>
        <div className={styles.loginTopTitle}>Lorem ipsum, dolor </div>
        <div className={styles.titleUnderline}> </div>
        <div className={styles.divConv}>
          <div className={styles.backBtn}>
            <button onClick={handleBackButtonClick}>Inapoi</button>
          </div>
          <div className={styles.titleOne}>Interceptare activitate {scanNR}</div>
          <div key={otherNumber}>
            <div className={styles.titleTwo}>Conversatii interceptate:</div>

            {numberData[otherNumber].map((message, index) => (
              <div key={index} className={message.from == scanNR ? styles.sent : styles.received}>
                <p>{message.from}</p>
                <p className={styles.message}>{message.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
export default ConversationsInfo;
