// src/client/components/AdminArea/Dashboard/index.tsx
import React from "react";
import { Row, Col, Card, Breadcrumb } from "react-bootstrap";
import styles from "./Dashboard.module.scss";

const Dashboard: React.FC = () => {
  return (
    <div className={`page-content ${styles.background}`}>
      <Row>
        <Col xs={12}>
        <div className="page-title-box d-flex align-items-center justify-content-between">
            <h3 className={styles.adminText}>Hello World</h3>
        </div>
        </Col>
      </Row>

        </div>
  );
};

export default Dashboard;
