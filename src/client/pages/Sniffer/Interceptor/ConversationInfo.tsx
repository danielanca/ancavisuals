import React, { useState } from 'react';
import styles from './ConversationInfo.module.scss';
import { useParams, useNavigate } from 'react-router-dom';
import data from './messages.json';

const ConversationsInfo = () => {
  const { scanNR, otherNumber } = useParams(); 
  const navigate = useNavigate(); 
  return (
    <div className={styles.conversationsInfoContainer}>
      <div className={styles.conversationsInfoWrapper}>
        <div className={styles.loginTopTitle}>Lorem ipsum, dolor </div>
        <div className={styles.titleUnderline}> </div>
     
      </div>
    </div>
  );
};
export default ConversationsInfo;
