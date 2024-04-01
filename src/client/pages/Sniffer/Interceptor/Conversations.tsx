import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Conversations.module.scss';
import { useParams } from 'react-router-dom';
import data from './messages.json';

const Conversations = () => {
  const navigate = useNavigate();
  const { scanNR } = useParams();
  const numberData = data[scanNR];

  if (!numberData) {
    return <div>Number not found</div>;
  }

  const handleConversationClick = (otherNumber: any) => {
    navigate(`/game/interceptor/conversationsInfo/${scanNR}/${otherNumber}`);
  };

  return (
    <div className={styles.conversationsContainer}>
      <div className={styles.conversationsWrapper}>
        <div className={styles.loginTopTitle}>Lorem ipsum, dolor </div>
        <div className={styles.titleUnderline}> </div>
        <div className={styles.divConv}>
          <div className={styles.titleOne}>Interceptare activitate : {scanNR}</div>
          <div className={styles.titleTwo}> Conversatii interceptate</div>
          {Object.keys(numberData).map(otherNumber => (
            <div key={otherNumber} className={styles.activitate}>
              <button onClick={() => handleConversationClick(otherNumber)}>{otherNumber}</button>
              {/* {numberData[otherNumber].map((message, index) => (
            <div key={index}>
              <p>Timestamp: {message.timestamp}</p>
              <p>From: {message.from}</p>
              <p>To: {message.to}</p>
              <p>Message: {message.message}</p>
              <p>Location: {message.metadata.location}</p>
            </div>
          ))} */}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default Conversations;
