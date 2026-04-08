import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Conversations.module.scss";
import { useParams } from "react-router-dom";
import data from "./messages.json";

const Conversations = () => {
  return <div className={styles.conversationsContainer}></div>;
};
export default Conversations;
